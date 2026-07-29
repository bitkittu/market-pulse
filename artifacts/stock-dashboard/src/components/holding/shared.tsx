import type { HoldingClassification, HoldingCatalystImpact, HoldingRiskLevel } from "@workspace/api-client-react";

/**
 * Shared tokens for the Holding Stocks module.
 *
 * Colour is never the only carrier of meaning — every classification and impact
 * also ships a written label, matching the accessibility rule the AI Decision
 * Breakdown already follows.
 */

export const CLASSIFICATION_STYLE: Record<HoldingClassification, { badge: string; text: string; bar: string }> = {
  STRONG_SETUP: {
    badge: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
    text: "text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
  },
  GOOD_SETUP: {
    badge: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
    text: "text-cyan-600 dark:text-cyan-400",
    bar: "bg-cyan-500",
  },
  WATCH: {
    badge: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
    text: "text-yellow-600 dark:text-yellow-400",
    bar: "bg-yellow-500",
  },
  AVOID: {
    badge: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
    text: "text-red-600 dark:text-red-400",
    bar: "bg-red-500",
  },
};

export const IMPACT_STYLE: Record<HoldingCatalystImpact, { dot: string; text: string }> = {
  Positive: { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  Neutral: { dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
  Negative: { dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
};

export const RISK_STYLE: Record<HoldingRiskLevel, string> = {
  Low: "text-emerald-600 dark:text-emerald-400",
  Medium: "text-yellow-600 dark:text-yellow-400",
  High: "text-red-600 dark:text-red-400",
};

/** Signed percentage, or an em dash when the value could not be computed. */
export function fmtPct(v: number | null | undefined, dp = 1): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(dp)}%`;
}

export function fmtInr(v: number | null | undefined): string {
  if (v == null) return "—";
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function toneClass(v: number | null | undefined): string {
  if (v == null) return "text-muted-foreground";
  return v > 0
    ? "text-emerald-600 dark:text-emerald-400"
    : v < 0
      ? "text-red-600 dark:text-red-400"
      : "text-foreground";
}

export function scoreColor(score: number): string {
  return score >= 78
    ? "text-emerald-600 dark:text-emerald-400"
    : score >= 65
      ? "text-cyan-600 dark:text-cyan-400"
      : score >= 52
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";
}
