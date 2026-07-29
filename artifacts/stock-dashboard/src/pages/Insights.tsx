import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchInsights, useLookupStocks, InsightsResult, NewsArticle } from "@workspace/api-client-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Search, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, Newspaper,
  ExternalLink, Globe, Activity, BarChart2, RefreshCw, ArrowUpRight, ArrowDownRight,
  Zap, DollarSign, Target, Info, Brain,
} from "lucide-react";
import { FoAnalyzer } from "./FoAnalyzer";

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
/**
 * Absolute publication time in IST.
 *
 * The product is India-first and has no per-user timezone setting, so news is
 * pinned to Asia/Kolkata rather than the viewer's local zone — a Mumbai user on
 * a laptop still set to UTC should not read a market headline an hour adrift.
 * Returns null for a missing or unparseable instant so callers can say so
 * explicitly instead of printing a fabricated time.
 */
function formatIst(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dayPeriod = get("dayPeriod").toUpperCase().replace(/\./g, "");
  return `${get("day")} ${get("month")} ${get("year")} · ${get("hour")}:${get("minute")} ${dayPeriod} IST`;
}

/** Clock-only IST stamp, for the "Updated …" label beside the heading. */
function formatIstTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true,
  }).toUpperCase().replace(/\./g, "") + " IST";
}

const POPULAR = ["RELIANCE", "TCS", "SBIN", "INFY", "HDFCBANK", "COALINDIA", "WIPRO", "AAPL", "TSLA"];

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

