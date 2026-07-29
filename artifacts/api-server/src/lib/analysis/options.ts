import { seededRandom } from "../nseData.js";
import { alignmentScore, buildTimeframePair, summariseTimeframes } from "./timeframes.js";
import { computeScore, scoreInBand, SIGNAL_LABELS, type CategoryInput } from "./scoring.js";
import type {
  AiAnalysis,
  Direction,
  Greeks,
  MetricItem,
  OptionChainContext,
  Reason,
  RiskFactor,
  SignalScore,
  TradePlan,
} from "./types.js";

/**
 * Options analytics + explanation layer.
 *
 * `computeOptionsSignal` is the decision engine: it turns market/contract
 * inputs into a score and a signal. `buildOptionsAnalysis` is the explanation
 * layer on top — it narrates what the engine already decided and never reaches
 * its own BUY/SELL conclusion (§16).
 */

export interface OptionsAnalysisInput {
  seed: number;
  symbol: string;
  name: string;
  optionType: "CE" | "PE";
  strikePrice: number;
  expiry: string;
  premium: number;
  premiumChangePercent: number;
  underlyingPrice: number;
  underlyingChangePercent: number;
  buyBelow: number;
  sellAbove: number;
  stopLoss: number;
  openInterest: number;
  oiTrend: "Increasing" | "Decreasing" | "Stable";
  volume: number;
  impliedVolatility: number;
  lotSize: number;
  /** True when the underlying price came from a live quote feed. */
  underlyingIsLive: boolean;
  updatedAt: string;
}

const ENGINE = "MarketPulse Options";
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

/** Parse the "30 Jul 26" format produced by the suggestion generator. */
function daysToExpiry(expiry: string): number | null {
  const parsed = Date.parse(expiry.replace(/(\d{2})$/, "20$1"));
  if (Number.isNaN(parsed)) return null;
  const days = Math.ceil((parsed - Date.now()) / 86_400_000);
  return Math.max(days, 0);
}

function moneynessOf(optionType: "CE" | "PE", strike: number, underlying: number) {
  const distPct = ((strike - underlying) / underlying) * 100;
  const itm = optionType === "CE" ? strike < underlying : strike > underlying;
  const label = Math.abs(distPct) < 0.75 ? "ATM" : itm ? "ITM" : "OTM";
  return { label, distPct, absDistPct: Math.abs(distPct) };
}

// ── Decision engine ────────────────────────────────────────────────────────

export interface OptionsSignalResult {
  score: SignalScore;
  timeframes: ReturnType<typeof buildTimeframePair>;
  multiTimeframe: ReturnType<typeof summariseTimeframes>;
  tradeDirection: Direction;
  pcr: number;
  moneyness: ReturnType<typeof moneynessOf>;
  riskRewardRatio: number;
  plan: TradePlan;
  daysLeft: number | null;
}

