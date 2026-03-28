import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Home } from "@/pages/Home";
import { Portfolio } from "@/pages/Portfolio";
import { Settings } from "@/pages/Settings";
import { IntradayDashboard } from "@/pages/IntradayDashboard";
import { OptionsDashboard } from "@/pages/OptionsDashboard";
import { Performance } from "@/pages/Performance";
import { LayoutDashboard, Briefcase, Settings2, TrendingUp, Clock, Zap, Activity, BarChart2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15000 },
  },
});

type Tab = "home" | "portfolio" | "intraday" | "options" | "performance" | "settings";

function ISTClock() {
  const [time, setTime] = useState("");
  const [marketOpen, setMarketOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      const ist = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      setTime(ist);
      const istDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const h = istDate.getHours();
      const m = istDate.getMinutes();
      const day = istDate.getDay();
      const open = day >= 1 && day <= 5 && (h > 9 || (h === 9 && m >= 15)) && h < 15 || (h === 15 && m <= 30);
      setMarketOpen(open);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-3 shrink-0">
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
        marketOpen ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${marketOpen ? "bg-emerald-400" : "bg-red-400"}`} />
        <span className="hidden sm:inline">{marketOpen ? "NSE LIVE" : "MARKET CLOSED"}</span>
      </div>
      <div className="hidden md:flex items-center gap-1.5 text-muted-foreground text-xs font-mono">
        <Clock className="w-3 h-3" />
        <span>{time} IST</span>
      </div>
    </div>
  );
}

type TabDef = { id: Tab; label: string; icon: typeof LayoutDashboard; accent?: string };

const TABS: TabDef[] = [
  { id: "home",        label: "Dashboard",   icon: LayoutDashboard },
  { id: "intraday",    label: "Intraday",    icon: Zap,      accent: "emerald" },
  { id: "options",     label: "Options",     icon: Activity, accent: "violet" },
  { id: "performance", label: "Performance", icon: BarChart2, accent: "blue" },
  { id: "portfolio",   label: "Portfolio",   icon: Briefcase },
  { id: "settings",    label: "Upstox API",  icon: Settings2 },
];

function AppShell() {
  const [tab, setTab] = useState<Tab>("home");

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
              <span className="text-white font-bold text-sm tracking-wide">NSE</span>
              <span className="text-primary font-bold text-sm tracking-wide ml-0.5">Pulse</span>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide flex-1 justify-center">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              const accentMap: Record<string, string> = {
                emerald: isActive ? "bg-emerald-500 text-white" : "text-emerald-400/70 hover:text-emerald-300 hover:bg-emerald-500/10",
                violet:  isActive ? "bg-violet-500 text-white"  : "text-violet-400/70 hover:text-violet-300 hover:bg-violet-500/10",
                blue:    isActive ? "bg-blue-500 text-white"    : "text-blue-400/70 hover:text-blue-300 hover:bg-blue-500/10",
              };
              const cls = t.accent
                ? accentMap[t.accent]
                : isActive ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-accent";
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${cls}`}>
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">{t.label}</span>
                </button>
              );
            })}
          </nav>

          <ISTClock />
        </div>
      </header>

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-6">
        {tab === "home"        && <Home />}
        {tab === "intraday"    && <IntradayDashboard />}
        {tab === "options"     && <OptionsDashboard />}
        {tab === "performance" && <Performance />}
        {tab === "portfolio"   && <Portfolio />}
        {tab === "settings"    && <Settings />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}
