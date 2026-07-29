import type { ScoreCategory, Signal, SignalScore } from "./types.js";

/**
 * Signal scoring engine.
 *
 * All scoring rules live here and in the CATEGORY_WEIGHTS table below — never
 * in a UI component and never inline in a data provider (§15). Callers supply
 * a 0-100 score plus a justification per category; this module owns weighting,
 * normalisation, banding and the score -> signal mapping.
 *
 * The result is a SIGNAL STRENGTH score. It is deliberately not presented as a
 * probability of profit anywhere in the product (§6).
 */

export type Market = "options" | "intraday" | "commodities" | "holding";

/**
 * Relative weights per market. A category may be omitted by the caller (e.g.
 * Greeks when no feed provides them) and the remaining weights are renormalised
 * — an unavailable input never silently scores zero.
 */
export const CATEGORY_WEIGHTS: Record<Market, Record<string, { label: string; weight: number }>> = {
  options: {
    underlyingDirection: { label: "Underlying Direction", weight: 16 },
    momentum: { label: "Momentum", weight: 10 },
    multiTimeframe: { label: "Multi-Timeframe Alignment", weight: 16 },
    oiChange: { label: "OI / Change in OI", weight: 12 },
    optionVolume: { label: "Option Volume", weight: 8 },
    impliedVolatility: { label: "Implied Volatility", weight: 8 },
    greeks: { label: "Greeks", weight: 6 },
    pcr: { label: "Put/Call Ratio", weight: 6 },
    strikeSelection: { label: "Strike Selection", weight: 8 },
    liquidity: { label: "Liquidity", weight: 6 },
    riskReward: { label: "Risk / Reward", weight: 10 },
  },
  intraday: {
    trendDirection: { label: "Trend Direction", weight: 18 },
    momentum: { label: "Momentum", weight: 14 },
    multiTimeframe: { label: "Multi-Timeframe Alignment", weight: 18 },
    volume: { label: "Volume", weight: 12 },
    rsiPosition: { label: "RSI Position", weight: 10 },
    vwapPosition: { label: "VWAP Position", weight: 10 },
    volatility: { label: "Volatility", weight: 8 },
    riskReward: { label: "Risk / Reward", weight: 10 },
  },
  /**
   * Positional 1-3 month holding. Weights sum to 100 and map 1:1 onto the five
   * published categories, so the number a user sees per category is the number
   * the engine used. `computeScore` renormalises if a category has to be
   * dropped (e.g. no fundamental feed for a symbol) rather than scoring it 0.
   */
  holding: {
    trendMomentum: { label: "Trend & Momentum", weight: 30 },
    breakoutStrength: { label: "Breakout / 52-Week Strength", weight: 20 },
    participation: { label: "Participation", weight: 15 },
    fundamentalsCatalysts: { label: "Fundamentals & Catalysts", weight: 20 },
    risk: { label: "Risk", weight: 15 },
  },
  commodities: {
    trendDirection: { label: "Trend Direction", weight: 20 },
    momentum: { label: "Momentum", weight: 16 },
    multiTimeframe: { label: "Multi-Timeframe Alignment", weight: 18 },
    buyPressure: { label: "Buy Pressure", weight: 16 },
    rangePosition: { label: "20-Day Range Position", weight: 12 },
    volatility: { label: "Volatility", weight: 8 },
    riskReward: { label: "Risk / Reward", weight: 10 },
  },
};

export interface CategoryInput {
  key: string;
  /** 0-100. */
  score: number;
  note: string;
}

/** No pick is ever shown as a certainty or a total impossibility. */
const SCORE_CEILING = 97;
const SCORE_FLOOR = 3;

const BANDS: { min: number; band: string; signal: Signal }[] = [
  { min: 85, band: "Very High Conviction", signal: "STRONG_BUY" },
  { min: 70, band: "High Conviction", signal: "BUY" },
  { min: 52, band: "Moderate Conviction", signal: "WATCH" },
  { min: 38, band: "Low Conviction", signal: "SELL" },
  { min: 0, band: "Very Low Conviction", signal: "STRONG_SELL" },
];

function clamp100(n: number) {
  return Math.min(100, Math.max(0, n));
}

/**
 * Weighted-average the supplied categories, then apply the multi-timeframe
 * adjustment on top. `alignmentBoost` is already signed by the timeframe
 * engine, so a conflict subtracts here rather than adding a smaller bonus.
 */
export function computeScore(
  market: Market,
  inputs: CategoryInput[],
  alignmentBoost = 0
): SignalScore {
  const weights = CATEGORY_WEIGHTS[market];
  const known = inputs.filter((i) => weights[i.key]);
  const totalWeight = known.reduce((sum, i) => sum + weights[i.key].weight, 0) || 1;

  const categories: ScoreCategory[] = known.map((i) => {
    const meta = weights[i.key];
    const score = clamp100(i.score);
    return {
      key: i.key,
      label: meta.label,
      weight: meta.weight,
      score: Math.round(score),
      contribution: parseFloat(((score * meta.weight) / totalWeight / 100 * 100).toFixed(2)),
      note: i.note,
    };
  });

  const weighted = categories.reduce((sum, c) => sum + (c.score * c.weight) / totalWeight, 0);
  // Bounded away from 0 and 100 on purpose: a signal engine should never
  // present absolute certainty (or absolute impossibility) in either direction.
  const score = Math.round(Math.min(SCORE_CEILING, Math.max(SCORE_FLOOR, weighted + alignmentBoost)));
  const band = BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1];

  return { score, band: band.band, signal: band.signal, categories };
}

export const SIGNAL_LABELS: Record<Signal, string> = {
  STRONG_BUY: "STRONG BUY",
  BUY: "BUY",
  WATCH: "WATCH",
  SELL: "SELL",
  STRONG_SELL: "STRONG SELL",
};

/** Score a value against an ideal band — used by several category scorers. */
export function scoreInBand(value: number, ideal: [number, number], hardMin: number, hardMax: number): number {
  const [lo, hi] = ideal;
  if (value >= lo && value <= hi) return 90;
  if (value < lo) {
    const span = lo - hardMin || 1;
    return clamp100(90 - ((lo - value) / span) * 70);
  }
  const span = hardMax - hi || 1;
  return clamp100(90 - ((value - hi) / span) * 70);
}
