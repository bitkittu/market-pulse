import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetDecisionPanel,
  useGetGiftNiftyQuote,
  useGetGiftNiftyHistory,
  useGetGiftNiftyIntraday,
  useGetGlobalIndexQuote,
  useGetGlobalIndexHistory,
  useGetNseMovers,
  useGetNseSectors,
  useGetUpstoxSettings,
} from "@workspace/api-client-react";
import type {
  DecisionPanel,
  SignalRow,
} from "@workspace/api-client-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { LockedValue, LockedHint } from "@/components/LockedValue";
import { LockOverlay } from "@/components/UpgradeGate";
import { useFeatureAccess } from "@/lib/plan";
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Clock, RefreshCw, Bell, BellOff, ChevronUp, ChevronDown,
  Zap, BookOpen, Target, ShieldAlert, BarChart2, Activity,
} from "lucide-react";

// ── Utilities ─────────────────────────────────────────────────────────────
function cn(...c: (string | false | undefined | null)[]) { return c.filter(Boolean).join(" "); }
function fmt(n: number, dec = 2) { return n.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function fmtINR(n: number) { return "₹" + fmt(n, 2); }

// ── Types ─────────────────────────────────────────────────────────────────
type Mode = "trader" | "learning";
interface PriceAlert { id: string; symbol: string; price: number; type: "above" | "below"; triggered: boolean; }

// ── Small shared pieces ───────────────────────────────────────────────────
function ChangeChip({ v, size = "sm" }: { v: number; size?: "sm" | "lg" }) {
  const pos = v >= 0;
  const Icon = pos ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-mono font-semibold",
      pos ? "text-emerald-400" : "text-red-400",
      size === "lg" ? "text-base" : "text-xs")}>
      <Icon className={size === "lg" ? "w-4 h-4" : "w-3 h-3"} />
      {pos ? "+" : ""}{fmt(v)}%
    </span>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-muted/40 rounded", className)} />;
}

// ── Mode toggle ───────────────────────────────────────────────────────────
function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="flex items-center gap-1 bg-background/80 border border-border rounded-xl p-1">
      <button onClick={() => setMode("trader")}
        className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
          mode === "trader" ? "bg-primary text-white shadow" : "text-muted-foreground hover:text-foreground")}>
        <Zap className="w-3 h-3" /> Trader
      </button>
      <button onClick={() => setMode("learning")}
        className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
          mode === "learning" ? "bg-blue-600 text-white shadow" : "text-muted-foreground hover:text-foreground")}>
        <BookOpen className="w-3 h-3" /> Learning
      </button>
    </div>
  );
}

// ── Decision Panel (sticky hero) ──────────────────────────────────────────
const STATUS_STYLES = {
  BULLISH:  { bg: "bg-emerald-500/10 border-emerald-500/30", badge: "bg-emerald-500 text-white", dot: "bg-emerald-400", label: "BULLISH", icon: TrendingUp },
  BEARISH:  { bg: "bg-red-500/10 border-red-500/30",         badge: "bg-red-500 text-white",     dot: "bg-red-400",     label: "BEARISH", icon: TrendingDown },
  SIDEWAYS: { bg: "bg-yellow-500/10 border-yellow-500/30",   badge: "bg-yellow-500 text-white",  dot: "bg-yellow-400",  label: "SIDEWAYS", icon: Activity },
};

const ACTION_STYLES = {
  BUY:  { bar: "bg-emerald-500", text: "text-emerald-400", border: "border-emerald-500/40", glow: "shadow-emerald-500/20", label: "🟢 BUY", pill: "bg-emerald-500/20 text-emerald-300 border-emerald-400/50" },
  SELL: { bar: "bg-red-500",     text: "text-red-400",     border: "border-red-500/40",     glow: "shadow-red-500/20",     label: "🔴 SELL", pill: "bg-red-500/20 text-red-300 border-red-400/50" },
  WAIT: { bar: "bg-yellow-500",  text: "text-yellow-400",  border: "border-yellow-500/40",  glow: "shadow-yellow-500/20",  label: "🟡 WAIT", pill: "bg-yellow-500/20 text-yellow-300 border-yellow-400/50" },
};

function ConfidenceBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono font-bold text-foreground">{pct}%</span>
    </div>
  );
}

function DecisionHero({ panel, mode }: { panel: DecisionPanel | undefined; mode: Mode }) {
  if (!panel) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  const st = STATUS_STYLES[panel.marketStatus];
  const StatusIcon = st.icon;
  const act = ACTION_STYLES[panel.tradeDecision.action];
  const td = panel.tradeDecision;

  return (
    <div className={cn("border rounded-2xl p-5 shadow-lg", st.bg, `shadow-${act.glow}`)}>
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-sm", st.badge)}>
            <StatusIcon className="w-4 h-4" />
            {st.label}
          </div>
          <div className={cn("px-3 py-1.5 rounded-xl text-sm font-bold border", act.pill)}>
            {act.label}
          </div>
          <span className="text-xs text-muted-foreground font-medium">{td.timeframe}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Nifty 50</p>
            <p className="text-lg font-bold font-mono text-white">{fmt(panel.niftyPrice, 2)}</p>
          </div>
          <ChangeChip v={panel.niftyChangePct} size="lg" />
        </div>
      </div>

      {/* Key numbers grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Buy/Sell Level */}
        {td.action === "BUY" && (
          <div className={cn("bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center overflow-hidden")}>
            <p className="text-[10px] text-emerald-400 font-bold tracking-widest mb-1">BUY ABOVE</p>
            <p className="text-lg sm:text-xl md:text-2xl font-black font-mono text-emerald-300 truncate">{fmt(td.buyAbove ?? td.entry, 2)}</p>
          </div>
        )}
        {td.action === "SELL" && (
          <div className={cn("bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-center overflow-hidden")}>
            <p className="text-[10px] text-red-400 font-bold tracking-widest mb-1">SELL BELOW</p>
            <p className="text-lg sm:text-xl md:text-2xl font-black font-mono text-red-300 truncate">{fmt(td.sellBelow ?? td.entry, 2)}</p>
          </div>
        )}
        {td.action === "WAIT" && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
            <p className="text-[10px] text-yellow-400 font-bold tracking-widest mb-1 text-center">BREAKOUT LEVELS</p>
            <div className="flex items-center justify-between gap-1">
              <div className="text-center flex-1">
                <p className="text-[9px] text-emerald-400 font-bold mb-0.5">BUY ABOVE</p>
                <p className="text-sm font-black font-mono text-emerald-300">{fmt(td.buyAbove ?? 0, 2)}</p>
              </div>
              <span className="text-muted-foreground">|</span>
              <div className="text-center flex-1">
                <p className="text-[9px] text-red-400 font-bold mb-0.5">SELL BELOW</p>
                <p className="text-sm font-black font-mono text-red-300">{fmt(td.sellBelow ?? 0, 2)}</p>
              </div>
            </div>
            {mode === "learning" && <p className="text-[9px] text-muted-foreground mt-1 text-center">Wait for price to break either level</p>}
          </div>
        )}

        {/* Stop Loss */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center overflow-hidden">
          <p className="text-[10px] text-red-400 font-bold tracking-widest mb-1">STOP LOSS</p>
          <p className="text-lg sm:text-xl md:text-2xl font-black font-mono text-red-300 truncate">{fmt(td.stopLoss, 2)}</p>
          {mode === "learning" && <p className="text-[9px] text-muted-foreground mt-0.5">Exit if hit</p>}
        </div>

        {/* Target */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center overflow-hidden">
          <p className="text-[10px] text-emerald-400 font-bold tracking-widest mb-1">TARGET</p>
          <p className="text-lg sm:text-xl md:text-2xl font-black font-mono text-emerald-300 truncate">{fmt(td.target, 2)}</p>
          {mode === "learning" && <p className="text-[9px] text-muted-foreground mt-0.5">Profit level</p>}
        </div>

        {/* R:R + Confidence */}
        <div className="bg-card/60 border border-border rounded-xl p-3">
          <div className="flex justify-between items-center mb-2">
            <p className="text-[10px] text-muted-foreground font-bold tracking-widest">RISK:REWARD</p>
            <span className="text-sm font-black font-mono text-primary">1:{td.riskReward}</span>
          </div>
          <p className="text-[10px] text-muted-foreground font-bold tracking-widest mb-0.5">CONFIDENCE</p>
          <ConfidenceBar pct={panel.confidence} color={act.bar} />
          {mode === "learning" && (
            <p className="text-[9px] text-muted-foreground mt-1">Based on pivot levels + trend</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Key Levels Panel ──────────────────────────────────────────────────────
function LevelPill({ label, value, accent, tip }: { label: string; value: number; accent?: string; tip?: string }) {
  return (
    <div className={cn("bg-background/50 border rounded-xl px-2 sm:px-3 py-2.5 text-center hover:border-primary/30 transition-colors overflow-hidden", accent ?? "border-border")}>
      <p className="text-[9px] font-bold tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-sm sm:text-base font-black font-mono truncate", accent ? "text-foreground" : "text-foreground")}>{fmt(value, 2)}</p>
      {tip && <p className="text-[9px] text-muted-foreground mt-0.5">{tip}</p>}
    </div>
  );
}

function KeyLevelsPanel({ panel, mode }: { panel: DecisionPanel | undefined; mode: Mode }) {
  const canView = useFeatureAccess("keyLevels");
  if (!panel) return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14" />)}
      </div>
    </div>
  );

  const kl = panel.keyLevels;
  const grid = (
    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-11 gap-2">
      <LevelPill label="R3"        value={kl.r3}        accent="border-emerald-700/40"  tip={mode === "learning" ? "Strong resistance" : undefined} />
      <LevelPill label="R2"        value={kl.r2}        accent="border-emerald-600/40" />
      <LevelPill label="R1"        value={kl.r1}        accent="border-emerald-500/50" />
      <LevelPill label="PIVOT"     value={kl.pivot}     accent="border-primary/50" />
      <LevelPill label="VWAP"      value={kl.vwap}      accent="border-blue-500/40"     tip={mode === "learning" ? "Fair value" : undefined} />
      <LevelPill label="S1"        value={kl.s1}        accent="border-red-500/50" />
      <LevelPill label="S2"        value={kl.s2}        accent="border-red-600/40" />
      <LevelPill label="S3"        value={kl.s3}        accent="border-red-700/40"      tip={mode === "learning" ? "Strong support" : undefined} />
      <LevelPill label="PREV HIGH" value={kl.prevHigh}  accent="border-emerald-400/30" />
      <LevelPill label="PREV LOW"  value={kl.prevLow}   accent="border-red-400/30" />
      <LevelPill label="PREV CLOSE" value={kl.prevClose} />
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" /> Key Levels
        </h3>
        {mode === "learning" && (
          <span className="text-[10px] text-muted-foreground">Pivot points based on previous session OHLC</span>
        )}
      </div>
      {canView ? grid : <LockOverlay label="Resistance & Support Levels">{grid}</LockOverlay>}
    </div>
  );
}

// ── Market Pressure ───────────────────────────────────────────────────────
function MarketPressureCard({ panel, mode }: { panel: DecisionPanel | undefined; mode: Mode }) {
  if (!panel) return <Skeleton className="h-36 rounded-xl" />;
  const mp = panel.marketPressure;
  const buyW = mp.buyerStrength;
  const sellW = mp.sellerStrength;
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-primary" /> Market Pressure
      </h3>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-emerald-400">Buyers {buyW}%</span>
        <span className="text-xs font-bold text-red-400">Sellers {sellW}%</span>
      </div>
      {/* Pressure bar */}
      <div className="h-5 rounded-full overflow-hidden bg-red-500/30 flex">
        <div className="bg-emerald-500 rounded-l-full transition-all" style={{ width: `${buyW}%` }} />
      </div>
      <div className="flex justify-between mt-1 mb-3">
        <span className="text-[9px] text-emerald-500 font-mono">{buyW}%</span>
        <span className="text-[9px] text-red-400 font-mono">{sellW}%</span>
      </div>
      <div className={cn("text-center py-1.5 rounded-lg text-xs font-bold border",
        mp.trend === "BULLISH" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
        : mp.trend === "BEARISH" ? "bg-red-500/10 border-red-500/30 text-red-400"
        : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400")}>
        {mp.trend} PRESSURE
      </div>
      {mode === "learning" && (
        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
          Calculated from price position within day's range. Above 60% → buyers in control.
        </p>
      )}
    </div>
  );
}

// ── Money Flow ────────────────────────────────────────────────────────────
function MoneyFlowCard({ panel, mode }: { panel: DecisionPanel | undefined; mode: Mode }) {
  if (!panel) return <Skeleton className="h-36 rounded-xl" />;
  const mf = panel.moneyFlow;
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
        <BarChart2 className="w-4 h-4 text-primary" /> Money Flow
      </h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Volume Spike</span>
          <span className={cn("text-xs font-bold px-2 py-0.5 rounded",
            mf.volumeSpike ? "bg-emerald-500/20 text-emerald-400" : "bg-muted/30 text-muted-foreground")}>
            {mf.volumeSpike ? "✔ YES — 1.5×+" : "✘ No Spike"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Open Interest</span>
          <span className={cn("text-xs font-bold px-2 py-0.5 rounded",
            mf.oiChange === "UP" ? "bg-emerald-500/20 text-emerald-400"
            : mf.oiChange === "DOWN" ? "bg-red-500/20 text-red-400"
            : "bg-muted/30 text-muted-foreground")}>
            {mf.oiChange === "UP" ? "↑ Building" : mf.oiChange === "DOWN" ? "↓ Unwinding" : "→ Stable"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Smart Money</span>
          <span className={cn("text-xs font-bold px-2 py-0.5 rounded",
            mf.smartMoneySignal === "ACCUMULATION" ? "bg-blue-500/20 text-blue-400"
            : mf.smartMoneySignal === "DISTRIBUTION" ? "bg-orange-500/20 text-orange-400"
            : "bg-muted/30 text-muted-foreground")}>
            {mf.smartMoneySignal}
          </span>
        </div>
      </div>
      {mode === "learning" && (
        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">{mf.description}</p>
      )}
    </div>
  );
}

// ── Signals Table ─────────────────────────────────────────────────────────
const SIG_STYLES = {
  BUY:  { badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40", bar: "bg-emerald-500" },
  SELL: { badge: "bg-red-500/20 text-red-400 border-red-500/40",             bar: "bg-red-500" },
  HOLD: { badge: "bg-muted/40 text-muted-foreground border-border",          bar: "bg-muted" },
};

function SignalsTable({ panel, mode }: { panel: DecisionPanel | undefined; mode: Mode }) {
  if (!panel) return (
    <div className="bg-card border border-border rounded-xl p-4">
      {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 mb-2" />)}
    </div>
  );

  const rows = panel.signalsTable;
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" /> Live Signals
        </h3>
        {mode === "learning" && (
          <span className="text-[10px] text-muted-foreground">Signals based on RSI + VWAP + price action</span>
        )}
      </div>
      <div className="px-4 pt-3">
        <LockedHint fields="Entry, Stop Loss & Target" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[10px] sm:text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border/60">
              <th className="text-left px-2 sm:px-4 py-2 font-semibold">Stock</th>
              <th className="text-center px-2 sm:px-3 py-2 font-semibold">Signal</th>
              <th className="text-right px-2 sm:px-3 py-2 font-semibold">Entry</th>
              <th className="text-right px-2 sm:px-3 py-2 font-semibold">Stop Loss</th>
              <th className="text-right px-2 sm:px-3 py-2 font-semibold">Target</th>
              <th className="text-right px-2 sm:px-3 py-2 font-semibold">R:R</th>
              <th className="text-right px-2 sm:px-4 py-2 font-semibold">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: SignalRow) => {
              const s = SIG_STYLES[row.signal];
              return (
                <tr key={row.symbol} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-2.5">
                    <p className="font-bold text-foreground">{row.symbol}</p>
                    {mode === "learning" && (
                      <p className="text-muted-foreground text-[10px] truncate max-w-[120px]">{row.name}</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-black border", s.badge)}>
                      {row.signal}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold"><LockedValue>{fmtINR(row.entry)}</LockedValue></td>
                  <td className="px-3 py-2.5 text-right font-mono text-red-400"><LockedValue>{fmtINR(row.stopLoss)}</LockedValue></td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-400"><LockedValue>{fmtINR(row.target)}</LockedValue></td>
                  <td className="px-3 py-2.5 text-right font-mono text-primary font-bold">1:{row.riskReward}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-12 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", s.bar)} style={{ width: `${row.confidence}%` }} />
                      </div>
                      <span className="font-mono font-bold w-8 text-right">{row.confidence}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Alert System ──────────────────────────────────────────────────────────
function AlertSystem({ mode }: { mode: Mode }) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [symbol, setSymbol] = useState("NIFTY");
  const [price, setPrice] = useState("");
  const [type, setType] = useState<"above" | "below">("above");
  const [showForm, setShowForm] = useState(false);
  const notifiedRef = useRef(new Set<string>());

  // Poll and trigger alerts
  const { data: quote } = useGetGiftNiftyQuote({ query: { refetchInterval: 30000 } });

  useEffect(() => {
    if (!quote?.price) return;
    alerts.forEach((a) => {
      if (a.triggered || notifiedRef.current.has(a.id)) return;
      const hit = a.type === "above" ? quote.price >= a.price : quote.price <= a.price;
      if (hit) {
        notifiedRef.current.add(a.id);
        setAlerts((prev) => prev.map((x) => x.id === a.id ? { ...x, triggered: true } : x));
        // Browser notification
        if (Notification.permission === "granted") {
          new Notification(`🚨 NSE Alert: ${a.symbol}`, {
            body: `Price is now ${a.type} ₹${a.price}. Current: ₹${quote.price.toFixed(2)}`,
          });
        }
      }
    });
  }, [quote, alerts]);

  const addAlert = () => {
    const p = parseFloat(price);
    if (!p || !symbol) return;
    setAlerts((prev) => [...prev, { id: Date.now().toString(), symbol: symbol.toUpperCase(), price: p, type, triggered: false }]);
    setPrice("");
    setShowForm(false);
  };

  const requestNotifPermission = async () => {
    if (Notification.permission !== "granted") {
      await Notification.requestPermission();
    }
  };

  const notifGranted = typeof Notification !== "undefined" && Notification.permission === "granted";

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" /> Price Alerts
          {alerts.length > 0 && (
            <span className="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{alerts.filter(a => !a.triggered).length} active</span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {!notifGranted && (
            <button onClick={requestNotifPermission} className="text-[10px] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 transition-colors">
              Enable notifications
            </button>
          )}
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 border border-primary/30 rounded-lg px-2.5 py-1 transition-colors">
            {showForm ? "Cancel" : "+ Add Alert"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="flex flex-wrap gap-2 mb-3 p-3 bg-background/50 border border-border rounded-xl">
          <input value={symbol} onChange={e => setSymbol(e.target.value)}
            placeholder="Symbol (e.g. NIFTY)"
            className="bg-muted/20 border border-border rounded px-2 py-1.5 text-xs font-mono w-28 focus:outline-none focus:border-primary/60" />
          <select value={type} onChange={e => setType(e.target.value as "above" | "below")}
            className="bg-muted/20 border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-primary/60">
            <option value="above">Above</option>
            <option value="below">Below</option>
          </select>
          <input type="number" value={price} onChange={e => setPrice(e.target.value)}
            placeholder="Price"
            className="bg-muted/20 border border-border rounded px-2 py-1.5 text-xs font-mono w-28 focus:outline-none focus:border-primary/60" />
          <button onClick={addAlert} className="bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-primary/80 transition-colors">
            Set Alert
          </button>
        </div>
      )}

      {alerts.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          {mode === "learning"
            ? "Set price/breakout alerts. You'll get an on-screen notification when the price hits your level."
            : "No alerts set · click + Add Alert"}
        </p>
      ) : (
        <div className="space-y-1.5">
          {alerts.map((a) => (
            <div key={a.id}
              className={cn("flex items-center justify-between px-3 py-2 rounded-lg border text-xs",
                a.triggered ? "bg-primary/10 border-primary/30" : "bg-background/40 border-border/60")}>
              <div className="flex items-center gap-2">
                {a.triggered ? <Bell className="w-3 h-3 text-primary" /> : <BellOff className="w-3 h-3 text-muted-foreground" />}
                <span className="font-bold">{a.symbol}</span>
                <span className="text-muted-foreground">{a.type === "above" ? "≥" : "≤"}</span>
                <span className="font-mono font-bold text-foreground">₹{a.price.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                {a.triggered && <span className="text-primary font-bold text-[10px]">TRIGGERED</span>}
                <button onClick={() => setAlerts(prev => prev.filter(x => x.id !== a.id))}
                  className="text-muted-foreground hover:text-red-400 text-[10px] transition-colors">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Gift Nifty Chart (compact) ─────────────────────────────────────────────
const DATA_SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  nse:       { label: "NSE Live",    cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  upstox:    { label: "Upstox Live", cls: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  yahoo:     { label: "Yahoo ~15m",  cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  simulated: { label: "Simulated",   cls: "bg-muted/50 text-muted-foreground border-border" },
};

function GiftNiftyCard() {
  const { data: quote } = useGetGiftNiftyQuote({ query: { refetchInterval: 30000 } });
  const [period, setPeriod] = useState<"1D" | "1M" | "3M">("3M");
  const { data: hist } = useGetGiftNiftyHistory(
    { period: period as "1M" | "3M" },
    { query: { refetchInterval: 60000, enabled: period !== "1D" } }
  );
  const { data: intraday } = useGetGiftNiftyIntraday({
    query: { refetchInterval: 60000, enabled: period === "1D" },
  });

  const isPos = (quote?.changePercent ?? 0) >= 0;
  const color = isPos ? "#10b981" : "#ef4444";
  const dsrc  = quote?.dataSource ?? "";
  const badge = DATA_SOURCE_BADGE[dsrc] ?? DATA_SOURCE_BADGE.simulated;

  const histData = (hist?.data ?? []).map(p => ({ val: p.close, label: format(new Date(p.timestamp), "dd MMM") }));
  const idData   = (intraday?.data ?? []).map(p => ({ val: p.price, label: p.label }));
  const chartData = period === "1D" ? idData : histData;
  const vals  = chartData.map(d => d.val).filter(Boolean);
  const minV  = vals.length ? Math.min(...vals) : 0;
  const maxV  = vals.length ? Math.max(...vals) : 0;
  const pad   = Math.max((maxV - minV) * 0.06, 10);
  const noData = period === "1D" && idData.length === 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-y-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full tracking-wider uppercase">Nifty 50</span>
          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", badge.cls)}>{badge.label}</span>
          {quote && <ChangeChip v={quote.changePercent} />}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold font-mono text-white">{quote ? fmt(quote.price, 2) : "—"}</span>
          <div className="flex bg-background/60 rounded-lg p-0.5 border border-border">
            {(["1D","1M","3M"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={cn("px-2 py-0.5 text-xs font-mono rounded-md transition-all",
                  period === p ? "bg-primary text-white font-bold" : "text-muted-foreground hover:text-foreground")}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="h-36">
        {noData ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            Intraday data available Mon–Fri · 9:15 AM–3:30 PM IST
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="niftyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" axisLine={false} tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9, fontFamily: "JetBrains Mono" }} minTickGap={40} />
              <YAxis domain={[minV - pad, maxV + pad]} axisLine={false} tickLine={false} orientation="right"
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9, fontFamily: "JetBrains Mono" }}
                tickFormatter={v => v.toFixed(0)} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(224,40%,9%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 11 }}
                formatter={(v: number) => [`₹${fmt(v)}`, "Price"]}
                labelFormatter={l => period === "1D" ? `Time: ${l}` : `Date: ${l}`} />
              <Area type="monotone" dataKey="val" stroke={color} strokeWidth={1.5}
                fill="url(#niftyGrad)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ── Global Index Card (NYSE / Shanghai / Hang Seng / Gift Nifty) ─────────
const GLOBAL_INDEX_CONFIG: Record<string, {
  label: string; exchange: string; color: string;
  badge: string; numFmt: (n: number) => string;
}> = {
  "^NSEI":      { label: "Gift Nifty",       exchange: "NSE IFSC", color: "#f97316", badge: "bg-orange-500/15 text-orange-400 border-orange-500/30",   numFmt: (n) => "₹" + fmt(n, 2) },
  "^NYA":       { label: "NYSE Composite",   exchange: "XNYS",     color: "#3b82f6", badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",         numFmt: (n) => fmt(n, 2) },
  "000001.SS":  { label: "Shanghai Comp.",   exchange: "XSHG",     color: "#ef4444", badge: "bg-red-500/15 text-red-400 border-red-500/30",            numFmt: (n) => fmt(n, 2) },
  "^HSI":       { label: "Hang Seng Index",  exchange: "XHKG",     color: "#a855f7", badge: "bg-purple-500/15 text-purple-400 border-purple-500/30",   numFmt: (n) => fmt(n, 2) },
};

function GlobalIndexCard({ ticker }: { ticker: string }) {
  const cfg   = GLOBAL_INDEX_CONFIG[ticker];
  const color = cfg?.color ?? "#10b981";
  const [period, setPeriod] = useState<"1M" | "3M">("3M");

  const { data: quote } = useGetGlobalIndexQuote(
    { ticker },
    { query: { refetchInterval: 120_000 } },
  );
  const { data: hist } = useGetGlobalIndexHistory(
    { ticker, period },
    { query: { refetchInterval: 180_000 } },
  );

  const chartData = (hist?.data ?? []).map((p: { close: number; timestamp: string }) => ({
    val:   p.close,
    label: format(new Date(p.timestamp), "dd MMM"),
  }));

  const vals = chartData.map((d) => d.val).filter(Boolean);
  const minV = vals.length ? Math.min(...vals) : 0;
  const maxV = vals.length ? Math.max(...vals) : 0;
  const pad  = Math.max((maxV - minV) * 0.06, 10);
  const isPos = (quote?.changePercent ?? 0) >= 0;
  const lineColor = isPos ? color : "#ef4444";

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-y-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", cfg?.badge ?? "bg-muted/30 text-muted-foreground border-border")}>
            {cfg?.exchange ?? ticker}
          </span>
          <span className="text-xs font-bold">{cfg?.label ?? ticker}</span>
          {quote && <ChangeChip v={quote.changePercent} />}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold font-mono">
            {quote ? (cfg?.numFmt ?? fmt)(quote.price) : "—"}
          </span>
          <div className="flex bg-background/60 rounded-lg p-0.5 border border-border">
            {(["1M", "3M"] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={cn("px-1.5 py-0.5 text-[10px] font-mono rounded-md transition-all",
                  period === p ? "bg-primary text-white font-bold" : "text-muted-foreground hover:text-foreground")}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="h-28">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <Skeleton className="w-full h-full" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={lineColor} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" axisLine={false} tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 8, fontFamily: "JetBrains Mono" }} minTickGap={40} />
              <YAxis domain={[minV - pad, maxV + pad]} axisLine={false} tickLine={false} orientation="right"
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 8, fontFamily: "JetBrains Mono" }}
                tickFormatter={(v) => v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(0)} width={36} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(224,40%,9%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 10 }}
                formatter={(v: number) => [(cfg?.numFmt ?? fmt)(v), cfg?.label ?? ticker]}
                labelFormatter={(l) => `Date: ${l}`} />
              <Area type="monotone" dataKey="val" stroke={lineColor} strokeWidth={1.5}
                fill={`url(#grad-${ticker})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-1 text-right">
        <span className={cn("text-[9px] font-bold border rounded px-1 py-0.5", DATA_SOURCE_BADGE.yahoo.cls)}>
          Yahoo ~15m
        </span>
      </div>
    </div>
  );
}

// ── NSE Movers (compact) ──────────────────────────────────────────────────
function MoversCompact() {
  const { data: movers } = useGetNseMovers({ query: { refetchInterval: 90000 } });
  const [tab, setTab] = useState<"gainers" | "losers">("gainers");
  const rows = tab === "gainers" ? (movers?.gainers ?? []) : (movers?.losers ?? []);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Market Movers</h3>
        <div className="flex bg-background/60 rounded-lg p-0.5 border border-border">
          <button onClick={() => setTab("gainers")}
            className={cn("px-2 py-0.5 text-xs font-mono rounded-md transition-all",
              tab === "gainers" ? "bg-emerald-600 text-white font-bold" : "text-muted-foreground")}>
            ▲ Gainers
          </button>
          <button onClick={() => setTab("losers")}
            className={cn("px-2 py-0.5 text-xs font-mono rounded-md transition-all",
              tab === "losers" ? "bg-red-600 text-white font-bold" : "text-muted-foreground")}>
            ▼ Losers
          </button>
        </div>
      </div>
      <div className="space-y-1">
        {rows.slice(0, 6).map((s: { symbol: string; price: number; changePercent: number }) => (
          <div key={s.symbol} className="flex items-center justify-between py-1 border-b border-border/20 last:border-0">
            <span className="text-xs font-bold">{s.symbol}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-muted-foreground">{fmtINR(s.price)}</span>
              <ChangeChip v={s.changePercent} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sectors (compact) ─────────────────────────────────────────────────────
function SectorsCompact() {
  const { data: sectors } = useGetNseSectors({ query: { refetchInterval: 30000 } });
  const rows = (sectors ?? []) as { sector: string; value: number; changePercent: number }[];

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Sector Performance</h3>
      <div className="space-y-1.5">
        {rows.map((s) => (
          <div key={s.sector} className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-muted-foreground w-24 shrink-0">{s.sector}</span>
            <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", s.changePercent >= 0 ? "bg-emerald-500" : "bg-red-500")}
                style={{ width: `${Math.min(Math.abs(s.changePercent) * 15, 100)}%` }} />
            </div>
            <span className={cn("text-[10px] font-mono font-bold w-12 text-right", s.changePercent >= 0 ? "text-emerald-400" : "text-red-400")}>
              {s.changePercent >= 0 ? "+" : ""}{s.changePercent?.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Home ─────────────────────────────────────────────────────────────
export function Home() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("trader");
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [spinning, setSpinning] = useState(false);
  const { data: upstoxSettings } = useGetUpstoxSettings({ query: {} });

  const { data: panel, isLoading: panelLoading } = useGetDecisionPanel({
    query: { refetchInterval: 60000 },
  });

  const upstoxLive = upstoxSettings?.connected && upstoxSettings?.hasAccessToken;

  const handleRefresh = useCallback(async () => {
    setSpinning(true);
    await qc.invalidateQueries();
    setLastRefreshed(new Date());
    setTimeout(() => setSpinning(false), 800);
  }, [qc]);

  const timeStr = lastRefreshed.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Kolkata",
  });

  return (
    <div className="space-y-4">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-1">
        <div className="flex items-center gap-3 flex-wrap">
          <ModeToggle mode={mode} setMode={setMode} />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={`w-2 h-2 rounded-full animate-pulse ${upstoxLive ? "bg-violet-400" : "bg-blue-400"}`} />
            {upstoxLive
              ? <span>via <span className="text-violet-400 font-semibold">Upstox</span></span>
              : <span>Indices via <span className="text-blue-400 font-semibold">NSE India</span> (real-time)</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
            <Clock className="w-3 h-3" /> {timeStr} IST
          </span>
          <button onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary text-xs font-bold transition-all">
            <RefreshCw className={cn("w-3 h-3", spinning && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── 1. Decision Engine ── */}
      <DecisionHero panel={panel} mode={mode} />

      {/* ── 2. Key Levels ── */}
      <KeyLevelsPanel panel={panel} mode={mode} />

      {/* ── 3. Market Pressure + Money Flow ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MarketPressureCard panel={panel} mode={mode} />
        <MoneyFlowCard panel={panel} mode={mode} />
      </div>

      {/* ── 4. Signals Table ── */}
      <SignalsTable panel={panel} mode={mode} />

      {/* ── 5. Alert System ── */}
      <AlertSystem mode={mode} />

      {/* ── 6. Nifty Chart + Movers + Sectors ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GiftNiftyCard />
        <div className="space-y-4">
          <MoversCompact />
          <SectorsCompact />
        </div>
      </div>

      {/* ── 7. Global Index Charts ── */}
      <div className="flex items-center gap-2 px-1 pt-2">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Global Markets</span>
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", DATA_SOURCE_BADGE.yahoo.cls)}>Yahoo ~15m</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GlobalIndexCard ticker="^NSEI" />
        <GlobalIndexCard ticker="^NYA" />
        <GlobalIndexCard ticker="000001.SS" />
        <GlobalIndexCard ticker="^HSI" />
      </div>
    </div>
  );
}
