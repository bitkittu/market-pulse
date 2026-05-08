import { useState } from "react";
import { useFoAnalyzer, FoAnalysisResult } from "@workspace/api-client-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell,
} from "recharts";
import {
  Zap, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2,
  Target, Activity, BarChart2, ArrowUpRight, ArrowDownRight, Shield,
  RefreshCw, Brain, Clock, DollarSign, Layers, ChevronRight,
  CircleAlert, Flame, Eye, BadgeAlert,
} from "lucide-react";

function cn(...c: (string | false | undefined | null)[]) { return c.filter(Boolean).join(" "); }
function inr(v: number, d = 2) {
  return v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function sign(v: number) { return v >= 0 ? `+₹${inr(Math.abs(v))}` : `-₹${inr(Math.abs(v))}`; }

const DECISION_CFG = {
  HOLD:         { cls: "bg-blue-500/15 border-blue-500/30 text-blue-400",       glow: "shadow-blue-500/20",   icon: Eye,          label: "HOLD",         desc: "Maintain current position" },
  SELL:         { cls: "bg-red-500/15 border-red-500/30 text-red-400",          glow: "shadow-red-500/20",    icon: TrendingDown, label: "SELL",         desc: "Exit position immediately" },
  BOOK_PROFIT:  { cls: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400", glow: "shadow-emerald-500/20", icon: CheckCircle2, label: "BOOK PROFIT",  desc: "Take profits now" },
  WAIT:         { cls: "bg-amber-500/15 border-amber-500/30 text-amber-400",    glow: "shadow-amber-500/20",  icon: Clock,        label: "WAIT",         desc: "Hold & monitor closely" },
  ADD_MORE:     { cls: "bg-violet-500/15 border-violet-500/30 text-violet-400", glow: "shadow-violet-500/20", icon: Layers,       label: "ADD MORE",     desc: "Average & scale in" },
  AVOID_TRADE:  { cls: "bg-orange-500/15 border-orange-500/30 text-orange-400", glow: "shadow-orange-500/20", icon: AlertTriangle, label: "AVOID",        desc: "Trade setup is weak" },
};

const DIR_CFG = {
  Bullish:  { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: TrendingUp },
  Bearish:  { cls: "bg-red-500/15 text-red-400 border-red-500/30",            icon: TrendingDown },
  Sideways: { cls: "bg-slate-500/15 text-slate-400 border-slate-500/30",      icon: Minus },
};

const RISK_CFG = {
  Low:    { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: Shield },
  Medium: { cls: "bg-amber-500/15 text-amber-400 border-amber-500/30",      icon: BadgeAlert },
  High:   { cls: "bg-red-500/15 text-red-400 border-red-500/30",            icon: Flame },
};

const POPULAR_SYMBOLS = ["NIFTY", "BANKNIFTY", "RELIANCE", "TCS", "INFY", "SBIN", "HDFCBANK", "TATAMOTORS", "BAJFINANCE", "ICICIBANK"];

// ── Mini RSI Arc ──────────────────────────────────────────────────────────
function RsiArc({ rsi }: { rsi: number }) {
  const r = 28, cx = 36, cy = 36;
  const circ = Math.PI * r;
  const off = circ * (1 - rsi / 100);
  const col = rsi >= 70 ? "#ef4444" : rsi <= 30 ? "#22c55e" : "#60a5fa";
  return (
    <div className="flex flex-col items-center">
      <svg width={72} height={46} viewBox="0 0 72 46">
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} stroke="#1e293b" strokeWidth={8} fill="none" />
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} stroke={col} strokeWidth={8} fill="none"
          strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" />
        <text x={cx} y={cy-2} textAnchor="middle" fontSize={15} fontWeight={700} fill={col}>{rsi}</text>
      </svg>
      <span className="text-[10px] font-semibold" style={{ color: col }}>
        {rsi >= 70 ? "Overbought" : rsi <= 30 ? "Oversold" : "Neutral"}
      </span>
    </div>
  );
}