// ── Sentiment Meter ────────────────────────────────────────────────────────
function SentimentMeter({ sentiment, score }: { sentiment: InsightsResult["sentiment"]; score: number }) {
  const s = score ?? 50;

  const { color, barColor, icon: Icon, grade, desc } = s >= 75
    ? { color: "text-emerald-400", barColor: "from-emerald-600 to-emerald-400", icon: CheckCircle2, grade: "Very Positive", desc: "Strong bullish tone across headlines" }
    : s >= 60
    ? { color: "text-emerald-400", barColor: "from-emerald-700 to-emerald-500", icon: TrendingUp,   grade: "Positive",      desc: "More positive signals than negative" }
    : s >= 45
    ? { color: "text-slate-400",   barColor: "from-slate-600 to-slate-400",     icon: Minus,         grade: "Neutral",       desc: "Mixed or balanced news tone" }
    : s >= 25
    ? { color: "text-red-400",     barColor: "from-red-700 to-red-500",         icon: TrendingDown,  grade: "Negative",      desc: "More negative signals in headlines" }
    : { color: "text-red-400",     barColor: "from-red-800 to-red-600",         icon: AlertTriangle, grade: "Very Negative",  desc: "Strong bearish tone in news" };

  const sentClr = sentiment === "Positive" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
    : sentiment === "Negative" ? "text-red-400 border-red-500/30 bg-red-500/10"
    : "text-slate-400 border-slate-500/30 bg-slate-500/10";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", color)} />
          <span className={cn("font-bold text-sm", color)}>{grade}</span>
        </div>
        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border", sentClr)}>{sentiment}</span>
      </div>

      {/* Score bar */}
      <div>
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
          <span>Bearish</span>
          <span className={cn("font-black text-sm", color)}>{s}<span className="text-[10px] font-normal">/100</span></span>
          <span>Bullish</span>
        </div>
        <div className="relative h-3 bg-background rounded-full overflow-hidden border border-border">
          {/* Track segments */}
          <div className="absolute inset-0 flex">
            <div className="flex-1 bg-red-900/30" />
            <div className="w-px bg-border" />
            <div className="flex-1 bg-slate-800/30" />
            <div className="w-px bg-border" />
            <div className="flex-1 bg-emerald-900/30" />
          </div>
          {/* Filled bar */}
          <div
            className={cn("absolute top-0 left-0 h-full rounded-full bg-gradient-to-r transition-all duration-700", barColor)}
            style={{ width: `${s}%` }}
          />
          {/* Needle marker */}
          <div
            className="absolute top-0 h-full w-0.5 bg-white/80 shadow-md transition-all duration-700"
            style={{ left: `${s}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-0.5">
          <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">{desc}. Analysed using weighted keyword scoring across {" "}up to 15 headlines.</p>
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
  const published = formatIst(article.publishedAt);
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-bold text-primary/60 bg-primary/10 px-2 py-0.5 rounded-full shrink-0">#{idx + 1}</span>
      </div>
      {article.thumbnail && (
        <img src={article.thumbnail} alt="" className="w-full h-32 object-cover rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      )}
      <div>
        <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-3 mb-1">
          {article.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {article.description || "Read the full article for details."}
        </p>
      </div>
      {/* Publisher + absolute publication time. Wraps rather than truncating on
          narrow screens so the source stays legible on mobile. */}
      <div className="mt-auto flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="text-[11px] font-semibold text-foreground/80 break-words">{article.source}</span>
        </div>
        <span className={cn("text-[10px] break-words", published ? "text-muted-foreground" : "text-muted-foreground/60 italic")}>
          {published ?? "Published time unavailable"}
        </span>
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

// ── Stock Insights Inner ───────────────────────────────────────────────────
function StockInsights() {
  const [input, setInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, error, isFetching } = useSearchInsights(
    { q: searchTerm },
    { query: { enabled: !!searchTerm, staleTime: 60000 } as any }
  );

  // Debounce so autocomplete costs one request per pause, not per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(input.trim()), 250);
    return () => clearTimeout(t);
  }, [input]);

  const { data: lookup } = useLookupStocks(
    { q: debounced },
    { query: { enabled: debounced.length >= 2 && showSuggest, staleTime: 300000 } as any }
  );
  const suggestions = lookup?.results ?? [];

  // Close the dropdown on any click outside the search box.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setShowSuggest(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const handleSearch = useCallback((raw?: string) => {
    const q = (raw ?? input).trim();
    if (q) {
      setSearchTerm(q);
      setShowSuggest(false);
    }
  }, [input]);

  const pick = useCallback((s: { displaySymbol: string; symbol: string }) => {
    setInput(s.displaySymbol);
    setSearchTerm(s.symbol);
    setShowSuggest(false);
  }, []);

  const price = data?.price ?? 0;
  const change = data?.change ?? 0;
  const changePct = data?.changePercent ?? 0;
  const isUp = change >= 0;

  return (
    <div className="space-y-6">
      {/* Header — heading plus subtle provenance (§5/§15). Wraps under the
          title on narrow screens so it never crowds the heading. */}
      <div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-primary" />
            Stock Insights
          </h1>
          <span className="text-xs text-muted-foreground">
            <span className="hidden sm:inline">· </span>
            Market data: {data?.priceSource ?? "Yahoo Finance"}
            {data?.lastUpdated && formatIstTime(data.lastUpdated) && (
              <> · Updated {formatIstTime(data.lastUpdated)}</>
            )}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">Real-time indicators, AI forecast, sentiment &amp; latest news for any stock</p>
      </div>

      {/* Search Bar */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative" ref={boxRef}>
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
                if (e.key === "Escape") setShowSuggest(false);
              }}
              placeholder="Search by symbol or company: HDFC Bank, RELIANCE, Infosys…"
              className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
            />

            {/* Autocomplete. Constrained to the input width so it fits on mobile. */}
            {showSuggest && suggestions.length > 0 && (
              <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-popover border border-border rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                {suggestions.map((s) => (
                  <button
                    key={s.symbol}
                    onClick={() => pick(s)}
                    className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors border-b border-border last:border-0"
                  >
                    <div className="text-sm font-semibold text-foreground break-words leading-snug">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      <span className="font-bold text-primary/80">{s.displaySymbol}</span> · {s.exchange}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => handleSearch()} disabled={isLoading || isFetching || !input.trim()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0">
            {(isLoading || isFetching) ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {(isLoading || isFetching) ? "Loading…" : "Search"}
          </button>
        </div>

        {/* Popular chips */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="text-[10px] text-muted-foreground self-center mr-1">Popular:</span>
          {POPULAR.map((s) => (
            <button key={s} onClick={() => { setInput(s); setSearchTerm(s); setShowSuggest(false); }}
              className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-accent hover:bg-primary/10 hover:text-primary border border-border transition-colors">
              {s}
            </button>
          ))}
        </div>

        <button onClick={() => setHelpOpen(true)}
          className="mt-2.5 text-[11px] text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors">
          Can't find a stock?
        </button>
      </div>

      {/* Search help — a short explainer rather than a raw URL in the UI (§8). */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setHelpOpen(false)}>
          <div className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-base mb-2 flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              Finding a stock
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Search using the NSE symbol or the company name — both work. Start typing and pick from the suggestions.
            </p>
            <ul className="text-xs text-muted-foreground mt-3 space-y-1.5">
              <li>· <span className="text-foreground font-semibold">HDFCBANK</span> or <span className="text-foreground font-semibold">HDFC Bank</span></li>
              <li>· <span className="text-foreground font-semibold">TCS</span> or <span className="text-foreground font-semibold">Tata Consultancy Services</span></li>
              <li>· Partial names work too — try <span className="text-foreground font-semibold">Bajaj</span></li>
            </ul>
            <p className="text-[11px] text-muted-foreground/70 mt-3 leading-relaxed">
              You don't need the exchange suffix. NSE and BSE listings are resolved for you.
            </p>
            <button onClick={() => setHelpOpen(false)}
              className="mt-4 w-full py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors">
              Got it
            </button>
          </div>
        </div>
      )}

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
              {(error as Error)?.message || `"${searchTerm}" not found. Try a valid NSE symbol like SBIN, RELIANCE, or COALINDIA.`}
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
                <div className="flex items-end gap-3 flex-wrap">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">
                    {data.currency === "INR" ? "₹" : "$"}{fmt(price)}
                  </span>
                  <span className={`text-sm sm:text-base font-bold mb-1 ${isUp ? "text-emerald-400" : "text-red-400"}`}>
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
              <div className="text-xl sm:text-2xl font-black mb-2 truncate">
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
              <SentimentMeter sentiment={data.sentiment} score={data.sentimentScore ?? 50} />
            </div>
          </div>

          {/* Price Chart */}
          {data.priceHistory.length > 5 && (
            <PriceChart data={data.priceHistory} symbol={data.symbol} vwap={data.vwap} />
          )}

          {/* News Section */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="font-bold flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="flex items-center gap-2">
                  <Newspaper className="w-4 h-4 text-primary" />
                  Latest News
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  ({data.news.length} {data.news.length === 1 ? "article" : "articles"}) · News: {data.newsSource ?? "Yahoo Finance"}
                </span>
              </h2>
              {data.news.length > 0 && (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                  data.sentiment === "Positive" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : data.sentiment === "Negative" ? "bg-red-500/10 text-red-400 border-red-500/30"
                  : "bg-slate-500/10 text-slate-400 border-slate-500/30"
                }`}>
                  {data.sentiment} Tone
                </span>
              )}
            </div>

            {data.news.length === 0 ? (
              <div className="text-center py-12 px-4 bg-card border border-border rounded-2xl">
                <p className="font-bold text-sm text-foreground">No recent stock-specific news found</p>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
                  No relevant articles are currently available for{" "}
                  <span className="text-foreground font-semibold">{data.name}</span>. Unrelated
                  market headlines are deliberately not shown here.
                </p>
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

// ── Main Insights Page (with sub-tabs) ────────────────────────────────────
const SUB_TABS = [
  { id: "stock", label: "Stock Insights", icon: Newspaper },
  { id: "fo", label: "F&O AI Analyzer", icon: Brain },
] as const;

type SubTab = typeof SUB_TABS[number]["id"];

export function Insights() {
  const [subTab, setSubTab] = useState<SubTab>("stock");
  return (
    <div className="space-y-5">
      {/* Sub-tab bar */}
      <div className="flex gap-1 p-1 bg-card border border-border rounded-xl w-fit max-w-full overflow-x-auto scrollbar-hide">
        {SUB_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={cn(
              "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0",
              subTab === id
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {subTab === "stock" && <StockInsights />}
      {subTab === "fo" && <FoAnalyzer />}
    </div>
  );
}
