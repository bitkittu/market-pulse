import type { AnalysisReason } from "@workspace/api-client-react";
import { Check } from "lucide-react";
import { AnalysisCard } from "./shared";

/**
 * Supporting evidence for the recommendation.
 *
 * Every line carries the score category it was derived from (shown on hover),
 * because these statements are generated from computed evidence — they are not
 * free-form model prose (§7).
 */
export function WhyThisPick({
  reasons,
  title = "Why This Pick?",
}: {
  reasons: AnalysisReason[];
  title?: string;
}) {
  return (
    <AnalysisCard title={title}>
      <ul className="space-y-1.5">
        {reasons.map((r, i) => (
          <li key={`${r.source}-${i}`} className="flex items-start gap-2" title={`Derived from: ${r.source}`}>
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <span className="text-xs leading-snug text-foreground">{r.text}</span>
          </li>
        ))}
      </ul>
    </AnalysisCard>
  );
}
