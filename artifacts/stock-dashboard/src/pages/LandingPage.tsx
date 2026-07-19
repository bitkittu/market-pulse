import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  TrendingUp, TrendingDown, BarChart2, Brain, Bell, Shield, Activity,
  Globe, Newspaper, Briefcase, Target, Zap, ChevronDown, ChevronRight,
  ArrowRight, Star, Check, Menu, X, Users, Database, Server, Clock,
  LineChart, AlertTriangle, PieChart, Layers
} from "lucide-react";

// ── Data ──────────────────────────────────────────────────────────────────
const TICKER_DATA = [
  { sym: "NIFTY 50", val: "24,620.50", chg: "+0.43%", up: true },
  { sym: "SENSEX",   val: "81,332.74", chg: "+0.38%", up: true },
  { sym: "BANK NIFTY", val: "52,480.10", chg: "+0.21%", up: true },
  { sym: "INDIA VIX",  val: "14.82",    chg: "-2.10%", up: false },
  { sym: "GIFT NIFTY", val: "24,758.00", chg: "+0.56%", up: true },
  { sym: "RELIANCE",   val: "2,945.30",  chg: "+1.24%", up: true },
  { sym: "TCS",        val: "3,842.60",  chg: "-0.31%", up: false },
  { sym: "HDFCBANK",   val: "1,892.30",  chg: "+3.21%", up: true },
  { sym: "INFY",       val: "1,654.70",  chg: "+2.89%", up: true },
  { sym: "TATASTEEL",  val: "167.85",    chg: "+4.82%", up: true },
];

const FEATURES = [
  { icon: Brain,      title: "AI Market Analysis",      desc: "GPT-powered analysis of market movements and trade signals for every session." },
  { icon: LineChart,  title: "Daily Market Outlook",    desc: "Pre-market report delivered before 9:00 AM with actionable insights." },
  { icon: BarChart2,  title: "Technical Indicators",    desc: "50+ indicators including RSI, MACD, Bollinger Bands, and Supertrend." },
  { icon: Globe,      title: "Institutional Buying",    desc: "Track FII and DII activity to follow the smart money in real time." },
  { icon: Activity,   title: "Options Chain Analysis",  desc: "Open interest, PCR, max pain and IV crush alerts for options traders." },
  { icon: Layers,     title: "Sector Rotation",         desc: "Identify sectors gaining momentum and sectors to avoid each week." },
  { icon: Briefcase,  title: "Portfolio Tracking",      desc: "Monitor your holdings P&L, XIRR, and compare against benchmarks." },
  { icon: Star,       title: "Smart Watchlists",        desc: "Create multiple themed watchlists with price alerts and signals." },
  { icon: AlertTriangle, title: "Risk Score",           desc: "AI-generated risk score for each trade setup based on historical data." },
  { icon: Newspaper,  title: "News Sentiment",          desc: "Real-time news sentiment analysis for your watchlist stocks." },
  { icon: Bell,       title: "Price Alerts",            desc: "Instant alerts via browser or email when targets or supports are hit." },
  { icon: PieChart,   title: "FII/DII Activity",        desc: "Daily buy/sell data for Foreign and Domestic Institutional Investors." },
];

const INDICATORS = [
  {
    num: "01", title: "GIFT Nifty",
    icon: Globe, color: "from-blue-500 to-cyan-500",
    why: "Predicts NSE opening direction before 9:15 AM",
    desc: "The Singapore-based Nifty futures contract trades overnight. A premium GIFT Nifty suggests a bullish gap-up; a discount signals a gap-down.",
    example: { label: "Current", value: "+158 pts", sub: "Gap-up expected" },
  },
  {
    num: "02", title: "India VIX",
    icon: Activity, color: "from-violet-500 to-purple-500",
    why: "Measures fear and uncertainty in the market",
    desc: "VIX below 15 signals calm markets; above 20 means high volatility. Options traders watch VIX to price contracts correctly.",
    example: { label: "Today", value: "14.82", sub: "Low volatility zone" },
  },
  {
    num: "03", title: "FII / DII Activity",
    icon: Users, color: "from-emerald-500 to-teal-500",
    why: "Institutional flows drive large market moves",
    desc: "When FIIs buy consistently, markets rally. When they sell, markets struggle. Watch net flows to confirm or contradict price action.",
    example: { label: "Net FII", value: "+₹4,280 Cr", sub: "Strong buying day" },
  },
  {
    num: "04", title: "Global Markets",
    icon: Globe, color: "from-amber-500 to-orange-500",
    why: "US, Europe, and Asia set the overnight tone",
    desc: "Dow Jones, NASDAQ, Nikkei, and Hang Seng heavily influence Nifty opening. A red overnight session usually means a soft opening.",
    example: { label: "Nasdaq", value: "+0.82%", sub: "US markets positive" },
  },
  {
    num: "05", title: "Advance / Decline",
    icon: BarChart2, color: "from-rose-500 to-pink-500",
    why: "Shows the true breadth of the market move",
    desc: "If Nifty rises but 70% of stocks fall, the rally is narrow and weak. A broad advance with 80%+ stocks up signals a strong bull session.",
    example: { label: "A/D Ratio", value: "1,820 / 842", sub: "Broad market rally" },
  },
];