export function computeOptionsSignal(input: OptionsAnalysisInput): OptionsSignalResult {
  // Buying a call profits from a rising underlying; buying a put, a falling one.
  const tradeDirection: Direction = input.optionType === "CE" ? "BULLISH" : "BEARISH";
  const dirSign = tradeDirection === "BULLISH" ? 1 : -1;

  const timeframes = buildTimeframePair(input.seed, tradeDirection);
  const multiTimeframe = summariseTimeframes(timeframes, tradeDirection);

  const avgDs = timeframes.reduce((s, f) => s + f.directionalScore, 0) / timeframes.length;
  const avgStrength = timeframes.reduce((s, f) => s + f.strength, 0) / timeframes.length;
  const money = moneynessOf(input.optionType, input.strikePrice, input.underlyingPrice);

  // Put/Call ratio. Derived deterministically and leaning with the OI trend —
  // MOCK until a real option-chain feed is connected.
  const pcrBase = 0.72 + seededRandom(input.seed * 61) * 0.86;
  const pcr = round2(
    input.oiTrend === "Increasing"
      ? pcrBase + (input.optionType === "PE" ? 0.22 : -0.16)
      : input.oiTrend === "Decreasing"
        ? pcrBase - (input.optionType === "PE" ? 0.18 : -0.12)
        : pcrBase
  );

  // Trade plan — derived from the same levels the picks table shows.
  const entryLow = round2(Math.min(input.premium * 0.98, input.buyBelow));
  const entryHigh = round2(input.buyBelow);
  const target1 = round2(input.sellAbove);
  const target2 = round2(input.premium + (input.sellAbove - input.premium) * 2);
  const stopLoss = round2(input.stopLoss);
  const riskPerUnit = Math.max(entryHigh - stopLoss, 0.01);
  const rewardPerUnit = Math.max(target2 - entryHigh, 0);
  const riskRewardRatio = parseFloat((rewardPerUnit / riskPerUnit).toFixed(2));
  const riskPct = (riskPerUnit / entryHigh) * 100;

  const plan: TradePlan = {
    currency: "₹",
    entryLow,
    entryHigh,
    target1,
    target2,
    stopLoss,
    riskReward: `1 : ${riskRewardRatio.toFixed(1)}`,
    maxRisk: {
      amount: round2(riskPerUnit * input.lotSize),
      pct: round2(riskPct),
      lots: 1,
      lotSize: input.lotSize,
      note: `1 lot × ${input.lotSize} × ${fmtInr(riskPerUnit)} risk per unit`,
      provenance: "CALCULATED",
    },
  };

  const daysLeft = daysToExpiry(input.expiry);
  const volumeToOi = input.openInterest > 0 ? input.volume / input.openInterest : 0;

  // ── Category scoring. Greeks are omitted entirely rather than guessed,
  // which renormalises the remaining weights (see scoring.ts).
  const categories: CategoryInput[] = [
    {
      key: "underlyingDirection",
      score: 50 + avgDs * dirSign * 46,
      note: `Underlying trend reads ${avgDs >= 0 ? "bullish" : "bearish"} across 3m and 15m; this is a ${input.optionType} position.`,
    },
    {
      key: "momentum",
      score: avgStrength,
      note: `Average trend strength across both timeframes is ${Math.round(avgStrength)}/100.`,
    },
    {
      key: "multiTimeframe",
      score: alignmentScore(multiTimeframe, tradeDirection),
      note: multiTimeframe.alignmentLabel,
    },
    {
      key: "oiChange",
      score: input.oiTrend === "Increasing" ? 86 : input.oiTrend === "Stable" ? 56 : 34,
      note: `Open interest is ${input.oiTrend.toLowerCase()} at ${fmtCompact(input.openInterest)}.`,
    },
    {
      key: "optionVolume",
      score: Math.min(96, 30 + volumeToOi * 190),
      note: `Contract volume is ${fmtCompact(input.volume)} against ${fmtCompact(input.openInterest)} open interest.`,
    },
    {
      key: "impliedVolatility",
      // Option BUYING wants cheap premium, so low IV scores best.
      score: scoreInBand(input.impliedVolatility, [12, 22], 5, 60),
      note: `Implied volatility is ${input.impliedVolatility.toFixed(1)}% — ${
        input.impliedVolatility > 30 ? "premium is expensive" : input.impliedVolatility > 22 ? "premium is slightly rich" : "premium is reasonably priced"
      }.`,
    },
    {
      key: "pcr",
      // PCR above 1 is bearish positioning, which supports a put and works
      // against a call. The note states that relationship rather than the raw
      // reading, so the sentence can never contradict the score beside it.
      score: input.optionType === "PE" ? scoreInBand(pcr, [1.1, 1.8], 0.4, 1.4) : scoreInBand(pcr, [0.5, 0.95], 0.3, 1.3),
      note: `Put/Call ratio of ${pcr.toFixed(2)} is ${pcr > 1 ? "bearish" : "bullish"} positioning, which ${
        (pcr > 1) === (input.optionType === "PE") ? "supports" : "works against"
      } this ${input.optionType}.`,
    },
    {
      key: "strikeSelection",
      score: scoreInBand(money.absDistPct, [0, 1.5], 0, 8),
      note: `Strike is ${money.label}${money.absDistPct >= 0.75 ? ` (${money.absDistPct.toFixed(1)}% from spot)` : ""}.`,
    },
    {
      key: "liquidity",
      score: input.openInterest > 2_000_000 ? 92 : input.openInterest > 1_000_000 ? 78 : input.openInterest > 400_000 ? 58 : 32,
      note: `Open interest of ${fmtCompact(input.openInterest)} implies ${
        input.openInterest > 1_000_000 ? "high" : input.openInterest > 400_000 ? "moderate" : "thin"
      } liquidity.`,
    },
    {
      key: "riskReward",
      score: scoreInBand(riskRewardRatio, [1.8, 4], 0, 6),
      note: `Risk/reward to target 2 is 1 : ${riskRewardRatio.toFixed(1)}.`,
    },
  ];

  const score = computeScore("options", categories, multiTimeframe.confidenceBoost);

  return { score, timeframes, multiTimeframe, tradeDirection, pcr, moneyness: money, riskRewardRatio, plan, daysLeft };
}

