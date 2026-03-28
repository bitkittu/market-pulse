import { useState, useMemo } from "react";
import { useGetOptionsSuggestions } from "@workspace/api-client-react";
import { Info, RefreshCw, Activity, TrendingUp, TrendingDown } from "lucide-react";

function cn(...c: (string | false | undefined | null)[]) { return c.filter(Boolean).join(" "); }
function fmt(n: number, d = 2) { return n.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function fmtVol(n: number) {
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)}L`;
  return `${(n / 1e3).toFixed(0)}K`;
}

type Signal = "STRONG_BUY" | "BUY" | "WATCH" | "SELL" | "STRONG_SELL";
type TabId = "all" | "ce" | "pe" | "strong";

const SIG_CFG: Record<Signal, { label: string; cls: string; border: string }> = {
  STRONG_BUY:  { label: "STRONG BUY",  cls: "bg-emerald-500/20 text-emerald-300", border: "border-emerald-500/40" },
  BUY:         { label: "BUY",         cls: "bg-emerald-500/10 text-emerald-400", border: "border-emerald-500/25" },
  WATCH:       { label: "WATCH",       cls: "bg-yellow-500/10 text-yellow-400",   border: "border-yellow-500/25" },
  SELL:        { label: "SELL",        cls: "bg-red-500/10 text-red-400",         border: "border-red-500/25" },
  STRONG_SELL: { label: "STRONG SELL", cls: "bg-red-500/20 text-red-300",         border: "border-red-500/40" },
};

type Suggestion = NonNullable<ReturnType<typeof useGetOptionsSuggestions>["data"]>[number];

function IVBar({ iv }: { iv: number }) {
  const color = iv > 40 ? "bg-red-500" : iv > 25 ? "bg-yellow-400" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(iv / 80, 1) * 100}%` }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground">{iv.toFixed(1)}%</span>
    </div>
  );
}

