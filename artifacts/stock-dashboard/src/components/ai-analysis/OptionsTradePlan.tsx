import type { AnalysisTradePlan } from "@workspace/api-client-react";
import { LockedValue } from "@/components/LockedValue";
import { cn } from "@/lib/utils";
import { AnalysisCard } from "./shared";

function fmt(currency: string, n: number) {
  return `${currency}${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Entry / target / stop levels for the analysed trade.
 *
 * These are the same paid trade levels the picks table shows, so they go
 * through LockedValue — the panel must not become a way around the free-plan
 * paywall.
 */
function PlanRow({
  label,
  value,
  valueClass,
  kind,
  locked = true,
}: {
  label: string;
  value: string;
  valueClass?: string;
  kind?: string;
  locked?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {kind && (
          <span className="rounded border border-border px-1 py-px text-[9px] font-black uppercase tracking-wider text-muted-foreground">
            {kind}
          </span>
        )}
        {label}
      </span>
      <span className={cn("font-mono text-xs font-bold", valueClass ?? "text-foreground")}>
        {locked ? <LockedValue>{value}</LockedValue> : value}
      </span>
    </div>
  );
}

export function OptionsTradePlan({ plan }: { plan: AnalysisTradePlan }) {
  const { currency, maxRisk } = plan;

  return (
    <AnalysisCard title="Trade Plan" bodyClassName="p-3 pt-2.5">
      <dl className="divide-y divide-border/40">
        <PlanRow
          kind="Entry"
          label="Entry Zone"
          value={`${fmt(currency, plan.entryLow)} – ${fmt(currency, plan.entryHigh)}`}
          valueClass="text-emerald-600 dark:text-emerald-400"
        />
        <PlanRow
          kind="Target"
          label="Target 1"
          value={fmt(currency, plan.target1)}
          valueClass="text-emerald-600 dark:text-emerald-400"
        />
        <PlanRow
          kind="Target"
          label="Target 2"
          value={fmt(currency, plan.target2)}
          valueClass="text-emerald-600 dark:text-emerald-400"
        />
        <PlanRow
          kind="Stop"
          label="Stop Loss"
          value={fmt(currency, plan.stopLoss)}
          valueClass="text-red-600 dark:text-red-400"
        />
        <PlanRow label="Risk / Reward" value={plan.riskReward} locked={false} />
        {maxRisk.amount != null && (
          <PlanRow
            label="Maximum Risk"
            value={`${fmt(currency, maxRisk.amount)}${maxRisk.pct != null ? ` (${maxRisk.pct.toFixed(1)}%)` : ""}`}
            valueClass="text-orange-600 dark:text-orange-400"
          />
        )}
      </dl>

      <p className="mt-2 border-t border-border/40 pt-2 text-[10px] leading-snug text-muted-foreground">
        {maxRisk.note}
      </p>
    </AnalysisCard>
  );
}
