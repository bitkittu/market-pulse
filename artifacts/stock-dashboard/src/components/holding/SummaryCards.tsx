import type { HoldingScanSummary } from "@workspace/api-client-react";
import { CalendarClock, Compass, Layers, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Scan summary strip (§5).
 *
 * Every figure is read straight off the scan the engine just produced — there
 * are no illustrative or placeholder statistics here.
 */

const BIAS_STYLE: Record<string, string> = {
  Bullish: "text-emerald-600 dark:text-emerald-400",
  Neutral: "text-yellow-600 dark:text-yellow-400",
  Bearish: "text-red-600 dark:text-red-400",
};

function Card({
  icon: Icon,
  label,
  value,
  valueClass,
  hint,
}: {
  icon: typeof Layers;
  label: string;
  value: string;
  valueClass?: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </div>
      <p className={cn("mt-1 truncate font-mono text-xl font-black tabular-nums", valueClass ?? "text-foreground")}>
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-[10px] text-muted-foreground" title={hint}>{hint}</p>}
    </div>
  );
}

export function SummaryCards({ summary }: { summary: HoldingScanSummary }) {
  const scan = new Date(summary.lastScanAt);
  const scanLabel = Number.isNaN(scan.getTime())
    ? summary.lastScanAt
    : scan.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      <Card
        icon={Layers}
        label="Qualified Opportunities"
        value={String(summary.qualifiedCount)}
        hint={
          summary.published < summary.qualifiedCount
            ? `of ${summary.shortlisted} deep-analysed · top ${summary.published} listed`
            : `of ${summary.shortlisted} deep-analysed · all listed`
        }
      />
      <Card
        icon={Sparkles}
        label="Strong Setups"
        value={String(summary.strongSetups)}
        valueClass="text-emerald-600 dark:text-emerald-400"
        hint="Score 78 and above"
      />
      <Card
        icon={TrendingUp}
        label="New This Scan"
        value={String(summary.newThisScan)}
        hint={summary.newThisScan === 0 ? "No prior scan to compare against" : "Not in the previous scan"}
      />
      <Card
        icon={Compass}
        label="Market Bias"
        value={summary.marketBias}
        valueClass={BIAS_STYLE[summary.marketBias]}
        hint={summary.marketBiasNote}
      />
      <Card
        icon={CalendarClock}
        label="Last Scan"
        value={scanLabel}
        hint={`${scanLabel} IST · post-close`}
      />
    </div>
  );
}
