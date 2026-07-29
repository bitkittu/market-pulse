import { alignmentScore, buildTimeframePair, summariseTimeframes } from "./timeframes.js";
import { computeScore, scoreInBand, SIGNAL_LABELS, type CategoryInput } from "./scoring.js";
import type {
  AiAnalysis,
  Direction,
  MetricItem,
  Reason,
  RiskFactor,
  SignalScore,
  TradePlan,
} from "./types.js";

/**
 * Intraday equity analytics + explanation layer.
 *
 * The intraday picks list is long-only, so the trade direction is always
 * bullish and the score measures conviction in going long. A weak stock scores
 * low and the engine returns SELL / STRONG_SELL rather than a flattering WATCH.
 */

export interface IntradayAnalysisInput {
  seed: number;
  symbol: string;
  name: string;
  sector: string;
  currentPrice: number;
  changePercent: number;
  buyBelow: number;
  sellAbove: number;
  stopLoss: number;
  rsi: number;
  vwapStatus: "ABOVE" | "BELOW" | "AT";
  volume: number;
  riskLevel: "Low" | "Medium" | "High";
  underlyingIsLive: boolean;
  updatedAt: string;
}

const ENGINE = "MarketPulse Intraday";
const ENGINE_VERSION = "v1";

function round2(n: number) {
  return parseFloat(n.toFixed(2));
}

function fmtInr(n: number, d = 2) {
  return `₹${n.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function fmtCompact(n: number) {
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)}L`;
  return `${(n / 1e3).toFixed(0)}K`;
}

export interface IntradaySignalResult {
  score: SignalScore;
  timeframes: ReturnType<typeof buildTimeframePair>;
  multiTimeframe: ReturnType<typeof summariseTimeframes>;
  plan: TradePlan;
  riskRewardRatio: number;
  tradeDirection: Direction;
}

export function computeIntradaySignal(input: IntradayAnalysisInput): IntradaySignalResult {
  const tradeDirection: Direction = "BULLISH";

  // The bias fed to the indicator engine comes from the stock's own readings,
  // so a weak stock genuinely produces bearish timeframe cards.
  const bullishEvidence = (input.rsi > 55 ? 1 : 0) + (input.vwapStatus === "ABOVE" ? 1 : 0) + (input.changePercent > 0 ? 1 : 0);
  const bearishEvidence = (input.rsi < 45 ? 1 : 0) + (input.vwapStatus === "BELOW" ? 1 : 0) + (input.changePercent < 0 ? 1 : 0);
  const bias: Direction = bullishEvidence > bearishEvidence ? "BULLISH" : bearishEvidence > bullishEvidence ? "BEARISH" : "NEUTRAL";

  const timeframes = buildTimeframePair(input.seed, tradeDirection, bias);
  const multiTimeframe = summariseTimeframes(timeframes, tradeDirection);
  const avgStrength = timeframes.reduce((s, f) => s + f.strength, 0) / timeframes.length;

  const entryLow = round2(Math.min(input.buyBelow, input.currentPrice));
  const entryHigh = round2(Math.max(input.buyBelow, input.currentPrice));
  const target1 = round2(input.sellAbove);
  const target2 = round2(input.currentPrice + (input.sellAbove - input.currentPrice) * 1.8);
  const stopLoss = round2(input.stopLoss);
  const riskPerShare = Math.max(entryHigh - stopLoss, 0.01);
  const rewardPerShare = Math.max(target2 - entryHigh, 0);
  const riskRewardRatio = parseFloat((rewardPerShare / riskPerShare).toFixed(2));
  const riskPct = (riskPerShare / entryHigh) * 100;

  const plan: TradePlan = {
    currency: "₹",
    entryLow,
    entryHigh,
    target1,
    target2,
    stopLoss,
    riskReward: `1 : ${riskRewardRatio.toFixed(1)}`,
    maxRisk: {
      amount: round2(riskPerShare),
      pct: round2(riskPct),
      lots: null,
      lotSize: null,
      note: `${fmtInr(riskPerShare)} risk per share — multiply by your position size`,
      provenance: "CALCULATED",
    },
  };

  const categories: CategoryInput[] = [
    {
      key: "trendDirection",
      score: bias === "BULLISH" ? 84 : bias === "NEUTRAL" ? 50 : 22,
      note: `Price action, RSI and VWAP together read ${bias.toLowerCase()} for a long entry.`,
    },
    {
      key: "momentum",
      score: avgStrength,
      note: `Average trend strength across 3m and 15m is ${Math.round(avgStrength)}/100.`,
    },
    {
      key: "multiTimeframe",
      score: alignmentScore(multiTimeframe, tradeDirection),
      note: multiTimeframe.alignmentLabel,
    },
    {
      key: "volume",
      score: input.volume > 3_000_000 ? 88 : input.volume > 1_200_000 ? 68 : input.volume > 400_000 ? 48 : 28,
      note: `Session volume of ${fmtCompact(input.volume)} is ${input.volume > 1_200_000 ? "healthy" : "below par"}.`,
    },
    {
      key: "rsiPosition",
      // 52-68 is the sweet spot for a long: trending but not yet overbought.
      score: scoreInBand(input.rsi, [52, 68], 10, 95),
      note: `RSI at ${input.rsi.toFixed(1)} — ${
        input.rsi > 70 ? "overbought, chase risk" : input.rsi < 40 ? "weak, no momentum" : "constructive for a long"
      }.`,
    },
    {
      key: "vwapPosition",
      score: input.vwapStatus === "ABOVE" ? 88 : input.vwapStatus === "AT" ? 52 : 24,
      note: `Price is trading ${input.vwapStatus.toLowerCase()} VWAP.`,
    },
    {
      key: "volatility",
      score: input.riskLevel === "Low" ? 84 : input.riskLevel === "Medium" ? 60 : 36,
      note: `Stop-loss distance implies ${input.riskLevel.toLowerCase()} volatility risk.`,
    },
    {
      key: "riskReward",
      score: scoreInBand(riskRewardRatio, [1.8, 4], 0, 6),
      note: `Risk/reward to target 2 is 1 : ${riskRewardRatio.toFixed(1)}.`,
    },
  ];

  const score = computeScore("intraday", categories, multiTimeframe.confidenceBoost);
  return { score, timeframes, multiTimeframe, plan, riskRewardRatio, tradeDirection };
}

