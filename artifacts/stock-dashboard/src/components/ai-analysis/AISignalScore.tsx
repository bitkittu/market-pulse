import { useState } from "react";
import type { SignalScore } from "@workspace/api-client-react";
import { ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnalysisCard, Meter } from "./shared";

/**
 * The headline conviction number.
 *
 * Deliberately labelled "AI Signal Score … /100" and never as a probability of
 * profit — we have no validated historical win-rate to justify that claim (§6).
 * The category breakdown is one click away so the number is auditable rather
 * than magic.
 */
export function AISignalScore({
  score,
  title = "AI Signal Score",
  footnote,
}: {
  score: SignalScore;
  /** Overridden by modules with their own score name (e.g. MarketPulse Holding Score). */
  title?: string;
  /** Replaces the default "not a probability of profit" line. */
  footnote?: React.ReactNode;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const value = score.score;
  const barClass =
    value >= 85 ? "bg-emerald-500" : value >= 70 ? "bg-green-500" : value >= 52 ? "bg-yellow-500" : value >= 38 ? "bg-orange-500" : "bg-red-500";
  const textClass =
    value >= 85 ? "text-emerald-500" : value >= 70 ? "text-green-500" : value >= 52 ? "text-yellow-500" : value >= 38 ? "text-orange-500" : "text-red-500";

  return (
    <AnalysisCard title={title} bodyClassName="p-3 pt-2.5">
      <div className="flex items-baseline gap-2">
        <span className={cn("font-mono text-4xl font-black leading-none", textClass)}>{value}</span>
        <span className="font-mono text-sm text-muted-foreground">/100</span>
        <span className={cn("ml-auto text-right text-[10px] font-bold leading-tight", textClass)}>{score.band}</span>
      </div>

      <Meter pct={value} barClass={barClass} className="mt-3 h-2" />

      <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-snug text-muted-foreground">
        <Info className="mt-px h-3 w-3 shrink-0" />
        <span>
          {footnote ?? (
            <>
              Signal <strong className="font-semibold text-foreground">strength</strong>, not a probability of profit.
            </>
          )}
        </span>
      </p>

      <button
        type="button"
        onClick={() => setShowBreakdown((s) => !s)}
        aria-expanded={showBreakdown}
        className="mt-2 flex w-full items-center justify-between rounded-lg border border-border px-2 py-1.5 text-[10px] font-bold text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
      >
        How this was scored
        <ChevronDown className={cn("h-3 w-3 transition-transform", showBreakdown && "rotate-180")} />
      </button>

      {showBreakdown && (
        <ul className="mt-2 space-y-1.5">
          {score.categories.map((c) => (
            <li key={c.key}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[10px] text-muted-foreground" title={c.note}>
                  {c.label}
                </span>
                <span className="shrink-0 font-mono text-[10px] font-bold text-foreground">
                  {c.score}
                  <span className="ml-1 font-normal text-muted-foreground">×{c.weight}</span>
                </span>
              </div>
              <Meter
                pct={c.score}
                barClass={c.score >= 70 ? "bg-emerald-500/70" : c.score >= 45 ? "bg-yellow-500/70" : "bg-red-500/70"}
                className="mt-0.5 h-1"
              />
            </li>
          ))}
        </ul>
      )}
    </AnalysisCard>
  );
}
