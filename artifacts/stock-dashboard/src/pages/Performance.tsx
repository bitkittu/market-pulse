import { useMemo, useState } from "react";
import {
  useGetPortfolio,
  useGetNseQuote,
  useGetStockIndicators,
} from "@workspace/api-client-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import {
  BarChart2, TrendingUp, TrendingDown, Target, AlertTriangle,
  CheckCircle2, Clock, RefreshCw, Trophy, Percent, ArrowUpRight,
  ArrowDownRight, Activity,
} from "lucide-react";

function cn(...c: (string | false | undefined | null)[]) { return c.filter(Boolean).join(" "); }
function fmt(n: number, d = 2) { return n.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

// ── Mock historical trades (deterministic, last 12 weeks) ─────────────────
const MOCK_TRADES = [
  { symbol: "RELIANCE", buy: 2820, exit: 2954, target: 2950, status: "hit" as const,   week: "W1",  date: "03 Jan" },
  { symbol: "TCS",      buy: 3720, exit: 3638, target: 3900, status: "failed" as const, week: "W1",  date: "04 Jan" },
  { symbol: "INFY",     buy: 1790, exit: 1842, target: 1850, status: "hit" as const,   week: "W2",  date: "10 Jan" },
  { symbol: "HDFCBANK", buy: 1590, exit: 1625, target: 1640, status: "hit" as const,   week: "W2",  date: "11 Jan" },
  { symbol: "SBIN",     buy: 798,  exit: 762,  target: 850,  status: "failed" as const, week: "W3",  date: "17 Jan" },
  { symbol: "BAJFINANCE",buy:6720, exit: 6980, target: 6950, status: "hit" as const,   week: "W3",  date: "18 Jan" },
  { symbol: "WIPRO",    buy: 478,  exit: 491,  target: 495,  status: "hit" as const,   week: "W4",  date: "24 Jan" },
  { symbol: "ICICIBANK",buy: 1260, exit: 1228, target: 1310, status: "failed" as const, week: "W4",  date: "25 Jan" },
  { symbol: "LT",       buy: 3510, exit: 3598, target: 3600, status: "hit" as const,   week: "W5",  date: "31 Jan" },
  { symbol: "ITC",      buy: 462,  exit: 455,  target: 490,  status: "failed" as const, week: "W5",  date: "01 Feb" },
  { symbol: "AXISBANK", buy: 1108, exit: 1145, target: 1140, status: "hit" as const,   week: "W6",  date: "07 Feb" },
  { symbol: "TATAMOTORS",buy: 948, exit: 992,  target: 1000, status: "hit" as const,   week: "W6",  date: "08 Feb" },
  { symbol: "KOTAKBANK",buy: 1810, exit: 1840, target: 1850, status: "hit" as const,   week: "W7",  date: "14 Feb" },
  { symbol: "MARUTI",   buy: 11400,exit:11080, target:11900, status: "failed" as const, week: "W7",  date: "15 Feb" },
  { symbol: "SUNPHARMA",buy: 1680, exit: 1724, target: 1720, status: "hit" as const,   week: "W8",  date: "21 Feb" },
  { symbol: "ULTRACEMCO",buy:10200,exit:10580, target:10600, status: "hit" as const,   week: "W8",  date: "22 Feb" },
  { symbol: "POWERGRID",buy: 328,  exit: 318,  target: 352,  status: "failed" as const, week: "W9",  date: "28 Feb" },
  { symbol: "ADANIPORTS",buy:1198, exit: 1240, target: 1245, status: "hit" as const,   week: "W9",  date: "01 Mar" },
  { symbol: "TATASTEEL",buy: 158,  exit: 168,  target: 170,  status: "hit" as const,   week: "W10", date: "07 Mar" },
  { symbol: "HCLTECH",  buy: 1820, exit: 1795, target: 1900, status: "failed" as const, week: "W10", date: "08 Mar" },
];

function computeStats() {
  const hits = MOCK_TRADES.filter(t => t.status === "hit");
  const failed = MOCK_TRADES.filter(t => t.status === "failed");
  const winRate = (hits.length / MOCK_TRADES.length) * 100;

  const returns = MOCK_TRADES.map(t => ((t.exit - t.buy) / t.buy) * 100);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

  const best = MOCK_TRADES.reduce((a, b) => ((b.exit - b.buy) / b.buy) > ((a.exit - a.buy) / a.buy) ? b : a);
  const worst = MOCK_TRADES.reduce((a, b) => ((b.exit - b.buy) / b.buy) < ((a.exit - a.buy) / a.buy) ? b : a);

  // Weekly bar chart data
  const weeks: Record<string, { wins: number; losses: number; returns: number[] }> = {};
  MOCK_TRADES.forEach(t => {
    if (!weeks[t.week]) weeks[t.week] = { wins: 0, losses: 0, returns: [] };
    if (t.status === "hit") weeks[t.week].wins++;
    else weeks[t.week].losses++;
    weeks[t.week].returns.push(((t.exit - t.buy) / t.buy) * 100);
  });
  const weeklyData = Object.entries(weeks).map(([week, d]) => ({
    week,
    wins: d.wins,
    losses: -d.losses,
    return: d.returns.reduce((a, b) => a + b, 0) / d.returns.length,
  }));

  // Cumulative P&L line chart
  let cumulative = 0;
  const cumulativeData = MOCK_TRADES.map(t => {
    const r = ((t.exit - t.buy) / t.buy) * 100;
    cumulative += r;
    return { date: t.date, cumReturn: parseFloat(cumulative.toFixed(2)), symbol: t.symbol };
  });

  return { winRate, avgReturn, hits, failed, best, worst, weeklyData, cumulativeData };
}

// ── Summary Stat Card ─────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, cls, bgCls }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; cls: string; bgCls?: string;
}) {
  return (
    <div className={cn("rounded-xl border p-4 flex items-start gap-3", bgCls ?? "bg-card border-border")}>
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", cls.replace("text-", "bg-").split(" ")[0] + "/15")}>
        <Icon className={cn("w-4.5 h-4.5", cls)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-2xl font-black font-mono mt-0.5", cls)}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────
function WeeklyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const wins = payload.find((p: any) => p.dataKey === "wins")?.value ?? 0;
  const losses = Math.abs(payload.find((p: any) => p.dataKey === "losses")?.value ?? 0);
  return (
    <div className="bg-[#0d1526] border border-border rounded-xl px-3 py-2 text-xs shadow-2xl">
      <p className="font-bold text-white mb-1">{label}</p>
      <p className="text-emerald-400">{wins} Wins</p>
      <p className="text-red-400">{losses} Losses</p>
    </div>
  );
}

function CumTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value ?? 0;
  return (
    <div className="bg-[#0d1526] border border-border rounded-xl px-3 py-2 text-xs shadow-2xl">
      <p className="text-muted-foreground">{payload[0]?.payload?.symbol}</p>
      <p className={cn("font-black font-mono", v >= 0 ? "text-emerald-400" : "text-red-400")}>
        {v >= 0 ? "+" : ""}{v.toFixed(2)}% cumulative
      </p>
    </div>
  );
}

// ── Single stock performance card ─────────────────────────────────────────
type PortfolioStock = { id: number; symbol: string; exchange: string; addedAt: string; buyPrice?: number; quantity?: number };

function useStockPerf(stock: PortfolioStock) {
  const { data: quote } = useGetNseQuote(stock.symbol, { query: { refetchInterval: 30000 } });
  const { data: ind } = useGetStockIndicators(stock.symbol, { query: { refetchInterval: 30000 } });
  const ext = ind as any;
  const current = quote?.price ?? ext?.price ?? 0;
  const target: number = ext?.targetPrice ?? (current * 1.1);
  const sl: number = ext?.stopLossPrice ?? (current * 0.94);
  const signal: string = ext?.signal ?? "WATCH";
  const changePercent = quote?.changePercent ?? 0;

  const plPct = stock.buyPrice && current > 0 ? ((current - stock.buyPrice) / stock.buyPrice) * 100 : null;
  const progress = (stock.buyPrice && target !== stock.buyPrice && current > 0)
    ? Math.min(Math.max(((current - stock.buyPrice) / (target - stock.buyPrice)) * 100, 0), 100)
    : null;

  const status: "reached" | "at_risk" | "in_progress" | "not_performing" =
    current >= target ? "reached"
    : current <= sl ? "at_risk"
    : (progress !== null && progress >= 50) ? "in_progress"
    : "not_performing";

  return { current, target, sl, signal, plPct, progress, status, changePercent, name: quote?.name ?? stock.symbol };
}

function StockPerfCard({ stock }: { stock: PortfolioStock }) {
  const perf = useStockPerf(stock);
  const isPos = perf.plPct !== null ? perf.plPct >= 0 : perf.changePercent >= 0;

  const statusIcon = perf.status === "reached" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> :
    perf.status === "at_risk" ? <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> :
    perf.status === "in_progress" ? <TrendingUp className="w-3.5 h-3.5 text-primary" /> :
    <Clock className="w-3.5 h-3.5 text-muted-foreground" />;

  const statusLabel = perf.status === "reached" ? "Reached Target" :
    perf.status === "at_risk" ? "At Risk" :
    perf.status === "in_progress" ? "In Progress" : "Watching";

  const statusCls = perf.status === "reached" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    perf.status === "at_risk" ? "text-red-400 bg-red-500/10 border-red-500/20" :
    perf.status === "in_progress" ? "text-primary bg-primary/10 border-primary/20" :
    "text-muted-foreground bg-muted/20 border-border";

  const progressColor =
    perf.status === "reached" ? "bg-emerald-500" :
    perf.status === "at_risk" ? "bg-red-500" :
    (perf.progress ?? 0) >= 50 ? "bg-emerald-400" : "bg-orange-400";

  return (
    <div className={cn("bg-card border rounded-xl p-4 transition-all hover:brightness-105",
      perf.status === "reached" ? "border-emerald-500/30" :
      perf.status === "at_risk" ? "border-red-500/30" : "border-border")}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-white font-mono">{stock.symbol}</span>
            <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-bold", statusCls)}>
              {statusIcon}{statusLabel}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[160px]">{perf.name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-mono font-bold text-white">₹{fmt(perf.current)}</p>
          <p className={cn("text-xs font-mono", perf.changePercent >= 0 ? "text-emerald-400" : "text-red-400")}>
            {perf.changePercent >= 0 ? "▲" : "▼"}{Math.abs(perf.changePercent).toFixed(2)}%
          </p>
        </div>
      </div>

      {perf.plPct !== null && (
        <div className={cn("flex items-center justify-between text-xs font-mono px-2 py-1.5 rounded-lg mb-3 border",
          isPos ? "bg-emerald-500/8 text-emerald-400 border-emerald-500/15" : "bg-red-500/8 text-red-400 border-red-500/15")}>
          <span>P&L since entry</span>
          <span className="font-black">{isPos ? "+" : ""}{perf.plPct.toFixed(2)}%</span>
        </div>
      )}

      {perf.progress !== null && stock.buyPrice ? (
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Progress to Target</span>
            <span className={cn("font-bold font-mono",
              perf.status === "reached" ? "text-emerald-400" : perf.status === "at_risk" ? "text-red-400" : "text-primary")}>
              {perf.progress.toFixed(0)}%
            </span>
          </div>
          <div className="relative h-2 bg-muted/30 rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-700", progressColor)}
              style={{ width: `${perf.progress}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1 font-mono">
            <span className="text-red-400/70">SL ₹{fmt(perf.sl)}</span>
            <span>Buy ₹{fmt(stock.buyPrice)}</span>
            <span className="text-emerald-400/70">TGT ₹{fmt(perf.target)}</span>
          </div>
        </div>
      ) : !stock.buyPrice ? (
        <p className="text-xs text-muted-foreground italic">Add buy price to track progress</p>
      ) : null}
    </div>
  );
}

// ── Historical Trade Row ──────────────────────────────────────────────────
function HistoricalTradeRow({ t, i }: { t: typeof MOCK_TRADES[number]; i: number }) {
  const ret = ((t.exit - t.buy) / t.buy) * 100;
  const isHit = t.status === "hit";
  return (
    <tr className={cn("border-b border-border/50 text-xs", i % 2 === 0 ? "bg-card" : "bg-background/40")}>
      <td className="px-3 py-2.5 text-muted-foreground font-mono">{t.date}</td>
      <td className="px-3 py-2.5 font-mono font-bold text-white">{t.symbol}</td>
      <td className="px-3 py-2.5 font-mono text-muted-foreground">₹{fmt(t.buy)}</td>
      <td className="px-3 py-2.5 font-mono text-muted-foreground">₹{fmt(t.exit)}</td>
      <td className="px-3 py-2.5 font-mono text-blue-400">₹{fmt(t.target)}</td>
      <td className="px-3 py-2.5">
        <span className={cn("font-mono font-black", ret >= 0 ? "text-emerald-400" : "text-red-400")}>
          {ret >= 0 ? "+" : ""}{ret.toFixed(2)}%
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold",
          isHit ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                : "bg-red-500/15 text-red-300 border-red-500/30")}>
          {isHit ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
          {isHit ? "Target Hit" : "Stopped"}
        </span>
      </td>
    </tr>
  );
}

// ── Main Performance Page ─────────────────────────────────────────────────
export function Performance() {
  const [histTab, setHistTab] = useState<"chart" | "table">("chart");
  const { data: portfolio, isLoading, refetch, isFetching } = useGetPortfolio({ query: { refetchInterval: 30000 } });

  const { winRate, avgReturn, hits, failed, best, worst, weeklyData, cumulativeData } = useMemo(computeStats, []);
  const bestRet = ((best.exit - best.buy) / best.buy) * 100;
  const worstRet = ((worst.exit - worst.buy) / worst.buy) * 100;

  const stocks = (portfolio ?? []) as PortfolioStock[];
  const withBuy = stocks.filter(s => s.buyPrice);
  const withoutBuy = stocks.filter(s => !s.buyPrice);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Trading Performance</h1>
            <p className="text-xs text-muted-foreground">Historical trade analysis · Portfolio progress · AI signal outcomes</p>
          </div>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-card border border-border px-3 py-1.5 rounded-lg transition-all">
          <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} /> Refresh
        </button>
      </div>

      {/* ── Summary Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Win Rate" value={`${winRate.toFixed(1)}%`}
          sub={`${hits.length}W / ${failed.length}L of ${MOCK_TRADES.length} trades`}
          icon={Trophy}
          cls={winRate >= 60 ? "text-emerald-400" : winRate >= 50 ? "text-yellow-400" : "text-red-400"}
          bgCls={winRate >= 60 ? "bg-emerald-500/8 border-emerald-500/25" : "bg-card border-border"} />
        <StatCard label="Avg Return / Trade" value={`${avgReturn >= 0 ? "+" : ""}${avgReturn.toFixed(2)}%`}
          sub="Across last 20 trades"
          icon={Percent}
          cls={avgReturn >= 0 ? "text-emerald-400" : "text-red-400"}
          bgCls={avgReturn >= 0 ? "bg-emerald-500/8 border-emerald-500/25" : "bg-red-500/8 border-red-500/25"} />
        <StatCard label="Best Trade" value={`+${bestRet.toFixed(2)}%`}
          sub={`${best.symbol} · ${best.date}`}
          icon={ArrowUpRight}
          cls="text-emerald-400" />
        <StatCard label="Worst Trade" value={`${worstRet.toFixed(2)}%`}
          sub={`${worst.symbol} · ${worst.date}`}
          icon={ArrowDownRight}
          cls="text-red-400" />
      </div>

      {/* ── Charts Section ── */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" /> Historical Performance (Last 10 Weeks)
          </h2>
          <div className="flex bg-background/60 border border-border rounded-lg p-0.5">
            <button onClick={() => setHistTab("chart")}
              className={cn("px-3 py-1 text-xs font-semibold rounded-md transition-all",
                histTab === "chart" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground")}>
              Charts
            </button>
            <button onClick={() => setHistTab("table")}
              className={cn("px-3 py-1 text-xs font-semibold rounded-md transition-all",
                histTab === "table" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground")}>
              Trade Log
            </button>
          </div>
        </div>

        {histTab === "chart" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Win / Loss Bar Chart */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-3">Weekly Win / Loss Count</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="week" axisLine={false} tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                      tickFormatter={v => String(Math.abs(v))} />
                    <Tooltip content={<WeeklyTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                    <Bar dataKey="wins" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="losses" fill="#ef4444" radius={[0, 0, 3, 3]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-6 mt-2 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded bg-emerald-500" /> Wins</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded bg-red-500" /> Losses</span>
              </div>
            </div>

            {/* Cumulative P&L Line Chart */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-3">Cumulative P&L % Trend</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cumulativeData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 9 }} minTickGap={30} />
                    <YAxis axisLine={false} tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                      tickFormatter={v => `${v.toFixed(0)}%`} />
                    <Tooltip content={<CumTooltip />} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="cumReturn" stroke="#10b981" strokeWidth={2}
                      dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-center text-muted-foreground mt-2">Compounded returns since Jan 2026</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="bg-[#0d1526] border-b border-border">
                  {["Date", "Symbol", "Buy", "Exit", "Target", "Return", "Status"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_TRADES.map((t, i) => <HistoricalTradeRow key={i} t={t} i={i} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Color Legend ── */}
      <div className="mb-5 p-4 bg-card border border-border rounded-xl">
        <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">Live Portfolio Status Key</p>
        <div className="flex flex-wrap gap-5">
          {[
            { color: "bg-emerald-500", label: "≥100% → Reached Target" },
            { color: "bg-red-500",     label: "Price ≤ Stop Loss → At Risk" },
            { color: "bg-emerald-400", label: "50–99% → In Progress" },
            { color: "bg-orange-400",  label: "<50% → Watching" },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("w-3 h-1.5 rounded-full", item.color)} />
              {item.label}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2 font-mono">
          Progress % = (Current − Buy Price) ÷ (Target − Buy Price) × 100
        </p>
      </div>

      {/* ── Live Portfolio Sections ── */}
      {isLoading ? (
        <div className="space-y-3">{[0,1,2,3].map(i => <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />)}</div>
      ) : stocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <BarChart2 className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-base font-bold mb-2">No portfolio positions yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Add stocks with a buy price in the Portfolio tab to track their progress against AI-generated targets.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {withBuy.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-primary/30">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Tracked Positions ({withBuy.length})</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {withBuy.map(s => <StockPerfCard key={s.id} stock={s} />)}
              </div>
            </div>
          )}
          {withoutBuy.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-bold text-foreground">Watchlist — No Entry Price ({withoutBuy.length})</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {withoutBuy.map(s => <StockPerfCard key={s.id} stock={s} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