// ── Explanation layer ──────────────────────────────────────────────────────

/** Turn high-scoring categories into supporting statements. Evidence only. */
function buildReasons(input: OptionsAnalysisInput, result: OptionsSignalResult): Reason[] {
  const { score, multiTimeframe, timeframes, moneyness } = result;
  const byKey = new Map(score.categories.map((c) => [c.key, c]));
  const reasons: Reason[] = [];
  const dirWord = result.tradeDirection === "BULLISH" ? "bullish" : "bearish";

  const dir = byKey.get("underlyingDirection");
  if (dir && dir.score >= 58) {
    reasons.push({ text: `Underlying showing ${dirWord} momentum`, source: dir.label });
  }
  const oi = byKey.get("oiChange");
  if (oi && oi.score >= 55) {
    reasons.push({
      text: `${input.optionType === "PE" ? "Put" : "Call"} OI ${input.oiTrend.toLowerCase()} at this strike`,
      source: oi.label,
    });
  }
  const vol = byKey.get("optionVolume");
  if (vol && vol.score >= 55) {
    reasons.push({ text: "Strong volume in the selected strike", source: vol.label });
  }
  // Threshold matches buildRisks' "slightly rich" cut-off exactly, so IV can
  // never be praised here and flagged as a risk in the same breath.
  const iv = byKey.get("impliedVolatility");
  if (iv && input.impliedVolatility <= 22) {
    reasons.push({ text: `IV at ${input.impliedVolatility.toFixed(1)}% keeps premium affordable`, source: iv.label });
  }
  for (const frame of timeframes) {
    if (frame.direction === result.tradeDirection) {
      const vwap = frame.indicators.find((i) => i.label === "Price vs VWAP");
      reasons.push({
        text: `${frame.timeframe === "3m" ? "3-minute" : "15-minute"} ${dirWord} trend confirmed${vwap ? ` (${vwap.value.toLowerCase()})` : ""}`,
        source: frame.label,
      });
    }
  }
  if (multiTimeframe.aligned && multiTimeframe.alignment === result.tradeDirection) {
    reasons.push({ text: "Both timeframes agree on direction", source: "Multi-Timeframe Alignment" });
  }
  const strike = byKey.get("strikeSelection");
  if (strike && strike.score >= 65) {
    reasons.push({ text: `${moneyness.label} strike selected for best delta exposure`, source: strike.label });
  }
  const rr = byKey.get("riskReward");
  if (rr && rr.score >= 60) {
    reasons.push({ text: `Favourable risk/reward at 1 : ${result.riskRewardRatio.toFixed(1)}`, source: rr.label });
  }
  const liq = byKey.get("liquidity");
  if (liq && liq.score >= 75) {
    reasons.push({ text: "Contract is liquid enough for clean entry and exit", source: liq.label });
  }

  if (reasons.length === 0) {
    reasons.push({
      text: "No category scored strongly enough to support this trade",
      source: "Signal Scoring Engine",
    });
  }
  return reasons;
}

