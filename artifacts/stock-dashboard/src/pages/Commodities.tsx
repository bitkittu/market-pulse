import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCommodities,
  useGetCommodityHistory,
} from "@workspace/api-client-react";
import type { CommodityItem } from "@workspace/api-client-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import {
  RefreshCw, TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronUp, Clock, Info,
} from "lucide-react";

// ── Utils ─────────────────────────────────────────────────────────────────
function cn(...c: (string | false | undefined | null)[]) { return c.filter(Boolean).join(" "); }
function fmt(n: number, dec = 2) {
  if (n >= 1000) return n.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return n.toFixed(dec);
}

// ── Prediction styles ─────────────────────────────────────────────────────
const PRED = {
  BULLISH: {
    badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    bar:   "bg-emerald-500",
    glow:  "shadow-emerald-500/10",
    border:"border-emerald-500/20",
    icon:  TrendingUp,
    label: "BULLISH",
  },
  BEARISH: {
    badge: "bg-red-500/20 text-red-400 border-red-500/40",
    bar:   "bg-red-500",
    glow:  "shadow-red-500/10",
    border:"border-red-500/20",
    icon:  TrendingDown,
    label: "BEARISH",
  },
  NEUTRAL: {
    badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
    bar:   "bg-yellow-500",
    glow:  "shadow-yellow-500/10",
    border:"border-yellow-500/20",
    icon:  Minus,
    label: "NEUTRAL",
  },
};

const CAT_COLORS: Record<string, string> = {
  "Precious Metals": "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  "Energy":          "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "Base Metals":     "bg-blue-500/15  text-blue-400  border-blue-500/30",
  "Agriculture":     "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const CATEGORIES = ["All", "Precious Metals", "Energy", "Base Metals", "Agriculture"];

// ── Sparkline (10-point inline) ───────────────────────────────────────────
function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data.length) return <div className="h-8 w-full bg-muted/20 rounded" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((v - min) / range) * 100;
    return `${x},${y}`;
  });
  const color = positive ? "#10b981" : "#ef4444";
  return (
    <svg viewBox="0 0 100 40" className="w-full h-8" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${positive}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2"
        vectorEffect="non-scaling-stroke" />
      <polygon points={`0,100 ${pts.join(" ")} 100,100`}
        fill={`url(#sg-${positive})`} />
    </svg>
  );
}

// ── Money Flow Bar ────────────────────────────────────────────────────────
function MoneyFlowBar({ buyPressure, size = "sm" }: { buyPressure: number; size?: "sm" | "lg" }) {
  const sell = 100 - buyPressure;
  const bullish = buyPressure > 55;
  const bearish = buyPressure < 45;
  return (
    <div className={size === "lg" ? "space-y-1.5" : "space-y-0.5"}>
      {size === "lg" && (
        <div className="flex justify-between text-xs font-bold">
          <span className="text-emerald-400">Buyers {buyPressure}%</span>
          <span className="text-red-400">Sellers {sell}%</span>
        </div>
      )}
      <div className={cn("rounded-full overflow-hidden bg-red-500/25", size === "lg" ? "h-3" : "h-1.5")}>
        <div
          className={cn("h-full rounded-full transition-all",
            bullish ? "bg-emerald-500" : bearish ? "bg-red-500" : "bg-yellow-500")}
          style={{ width: `${buyPressure}%` }}
        />
      </div>
      {size === "sm" && (
        <div className="flex justify-between">
          <span className="text-[9px] text-emerald-400 font-mono">{buyPressure}%</span>
          <span className="text-[9px] text-red-400 font-mono">{sell}%</span>
        </div>
      )}
    </div>
  );
}

