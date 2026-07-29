/**
 * Wire shapes for the Holding Stocks module.
 *
 * Deliberately reuses the shared explainability primitives from
 * analysis/types.ts (SignalScore, Reason, RiskFactor, MetricItem, Provenance,
 * DataProvenance) so the Holding panel renders with the same components as the
 * Options and Intraday AI Decision Breakdown (§12).
 */

import type {
  DataProvenance,
  MetricItem,
  Provenance,
  Reason,
  RiskFactor,
  SignalScore,
} from "../analysis/types.js";
import type { HoldingClassification, RiskLevel } from "./score.js";
import type { UniverseId } from "./universe.js";

export type { HoldingClassification, RiskLevel, UniverseId };

export type MarketBias = "Bullish" | "Neutral" | "Bearish";

export type CatalystImpactLabel = "Positive" | "Neutral" | "Negative";

/** One row of the Top Picks table. */
export interface HoldingPick {
  rank: number;
  symbol: string;
  /** Exchange ticker spelling, e.g. BAJAJ-AUTO for the internal key BAJAJ_AUTO. */
  displaySymbol: string;
  name: string;
  sector: string;
  currentPrice: number;
  changePercent: number;
  return1w: number | null;
  return1m: number | null;
  return3m: number | null;
  distanceFrom52wHighPct: number | null;
  /** e.g. "Strong Uptrend", "Uptrend", "Sideways". */
  trendLabel: string;
  /** Headline catalyst, or an explicit "no catalyst" string. */
  catalystLabel: string;
  catalystImpact: CatalystImpactLabel;
  score: number;
  classification: HoldingClassification;
  classificationLabel: string;
  riskLevel: RiskLevel;
  /** True when this symbol was not in the previous stored scan. */
  isNew: boolean;
  /** Whether the price behind this row is live or a simulated fallback. */
  priceProvenance: Provenance;
}

export interface HoldingScanSummary {
  /** Every shortlisted stock that cleared the quality bar. May exceed `published`. */
  qualifiedCount: number;
  /** How many of those are actually listed in `picks`. */
  published: number;
  strongSetups: number;
  newThisScan: number;
  marketBias: MarketBias;
  marketBiasNote: string;
  lastScanAt: string;
  /** Next post-close scan, ISO. Null when the schedule cannot be determined. */
  nextScanAt: string | null;
  universeRequested: UniverseId;
  universeResolved: UniverseId;
  /** Set when the requested universe was unavailable. */
  universeNote: string | null;
  /** Symbols in the resolved universe. */
  screened: number;
  /** Symbols that produced a usable technical snapshot. */
  analysed: number;
  /** Symbols dropped by the liquidity floor. */
  rejectedIlliquid: number;
  /** Symbols that reached the deep fundamentals / catalysts pass. */
  shortlisted: number;
  /** Shortlisted symbols that scored below the qualification threshold. */
  belowThreshold: number;
  qualificationThreshold: number;
}

export interface UniverseOption {
  id: UniverseId;
  label: string;
  available: boolean;
  size: number | null;
  note: string;
}

export interface HoldingScan {
  summary: HoldingScanSummary;
  picks: HoldingPick[];
  universes: UniverseOption[];
  /** Sectors present in the qualified picks, for the sector filter. */
  sectors: string[];
  provenance: DataProvenance;
}

// ── Detailed analysis ───────────────────────────────────────────────────────

export interface HoldingAnalysisHeader {
  currentPrice: number;
  return1m: number | null;
  return3m: number | null;
  distanceFrom52wHighPct: number | null;
  riskLevel: RiskLevel;
  lastScanAt: string;
}

export interface CatalystEntry {
  title: string;
  date: string | null;
  source: string;
  impact: CatalystImpactLabel;
  kind: string;
  url: string | null;
}

export interface CatalystBlock {
  available: boolean;
  note: string;
  items: CatalystEntry[];
}

export interface FundamentalsBlock {
  available: boolean;
  note: string;
  items: MetricItem[];
}

export interface HoldingOutlook {
  trend: "Strong" | "Positive" | "Neutral" | "Weak";
  momentum: "Strong" | "Moderate" | "Weak";
  catalyst: CatalystImpactLabel;
  risk: RiskLevel;
  overall: string;
  note: string;
}

export interface HoldingAnalysis {
  /** Stable id for cache keys — the NSE symbol. */
  id: string;
  symbol: string;
  displaySymbol: string;
  name: string;
  sector: string;
  classification: HoldingClassification;
  classificationLabel: string;
  header: HoldingAnalysisHeader;
  score: SignalScore;
  reasons: Reason[];
  technical: MetricItem[];
  momentum: MetricItem[];
  fundamentals: FundamentalsBlock;
  catalysts: CatalystBlock;
  risks: RiskFactor[];
  outlook: HoldingOutlook;
  priceLevels: MetricItem[];
  provenance: DataProvenance;
}

// ── Historical tracking ─────────────────────────────────────────────────────

export interface PreviousPick {
  symbol: string;
  name: string;
  scanDate: string;
  scanPrice: number;
  score: number;
  classification: HoldingClassification;
  classificationLabel: string;
  riskLevel: RiskLevel;
  currentPrice: number | null;
  /** Return from scan price to current price, percent. */
  returnPct: number | null;
  /** Forward returns — null until the window has actually elapsed (§22). */
  return1m: number | null;
  return2m: number | null;
  return3m: number | null;
  maxGainPct: number | null;
  maxDrawdownPct: number | null;
  status: string;
}

export interface PreviousPicksResponse {
  available: boolean;
  /** Why the list is empty, when it is. */
  note: string;
  picks: PreviousPick[];
}