const GAINERS = [
  { sym: "TATASTEEL", name: "Tata Steel",    price: "167.85",    chg: "+4.82%" },
  { sym: "HDFCBANK",  name: "HDFC Bank",     price: "1,892.30",  chg: "+3.21%" },
  { sym: "INFY",      name: "Infosys",        price: "1,654.70",  chg: "+2.89%" },
  { sym: "WIPRO",     name: "Wipro",          price: "298.45",    chg: "+2.54%" },
  { sym: "MARUTI",    name: "Maruti Suzuki",  price: "12,450.60", chg: "+2.12%" },
];
const LOSERS = [
  { sym: "POWERGRID", name: "Power Grid",    price: "287.30",    chg: "-2.34%" },
  { sym: "SUNPHARMA", name: "Sun Pharma",    price: "1,632.45",  chg: "-1.98%" },
  { sym: "NTPC",      name: "NTPC",          price: "342.80",    chg: "-1.45%" },
  { sym: "COALINDIA", name: "Coal India",    price: "445.20",    chg: "-1.23%" },
  { sym: "ONGC",      name: "ONGC",          price: "268.55",    chg: "-0.98%" },
];

const PRICING = [
  {
    name: "Starter", price: "Free", period: "",
    badge: null, color: "border-slate-700",
    features: ["5 stocks watchlist", "Daily market summary", "Basic technical indicators", "Top 5 gainers/losers", "Market news feed"],
    cta: "Get Started Free", ctaStyle: "border border-slate-600 text-white hover:border-blue-500 hover:bg-blue-500/10",
  },
  {
    name: "Pro", price: "₹49", period: "/month",
    badge: "Most Popular", color: "border-blue-500/50",
    features: ["Unlimited watchlist", "AI daily market report", "50+ technical indicators", "FII/DII live activity", "Options chain analysis", "Price & signal alerts", "Portfolio analytics"],
    cta: "Start Pro Trial", ctaStyle: "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white",
  },
  {
    name: "Premium", price: "₹199", period: "/month",
    badge: "Best Value", color: "border-emerald-500/50",
    features: ["Everything in Pro", "AI trade signals daily", "Institutional flow alerts", "Sector rotation signals", "Priority email support", "Strategy backtesting", "Downloadable reports", "API access (beta)"],
    cta: "Go Premium", ctaStyle: "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white",
  },
];

const FAQS = [
  { q: "What is Market Pulse AI?", a: "Market Pulse AI is an Indian stock market intelligence platform that provides AI-generated insights, technical analysis, institutional activity tracking, and pre-market reports to help retail investors make informed decisions." },
  { q: "Which markets does it cover?", a: "We cover NSE and BSE — equities, F&O, ETFs, and sector indices. Data is sourced from NSE APIs with intraday granularity during market hours (9:15 AM – 3:30 PM IST)." },
  { q: "Is my portfolio data secure?", a: "Absolutely. Portfolio data is stored in an encrypted database. We never store your broker login credentials — Upstox integration uses OAuth tokens that expire within 24 hours." },
  { q: "How accurate are the AI signals?", a: "Our AI signals are decision-support tools based on technical patterns, news sentiment, and institutional flows. They are not financial advice. Always apply your own risk management." },
  { q: "Can I cancel my subscription anytime?", a: "Yes. Cancel anytime from your account settings with no lock-in or penalty. Your access continues until the end of the billing period." },
  { q: "Do I need a broker account to use this?", a: "No. The platform works without any broker connection. Connecting your Upstox account (optional) enables live price quotes during market hours." },
];

