import { useState, useMemo } from "react";
import { useGetIntradaySuggestions } from "@workspace/api-client-react";
import { Info, RefreshCw, Zap, TrendingUp, TrendingDown, Minus, ShieldAlert } from "lucide-react";

function cn(...c: (string | false | undefined | null)[]) { return c.filter(Boolean).join(" "); }
function fmt(n: number, d = 2) { return n.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function fmtVol(n: number) {
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)}L`;
  return `${(n / 1e3).toFixed(0)}K`;
}

type Signal = "STRONG_BUY" | "BUY" | "WATCH" | "SELL" | "STRONG_SELL";
type Risk = "Low" | "Medium" | "High";

const SIG_CFG: Record<Signal, {
  label: string; chipActive: string; chipInactive: string;
  rowBorder: string; badge: string; glowClass: string;
  Icon: typeof TrendingUp;
}> = {
  STRONG_BUY:  {
    label: "STRONG BUY",  rowBorder: "border-l-2 border-l-emerald-500",
    glowClass: "shadow-[0_0_12px_-3px_rgba(16,185,129,0.5)] border-emerald-500/40",
    chipActive: "bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/40 shadow-md",
    chipInactive: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/35", Icon: TrendingUp },
  BUY:         {
    label: "BUY",         rowBorder: "border-l-2 border-l-green-500",
    glowClass: "shadow-[0_0_12px_-3px_rgba(34,197,94,0.4)] border-green-500/35",
    chipActive: "bg-green-400 text-black border-green-300 shadow-green-400/40 shadow-md",
    chipInactive: "bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20",
    badge: "bg-green-500/15 text-green-300 border-green-500/30", Icon: TrendingUp },
  WATCH:       {
    label: "WATCH",       rowBorder: "border-l-2 border-l-yellow-500",
    glowClass: "",
    chipActive: "bg-yellow-400 text-black border-yellow-300 shadow-yellow-400/40 shadow-md",
    chipInactive: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20",
    badge: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30", Icon: Minus },
  SELL:        {
    label: "SELL",        rowBorder: "border-l-2 border-l-orange-500",
    glowClass: "",
    chipActive: "bg-orange-500 text-white border-orange-400 shadow-orange-500/40 shadow-md",
    chipInactive: "bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20",
    badge: "bg-orange-500/15 text-orange-300 border-orange-500/30", Icon: TrendingDown },
  STRONG_SELL: {
    label: "STRONG SELL", rowBorder: "border-l-2 border-l-red-600",
    glowClass: "shadow-[0_0_12px_-3px_rgba(239,68,68,0.4)] border-red-500/35",
    chipActive: "bg-red-600 text-white border-red-500 shadow-red-600/40 shadow-md",
    chipInactive: "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20",
    badge: "bg-red-500/15 text-red-300 border-red-500/35", Icon: TrendingDown },
};

const RISK_CFG: Record<Risk, { cls: string; dot: string }> = {
  Low:    { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400" },
  Medium: { cls: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",  dot: "bg-yellow-400" },
  High:   { cls: "text-red-400 bg-red-500/10 border-red-500/20",           dot: "bg-red-400" },
};

const ALL_SIGNALS: Signal[] = ["STRONG_BUY", "BUY", "WATCH", "SELL", "STRONG_SELL"];

type Suggestion = NonNullable<ReturnType<typeof useGetIntradaySuggestions>["data"]>[number] & {
  confidence?: number;
  riskLevel?: Risk;
};

function ConfidenceBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 65 ? "bg-blue-400" : pct >= 50 ? "bg-yellow-400" : "bg-red-400";
  const textCls = pct >= 80 ? "text-emerald-400" : pct >= 65 ? "text-blue-400" : pct >= 50 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={cn("text-xs font-mono font-black", textCls)}>{pct.toFixed(0)}%</span>
      <div className="w-14 h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SuggestionRow({ s, rank, isTop3 }: { s: Suggestion; rank: number; isTop3: boolean }) {
  const [hover, setHover] = useState(false);
  const sig = s.signal as Signal;
  const cfg = SIG_CFG[sig];
  const risk: Risk = (s.riskLevel as Risk) ?? "Medium";
  const riskCfg = RISK_CFG[risk];
  const conf = s.confidence ?? 50;
  const isPos = s.changePercent >= 0;
  const Icon = cfg.Icon;

  return (
    <>
      <tr
        className={cn(
          "border-b border-border/50 transition-all cursor-pointer",
          cfg.rowBorder,
          isTop3 ? cn("border border-l-4", cfg.glowClass) : (rank % 2 === 0 ? "bg-card" : "bg-background/40"),
          hover && "brightness-115"
        )}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* Rank */}
        <td className="px-3 py-3 whitespace-nowrap text-center">
          {isTop3 ? (
            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center mx-auto text-xs font-black border",
              rank === 1 ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" :
              rank === 2 ? "bg-slate-400/20 text-slate-300 border-slate-400/40" :
              "bg-orange-600/20 text-orange-300 border-orange-600/40")}>
              {rank}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground font-mono">{rank}</span>
          )}
        </td>

        {/* Symbol */}
        <td className="px-4 py-3 whitespace-nowrap">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-white font-mono">{s.symbol}</span>
              <span className={cn("text-xs font-mono font-semibold", isPos ? "text-emerald-400" : "text-red-400")}>
                {isPos ? "▲" : "▼"}{Math.abs(s.changePercent).toFixed(2)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate max-w-[110px]">{s.name}</p>
          </div>
        </td>

        {/* Current Price */}
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <p className="text-sm font-mono font-bold text-white">₹{fmt(s.currentPrice)}</p>
        </td>

        {/* Buy Below */}
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <p className="text-sm font-mono font-bold text-emerald-400">₹{fmt(s.buyBelow)}</p>
        </td>

        {/* Sell Above */}
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <p className="text-sm font-mono font-bold text-red-400">₹{fmt(s.sellAbove)}</p>
        </td>

        {/* Stop Loss */}
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <p className="text-xs font-mono text-orange-400">₹{fmt(s.stopLoss)}</p>
        </td>

        {/* Signal */}
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-black", cfg.badge)}>
            <Icon className="w-3 h-3" />{cfg.label}
          </span>
        </td>

        {/* Confidence */}
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <ConfidenceBar pct={conf} />
        </td>

        {/* Risk Level */}
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-bold", riskCfg.cls)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", riskCfg.dot)} />{risk}
          </span>
        </td>

        {/* RSI */}
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <p className={cn("text-xs font-mono font-bold",
            s.rsi >= 70 ? "text-red-400" : s.rsi <= 30 ? "text-emerald-400" : "text-yellow-400")}>
            {s.rsi.toFixed(0)}
          </p>
        </td>

        {/* Volume */}
        <td className="px-4 py-3 text-center whitespace-nowrap text-xs text-muted-foreground">{fmtVol(s.volume)}</td>
      </tr>

      {/* Hover rationale */}
      {hover && (
        <tr className="border-b border-border/20">
          <td colSpan={11} className="px-6 py-2 bg-background/60">
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

export function IntradayDashboard() {
  const [selected, setSelected] = useState<Set<Signal>>(new Set());
  const { data: rawData, isLoading, refetch, isFetching } = useGetIntradaySuggestions({ query: { refetchInterval: 60000 } });

  // Sort by confidence descending
  const data = useMemo(() =>
    [...(rawData ?? [])].sort((a, b) => ((b as any).confidence ?? 0) - ((a as any).confidence ?? 0)),
    [rawData]
  );

  const counts = useMemo(() => {
    const c: Record<Signal, number> = { STRONG_BUY: 0, BUY: 0, WATCH: 0, SELL: 0, STRONG_SELL: 0 };
    data.forEach(s => { c[s.signal as Signal] = (c[s.signal as Signal] ?? 0) + 1; });
    return c;
  }, [data]);

  const filtered = useMemo(() =>
    selected.size === 0 ? data : data.filter(s => selected.has(s.signal as Signal)),
    [data, selected]
  );

  const toggleChip = (sig: Signal) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(sig)) next.delete(sig); else next.add(sig);
      return next;
    });
  };

  const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
  const COLS = ["Rank", "Symbol", "Current", "Buy Below", "Sell Above", "Stop Loss", "Signal", "Confidence", "Risk", "RSI", "Volume"];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Intraday Stock Picks</h1>
            <p className="text-xs text-muted-foreground">Sorted by confidence · Top 3 highlighted · AI-screened</p>
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

      {/* Filter Chips */}
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <span className="text-xs font-semibold text-muted-foreground">Filter:</span>
        {ALL_SIGNALS.map(sig => {
          const cfg = SIG_CFG[sig];
          const isActive = selected.has(sig);
          const count = counts[sig] ?? 0;
          return (
            <button key={sig} onClick={() => toggleChip(sig)}
              className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all duration-200",
                isActive ? cfg.chipActive : cfg.chipInactive)}>
              {sig.includes("BUY") ? <TrendingUp className="w-3 h-3" /> : sig === "WATCH" ? <Minus className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {cfg.label}
              <span className={cn("ml-0.5 px-1.5 py-0.5 rounded-full text-xs font-black",
                isActive ? "bg-white/20 text-white" : "bg-muted/50 text-muted-foreground")}>
                {count}
              </span>
            </button>
          );
        })}
        {selected.size > 0 && (
          <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground underline ml-1">
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground font-mono">
          {filtered.length}/{data.length} stocks
        </span>
      </div>

      {/* Top 3 legend */}
      <div className="flex flex-wrap items-center gap-4 mb-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-yellow-500/30 border border-yellow-500/50" />Top 1 pick (gold)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-slate-400/30 border border-slate-400/50" />2nd pick (silver)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-orange-600/30 border border-orange-600/50" />3rd pick (bronze)
        </span>
        <ShieldAlert className="w-3 h-3 ml-2" />
        <span>Risk: Low/Medium/High based on stop-loss distance</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-14 bg-card border border-border rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="bg-[#0d1526] border-b border-border sticky top-0 z-10">
                  {COLS.map(col => (
                    <th key={col} className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide text-center whitespace-nowrap">
                      {col === "Buy Below" ? <span className="text-emerald-400">{col}</span> :
                       col === "Sell Above" ? <span className="text-red-400">{col}</span> :
                       col === "Confidence" ? <span className="text-blue-400">{col}</span> : col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-12 text-muted-foreground text-sm">No stocks match the selected filters</td></tr>
                ) : (
                  filtered.map((s, i) => (
                    <SuggestionRow key={s.symbol} s={s as Suggestion} rank={i + 1} isTop3={i < 3 && selected.size === 0} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-yellow-500/5 border border-yellow-500/15 rounded-xl flex items-start gap-2">
        <Info className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-yellow-400">Disclaimer:</span> AI-generated signals. Not SEBI-registered advice. Confidence % reflects signal strength — not guaranteed returns.
        </p>
      </div>
    </div>
  );
}
