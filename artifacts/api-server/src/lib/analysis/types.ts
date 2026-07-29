/**
 * Shared contract for the MarketPulse AI Decision Breakdown.
 *
 * One shape is used by every market (options, intraday, commodities) so the UI
 * components are written once. Market-specific extras live in optional blocks
 * (`greeks`, `optionChain`) rather than in parallel types.
 *
 * Pipeline (see ./scoring.ts and ./timeframes.ts):
 *   market data -> indicator engine -> analytics -> scoring -> risk -> signal
 *   -> explanation layer -> this payload -> UI
 *
 * The explanation layer only ever narrates evidence that the engine computed.
 * It never decides direction and never invents an indicator reading.
 */

export type Direction = "BULLISH" | "BEARISH" | "NEUTRAL";

export type Signal = "STRONG_BUY" | "BUY" | "WATCH" | "SELL" | "STRONG_SELL";

/**
 * Where a displayed number actually came from. Surfaced in the UI so a mock
 * value can never be mistaken for a production recommendation (§18).
 */
export type Provenance =
  | "LIVE"
  | "API"
  | "CALCULATED"
  | "MOCK"
  | "STATIC"
  | "GENERATED"
  | "UNAVAILABLE";

/** Whether a reading helps or hurts the trade being analysed. */
export type Tone = "positive" | "negative" | "neutral";

export interface TimeframeIndicator {
  label: string;
  /** Preformatted for display — the server owns rounding so UI stays dumb. */
  value: string;
  tone: Tone;
  /**
   * Text marker shown alongside the colour so the card is readable without
   * relying on red/green alone (§8).
   */
  marker: string;
  provenance: Provenance;
}

export interface TimeframeTrend {
  /** Machine id, e.g. "3m". */
  timeframe: string;
  /** Card heading, e.g. "3 MIN TREND". */
  label: string;
  /** Sub-heading, e.g. "Short-term momentum". */
  caption: string;
  direction: Direction;
  /** 0-100. How decisive this timeframe is, regardless of direction. */
  strength: number;
  /**
   * Signed conviction in [-1, 1]. Positive = bullish underlying. Every
   * indicator below is derived from this, so the card is internally consistent.
   */
  directionalScore: number;
  indicators: TimeframeIndicator[];
  /** Normalised 0-1 series for the mini trend line. */
  sparkline: number[];
}

export interface MultiTimeframeSummary {
  aligned: boolean;
  /** Headline verdict, e.g. "BEARISH — CONFIRMED" or "TIMEFRAME CONFLICT". */
  alignmentLabel: string;
  alignment: Direction | "CONFLICT";
  alignmentStrength: "Strong" | "Moderate" | "Weak";
  /**
   * Points the alignment added to (or removed from) the score. Negative when
   * the timeframes disagree — conflict never inflates conviction (§10).
   */
  confidenceBoost: number;
  probability: "High" | "Medium" | "Low";
  /** Set only on conflict, e.g. "WAIT / LOWER CONVICTION". */
  verdict: string | null;
  explanation: string;
  rows: { label: string; direction: Direction }[];
}

export interface ScoreCategory {
  key: string;
  label: string;
  /** Relative weight before normalisation. */
  weight: number;
  /** 0-100 for this category alone. */
  score: number;
  /** Points this category contributed to the final score. */
  contribution: number;
  /** Plain-language justification for the category score. */
  note: string;
}

export interface SignalScore {
  /** 0-100 signal strength. Explicitly NOT a probability of profit (§6). */
  score: number;
  band: string;
  signal: Signal;
  categories: ScoreCategory[];
}

export interface Reason {
  text: string;
  /** Score category this reason was derived from — keeps narration honest. */
  source: string;
}

export interface RiskFactor {
  text: string;
  severity: "high" | "medium" | "low";
}

export interface MaxRisk {
  amount: number | null;
  pct: number | null;
  lots: number | null;
  lotSize: number | null;
  note: string;
  provenance: Provenance;
}

export interface TradePlan {
  currency: string;
  entryLow: number;
  entryHigh: number;
  target1: number;
  target2: number;
  stopLoss: number;
  riskReward: string;
  maxRisk: MaxRisk;
}

export interface MetricItem {
  label: string;
  value: string;
  badge: string | null;
  tone: Tone;
  provenance: Provenance;
}

export interface GreekValue {
  label: string;
  value: string | null;
  available: boolean;
}

export interface Greeks {
  available: boolean;
  /** Shown when unavailable — we never fabricate Greeks (§12). */
  note: string;
  values: GreekValue[];
}

export interface OptionChainContext {
  available: boolean;
  note: string;
  pcr: number | null;
  callOi: number | null;
  putOi: number | null;
  oiBuildup: string | null;
  maxPain: number | null;
  moneyness: string | null;
  nearbyStrikes: { strike: number; callOi: number; putOi: number }[];
}

export interface DataProvenance {
  signalGeneratedAt: string;
  dataUpdatedAt: string;
  timeframes: string[];
  dataSource: string;
  engine: string;
  engineVersion: string;
  /** MOCK when any scored input is synthetic. Drives the UI banner. */
  mode: "MOCK" | "PARTIAL" | "LIVE";
  fields: { name: string; provenance: Provenance }[];
}

export interface AnalysisHeadline {
  primaryLabel: string;
  primaryValue: string;
  primaryChangePercent: number | null;
  secondaryLabel: string | null;
  secondaryValue: string | null;
  secondaryChangePercent: number | null;
}

export interface AiAnalysis {
  /** Stable id the client uses for cache keys and expansion state. */
  id: string;
  market: "options" | "intraday" | "commodities";
  title: string;
  subtitle: string;
  signal: Signal;
  signalLabel: string;
  headline: AnalysisHeadline;
  score: SignalScore;
  reasons: Reason[];
  timeframes: TimeframeTrend[];
  multiTimeframe: MultiTimeframeSummary;
  tradePlan: TradePlan;
  risks: RiskFactor[];
  metrics: MetricItem[];
  greeks: Greeks | null;
  optionChain: OptionChainContext | null;
  provenance: DataProvenance;
}
