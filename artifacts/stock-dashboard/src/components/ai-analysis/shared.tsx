import type { Provenance, Tone } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

/**
 * Shared primitives for the AI Decision Breakdown.
 *
 * Colour is never the only carrier of meaning here — every tone also ships a
 * text marker and a label, so the panel stays readable for colour-blind users
 * and in high-contrast modes (§8).
 */

export const TONE_TEXT: Record<Tone, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-red-600 dark:text-red-400",
  neutral: "text-muted-foreground",
};

export const TONE_BADGE: Record<Tone, string> = {
  positive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  negative: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  neutral: "bg-muted/40 text-muted-foreground border-border",
};

export const DIRECTION_TEXT: Record<string, string> = {
  BULLISH: "text-emerald-600 dark:text-emerald-400",
  BEARISH: "text-red-600 dark:text-red-400",
  NEUTRAL: "text-yellow-600 dark:text-yellow-400",
  CONFLICT: "text-orange-600 dark:text-orange-400",
};

export const DIRECTION_BAR: Record<string, string> = {
  BULLISH: "bg-emerald-500",
  BEARISH: "bg-red-500",
  NEUTRAL: "bg-yellow-500",
  CONFLICT: "bg-orange-500",
};

/** Arrow glyph per direction — the non-colour cue for trend cards. */
export const DIRECTION_GLYPH: Record<string, string> = {
  BULLISH: "▲",
  BEARISH: "▼",
  NEUTRAL: "▬",
  CONFLICT: "⇄",
};

export const SIGNAL_BADGE: Record<string, string> = {
  STRONG_BUY: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/40",
  BUY: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
  WATCH: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/25",
  SELL: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25",
  STRONG_SELL: "bg-red-500/20 text-red-600 dark:text-red-300 border-red-500/40",
};

/** Provenance tags that mean "this number is not real market data". */
const SYNTHETIC: Provenance[] = ["MOCK", "GENERATED", "STATIC", "UNAVAILABLE"];

export function isSynthetic(p: Provenance) {
  return SYNTHETIC.includes(p);
}

/** Card shell so every block in the panel shares one silhouette. */
export function AnalysisCard({
  title,
  accent,
  action,
  className,
  bodyClassName,
  children,
}: {
  title?: React.ReactNode;
  accent?: string;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col rounded-xl border border-border bg-card", className)}>
      {title && (
        <header className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
          <h4 className={cn("text-xs font-black uppercase tracking-wide", accent ?? "text-foreground")}>
            {title}
          </h4>
          {action}
        </header>
      )}
      <div className={cn("flex-1 p-3", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Compact label/value row used across the trend, plan and chain cards. */
export function StatRow({
  label,
  value,
  tone = "neutral",
  marker,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: Tone;
  marker?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-1.5", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("flex items-center gap-1.5 font-mono text-xs font-bold", TONE_TEXT[tone])}>
        {marker && (
          <span aria-hidden="true" className="text-[10px] opacity-80">
            {marker}
          </span>
        )}
        {value}
      </span>
    </div>
  );
}

/** Normalised 0-1 series rendered as a filled trend line. */
export function Sparkline({
  data,
  direction,
  className,
  height = 34,
}: {
  data: number[];
  direction: string;
  className?: string;
  height?: number;
}) {
  if (data.length < 2) return null;
  const width = 100;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(2)},${((1 - v) * height).toFixed(2)}`);
  const stroke =
    direction === "BULLISH" ? "#10b981" : direction === "BEARISH" ? "#ef4444" : "#eab308";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("w-full", className)}
      style={{ height }}
      role="img"
      aria-label={`${direction.toLowerCase()} trend line`}
    >
      <polyline
        points={`0,${height} ${pts.join(" ")} ${width},${height}`}
        fill={stroke}
        fillOpacity={0.12}
        stroke="none"
      />
      <polyline points={pts.join(" ")} fill="none" stroke={stroke} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Horizontal 0-100 meter. */
export function Meter({ pct, barClass, className }: { pct: number; barClass: string; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted/50", className)}>
      <div className={cn("h-full rounded-full transition-all", barClass)} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}