function buildReasons(input: IntradayAnalysisInput, result: IntradaySignalResult): Reason[] {
  const byKey = new Map(result.score.categories.map((c) => [c.key, c]));
  const reasons: Reason[] = [];

  const trend = byKey.get("trendDirection");
  if (trend && trend.score >= 60) reasons.push({ text: "Price action confirms bullish bias", source: trend.label });

  const vwap = byKey.get("vwapPosition");
  if (vwap && vwap.score >= 60) reasons.push({ text: `Trading ${input.vwapStatus.toLowerCase()} VWAP`, source: vwap.label });

  const rsi = byKey.get("rsiPosition");
  if (rsi && rsi.score >= 60) reasons.push({ text: `RSI at ${input.rsi.toFixed(1)} supports continuation`, source: rsi.label });

  const vol = byKey.get("volume");
  if (vol && vol.score >= 60) reasons.push({ text: `Volume of ${fmtCompact(input.volume)} backs the move`, source: vol.label });

  for (const frame of result.timeframes) {
    if (frame.direction === "BULLISH") {
      reasons.push({ text: `${frame.timeframe === "3m" ? "3-minute" : "15-minute"} bullish trend confirmed`, source: frame.label });
    }
  }
  if (result.multiTimeframe.aligned && result.multiTimeframe.alignment === "BULLISH") {
    reasons.push({ text: "Both timeframes agree on direction", source: "Multi-Timeframe Alignment" });
  }
  const rr = byKey.get("riskReward");
  if (rr && rr.score >= 60) reasons.push({ text: `Favourable risk/reward at 1 : ${result.riskRewardRatio.toFixed(1)}`, source: rr.label });

  if (reasons.length === 0) {
    reasons.push({ text: "No category scored strongly enough to support a long entry", source: "Signal Scoring Engine" });
  }
  return reasons;
}

function buildRisks(input: IntradayAnalysisInput, result: IntradaySignalResult): RiskFactor[] {
  const risks: RiskFactor[] = [];

  if (input.rsi > 70) risks.push({ text: `RSI at ${input.rsi.toFixed(1)} is overbought — limited room before a pullback`, severity: "high" });
  if (input.rsi < 40) risks.push({ text: `RSI at ${input.rsi.toFixed(1)} shows no upward momentum`, severity: "high" });
  if (input.vwapStatus === "BELOW") risks.push({ text: "Price is below VWAP — sellers still in control", severity: "high" });
  if (input.riskLevel === "High") risks.push({ text: "Stop-loss sits far from entry — position sizing matters", severity: "medium" });
  if (input.volume < 1_200_000) risks.push({ text: `Volume of ${fmtCompact(input.volume)} is below par for a conviction trade`, severity: "medium" });
  if (!result.multiTimeframe.aligned) {
    risks.push({
      text: result.multiTimeframe.alignment === "CONFLICT"
        ? "3-minute and 15-minute timeframes disagree on direction"
        : "Neither timeframe shows a decisive trend",
      severity: "high",
    });
  }
  const weak = result.timeframes.find((f) => f.strength < 45);
  if (weak) risks.push({ text: `${weak.timeframe === "3m" ? "3-minute" : "15-minute"} momentum is weak (${weak.strength}/100)`, severity: "medium" });
  if (result.riskRewardRatio < 1.5) {
    risks.push({ text: `Risk/reward of 1 : ${result.riskRewardRatio.toFixed(1)} to target 2 is below the 1 : 1.5 threshold`, severity: "medium" });
  }
  if (input.changePercent < 0) risks.push({ text: `Stock is down ${Math.abs(input.changePercent).toFixed(2)}% on the session`, severity: "low" });
  if (risks.length === 0) risks.push({ text: "No material risk flags triggered — normal intraday market risk still applies", severity: "low" });

  return risks;
}

