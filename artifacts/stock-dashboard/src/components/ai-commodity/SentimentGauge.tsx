import { CheckCircle2, TrendingUp, Minus, TrendingDown, AlertTriangle, Gauge } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useSentiment } from "./data";
import type { CommodityId } from "./types";

const GRADE_META = {
  "Very Bullish": { color: "text-emerald-400", barColor: "from-emerald-600 to-emerald-400", icon: CheckCircle2 },
  "Bullish":      { color: "text-emerald-400", barColor: "from-emerald-700 to-emerald-500", icon: TrendingUp },
  "Neutral":      { color: "text-slate-400",   barColor: "from-slate-600 to-slate-400",     icon: Minus },
  "Bearish":      { color: "text-red-400",     barColor: "from-red-700 to-red-500",         icon: TrendingDown },
  "Very Bearish": { color: "text-red-400",     barColor: "from-red-800 to-red-600",         icon: AlertTriangle },
} as const;

export function SentimentGauge({ commodityId }: { commodityId: CommodityId }) {
  const { data, isLoading } = useSentiment(commodityId);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="text-sm font-black text-foreground flex items-center gap-1.5 mb-4">
        <Gauge className="w-4 h-4 text-primary" /> Market Sentiment
      </h2>

      {isLoading || !data ? (
        <div className="space-y-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-full" />
        </div>
      ) : (
        (() => {
          const meta = GRADE_META[data.grade];
          const Icon = meta.icon;
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={cn("w-4 h-4", meta.color)} />
                  <span className={cn("font-bold text-sm", meta.color)}>{data.grade}</span>
                </div>
                <span className={cn("text-sm font-black", meta.color)}>{data.score}<span className="text-[10px] font-normal text-muted-foreground">/100</span></span>
              </div>

              <div>
                <div className="relative h-3 bg-background rounded-full overflow-hidden border border-border">
                  <div className="absolute inset-0 flex">
                    <div className="flex-1 bg-red-900/30" />
                    <div className="w-px bg-border" />
                    <div className="flex-1 bg-slate-800/30" />
                    <div className="w-px bg-border" />
                    <div className="flex-1 bg-emerald-900/30" />
                  </div>
                  <div
                    className={cn("absolute top-0 left-0 h-full rounded-full bg-gradient-to-r transition-all duration-700", meta.barColor)}
                    style={{ width: `${data.score}%` }}
                  />
                  <div className="absolute top-0 h-full w-0.5 bg-white/80 shadow-md transition-all duration-700" style={{ left: `${data.score}%` }} />
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-1">
                  <span>Bearish</span><span>Neutral</span><span>Bullish</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 py-2">
                  <div className="text-sm font-black text-emerald-400">{data.bullishPct}%</div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Bullish</div>
                </div>
                <div className="rounded-lg border border-border bg-background/50 py-2">
                  <div className="text-sm font-black text-foreground">{data.neutralPct}%</div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Neutral</div>
                </div>
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 py-2">
                  <div className="text-sm font-black text-red-400">{data.bearishPct}%</div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Bearish</div>
                </div>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}
