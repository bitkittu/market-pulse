import { useGetIntradaySuggestions } from "@workspace/api-client-react";
import { TrendingUp, TrendingDown, Minus, Info, RefreshCw, Zap } from "lucide-react";

function cn(...c: (string | false | undefined | null)[]) {
  return c.filter(Boolean).join(" ");
}
function fmt(n: number, d = 2) {
  return n.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function fmtVol(n: number) {
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)}L`;
  return `${(n / 1000).toFixed(0)}K`;
}

type Signal = "STRONG_BUY" | "BUY" | "WATCH" | "SELL" | "STRONG_SELL";
type VwapStatus = "ABOVE" | "BELOW" | "AT";

const SIGNAL_CONFIG: Record<Signal, { label: string; bg: string; text: string; border: string; Icon: typeof TrendingUp }> = {
  STRONG_BUY: { label: "STRONG BUY", bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/30", Icon: TrendingUp },
  BUY:        { label: "BUY",        bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", Icon: TrendingUp },
  WATCH:      { label: "WATCH",      bg: "bg-yellow-500/10",  text: "text-yellow-400",  border: "border-yellow-500/20",  Icon: Minus },
  SELL:       { label: "SELL",       bg: "bg-red-500/10",     text: "text-red-400",     border: "border-red-500/20",     Icon: TrendingDown },
  STRONG_SELL:{ label: "STRONG SELL",bg: "bg-red-500/15",     text: "text-red-300",     border: "border-red-500/30",     Icon: TrendingDown },
};

const VWAP_CONFIG: Record<VwapStatus, { label: string; cls: string }> = {
  ABOVE: { label: "↑ Above VWAP", cls: "text-emerald-400" },
  BELOW: { label: "↓ Below VWAP", cls: "text-red-400" },
  AT:    { label: "≈ At VWAP",    cls: "text-yellow-400" },
};

function SignalBadge({ signal }: { signal: Signal }) {
  const cfg = SIGNAL_CONFIG[signal];
  const Icon = cfg.Icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold whitespace-nowrap", cfg.bg, cfg.text, cfg.border)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function RSIBar({ rsi }: { rsi: number }) {
  const color = rsi >= 70 ? "bg-red-500" : rsi <= 30 ? "bg-emerald-500" : "bg-yellow-400";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${rsi}%` }} />
      </div>
      <span className={cn("text-xs font-mono font-bold",
        rsi >= 70 ? "text-red-400" : rsi <= 30 ? "text-emerald-400" : "text-yellow-400"
      )}>{rsi.toFixed(0)}</span>
    </div>
  );
}