// ── Detail Chart ──────────────────────────────────────────────────────────
function DetailChart({ commodity }: { commodity: CommodityItem }) {
  const [period, setPeriod] = useState<"1M" | "3M" | "6M">("3M");
  const { data: hist, isLoading } = useGetCommodityHistory(
    { symbol: commodity.symbol, period },
    { query: { refetchInterval: 300_000 } }
  );

  const chartData = (hist?.data ?? []).map((p: { close: number; timestamp: string }) => ({
    val:   p.close,
    label: format(new Date(p.timestamp), "dd MMM"),
  }));

  const vals  = chartData.map((d) => d.val).filter(Boolean);
  const minV  = vals.length ? Math.min(...vals) : 0;
  const maxV  = vals.length ? Math.max(...vals) : 0;
  const pad   = Math.max((maxV - minV) * 0.06, 1);
  const isPos = (commodity.changePercent ?? 0) >= 0;
  const color = isPos ? "#10b981" : "#ef4444";
  const pred  = PRED[commodity.prediction.signal];

  return (
    <div className="bg-card border border-border rounded-xl p-5 mt-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{commodity.emoji}</span>
            <h2 className="text-lg font-bold">{commodity.name}</h2>
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", CAT_COLORS[commodity.category])}>
              {commodity.category}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-black font-mono">
              {commodity.currency === "USD" ? "$" : ""}{fmt(commodity.price, commodity.price >= 100 ? 2 : 4)}
              <span className="text-sm text-muted-foreground font-normal ml-1">{commodity.unit}</span>
            </span>
            <span className={cn("text-sm font-bold", isPos ? "text-emerald-400" : "text-red-400")}>
              {isPos ? "+" : ""}{commodity.changePercent.toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-background/60 rounded-lg p-0.5 border border-border">
            {(["1M","3M","6M"] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={cn("px-2.5 py-1 text-xs font-mono rounded-md transition-all",
                  period === p ? "bg-primary text-white font-bold" : "text-muted-foreground hover:text-foreground")}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-52 mb-4">
        {isLoading ? (
          <div className="h-full bg-muted/20 rounded-xl animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="detailGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" axisLine={false} tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "JetBrains Mono" }} minTickGap={45} />
              <YAxis domain={[minV - pad, maxV + pad]} axisLine={false} tickLine={false} orientation="right" width={55}
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                tickFormatter={(v) => (v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(1))} />
              <ReferenceLine y={commodity.prevClose} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(224,40%,9%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 11 }}
                formatter={(v: number) => [`$${fmt(v)}`, commodity.name]}
                labelFormatter={(l) => `Date: ${l}`} />
              <Area type="monotone" dataKey="val" stroke={color} strokeWidth={2}
                fill="url(#detailGrad)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Prediction */}
        <div className={cn("bg-background/50 border rounded-xl p-3", pred.border)}>
          <p className="text-[10px] text-muted-foreground font-bold tracking-widest mb-1">PREDICTION</p>
          <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-black", pred.badge)}>
            <pred.icon className="w-3 h-3" />
            {pred.label}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Confidence: {commodity.prediction.confidence}%</p>
        </div>

        {/* Money flow */}
        <div className="bg-background/50 border border-border rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground font-bold tracking-widest mb-2">MONEY FLOW</p>
          <MoneyFlowBar buyPressure={commodity.prediction.buyPressure} size="lg" />
        </div>

        {/* Momentum */}
        <div className="bg-background/50 border border-border rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground font-bold tracking-widest mb-1">5-DAY MOMENTUM</p>
          <p className={cn("text-xl font-black font-mono",
            commodity.prediction.momentum >= 0 ? "text-emerald-400" : "text-red-400")}>
            {commodity.prediction.momentum >= 0 ? "+" : ""}{commodity.prediction.momentum}%
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">vs 5 sessions ago</p>
        </div>

        {/* Day range */}
        <div className="bg-background/50 border border-border rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground font-bold tracking-widest mb-1">DAY RANGE</p>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-red-400">L {fmt(commodity.dayLow)}</span>
              <span className="text-emerald-400">H {fmt(commodity.dayHigh)}</span>
            </div>
            <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 rounded-full" />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>Prev: {fmt(commodity.prevClose)}</span>
              <span>Cur: {fmt(commodity.price)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Commodity Card ────────────────────────────────────────────────────────
function CommodityCard({
  commodity,
  selected,
  onSelect,
}: {
  commodity: CommodityItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const isPos = commodity.changePercent >= 0;
  const pred  = PRED[commodity.prediction.signal];
  const PredIcon = pred.icon;

  return (
    <div
      onClick={onSelect}
      className={cn(
        "bg-card border rounded-xl p-4 cursor-pointer transition-all hover:border-primary/40 shadow",
        selected ? "border-primary/60 bg-primary/5 shadow-primary/10" : "border-border hover:shadow-md",
        pred.glow
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{commodity.emoji}</span>
          <div>
            <p className="text-sm font-bold leading-tight">{commodity.name}</p>
            <span className={cn("text-[9px] font-bold px-1 py-0.5 rounded border", CAT_COLORS[commodity.category])}>
              {commodity.category}
            </span>
          </div>
        </div>
        <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-black", pred.badge)}>
          <PredIcon className="w-2.5 h-2.5" />
          {pred.label}
        </div>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-xl font-black font-mono text-foreground">
          {commodity.currency === "USD" ? "$" : ""}
          {fmt(commodity.price, commodity.price >= 100 ? 2 : 4)}
        </span>
        <span className="text-[10px] text-muted-foreground">{commodity.unit}</span>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className={cn("text-xs font-bold font-mono", isPos ? "text-emerald-400" : "text-red-400")}>
          {isPos ? "▲" : "▼"} {isPos ? "+" : ""}{commodity.changePercent.toFixed(2)}%
        </span>
        <span className={cn("text-xs font-mono text-muted-foreground")}>
          {isPos ? "+" : ""}{commodity.change.toFixed(3)}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">
          5d: <span className={commodity.prediction.momentum >= 0 ? "text-emerald-400" : "text-red-400"}>
            {commodity.prediction.momentum >= 0 ? "+" : ""}{commodity.prediction.momentum}%
          </span>
        </span>
      </div>

      {/* Sparkline */}
      <div className="mb-2">
        <Sparkline data={commodity.sparkline} positive={isPos} />
      </div>

      {/* Money flow */}
      <MoneyFlowBar buyPressure={commodity.prediction.buyPressure} size="sm" />

      {/* Confidence */}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 h-1 bg-muted/40 rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full", pred.bar)} style={{ width: `${commodity.prediction.confidence}%` }} />
        </div>
        <span className="text-[9px] font-mono text-muted-foreground">{commodity.prediction.confidence}% conf</span>
      </div>

      {/* Expand hint */}
      <div className="mt-2 flex items-center justify-center text-[9px] text-muted-foreground/50 gap-0.5">
        {selected ? <><ChevronUp className="w-2.5 h-2.5" /> less</> : <><ChevronDown className="w-2.5 h-2.5" /> chart & analysis</>}
      </div>
    </div>
  );
}

// ── Summary banner ────────────────────────────────────────────────────────
function SummaryBanner({ items }: { items: CommodityItem[] }) {
  const bull = items.filter((c) => c.prediction.signal === "BULLISH").length;
  const bear = items.filter((c) => c.prediction.signal === "BEARISH").length;
  const neut = items.filter((c) => c.prediction.signal === "NEUTRAL").length;
  const total = items.length || 1;
  const overall = bull > bear ? "BULLISH" : bear > bull ? "BEARISH" : "NEUTRAL";
  const pred = PRED[overall];
  const OverallIcon = pred.icon;

  return (
    <div className="bg-card border border-border rounded-xl px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Overall */}
        <div className="flex items-center gap-3">
          <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-black", pred.badge)}>
            <OverallIcon className="w-4 h-4" />
            OVERALL {pred.label}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Info className="w-3 h-3" />
            Based on momentum + RSI + range position
          </div>
        </div>
        {/* Counts */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-xl font-black text-emerald-400">{bull}</p>
            <p className="text-[10px] text-muted-foreground font-bold">Bullish</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-yellow-400">{neut}</p>
            <p className="text-[10px] text-muted-foreground font-bold">Neutral</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-red-400">{bear}</p>
            <p className="text-[10px] text-muted-foreground font-bold">Bearish</p>
          </div>
          {/* Ratio bar */}
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="h-3 rounded-full overflow-hidden bg-red-500/30 flex w-32">
              <div className="bg-emerald-500"   style={{ width: `${(bull / total) * 100}%` }} />
              <div className="bg-yellow-500"    style={{ width: `${(neut / total) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Money Flow Chart (all commodities overview) ───────────────────────────
function MoneyFlowChart({ items }: { items: CommodityItem[] }) {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => b.prediction.buyPressure - a.prediction.buyPressure);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary" />
        Money Flow Analysis — All Commodities
      </h3>
      <div className="space-y-2.5">
        {sorted.map((c) => {
          const bp = c.prediction.buyPressure;
          const barColor = bp > 55 ? "bg-emerald-500" : bp < 45 ? "bg-red-500" : "bg-yellow-500";
          return (
            <div key={c.symbol} className="flex items-center gap-3">
              <span className="text-base w-6">{c.emoji}</span>
              <span className="text-xs font-medium text-muted-foreground w-28 truncate">{c.name}</span>
              <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${bp}%` }} />
              </div>
              <span className={cn("text-[10px] font-mono font-bold w-8 text-right",
                bp > 55 ? "text-emerald-400" : bp < 45 ? "text-red-400" : "text-yellow-400")}>
                {bp}%
              </span>
              <span className={cn("text-[10px] font-mono w-14 text-right",
                c.changePercent >= 0 ? "text-emerald-400" : "text-red-400")}>
                {c.changePercent >= 0 ? "+" : ""}{c.changePercent.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Movement Prediction Table ─────────────────────────────────────────────
function PredictionTable({ items }: { items: CommodityItem[] }) {
  if (!items.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <h3 className="text-sm font-bold">Movement Predictions</h3>
        <span className="text-[10px] text-muted-foreground ml-2">Momentum · RSI · 20-day range position</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/60 text-muted-foreground">
              <th className="text-left px-4 py-2 font-semibold">Commodity</th>
              <th className="text-center px-3 py-2 font-semibold">Signal</th>
              <th className="text-right px-3 py-2 font-semibold">Price</th>
              <th className="text-right px-3 py-2 font-semibold">5d Momentum</th>
              <th className="text-right px-3 py-2 font-semibold">Buy Pressure</th>
              <th className="text-right px-4 py-2 font-semibold">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => {
              const pred = PRED[c.prediction.signal];
              const PredIcon = pred.icon;
              const isPos = c.changePercent >= 0;
              return (
                <tr key={c.symbol} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{c.emoji}</span>
                      <div>
                        <p className="font-bold text-foreground">{c.name}</p>
                        <p className="text-muted-foreground text-[9px]">{c.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-black", pred.badge)}>
                      <PredIcon className="w-2.5 h-2.5" /> {pred.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <p className="font-mono font-bold">${fmt(c.price, c.price >= 100 ? 2 : 4)}</p>
                    <p className={cn("text-[10px] font-mono", isPos ? "text-emerald-400" : "text-red-400")}>
                      {isPos ? "+" : ""}{c.changePercent.toFixed(2)}%
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={cn("font-mono font-bold", c.prediction.momentum >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {c.prediction.momentum >= 0 ? "+" : ""}{c.prediction.momentum}%
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-16 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full",
                          c.prediction.buyPressure > 55 ? "bg-emerald-500" : c.prediction.buyPressure < 45 ? "bg-red-500" : "bg-yellow-500")}
                          style={{ width: `${c.prediction.buyPressure}%` }} />
                      </div>
                      <span className="font-mono font-bold w-8 text-right">{c.prediction.buyPressure}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-12 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", pred.bar)}
                          style={{ width: `${c.prediction.confidence}%` }} />
                      </div>
                      <span className="font-mono font-bold">{c.prediction.confidence}%</span>
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

// ── Main Page ─────────────────────────────────────────────────────────────
export function Commodities() {
  const qc = useQueryClient();
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const { data, isLoading } = useGetCommodities({
    query: { refetchInterval: 90_000 },
  });

  const items: CommodityItem[] = data?.commodities ?? [];

  const filtered = category === "All"
    ? items
    : items.filter((c) => c.category === category);

  const selectedItem = items.find((c) => c.symbol === selected) ?? null;

  const handleRefresh = useCallback(async () => {
    setSpinning(true);
    await qc.invalidateQueries();
    setLastRefresh(new Date());
    setTimeout(() => setSpinning(false), 800);
  }, [qc]);

  const timeStr = lastRefresh.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, timeZone: "Asia/Kolkata",
  });

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black">Commodities</h1>
          <p className="text-xs text-muted-foreground">Global futures · Yahoo Finance (~15m delay) · Predictions via momentum + RSI</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> {timeStr} IST
          </span>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/80 transition-all shadow"
          >
            <RefreshCw className={cn("w-4 h-4", spinning && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Summary banner ── */}
      {isLoading ? (
        <div className="h-16 bg-card border border-border rounded-xl animate-pulse" />
      ) : (
        <SummaryBanner items={items} />
      )}

      {/* ── Category tabs ── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button key={cat} onClick={() => setCategory(cat)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
              category === cat
                ? "bg-primary text-white border-primary shadow"
                : "bg-background/50 text-muted-foreground border-border hover:text-foreground hover:border-primary/30")}>
            {cat}
            {cat !== "All" && (
              <span className="ml-1.5 opacity-60">
                {items.filter((c) => c.category === cat).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Card grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-52 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((c) => (
            <div key={c.symbol}>
              <CommodityCard
                commodity={c}
                selected={selected === c.symbol}
                onSelect={() => setSelected(selected === c.symbol ? null : c.symbol)}
              />
              {/* Inline detail chart below selected card (mobile/small screens) */}
              {selected === c.symbol && <DetailChart commodity={c} />}
            </div>
          ))}
        </div>
      )}

      {/* ── Detail chart (desktop: below grid) ── */}
      {selectedItem && !isLoading && (
        <div className="hidden xl:block">
          {/* Already shown inline above on smaller grids; shown here on XL layout */}
        </div>
      )}

      {/* ── Money Flow Analysis ── */}
      {!isLoading && items.length > 0 && (
        <MoneyFlowChart items={filtered.length ? filtered : items} />
      )}

      {/* ── Prediction Table ── */}
      {!isLoading && items.length > 0 && (
        <PredictionTable items={filtered.length ? filtered : items} />
      )}
    </div>
  );
}
