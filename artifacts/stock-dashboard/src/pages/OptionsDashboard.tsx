import { useGetOptionsSuggestions } from "@workspace/api-client-react";
import { TrendingUp, TrendingDown, Minus, Info, RefreshCw, Activity } from "lucide-react";

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

const SIGNAL_CONFIG: Record<Signal, { label: string; bg: string; text: string; border: string }> = {
  STRONG_BUY: { label: "STRONG BUY", bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/30" },
  BUY:        { label: "BUY",        bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  WATCH:      { label: "WATCH",      bg: "bg-yellow-500/10",  text: "text-yellow-400",  border: "border-yellow-500/20" },
  SELL:       { label: "SELL",       bg: "bg-red-500/10",     text: "text-red-400",     border: "border-red-500/20" },
  STRONG_SELL:{ label: "STRONG SELL",bg: "bg-red-500/15",     text: "text-red-300",     border: "border-red-500/30" },
};

function SignalBadge({ signal }: { signal: Signal }) {
  const cfg = SIGNAL_CONFIG[signal];
  return (
    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-black whitespace-nowrap tracking-wide", cfg.bg, cfg.text, cfg.border)}>
      {cfg.label}
    </span>
  );
}

function IVBar({ iv }: { iv: number }) {
  const pct = Math.min(iv, 80);
  const color = iv > 40 ? "bg-red-500" : iv > 25 ? "bg-yellow-400" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct / 80 * 100}%` }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground">{iv.toFixed(1)}%</span>
    </div>
  );
}

type Suggestion = NonNullable<ReturnType<typeof useGetOptionsSuggestions>["data"]>[number];

function OptionsRow({ s, i }: { s: Suggestion; i: number }) {
  const signal = s.signal as Signal;
  const isCE = s.optionType === "CE";
  const isPos = s.changePercent >= 0;

  return (
    <div className={cn(
      "group rounded-xl border transition-all hover:border-primary/30",
      i % 2 === 0 ? "bg-card border-border" : "bg-background/40 border-border/60"
    )}>
      {/* Main Row */}
      <div className="grid grid-cols-12 gap-2 items-center px-4 py-3">
        {/* Rank + Symbol + Option Info */}
        <div className="col-span-3 flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono w-5 shrink-0">#{s.rank}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-black text-white font-mono">{s.symbol}</span>
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded font-black tracking-wider",
                isCE ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                     : "bg-red-500/20 text-red-300 border border-red-500/30"
              )}>{s.optionType}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-muted-foreground font-mono">Strike ₹{fmt(s.strikePrice, 0)}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{s.expiry}</span>
            </div>
          </div>
        </div>

        {/* Premium (Current Price) */}
        <div className="col-span-2 text-center">
          <p className="text-xs text-muted-foreground mb-0.5">Premium</p>
          <p className="text-sm font-mono font-bold text-white">₹{fmt(s.currentPrice)}</p>
          <p className={cn("text-xs font-mono", isPos ? "text-emerald-400" : "text-red-400")}>
            {isPos ? "▲" : "▼"}{Math.abs(s.changePercent).toFixed(1)}%
          </p>
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

        {/* Underlying + Stop Loss */}
        <div className="col-span-1 text-center hidden lg:block">
          <p className="text-xs text-muted-foreground mb-0.5">Stop Loss</p>
          <p className="text-xs font-mono text-orange-400">₹{fmt(s.stopLoss)}</p>
        </div>

        {/* Signal */}
        <div className="col-span-2 flex justify-end">
          <SignalBadge signal={signal} />
        </div>
      </div>

      {/* Detail Row */}
      <div className="px-4 pb-3 grid grid-cols-12 gap-2 items-center border-t border-border/30">
        <div className="col-span-3 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Underlying: <span className="text-foreground font-mono font-semibold">₹{fmt(s.underlyingPrice)}</span></span>
        </div>
        <div className="col-span-2 text-center">
          <span className="text-xs text-muted-foreground">OI: {fmtVol(s.openInterest)}</span>
        </div>
        <div className="col-span-2 flex items-center justify-center gap-1.5">
          <span className="text-xs text-muted-foreground">IV</span>
          <IVBar iv={s.impliedVolatility} />
        </div>
        <div className="col-span-5 flex items-start gap-1.5">
          <Info className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{s.rationale}</p>
        </div>
      </div>
    </div>
  );
}

export function OptionsDashboard() {
  const { data, isLoading, refetch, isFetching } = useGetOptionsSuggestions({
    query: { refetchInterval: 60000 },
  });

  const now = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });

  // Separate CE and PE
  const ceList = (data ?? []).filter((s) => s.optionType === "CE");
  const peList = (data ?? []).filter((s) => s.optionType === "PE");

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
              <Activity className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white">Options Trading Picks</h1>
              <p className="text-xs text-muted-foreground">Top 10 NSE Options · CE & PE · AI-screened · Updated every hour</p>
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

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total Picks", value: String(data?.length ?? 0), cls: "text-white" },
          { label: "CE (Bullish)", value: String(ceList.length), cls: "text-emerald-400" },
          { label: "PE (Bearish)", value: String(peList.length), cls: "text-red-400" },
          { label: "Strong Signals",
            value: String((data ?? []).filter(s => s.signal === "STRONG_BUY" || s.signal === "STRONG_SELL").length),
            cls: "text-primary" },
        ].map((item) => (
          <div key={item.label} className="bg-card border border-border rounded-xl px-4 py-3 text-center">
            <p className={cn("text-2xl font-black font-mono", item.cls)}>{item.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-card border border-border rounded-xl text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-black flex items-center justify-center text-xs">CE</span>
          <span className="text-muted-foreground">Call Option (Bullish)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-red-500/20 border border-red-500/30 text-red-300 font-black flex items-center justify-center text-xs">PE</span>
          <span className="text-muted-foreground">Put Option (Bearish)</span>
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          <span className="text-muted-foreground">IV = Implied Volatility · OI = Open Interest</span>
        </div>
        <div className="ml-auto flex items-center gap-1 text-muted-foreground">
          <Info className="w-3 h-3" />
          Lot sizes vary by underlying
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border mb-2">
        <div className="col-span-3">Symbol / Strike / Expiry</div>
        <div className="col-span-2 text-center">Premium</div>
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
            <OptionsRow key={`${s.symbol}-${s.optionType}-${s.strikePrice}`} s={s} i={i} />
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-5 p-3 bg-yellow-500/5 border border-yellow-500/15 rounded-xl flex items-start gap-2">
        <Info className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-yellow-400">Disclaimer:</span> Options trading involves significant risk. These are AI-generated signals for educational purposes only. Not SEBI-registered investment advice. Options can expire worthless. Premium prices are simulated. Connect your Upstox API for real market data. Always consult a qualified financial advisor before trading options.
        </p>
      </div>
    </div>
  );
}
