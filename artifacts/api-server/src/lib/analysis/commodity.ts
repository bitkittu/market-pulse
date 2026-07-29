import { alignmentScore, directionOf, summariseTimeframes } from "./timeframes.js";
import { computeScore, scoreInBand, SIGNAL_LABELS, type CategoryInput } from "./scoring.js";
import type {
  AiAnalysis,
  Direction,
  MetricItem,
  Reason,
  RiskFactor,
  SignalScore,
  TimeframeIndicator,
  TimeframeTrend,
  Tone,
  TradePlan,
} from "./types.js";

/**
 * Commodity analytics + explanation layer.
 *
 * Unlike options and intraday, the commodity feed is genuinely live (Yahoo
 * Finance daily closes), so every indicator here is computed from real prices
 * rather than simulated. The two trend cards are therefore labelled 5-DAY and
 * 10-DAY — the windows the data actually supports. Inventing 3-minute candles
 * from daily closes would be fabrication.
 */

export interface CommodityAnalysisInput {
  symbol: string;
  name: string;
  category: string;
  emoji: string;
  unit: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  dayHigh: number;
  dayLow: number;
  prevClose: number;
  /** Real daily closes (most recent last). */
  sparkline: number[];
  prediction: { signal: "BULLISH" | "BEARISH" | "NEUTRAL"; confidence: number; momentum: number; buyPressure: number };
  usdToInr: number;
  updatedAt: string;
}

const ENGINE = "MarketPulse Commodities";
const ENGINE_VERSION = "v1";

