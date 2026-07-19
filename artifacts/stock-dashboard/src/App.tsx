import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// Lazy-load all pages so each route is a separate chunk (faster initial load)
const Home             = lazy(() => import("@/pages/Home").then(m => ({ default: m.Home })));
const Portfolio        = lazy(() => import("@/pages/Portfolio").then(m => ({ default: m.Portfolio })));
const Settings         = lazy(() => import("@/pages/Settings").then(m => ({ default: m.Settings })));
const ApiSettings      = lazy(() => import("@/pages/Settings").then(m => ({ default: m.ApiSettings })));
const IntradayDashboard = lazy(() => import("@/pages/IntradayDashboard").then(m => ({ default: m.IntradayDashboard })));
const OptionsDashboard = lazy(() => import("@/pages/OptionsDashboard").then(m => ({ default: m.OptionsDashboard })));
const Performance      = lazy(() => import("@/pages/Performance").then(m => ({ default: m.Performance })));
const Insights         = lazy(() => import("@/pages/Insights").then(m => ({ default: m.Insights })));
const Commodities      = lazy(() => import("@/pages/Commodities").then(m => ({ default: m.Commodities })));
const LandingPage      = lazy(() => import("@/pages/LandingPage").then(m => ({ default: m.LandingPage })));
const Login            = lazy(() => import("@/pages/Login").then(m => ({ default: m.Login })));
const Register         = lazy(() => import("@/pages/Register").then(m => ({ default: m.Register })));
const ForgotPassword   = lazy(() => import("@/pages/ForgotPassword").then(m => ({ default: m.ForgotPassword })));
const ResetPassword    = lazy(() => import("@/pages/ResetPassword").then(m => ({ default: m.ResetPassword })));
const AdminPanel       = lazy(() => import("@/pages/AdminPanel").then(m => ({ default: m.AdminPanel })));

// Lightweight fallback shown while a lazy chunk loads
function PageLoader() {
  return (
    <div className="min-h-screen bg-[#050b18] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 animate-pulse" />
        <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 animate-[ticker_1.5s_ease-in-out_infinite]" style={{ width: "60%" }} />
        </div>
      </div>
    </div>
  );
}
import {
  LayoutDashboard, Briefcase, TrendingUp, Clock,
  Zap, Activity, BarChart2, Newspaper, Wheat, ChevronDown,
  Sun, Moon, Link2, LogOut, User, Crown, Lock, Menu, X,
} from "lucide-react";
import { hasAccess } from "@/lib/plan";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15000 },
  },
});

type Tab = "home" | "portfolio" | "intraday" | "options" | "performance" | "insights" | "commodities" | "api" | "account";

