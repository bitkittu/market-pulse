import { useState } from "react";
import {
  useGetGiftNiftyQuote,
  useGetGiftNiftyHistory,
  useGetNseMovers,
  useGetNseSectors,
} from "@workspace/api-client-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function fmt(n: number, dec = 2) {
  return n.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fmtINR(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${fmt(n)}`;
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

// ── Gift Nifty Section ────────────────────────────────────────────────────
function GiftNiftyCard() {
  const { data: quote, isLoading: qLoad } = useGetGiftNiftyQuote({ query: { refetchInterval: 30000 } });
  const [period, setPeriod] = useState<"1M" | "3M" | "6M">("3M");
  const { data: hist, isLoading: hLoad } = useGetGiftNiftyHistory({ period }, { query: { refetchInterval: 60000 } });

  const isPos = (quote?.changePercent ?? 0) >= 0;
  const color = isPos ? "#10b981" : "#ef4444";

  const chartData = (hist?.data ?? []).map((p) => ({
    ...p,
    label: format(new Date(p.timestamp), "dd MMM"),
  }));

  const minP = Math.min(...chartData.map((d) => d.low));
  const maxP = Math.max(...chartData.map((d) => d.high));
  const pad = (maxP - minP) * 0.06;

  return (
    <div className="bg-card border border-border rounded-xl p-5 glow-orange">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full tracking-wider uppercase">Gift Nifty Futures</span>
          </div>
          {qLoad ? (
            <div className="h-10 w-48 bg-muted animate-pulse rounded mt-1" />
          ) : (
            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold font-mono text-white">
                {fmt(quote?.price ?? 0, 2)}
              </span>
              <div className="pb-1">
                <ChangeChip v={quote?.changePercent ?? 0} size="lg" />
                <div className={cn("text-xs font-mono", isPos ? "text-emerald-400" : "text-red-400")}>
                  {isPos ? "+" : ""}{fmt(quote?.change ?? 0, 2)} pts
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Yesterday H/L */}
        {!qLoad && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Prev Close", value: quote?.yesterdayClose ?? 0 },
              { label: "Yesterday High", value: quote?.yesterdayHigh ?? 0, accent: "text-emerald-400" },
              { label: "Yesterday Low", value: quote?.yesterdayLow ?? 0, accent: "text-red-400" },
            ].map((item) => (
              <div key={item.label} className="bg-background/60 rounded-lg px-3 py-2 border border-border text-center">
                <p className="text-xs text-muted-foreground mb-0.5 whitespace-nowrap">{item.label}</p>
                <p className={cn("text-sm font-mono font-bold", item.accent ?? "text-foreground")}>
                  {fmt(item.value, 2)}
                </p>
                {item.accent && (
                  <p className="text-xs text-muted-foreground">
                    {item.accent === "text-emerald-400" ? "▲" : "▼"}{" "}
                    {fmt(Math.abs(((item.value - (quote?.yesterdayClose ?? 0)) / (quote?.yesterdayClose ?? 1)) * 100), 2)}%
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Period Tabs */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground font-medium">Price History</span>
        <div className="flex bg-background/60 rounded-lg p-0.5 border border-border">
          {(["1M", "3M", "6M"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1 text-xs font-mono rounded-md transition-all",
                period === p ? "bg-primary text-white font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-52">
        {hLoad ? (
          <div className="h-full bg-muted/30 animate-pulse rounded-lg" />
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
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                minTickGap={40} />
              <YAxis domain={[minP - pad, maxP + pad]} axisLine={false} tickLine={false} orientation="right"
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                tickFormatter={(v) => v.toFixed(0)} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(224,40%,9%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 12 }}
                formatter={(v: number) => [`${fmt(v)}`, "Close"]}
                labelFormatter={(l) => `Date: ${l}`}
              />
              <Area type="monotone" dataKey="close" stroke={color} strokeWidth={1.5}
                fill="url(#giftGrad)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ── Market Movers ────────────────────────────────────────────────────────
function MarketMovers() {
  const [view, setView] = useState<"gainers" | "losers">("gainers");
  const { data, isLoading } = useGetNseMovers({ query: { refetchInterval: 30000 } });
  const stocks = view === "gainers" ? (data?.gainers ?? []) : (data?.losers ?? []);
  const maxAbs = Math.max(...stocks.map((s) => Math.abs(s.changePercent)));

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          NSE Market Movers
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
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-9 bg-muted/30 animate-pulse rounded" />
          ))}
        </div>
      ) : (
        <div className="space-y-1 overflow-auto flex-1">
          {stocks.map((s, i) => {
            const isPos = s.changePercent >= 0;
            const pct = (Math.abs(s.changePercent) / maxAbs) * 100;
            return (
              <div key={s.symbol}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent/50 transition-colors group">
                <span className="text-xs text-muted-foreground font-mono w-5 shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{s.symbol}</span>
                    <span className="text-xs text-muted-foreground truncate hidden sm:block">{s.name}</span>
                  </div>
                  <div className="mt-0.5 h-1 bg-muted/40 rounded-full overflow-hidden w-full">
                    <div className={cn("h-full rounded-full transition-all", isPos ? "bg-emerald-500/60" : "bg-red-500/60")}
                      style={{ width: `${pct}%` }} />
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

// ── Sector Performance ───────────────────────────────────────────────────
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
        <div className="space-y-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-8 bg-muted/30 animate-pulse rounded" />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5 overflow-auto flex-1">
          {sorted.map((s) => {
            const isPos = s.changePercent >= 0;
            const pct = (Math.abs(s.changePercent) / maxAbs) * 100;
            return (
              <div key={s.sector} className="flex items-center gap-2 group">
                <div className="w-32 shrink-0">
                  <p className="text-xs font-semibold text-foreground truncate">{s.sector}</p>
                  <p className="text-xs text-muted-foreground font-mono">{s.index.replace("NIFTY ", "")}</p>
                </div>
                <div className="flex-1 relative h-5 flex items-center">
                  <div className="w-full h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", isPos ? "bg-emerald-500/70" : "bg-red-500/70")}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="w-16 text-right shrink-0">
                  <ChangeChip v={s.changePercent} />
                </div>
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
  return (
    <div className="space-y-5">
      <GiftNiftyCard />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MarketMovers />
        <SectorPerformance />
      </div>
    </div>
  );
}
