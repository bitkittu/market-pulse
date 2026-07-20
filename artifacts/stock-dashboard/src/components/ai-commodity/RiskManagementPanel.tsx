import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { computeRisk, useAIRecommendation } from "./data";
import type { CommodityMeta, TimeframeId } from "./types";

function fmtInr(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function RiskManagementPanel({
  commodity, timeframe,
}: {
  commodity: CommodityMeta;
  timeframe: TimeframeId;
}) {
  const { data: rec, isLoading } = useAIRecommendation(commodity.id, timeframe);
  const [capital, setCapital] = useState(100000);
  const [riskPercent, setRiskPercent] = useState(2);

  const result = rec ? computeRisk(commodity, rec, { capital, riskPercent }) : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="text-sm font-black text-foreground flex items-center gap-1.5 mb-4">
        <ShieldAlert className="w-4 h-4 text-primary" /> Risk Management
      </h2>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Capital (₹)</span>
          <input
            type="number"
            min={0}
            value={capital}
            onChange={(e) => setCapital(Math.max(0, Number(e.target.value) || 0))}
            className="mt-1 w-full rounded-lg border border-border bg-background/50 px-2.5 py-1.5 text-sm font-mono font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Risk per Trade (%)</span>
          <input
            type="number"
            min={0.1}
            max={100}
            step={0.1}
            value={riskPercent}
            onChange={(e) => setRiskPercent(Math.max(0, Number(e.target.value) || 0))}
            className="mt-1 w-full rounded-lg border border-border bg-background/50 px-2.5 py-1.5 text-sm font-mono font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
      </div>

      {isLoading || !result ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5 text-sm">
            <div className="rounded-lg border border-border bg-background/50 px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Risk Amount</div>
              <div className="font-mono font-black text-foreground">{fmtInr(result.riskAmount)}</div>
            </div>
            <div className="rounded-lg border border-border bg-background/50 px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Suggested Lots</div>
              <div className="font-mono font-black text-foreground">{result.suggestedLots}</div>
            </div>
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Max Loss</div>
              <div className="font-mono font-black text-red-400">{fmtInr(result.maxLoss)}</div>
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Potential Gain</div>
              <div className="font-mono font-black text-emerald-400">{fmtInr(result.potentialGain)}</div>
            </div>
          </div>

          {result.suggestedLots === 0 && (
            <p className="text-[11px] text-amber-500 leading-relaxed">
              1 lot of {commodity.label} needs about {fmtInr(result.minCapitalForOneLot)} in capital at a {riskPercent}% risk budget — increase capital or risk % to size a position.
            </p>
          )}
        </div>
      )}

      <p className="mt-3 text-[10px] text-muted-foreground leading-relaxed">
        Lot size: {commodity.lotUnit}. Position sizing is illustrative — always confirm exchange lot specs and margin requirements before placing a real order.
      </p>
    </div>
  );
}
