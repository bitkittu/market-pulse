import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { Activity, BarChart2, Bell, Compass, LayoutDashboard, Search, Settings, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetStockQuotes } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";

function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setLocation(`/symbol/${query.toUpperCase().trim()}`);
      setQuery("");
    }
  };

  return (
    <form onSubmit={handleSearch} className="relative group w-64 max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
      <input
        type="text"
        placeholder="Search ticker (e.g. AAPL)..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full h-9 pl-9 pr-4 bg-black/40 border border-white/10 rounded-md text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all uppercase"
      />
    </form>
  );
}

function LiveTickerTape() {
  const { data: quotes } = useGetStockQuotes({ symbols: "SPY,QQQ,DIA,VIX,AAPL,MSFT,NVDA,TSLA" }, { query: { refetchInterval: 10000 } });

  if (!quotes) return <div className="h-6" />;

  return (
    <div className="flex w-full overflow-hidden bg-black/60 border-b border-white/5 h-8 items-center">
      <motion.div 
        className="flex whitespace-nowrap items-center min-w-full"
        animate={{ x: [0, -1000] }}
        transition={{ repeat: Infinity, ease: "linear", duration: 30 }}
      >
        {[...quotes, ...quotes, ...quotes].map((quote, i) => (
          <div key={`${quote.symbol}-${i}`} className="flex items-center space-x-2 mx-6 text-xs font-mono">
            <span className="font-bold text-muted-foreground">{quote.symbol}</span>
            <span className="text-foreground">${quote.price.toFixed(2)}</span>
            <span className={quote.change >= 0 ? "text-positive" : "text-destructive"}>
              {quote.change >= 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

const NAV_ITEMS = [
  { href: "/", icon: LayoutDashboard, label: "Terminal" },
  { href: "/symbol/AAPL", icon: BarChart2, label: "Chart Analysis" },
  { href: "/market", icon: Compass, label: "Market Overview" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden text-foreground selection:bg-primary/30">
      <LiveTickerTape />
      
      <header className="h-14 border-b border-border/50 glass-panel flex items-center justify-between px-4 z-40 relative">
        <div className="flex items-center space-x-6">
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="w-8 h-8 rounded bg-primary/10 border border-primary/30 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <span className="font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              NEXUS
              <span className="font-light text-primary">TRADER</span>
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center space-x-1 ml-4 border-l border-white/10 pl-6">
            {NAV_ITEMS.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center space-x-2",
                    isActive 
                      ? "bg-white/10 text-white" 
                      : "text-muted-foreground hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <GlobalSearch />
          <button className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
            <Bell className="h-4 w-4" />
          </button>
          <button className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto relative">
        {/* Subtle background glow */}
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
