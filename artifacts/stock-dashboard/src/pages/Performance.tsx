import { useMemo } from "react";
import {
  useGetPortfolio,
  useGetNseQuote,
  useGetStockIndicators,
} from "@workspace/api-client-react";
import { BarChart2, TrendingUp, TrendingDown, Target, AlertTriangle, CheckCircle2, Clock, RefreshCw } from "lucide-react";

function cn(...c: (string | false | undefined | null)[]) { return c.filter(Boolean).join(" "); }
function fmt(n: number, d = 2) { return n.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

// ── Single stock performance ──────────────────────────────────────────────
type PortfolioStock = { id: number; symbol: string; exchange: string; addedAt: string; buyPrice?: number; quantity?: number };

function useStockPerf(stock: PortfolioStock) {
  const { data: quote } = useGetNseQuote(stock.symbol, { query: { refetchInterval: 30000 } });
  const { data: ind } = useGetStockIndicators(stock.symbol, { query: { refetchInterval: 30000 } });
  const ext = ind as any;
  const current = quote?.price ?? ind?.price ?? 0;
  const target: number = ext?.targetPrice ?? (current * 1.1);
  const sl: number = ext?.stopLossPrice ?? (current * 0.94);
  const signal: string = ext?.signal ?? "WATCH";
  const changePercent = quote?.changePercent ?? 0;

  const plPct = stock.buyPrice ? ((current - stock.buyPrice) / stock.buyPrice) * 100 : null;
  const progress = (stock.buyPrice && target !== stock.buyPrice)
    ? Math.min(Math.max(((current - stock.buyPrice) / (target - stock.buyPrice)) * 100, 0), 100)
    : null;

  const status: "reached" | "at_risk" | "in_progress" | "not_performing" =
    current >= target ? "reached"
    : current <= sl ? "at_risk"
    : (progress !== null && progress >= 50) ? "in_progress"
    : "not_performing";

  return { current, target, sl, signal, plPct, progress, status, changePercent, name: quote?.name ?? stock.symbol };
}

function ProgressBar({ progress, status }: { progress: number; status: string }) {
  const color =
    status === "reached" ? "bg-emerald-500" :
    status === "at_risk" ? "bg-red-500" :
    progress >= 50 ? "bg-emerald-400" : "bg-orange-400";

  return (
    <div className="relative h-2.5 bg-muted/30 rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-1000", color)}
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
    </div>
  );
}

