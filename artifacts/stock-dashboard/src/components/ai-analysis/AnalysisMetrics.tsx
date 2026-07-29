import type { AnalysisMetric } from "@workspace/api-client-react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_BADGE, TONE_TEXT } from "./shared";

/**
 * The market-data strip along the bottom of the panel (§14).
 *
 * Scrolls horizontally inside its own container on narrow screens so the page
 * body itself never gains a horizontal scrollbar.
 */
export function AnalysisMetrics({ metrics, updatedAt }: { metrics: AnalysisMetric[]; updatedAt: string }) {
  const time = new Date(updatedAt);
  const stamp = Number.isNaN(time.getTime())
    ? updatedAt
    : time.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <dl className="flex min-w-max items-stretch divide-x divide-border/60">
          {metrics.map((m) => (
            <div key={m.label} className="min-w-[7.5rem] px-4 py-2.5">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{m.label}</dt>
              <dd className="mt-1 flex items-center gap-1.5">
                <span className={cn("font-mono text-xs font-bold", TONE_TEXT[m.tone])}>{m.value}</span>
                {m.badge && (
                  <span className={cn("rounded border px-1.5 py-px text-[9px] font-black uppercase", TONE_BADGE[m.tone])}>
                    {m.badge}
                  </span>
                )}
              </dd>
            </div>
          ))}
          <div className="min-w-[9rem] px-4 py-2.5">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Last Updated</dt>
            <dd className="mt-1 flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              <span className="font-mono text-xs font-bold text-foreground">{stamp} IST</span>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