function buildMetrics(input: IntradayAnalysisInput): MetricItem[] {
  return [
    {
      label: "RSI",
      value: input.rsi.toFixed(1),
      badge: input.rsi > 70 ? "Overbought" : input.rsi < 30 ? "Oversold" : "Neutral",
      tone: input.rsi > 70 ? "negative" : input.rsi < 30 ? "positive" : "neutral",
      provenance: "MOCK",
    },
    {
      label: "VWAP",
      value: `${input.vwapStatus.charAt(0)}${input.vwapStatus.slice(1).toLowerCase()} VWAP`,
      badge: null,
      tone: input.vwapStatus === "ABOVE" ? "positive" : input.vwapStatus === "BELOW" ? "negative" : "neutral",
      provenance: "MOCK",
    },
    {
      label: "Volume",
      value: fmtCompact(input.volume),
      badge: input.volume > 3_000_000 ? "Strong" : null,
      tone: input.volume > 1_200_000 ? "positive" : "neutral",
      provenance: input.underlyingIsLive ? "LIVE" : "MOCK",
    },
    {
      label: "Risk Level",
      value: input.riskLevel,
      badge: null,
      tone: input.riskLevel === "Low" ? "positive" : input.riskLevel === "High" ? "negative" : "neutral",
      provenance: "CALCULATED",
    },
    { label: "Sector", value: input.sector, badge: null, tone: "neutral", provenance: "STATIC" },
    {
      label: "Day Change",
      value: `${input.changePercent >= 0 ? "+" : ""}${input.changePercent.toFixed(2)}%`,
      badge: null,
      tone: input.changePercent >= 0 ? "positive" : "negative",
      provenance: input.underlyingIsLive ? "LIVE" : "MOCK",
    },
    {
      label: "Support / Resistance",
      value: `${fmtInr(input.buyBelow)} / ${fmtInr(input.sellAbove)}`,
      badge: null,
      tone: "neutral",
      provenance: "CALCULATED",
    },
  ];
}

export function buildIntradayAnalysis(input: IntradayAnalysisInput): AiAnalysis {
  const result = computeIntradaySignal(input);
  const now = new Date().toISOString();

  return {
    id: input.symbol,
    market: "intraday",
    title: input.symbol,
    subtitle: input.name,
    signal: result.score.signal,
    signalLabel: SIGNAL_LABELS[result.score.signal],
    headline: {
      primaryLabel: "Price",
      primaryValue: fmtInr(input.currentPrice),
      primaryChangePercent: input.changePercent,
      secondaryLabel: "Sector",
      secondaryValue: input.sector,
      secondaryChangePercent: null,
    },
    score: result.score,
    reasons: buildReasons(input, result),
    timeframes: result.timeframes,
    multiTimeframe: result.multiTimeframe,
    tradePlan: result.plan,
    risks: buildRisks(input, result),
    metrics: buildMetrics(input),
    greeks: null,
    optionChain: null,
    provenance: {
      signalGeneratedAt: now,
      dataUpdatedAt: input.updatedAt,
      timeframes: ["3m", "15m"],
      dataSource: input.underlyingIsLive
        ? "Upstox (live quote) + MarketPulse simulator (levels & indicators)"
        : "MarketPulse simulator (no live feed connected)",
      engine: ENGINE,
      engineVersion: ENGINE_VERSION,
      mode: input.underlyingIsLive ? "PARTIAL" : "MOCK",
      fields: [
        { name: "Price & volume", provenance: input.underlyingIsLive ? "LIVE" : "MOCK" },
        { name: "Support / resistance", provenance: "CALCULATED" },
        { name: "RSI / VWAP", provenance: "MOCK" },
        { name: "3m & 15m indicators", provenance: "MOCK" },
        { name: "Signal score", provenance: "CALCULATED" },
        { name: "Trade plan", provenance: "CALCULATED" },
      ],
    },
  };
}