// ── Ticker Tape ───────────────────────────────────────────────────────────
function TickerTape() {
  const items = [...TICKER_DATA, ...TICKER_DATA];
  return (
    <div className="w-full h-10 overflow-hidden bg-slate-900/95 border-b border-slate-700/60 flex items-center">
      <div className="flex gap-8 animate-ticker whitespace-nowrap">
        {items.map((t, i) => (
          <span key={i} className="flex items-center gap-2 shrink-0 text-xs">
            <span className="text-slate-400 font-medium">{t.sym}</span>
            <span className="text-white font-mono font-bold">{t.val}</span>
            <span className={`flex items-center gap-0.5 font-mono font-semibold ${t.up ? "text-emerald-400" : "text-red-400"}`}>
              {t.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {t.chg}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Counter ───────────────────────────────────────────────────────────────
function Counter({ end, suffix = "" }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        let start = 0;
        const duration = 1500;
        const step = end / (duration / 16);
        const timer = setInterval(() => {
          start = Math.min(start + step, end);
          setCount(Math.floor(start));
          if (start >= end) clearInterval(timer);
        }, 16);
      }
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [end]);

  return <span ref={ref}>{count.toLocaleString("en-IN")}{suffix}</span>;
}

// ── Fade-in Section ───────────────────────────────────────────────────────
function FadeSection({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}>
      {children}
    </div>
  );
}

// ── Live Market Snapshot ────────────────────────────────────────────────────
interface LiveIndex { value: number; change: number; changePercent: number; up: boolean; }
interface LiveSnapshot {
  niftyFifty: LiveIndex;
  bankNifty: LiveIndex;
  indiaVix: LiveIndex;
  giftNifty: LiveIndex;
  topMover: { symbol: string; changePercent: number } | null;
  updatedAt: string;
}

const SNAPSHOT_STORAGE_KEY = "mp-landing-live-snapshot";

// Seed values shown before the first live fetch resolves (or if it never has, e.g. offline).
const FALLBACK_SNAPSHOT: LiveSnapshot = {
  niftyFifty: { value: 24620.50, change: 106.35, changePercent: 0.43, up: true },
  bankNifty:  { value: 52480.10, change: 108.25, changePercent: 0.21, up: true },
  indiaVix:   { value: 14.82,    change: -0.32,  changePercent: -2.10, up: false },
  giftNifty:  { value: 24758.00, change: 138.20, changePercent: 0.56, up: true },
  topMover:   { symbol: "TATASTEEL", changePercent: 4.82 },
  updatedAt:  new Date(0).toISOString(),
};

function isMarketOpenIST(): boolean {
  const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const day = ist.getDay();
  if (day === 0 || day === 6) return false;
  const minutes = ist.getHours() * 60 + ist.getMinutes();
  return minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30;
}

function readStoredSnapshot(): LiveSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LiveSnapshot) : null;
  } catch {
    return null;
  }
}