function SuggestionRow({ s, i }: { s: ReturnType<typeof useGetIntradaySuggestions>["data"] extends (infer T)[] | undefined ? T : never; i: number }) {
  if (!s) return null;
  const signal = s.signal as Signal;
  const vwap = s.vwapStatus as VwapStatus;
  const isPos = s.changePercent >= 0;

  return (
    <div className={cn(
      "group rounded-xl border transition-all hover:border-primary/30 hover:bg-primary/3",
      i % 2 === 0 ? "bg-card border-border" : "bg-background/40 border-border/60"
    )}>
      {/* Main Row */}
      <div className="grid grid-cols-12 gap-2 items-center px-4 py-3">
        {/* Rank + Symbol */}
        <div className="col-span-3 flex items-center gap-2.5">
          <span className="text-xs text-muted-foreground font-mono w-5 shrink-0 text-center">#{s.rank}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-white font-mono">{s.symbol}</span>
              <span className={cn("text-xs font-mono font-semibold", isPos ? "text-emerald-400" : "text-red-400")}>
                {isPos ? "▲" : "▼"}{Math.abs(s.changePercent).toFixed(2)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">{s.name}</p>
          </div>
        </div>

        {/* Current Price */}
        <div className="col-span-2 text-center">
          <p className="text-xs text-muted-foreground mb-0.5">Current</p>
          <p className="text-sm font-mono font-bold text-white">₹{fmt(s.currentPrice)}</p>
        </div>

        {/* Buy Below */}
        <div className="col-span-2 text-center">
          <p className="text-xs text-muted-foreground mb-0.5">Buy Below</p>
          <p className="text-sm font-mono font-bold text-emerald-400">₹{fmt(s.buyBelow)}</p>
        </div>

        {/* Sell Above */}
        <div className="col-span-2 text-center">
          <p className="text-xs text-muted-foreground mb-0.5">Sell Above</p>
          <p className="text-sm font-mono font-bold text-red-400">₹{fmt(s.sellAbove)}</p>
        </div>

        {/* Stop Loss */}
        <div className="col-span-1 text-center hidden lg:block">
          <p className="text-xs text-muted-foreground mb-0.5">Stop Loss</p>
          <p className="text-xs font-mono text-orange-400">₹{fmt(s.stopLoss)}</p>
        </div>

        {/* Signal */}
        <div className="col-span-2 flex justify-end">
          <SignalBadge signal={signal} />
        </div>
      </div>

      {/* Expanded detail row */}
      <div className="px-4 pb-3 grid grid-cols-12 gap-2 items-center border-t border-border/30">
        <div className="col-span-3 flex items-center gap-3">
          <span className={cn("text-xs font-medium", VWAP_CONFIG[vwap].cls)}>{VWAP_CONFIG[vwap].label}</span>
          <span className="text-xs text-muted-foreground">{s.sector}</span>
        </div>
        <div className="col-span-2 text-center">
          <span className="text-xs text-muted-foreground">Vol: {fmtVol(s.volume)}</span>
        </div>
        <div className="col-span-2 flex items-center justify-center gap-1">
          <span className="text-xs text-muted-foreground">RSI</span>
          <RSIBar rsi={s.rsi} />
        </div>
        <div className="col-span-5 flex items-start gap-1.5">
          <Info className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{s.rationale}</p>
        </div>
      </div>
    </div>
  );
}

export function IntradayDashboard() {
  const { data, isLoading, refetch, isFetching } = useGetIntradaySuggestions({
    query: { refetchInterval: 60000 },
  });

  const now = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white">Intraday Stock Picks</h1>
              <p className="text-xs text-muted-foreground">Top 10 NSE stocks · AI-screened · Updated every hour</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-mono">{now} IST</span>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-card border border-border px-3 py-1.5 rounded-lg transition-all hover:border-primary/30"
          >
            <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-card border border-border rounded-xl">
        <span className="text-xs font-semibold text-muted-foreground">Signals:</span>
        {(Object.entries(SIGNAL_CONFIG) as [Signal, typeof SIGNAL_CONFIG[Signal]][]).map(([key, cfg]) => {
          const Icon = cfg.Icon;
          return (
            <span key={key} className={cn("inline-flex items-center gap-1 text-xs font-semibold", cfg.text)}>
              <Icon className="w-3 h-3" />{cfg.label}
            </span>
          );
        })}
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <Info className="w-3 h-3" />
          Signals refresh every 60 minutes
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border mb-2">
        <div className="col-span-3">Symbol</div>
        <div className="col-span-2 text-center">Current Price</div>
        <div className="col-span-2 text-center text-emerald-400">Buy Below</div>
        <div className="col-span-2 text-center text-red-400">Sell Above</div>
        <div className="col-span-1 text-center hidden lg:block">Stop Loss</div>
        <div className="col-span-2 text-right">Signal</div>
      </div>

      {/* Rows */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((s, i) => (
            <SuggestionRow key={s.symbol} s={s} i={i} />
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-5 p-3 bg-yellow-500/5 border border-yellow-500/15 rounded-xl flex items-start gap-2">
        <Info className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-yellow-400">Disclaimer:</span> These are AI-generated intraday signals based on technical analysis patterns. Not SEBI-registered investment advice. Always use proper risk management. Past signals do not guarantee future performance. Trade at your own risk.
        </p>
      </div>
    </div>
  );
}
