import { useState, useEffect, useRef, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Home } from "@/pages/Home";
import { Portfolio } from "@/pages/Portfolio";
import { Settings } from "@/pages/Settings";
import { IntradayDashboard } from "@/pages/IntradayDashboard";
import { OptionsDashboard } from "@/pages/OptionsDashboard";
import { Performance } from "@/pages/Performance";
import { Insights } from "@/pages/Insights";
import { Commodities } from "@/pages/Commodities";
import {
  LayoutDashboard, Briefcase, Settings2, TrendingUp, Clock,
  Zap, Activity, BarChart2, Newspaper, Wheat, ChevronDown,
  Sun, Moon, Link2,
} from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15000 },
  },
});

type Tab = "home" | "portfolio" | "intraday" | "options" | "performance" | "insights" | "commodities" | "settings";

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
        <div className="absolute top-full left-0 mt-1.5 z-50 min-w-[11rem] bg-card border border-border rounded-xl shadow-2xl py-1 overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  icon: Icon, label, active, accent, onClick,
}: {
  icon: typeof LayoutDashboard;
  label: string;
  active: boolean;
  accent?: string;
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
    </button>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────
function AppShell() {
  const [tab, setTab] = useState<Tab>("home");
  const [theme, setTheme] = useState<"dark" | "light">(getInitialTheme);

  // Apply theme on mount + change
  useEffect(() => { applyTheme(theme); }, [theme]);

  const goTab = useCallback((t: Tab) => setTab(t), []);

  const tradingActive  = ["intraday", "options", "commodities"].includes(tab);
  const settingsActive = tab === "settings";

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
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between gap-2">

          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <span className="text-foreground font-bold text-sm tracking-wide">NSE</span>
              <span className="text-primary font-bold text-sm tracking-wide ml-0.5">Pulse</span>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide flex-1 justify-center">

            {/* Dashboard */}
            <button onClick={() => goTab("home")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${navBtnCls("home")}`}>
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Dashboard</span>
            </button>

            {/* Trading ▼ */}
            <NavDropdown label="Trading" icon={Zap} active={tradingActive}>
              <DropdownItem icon={Zap}      label="Intraday"    active={tab === "intraday"}    accent="emerald" onClick={() => { goTab("intraday");    }} />
              <DropdownItem icon={Activity} label="Options"     active={tab === "options"}     accent="violet"  onClick={() => { goTab("options");     }} />
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

            {/* Settings ▼ */}
            <NavDropdown label="Settings" icon={Settings2} active={settingsActive}>
              <DropdownItem icon={Link2} label="Upstox API" active={tab === "settings"} onClick={() => goTab("settings")} />

              {/* Divider */}
              <div className="my-1 border-t border-border" />

              {/* Day / Night toggle */}
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  {theme === "dark" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                  {theme === "dark" ? "Night Mode" : "Day Mode"}
                </div>
                <button
                  onClick={() => setTheme((t) => t === "dark" ? "light" : "dark")}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    theme === "dark" ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    theme === "dark" ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>
            </NavDropdown>

          </nav>

          <ISTClock />
        </div>
      </header>

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-6">
        {tab === "home"        && <Home />}
        {tab === "intraday"    && <IntradayDashboard />}
        {tab === "options"     && <OptionsDashboard />}
        {tab === "performance" && <Performance />}
        {tab === "commodities" && <Commodities />}
        {tab === "portfolio"   && <Portfolio />}
        {tab === "insights"    && <Insights />}
        {tab === "settings"    && <Settings />}
      </main>
    </div>
  );
}

export default function App() {
  // Apply persisted theme before first render to avoid flash
  useEffect(() => { applyTheme(getInitialTheme()); }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}