/** Evidence AGAINST the trade (§13). Also evidence-derived, never boilerplate. */
function buildRisks(input: OptionsAnalysisInput, result: OptionsSignalResult): RiskFactor[] {
  const { multiTimeframe, timeframes, moneyness, daysLeft, riskRewardRatio } = result;
  const risks: RiskFactor[] = [];

  if (daysLeft !== null && daysLeft <= 2) {
    risks.push({ text: `Expiry only ${daysLeft === 0 ? "today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} away`}`, severity: "high" });
  } else if (daysLeft !== null && daysLeft <= 5) {
    risks.push({ text: `Expiry in ${daysLeft} days — theta decay elevated`, severity: "medium" });
  }
  if (daysLeft !== null && daysLeft <= 7) {
    risks.push({ text: "Time decay accelerates into expiry week", severity: "medium" });
  }
  if (input.impliedVolatility > 30) {
    risks.push({ text: `IV is high at ${input.impliedVolatility.toFixed(1)}% — premium can erode even on a correct call`, severity: "high" });
  } else if (input.impliedVolatility > 22) {
    risks.push({ text: `IV at ${input.impliedVolatility.toFixed(1)}% makes the premium slightly rich`, severity: "low" });
  }
  if (input.oiTrend === "Decreasing") {
    risks.push({ text: "Open interest is falling — existing positions are unwinding", severity: "medium" });
  }
  if (!multiTimeframe.aligned) {
    risks.push({
      text: multiTimeframe.alignment === "CONFLICT"
        ? "3-minute and 15-minute timeframes disagree on direction"
        : "Neither timeframe shows a decisive trend",
      severity: "high",
    });
  }
  const weak = timeframes.find((f) => f.strength < 45);
  if (weak) {
    risks.push({ text: `${weak.timeframe === "3m" ? "3-minute" : "15-minute"} momentum is weak (${weak.strength}/100)`, severity: "medium" });
  }
  if (moneyness.label === "OTM" && moneyness.absDistPct > 2) {
    risks.push({ text: `Strike is ${moneyness.absDistPct.toFixed(1)}% out of the money — needs a decisive move to pay off`, severity: "medium" });
  }
  if (input.openInterest < 400_000) {
    risks.push({ text: `Open interest of ${fmtCompact(input.openInterest)} is thin — expect wider spreads`, severity: "medium" });
  }
  if (riskRewardRatio < 1.5) {
    risks.push({ text: `Risk/reward of 1 : ${riskRewardRatio.toFixed(1)} to target 2 is below the 1 : 1.5 threshold`, severity: "medium" });
  }
  risks.push({ text: "Greeks (delta, gamma, theta, vega) unavailable from the current data source", severity: "low" });

  return risks;
}

function buildGreeks(): Greeks {
  // No Greeks feed is connected. Fabricating them would be worse than an
  // honest gap, so every value is explicitly null (§12).
  return {
    available: false,
    note: "Greeks require an option-chain feed that is not yet connected. Values are intentionally left blank rather than estimated.",
    values: [
      { label: "Delta", value: null, available: false },
      { label: "Gamma", value: null, available: false },
      { label: "Theta", value: null, available: false },
      { label: "Vega", value: null, available: false },
    ],
  };
}

function buildOptionChain(input: OptionsAnalysisInput, result: OptionsSignalResult): OptionChainContext {
  const { pcr, moneyness } = result;
  const putOi = Math.round(input.openInterest * (pcr / (1 + pcr)) * 2);
  const callOi = Math.round(putOi / Math.max(pcr, 0.01));
  const tick = input.strikePrice >= 2000 ? 100 : input.strikePrice >= 500 ? 50 : 5;
  const maxPain = Math.round(input.underlyingPrice / tick) * tick;

  const nearbyStrikes = [-1, 0, 1].map((offset) => {
    const strike = input.strikePrice + offset * tick;
    const decay = 1 - Math.abs(offset) * 0.28;
    return {
      strike,
      callOi: Math.round(callOi * decay),
      putOi: Math.round(putOi * decay),
    };
  });

  return {
    available: true,
    note: "Chain context is derived from the contract's own OI and a modelled PCR, not from a live option chain.",
    pcr,
    callOi,
    putOi,
    oiBuildup: `${input.oiTrend} ${input.optionType} OI`,
    maxPain,
    moneyness: moneyness.label,
    nearbyStrikes,
  };
}

function buildMetrics(input: OptionsAnalysisInput, result: OptionsSignalResult): MetricItem[] {
  const { daysLeft, pcr } = result;
  const ivHigh = input.impliedVolatility > 30;
  const oiStrong = input.openInterest > 1_000_000;

  return [
    {
      label: "Expiry",
      value: daysLeft === null ? input.expiry : `${input.expiry} (${daysLeft} day${daysLeft === 1 ? "" : "s"})`,
      badge: daysLeft !== null && daysLeft <= 2 ? "Near" : null,
      tone: daysLeft !== null && daysLeft <= 2 ? "negative" : "neutral",
      provenance: "CALCULATED",
    },
    { label: "Lot Size", value: String(input.lotSize), badge: null, tone: "neutral", provenance: "STATIC" },
    {
      label: "IV",
      value: `${input.impliedVolatility.toFixed(1)}%`,
      badge: ivHigh ? "High" : input.impliedVolatility > 22 ? "Elevated" : "Normal",
      tone: ivHigh ? "negative" : "positive",
      provenance: "MOCK",
    },
    {
      label: "OI",
      value: fmtCompact(input.openInterest),
      badge: oiStrong ? "Strong" : null,
      tone: oiStrong ? "positive" : "neutral",
      provenance: "MOCK",
    },
    {
      label: "OI Trend",
      value: input.oiTrend,
      badge: null,
      tone: input.oiTrend === "Increasing" ? "positive" : input.oiTrend === "Decreasing" ? "negative" : "neutral",
      provenance: "MOCK",
    },
    {
      label: "PCR",
      value: pcr.toFixed(2),
      badge: pcr > 1 ? "Bearish" : "Bullish",
      tone: (pcr > 1) === (input.optionType === "PE") ? "positive" : "negative",
      provenance: "MOCK",
    },
    {
      label: "Liquidity",
      value: input.openInterest > 1_000_000 ? "High" : input.openInterest > 400_000 ? "Moderate" : "Thin",
      badge: null,
      tone: input.openInterest > 1_000_000 ? "positive" : input.openInterest > 400_000 ? "neutral" : "negative",
      provenance: "CALCULATED",
    },
  ];
}

export function optionAnalysisId(symbol: string, optionType: string, strike: number) {
  return `${symbol}-${optionType}-${strike}`;
}

export function buildOptionsAnalysis(input: OptionsAnalysisInput): AiAnalysis {
  const result = computeOptionsSignal(input);
  const now = new Date().toISOString();

  return {
    id: optionAnalysisId(input.symbol, input.optionType, input.strikePrice),
    market: "options",
    title: `${input.symbol} ${input.strikePrice} ${input.optionType}`,
    subtitle: input.name,
    signal: result.score.signal,
    signalLabel: SIGNAL_LABELS[result.score.signal],
    headline: {
      primaryLabel: "Premium",
      primaryValue: fmtInr(input.premium),
      primaryChangePercent: input.premiumChangePercent,
      secondaryLabel: "Underlying",
      secondaryValue: fmtInr(input.underlyingPrice),
      secondaryChangePercent: input.underlyingChangePercent,
    },
    score: result.score,
    reasons: buildReasons(input, result),
    timeframes: result.timeframes,
    multiTimeframe: result.multiTimeframe,
    tradePlan: result.plan,
    risks: buildRisks(input, result),
    metrics: buildMetrics(input, result),
    greeks: buildGreeks(),
    optionChain: buildOptionChain(input, result),
    provenance: {
      signalGeneratedAt: now,
      dataUpdatedAt: input.updatedAt,
      timeframes: ["3m", "15m"],
      dataSource: input.underlyingIsLive
        ? "Upstox (underlying quote) + MarketPulse simulator (contract data)"
        : "MarketPulse simulator (no live feed connected)",
      engine: ENGINE,
      engineVersion: ENGINE_VERSION,
      mode: input.underlyingIsLive ? "PARTIAL" : "MOCK",
      fields: [
        { name: "Underlying price", provenance: input.underlyingIsLive ? "LIVE" : "MOCK" },
        { name: "Strike / expiry", provenance: "CALCULATED" },
        { name: "Premium & levels", provenance: "MOCK" },
        { name: "IV / OI / volume", provenance: "MOCK" },
        { name: "3m & 15m indicators", provenance: "MOCK" },
        { name: "Signal score", provenance: "CALCULATED" },
        { name: "Trade plan", provenance: "CALCULATED" },
        { name: "Greeks", provenance: "UNAVAILABLE" },
      ],
    },
  };
}
