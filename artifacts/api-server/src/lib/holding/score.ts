/**
 * MarketPulse Holding Score.
 *
 * A 0-100 SIGNAL QUALITY score for a 1-3 month positional opportunity. It is
 * explicitly not a probability of profit and not a return forecast (§9).
 *
 * Weighting, normalisation and banding are delegated to the shared scoring
 * engine (analysis/scoring.ts) so this module owns only the domain rules: how a
 * given indicator reading converts into a 0-100 category score, and the
 * evidence sentence that justifies it. Every scorer here reads real computed
 * inputs; a category with no data is omitted so the remaining weights
 * renormalise rather than the stock being silently penalised.
 */

import { computeScore, scoreInBand, type CategoryInput } from "../analysis/scoring.js";
import type { SignalScore } from "../analysis/types.js";
import type { CatalystItem, FundamentalSnapshot } from "./providers.js";
import type { TechnicalSnapshot } from "./indicators.js";

export type HoldingClassification = "STRONG_SETUP" | "GOOD_SETUP" | "WATCH" | "AVOID";

export interface ClassificationMeta {
  id: HoldingClassification;
  label: string;
  /** Inclusive lower bound of the band. */
  min: number;
}

/**
 * Configurable score thresholds (§11).
 *
 * Deliberately not "BUY" labels: this module ranks research opportunities, it
 * does not issue trade instructions.
 */
export const CLASSIFICATION_BANDS: ClassificationMeta[] = [
  { id: "STRONG_SETUP", label: "Strong Setup", min: 78 },
  { id: "GOOD_SETUP", label: "Good Setup", min: 65 },
  { id: "WATCH", label: "Watch", min: 52 },
  { id: "AVOID", label: "Avoid / Weak", min: 0 },
];

/** A stock below this never enters the Top Picks list, even if the list is short (§8). */
export const QUALIFICATION_THRESHOLD = 65;

export function classify(score: number): ClassificationMeta {
  return CLASSIFICATION_BANDS.find((b) => score >= b.min) ?? CLASSIFICATION_BANDS[CLASSIFICATION_BANDS.length - 1];
}

export type RiskLevel = "Low" | "Medium" | "High";

export interface ScoreInputs {
  tech: TechnicalSnapshot;
  /** Stock 1M return minus NIFTY 1M return, percentage points. */
  relativeStrength1m: number | null;
  relativeStrength3m: number | null;
  /** Sector index 1M change percent, when the sector feed carries it. */
  sectorChangePct: number | null;
  fundamentals: FundamentalSnapshot;
  catalysts: CatalystItem[];
  /** ISO date of the next scheduled earnings, when known. */
  nextEarningsDate: string | null;
  /** Broad-market 1M return, used for the market-weakness risk check. */
  benchmarkReturn1m: number | null;
}

function clamp(n: number, lo = 0, hi = 100) {
  return Math.min(hi, Math.max(lo, n));
}

