import { useState, useCallback } from "react";
import { useSearchInsights, InsightsResult, NewsArticle } from "@workspace/api-client-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Search, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, Newspaper,
  ExternalLink, Globe, Activity, BarChart2, RefreshCw, ArrowUpRight, ArrowDownRight,
  Zap, DollarSign, Target, Info,
} from "lucide-react";

function cn(...c: (string | false | undefined | null)[]) { return c.filter(Boolean).join(" "); }

function fmt(n: number, d = 2) {
  if (!n) return "—";
  return n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtCap(n: number) {
  if (n >= 1e12) return `₹${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `₹${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${n.toFixed(0)}`;
}
function fmtVol(n: number) {
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)}L`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${n}`;
}
function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const POPULAR = ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "WIPRO.NS", "AAPL", "TSLA", "MSFT"];

// ── RSI Gauge ─────────────────────────────────────────────────────────────
function RSIGauge({ rsi }: { rsi: number }) {
  const r = 36, cx = 48, cy = 48;
  const circumference = Math.PI * r;
  const progress = Math.min(Math.max(rsi, 0), 100) / 100;
  const offset = circumference * (1 - progress);
  const color = rsi >= 70 ? "#ef4444" : rsi <= 30 ? "#22c55e" : rsi >= 55 ? "#f97316" : "#60a5fa";
  const label = rsi >= 70 ? "Overbought" : rsi <= 30 ? "Oversold" : "Neutral";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={96} height={60} viewBox="0 0 96 60">
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          stroke="#1e293b" strokeWidth={10} fill="none" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          stroke={color} strokeWidth={10} fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={18} fontWeight={700} fill={color}>{rsi}</text>
      </svg>
      <span className="text-xs font-semibold" style={{ color }}>{label}</span>
    </div>
  );
}

// ── Forecast Badge ─────────────────────────────────────────────────────────
function ForecastBadge({ forecast }: { forecast: InsightsResult["forecast"] }) {
  const cfg = {
    Bullish:  { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: TrendingUp },
    Bearish:  { cls: "bg-red-500/15 text-red-400 border-red-500/30",             icon: TrendingDown },
    Neutral:  { cls: "bg-slate-500/15 text-slate-400 border-slate-500/30",       icon: Minus },
  }[forecast];
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${cfg.cls}`}>
      <Icon className="w-5 h-5" />
      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Forecast</div>
        <div className="font-bold text-sm">{forecast}</div>
      </div>
    </div>
  );
}

// ── Sentiment Badge ────────────────────────────────────────────────────────
function SentimentBadge({ sentiment }: { sentiment: InsightsResult["sentiment"] }) {
  const cfg = {
    Positive: { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
    Negative: { cls: "bg-red-500/15 text-red-400 border-red-500/30",             icon: AlertTriangle },
    Neutral:  { cls: "bg-slate-500/15 text-slate-400 border-slate-500/30",       icon: Minus },
  }[sentiment];
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${cfg.cls}`}>
      <Icon className="w-5 h-5" />
      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Sentiment</div>
        <div className="font-bold text-sm">{sentiment}</div>
      </div>
    </div>
  );
}

// ── Price Chart ────────────────────────────────────────────────────────────
function PriceChart({ data, symbol, vwap }: { data: InsightsResult["priceHistory"]; symbol: string; vwap: number }) {
  const pts = data.slice(-60);
  const min = Math.min(...pts.map((p) => p.close)) * 0.998;
  const max = Math.max(...pts.map((p) => p.close)) * 1.002;
  const first = pts[0]?.close ?? 0;
  const last = pts[pts.length - 1]?.close ?? 0;
  const up = last >= first;
  const color = up ? "#22c55e" : "#ef4444";
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm">{symbol} — 3M Price History</span>
        </div>
        <div className={`text-xs font-bold flex items-center gap-1 ${up ? "text-emerald-400" : "text-red-400"}`}>
          {up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          {((last - first) / first * 100).toFixed(1)}%
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={pts} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b" }}
            tickFormatter={(v) => v.slice(5)} interval={Math.floor(pts.length / 6)} />
          <YAxis domain={[min, max]} tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={(v) => `₹${v.toLocaleString("en-IN")}`} width={60} />
          <RTooltip
            contentStyle={{ background: "#0d1526", border: "1px solid #1e293b", borderRadius: 8, fontSize: 11 }}
            formatter={(v: number) => [`₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, "Price"]}
            labelStyle={{ color: "#94a3b8" }}
          />
          {vwap > 0 && (
            <ReferenceLine y={vwap} stroke="#f97316" strokeDasharray="4 2" strokeWidth={1.5}
              label={{ value: `VWAP ₹${vwap.toFixed(0)}`, position: "insideTopRight", fontSize: 9, fill: "#f97316" }} />
          )}
          <Line type="monotone" dataKey="close" stroke={color} dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── News Card ──────────────────────────────────────────────────────────────