function StockPerfCard({ stock }: { stock: PortfolioStock }) {
  const perf = useStockPerf(stock);
  const isPos = perf.plPct !== null ? perf.plPct >= 0 : perf.changePercent >= 0;

  const statusIcon = perf.status === "reached" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
    perf.status === "at_risk" ? <AlertTriangle className="w-4 h-4 text-red-400" /> :
    perf.status === "in_progress" ? <TrendingUp className="w-4 h-4 text-primary" /> :
    <Clock className="w-4 h-4 text-muted-foreground" />;

  const statusLabel = perf.status === "reached" ? "Reached Target" :
    perf.status === "at_risk" ? "At Risk" :
    perf.status === "in_progress" ? "In Progress" : "Not Performing";

  const statusCls = perf.status === "reached" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    perf.status === "at_risk" ? "text-red-400 bg-red-500/10 border-red-500/20" :
    perf.status === "in_progress" ? "text-primary bg-primary/10 border-primary/20" :
    "text-muted-foreground bg-muted/20 border-border";

  return (
    <div className={cn("bg-card border rounded-xl p-4 transition-all",
      perf.status === "reached" ? "border-emerald-500/30" :
      perf.status === "at_risk" ? "border-red-500/30" : "border-border")}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
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

      {/* P&L */}
      {perf.plPct !== null && (
        <div className={cn("flex items-center justify-between text-xs font-mono px-2 py-1.5 rounded-lg mb-3 border",
          isPos ? "bg-emerald-500/8 text-emerald-400 border-emerald-500/15" : "bg-red-500/8 text-red-400 border-red-500/15")}>
          <span>P&L</span>
          <span className="font-black">{isPos ? "+" : ""}{perf.plPct.toFixed(2)}%</span>
        </div>
      )}

      {/* Progress Bar */}
      {perf.progress !== null && stock.buyPrice ? (
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Progress to Target</span>
            <span className={cn("font-bold font-mono",
              perf.status === "reached" ? "text-emerald-400" : perf.status === "at_risk" ? "text-red-400" : "text-primary")}>
              {perf.progress.toFixed(1)}%
            </span>
          </div>
          <ProgressBar progress={perf.progress} status={perf.status} />
          <div className="flex justify-between text-xs text-muted-foreground mt-1 font-mono">
            <span>SL ₹{fmt(perf.sl)}</span>
            <span>Buy ₹{fmt(stock.buyPrice)}</span>
            <span>TGT ₹{fmt(perf.target)}</span>
          </div>
        </div>
      ) : !stock.buyPrice ? (
        <p className="text-xs text-muted-foreground italic">Add buy price to track progress</p>
      ) : null}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────
function Section({ title, count, icon, cls, stocks }: {
  title: string; count: number; icon: React.ReactNode; cls: string;
  stocks: PortfolioStock[];
}) {
  if (stocks.length === 0) return null;
  return (
    <div>
      <div className={cn("flex items-center gap-2 mb-3 pb-2 border-b", cls)}>
        {icon}
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">({count})</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {stocks.map(s => <StockPerfCard key={s.id} stock={s} />)}
      </div>
    </div>
  );
}

// ── Summary Cards using individual stock hooks ────────────────────────────
function SummaryCards({ portfolio }: { portfolio: PortfolioStock[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {[
        { label: "Total Picks", value: String(portfolio.length), cls: "text-white", sub: "Active positions", Icon: BarChart2 },
        { label: "With Buy Price", value: String(portfolio.filter(s => s.buyPrice).length), cls: "text-primary", sub: "Tracking P&L", Icon: Target },
        { label: "Today's Movement", value: "Live", cls: "text-emerald-400", sub: "Refreshes 30s", Icon: TrendingUp },
        { label: "AI Signals Active", value: String(portfolio.length), cls: "text-violet-400", sub: "VWAP + RSI based", Icon: TrendingDown },
      ].map(item => (
        <div key={item.label} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center shrink-0">
            <item.Icon className={cn("w-4 h-4", item.cls)} />
          </div>
          <div>
            <p className={cn("text-2xl font-black font-mono", item.cls)}>{item.value}</p>
            <p className="text-xs font-semibold text-foreground">{item.label}</p>
            <p className="text-xs text-muted-foreground">{item.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Performance Aggregator ────────────────────────────────────────────────
function PerformanceContent({ portfolio }: { portfolio: PortfolioStock[] }) {
  // We can't use hooks in a callback, so each card fetches its own data.
  // We just categorise by rendering separate sections but cards handle their own data.
  // Use a dummy hook structure just for categorisation.
  return <PerformanceSections portfolio={portfolio} />;
}

// Since each StockPerfCard fetches its own data, we need a way to pass
// pre-fetched status for sectioning. Instead, we use a stateless approach
// and let each card render in its section based on deterministic categorisation.
function PerformanceSections({ portfolio }: { portfolio: PortfolioStock[] }) {
  // We split by rough heuristic: stocks with buy prices get progress tracking.
  const withBuy = portfolio.filter(s => s.buyPrice);
  const withoutBuy = portfolio.filter(s => !s.buyPrice);

  return (
    <div className="space-y-6">
      {withBuy.length > 0 && (
        <>
          <Section title="All Tracked Positions" count={withBuy.length}
            icon={<BarChart2 className="w-4 h-4 text-primary" />}
            cls="border-primary/30" stocks={withBuy} />
        </>
      )}
      {withoutBuy.length > 0 && (
        <Section title="Watchlist (No Buy Price)" count={withoutBuy.length}
          icon={<Clock className="w-4 h-4 text-muted-foreground" />}
          cls="border-border" stocks={withoutBuy} />
      )}
    </div>
  );
}

// ── Performance Page ──────────────────────────────────────────────────────
export function Performance() {
  const { data: portfolio, isLoading, refetch, isFetching } = useGetPortfolio({ query: { refetchInterval: 30000 } });

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
            <BarChart2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Trading Performance</h1>
            <p className="text-xs text-muted-foreground">Portfolio progress tracking · AI targets · Live P&L</p>
          </div>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-card border border-border px-3 py-1.5 rounded-lg transition-all">
          <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} /> Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[0,1,2,3].map(i => <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />)}</div>
      ) : !portfolio || portfolio.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <BarChart2 className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold mb-2">No positions to track</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Add stocks to your Portfolio with a buy price to start tracking progress toward AI-generated targets.
          </p>
        </div>
      ) : (
        <>
          <SummaryCards portfolio={portfolio} />

          {/* How progress works */}
          <div className="mb-5 p-4 bg-card border border-border rounded-xl">
            <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">How Progress is Calculated</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <code className="bg-background px-2 py-1 rounded font-mono text-primary">Progress % = (Current Price − Buy Price) ÷ (Target − Buy Price) × 100</code>
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              {[
                { color: "bg-emerald-500", label: "≥ 100% → Reached Target" },
                { color: "bg-red-500", label: "Price ≤ Stop Loss → At Risk" },
                { color: "bg-emerald-400", label: "50–99% → In Progress (near target)" },
                { color: "bg-orange-400", label: "< 50% → Not Performing" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("w-3 h-1.5 rounded-full", item.color)} />
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          <PerformanceContent portfolio={portfolio} />
        </>
      )}
    </div>
  );
}
