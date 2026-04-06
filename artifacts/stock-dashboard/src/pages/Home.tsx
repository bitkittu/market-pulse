import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetGiftNiftyQuote,
  useGetGiftNiftyHistory,
  useGetGiftNiftyIntraday,
  useGetNseMovers,
  useGetNseSectors,
  useGetIntradaySuggestions,
  useGetUpstoxSettings,
} from "@workspace/api-client-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Target, ShieldAlert, Zap, Clock, RefreshCw } from "lucide-react";

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}
function fmt(n: number, dec = 2) {
  return n.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function ChangeChip({ v, size = "sm" }: { v: number; size?: "sm" | "lg" }) {
  const pos = v >= 0;
  const cls = pos ? "text-emerald-400" : "text-red-400";
  const Icon = pos ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-mono font-semibold", cls, size === "lg" ? "text-base" : "text-xs")}>
      <Icon className={size === "lg" ? "w-4 h-4" : "w-3 h-3"} />
      {pos ? "+" : ""}{fmt(v)}%
    </span>
  );
}

// ── Hero: Today's Top Pick ────────────────────────────────────────────────
const SIG_GLOW: Record<string, { badge: string; glow: string; bar: string }> = {
  STRONG_BUY:  { badge: "bg-emerald-500/20 text-emerald-300 border-emerald-400/50", glow: "shadow-emerald-500/25",  bar: "bg-emerald-500" },
  BUY:         { badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", glow: "shadow-emerald-400/15",  bar: "bg-emerald-400" },
  WATCH:       { badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",   glow: "shadow-yellow-500/15",   bar: "bg-yellow-400" },
  SELL:        { badge: "bg-orange-500/15 text-orange-400 border-orange-500/30",   glow: "shadow-orange-500/15",   bar: "bg-orange-400" },
  STRONG_SELL: { badge: "bg-red-500/20 text-red-300 border-red-400/50",            glow: "shadow-red-500/25",      bar: "bg-red-500" },
};

function ConfidenceRing({ pct, color }: { pct: number; color: string }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width="96" height="96" className="rotate-[-90deg]">
      <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
      <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
    </svg>
  );
}

function TopPickHero() {
  const { data, isLoading } = useGetIntradaySuggestions({ query: { refetchInterval: 60000 } });

  // Pick highest-confidence stock
  const pick = data
    ? [...data].sort((a, b) => (b as any).confidence - (a as any).confidence)[0]
    : null;

  const conf: number = (pick as any)?.confidence ?? 0;
  const risk: string = (pick as any)?.riskLevel ?? "Medium";
  const sig = pick?.signal ?? "WATCH";
  const cfg = SIG_GLOW[sig] ?? SIG_GLOW.WATCH;
  const ringColor = sig.includes("BUY") ? "#10b981" : sig === "WATCH" ? "#eab308" : "#ef4444";

  const riskIcon = risk === "Low" ? <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" /> :
    risk === "High" ? <ShieldAlert className="w-3.5 h-3.5 text-red-400" /> :
    <ShieldAlert className="w-3.5 h-3.5 text-yellow-400" />;
  const riskCls = risk === "Low" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    risk === "High" ? "text-red-400 bg-red-500/10 border-red-500/20" :
    "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";

  const now = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short",
  });

  return (
    <div className={cn(
      "relative rounded-2xl border overflow-hidden",
      "bg-gradient-to-br from-[#0d1a2e] via-[#0f1e35] to-[#091220]",
      "border-primary/20 shadow-2xl",
      cfg.glow, "shadow-[0_0_40px_-8px_var(--tw-shadow-color)]"
    )}>
      {/* Background glow orb */}
      <div className={cn("absolute -top-20 -right-20 w-72 h-72 rounded-full blur-3xl opacity-10",
        sig.includes("BUY") ? "bg-emerald-500" : sig === "WATCH" ? "bg-yellow-500" : "bg-red-500")} />

      <div className="relative p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-xs font-bold text-primary uppercase tracking-widest">Today's Top Pick</span>
              <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                <Clock className="w-3 h-3" />{now} IST
              </span>
            </div>
            {isLoading ? (
              <div className="h-10 w-48 bg-muted/30 animate-pulse rounded mt-1" />
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-4xl font-black text-white font-mono tracking-tight">{pick?.symbol ?? "—"}</h2>
                <span className={cn("inline-flex items-center gap-1 px-3 py-1 rounded-xl border text-sm font-black tracking-wide", cfg.badge)}>
                  {sig.replace("_", " ")}
                </span>
                <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold", riskCls)}>
                  {riskIcon} {risk} Risk
                </span>
              </div>
            )}
            {pick && <p className="text-sm text-muted-foreground mt-1">{pick.name} · {pick.sector}</p>}
          </div>

          {/* Confidence Ring */}
          {!isLoading && pick && (
            <div className="relative shrink-0 hidden sm:flex flex-col items-center">
              <ConfidenceRing pct={conf} color={ringColor} />
              <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
                <p className="text-2xl font-black text-white font-mono">{conf.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Confidence</p>
              </div>
            </div>
          )}
        </div>

        {/* Price Grid */}
        {!isLoading && pick && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: "Current Price", value: pick.currentPrice, cls: "text-white text-xl font-black" },
                { label: "Entry (Buy Below)", value: pick.buyBelow, cls: "text-emerald-400 text-lg font-bold" },
                { label: "Target Price", value: pick.sellAbove, cls: "text-blue-400 text-lg font-bold" },
                { label: "Stop Loss", value: pick.stopLoss, cls: "text-red-400 text-lg font-bold" },
              ].map(item => (
                <div key={item.label}
                  className="bg-black/25 backdrop-blur-sm border border-white/8 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                  <p className={cn("font-mono", item.cls)}>₹{fmt(item.value)}</p>
                </div>
              ))}
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Today's Change:</span>
                <ChangeChip v={pick.changePercent} />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">RSI:</span>
                <span className={cn("font-mono font-bold",
                  pick.rsi >= 70 ? "text-red-400" : pick.rsi <= 30 ? "text-emerald-400" : "text-yellow-400")}>
                  {pick.rsi.toFixed(0)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">VWAP:</span>
                <span className={cn("font-mono font-bold",
                  pick.vwapStatus === "ABOVE" ? "text-emerald-400" : pick.vwapStatus === "BELOW" ? "text-red-400" : "text-yellow-400")}>
                  {pick.vwapStatus === "ABOVE" ? "↑ Above" : pick.vwapStatus === "BELOW" ? "↓ Below" : "≈ At"}
                </span>
              </div>
              <div className="ml-auto text-xs text-muted-foreground italic hidden sm:block max-w-xs truncate">
                "{pick.rationale}"
              </div>
            </div>
          </>
        )}
        {isLoading && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              {[0,1,2,3].map(i => <div key={i} className="h-16 bg-muted/20 animate-pulse rounded-xl" />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Gift Nifty Section ────────────────────────────────────────────────────
const DATA_SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  nse:       { label: "NSE Live",      cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  upstox:    { label: "Upstox Live",   cls: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  yahoo:     { label: "Yahoo ~15m",    cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  simulated: { label: "Simulated",     cls: "bg-muted/50 text-muted-foreground border-border" },
};

function DataSourceBadge({ src }: { src?: string }) {
  const b = DATA_SOURCE_BADGE[src ?? ""] ?? DATA_SOURCE_BADGE.simulated;
  return (
    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", b.cls)}>
      {b.label}
    </span>
  );
}

function GiftNiftyCard() {
  const { data: quote, isLoading: qLoad } = useGetGiftNiftyQuote({ query: { refetchInterval: 30000 } });
  const [period, setPeriod] = useState<"1D" | "1M" | "3M" | "6M">("3M");

  const { data: hist, isLoading: hLoad } = useGetGiftNiftyHistory(
    { period: period as "1M" | "3M" | "6M" },
    { query: { refetchInterval: 60000, enabled: period !== "1D" } }
  );
  const { data: intraday, isLoading: idLoad } = useGetGiftNiftyIntraday({
    query: { refetchInterval: 60000, enabled: period === "1D" },
  });

  const isPos = (quote?.changePercent ?? 0) >= 0;
  const color = isPos ? "#10b981" : "#ef4444";

  const histChartData = (hist?.data ?? []).map((p) => ({
    ...p,
    label: format(new Date(p.timestamp), "dd MMM"),
  }));
  const intradayChartData = (intraday?.data ?? []).map((p) => ({
    price: p.price, close: p.price, high: p.price, low: p.price, label: p.label,
  }));

  const chartData  = period === "1D" ? intradayChartData : histChartData;
  const isLoading  = period === "1D" ? idLoad : hLoad;
  const dataKey    = period === "1D" ? "price" : "close";

  const allPrices = chartData.map((d) => (period === "1D" ? (d as { price: number }).price : (d as { close: number }).close)).filter(Boolean);
  const minP = allPrices.length ? Math.min(...allPrices) : 0;
  const maxP = allPrices.length ? Math.max(...allPrices) : 0;
  const pad  = Math.max((maxP - minP) * 0.06, 10);

  const noIntradayData = period === "1D" && !idLoad && intradayChartData.length === 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full tracking-wider uppercase">Gift Nifty Futures</span>
            {!qLoad && <DataSourceBadge src={quote?.dataSource} />}
          </div>
          {qLoad ? (
            <div className="h-10 w-48 bg-muted animate-pulse rounded mt-1" />
          ) : (
            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold font-mono text-white">{fmt(quote?.price ?? 0, 2)}</span>
              <div className="pb-1">
                <ChangeChip v={quote?.changePercent ?? 0} size="lg" />
                <div className={cn("text-xs font-mono", isPos ? "text-emerald-400" : "text-red-400")}>
                  {isPos ? "+" : ""}{fmt(quote?.change ?? 0, 2)} pts
                </div>
              </div>
            </div>
          )}
        </div>
        {!qLoad && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Prev Close",  value: quote?.yesterdayClose ?? 0 },
              { label: "Day High",    value: quote?.high ?? quote?.yesterdayHigh ?? 0, accent: "text-emerald-400" },
              { label: "Day Low",     value: quote?.low ?? quote?.yesterdayLow  ?? 0, accent: "text-red-400" },
            ].map((item) => (
              <div key={item.label} className="bg-background/60 rounded-lg px-3 py-2 border border-border text-center">
                <p className="text-xs text-muted-foreground mb-0.5 whitespace-nowrap">{item.label}</p>
                <p className={cn("text-sm font-mono font-bold", item.accent ?? "text-foreground")}>{fmt(item.value, 2)}</p>
                {item.accent && (
                  <p className="text-xs text-muted-foreground">
                    {item.accent === "text-emerald-400" ? "▲" : "▼"} {fmt(Math.abs(((item.value - (quote?.yesterdayClose ?? 0)) / (quote?.yesterdayClose ?? 1)) * 100), 2)}%
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Price Chart</span>
          {period === "1D" && intraday?.source === "nse" && (
            <span className="text-[10px] text-blue-400 font-semibold">· NSE real-time</span>
          )}
        </div>
        <div className="flex bg-background/60 rounded-lg p-0.5 border border-border">
          {(["1D", "1M", "3M", "6M"] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={cn("px-3 py-1 text-xs font-mono rounded-md transition-all",
                period === p ? "bg-primary text-white font-bold" : "text-muted-foreground hover:text-foreground")}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="h-52">
        {isLoading ? (
          <div className="h-full bg-muted/30 animate-pulse rounded-lg" />
        ) : noIntradayData ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
            <span className="text-2xl">📊</span>
            <p className="text-xs">Intraday data available during NSE market hours</p>
            <p className="text-[10px] opacity-60">Mon–Fri · 9:15 AM – 3:30 PM IST</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="giftGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" axisLine={false} tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "JetBrains Mono" }} minTickGap={40} />
              <YAxis domain={[minP - pad, maxP + pad]} axisLine={false} tickLine={false} orientation="right"
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                tickFormatter={(v) => v.toFixed(0)} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(224,40%,9%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 12 }}
                formatter={(v: number) => [`₹${fmt(v)}`, period === "1D" ? "Price" : "Close"]}
                labelFormatter={(l) => period === "1D" ? `Time: ${l}` : `Date: ${l}`}
              />
              <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5}
                fill="url(#giftGrad)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ── Market Movers ─────────────────────────────────────────────────────────
function MarketMovers() {
  const [view, setView] = useState<"gainers" | "losers">("gainers");
  const { data, isLoading } = useGetNseMovers({ query: { refetchInterval: 30000 } });
  const stocks = view === "gainers" ? (data?.gainers ?? []) : (data?.losers ?? []);
  const maxAbs = Math.max(...stocks.map((s) => Math.abs(s.changePercent)));

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> NSE Market Movers
        </h2>
        <div className="flex bg-background/60 rounded-lg p-0.5 border border-border text-xs">
          <button onClick={() => setView("gainers")}
            className={cn("px-2.5 py-1 rounded-md font-semibold transition-all",
              view === "gainers" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-muted-foreground hover:text-foreground")}>
            ▲ Gainers
          </button>
          <button onClick={() => setView("losers")}
            className={cn("px-2.5 py-1 rounded-md font-semibold transition-all",
              view === "losers" ? "bg-red-500/20 text-red-400 border border-red-500/30" : "text-muted-foreground hover:text-foreground")}>
            ▼ Losers
          </button>
        </div>
      </div>
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-9 bg-muted/30 animate-pulse rounded" />)}</div>
      ) : (
        <div className="space-y-1 overflow-auto flex-1">
          {stocks.map((s, i) => {
            const isPos = s.changePercent >= 0;
            const pct = (Math.abs(s.changePercent) / maxAbs) * 100;
            return (
              <div key={s.symbol} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent/50 transition-colors">
                <span className="text-xs text-muted-foreground font-mono w-5 shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{s.symbol}</span>
                    <span className="text-xs text-muted-foreground truncate hidden sm:block">{s.name}</span>
                  </div>
                  <div className="mt-0.5 h-1 bg-muted/40 rounded-full overflow-hidden w-full">
                    <div className={cn("h-full rounded-full", isPos ? "bg-emerald-500/60" : "bg-red-500/60")} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-mono font-semibold text-foreground">₹{fmt(s.price)}</div>
                  <ChangeChip v={s.changePercent} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Sector Performance ────────────────────────────────────────────────────
function SectorPerformance() {
  const { data, isLoading } = useGetNseSectors({ query: { refetchInterval: 60000 } });
  const sorted = [...(data ?? [])].sort((a, b) => b.changePercent - a.changePercent);
  const maxAbs = Math.max(...sorted.map((s) => Math.abs(s.changePercent)));

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col h-full">
      <h2 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        NSE Sector Performance
      </h2>
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-8 bg-muted/30 animate-pulse rounded" />)}</div>
      ) : (
        <div className="space-y-1.5 overflow-auto flex-1">
          {sorted.map((s) => {
            const isPos = s.changePercent >= 0;
            const pct = (Math.abs(s.changePercent) / maxAbs) * 100;
            return (
              <div key={s.sector} className="flex items-center gap-2">
                <div className="w-32 shrink-0">
                  <p className="text-xs font-semibold text-foreground truncate">{s.sector}</p>
                  <p className="text-xs text-muted-foreground font-mono">{s.index.replace("NIFTY ", "")}</p>
                </div>
                <div className="flex-1 relative h-5 flex items-center">
                  <div className="w-full h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", isPos ? "bg-emerald-500/70" : "bg-red-500/70")} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="w-16 text-right shrink-0"><ChangeChip v={s.changePercent} /></div>
                <div className="w-10 text-right shrink-0 hidden lg:block">
                  <span className="text-xs text-muted-foreground font-mono">{s.advancers}↑</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Home() {
  const qc = useQueryClient();
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [spinning, setSpinning] = useState(false);
  const { data: upstoxSettings } = useGetUpstoxSettings({ query: {} });

  const upstoxLive = upstoxSettings?.connected && upstoxSettings?.hasAccessToken;

  const handleRefresh = useCallback(async () => {
    setSpinning(true);
    await qc.invalidateQueries();
    setLastRefreshed(new Date());
    setTimeout(() => setSpinning(false), 800);
  }, [qc]);

  const timeStr = lastRefreshed.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    timeZone: "Asia/Kolkata",
  });

  return (
    <div className="space-y-5">
      {/* Refresh bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className={`w-2 h-2 rounded-full animate-pulse ${upstoxLive ? "bg-violet-400" : "bg-blue-400"}`} />
          {upstoxLive
            ? <span>Live NSE prices via <span className="text-violet-400 font-semibold">Upstox</span> · stocks 90 sec · indices 30 sec</span>
            : <span>Indices via <span className="text-blue-400 font-semibold">NSE India</span> (real-time) · stocks via Yahoo Finance</span>
          }
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
            <Clock className="w-3 h-3" /> Updated {timeStr} IST
          </span>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary text-xs font-bold transition-all"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", spinning && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      <TopPickHero />
      <GiftNiftyCard />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MarketMovers />
        <SectorPerformance />
      </div>
    </div>
  );
}
