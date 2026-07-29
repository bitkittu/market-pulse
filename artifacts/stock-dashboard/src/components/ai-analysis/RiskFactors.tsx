import type { AnalysisRiskFactor } from "@workspace/api-client-react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnalysisCard } from "./shared";

const SEVERITY: Record<string, { dot: string; text: string; label: string }> = {
  high: { dot: "bg-red-500", text: "text-red-600 dark:text-red-400", label: "High" },
  medium: { dot: "bg-orange-500", text: "text-orange-600 dark:text-orange-400", label: "Medium" },
  low: { dot: "bg-yellow-500", text: "text-yellow-600 dark:text-yellow-400", label: "Low" },
};

const ORDER = { high: 0, medium: 1, low: 2 } as const;

/**
 * Evidence AGAINST the trade (§13).
 *
 * Shown with the same prominence as "Why This Pick?" — a recommendation that
 * only lists its own supporting evidence is not transparent.
 */
export function RiskFactors({ risks }: { risks: AnalysisRiskFactor[] }) {
  const sorted = [...risks].sort(
    (a, b) => (ORDER[a.severity as keyof typeof ORDER] ?? 3) - (ORDER[b.severity as keyof typeof ORDER] ?? 3)
  );

  return (
    <AnalysisCard
      title={
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-orange-500" aria-hidden="true" />
          Risk Factors
        </span>
      }
      action={<span className="text-[10px] text-muted-foreground">What could invalidate this trade</span>}
    >
      <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((r, i) => {
          const sev = SEVERITY[r.severity] ?? SEVERITY.low;
          return (
            <li key={`${r.severity}-${i}`} className="flex items-start gap-2">
              <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", sev.dot)} aria-hidden="true" />
              <span className="text-xs leading-snug text-foreground">
                {r.text}
                <span className={cn("ml-1.5 text-[9px] font-black uppercase tracking-wider", sev.text)}>{sev.label}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </AnalysisCard>
  );
}