function OptionsRow({ s, i }: { s: Suggestion; i: number }) {
  const [hover, setHover] = useState(false);
  const sig = s.signal as Signal;
  const cfg = SIG_CFG[sig];
  const isCE = s.optionType === "CE";
  const isPos = s.changePercent >= 0;

  return (
    <>
      <tr
        className={cn("border-b border-border/50 transition-all cursor-pointer",
          isCE ? "border-l-2 border-l-emerald-500" : "border-l-2 border-l-red-500",
          i % 2 === 0 ? "bg-card" : "bg-background/40",
          hover && "brightness-110")}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-muted-foreground">{s.rank}</td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-white font-mono">{s.symbol}</span>
                <span className={cn("text-xs px-1.5 py-0.5 rounded font-black border tracking-wider",
                  isCE ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                       : "bg-red-500/20 text-red-300 border-red-500/30")}>
                  {s.optionType}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-[100px]">{s.name}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <p className="text-xs font-mono text-muted-foreground">Strike</p>
          <p className="text-sm font-mono font-bold text-white">₹{fmt(s.strikePrice, 0)}</p>
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap text-xs text-muted-foreground font-mono">{s.expiry}</td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <p className="text-sm font-mono font-bold text-white">₹{fmt(s.currentPrice)}</p>
          <p className={cn("text-xs font-mono", isPos ? "text-emerald-400" : "text-red-400")}>
            {isPos ? "▲" : "▼"}{Math.abs(s.changePercent).toFixed(1)}%
          </p>
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <p className="text-sm font-mono font-bold text-emerald-400">₹{fmt(s.buyBelow)}</p>
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <p className="text-sm font-mono font-bold text-red-400">₹{fmt(s.sellAbove)}</p>
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <p className="text-xs font-mono text-orange-400">₹{fmt(s.stopLoss)}</p>
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <p className="text-xs text-muted-foreground">Underlying</p>
          <p className="text-xs font-mono font-semibold text-foreground">₹{fmt(s.underlyingPrice)}</p>
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <span className={cn("inline-block px-2.5 py-1 rounded-lg border text-xs font-black", cfg.cls, cfg.border)}>
            {cfg.label}
          </span>
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap"><IVBar iv={s.impliedVolatility} /></td>
        <td className="px-4 py-3 text-center whitespace-nowrap text-xs text-muted-foreground">{fmtVol(s.openInterest)}</td>
      </tr>
      {hover && (
        <tr className="border-b border-border/20">
          <td colSpan={12} className="px-6 py-2 bg-background/60">
            <div className="flex items-start gap-1.5">
              <Info className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">{s.rationale}</p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function OptionsDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const { data, isLoading, refetch, isFetching } = useGetOptionsSuggestions({ query: { refetchInterval: 60000 } });

  const counts = useMemo(() => ({
    all: data?.length ?? 0,
    ce: data?.filter(s => s.optionType === "CE").length ?? 0,
    pe: data?.filter(s => s.optionType === "PE").length ?? 0,
    strong: data?.filter(s => s.signal === "STRONG_BUY" || s.signal === "STRONG_SELL").length ?? 0,
  }), [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (activeTab === "ce") return data.filter(s => s.optionType === "CE");
    if (activeTab === "pe") return data.filter(s => s.optionType === "PE");
    if (activeTab === "strong") return data.filter(s => s.signal === "STRONG_BUY" || s.signal === "STRONG_SELL");
    return data;
  }, [data, activeTab]);

  const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
  const COLS = ["#", "Symbol / Type", "Strike", "Expiry", "Premium", "Buy Below", "Sell Above", "Stop Loss", "Underlying", "Signal", "IV", "OI"];

  const TABS: { id: TabId; label: string; count: number; cls: string; activeCls: string }[] = [
    { id: "all",    label: "All Picks",       count: counts.all,    cls: "text-muted-foreground", activeCls: "text-white border-primary" },
    { id: "ce",     label: "CE (Bullish)",    count: counts.ce,     cls: "text-emerald-400/60",   activeCls: "text-emerald-400 border-emerald-500" },
    { id: "pe",     label: "PE (Bearish)",    count: counts.pe,     cls: "text-red-400/60",       activeCls: "text-red-400 border-red-500" },
    { id: "strong", label: "Strong Signals",  count: counts.strong, cls: "text-violet-400/60",    activeCls: "text-violet-400 border-violet-500" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
            <Activity className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Options Trading Picks</h1>
            <p className="text-xs text-muted-foreground">Top 10 NSE Options · CE & PE · AI-screened</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-mono">{now} IST</span>
          <button onClick={() => refetch()} disabled={isFetching}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-card border border-border px-3 py-1.5 rounded-lg transition-all">
            <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs with underline animation */}
      <div className="flex items-center gap-0 mb-5 border-b border-border">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn("relative px-4 py-3 text-sm font-bold transition-all flex items-center gap-2",
                isActive ? tab.activeCls : tab.cls, "hover:text-foreground")}>
              {tab.label}
              <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-black transition-all",
                isActive ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground")}>
                {tab.count}
              </span>
              {isActive && (
                <span className={cn("absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full", tab.activeCls.includes("emerald") ? "bg-emerald-500" : tab.activeCls.includes("red") ? "bg-red-500" : tab.activeCls.includes("violet") ? "bg-violet-500" : "bg-primary")} />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-card border border-border rounded-xl text-xs">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-emerald-400" />
          <span className="text-emerald-400 font-bold">CE</span>
          <span className="text-muted-foreground">= Call Option (Bullish)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingDown className="w-3 h-3 text-red-400" />
          <span className="text-red-400 font-bold">PE</span>
          <span className="text-muted-foreground">= Put Option (Bearish)</span>
        </div>
        <div className="text-muted-foreground">IV = Implied Volatility · OI = Open Interest</div>
        <div className="ml-auto text-muted-foreground">Hover for signal rationale</div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-14 bg-card border border-border rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="bg-[#0d1526] border-b border-border sticky top-0 z-10">
                  {COLS.map(col => (
                    <th key={col} className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide text-center first:text-left whitespace-nowrap">
                      {col === "Buy Below" ? <span className="text-emerald-400">{col}</span> :
                       col === "Sell Above" ? <span className="text-red-400">{col}</span> : col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={12} className="text-center py-12 text-muted-foreground text-sm">No stocks in this category</td></tr>
                ) : (
                  filtered.map((s, i) => <OptionsRow key={`${s.symbol}-${s.optionType}-${s.strikePrice}`} s={s} i={i} />)
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-yellow-500/5 border border-yellow-500/15 rounded-xl flex items-start gap-2">
        <Info className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-yellow-400">Disclaimer:</span> Options involve significant risk and can expire worthless. Not SEBI-registered investment advice. Connect Upstox API for live data.
        </p>
      </div>
    </div>
  );
}
