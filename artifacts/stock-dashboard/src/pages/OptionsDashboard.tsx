import { useState, useMemo } from "react";
import { useGetOptionsSuggestions, OptionsSuggestion } from "@workspace/api-client-react";
import { Info, RefreshCw, Activity, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { LockedValue, LockedHint } from "@/components/LockedValue";
import { UpgradeGate } from "@/components/UpgradeGate";
import { useFeatureAccess } from "@/lib/plan";

function cn(...c: (string | false | undefined | null)[]) { return c.filter(Boolean).join(" "); }
function fmt(n: number, d = 2) { return n.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function fmtVol(n: number) {
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)}L`;
  return `${(n / 1e3).toFixed(0)}K`;
}

type Signal = "STRONG_BUY" | "BUY" | "WATCH" | "SELL" | "STRONG_SELL";
type TabId = "all" | "ce" | "pe" | "strong";
type OITrend = "Increasing" | "Decreasing" | "Stable";

const SIG_CFG: Record<Signal, { label: string; cls: string; border: string }> = {
  STRONG_BUY:  { label: "STRONG BUY",  cls: "bg-emerald-500/20 text-emerald-300", border: "border-emerald-500/40" },
  BUY:         { label: "BUY",         cls: "bg-emerald-500/10 text-emerald-400", border: "border-emerald-500/25" },
  WATCH:       { label: "WATCH",       cls: "bg-yellow-500/10 text-yellow-400",   border: "border-yellow-500/25" },
  SELL:        { label: "SELL",        cls: "bg-red-500/10 text-red-400",         border: "border-red-500/25" },
  STRONG_SELL: { label: "STRONG SELL", cls: "bg-red-500/20 text-red-300",         border: "border-red-500/40" },
};

type Suggestion = OptionsSuggestion & {
  oiTrend?: OITrend;
  confidence?: number;
};

// ── Tooltip ───────────────────────────────────────────────────────────────
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 bg-[#0d1526] border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground shadow-2xl pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border" />
        </span>
      )}
    </span>
  );
}

function IVBadge({ iv }: { iv: number }) {
  const isHigh = iv > 30;
  const isMed = iv > 20;
  return (
    <Tooltip text="Implied Volatility: Measures option premium cost. High IV (>30%) means expensive premiums — options may not move as expected. Low IV means cheaper premiums.">
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1">
          <div className={cn("w-12 h-1.5 bg-muted/40 rounded-full overflow-hidden")}>
            <div className={cn("h-full rounded-full", isHigh ? "bg-red-500" : isMed ? "bg-yellow-400" : "bg-emerald-500")}
              style={{ width: `${Math.min(iv / 50, 1) * 100}%` }} />
          </div>
          <span className="text-xs font-mono text-muted-foreground">{iv.toFixed(1)}%</span>
        </div>
        {isHigh && (
          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
            <AlertTriangle className="w-2.5 h-2.5" />HIGH IV
          </span>
        )}
      </div>
    </Tooltip>
  );
}

function OIBadge({ oi, trend }: { oi: number; trend: OITrend }) {
  const isStrong = oi > 1000000;
  const trendIcon = trend === "Increasing" ? <ArrowUpRight className="w-3 h-3" /> :
    trend === "Decreasing" ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />;
  const trendCls = trend === "Increasing" ? "text-emerald-400 border-emerald-500/30" :
    trend === "Decreasing" ? "text-red-400 border-red-500/30" : "text-muted-foreground border-border";

  return (
    <Tooltip text="Open Interest: Total outstanding option contracts. Increasing OI with price move = strong conviction. Decreasing OI = position unwinding. Strong OI (>10L) = highly liquid contract.">
      <div className="flex flex-col items-center gap-1">
        <span className={cn("inline-flex items-center gap-0.5 text-xs font-bold border px-1.5 py-0.5 rounded bg-background/60", trendCls)}>
          {trendIcon}{trend}
        </span>
        <span className="text-xs font-mono text-muted-foreground">{fmtVol(oi)}</span>
        {isStrong && (
          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
            <CheckCircle2 className="w-2.5 h-2.5" />STRONG OI
          </span>
        )}
      </div>
    </Tooltip>
  );
}

function ConfBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 65 ? "bg-blue-400" : "bg-yellow-400";
  const textCls = pct >= 80 ? "text-emerald-400" : pct >= 65 ? "text-blue-400" : "text-yellow-400";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("text-xs font-mono font-bold", textCls)}>{pct.toFixed(0)}%</span>
    </div>
  );
}

function OptionsRow({ s, i }: { s: Suggestion; i: number }) {
  const [hover, setHover] = useState(false);
  const sig = s.signal as Signal;
  const cfg = SIG_CFG[sig];
  const isCE = s.optionType === "CE";
  const isPos = s.changePercent >= 0;
  const oiTrend: OITrend = (s.oiTrend as OITrend) ?? "Stable";
  const conf: number = s.confidence ?? 60;

  return (
    <>
      <tr
        className={cn("border-b border-border/50 transition-all cursor-pointer",
          isCE ? "border-l-2 border-l-emerald-500" : "border-l-2 border-l-red-500",
          i % 2 === 0 ? "bg-card" : "bg-background/40", hover && "brightness-110")}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      >
        {/* Rank */}
        <td className="px-3 py-3 whitespace-nowrap text-center text-xs text-muted-foreground font-mono">{s.rank}</td>

        {/* Symbol + Type */}
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
              <p className="text-xs text-muted-foreground truncate max-w-[90px]">{s.name}</p>
            </div>
          </div>
        </td>

        {/* Strike */}
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <p className="text-xs text-muted-foreground">Strike</p>
          <p className="text-sm font-mono font-bold text-white">₹{fmt(s.strikePrice, 0)}</p>
        </td>

        {/* Expiry */}
        <td className="px-4 py-3 text-center whitespace-nowrap text-xs text-muted-foreground font-mono">{s.expiry}</td>

        {/* Premium */}
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <p className="text-sm font-mono font-bold text-white">₹{fmt(s.currentPrice)}</p>
          <p className={cn("text-xs font-mono", isPos ? "text-emerald-400" : "text-red-400")}>
            {isPos ? "▲" : "▼"}{Math.abs(s.changePercent).toFixed(1)}%
          </p>
        </td>

        {/* Buy Below */}
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <p className="text-sm font-mono font-bold text-emerald-400"><LockedValue>{`₹${fmt(s.buyBelow)}`}</LockedValue></p>
        </td>

        {/* Sell Above */}
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <p className="text-sm font-mono font-bold text-red-400"><LockedValue>{`₹${fmt(s.sellAbove)}`}</LockedValue></p>
        </td>

        {/* Stop Loss */}
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <p className="text-xs font-mono text-orange-400"><LockedValue>{`₹${fmt(s.stopLoss)}`}</LockedValue></p>
        </td>

        {/* Signal */}
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <span className={cn("inline-block px-2.5 py-1 rounded-lg border text-xs font-black", cfg.cls, cfg.border)}>
            {cfg.label}
          </span>
        </td>

        {/* Confidence */}
        <td className="px-4 py-3 text-center whitespace-nowrap"><ConfBar pct={conf} /></td>

        {/* IV */}
        <td className="px-4 py-3 text-center whitespace-nowrap"><IVBadge iv={s.impliedVolatility} /></td>

        {/* OI + Trend */}
        <td className="px-4 py-3 text-center whitespace-nowrap"><OIBadge oi={s.openInterest} trend={oiTrend} /></td>

        {/* Underlying */}
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <p className="text-xs text-muted-foreground">Underlying</p>
          <p className="text-xs font-mono font-semibold text-foreground">₹{fmt(s.underlyingPrice)}</p>
        </td>
      </tr>

      {/* Hover rationale */}
      {hover && (
        <tr className="border-b border-border/20">
          <td colSpan={13} className="px-6 py-2 bg-background/60">
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
  const canView = useFeatureAccess("options");
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const { data: rawData, isLoading, refetch, isFetching } = useGetOptionsSuggestions({ query: { refetchInterval: 60000, enabled: canView } });

  const counts = useMemo(() => ({
    all: rawData?.length ?? 0,
    ce: rawData?.filter(s => s.optionType === "CE").length ?? 0,
    pe: rawData?.filter(s => s.optionType === "PE").length ?? 0,
    strong: rawData?.filter(s => s.signal === "STRONG_BUY" || s.signal === "STRONG_SELL").length ?? 0,
  }), [rawData]);

  const filtered = useMemo(() => {
    if (!rawData) return [];
    const src = activeTab === "ce" ? rawData.filter(s => s.optionType === "CE") :
      activeTab === "pe" ? rawData.filter(s => s.optionType === "PE") :
      activeTab === "strong" ? rawData.filter(s => s.signal === "STRONG_BUY" || s.signal === "STRONG_SELL") :
      rawData;
    return [...src].sort((a, b) => ((b as any).confidence ?? 0) - ((a as any).confidence ?? 0));
  }, [rawData, activeTab]);

  const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
  const COLS = ["#", "Symbol", "Strike", "Expiry", "Premium", "Buy Below", "Sell Above", "Stop Loss", "Signal", "Confidence", "IV ⓘ", "OI Trend ⓘ", "Underlying"];

  const TABS = [
    { id: "all" as TabId,    label: "All Picks",      count: counts.all,    activeLine: "bg-primary" },
    { id: "ce" as TabId,     label: "CE (Bullish)",   count: counts.ce,     activeLine: "bg-emerald-500" },
    { id: "pe" as TabId,     label: "PE (Bearish)",   count: counts.pe,     activeLine: "bg-red-500" },
    { id: "strong" as TabId, label: "Strong Signals", count: counts.strong, activeLine: "bg-violet-500" },
  ];

  const Header = (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
          <Activity className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h1 className="text-lg font-black text-white">Options Trading Picks</h1>
          <p className="text-xs text-muted-foreground">CE & PE · IV & OI analysis · Hover columns for explanations</p>
        </div>
      </div>
      {canView && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-mono">{now} IST</span>
          <button onClick={() => refetch()} disabled={isFetching}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-card border border-border px-3 py-1.5 rounded-lg transition-all">
            <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} /> Refresh
          </button>
        </div>
      )}
    </div>
  );

  if (!canView) {
    return (
      <div>
        {Header}
        <UpgradeGate
          title="Options Predictions is a Pro feature"
          description="Unlock CE/PE option picks with implied-volatility and open-interest analysis, buy/sell triggers, stop-loss and confidence."
        />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      {Header}

      {/* Tab bar with underline animation */}
      <div className="flex items-center gap-0 mb-5 border-b border-border">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn("relative px-4 py-3 text-sm font-bold transition-all flex items-center gap-2",
                isActive ? "text-white" : "text-muted-foreground hover:text-foreground")}>
              {tab.label}
              <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-black transition-all",
                isActive ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground")}>
                {tab.count}
              </span>
              {isActive && <span className={cn("absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full", tab.activeLine)} />}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 mb-4 p-3 bg-card border border-border rounded-xl text-xs">
        <div className="flex items-center gap-1.5"><TrendingUp className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400 font-bold">CE</span><span className="text-muted-foreground">= Call (Bullish)</span></div>
        <div className="flex items-center gap-1.5"><TrendingDown className="w-3 h-3 text-red-400" /><span className="text-red-400 font-bold">PE</span><span className="text-muted-foreground">= Put (Bearish)</span></div>
        <div className="flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-red-400" /><span className="text-muted-foreground">HIGH IV = expensive premium</span></div>
        <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400" /><span className="text-muted-foreground">STRONG OI = high liquidity</span></div>
        <div className="ml-auto text-muted-foreground">ⓘ = hover for explanation</div>
      </div>

      {/* Free-plan notice */}
      <LockedHint fields="Buy Below, Sell Above & Stop Loss" />

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1300px]">
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
                  <tr><td colSpan={13} className="text-center py-12 text-muted-foreground text-sm">No stocks in this category</td></tr>
                ) : (
                  filtered.map((s, i) => <OptionsRow key={`${s.symbol}-${s.optionType}-${s.strikePrice}`} s={s as Suggestion} i={i} />)
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-yellow-500/5 border border-yellow-500/15 rounded-xl flex items-start gap-2">
        <Info className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-yellow-400">Disclaimer:</span> Options involve significant risk. High IV means more expensive premiums. Not SEBI-registered advice. Connect Upstox API for live market data.
        </p>
      </div>
    </div>
  );
}