// Fetches Nifty 50 / Bank Nifty / India VIX / Gift Nifty + the day's top mover.
// Polls every 15s while NSE is open (Mon-Fri 09:15-15:30 IST). While closed (or
// on a failed fetch) it keeps showing the last successfully fetched values,
// persisted in localStorage so a reload after hours still shows pre-close data.
function useLiveMarketSnapshot() {
  const [snapshot, setSnapshot] = useState<LiveSnapshot>(() => readStoredSnapshot() ?? FALLBACK_SNAPSHOT);
  const [hasLiveData, setHasLiveData] = useState(() => readStoredSnapshot() !== null);
  const [marketOpen, setMarketOpen] = useState(isMarketOpenIST());

  useEffect(() => {
    let cancelled = false;

    async function fetchOnce() {
      setMarketOpen(isMarketOpenIST());
      try {
        const [niftyRes, sectorsRes, vixRes, moversRes] = await Promise.all([
          fetch("/api/gift-nifty/quote").then(r => r.json()),
          fetch("/api/nse/sectors").then(r => r.json()),
          fetch("/api/nse/india-vix").then(r => r.json()),
          fetch("/api/nse/movers").then(r => r.json()),
        ]);

        const banking = Array.isArray(sectorsRes)
          ? sectorsRes.find((s: { sector: string }) => s.sector === "Banking")
          : null;
        if (!banking) return; // incomplete response — keep last known snapshot

        const topGainer = moversRes?.gainers?.[0];
        const next: LiveSnapshot = {
          niftyFifty: { value: niftyRes.price, change: niftyRes.change, changePercent: niftyRes.changePercent, up: niftyRes.change >= 0 },
          giftNifty:  { value: niftyRes.price, change: niftyRes.change, changePercent: niftyRes.changePercent, up: niftyRes.change >= 0 },
          bankNifty:  { value: banking.value, change: banking.change, changePercent: banking.changePercent, up: banking.change >= 0 },
          indiaVix:   { value: vixRes.price, change: vixRes.change, changePercent: vixRes.changePercent, up: vixRes.change >= 0 },
          topMover:   topGainer ? { symbol: topGainer.symbol, changePercent: topGainer.changePercent } : null,
          updatedAt:  new Date().toISOString(),
        };

        if (cancelled) return;
        setSnapshot(next);
        setHasLiveData(true);
        localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Network/API failure — keep showing the last known snapshot.
      }
    }

    fetchOnce();
    const interval = setInterval(() => { if (isMarketOpenIST()) fetchOnce(); }, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return { snapshot, marketOpen, hasLiveData };
}

function formatIST(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

// ── Nav ───────────────────────────────────────────────────────────────────
function LandingNav({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const links = [
    { label: "Features",    href: "#features" },
    { label: "Indicators",  href: "#indicators" },
    { label: "Pricing",     href: "#pricing" },
    { label: "About",       href: "#faq" },
  ];

  return (
    <nav className={`transition-all duration-300 ${scrolled ? "bg-[#050b18]/98 backdrop-blur-xl" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-white font-bold">Market</span>
            <span className="text-emerald-400 font-bold ml-1">Pulse AI</span>
          </div>
        </div>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          {links.map(l => (
            <a key={l.label} href={l.href}
              className="text-slate-400 hover:text-white text-sm font-medium transition-colors">
              {l.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <button onClick={onLogin}
            className="text-slate-300 hover:text-white text-sm font-medium transition-colors px-3 py-1.5">
            Login
          </button>
          <button onClick={onRegister}
            className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white text-sm font-semibold rounded-lg transition-all">
            Get Started Free
          </button>
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setMobileOpen(v => !v)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu — absolutely positioned so it doesn't push the ticker down */}
      {mobileOpen && (
        <div className="absolute top-16 left-0 right-0 md:hidden bg-[#080d1a]/98 backdrop-blur-xl border-t border-b border-slate-800 px-4 py-4 space-y-3 shadow-2xl">
          {links.map(l => (
            <a key={l.label} href={l.href} onClick={() => setMobileOpen(false)}
              className="block text-slate-300 hover:text-white text-sm font-medium py-2">
              {l.label}
            </a>
          ))}
          <div className="pt-2 space-y-2">
            <button onClick={() => { onLogin(); setMobileOpen(false); }}
              className="w-full py-2 border border-slate-700 text-white text-sm font-medium rounded-lg hover:border-blue-500">Login</button>
            <button onClick={() => { onRegister(); setMobileOpen(false); }}
              className="w-full py-2 bg-gradient-to-r from-blue-600 to-emerald-600 text-white text-sm font-semibold rounded-lg">Get Started Free</button>
          </div>
        </div>
      )}
    </nav>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────
function HeroSection({ onRegister, onLogin }: { onRegister: () => void; onLogin: () => void }) {
  const { snapshot, marketOpen, hasLiveData } = useLiveMarketSnapshot();

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/6 w-[600px] h-[600px] bg-blue-600/8 rounded-full blur-[120px] animate-blob" />
        <div className="absolute top-1/3 right-1/6 w-[500px] h-[500px] bg-emerald-600/8 rounded-full blur-[100px] animate-blob-delay" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-violet-600/6 rounded-full blur-[100px] animate-blob-slow" />
        {/* Grid */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M0%200h60v60H0z%22%20fill%3D%22none%22/%3E%3Cpath%20d%3D%22M60%200v60M0%200h60%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%220.3%22%20stroke-opacity%3D%220.03%22/%3E%3C/svg%3E')] opacity-50" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-blue-300 font-medium">India's Smartest Market Intelligence Platform</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.12] mb-6">
            Every Investor Should Know These Insights{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              Before the Market Opens
            </span>
          </h1>

          <p className="text-slate-400 text-lg leading-relaxed mb-8 max-w-xl">
            Market Pulse AI helps investors understand market movements, sector trends, stock news,
            institutional activity, and technical indicators — before making any investment decision.
          </p>

          <div className="flex flex-wrap gap-4 mb-10">
            <button onClick={onRegister}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold rounded-xl text-base transition-all shadow-lg shadow-blue-900/30">
              Start Free <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={onLogin}
              className="flex items-center gap-2 px-6 py-3 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-semibold rounded-xl text-base transition-all">
              Explore Dashboard <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm text-slate-400">
            {["No credit card", "Free forever plan", "NSE & BSE data"].map(t => (
              <div key={t} className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" />
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* Right — Dashboard preview */}
        <div className="relative">
          <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 shadow-2xl">
            {/* Header bar */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/70" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                </div>
                <span className="text-xs text-slate-400 ml-2">market-pulse-ai — Dashboard</span>
              </div>
              {marketOpen ? (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-emerald-400 font-medium">NSE LIVE</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-700/30 border border-slate-600/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                  <span className="text-xs text-slate-400 font-medium">
                    {hasLiveData ? `MARKET CLOSED · ${formatIST(snapshot.updatedAt)}` : "MARKET CLOSED"}
                  </span>
                </div>
              )}
            </div>

            {/* Indices row */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { name: "Nifty 50",   idx: snapshot.niftyFifty },
                { name: "Bank Nifty", idx: snapshot.bankNifty },
                { name: "India VIX",  idx: snapshot.indiaVix },
                { name: "Gift Nifty", idx: snapshot.giftNifty },
              ].map(({ name, idx }) => (
                <div key={name} className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/40">
                  <div className="text-xs text-slate-400 mb-1">{name}</div>
                  <div className="text-sm font-bold font-mono text-white">
                    {idx.value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className={`text-xs font-mono font-semibold ${idx.up ? "text-emerald-400" : "text-red-400"}`}>
                    {idx.up ? "+" : ""}{idx.changePercent.toFixed(2)}%
                  </div>
                </div>
              ))}
            </div>

            {/* Signal */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-400">AI Market Signal</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">BULLISH</span>
              </div>
              <div className="text-xs text-slate-300 leading-relaxed">
                Gift Nifty +158pts premium, FII net buyer ₹4,280 Cr. Strong opening likely. Watch 24,700 resistance.
              </div>
            </div>

            {/* Mini bars (fake chart) */}
            <div className="flex items-end gap-1 h-14 mb-1">
              {[40,55,48,62,58,70,65,72,68,80,75,82,78,88,84,92,86,95,90,98].map((h, i) => (
                <div key={i} className={`flex-1 rounded-sm transition-all ${i >= 14 ? "bg-emerald-500/80" : "bg-slate-700/60"}`}
                  style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-slate-600">
              <span>09:15</span><span>11:30</span><span>13:30</span><span>15:30</span>
            </div>
          </div>

          {/* Floating signal cards */}
          {snapshot.topMover && (
            <div className="absolute -top-4 -right-4 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-xl px-3 py-2 shadow-xl animate-float">
              <div className="text-xs text-slate-400">{snapshot.topMover.symbol}</div>
              <div className={`text-sm font-bold ${snapshot.topMover.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {snapshot.topMover.changePercent >= 0 ? "+" : ""}{snapshot.topMover.changePercent.toFixed(2)}% {snapshot.topMover.changePercent >= 0 ? "↑" : "↓"}
              </div>
            </div>
          )}
          <div className="absolute -bottom-4 -left-4 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-xl px-3 py-2 shadow-xl animate-float-delay">
            <div className="text-xs text-slate-400">Today's Signal</div>
            <div className="text-sm font-bold text-blue-400">BUY HDFC Bank</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────
function StatsSection() {
  const stats = [
    { icon: Users,    label: "Investors",     end: 50000,   suffix: "+" },
    { icon: Database, label: "Data Points",   end: 10000000, suffix: "+" },
    { icon: LineChart, label: "NSE/BSE Stocks", end: 5000, suffix: "+" },
    { icon: Server,   label: "Platform Uptime", end: 99, suffix: ".9%" },
  ];

  return (
    <FadeSection>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(s => (
            <div key={s.label} className="bg-slate-800/40 backdrop-blur border border-slate-700/40 rounded-xl p-4 sm:p-6 text-center">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-emerald-500/20 border border-slate-700 rounded-xl flex items-center justify-center mx-auto mb-3">
                <s.icon className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 font-mono">
                <Counter end={s.end} suffix={s.suffix} />
              </div>
              <div className="text-sm text-slate-400">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </FadeSection>
  );
}

// ── Features ──────────────────────────────────────────────────────────────
function FeaturesSection() {
  return (
    <section id="features" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <FadeSection className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs text-blue-300 font-medium">Platform Features</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Everything you need to trade{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">smarter</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Combining real-time market data, AI analysis, and institutional insights in one clean interface.
          </p>
        </FadeSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <FadeSection key={f.title} className="group">
              <div style={{ transitionDelay: `${(i % 4) * 60}ms` }}
                className="h-full bg-slate-800/40 backdrop-blur border border-slate-700/40 rounded-xl p-5 hover:border-blue-500/40 hover:bg-slate-800/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-900/20">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-emerald-500/20 border border-slate-700/60 rounded-xl flex items-center justify-center mb-4 group-hover:border-blue-500/40 transition-colors">
                  <f.icon className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            </FadeSection>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Why ───────────────────────────────────────────────────────────────────
function WhySection() {
  const reasons = [
    { icon: Brain,    title: "AI-Powered Clarity",    desc: "Get plain-English explanations of why the market is moving, not just raw numbers." },
    { icon: Clock,    title: "Pre-Market Reports",    desc: "Know the full picture before 9:15 AM — Gift Nifty, FII, global cues, and sector outlook." },
    { icon: Shield,   title: "Avoid Emotional Trading", desc: "Structured signals and risk scores keep you disciplined during volatile sessions." },
    { icon: Target,   title: "Find Strong Sectors",   desc: "Sector rotation analysis highlights which sectors institutions are loading up on." },
    { icon: BarChart2, title: "Technical + Fundamental", desc: "Combines price action, volume, options data, and news sentiment in one view." },
    { icon: Briefcase, title: "Track Portfolio Health", desc: "XIRR, drawdown, beta, and benchmark comparison for every holding." },
  ];

  return (
    <section className="py-24 bg-slate-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <FadeSection className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Why choose{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Market Pulse AI?</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Built for Indian retail investors who want an institutional edge without the institutional price tag.
          </p>
        </FadeSection>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reasons.map((r, i) => (
            <FadeSection key={r.title}>
              <div style={{ transitionDelay: `${(i % 3) * 80}ms` }}
                className="flex gap-4 p-5 bg-slate-800/30 border border-slate-700/30 rounded-xl hover:border-slate-600/50 transition-all">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500/15 to-emerald-500/15 border border-slate-700/60 rounded-lg flex items-center justify-center shrink-0">
                  <r.icon className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">{r.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{r.desc}</p>
                </div>
              </div>
            </FadeSection>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Indicators ────────────────────────────────────────────────────────────
function IndicatorsSection() {
  return (
    <section id="indicators" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <FadeSection className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs text-emerald-300 font-medium">Market Indicators</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Top 5 Indicators Every Trader Must Watch{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">Before Market Opens</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            These five data points give you the full picture before the opening bell rings at 9:15 AM IST.
          </p>
        </FadeSection>

        <div className="space-y-6">
          {INDICATORS.map((ind, i) => (
            <FadeSection key={ind.title}>
              <div className={`flex flex-col md:flex-row gap-6 p-6 bg-slate-800/40 border border-slate-700/40 rounded-2xl hover:border-slate-600/60 transition-all ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}>
                {/* Number + Icon */}
                <div className="md:w-48 shrink-0 flex flex-row md:flex-col items-center md:items-start gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${ind.color} flex items-center justify-center shadow-lg shrink-0`}>
                    <ind.icon className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-700 leading-none">{ind.num}</div>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">{ind.title}</h3>
                  <p className="text-xs font-semibold text-emerald-400 mb-3 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> {ind.why}
                  </p>
                  <p className="text-sm text-slate-400 leading-relaxed mb-4">{ind.desc}</p>
                  <div className="inline-flex items-center gap-3 bg-slate-700/50 border border-slate-600/40 rounded-xl px-4 py-2">
                    <div>
                      <div className="text-xs text-slate-400">{ind.example.label}</div>
                      <div className="text-lg font-bold font-mono text-white">{ind.example.value}</div>
                    </div>
                    <div className="h-8 w-px bg-slate-600" />
                    <span className="text-xs text-emerald-400 font-medium">{ind.example.sub}</span>
                  </div>
                </div>
              </div>
            </FadeSection>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Market Preview ─────────────────────────────────────────────────────────
function MarketPreviewSection({ onRegister }: { onRegister: () => void }) {
  const [activeTab, setActiveTab] = useState<"gainers" | "losers">("gainers");

  const sectors = [
    { name: "IT",       pct: "+2.1%", bar: 72, up: true },
    { name: "Banking",  pct: "+1.4%", bar: 56, up: true },
    { name: "FMCG",     pct: "+0.8%", bar: 38, up: true },
    { name: "Pharma",   pct: "-0.9%", bar: 35, up: false },
    { name: "Realty",   pct: "-1.6%", bar: 28, up: false },
  ];

  return (
    <section className="py-24 bg-slate-900/30" id="preview">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <FadeSection className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Live Market{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Dashboard Preview</span>
          </h2>
          <p className="text-slate-400 text-lg">A glimpse of what awaits you inside the platform</p>
        </FadeSection>

        <FadeSection>
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
            {/* Terminal header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
                </div>
                <div className="flex gap-4 text-xs text-slate-400 ml-2">
                  {["Dashboard", "Trading", "Portfolio", "Insights"].map(t => (
                    <span key={t} className={t === "Dashboard" ? "text-white font-medium" : ""}>{t}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400 font-medium">Live Data</span>
              </div>
            </div>

            <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Indices */}
              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { name: "Nifty 50",   val: "24,620.50", chg: "+106.35", pct: "+0.43%", up: true },
                    { name: "Sensex",     val: "81,332.74", chg: "+308.42", pct: "+0.38%", up: true },
                    { name: "Bank Nifty", val: "52,480.10", chg: "+108.25", pct: "+0.21%", up: true },
                    { name: "India VIX",  val: "14.82",     chg: "-0.32",   pct: "-2.10%", up: false },
                  ].map(idx => (
                    <div key={idx.name} className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3">
                      <div className="text-xs text-slate-400 mb-1.5">{idx.name}</div>
                      <div className="text-base font-bold font-mono text-white">{idx.val}</div>
                      <div className={`text-xs font-mono font-semibold ${idx.up ? "text-emerald-400" : "text-red-400"}`}>
                        {idx.chg} ({idx.pct})
                      </div>
                    </div>
                  ))}
                </div>

                {/* Gainers / Losers */}
                <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl overflow-hidden">
                  <div className="flex border-b border-slate-700/50">
                    {(["gainers", "losers"] as const).map(tab => (
                      <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-colors ${
                          activeTab === tab ? (tab === "gainers" ? "text-emerald-400 border-b-2 border-emerald-400" : "text-red-400 border-b-2 border-red-400") : "text-slate-400 hover:text-slate-200"
                        }`}>
                        Top {tab === "gainers" ? "Gainers" : "Losers"}
                      </button>
                    ))}
                  </div>
                  <div className="divide-y divide-slate-700/30">
                    {(activeTab === "gainers" ? GAINERS : LOSERS).map(s => (
                      <div key={s.sym} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-700/20 transition-colors">
                        <div>
                          <div className="text-xs font-bold text-white">{s.sym}</div>
                          <div className="text-xs text-slate-500">{s.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-mono text-white">₹{s.price}</div>
                          <div className={`text-xs font-mono font-bold ${activeTab === "gainers" ? "text-emerald-400" : "text-red-400"}`}>{s.chg}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                {/* AI Signal */}
                <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400">AI Decision</span>
                    <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300">BUY</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Broad-based buying. FII net buyers ₹4,280 Cr. IT and banking leading. Targets: 24,800 → 25,100.
                  </p>
                </div>

                {/* Sectors */}
                <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-white mb-3">Sector Performance</h3>
                  <div className="space-y-2.5">
                    {sectors.map(s => (
                      <div key={s.name} className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-14">{s.name}</span>
                        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${s.up ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${s.bar}%` }} />
                        </div>
                        <span className={`text-xs font-mono font-semibold w-12 text-right ${s.up ? "text-emerald-400" : "text-red-400"}`}>{s.pct}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* CTA overlay bar */}
            <div className="border-t border-slate-800 px-5 py-4 bg-gradient-to-r from-blue-600/10 to-emerald-600/10 flex items-center justify-between">
              <div className="text-sm text-slate-300">
                <span className="text-white font-semibold">Want the full dashboard?</span> Sign up free and unlock all features.
              </div>
              <button onClick={onRegister}
                className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white text-sm font-semibold rounded-lg transition-all">
                Get Started Free
              </button>
            </div>
          </div>
        </FadeSection>
      </div>
    </section>
  );
}

// ── Pricing ───────────────────────────────────────────────────────────────
function PricingSection({ onRegister }: { onRegister: () => void }) {
  return (
    <section id="pricing" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <FadeSection className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Simple,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">transparent pricing</span>
          </h2>
          <p className="text-slate-400 text-lg">Start free. Upgrade when you're ready. Cancel anytime.</p>
        </FadeSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PRICING.map(plan => (
            <FadeSection key={plan.name}>
              <div className={`relative h-full flex flex-col bg-slate-800/50 backdrop-blur border-2 ${plan.color} rounded-2xl p-6 hover:shadow-2xl transition-all`}>
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-600 to-emerald-600 text-white text-xs font-bold rounded-full shadow-lg whitespace-nowrap">
                    {plan.badge}
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-white">{plan.price}</span>
                    {plan.period && <span className="text-slate-400 text-sm">{plan.period}</span>}
                  </div>
                </div>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={onRegister}
                  className={`w-full py-2.5 font-semibold rounded-xl text-sm transition-all ${plan.ctaStyle}`}>
                  {plan.cta}
                </button>
              </div>
            </FadeSection>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────
function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-24 bg-slate-900/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <FadeSection className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">Frequently Asked Questions</h2>
          <p className="text-slate-400">Got questions? We've got answers.</p>
        </FadeSection>
        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <FadeSection key={i}>
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl overflow-hidden">
                <button onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left text-white font-medium text-sm hover:bg-slate-700/20 transition-colors">
                  {f.q}
                  <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 ml-4 transition-transform ${open === i ? "rotate-180" : ""}`} />
                </button>
                {open === i && (
                  <div className="px-5 pb-4 text-sm text-slate-400 leading-relaxed border-t border-slate-700/40 pt-3">
                    {f.a}
                  </div>
                )}
              </div>
            </FadeSection>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────
function FooterSection({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  return (
    <footer className="border-t border-slate-800 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-white font-bold">Market Pulse AI</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              India's smartest AI-powered stock market intelligence platform for retail investors.
            </p>
          </div>
          {[
            { heading: "Platform", links: ["Dashboard", "Trading", "Portfolio", "Insights", "Watchlist"] },
            { heading: "Company",  links: ["About", "Blog", "Careers", "Contact", "Press"] },
            { heading: "Legal",    links: ["Privacy Policy", "Terms of Service", "Disclaimer", "Cookie Policy"] },
          ].map(col => (
            <div key={col.heading}>
              <h4 className="text-white text-xs font-semibold mb-3 uppercase tracking-wider">{col.heading}</h4>
              <ul className="space-y-2">
                {col.links.map(l => (
                  <li key={l}><a href="#" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-600">
            © 2025 Market Pulse AI. All rights reserved. Not SEBI registered. For educational purposes only.
          </p>
          <div className="flex gap-3">
            <button onClick={onLogin} className="text-xs text-slate-400 hover:text-white transition-colors">Login</button>
            <button onClick={onRegister} className="text-xs px-3 py-1 bg-gradient-to-r from-blue-600 to-emerald-600 text-white font-semibold rounded-md">Register</button>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────
interface Props {
  onLogin: () => void;
  onRegister: () => void;
}

export function LandingPage({ onLogin, onRegister }: Props) {
  return (
    <div className="bg-[#050b18] min-h-screen text-white">

      {/* ── Fixed header: Nav (64px) → Ticker (40px) = 104px total ── */}
      <div className="fixed top-0 left-0 right-0 z-50 flex flex-col">
        <LandingNav onLogin={onLogin} onRegister={onRegister} />
        <TickerTape />
      </div>

      {/* Spacer that pushes page content below the fixed header */}
      <div className="h-[104px]" />

      <HeroSection onRegister={onRegister} onLogin={onLogin} />
      <StatsSection />
      <FeaturesSection />
      <WhySection />
      <IndicatorsSection />
      <MarketPreviewSection onRegister={onRegister} />
      <PricingSection onRegister={onRegister} />
      <FAQSection />
      <FooterSection onLogin={onLogin} onRegister={onRegister} />
    </div>
  );
}