function round2(n: number) {
  return parseFloat(n.toFixed(2));
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function toInr(usd: number, rate: number) {
  return round2(usd * rate);
}

function fmtInr(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

// ── Real indicator maths over daily closes ─────────────────────────────────

function smaOf(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function emaOf(values: number[], period: number): number {
  if (!values.length) return 0;
  const k = 2 / (period + 1);
  return values.reduce((acc, v, i) => (i === 0 ? v : v * k + acc * (1 - k)), values[0]);
}

function rsiOf(values: number[]): number {
  if (values.length < 3) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) gains += d;
    else losses += Math.abs(d);
  }
  const n = values.length - 1;
  const avgGain = gains / n;
  const avgLoss = losses / n;
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function toneFor(favours: Direction, tradeDirection: Direction): Tone {
  if (favours === "NEUTRAL" || tradeDirection === "NEUTRAL") return "neutral";
  return favours === tradeDirection ? "positive" : "negative";
}

function markerFor(tone: Tone): string {
  return tone === "positive" ? "✓" : tone === "negative" ? "✕" : "—";
}

/** Build one trend card from a real window of closes. */
function buildWindow(
  closes: number[],
  label: string,
  caption: string,
  timeframe: string,
  tradeDirection: Direction
): TimeframeTrend {
  const first = closes[0] ?? 0;
  const last = closes[closes.length - 1] ?? 0;
  const momentumPct = first ? ((last - first) / first) * 100 : 0;
  const rsi = rsiOf(closes);
  const sma = smaOf(closes);
  const emaFast = emaOf(closes, Math.max(2, Math.floor(closes.length / 3)));
  const emaSlow = emaOf(closes, Math.max(3, closes.length));
  const hi = Math.max(...closes);
  const lo = Math.min(...closes);
  const range = hi - lo;
  const rangePos = range > 0 ? ((last - lo) / range) * 100 : 50;

  // Conviction blends realised momentum with RSI displacement from 50.
  const ds = clamp(momentumPct / 4 + (rsi - 50) / 60, -1, 1);
  const direction = directionOf(ds);

  const smaFavours: Direction = last > sma * 1.001 ? "BULLISH" : last < sma * 0.999 ? "BEARISH" : "NEUTRAL";
  const macdFavours: Direction = emaFast > emaSlow * 1.001 ? "BULLISH" : emaFast < emaSlow * 0.999 ? "BEARISH" : "NEUTRAL";
  const rsiFavours: Direction = rsi > 55 ? "BULLISH" : rsi < 45 ? "BEARISH" : "NEUTRAL";
  const momFavours: Direction = momentumPct > 0.3 ? "BULLISH" : momentumPct < -0.3 ? "BEARISH" : "NEUTRAL";

  const mk = (favours: Direction): { tone: Tone; marker: string } => {
    const tone = toneFor(favours, tradeDirection);
    return { tone, marker: markerFor(tone) };
  };

  const indicators: TimeframeIndicator[] = [
    { label: `RSI (${timeframe})`, value: rsi.toFixed(1), ...mk(rsiFavours), provenance: "CALCULATED" },
    {
      label: "Price vs SMA",
      value: smaFavours === "BULLISH" ? "Above SMA" : smaFavours === "BEARISH" ? "Below SMA" : "At SMA",
      ...mk(smaFavours),
      provenance: "CALCULATED",
    },
    {
      label: `MACD (${timeframe})`,
      value: macdFavours === "BULLISH" ? "Bullish" : macdFavours === "BEARISH" ? "Bearish" : "Flat",
      ...mk(macdFavours),
      provenance: "CALCULATED",
    },
    {
      label: "EMA Fast/Slow",
      value: macdFavours === "BULLISH" ? "Bullish" : macdFavours === "BEARISH" ? "Bearish" : "Crossover",
      ...mk(macdFavours),
      provenance: "CALCULATED",
    },
    {
      label: "Momentum",
      value: `${momentumPct >= 0 ? "+" : ""}${momentumPct.toFixed(2)}%`,
      ...mk(momFavours),
      provenance: "CALCULATED",
    },
    {
      label: "Range Position",
      value: `${Math.round(rangePos)}%`,
      ...mk(rangePos > 60 ? "BULLISH" : rangePos < 40 ? "BEARISH" : "NEUTRAL"),
      provenance: "CALCULATED",
    },
  ];

  const strength = Math.round(clamp(34 + Math.abs(ds) * 58 + (range > 0 ? 6 : 0), 12, 97));
  const sparkline = range > 0 ? closes.map((c) => parseFloat(((c - lo) / range).toFixed(4))) : closes.map(() => 0.5);

  return {
    timeframe,
    label,
    caption,
    direction,
    strength,
    directionalScore: parseFloat(ds.toFixed(4)),
    indicators,
    sparkline,
  };
}

export interface CommoditySignalResult {
  score: SignalScore;
  timeframes: TimeframeTrend[];
  multiTimeframe: ReturnType<typeof summariseTimeframes>;
  plan: TradePlan;
  riskRewardRatio: number;
  tradeDirection: Direction;
  rsi10: number;
}

export function computeCommoditySignal(input: CommodityAnalysisInput): CommoditySignalResult {
  const closes = input.sparkline.filter((n) => Number.isFinite(n) && n > 0);
  const short = closes.slice(-5);
  const long = closes;

  // A NEUTRAL prediction still has a lean; use realised momentum to pick the
  // side being analysed rather than greying out the whole panel.
  const tradeDirection: Direction =
    input.prediction.signal !== "NEUTRAL"
      ? input.prediction.signal
      : input.prediction.momentum >= 0
        ? "BULLISH"
        : "BEARISH";
  const dirSign = tradeDirection === "BULLISH" ? 1 : -1;

  const timeframes = [
    buildWindow(short.length >= 3 ? short : closes, "5-DAY TREND", "Short-term momentum", "5d", tradeDirection),
    buildWindow(long, "10-DAY TREND", "Medium-term momentum", "10d", tradeDirection),
  ];
  const multiTimeframe = summariseTimeframes(timeframes, tradeDirection);
  const avgStrength = timeframes.reduce((s, f) => s + f.strength, 0) / timeframes.length;
  const rsi10 = rsiOf(long);

  // Trade plan from the real daily range (an ATR stand-in).
  const dayRange = Math.max(input.dayHigh - input.dayLow, input.price * 0.004);
  const r = dayRange * 0.6;
  const entryLowUsd = tradeDirection === "BULLISH" ? input.price - r * 0.25 : input.price;
  const entryHighUsd = tradeDirection === "BULLISH" ? input.price : input.price + r * 0.25;
  const target1Usd = input.price + dirSign * r * 1.5;
  const target2Usd = input.price + dirSign * r * 3;
  const stopUsd = input.price - dirSign * r * 1.2;

  const riskUsd = Math.abs((tradeDirection === "BULLISH" ? entryHighUsd : entryLowUsd) - stopUsd);
  const rewardUsd = Math.abs(target2Usd - (tradeDirection === "BULLISH" ? entryHighUsd : entryLowUsd));
  const riskRewardRatio = parseFloat((rewardUsd / Math.max(riskUsd, 1e-6)).toFixed(2));

  const plan: TradePlan = {
    currency: "₹",
    entryLow: toInr(Math.min(entryLowUsd, entryHighUsd), input.usdToInr),
    entryHigh: toInr(Math.max(entryLowUsd, entryHighUsd), input.usdToInr),
    target1: toInr(target1Usd, input.usdToInr),
    target2: toInr(target2Usd, input.usdToInr),
    stopLoss: toInr(stopUsd, input.usdToInr),
    riskReward: `1 : ${riskRewardRatio.toFixed(1)}`,
    maxRisk: {
      amount: toInr(riskUsd, input.usdToInr),
      pct: round2((riskUsd / input.price) * 100),
      lots: null,
      lotSize: null,
      note: `${fmtInr(toInr(riskUsd, input.usdToInr))} risk per ${input.unit.replace("/", "")} — sized from the real daily range`,
      provenance: "CALCULATED",
    },
  };

  const buyPressureForTrade = tradeDirection === "BULLISH" ? input.prediction.buyPressure : 100 - input.prediction.buyPressure;

  const categories: CategoryInput[] = [
    {
      key: "trendDirection",
      score: input.prediction.signal === "NEUTRAL" ? 46 : 50 + Math.abs(input.prediction.momentum) * 7,
      note: `20-day model reads ${input.prediction.signal.toLowerCase()} with ${input.prediction.momentum >= 0 ? "+" : ""}${input.prediction.momentum}% 5-day momentum.`,
    },
    {
      key: "momentum",
      score: avgStrength,
      note: `Average trend strength across 5d and 10d windows is ${Math.round(avgStrength)}/100.`,
    },
    {
      key: "multiTimeframe",
      score: alignmentScore(multiTimeframe, tradeDirection),
      note: multiTimeframe.alignmentLabel,
    },
    {
      key: "buyPressure",
      score: buyPressureForTrade,
      note: `Buy pressure of ${input.prediction.buyPressure}% ${
        buyPressureForTrade >= 55 ? "supports" : "works against"
      } a ${tradeDirection.toLowerCase()} position.`,
    },
    {
      key: "rangePosition",
      score: scoreInBand(rsi10, tradeDirection === "BULLISH" ? [52, 70] : [30, 48], 5, 95),
      note: `10-day RSI at ${rsi10.toFixed(1)}.`,
    },
    {
      key: "volatility",
      score: scoreInBand((dayRange / input.price) * 100, [0.5, 2], 0, 8),
      note: `Daily range is ${((dayRange / input.price) * 100).toFixed(2)}% of price.`,
    },
    {
      key: "riskReward",
      score: scoreInBand(riskRewardRatio, [1.8, 4], 0, 6),
      note: `Risk/reward to target 2 is 1 : ${riskRewardRatio.toFixed(1)}.`,
    },
  ];

  const score = computeScore("commodities", categories, multiTimeframe.confidenceBoost);
  return { score, timeframes, multiTimeframe, plan, riskRewardRatio, tradeDirection, rsi10 };
}

function buildReasons(input: CommodityAnalysisInput, result: CommoditySignalResult): Reason[] {
  const byKey = new Map(result.score.categories.map((c) => [c.key, c]));
  const reasons: Reason[] = [];
  const dirWord = result.tradeDirection.toLowerCase();

  const trend = byKey.get("trendDirection");
  if (trend && trend.score >= 58) {
    reasons.push({ text: `20-day model reads ${dirWord} with ${input.prediction.momentum >= 0 ? "+" : ""}${input.prediction.momentum}% momentum`, source: trend.label });
  }
  const bp = byKey.get("buyPressure");
  if (bp && bp.score >= 55) {
    reasons.push({ text: `Buy pressure at ${input.prediction.buyPressure}% of the 20-day range`, source: bp.label });
  }
  const rp = byKey.get("rangePosition");
  if (rp && rp.score >= 58) reasons.push({ text: `10-day RSI at ${result.rsi10.toFixed(1)} supports continuation`, source: rp.label });

  for (const frame of result.timeframes) {
    if (frame.direction === result.tradeDirection) {
      reasons.push({ text: `${frame.label.replace(" TREND", "").toLowerCase()} trend confirmed ${dirWord}`, source: frame.label });
    }
  }
  if (result.multiTimeframe.aligned && result.multiTimeframe.alignment === result.tradeDirection) {
    reasons.push({ text: "Both windows agree on direction", source: "Multi-Timeframe Alignment" });
  }
  const vol = byKey.get("volatility");
  if (vol && vol.score >= 60) reasons.push({ text: "Daily range is orderly enough to place a workable stop", source: vol.label });

  const rr = byKey.get("riskReward");
  if (rr && rr.score >= 60) reasons.push({ text: `Favourable risk/reward at 1 : ${result.riskRewardRatio.toFixed(1)}`, source: rr.label });

  if (reasons.length === 0) {
    reasons.push({ text: "No category scored strongly enough to support this trade", source: "Signal Scoring Engine" });
  }
  return reasons;
}

function buildRisks(input: CommodityAnalysisInput, result: CommoditySignalResult): RiskFactor[] {
  const risks: RiskFactor[] = [];
  const dayRangePct = ((input.dayHigh - input.dayLow) / input.price) * 100;

  if (input.prediction.signal === "NEUTRAL") {
    risks.push({ text: "20-day model reads NEUTRAL — direction is inferred from short-term momentum only", severity: "high" });
  }
  if (!result.multiTimeframe.aligned) {
    risks.push({
      text: result.multiTimeframe.alignment === "CONFLICT"
        ? "5-day and 10-day windows disagree on direction"
        : "Neither window shows a decisive trend",
      severity: "high",
    });
  }
  if (result.rsi10 > 70) risks.push({ text: `10-day RSI at ${result.rsi10.toFixed(1)} is overbought`, severity: "medium" });
  if (result.rsi10 < 30) risks.push({ text: `10-day RSI at ${result.rsi10.toFixed(1)} is oversold`, severity: "medium" });
  if (dayRangePct > 2.5) risks.push({ text: `Daily range of ${dayRangePct.toFixed(2)}% is wide — stops get hit on noise`, severity: "medium" });
  if (input.prediction.confidence < 55) {
    risks.push({ text: `Base model confidence is only ${input.prediction.confidence}%`, severity: "medium" });
  }
  const weak = result.timeframes.find((f) => f.strength < 45);
  if (weak) risks.push({ text: `${weak.label.replace(" TREND", "")} momentum is weak (${weak.strength}/100)`, severity: "medium" });
  if (result.riskRewardRatio < 1.5) {
    risks.push({ text: `Risk/reward of 1 : ${result.riskRewardRatio.toFixed(1)} to target 2 is below the 1 : 1.5 threshold`, severity: "medium" });
  }
  risks.push({ text: "Prices are USD futures converted at the live USD/INR rate — currency moves affect the INR outcome", severity: "low" });
  risks.push({ text: "Analysis uses daily closes; intraday timeframes are not available for this feed", severity: "low" });

  return risks;
}

function buildMetrics(input: CommodityAnalysisInput, result: CommoditySignalResult): MetricItem[] {
  const dayRangePct = ((input.dayHigh - input.dayLow) / input.price) * 100;
  return [
    { label: "Category", value: input.category, badge: null, tone: "neutral", provenance: "STATIC" },
    {
      label: "Day Range",
      value: `${fmtInr(toInr(input.dayLow, input.usdToInr))} – ${fmtInr(toInr(input.dayHigh, input.usdToInr))}`,
      badge: dayRangePct > 2.5 ? "Wide" : null,
      tone: dayRangePct > 2.5 ? "negative" : "neutral",
      provenance: "LIVE",
    },
    { label: "Prev Close", value: fmtInr(toInr(input.prevClose, input.usdToInr)), badge: null, tone: "neutral", provenance: "LIVE" },
    {
      label: "5d Momentum",
      value: `${input.prediction.momentum >= 0 ? "+" : ""}${input.prediction.momentum}%`,
      badge: null,
      tone: (input.prediction.momentum >= 0) === (result.tradeDirection === "BULLISH") ? "positive" : "negative",
      provenance: "CALCULATED",
    },
    {
      label: "Buy Pressure",
      value: `${input.prediction.buyPressure}%`,
      badge: input.prediction.buyPressure > 55 ? "Strong" : input.prediction.buyPressure < 45 ? "Weak" : null,
      tone: input.prediction.buyPressure > 55 ? "positive" : input.prediction.buyPressure < 45 ? "negative" : "neutral",
      provenance: "CALCULATED",
    },
    {
      label: "RSI (10d)",
      value: result.rsi10.toFixed(1),
      badge: result.rsi10 > 70 ? "Overbought" : result.rsi10 < 30 ? "Oversold" : "Neutral",
      tone: result.rsi10 > 70 || result.rsi10 < 30 ? "negative" : "neutral",
      provenance: "CALCULATED",
    },
    { label: "USD/INR", value: input.usdToInr.toFixed(2), badge: null, tone: "neutral", provenance: "LIVE" },
  ];
}

export function buildCommodityAnalysis(input: CommodityAnalysisInput): AiAnalysis {
  const result = computeCommoditySignal(input);
  const now = new Date().toISOString();

  return {
    id: input.symbol,
    market: "commodities",
    title: `${input.emoji} ${input.name}`,
    subtitle: `${input.category} · ${input.symbol}`,
    signal: result.score.signal,
    signalLabel: SIGNAL_LABELS[result.score.signal],
    headline: {
      primaryLabel: "Price",
      primaryValue: `${fmtInr(toInr(input.price, input.usdToInr))}${input.unit}`,
      primaryChangePercent: input.changePercent,
      secondaryLabel: "USD",
      secondaryValue: `$${input.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
      secondaryChangePercent: null,
    },
    score: result.score,
    reasons: buildReasons(input, result),
    timeframes: result.timeframes,
    multiTimeframe: result.multiTimeframe,
    tradePlan: result.plan,
    risks: buildRisks(input, result),
    metrics: buildMetrics(input, result),
    greeks: null,
    optionChain: null,
    provenance: {
      signalGeneratedAt: now,
      dataUpdatedAt: input.updatedAt,
      timeframes: ["5d", "10d"],
      dataSource: "Yahoo Finance (futures quotes, daily closes, USD/INR)",
      engine: ENGINE,
      engineVersion: ENGINE_VERSION,
      mode: "LIVE",
      fields: [
        { name: "Price / day range / prev close", provenance: "LIVE" },
        { name: "Daily closes", provenance: "LIVE" },
        { name: "RSI / momentum / range position", provenance: "CALCULATED" },
        { name: "5d & 10d indicators", provenance: "CALCULATED" },
        { name: "Signal score", provenance: "CALCULATED" },
        { name: "Trade plan", provenance: "CALCULATED" },
        { name: "USD/INR conversion", provenance: "LIVE" },
      ],
    },
  };
}