function fmtPct(n: number, dp = 1) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(dp)}%`;
}

// ── Category 1 — Trend & Momentum (30) ──────────────────────────────────────

function scoreTrendMomentum(i: ScoreInputs): CategoryInput | null {
  const { tech } = i;
  const parts: number[] = [];
  const notes: string[] = [];

  // Moving-average structure: position plus alignment.
  const maChecks = [tech.aboveDma20, tech.aboveDma50, tech.aboveDma200].filter((v) => v != null);
  if (maChecks.length) {
    const above = maChecks.filter(Boolean).length;
    const maScore = (above / maChecks.length) * 100;
    parts.push(tech.maAligned ? Math.min(100, maScore + 10) : maScore);
    notes.push(
      tech.maAligned
        ? "price above a rising 20/50/200 DMA stack"
        : `above ${above} of ${maChecks.length} key moving averages`
    );
  }

  // RSI: a positional sweet spot is firm but not overheated.
  if (tech.rsi14 != null) {
    parts.push(scoreInBand(tech.rsi14, [55, 68], 30, 85));
    notes.push(`RSI ${tech.rsi14.toFixed(0)}`);
  }

  // MACD: histogram above zero with MACD over signal.
  if (tech.macd) {
    const { macd, signal, histogram } = tech.macd;
    parts.push(macd > signal ? (histogram > 0 ? 85 : 70) : histogram > 0 ? 50 : 30);
    notes.push(macd > signal ? "MACD above signal" : "MACD below signal");
  }

  // Momentum across the three windows the module is built around.
  const windows: [number | null, string][] = [
    [tech.return1w, "1W"],
    [tech.return1m, "1M"],
    [tech.return3m, "3M"],
  ];
  for (const [ret, label] of windows) {
    if (ret == null) continue;
    // +15% over the window is a full score; flat is 50; negative scores down.
    parts.push(clamp(50 + (ret / 15) * 50));
    notes.push(`${label} ${fmtPct(ret)}`);
  }

  // Relative strength vs NIFTY — outperformance is what makes a positional
  // candidate worth the opportunity cost of holding it.
  if (i.relativeStrength1m != null) {
    parts.push(clamp(50 + (i.relativeStrength1m / 10) * 50));
    notes.push(`${fmtPct(i.relativeStrength1m)} vs NIFTY (1M)`);
  }
  if (i.relativeStrength3m != null) {
    parts.push(clamp(50 + (i.relativeStrength3m / 20) * 50));
  }

  // Sector relative strength, when the sector feed provides it.
  if (i.sectorChangePct != null) {
    parts.push(clamp(50 + (i.sectorChangePct / 6) * 50));
    notes.push(`sector ${fmtPct(i.sectorChangePct)}`);
  }

  if (!parts.length) return null;
  return {
    key: "trendMomentum",
    score: parts.reduce((a, b) => a + b, 0) / parts.length,
    note: notes.join(", ") + ".",
  };
}

// ── Category 2 — Breakout / 52-Week Strength (20) ───────────────────────────

function scoreBreakout(i: ScoreInputs): CategoryInput | null {
  const { tech } = i;
  const parts: number[] = [];
  const notes: string[] = [];

  if (tech.distanceFrom52wHighPct != null) {
    const d = tech.distanceFrom52wHighPct;
    // Proximity to the 52-week high is constructive — but a stock pinned
    // exactly at the high with nothing behind it is extension, not strength,
    // so the ideal band starts just below rather than at zero (§9).
    parts.push(scoreInBand(d, [1, 8], 0, 40));
    notes.push(`${d.toFixed(1)}% below the 52-week high`);
  }

  if (tech.isNew52wHigh) {
    // A new high only counts when volume confirms it.
    parts.push(tech.breakoutVolumeRatio != null && tech.breakoutVolumeRatio >= 1.3 ? 90 : 60);
    notes.push("at a new 52-week high");
  }

  if (tech.brokeResistance) {
    const confirmed = tech.breakoutVolumeRatio != null && tech.breakoutVolumeRatio >= 1.5;
    parts.push(confirmed ? 92 : 68);
    notes.push(
      confirmed
        ? `broke prior resistance on ${tech.breakoutVolumeRatio!.toFixed(1)}x volume`
        : "broke prior resistance, volume not yet confirming"
    );
  } else if (tech.resistance != null && tech.price > 0) {
    const room = ((tech.resistance - tech.price) / tech.price) * 100;
    parts.push(clamp(70 - room * 4));
    notes.push(`resistance ${room.toFixed(1)}% overhead`);
  }

  // Penalise extension: a stock far above its 20 DMA has already made the move.
  if (tech.extensionFrom20Pct != null) {
    const ext = tech.extensionFrom20Pct;
    parts.push(ext > 12 ? 20 : ext > 8 ? 45 : ext >= -2 ? 85 : 55);
    if (ext > 8) notes.push(`extended ${ext.toFixed(1)}% above the 20 DMA`);
  }

  if (!parts.length) return null;
  return {
    key: "breakoutStrength",
    score: parts.reduce((a, b) => a + b, 0) / parts.length,
    note: notes.join(", ") + ".",
  };
}

// ── Category 3 — Participation (15) ─────────────────────────────────────────

function scoreParticipation(i: ScoreInputs): CategoryInput | null {
  const { tech } = i;
  const parts: number[] = [];
  const notes: string[] = [];

  if (tech.volumeRatio != null) {
    // 1.0x is ordinary; 2x+ is real participation. Below 0.6x is apathy.
    parts.push(clamp(30 + (tech.volumeRatio - 0.6) * 55));
    notes.push(`volume ${tech.volumeRatio.toFixed(2)}x the 20-day average`);
  }

  if (tech.avgVolume20 != null && tech.price > 0) {
    // Turnover as a liquidity quality signal on top of the hard floor.
    const turnoverCr = (tech.avgVolume20 * tech.price) / 1e7;
    parts.push(clamp(35 + Math.log10(Math.max(turnoverCr, 1)) * 30));
    notes.push(`₹${turnoverCr.toFixed(0)} cr average daily turnover`);
  }

  // Accumulation proxy: price and volume rising together over the last month.
  if (tech.return1m != null && tech.volumeRatio != null) {
    parts.push(tech.return1m > 0 && tech.volumeRatio > 1 ? 85 : tech.return1m > 0 ? 60 : 40);
  }

  if (!parts.length) return null;
  return {
    key: "participation",
    score: parts.reduce((a, b) => a + b, 0) / parts.length,
    note:
      notes.join(", ") +
      ". Delivery % and F&O participation need an NSE bhavcopy / F&O feed.",
  };
}

// ── Category 4 — Fundamentals & Catalysts (20) ──────────────────────────────

function scoreFundamentals(i: ScoreInputs): CategoryInput | null {
  const { fundamentals: f, catalysts } = i;
  const parts: number[] = [];
  const notes: string[] = [];

  if (f.revenueGrowthYoyPct != null) {
    parts.push(clamp(45 + (f.revenueGrowthYoyPct / 25) * 55));
    notes.push(`revenue ${fmtPct(f.revenueGrowthYoyPct)} YoY`);
  }
  if (f.profitGrowthYoyPct != null) {
    parts.push(clamp(45 + (f.profitGrowthYoyPct / 30) * 55));
    notes.push(`profit ${fmtPct(f.profitGrowthYoyPct)} YoY`);
  }
  if (f.epsTrend) {
    parts.push(f.epsTrend === "improving" ? 85 : f.epsTrend === "flat" ? 55 : 30);
    notes.push(`EPS trend ${f.epsTrend}`);
  }
  if (f.operatingMarginPct != null) {
    parts.push(scoreInBand(f.operatingMarginPct, [12, 35], 0, 60));
  }
  if (f.roePct != null) {
    parts.push(clamp(35 + (f.roePct / 25) * 55));
    notes.push(`ROE ${f.roePct.toFixed(1)}%`);
  }
  if (f.debtToEquity != null) {
    parts.push(f.debtToEquity < 0.5 ? 88 : f.debtToEquity < 1 ? 68 : f.debtToEquity < 2 ? 45 : 25);
  }

  // Catalysts only move the score when a real, dated headline classified either
  // way. Neutral or absent news leaves this alone rather than inventing one.
  const rated = catalysts.filter((c) => c.impact !== "neutral");
  if (rated.length) {
    const positive = rated.filter((c) => c.impact === "positive").length;
    parts.push(clamp((positive / rated.length) * 100));
    notes.push(`${positive}/${rated.length} recent headlines read positive`);
  }

  if (!parts.length) return null;
  return {
    key: "fundamentalsCatalysts",
    score: parts.reduce((a, b) => a + b, 0) / parts.length,
    note: notes.length ? notes.join(", ") + "." : f.note,
  };
}

// ── Category 5 — Risk (15) ──────────────────────────────────────────────────

export interface RiskAssessment {
  category: CategoryInput | null;
  level: RiskLevel;
  factors: { text: string; severity: "high" | "medium" | "low" }[];
}

/**
 * Risk scores INVERSELY: 100 means low risk. Kept in one place so the score
 * and the "What could go wrong?" list can never disagree — the factors below
 * are the same conditions that produced the deduction.
 */
export function assessRisk(i: ScoreInputs): RiskAssessment {
  const { tech } = i;
  const parts: number[] = [];
  const factors: RiskAssessment["factors"] = [];
  const notes: string[] = [];

  if (tech.atrPct != null) {
    // 1.5-2.5% daily ATR is normal for a liquid Indian large cap.
    parts.push(clamp(105 - tech.atrPct * 22));
    notes.push(`ATR ${tech.atrPct.toFixed(2)}% of price`);
    if (tech.atrPct > 4) {
      factors.push({ text: `High daily volatility — ATR is ${tech.atrPct.toFixed(1)}% of price`, severity: "high" });
    }
  }

  if (tech.volatilityPct != null) {
    parts.push(clamp(110 - tech.volatilityPct * 1.6));
    if (tech.volatilityPct > 45) {
      factors.push({
        text: `Annualised volatility of ${tech.volatilityPct.toFixed(0)}% means wide swings against the position`,
        severity: "medium",
      });
    }
  }

  if (tech.extensionFrom20Pct != null) {
    const ext = tech.extensionFrom20Pct;
    parts.push(ext > 12 ? 25 : ext > 8 ? 50 : 85);
    if (ext > 8) {
      factors.push({
        text: `Price is ${ext.toFixed(1)}% above its 20 DMA — a mean-reversion pullback is likely first`,
        severity: ext > 12 ? "high" : "medium",
      });
    }
  }

  if (tech.rsi14 != null) {
    parts.push(tech.rsi14 > 78 ? 25 : tech.rsi14 > 70 ? 55 : tech.rsi14 < 35 ? 45 : 88);
    if (tech.rsi14 > 70) {
      factors.push({
        text: `RSI at ${tech.rsi14.toFixed(0)} — the stock is in overbought territory`,
        severity: tech.rsi14 > 78 ? "high" : "medium",
      });
    }
  }

  if (tech.resistance != null && tech.price > 0) {
    const room = ((tech.resistance - tech.price) / tech.price) * 100;
    if (room >= 0 && room < 3) {
      factors.push({
        text: `Major resistance at ₹${tech.resistance.toFixed(2)} is only ${room.toFixed(1)}% away`,
        severity: "medium",
      });
      parts.push(50);
    }
  }

  // Liquidity contributes to risk: thin names gap.
  if (tech.avgVolume20 != null && tech.price > 0) {
    const turnoverCr = (tech.avgVolume20 * tech.price) / 1e7;
    parts.push(clamp(40 + Math.log10(Math.max(turnoverCr, 1)) * 28));
    if (turnoverCr < 25) {
      factors.push({
        text: `Thin turnover (₹${turnoverCr.toFixed(0)} cr/day) raises slippage and gap risk`,
        severity: "medium",
      });
    }
  }

  // Event risk — a real scheduled earnings date inside the holding window.
  if (i.nextEarningsDate) {
    const days = Math.round((Date.parse(i.nextEarningsDate) - Date.now()) / 86_400_000);
    if (days >= 0 && days <= 90) {
      parts.push(days <= 14 ? 45 : 70);
      factors.push({
        text: `Quarterly results due in ${days} day${days === 1 ? "" : "s"} — an earnings gap can cut through any stop`,
        severity: days <= 14 ? "high" : "medium",
      });
      notes.push(`earnings in ${days}d`);
    }
  }

  if (i.sectorChangePct != null && i.sectorChangePct < -2) {
    factors.push({
      text: `Sector is down ${Math.abs(i.sectorChangePct).toFixed(1)}% — sector weakness works against the position`,
      severity: "medium",
    });
    parts.push(45);
  }

  if (i.benchmarkReturn1m != null && i.benchmarkReturn1m < -3) {
    factors.push({
      text: `NIFTY is down ${Math.abs(i.benchmarkReturn1m).toFixed(1)}% over the last month — broad-market weakness`,
      severity: "medium",
    });
    parts.push(45);
  }

  const negativeNews = i.catalysts.filter((c) => c.impact === "negative");
  if (negativeNews.length) {
    parts.push(clamp(80 - negativeNews.length * 15));
    factors.push({
      text: `${negativeNews.length} recent headline${negativeNews.length === 1 ? "" : "s"} read negative: "${negativeNews[0].title}"`,
      severity: negativeNews.length > 1 ? "high" : "medium",
    });
  }

  if (!parts.length) {
    return { category: null, level: "Medium", factors };
  }

  const score = parts.reduce((a, b) => a + b, 0) / parts.length;
  const level: RiskLevel = score >= 72 ? "Low" : score >= 50 ? "Medium" : "High";

  return {
    category: {
      key: "risk",
      score,
      note: notes.length ? `${level} risk — ${notes.join(", ")}.` : `${level} risk.`,
    },
    level,
    factors,
  };
}

// ── Composite ───────────────────────────────────────────────────────────────

export interface HoldingScoreResult {
  score: SignalScore;
  classification: ClassificationMeta;
  risk: RiskAssessment;
  /** True when the stock clears the qualification bar for the Top Picks list. */
  qualified: boolean;
}

export function computeHoldingScore(inputs: ScoreInputs): HoldingScoreResult {
  const risk = assessRisk(inputs);

  const categories = [
    scoreTrendMomentum(inputs),
    scoreBreakout(inputs),
    scoreParticipation(inputs),
    scoreFundamentals(inputs),
    risk.category,
  ].filter((c): c is CategoryInput => c != null);

  const score = computeScore("holding", categories);
  const classification = classify(score.score);

  return {
    score,
    classification,
    risk,
    qualified: score.score >= QUALIFICATION_THRESHOLD,
  };
}