function NewsCard({ article, idx }: { article: NewsArticle; idx: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-bold text-primary/60 bg-primary/10 px-2 py-0.5 rounded-full shrink-0">#{idx + 1}</span>
        <span className="text-[10px] text-muted-foreground">{timeAgo(article.publishedAt)}</span>
      </div>
      {article.thumbnail && (
        <img src={article.thumbnail} alt="" className="w-full h-32 object-cover rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      )}
      <div>
        <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-2 mb-1">
          {article.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {article.description || "Read the full article for details."}
        </p>
      </div>
      <div className="flex items-center gap-1 mt-auto">
        <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
        <span className="text-[10px] text-muted-foreground truncate">{article.source}</span>
      </div>
      <div className="flex gap-2 pt-1 border-t border-border">
        <a href={article.url} target="_blank" rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors">
          <ExternalLink className="w-3 h-3" />
          Read More
        </a>
        <a href={(() => { try { return article.url ? new URL(article.url).origin : "#"; } catch { return "#"; } })()} target="_blank" rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-bold hover:bg-accent transition-colors">
          <Globe className="w-3 h-3" />
          View Source
        </a>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export function Insights() {
  const [input, setInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, isError, error, isFetching } = useSearchInsights(
    { q: searchTerm },
    { query: { enabled: !!searchTerm, staleTime: 60000 } as any }
  );

  const handleSearch = useCallback(() => {
    const q = input.trim().toUpperCase();
    if (q) setSearchTerm(q);
  }, [input]);

  const price = data?.price ?? 0;
  const change = data?.change ?? 0;
  const changePct = data?.changePercent ?? 0;
  const isUp = change >= 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2 mb-1">
          <Newspaper className="w-5 h-5 text-primary" />
          Stock Insights
        </h1>
        <p className="text-sm text-muted-foreground">Real-time indicators, AI forecast, sentiment &amp; latest news for any stock</p>
      </div>

      {/* Search Bar */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Enter symbol: TCS, RELIANCE, AAPL, TSLA…"
              className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
            />
          </div>
          <button onClick={handleSearch} disabled={isLoading || isFetching || !input.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            {(isLoading || isFetching) ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {(isLoading || isFetching) ? "Loading…" : "Search"}
          </button>
        </div>
        {/* Popular chips */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="text-[10px] text-muted-foreground self-center mr-1">Popular:</span>
          {POPULAR.map((s) => (
            <button key={s} onClick={() => { setInput(s); setSearchTerm(s); }}
              className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-accent hover:bg-primary/10 hover:text-primary border border-border transition-colors">
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Spinner */}
      {(isLoading || isFetching) && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-muted-foreground text-sm">Fetching market data for <span className="text-foreground font-bold">{searchTerm}</span>…</p>
        </div>
      )}

      {/* Error */}
      {isError && !isFetching && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 flex items-center gap-4">
          <AlertTriangle className="w-8 h-8 text-red-400 shrink-0" />
          <div>
            <p className="font-bold text-red-400">Could not fetch data</p>
            <p className="text-sm text-muted-foreground mt-1">
              {(error as Error)?.message || `Symbol "${searchTerm}" not found. Try adding .NS for NSE stocks (e.g. RELIANCE.NS).`}
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!searchTerm && !isLoading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Search className="w-8 h-8 text-primary/60" />
          </div>
          <h3 className="text-lg font-bold">Search any stock</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Enter a ticker symbol above to get live price, RSI, VWAP, AI forecast, news sentiment and the latest headlines.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-1.5 rounded-full bg-card border border-border">
              <Activity className="w-3 h-3 text-primary" /> RSI Indicator
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-1.5 rounded-full bg-card border border-border">
              <Target className="w-3 h-3 text-primary" /> VWAP Analysis
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-1.5 rounded-full bg-card border border-border">
              <Zap className="w-3 h-3 text-primary" /> AI Forecast
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-1.5 rounded-full bg-card border border-border">
              <Newspaper className="w-3 h-3 text-primary" /> Live News
            </span>
          </div>
        </div>
      )}

      {/* Results */}
      {data && !isFetching && (
        <div className="space-y-6">
          {/* Stock Summary Card */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl font-black tracking-tight">{data.symbol}</span>
                  <span className={`flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-full ${
                    isUp ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                  }`}>
                    {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {isUp ? "+" : ""}{changePct.toFixed(2)}%
                  </span>
                </div>
                <p className="text-muted-foreground text-sm mb-3">{data.name}</p>
                <div className="flex items-end gap-3">
                  <span className="text-4xl font-black tracking-tight">
                    {data.currency === "INR" ? "₹" : "$"}{fmt(price)}
                  </span>
                  <span className={`text-base font-bold mb-1 ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                    {isUp ? "+" : ""}{fmt(Math.abs(change))}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-background rounded-xl px-4 py-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-center gap-1"><DollarSign className="w-3 h-3" />Mkt Cap</div>
                  <div className="font-bold text-sm">{fmtCap(data.marketCap)}</div>
                </div>
                <div className="bg-background rounded-xl px-4 py-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Volume</div>
                  <div className="font-bold text-sm">{fmtVol(data.volume)}</div>
                </div>
                <div className="bg-background rounded-xl px-4 py-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">52W High</div>
                  <div className="font-bold text-sm text-emerald-400">{data.currency === "INR" ? "₹" : "$"}{fmt(data.fiftyTwoWeekHigh)}</div>
                </div>
                <div className="bg-background rounded-xl px-4 py-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">52W Low</div>
                  <div className="font-bold text-sm text-red-400">{data.currency === "INR" ? "₹" : "$"}{fmt(data.fiftyTwoWeekLow)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Indicators Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* RSI Card */}
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 self-start w-full">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wide">RSI (14)</span>
                <div className="ml-auto group relative">
                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                  <div className="hidden group-hover:block absolute right-0 top-5 z-10 bg-popover border border-border rounded-lg p-3 text-xs w-52 shadow-xl">
                    RSI above 70 = Overbought (caution). RSI below 30 = Oversold (opportunity). 30–70 = Neutral range.
                  </div>
                </div>
              </div>
              <RSIGauge rsi={data.rsi} />
            </div>

            {/* VWAP Card */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wide">VWAP</span>
                <div className="ml-auto group relative">
                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                  <div className="hidden group-hover:block absolute right-0 top-5 z-10 bg-popover border border-border rounded-lg p-3 text-xs w-52 shadow-xl">
                    Volume-Weighted Average Price. Price above VWAP = bullish; below VWAP = bearish pressure.
                  </div>
                </div>
              </div>
              <div className="text-2xl font-black mb-2">
                {data.currency === "INR" ? "₹" : "$"}{fmt(data.vwap)}
              </div>
              <div className={`flex items-center gap-1.5 text-xs font-bold ${price >= data.vwap ? "text-emerald-400" : "text-red-400"}`}>
                {price >= data.vwap
                  ? <><ArrowUpRight className="w-3.5 h-3.5" />Price above VWAP — Bullish</>
                  : <><ArrowDownRight className="w-3.5 h-3.5" />Price below VWAP — Bearish</>
                }
              </div>
              <div className="mt-3 bg-background rounded-xl p-3 text-xs text-muted-foreground">
                Diff: <span className={`font-bold ${price >= data.vwap ? "text-emerald-400" : "text-red-400"}`}>
                  {price >= data.vwap ? "+" : ""}{((price - data.vwap) / data.vwap * 100).toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Forecast */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wide">AI Forecast</span>
              </div>
              <ForecastBadge forecast={data.forecast} />
              <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
                Based on RSI momentum and VWAP positioning over the past 90 days of price action.
              </p>
            </div>

            {/* Sentiment */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Newspaper className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wide">News Sentiment</span>
              </div>
              <SentimentBadge sentiment={data.sentiment} />
              <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
                Analysed from the top {Math.min(data.news.length, 10)} latest headlines using keyword sentiment scoring.
              </p>
            </div>
          </div>

          {/* Price Chart */}
          {data.priceHistory.length > 5 && (
            <PriceChart data={data.priceHistory} symbol={data.symbol} vwap={data.vwap} />
          )}

          {/* News Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-primary" />
                Latest News
                <span className="text-xs font-normal text-muted-foreground ml-1">({data.news.length} articles)</span>
              </h2>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                data.sentiment === "Positive" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : data.sentiment === "Negative" ? "bg-red-500/10 text-red-400 border-red-500/30"
                : "bg-slate-500/10 text-slate-400 border-slate-500/30"
              }`}>
                {data.sentiment} Tone
              </span>
            </div>

            {data.news.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm bg-card border border-border rounded-2xl">
                No news articles found for <span className="text-foreground font-bold">{data.symbol}</span>.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.news.map((article, i) => (
                  <NewsCard key={i} article={article} idx={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
