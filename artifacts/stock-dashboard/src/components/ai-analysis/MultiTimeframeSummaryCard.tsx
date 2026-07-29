import type { MultiTimeframeSummary } from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnalysisCard, DIRECTION_GLYPH, DIRECTION_TEXT, StatRow } from "./shared";

/**
 * Agreement (or disagreement) between the two timeframes.
 *
 * A conflict is shown as prominently as a confirmation, and the confidence
 * boost is displayed with its real sign — conflict subtracts from the score and
 * the UI says so rather than quietly showing a smaller bonus (§10).
 */
export function MultiTimeframeSummaryCard({ summary }: { summary: MultiTimeframeSummary }) {
  const conflict = !summary.aligned;
  const dirText = DIRECTION_TEXT[summary.alignment] ?? "text-muted-foreground";
  const boost = summary.confidenceBoost;

  return (
    <AnalysisCard title="Multi-Timeframe Summary" bodyClassName="flex flex-col p-3 pt-2.5">
      <div className="space-y-1">
        {summary.rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {row.label}
            </span>
            <span className={cn("flex items-center gap-1 text-xs font-black", DIRECTION_TEXT[row.direction])}>
              <span aria-hidden="true">{DIRECTION_GLYPH[row.direction]}</span>
              {row.direction}
            </span>
          </div>
        ))}
      </div>

      <div
        className={cn(
          "mt-2.5 flex items-center gap-2 rounded-lg border px-2.5 py-2",
          conflict ? "border-orange-500/40 bg-orange-500/10" : "border-emerald-500/30 bg-emerald-500/10"
        )}
      >
        {conflict ? (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-orange-500" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
        )}
        <span className={cn("text-xs font-black", conflict ? "text-orange-600 dark:text-orange-400" : dirText)}>
          {summary.alignmentLabel}
        </span>
      </div>

      {summary.verdict && (
        <p className="mt-2 rounded-lg border border-orange-500/30 bg-orange-500/5 px-2.5 py-1.5 text-center text-xs font-black text-orange-600 dark:text-orange-400">
          {summary.verdict}
        </p>
      )}

      <dl className="mt-2 divide-y divide-border/40">
        <StatRow
          label="Signal Alignment"
          value={summary.alignmentStrength}
          tone={summary.alignmentStrength === "Strong" ? "positive" : summary.alignmentStrength === "Weak" ? "negative" : "neutral"}
        />
        <StatRow
          label="Probability"
          value={summary.probability}
          tone={summary.probability === "High" ? "positive" : summary.probability === "Low" ? "negative" : "neutral"}
        />
        <StatRow
          label="Confidence Boost"
          value={`${boost > 0 ? "+" : ""}${boost}`}
          tone={boost > 0 ? "positive" : boost < 0 ? "negative" : "neutral"}
        />
      </dl>

      <p className="mt-2 text-[10px] leading-snug text-muted-foreground">{summary.explanation}</p>
    </AnalysisCard>
  );
}
