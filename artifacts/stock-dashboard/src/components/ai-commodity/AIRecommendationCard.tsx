import { TrendingUp, TrendingDown, Minus, Info, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAIRecommendation } from "./data";
import type { CommodityMeta, TimeframeId, Signal, RiskLevel } from "./types";

const SIG_CFG: Record<Signal, { label: string; badge: string; Icon: typeof TrendingUp }> = {
  STRONG_BUY:  { label: "STRONG BUY",  badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/35", Icon: TrendingUp },
  BUY:         { label: "BUY",         badge: "bg-green-500/15 text-green-400 border-green-500/30",       Icon: TrendingUp },
  HOLD:        { label: "HOLD",        badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",    Icon: Minus },
  SELL:        { label: "SELL",        badge: "bg-orange-500/15 text-orange-400 border-orange-500/30",    Icon: TrendingDown },
  STRONG_SELL: { label: "STRONG SELL", badge: "bg-red-500/15 text-red-400 border-red-500/35",              Icon: TrendingDown },
};

const RISK_CFG: Record<RiskLevel, { cls: string; dot: string }> = {
  Low:    { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400" },
  Medium: { cls: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",   dot: "bg-yellow-400" },
  High:   { cls: "text-red-400 bg-red-500/10 border-red-500/20",            dot: "bg-red-400" },
};

function ConfidenceBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 65 ? "bg-blue-400" : pct >= 50 ? "bg-yellow-400" : "bg-red-400";
  const textCls = pct >= 80 ? "text-emerald-400" : pct >= 65 ? "text-blue-400" : pct >= 50 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("text-sm font-mono font-black shrink-0", textCls)}>{pct}%</span>
    </div>
  );
}

function StatBox({ label, value, valueCls }: { label: string; value: string; valueCls?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 px-3 py-2.5 text-center">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={cn("text-sm font-mono font-black text-foreground", valueCls)}>{value}</div>
    </div>
  );
}

export function AIRecommendationCard({
  commodity, timeframe,
}: {
  commodity: CommodityMeta;
  timeframe: TimeframeId;
}) {
  const { data: rec, isLoading } = useAIRecommendation(commodity.id, timeframe);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-sm font-black text-foreground flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-primary" /> AI Recommendation
        </h2>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{commodity.unit}</span>
      </div>

      {isLoading || !rec ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-2 w-full" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            {(() => {
              const cfg = SIG_CFG[rec.signal];
              const Icon = cfg.Icon;
              return (
                <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-black border", cfg.badge)}>
                  <Icon className="w-4 h-4" /> {cfg.label}
                </span>
              );
            })()}
            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border", RISK_CFG[rec.riskLevel].cls)}>
              <span className={cn("w-1.5 h-1.5 rounded-full", RISK_CFG[rec.riskLevel].dot)} /> {rec.riskLevel} Risk
            </span>
            <span className="ml-auto text-[11px] font-mono text-muted-foreground">R:R 1:{rec.riskRewardRatio}</span>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Confidence</div>
            <ConfidenceBar pct={rec.confidence} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <StatBox label="Entry" value={rec.entryPrice.toLocaleString("en-IN")} />
            <StatBox label="Stop Loss" value={rec.stopLoss.toLocaleString("en-IN")} valueCls="text-red-400" />
            <StatBox label="Target" value={rec.target.toLocaleString("en-IN")} valueCls="text-emerald-400" />
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/15 px-3 py-2.5">
            <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">{rec.rationale}</p>
          </div>
        </div>
      )}
    </div>
  );
}
