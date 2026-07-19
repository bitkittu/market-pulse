import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  useGetPortfolio,
  useAddPortfolioStock,
  useRemovePortfolioStock,
  useGetNseQuote,
  useGetStockIndicators,
  getGetStockIndicatorsQueryOptions,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, X, Briefcase, TrendingUp, TrendingDown, AlertCircle,
  ChevronDown, ChevronUp, Newspaper, Target, ShieldAlert, Zap, RefreshCw,
  Wallet, BarChart2, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

function cn(...c: (string | false | undefined | null)[]) { return c.filter(Boolean).join(" "); }
function fmt(n: number, d = 2) { return n.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function fmtInr(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "+";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)}L`;
  return `${sign}₹${fmt(abs)}`;
}

type Signal = "STRONG_BUY" | "BUY" | "WATCH" | "SELL" | "STRONG_SELL";
type Sentiment = "POSITIVE" | "NEGATIVE" | "NEUTRAL";
type PortfolioStock = { id: number; symbol: string; exchange: string; addedAt: string; buyPrice?: number; quantity?: number };

const SIG: Record<Signal, { label: string; cls: string }> = {
  STRONG_BUY:  { label: "STRONG BUY",  cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  BUY:         { label: "BUY",         cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" },
  WATCH:       { label: "WATCH",       cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/25" },
  SELL:        { label: "SELL",        cls: "bg-red-500/10 text-red-400 border-red-500/25" },
  STRONG_SELL: { label: "STRONG SELL", cls: "bg-red-500/20 text-red-300 border-red-500/40" },
};

const SENT: Record<Sentiment, { label: string; cls: string; dot: string }> = {
  POSITIVE: { label: "Positive", cls: "text-emerald-400", dot: "bg-emerald-400" },
  NEGATIVE: { label: "Negative", cls: "text-red-400",     dot: "bg-red-400" },
  NEUTRAL:  { label: "Neutral",  cls: "text-yellow-400",  dot: "bg-yellow-400" },
};

// ── Portfolio Total P&L Card ──────────────────────────────────────────────
function PortfolioTotalCard({ portfolio }: { portfolio: PortfolioStock[] }) {
  const queries = useQueries({
    queries: portfolio.map(s => getGetStockIndicatorsQueryOptions(s.symbol)),
  });

  let totalInvested = 0;
  let totalCurrent = 0;
  let winners = 0;
  let losers = 0;

  portfolio.forEach((s, i) => {
    const ind = queries[i]?.data as any;
    const price: number = ind?.price ?? s.buyPrice ?? 0;
    const qty = s.quantity ?? 1;
    if (s.buyPrice) {
      totalInvested += s.buyPrice * qty;
      totalCurrent += price * qty;
      if (price >= s.buyPrice) winners++; else losers++;
    }
  });

  const totalPL = totalCurrent - totalInvested;
  const totalPLPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;
  const isPos = totalPL >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      {/* Total Invested */}
      <div className="bg-card border border-border rounded-xl px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Wallet className="w-3.5 h-3.5" /> Total Invested
        </div>
        <p className="text-lg sm:text-xl font-black font-mono text-white">
          {totalInvested > 0 ? `₹${fmt(totalInvested, 0)}` : "—"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{portfolio.filter(s => s.buyPrice).length} positions tracked</p>
      </div>

      {/* Current Value */}
      <div className="bg-card border border-border rounded-xl px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <BarChart2 className="w-3.5 h-3.5" /> Current Value
        </div>
        <p className={cn("text-lg sm:text-xl font-black font-mono", isPos ? "text-emerald-400" : "text-red-400")}>
          {totalCurrent > 0 ? `₹${fmt(totalCurrent, 0)}` : "—"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Live market price</p>
      </div>

      {/* Total P&L */}
      <div className={cn("border rounded-xl px-3 sm:px-4 py-3 sm:py-4", isPos ? "bg-emerald-500/8 border-emerald-500/25" : "bg-red-500/8 border-red-500/25")}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          {isPos ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />}
          Total P&L
        </div>
        <p className={cn("text-lg sm:text-xl font-black font-mono", isPos ? "text-emerald-400" : "text-red-400")}>
          {totalInvested > 0 ? fmtInr(totalPL) : "—"}
        </p>
        <p className={cn("text-xs font-mono font-bold mt-0.5", isPos ? "text-emerald-400/70" : "text-red-400/70")}>
          {totalInvested > 0 ? `${isPos ? "+" : ""}${totalPLPct.toFixed(2)}%` : "—"}
        </p>
      </div>

      {/* Winners / Losers */}
      <div className="bg-card border border-border rounded-xl px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Target className="w-3.5 h-3.5" /> Win / Loss
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg sm:text-xl font-black font-mono text-emerald-400">{winners}W</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-lg sm:text-xl font-black font-mono text-red-400">{losers}L</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {winners + losers > 0 ? `${((winners / (winners + losers)) * 100).toFixed(0)}% win rate` : "No data"}
        </p>
      </div>
    </div>
  );
}

// ── Add Stock Modal ───────────────────────────────────────────────────────
function AddStockModal({ onClose }: { onClose: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [qty, setQty] = useState("");
  const [error, setError] = useState("");
  const qc = useQueryClient();
  const addMut = useAddPortfolioStock({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/portfolio"] }); onClose(); },
      onError: () => setError("Failed to add stock. Check the symbol."),
    },
  });

  const POPULAR = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "SBIN", "BAJFINANCE", "ICICIBANK", "LT", "WIPRO", "ITC"];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0d1526] border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" /> Add Stock to Portfolio
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!symbol.trim()) { setError("Symbol required"); return; }
          setError("");
          addMut.mutate({ data: { symbol: symbol.trim().toUpperCase(), exchange: "NSE", buyPrice: buyPrice ? Number(buyPrice) : undefined, quantity: qty ? Number(qty) : undefined } });
        }} className="p-5 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">NSE Symbol *</label>
            <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. RELIANCE, TCS, INFY"
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {POPULAR.map(s => (
                <button key={s} type="button" onClick={() => setSymbol(s)}
                  className="text-xs px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded hover:bg-primary/20 transition-colors font-mono">
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Buy Price (₹)</label>
              <input value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} placeholder="Optional"
                type="number" step="0.01"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Quantity</label>
              <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Optional"
                type="number"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
          <button type="submit" disabled={addMut.isPending}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-2.5 rounded-lg transition-all disabled:opacity-50 text-sm">
            {addMut.isPending ? "Adding..." : "+ Track Stock"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Row Highlight ─────────────────────────────────────────────────────────
function rowHighlight(current: number, target: number, sl: number) {
  if (current >= target) return "bg-emerald-500/8 border-emerald-500/25";
  if (current <= sl) return "bg-red-500/8 border-red-500/25";
  const distPct = ((target - current) / target) * 100;
  if (distPct <= 5) return "bg-yellow-500/8 border-yellow-500/25";
  return "bg-card border-border";
}

function getBadge(current: number, target: number, sl: number, badge: string | null) {
  if (badge === "Momentum Strong") return { label: "Momentum Strong", cls: "bg-violet-500/20 text-violet-300 border-violet-500/30", Icon: Zap };
  if (current <= sl) return { label: "At Risk", cls: "bg-red-500/20 text-red-300 border-red-500/30", Icon: ShieldAlert };
  const distPct = ((target - current) / target) * 100;
  if (distPct <= 5 && current < target) return { label: "Approaching Target", cls: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", Icon: Target };
  if (badge === "At Risk") return { label: "At Risk", cls: "bg-red-500/20 text-red-300 border-red-500/30", Icon: ShieldAlert };
  return null;
}

// ── Portfolio Row ─────────────────────────────────────────────────────────
function PortfolioRow({ stock }: { stock: PortfolioStock }) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();
  const removeMut = useRemovePortfolioStock({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/portfolio"] }) } });
  const { data: quote } = useGetNseQuote(stock.symbol, { query: { refetchInterval: 30000 } });
  const { data: ind } = useGetStockIndicators(stock.symbol, { query: { refetchInterval: 30000 } });

  const current = quote?.price ?? ind?.price ?? 0;
  const ext = ind as any;
  const target: number = ext?.targetPrice ?? (current * 1.1);
  const sl: number = ext?.stopLossPrice ?? (current * 0.94);
  const signal: Signal = ext?.signal ?? "WATCH";
  const sentiment: Sentiment = ext?.newsSentiment ?? "NEUTRAL";
  const rsi: number = ind?.rsi ?? 50;
  const vwap: number = ind?.vwap ?? current;
  const badgeRaw: string | null = ext?.badge ?? null;

  // Stop loss distance %
  const slDist = current > 0 ? ((current - sl) / current) * 100 : 0;
  const slDistCls = slDist < 1.5 ? "text-red-400" : slDist < 3 ? "text-yellow-400" : "text-emerald-400/80";

  const plPct = stock.buyPrice ? ((current - stock.buyPrice) / stock.buyPrice) * 100 : null;
  const plAmt = stock.buyPrice && stock.quantity ? (current - stock.buyPrice) * stock.quantity : null;

  const rowCls = rowHighlight(current, target, sl);
  const badge = getBadge(current, target, sl, badgeRaw);

  const sigCfg = SIG[signal];
  const sentCfg = SENT[sentiment];
  const isPos = (quote?.changePercent ?? 0) >= 0;

  return (
    <>
      <tr
        className={cn("border-b border-border/50 transition-all cursor-pointer hover:brightness-110", rowCls)}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Stock Name */}
        <td className="px-2 sm:px-3 md:px-4 py-3 whitespace-nowrap sticky left-0 bg-inherit z-10">
          <div className="flex items-center gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-white font-mono">{stock.symbol}</span>
                {badge && (
                  <span className={cn("inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold border", badge.cls)}>
                    <badge.Icon className="w-2.5 h-2.5" />{badge.label}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-[120px]">{quote?.name ?? "—"}</p>
            </div>
          </div>
        </td>

        {/* Current Price */}
        <td className="px-2 sm:px-3 md:px-4 py-3 text-center whitespace-nowrap">
          <p className="text-sm font-mono font-bold text-white">₹{fmt(current)}</p>
          <p className={cn("text-xs font-mono", isPos ? "text-emerald-400" : "text-red-400")}>
            {isPos ? "▲" : "▼"}{Math.abs(quote?.changePercent ?? 0).toFixed(2)}%
          </p>
        </td>

        {/* My Buy Price */}
        <td className="px-2 sm:px-3 md:px-4 py-3 text-center whitespace-nowrap">
          {stock.buyPrice
            ? <p className="text-sm font-mono font-bold text-muted-foreground">₹{fmt(stock.buyPrice)}</p>
            : <p className="text-xs text-muted-foreground">—</p>}
        </td>

        {/* Target Price */}
        <td className="px-2 sm:px-3 md:px-4 py-3 text-center whitespace-nowrap">
          <p className="text-sm font-mono font-bold text-emerald-400">₹{fmt(target)}</p>
          <p className="text-xs text-muted-foreground">AI Target</p>
        </td>

        {/* Stop Loss */}
        <td className="px-2 sm:px-3 md:px-4 py-3 text-center whitespace-nowrap">
          <p className="text-sm font-mono font-bold text-red-400">₹{fmt(sl)}</p>
          <p className={cn("text-xs font-mono font-bold", slDistCls)}>{slDist.toFixed(1)}% away</p>
        </td>

        {/* Signal */}
        <td className="px-2 sm:px-3 md:px-4 py-3 text-center whitespace-nowrap">
          <span className={cn("inline-block px-2.5 py-1 rounded-lg border text-xs font-black", sigCfg.cls)}>
            {sigCfg.label}
          </span>
        </td>

        {/* RSI */}
        <td className="px-2 sm:px-3 md:px-4 py-3 text-center whitespace-nowrap">
          <p className={cn("text-sm font-mono font-bold",
            rsi >= 70 ? "text-red-400" : rsi <= 30 ? "text-emerald-400" : "text-yellow-400"
          )}>{rsi.toFixed(1)}</p>
          <div className="w-14 h-1 bg-muted/40 rounded-full mx-auto mt-1 overflow-hidden">
            <div className={cn("h-full rounded-full", rsi >= 70 ? "bg-red-500" : rsi <= 30 ? "bg-emerald-500" : "bg-yellow-400")}
              style={{ width: `${rsi}%` }} />
          </div>
        </td>

        {/* VWAP */}
        <td className="px-2 sm:px-3 md:px-4 py-3 text-center whitespace-nowrap">
          <p className="text-sm font-mono font-bold text-blue-400">₹{fmt(vwap)}</p>
          <p className={cn("text-xs font-semibold",
            current > vwap ? "text-emerald-400" : current < vwap ? "text-red-400" : "text-yellow-400")}>
            {current > vwap ? "↑ Above" : current < vwap ? "↓ Below" : "≈ At"}
          </p>
        </td>

        {/* News Sentiment */}
        <td className="px-2 sm:px-3 md:px-4 py-3 text-center whitespace-nowrap">
          <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", sentCfg.cls)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", sentCfg.dot)} />
            {sentCfg.label}
          </span>
        </td>

        {/* P/L % */}
        <td className="px-2 sm:px-3 md:px-4 py-3 text-center whitespace-nowrap">
          {plPct !== null ? (
            <div>
              <p className={cn("text-sm font-mono font-black", plPct >= 0 ? "text-emerald-400" : "text-red-400")}>
                {plPct >= 0 ? "+" : ""}{plPct.toFixed(2)}%
              </p>
              {plAmt !== null && (
                <p className={cn("text-xs font-mono", plAmt >= 0 ? "text-emerald-400/70" : "text-red-400/70")}>
                  {plAmt >= 0 ? "+" : ""}₹{fmt(Math.abs(plAmt), 0)}
                </p>
              )}
            </div>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </td>

        {/* Expand / Remove */}
        <td className="px-2 sm:px-3 md:px-4 py-3 text-right whitespace-nowrap">
          <div className="flex items-center justify-end gap-2">
            <button onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
              className="text-muted-foreground hover:text-foreground transition-colors">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); removeMut.mutate({ symbol: stock.symbol }); }}
              disabled={removeMut.isPending}
              className="text-muted-foreground hover:text-red-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded Detail Panel */}
      {expanded && (
        <tr className="border-b border-border/30">
          <td colSpan={11} className="px-4 pb-4 pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              {/* VWAP */}
              <div className="bg-background border border-blue-500/20 rounded-xl p-3">
                <p className="text-xs font-bold text-blue-400 mb-2">VWAP Analysis</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">VWAP</span><span className="font-mono font-bold text-blue-400">₹{fmt(vwap)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Deviation</span><span className={cn("font-mono font-bold", current > vwap ? "text-emerald-400" : "text-red-400")}>{(((current - vwap) / Math.max(vwap, 1)) * 100).toFixed(2)}%</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Position</span><span className={cn("font-bold", current > vwap ? "text-emerald-400" : "text-red-400")}>{current > vwap ? "↑ Above VWAP" : "↓ Below VWAP"}</span></div>
                </div>
              </div>

              {/* RSI */}
              <div className="bg-background border border-violet-500/20 rounded-xl p-3">
                <p className="text-xs font-bold text-violet-400 mb-2">RSI Momentum</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">RSI (14)</span><span className={cn("font-mono font-black text-lg", rsi >= 70 ? "text-red-400" : rsi <= 30 ? "text-emerald-400" : "text-yellow-400")}>{rsi.toFixed(0)}</span></div>
                  <div className="flex justify-between text-xs mt-1"><span className="text-muted-foreground">Status</span><span className={cn("font-bold", rsi >= 70 ? "text-red-400" : rsi <= 30 ? "text-emerald-400" : "text-yellow-400")}>{rsi >= 70 ? "OVERBOUGHT" : rsi <= 30 ? "OVERSOLD" : "NEUTRAL"}</span></div>
                  <div className="mt-2 h-1.5 bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500 rounded-full relative">
                    <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full border border-background" style={{ left: `${Math.min(rsi, 99)}%`, transform: "translate(-50%, -50%)" }} />
                  </div>
                </div>
              </div>

              {/* Price Levels */}
              <div className="bg-background border border-emerald-500/20 rounded-xl p-3">
                <p className="text-xs font-bold text-emerald-400 mb-2">Price Levels</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Target</span><span className="font-mono font-bold text-emerald-400">₹{fmt(target)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Stop Loss</span><span className="font-mono font-bold text-red-400">₹{fmt(sl)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">SL Distance</span><span className={cn("font-mono font-bold", slDistCls)}>{slDist.toFixed(2)}%</span></div>
                  {stock.buyPrice && (
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Risk/Reward</span><span className="font-mono font-bold text-primary">{((target - stock.buyPrice) / Math.max(stock.buyPrice - sl, 0.01)).toFixed(1)}x</span></div>
                  )}
                </div>
              </div>

              {/* News */}
              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1"><Newspaper className="w-3 h-3" /> News Sentiment</p>
                <div className="flex flex-col gap-1.5">
                  <div className={cn("text-sm font-black flex items-center gap-1.5", sentCfg.cls)}>
                    <span className={cn("w-2 h-2 rounded-full", sentCfg.dot)} />{sentCfg.label}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {sentiment === "POSITIVE" ? "Recent news flow is bullish for this stock. Analysts are upgrading targets." :
                     sentiment === "NEGATIVE" ? "Negative news flow detected. Caution advised. Monitor closely." :
                     "Neutral news flow. No major catalysts identified in last 24 hours."}
                  </p>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            {stock.buyPrice && (
              <div className="mt-3 p-3 bg-background border border-border rounded-xl">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-muted-foreground font-semibold">Progress toward AI Target</span>
                  <span className={cn("font-mono font-bold", current >= target ? "text-emerald-400" : current <= sl ? "text-red-400" : "text-primary")}>
                    {Math.min(Math.max(((current - stock.buyPrice) / Math.max(target - stock.buyPrice, 0.01)) * 100, 0), 100).toFixed(1)}%
                  </span>
                </div>
                <div className="relative h-2.5 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-700",
                      current >= target ? "bg-emerald-500" : current <= sl ? "bg-red-500" : "bg-primary")}
                    style={{ width: `${Math.min(Math.max(((current - stock.buyPrice) / Math.max(target - stock.buyPrice, 0.01)) * 100, 0), 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1 font-mono">
                  <span className="text-red-400">SL ₹{fmt(sl)}</span>
                  <span className="text-muted-foreground">Buy ₹{fmt(stock.buyPrice)}</span>
                  <span className="text-emerald-400">Target ₹{fmt(target)}</span>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Portfolio Page ────────────────────────────────────────────────────────
export function Portfolio() {
  const [showAdd, setShowAdd] = useState(false);
  const { data: portfolio, isLoading, refetch, isFetching } = useGetPortfolio({ query: { refetchInterval: 30000 } });
  const stocks = (portfolio ?? []) as PortfolioStock[];

  const COLS = ["Stock Name", "Current Price", "My Buy Price", "AI Target", "Stop Loss", "Signal", "RSI", "VWAP", "Sentiment", "P/L %", ""];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" /> My Portfolio
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">AI signals · VWAP & RSI · Live P&L · Stop loss distance</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} disabled={isFetching}
            className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border px-3 py-2 rounded-lg hover:border-primary/30 transition-all">
            <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white font-bold px-4 py-2 rounded-lg text-sm transition-all">
            <Plus className="w-4 h-4" /> Add Stock
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-card border border-border rounded-xl text-xs">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/50" /><span className="text-muted-foreground">Price ≥ Target</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-500/30 border border-yellow-500/50" /><span className="text-muted-foreground">Within 5% of Target</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500/30 border border-red-500/50" /><span className="text-muted-foreground">Below Stop Loss</span></div>
        <span className="text-muted-foreground ml-auto">Click any row for details</span>
      </div>

      {/* Total P&L Summary */}
      {stocks.length > 0 && !isLoading && <PortfolioTotalCard portfolio={stocks} />}

      {isLoading ? (
        <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />)}</div>
      ) : stocks.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-[#0d1526] border-b border-border sticky top-0 z-10">
                  {COLS.map((col) => (
                    <th key={col} className={cn("px-2 sm:px-3 md:px-4 py-3 text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap",
                      col === "Stock Name" ? "text-left sticky left-0 bg-[#0d1526] z-20" : "text-center")}>
                      {col === "Stop Loss" ? <span className="text-red-400">{col}</span> :
                       col === "AI Target" ? <span className="text-emerald-400">{col}</span> :
                       col === "P/L %" ? <span className="text-orange-400">{col}</span> : col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stocks.map(stock => <PortfolioRow key={stock.id} stock={stock} />)}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Briefcase className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold mb-2">No stocks in your portfolio</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Add your first NSE stock to track AI signals, VWAP, RSI, and live P&L with target tracking.
          </p>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white font-bold px-5 py-2.5 rounded-lg text-sm">
            <Plus className="w-4 h-4" /> Add Your First Stock
          </button>
        </div>
      )}

      {showAdd && <AddStockModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