// ── Theme ──────────────────────────────────────────────────────────────────
function getInitialTheme(): "dark" | "light" {
  try {
    const saved = localStorage.getItem("nse-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* ignore */ }
  return "dark";
}

function applyTheme(theme: "dark" | "light") {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
  }
  try { localStorage.setItem("nse-theme", theme); } catch { /* ignore */ }
}

// ── IST Clock ─────────────────────────────────────────────────────────────
function ISTClock() {
  const [time, setTime] = useState("");
  const [marketOpen, setMarketOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      const ist = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      });
      setTime(ist);
      const istDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const h = istDate.getHours(), m = istDate.getMinutes(), day = istDate.getDay();
      const open = day >= 1 && day <= 5 &&
        ((h > 9 || (h === 9 && m >= 15)) && (h < 15 || (h === 15 && m <= 30)));
      setMarketOpen(open);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
        marketOpen
          ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
          : "bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30"
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${marketOpen ? "bg-emerald-500" : "bg-red-500"}`} />
        <span className="hidden sm:inline font-mono">{marketOpen ? "NSE LIVE" : "MARKET CLOSED"}</span>
      </div>
      <div className="hidden md:flex items-center gap-1.5 text-muted-foreground text-xs font-mono">
        <Clock className="w-3 h-3" />
        <span>{time} IST</span>
      </div>
    </div>
  );
}

// ── Dropdown Menu ─────────────────────────────────────────────────────────
function NavDropdown({
  label, icon: Icon, active, children,
}: {
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
          active
            ? "bg-primary text-white shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        }`}
      >
        <Icon className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">{label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-[200] min-w-[11rem] bg-card border border-border rounded-xl shadow-2xl py-1 overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  icon: Icon, label, active, accent, locked, onClick,
}: {
  icon: typeof LayoutDashboard;
  label: string;
  active: boolean;
  accent?: string;
  locked?: boolean;
  onClick: () => void;
}) {
  const accentText: Record<string, string> = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    violet:  "text-violet-600  dark:text-violet-400",
    orange:  "text-orange-600  dark:text-orange-400",
    amber:   "text-amber-600   dark:text-amber-400",
    blue:    "text-blue-600    dark:text-blue-400",
  };
  const colorCls = accent ? accentText[accent] ?? "text-foreground" : "text-foreground";

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold transition-colors text-left ${
        active
          ? "bg-primary/10 text-primary"
          : `${colorCls} hover:bg-accent`
      }`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {label}
      {locked && <Lock className="w-3 h-3 ml-auto text-muted-foreground shrink-0" />}
    </button>
  );
}

// ── User Menu ─────────────────────────────────────────────────────────────
function UserMenu({
  theme, setTheme, onAccountSettings,
}: {
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  onAccountSettings: () => void;
}) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  const planColor = user.plan === "premium" ? "text-amber-400" : user.plan === "pro" ? "text-violet-400" : "text-slate-400";

  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-accent transition-colors">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white text-xs font-bold">
          {user.name.charAt(0)}
        </div>
        <div className="hidden md:block text-left">
          <div className="text-xs font-semibold text-foreground leading-none">{user.name.split(" ")[0]}</div>
          <div className={`text-[10px] font-medium capitalize leading-none ${planColor}`}>{user.plan}</div>
        </div>
        <ChevronDown className="w-3 h-3 text-muted-foreground hidden md:block" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 z-[200] min-w-[14rem] bg-card border border-border rounded-xl shadow-2xl py-1 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white text-sm font-bold">
                {user.name.charAt(0)}
              </div>
              <div>
                <div className="text-xs font-bold text-foreground">{user.name}</div>
                <div className="text-[11px] text-muted-foreground">{user.email}</div>
              </div>
            </div>
            <div className={`mt-2 flex items-center gap-1 text-[11px] font-semibold ${planColor}`}>
              <Crown className="w-3 h-3" />
              {user.plan.charAt(0).toUpperCase() + user.plan.slice(1)} Plan
            </div>
          </div>
          <button onClick={() => { setOpen(false); onAccountSettings(); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors text-left">
            <User className="w-3.5 h-3.5" /> Account Settings
          </button>

          {/* Day / Night toggle */}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              {theme === "dark" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              {theme === "dark" ? "Night Mode" : "Day Mode"}
            </div>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                theme === "dark" ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                theme === "dark" ? "translate-x-5" : "translate-x-0"
              }`} />
            </button>
          </div>

          <div className="my-1 border-t border-border" />
          <button onClick={() => { setOpen(false); logout(); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-500/10 transition-colors text-left">
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────
function AppShell() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("home");
  const [theme, setTheme] = useState<"dark" | "light">(getInitialTheme);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const intradayLocked = !hasAccess(user?.plan, "intraday");
  const optionsLocked = !hasAccess(user?.plan, "options");

  useEffect(() => { applyTheme(theme); }, [theme]);

  const goTab = useCallback((t: Tab) => setTab(t), []);
  const goTabMobile = useCallback((t: Tab) => { setTab(t); setMobileMenuOpen(false); }, []);

  const tradingActive  = ["intraday", "options", "commodities"].includes(tab);

  const navBtnCls = (id: Tab, accent?: string) => {
    const isActive = tab === id;
    const accentActive: Record<string, string> = {
      amber: "bg-amber-500 text-white",
      blue:  "bg-blue-500 text-white",
    };
    const accentIdle: Record<string, string> = {
      amber: "text-amber-600 dark:text-amber-400/80 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-500/10",
      blue:  "text-blue-600  dark:text-blue-400/80  hover:text-blue-700  dark:hover:text-blue-300  hover:bg-blue-500/10",
    };
    if (accent) return isActive ? accentActive[accent] : accentIdle[accent];
    return isActive
      ? "bg-primary text-white shadow-sm"
      : "text-muted-foreground hover:text-foreground hover:bg-accent";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 overflow-visible">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2 overflow-visible">

          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded bg-primary flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <span className="text-foreground font-bold text-sm tracking-wide">Market</span>
              <span className="text-primary font-bold text-sm tracking-wide ml-0.5">Pulse AI</span>
            </div>
          </div>

          {/* Nav (desktop/tablet) */}
          <nav className="hidden md:flex items-center gap-0.5 overflow-visible flex-1 justify-center">

            {/* Dashboard */}
            <button onClick={() => goTab("home")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${navBtnCls("home")}`}>
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Dashboard</span>
            </button>

            {/* Trading ▼ */}
            <NavDropdown label="Trading" icon={Zap} active={tradingActive}>
              <DropdownItem icon={Zap}      label="Intraday"    active={tab === "intraday"}    accent="emerald" locked={intradayLocked} onClick={() => { goTab("intraday");    }} />
              <DropdownItem icon={Activity} label="Options"     active={tab === "options"}     accent="violet"  locked={optionsLocked}  onClick={() => { goTab("options");     }} />
              <DropdownItem icon={Wheat}    label="Commodities" active={tab === "commodities"} accent="orange"  onClick={() => { goTab("commodities"); }} />
            </NavDropdown>

            {/* Insights */}
            <button onClick={() => goTab("insights")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${navBtnCls("insights", "amber")}`}>
              <Newspaper className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Insights</span>
            </button>

            {/* Portfolio */}
            <button onClick={() => goTab("portfolio")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${navBtnCls("portfolio")}`}>
              <Briefcase className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Portfolio</span>
            </button>

            {/* Performance */}
            <button onClick={() => goTab("performance")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${navBtnCls("performance", "blue")}`}>
              <BarChart2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Performance</span>
            </button>

            {/* API */}
            <button onClick={() => goTab("api")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${navBtnCls("api")}`}>
              <Link2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">API</span>
            </button>

          </nav>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <ISTClock />
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden h-9 w-9 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <UserMenu
              theme={theme}
              setTheme={(t) => setTheme(t)}
              onAccountSettings={() => { goTab("account"); setMobileMenuOpen(false); }}
            />
          </div>
        </div>

        {/* Nav (mobile) */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-card max-h-[calc(100vh-3.5rem)] overflow-y-auto px-2 py-2">
            <DropdownItem icon={LayoutDashboard} label="Dashboard" active={tab === "home"} onClick={() => goTabMobile("home")} />
            <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Trading</div>
            <DropdownItem icon={Zap} label="Intraday" active={tab === "intraday"} accent="emerald" locked={intradayLocked} onClick={() => goTabMobile("intraday")} />
            <DropdownItem icon={Activity} label="Options" active={tab === "options"} accent="violet" locked={optionsLocked} onClick={() => goTabMobile("options")} />
            <DropdownItem icon={Wheat} label="Commodities" active={tab === "commodities"} accent="orange" onClick={() => goTabMobile("commodities")} />
            <div className="my-2 border-t border-border" />
            <DropdownItem icon={Newspaper} label="Insights" active={tab === "insights"} accent="amber" onClick={() => goTabMobile("insights")} />
            <DropdownItem icon={Briefcase} label="Portfolio" active={tab === "portfolio"} onClick={() => goTabMobile("portfolio")} />
            <DropdownItem icon={BarChart2} label="Performance" active={tab === "performance"} accent="blue" onClick={() => goTabMobile("performance")} />
            <DropdownItem icon={Link2} label="API" active={tab === "api"} onClick={() => goTabMobile("api")} />
          </div>
        )}
      </header>

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6">
        <Suspense fallback={<PageLoader />}>
          {tab === "home"        && <Home />}
          {tab === "intraday"    && <IntradayDashboard />}
          {tab === "options"     && <OptionsDashboard />}
          {tab === "performance" && <Performance />}
          {tab === "commodities" && <Commodities />}
          {tab === "portfolio"   && <Portfolio />}
          {tab === "insights"    && <Insights />}
          {tab === "api"         && <ApiSettings />}
          {tab === "account"     && <Settings />}
        </Suspense>
      </main>
    </div>
  );
}

// ── Loading Screen ────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#050b18] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-2xl flex items-center justify-center animate-pulse">
          <TrendingUp className="w-6 h-6 text-white" />
        </div>
        <div className="text-slate-400 text-sm">Loading Market Pulse AI...</div>
      </div>
    </div>
  );
}

// ── App Router ────────────────────────────────────────────────────────────
type AuthView = "landing" | "login" | "register" | "forgot" | "reset";

function readResetTokenFromUrl(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("reset_token");
  } catch {
    return null;
  }
}

function AppRouter() {
  const { user, isLoading } = useAuth();
  const [resetToken, setResetToken] = useState<string | null>(() => readResetTokenFromUrl());
  const [view, setView] = useState<AuthView>(() => (readResetTokenFromUrl() ? "reset" : "landing"));

  // Ensure landing page uses dark mode
  useEffect(() => {
    if (!user) {
      document.documentElement.classList.add("dark");
    } else {
      applyTheme(getInitialTheme());
    }
  }, [user]);

  const finishReset = () => {
    // Strip the token from the URL so it can't be reused/shared, then return
    // to the sign-in screen.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("reset_token");
      window.history.replaceState({}, "", url.pathname + url.search);
    } catch { /* ignore */ }
    setResetToken(null);
    setView("login");
  };

  if (isLoading) return <LoadingScreen />;

  // A reset link takes precedence over everything, even a stale session, so a
  // user who clicked their email link always lands on the reset screen.
  if (resetToken || view === "reset") {
    return (
      <Suspense fallback={<PageLoader />}>
        <ResetPassword token={resetToken ?? ""} onDone={finishReset} />
      </Suspense>
    );
  }

  // Authenticated — route based on role
  if (user) {
    return (
      <Suspense fallback={<PageLoader />}>
        {user.role === "admin" ? <AdminPanel /> : <AppShell />}
      </Suspense>
    );
  }

  // Unauthenticated — show auth views
  return (
    <Suspense fallback={<PageLoader />}>
      {view === "login"    && <Login onRegister={() => setView("register")} onBack={() => setView("landing")} onForgot={() => setView("forgot")} />}
      {view === "register" && <Register onLogin={() => setView("login")} onBack={() => setView("landing")} />}
      {view === "forgot"   && <ForgotPassword onBack={() => setView("login")} />}
      {view === "landing"  && <LandingPage onLogin={() => setView("login")} onRegister={() => setView("register")} />}
    </Suspense>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────
export default function App() {
  useEffect(() => { applyTheme(getInitialTheme()); }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </QueryClientProvider>
  );
}