// ── Confidence Bar ────────────────────────────────────────────────────────
function ConfidenceBar({ value, label }: { value: number; label: string }) {
  const col = value >= 70 ? "from-emerald-600 to-emerald-400"
    : value >= 50 ? "from-amber-600 to-amber-400"
    : "from-red-700 to-red-500";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="font-black text-foreground">{value}%</span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", col)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

// ── Intraday Chart ────────────────────────────────────────────────────────
function IntradayChart({ data, livePrice, vwap }: {
  data: FoAnalysisResult["priceChart"]; livePrice: number; vwap: number;
}) {
  // Split into actual vs predicted, bridging at junction point
  const lastActualIdx = data.reduce((acc, d, i) => (!d.predicted ? i : acc), -1);
  const chartData = data.map((d, i) => ({
    time: d.time,
    actualPrice: !d.predicted ? d.price : (i === lastActualIdx + 1 ? data[lastActualIdx]?.price : null),
    predictedPrice: d.predicted ? d.price : (i === lastActualIdx ? d.price : null),
  }));

  const all = data.map((d) => d.price);
  const mn = Math.min(...all) * 0.998, mx = Math.max(...all) * 1.002;
  const first = data[0]?.price ?? livePrice;
  const lastActual = data[lastActualIdx]?.price ?? livePrice;
  const up = lastActual >= first;
  const lineColor = up ? "#22c55e" : "#ef4444";

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm">Intraday Trend</span>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-5 h-0.5 inline-block rounded" style={{ background: lineColor }} />Actual
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground opacity-60">
            <span className="w-5 h-0.5 inline-block rounded border-t-2 border-dashed" style={{ borderColor: lineColor }} />AI Forecast
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="time" tick={{ fontSize: 8, fill: "#64748b" }} interval={4} />
          <YAxis domain={[mn, mx]} tick={{ fontSize: 8, fill: "#64748b" }}
            tickFormatter={(v) => `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} width={55} />
          <RTooltip
            contentStyle={{ background: "#0d1526", border: "1px solid #1e293b", borderRadius: 8, fontSize: 10 }}
            formatter={(v: number, name: string) => [`₹${inr(v)}`, name === "predictedPrice" ? "AI Forecast" : "Price"]}
            labelStyle={{ color: "#94a3b8" }}
          />
          {vwap > 0 && (
            <ReferenceLine y={vwap} stroke="#f97316" strokeDasharray="4 2" strokeWidth={1.5}
              label={{ value: `VWAP ₹${vwap.toFixed(0)}`, position: "insideTopRight", fontSize: 8, fill: "#f97316" }} />
          )}
          <ReferenceLine y={livePrice} stroke={lineColor} strokeDasharray="2 2" strokeWidth={1}
            label={{ value: `Live ₹${livePrice.toFixed(0)}`, position: "insideBottomRight", fontSize: 8, fill: lineColor }} />
          <Line type="monotone" dataKey="actualPrice" stroke={lineColor} dot={false} strokeWidth={2}
            connectNulls={false} name="actualPrice" />
          <Line type="monotone" dataKey="predictedPrice" stroke={lineColor} dot={false} strokeWidth={1.5}
            strokeDasharray="5 3" strokeOpacity={0.6} connectNulls={false} name="predictedPrice" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── P&L Projection Chart ──────────────────────────────────────────────────
function PnlChart({ pnl, input }: { pnl: FoAnalysisResult["pnl"]; input: { lots: number; lotSize: number } }) {
  const scenarios = [
    { name: "Max Loss", value: pnl.maxLoss, fill: "#ef4444" },
    { name: "Current", value: pnl.currentPnl, fill: pnl.currentPnl >= 0 ? "#60a5fa" : "#f97316" },
    { name: "Target", value: pnl.targetPnl, fill: "#22c55e" },
  ];
  const maxAbs = Math.max(...scenarios.map((s) => Math.abs(s.value)), 1);
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="w-4 h-4 text-primary" />
        <span className="font-bold text-sm">P&L Projection ({input.lots} lot{input.lots > 1 ? "s" : ""} × {input.lotSize})</span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={scenarios} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#64748b" }} />
          <YAxis domain={[-maxAbs * 1.1, maxAbs * 1.1]} tick={{ fontSize: 8, fill: "#64748b" }}
            tickFormatter={(v) => v >= 0 ? `+₹${(v / 1000).toFixed(0)}K` : `-₹${(Math.abs(v) / 1000).toFixed(0)}K`} width={50} />
          <RTooltip
            contentStyle={{ background: "#0d1526", border: "1px solid #1e293b", borderRadius: 8, fontSize: 10 }}
            formatter={(v: number) => [sign(v), "P&L"]}
            labelStyle={{ color: "#94a3b8" }}
          />
          <ReferenceLine y={0} stroke="#334155" strokeWidth={1} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {scenarios.map((s, i) => <Cell key={i} fill={s.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Analysis Results ──────────────────────────────────────────────────────
function AnalysisResults({ data, formInput }: {
  data: FoAnalysisResult;
  formInput: { lots: number };
}) {
  const dec = DECISION_CFG[data.decision];
  const dir = DIR_CFG[data.direction];
  const risk = RISK_CFG[data.riskLevel];
  const DecIcon = dec.icon;
  const DirIcon = dir.icon;
  const RiskIcon = risk.icon;
  const livePriceUp = data.liveChange >= 0;

  return (
    <div className="space-y-4">
      {/* Live Price Banner */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xl font-black tracking-tight">{data.symbol}</span>
              <span className="text-sm text-muted-foreground font-medium">{data.strikePrice} {data.optionType}</span>
              <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border", dir.cls)}>
                <DirIcon className="w-3 h-3 inline mr-0.5" />{data.direction}
              </span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black">₹{inr(data.livePrice)}</span>
              <span className={cn("text-sm font-bold mb-0.5 flex items-center gap-0.5", livePriceUp ? "text-emerald-400" : "text-red-400")}>
                {livePriceUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {livePriceUp ? "+" : ""}{inr(data.liveChange)} ({livePriceUp ? "+" : ""}{data.liveChangePct.toFixed(2)}%)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn("text-xs px-2.5 py-1 rounded-full border font-bold", risk.cls)}>
              <RiskIcon className="w-3 h-3 inline mr-0.5" />{data.riskLevel} Risk
            </div>
            <div className="text-xs px-2.5 py-1 rounded-full border font-bold bg-primary/10 text-primary border-primary/20">
              {data.daysToExpiry === 0 ? "EXPIRY TODAY" : `${data.daysToExpiry}D to Expiry`}
            </div>
          </div>
        </div>
      </div>

      {/* AI Decision */}
      <div className={cn("border rounded-2xl p-5 shadow-lg", dec.cls, dec.glow)}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-current/10 flex items-center justify-center">
              <DecIcon className="w-7 h-7" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest opacity-70 mb-0.5">AI Decision Engine</div>
              <div className="text-2xl font-black tracking-wide">{dec.label}</div>
              <div className="text-xs opacity-80 font-medium mt-0.5">{dec.desc}</div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-widest opacity-70 mb-1">AI Confidence</div>
            <div className="text-3xl font-black">{data.confidence}%</div>
          </div>
        </div>
        <div className="mt-4">
          <ConfidenceBar value={data.confidence} label="Confidence" />
        </div>
      </div>

      {/* Quick Stats 4-grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Direction", value: data.direction,
            sub: `Bull Score`,
            cls: dir.cls, Icon: DirIcon,
          },
          {
            label: "Decision", value: dec.label,
            sub: dec.desc.split(" ").slice(0, 3).join(" "),
            cls: dec.cls, Icon: DecIcon,
          },
          {
            label: "Risk Level", value: data.riskLevel,
            sub: `${data.daysToExpiry}d to expiry`,
            cls: risk.cls, Icon: RiskIcon,
          },
          {
            label: "Momentum", value: data.indicators.momentum,
            sub: `Trend: ${data.indicators.trend}`,
            cls: "bg-primary/10 text-primary border-primary/20", Icon: Zap,
          },
        ].map((s) => (
          <div key={s.label} className={cn("border rounded-xl p-3", s.cls)}>
            <div className="flex items-center gap-1.5 mb-2">
              <s.Icon className="w-3.5 h-3.5" />
              <span className="text-[10px] uppercase tracking-wide opacity-70">{s.label}</span>
            </div>
            <div className="font-black text-sm leading-tight">{s.value}</div>
            <div className="text-[10px] opacity-60 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* P&L Summary */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm">P&L Summary</span>
          <span className="ml-auto text-xs text-muted-foreground">Lot Size: {data.pnl.lotSize} units</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Current P&L", value: sign(data.pnl.currentPnl), sub: `${data.pnl.currentPnlPct >= 0 ? "+" : ""}${data.pnl.currentPnlPct.toFixed(1)}%`, pos: data.pnl.currentPnl >= 0 },
            { label: "Target P&L", value: sign(data.pnl.targetPnl), sub: "At target premium", pos: true },
            { label: "Max Loss", value: `-₹${inr(Math.abs(data.pnl.maxLoss))}`, sub: "At stop loss", pos: false },
            { label: "Capital Deployed", value: `₹${inr(data.pnl.totalPremiumPaid)}`, sub: `${formInput.lots} lot(s)`, pos: null },
          ].map((row) => (
            <div key={row.label} className="bg-background rounded-xl p-3">
              <div className="text-[10px] text-muted-foreground mb-1">{row.label}</div>
              <div className={cn("text-sm font-black", row.pos === true ? "text-emerald-400" : row.pos === false ? "text-red-400" : "text-foreground")}>
                {row.value}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{row.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Indicators Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* RSI */}
        <div className="col-span-1 bg-card border border-border rounded-xl p-3 flex flex-col items-center justify-center">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">RSI (14)</span>
          <RsiArc rsi={data.indicators.rsi} />
        </div>
        {/* VWAP */}
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">VWAP</div>
          <div className="text-base font-black">₹{inr(data.indicators.vwap)}</div>
          <div className={cn("text-[10px] font-bold mt-1 flex items-center gap-0.5", data.livePrice >= data.indicators.vwap ? "text-emerald-400" : "text-red-400")}>
            {data.livePrice >= data.indicators.vwap ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {data.livePrice >= data.indicators.vwap ? "Above" : "Below"} VWAP
          </div>
        </div>
        {/* PCR */}
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">PCR Ratio</div>
          <div className="text-base font-black">{data.indicators.pcr.toFixed(2)}</div>
          <div className={cn("text-[10px] font-bold mt-1", data.indicators.pcr < 0.7 ? "text-emerald-400" : data.indicators.pcr > 1.3 ? "text-red-400" : "text-amber-400")}>
            {data.indicators.pcr < 0.7 ? "Bullish" : data.indicators.pcr > 1.3 ? "Bearish" : "Neutral"}
          </div>
        </div>
        {/* OI */}
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Open Interest</div>
          <div className="text-base font-black">{data.indicators.oi}</div>
          <div className={cn("text-[10px] font-bold mt-1", data.indicators.oi === "Building" ? "text-emerald-400" : data.indicators.oi === "Unwinding" ? "text-red-400" : "text-slate-400")}>
            {data.indicators.oi === "Building" ? "↑ Bullish" : data.indicators.oi === "Unwinding" ? "↓ Bearish" : "→ Stable"}
          </div>
        </div>
        {/* Support */}
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Support</div>
          <div className="text-sm font-black text-emerald-400">₹{inr(data.indicators.support)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Day low zone</div>
        </div>
        {/* Resistance */}
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Resistance</div>
          <div className="text-sm font-black text-red-400">₹{inr(data.indicators.resistance)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Day high zone</div>
        </div>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((a, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-semibold">
              <CircleAlert className="w-4 h-4 shrink-0 mt-0.5" />
              {a}
            </div>
          ))}
        </div>
      )}

      {/* AI Rationale */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm">AI Rationale</span>
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold border border-primary/20">AI GENERATED</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{data.rationale}</p>
      </div>

      {/* Smart Insights + Exit Suggestion row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Smart Insights */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-sm">Smart Insights</span>
          </div>
          <ul className="space-y-2">
            {data.insights.map((ins, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                {ins}
              </li>
            ))}
            {data.indicators.volumeSpike && (
              <li className="flex items-center gap-2 text-xs text-violet-400 font-semibold">
                <Activity className="w-3.5 h-3.5 shrink-0" />
                Volume spike — institutional activity detected
              </li>
            )}
          </ul>
        </div>

        {/* Exit Suggestion */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm">Smart Exit Strategy</span>
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Suggested Exit</span>
              <span className="font-bold text-foreground">₹{inr(data.exitSuggestion.price)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Trailing Stop Loss</span>
              <span className="font-bold text-red-400">₹{inr(data.exitSuggestion.stopLoss)}</span>
            </div>
            <div className="border-t border-border pt-2.5">
              <div className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide">Target Levels</div>
              <div className="flex gap-2">
                {data.exitSuggestion.targets.map((t, i) => (
                  <div key={i} className="flex-1 text-center bg-emerald-500/10 border border-emerald-500/20 rounded-lg py-1.5 text-xs font-bold text-emerald-400">
                    T{i + 1}<br />
                    <span className="text-[10px] font-normal">₹{inr(t)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between text-xs pt-1 border-t border-border">
              <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />Hold Duration</span>
              <span className="font-bold">{data.exitSuggestion.holdDuration}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Best Exit Time</span>
              <span className="font-bold text-primary">{data.exitSuggestion.bestExitTime}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <IntradayChart data={data.priceChart} livePrice={data.livePrice} vwap={data.indicators.vwap} />
        <PnlChart pnl={data.pnl} input={{ lots: formInput.lots, lotSize: data.pnl.lotSize }} />
      </div>
    </div>
  );
}

// ── Form ──────────────────────────────────────────────────────────────────
const INITIAL = {
  symbol: "NIFTY",
  optionType: "CE" as "CE" | "PE" | "FUT",
  strikePrice: "",
  buyPrice: "",
  currentPremium: "",
  lots: "1",
  expiry: "",
  entryTime: "",
  stopLoss: "",
  target: "",
};

export function FoAnalyzer() {
  const [form, setForm] = useState(INITIAL);
  const [result, setResult] = useState<FoAnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [formLots, setFormLots] = useState(1);

  const mut = useFoAnalyzer({
    mutation: {
      onSuccess: (data) => { setResult(data); setError(""); },
      onError: () => setError("Analysis failed — check the values and try again."),
    },
  });

  const field = (k: keyof typeof INITIAL) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value })),
  });

  const inputCls = "w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono";
  const labelCls = "text-[10px] text-muted-foreground font-bold uppercase tracking-wide mb-1 block";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.symbol || !form.strikePrice || !form.buyPrice || !form.currentPremium || !form.lots || !form.expiry) {
      setError("Please fill all required fields.");
      return;
    }
    const lots = Number(form.lots);
    setFormLots(lots);
    setError("");
    mut.mutate({
      data: {
        symbol: form.symbol.toUpperCase().trim(),
        optionType: form.optionType,
        strikePrice: Number(form.strikePrice),
        buyPrice: Number(form.buyPrice),
        currentPremium: Number(form.currentPremium),
        lots,
        expiry: form.expiry,
        entryTime: form.entryTime || undefined,
        stopLoss: form.stopLoss ? Number(form.stopLoss) : undefined,
        target: form.target ? Number(form.target) : undefined,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2 mb-1">
          <Brain className="w-5 h-5 text-primary" />
          F&O AI Analyzer
        </h1>
        <p className="text-sm text-muted-foreground">Enter your Futures & Options trade to get AI-powered analysis, smart exit suggestions, P&L projections and live market signals.</p>
      </div>

      {/* Trade Entry Form */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm">Trade Details</span>
          <span className="ml-auto text-[10px] text-muted-foreground">* required</span>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* Row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Symbol *</label>
              <input {...field("symbol")} placeholder="NIFTY, RELIANCE, TCS…" className={inputCls} />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {POPULAR_SYMBOLS.slice(0, 5).map((s) => (
                  <button type="button" key={s} onClick={() => setForm((f) => ({ ...f, symbol: s }))}
                    className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border transition-colors",
                      form.symbol === s ? "bg-primary/15 text-primary border-primary/30" : "bg-accent hover:bg-primary/10 hover:text-primary border-border")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Option Type *</label>
              <select {...field("optionType")} className={inputCls}>
                <option value="CE">CE — Call Option</option>
                <option value="PE">PE — Put Option</option>
                <option value="FUT">FUT — Futures</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Strike Price *</label>
              <input {...field("strikePrice")} type="number" placeholder="e.g. 24500" className={inputCls} />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Buy Price (Entry Premium) *</label>
              <input {...field("buyPrice")} type="number" step="0.05" placeholder="e.g. 85.50" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Current Premium *</label>
              <input {...field("currentPremium")} type="number" step="0.05" placeholder="e.g. 92.00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Number of Lots *</label>
              <input {...field("lots")} type="number" min="1" max="500" placeholder="1" className={inputCls} />
            </div>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Expiry Date *</label>
              <input {...field("expiry")} type="date" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Entry Time (IST)</label>
              <input {...field("entryTime")} type="time" placeholder="09:30" className={inputCls} />
            </div>
          </div>

          {/* Row 4 — optional */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Stop Loss Premium <span className="normal-case text-muted-foreground/50">(optional)</span></label>
              <input {...field("stopLoss")} type="number" step="0.05" placeholder="e.g. 45.00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Target Premium <span className="normal-case text-muted-foreground/50">(optional)</span></label>
              <input {...field("target")} type="number" step="0.05" placeholder="e.g. 150.00" className={inputCls} />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 rounded-xl px-3 py-2.5 border border-red-500/20">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button type="submit" disabled={mut.isPending}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 text-sm">
            {mut.isPending
              ? <><RefreshCw className="w-4 h-4 animate-spin" />Analyzing with AI…</>
              : <><Brain className="w-4 h-4" />Analyze Trade</>}
          </button>
        </form>
      </div>

      {/* Loading */}
      {mut.isPending && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-14 h-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <div className="text-center">
            <p className="font-bold text-foreground">AI is analyzing your trade…</p>
            <p className="text-sm text-muted-foreground mt-1">Fetching live price · Computing indicators · Generating insights</p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !mut.isPending && (
        <AnalysisResults data={result} formInput={{ lots: formLots }} />
      )}

      {/* Empty state */}
      {!result && !mut.isPending && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Brain className="w-8 h-8 text-primary/60" />
          </div>
          <h3 className="text-base font-bold">Enter your trade above</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Fill in your option or futures trade details and the AI engine will generate a comprehensive analysis with live market data.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {["Live Price", "RSI", "VWAP", "OI Trend", "PCR", "P&L Projection", "Exit Strategy", "Smart Insights"].map((f) => (
              <span key={f} className="text-xs text-muted-foreground px-3 py-1.5 rounded-full bg-card border border-border">{f}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
