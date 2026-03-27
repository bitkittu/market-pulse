import { useState } from "react";
import {
  useGetPortfolio,
  useAddPortfolioStock,
  useRemovePortfolioStock,
  useGetNseQuote,
  useGetStockIndicators,
} from "@workspace/api-client-react";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip,
  ReferenceLine, AreaChart, Area,
} from "recharts";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, Briefcase, TrendingUp, TrendingDown, Minus, AlertCircle, ChevronDown } from "lucide-react";
import { format } from "date-fns";

function cn(...c: (string | false | undefined | null)[]) {
  return c.filter(Boolean).join(" ");
}
function fmt(n: number, d = 2) {
  return n.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ── Add Stock Modal ──────────────────────────────────────────────────────
function AddStockModal({ onClose }: { onClose: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [qty, setQty] = useState("");
  const [exchange, setExchange] = useState("NSE");
  const [error, setError] = useState("");
  const qc = useQueryClient();
  const addMut = useAddPortfolioStock({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/portfolio"] });
        onClose();
      },
      onError: () => setError("Failed to add stock. Please check the symbol."),
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) { setError("Symbol is required"); return; }
    setError("");
    addMut.mutate({
      data: {
        symbol: symbol.trim().toUpperCase(),
        exchange,
        buyPrice: buyPrice ? Number(buyPrice) : undefined,
        quantity: qty ? Number(qty) : undefined,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Add NSE Stock to Portfolio</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">NSE Symbol *</label>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. RELIANCE, TCS, INFY"
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Buy Price (₹)</label>
              <input
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                placeholder="Optional"
                type="number"
                step="0.01"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Quantity</label>
              <input
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="Optional"
                type="number"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Exchange</label>
            <select
              value={exchange}
              onChange={(e) => setExchange(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="NSE">NSE</option>
              <option value="BSE">BSE</option>
            </select>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={addMut.isPending}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-2.5 rounded-lg transition-all disabled:opacity-50 text-sm"
          >
            {addMut.isPending ? "Adding..." : "Track Stock"}
          </button>
          <p className="text-xs text-muted-foreground text-center">
            VWAP and RSI signals will be calculated automatically
          </p>
        </form>
      </div>
    </div>
  );
}

// ── VWAP Chart ────────────────────────────────────────────────────────────
function VWAPChart({ history }: { history: Array<{ timestamp: string; close: number; vwap: number; rsi: number; volume: number }> }) {
  const data = history.map((h) => ({
    ...h,
    label: format(new Date(h.timestamp), "dd MMM"),
  }));
  return (
    <ResponsiveContainer width="100%" height={80}>
      <LineChart data={data} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
        <XAxis dataKey="label" hide />
        <YAxis domain={["auto", "auto"]} hide />
        <Tooltip
          contentStyle={{ backgroundColor: "hsl(224,40%,9%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, fontSize: 10 }}
          formatter={(v: number, n) => [`₹${v.toFixed(2)}`, n === "close" ? "Price" : "VWAP"]}
          labelFormatter={(l) => l}
        />
        <Line type="monotone" dataKey="close" stroke="#f97316" strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="vwap" stroke="#60a5fa" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── RSI Chart ─────────────────────────────────────────────────────────────
function RSIChart({ history }: { history: Array<{ rsi: number; timestamp: string }> }) {
  const data = history.map((h) => ({
    rsi: h.rsi,
    label: format(new Date(h.timestamp), "dd MMM"),
  }));
  return (
    <ResponsiveContainer width="100%" height={80}>
      <AreaChart data={data} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
        <defs>
          <linearGradient id="rsiGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" hide />
        <YAxis domain={[0, 100]} hide />
        <ReferenceLine y={70} stroke="rgba(239,68,68,0.4)" strokeDasharray="3 3" />
        <ReferenceLine y={30} stroke="rgba(16,185,129,0.4)" strokeDasharray="3 3" />
        <Tooltip
          contentStyle={{ backgroundColor: "hsl(224,40%,9%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, fontSize: 10 }}
          formatter={(v: number) => [`${v.toFixed(1)}`, "RSI"]}
        />
        <Area type="monotone" dataKey="rsi" stroke="#a78bfa" strokeWidth={1.5} fill="url(#rsiGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Stock Indicator Card ──────────────────────────────────────────────────
function StockCard({ stock }: { stock: { id: number; symbol: string; exchange: string; addedAt: string; buyPrice?: number; quantity?: number } }) {
  const qc = useQueryClient();
  const removeMut = useRemovePortfolioStock({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/portfolio"] }) },
  });
  const { data: quote } = useGetNseQuote(stock.symbol, { query: { refetchInterval: 30000 } });
  const { data: ind, isLoading: indLoad } = useGetStockIndicators(stock.symbol, { query: { refetchInterval: 30000 } });

  const currentPrice = quote?.price ?? ind?.price ?? 0;
  const pnl = stock.buyPrice && stock.quantity
    ? (currentPrice - stock.buyPrice) * stock.quantity
    : stock.buyPrice
    ? currentPrice - stock.buyPrice
    : null;
  const pnlPct = stock.buyPrice ? ((currentPrice - stock.buyPrice) / stock.buyPrice) * 100 : null;

  const rsiColors = { OVERBOUGHT: "text-red-400 bg-red-500/15 border-red-500/30", NEUTRAL: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30", OVERSOLD: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" };
  const vwapColors = { ABOVE: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30", BELOW: "text-red-400 bg-red-500/15 border-red-500/30", AT: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30" };
  const mfColors = { ACCUMULATION: "text-emerald-400", DISTRIBUTION: "text-red-400", NEUTRAL: "text-yellow-400" };
  const momColors = { STRONG_UP: "text-emerald-400", UP: "text-emerald-300", NEUTRAL: "text-yellow-400", DOWN: "text-red-300", STRONG_DOWN: "text-red-400" };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      {/* Stock Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white font-mono">{stock.symbol}</span>
            <span className="text-xs px-1.5 py-0.5 bg-primary/20 text-primary border border-primary/30 rounded font-bold">{stock.exchange}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{quote?.name ?? "Loading..."}</p>
        </div>
        <div className="flex items-start gap-2">
          <div className="text-right">
            <div className="text-lg font-mono font-bold text-white">₹{fmt(currentPrice)}</div>
            {quote && (
              <div className={cn("text-xs font-mono font-semibold", quote.changePercent >= 0 ? "text-emerald-400" : "text-red-400")}>
                {quote.changePercent >= 0 ? "+" : ""}{fmt(quote.changePercent)}%
              </div>
            )}
          </div>
          <button onClick={() => removeMut.mutate({ symbol: stock.symbol })}
            disabled={removeMut.isPending}
            className="text-muted-foreground hover:text-red-400 transition-colors mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* P&L if buy price */}
      {pnl !== null && (
        <div className={cn("flex items-center gap-2 text-xs font-mono px-2.5 py-1.5 rounded-lg mb-3 border",
          pnl >= 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20")}>
          <span>Avg: ₹{fmt(stock.buyPrice!)}</span>
          <span className="text-muted-foreground">|</span>
          <span>P&L: {pnl >= 0 ? "+" : ""}₹{fmt(Math.abs(pnl))}</span>
          {pnlPct !== null && <span>({pnl >= 0 ? "+" : ""}{fmt(pnlPct)}%)</span>}
        </div>
      )}

      {/* Indicators */}
      {indLoad ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => <div key={i} className="h-32 bg-muted/30 animate-pulse rounded-lg" />)}
        </div>
      ) : ind ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* VWAP Smart Money Tracker */}
          <div className="bg-background/50 border border-border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-bold text-blue-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
                  VWAP
                </p>
                <p className="text-xs text-muted-foreground">Smart Money Tracker</p>
              </div>
              <span className={cn("text-xs px-2 py-0.5 rounded-full border font-bold", vwapColors[ind.vwapSignal])}>
                {ind.vwapSignal}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <p className="text-xs text-muted-foreground">VWAP</p>
                <p className="text-sm font-mono font-bold text-blue-400">₹{fmt(ind.vwap)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deviation</p>
                <p className={cn("text-sm font-mono font-bold", ind.vwapDeviation >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {ind.vwapDeviation >= 0 ? "+" : ""}{fmt(ind.vwapDeviation)}%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs text-muted-foreground">Money Flow:</span>
              <span className={cn("text-xs font-bold", mfColors[ind.smartMoneyFlow])}>{ind.smartMoneyFlow}</span>
            </div>
            <div className="relative">
              <div className="text-xs text-muted-foreground mb-1 flex justify-between">
                <span>— Price</span><span className="text-blue-400">- - VWAP</span>
              </div>
              <VWAPChart history={ind.history} />
            </div>
          </div>

          {/* RSI Momentum Flow */}
          <div className="bg-background/50 border border-border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-bold text-violet-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd"/></svg>
                  RSI (14)
                </p>
                <p className="text-xs text-muted-foreground">Momentum Flow</p>
              </div>
              <span className={cn("text-xs px-2 py-0.5 rounded-full border font-bold", rsiColors[ind.rsiSignal])}>
                {ind.rsiSignal}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <p className="text-xs text-muted-foreground">RSI Value</p>
                <p className="text-2xl font-mono font-black text-violet-400">{fmt(ind.rsi, 1)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Momentum</p>
                <p className={cn("text-sm font-mono font-bold", momColors[ind.momentum])}>
                  {ind.momentum.replace("_", " ")}
                </p>
              </div>
            </div>
            {/* RSI Gauge */}
            <div className="mb-2">
              <div className="relative h-2 bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500 rounded-full">
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-background shadow-md"
                  style={{ left: `${Math.min(Math.max(ind.rsi, 0), 100)}%`, transform: "translate(-50%, -50%)" }} />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                <span>0 Oversold</span><span>50</span><span>Overbought 100</span>
              </div>
            </div>
            <RSIChart history={ind.history} />
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground text-center py-4">Unable to load indicators</div>
      )}
    </div>
  );
}

// ── Portfolio Page ────────────────────────────────────────────────────────
export function Portfolio() {
  const [showAdd, setShowAdd] = useState(false);
  const { data: portfolio, isLoading } = useGetPortfolio({ query: { refetchInterval: 30000 } });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            My Portfolio
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            VWAP & RSI signals refresh every 30 seconds
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white font-bold px-4 py-2 rounded-lg text-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Stock
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => <div key={i} className="h-64 bg-card border border-border rounded-xl animate-pulse" />)}
        </div>
      ) : portfolio && portfolio.length > 0 ? (
        <div className="space-y-4">
          {portfolio.map((stock) => (
            <StockCard key={stock.id} stock={stock} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Briefcase className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">No stocks in your portfolio</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Add your first NSE stock to track VWAP Smart Money signals and RSI Momentum Flow.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Your First Stock
          </button>
        </div>
      )}

      {showAdd && <AddStockModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
