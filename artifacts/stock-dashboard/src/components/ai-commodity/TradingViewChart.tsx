import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import type { TimeframeId } from "./types";

const TF_TO_TV_INTERVAL: Record<TimeframeId, string> = { "3m": "3", "15m": "15" };

function useIsDarkTheme() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

/**
 * Embeds TradingView's public "Advanced Chart" widget. Re-injects the
 * widget script whenever symbol/timeframe/theme change, following
 * TradingView's documented embed pattern (a container + an async script
 * carrying its JSON config as text content).
 */
export function TradingViewChart({
  symbol, timeframe, height = 440,
}: {
  symbol: string;
  timeframe: TimeframeId;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDark = useIsDarkTheme();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.text = JSON.stringify({
      autosize: true,
      symbol,
      interval: TF_TO_TV_INTERVAL[timeframe],
      timezone: "Asia/Kolkata",
      theme: isDark ? "dark" : "light",
      style: "1",
      locale: "en",
      allow_symbol_change: false,
      hide_top_toolbar: false,
      support_host: "https://www.tradingview.com",
    });

    container.appendChild(widgetDiv);
    container.appendChild(script);
  }, [symbol, timeframe, isDark]);

  return (
    // The explicit pixel height lives here, on a wrapper TradingView's script
    // never touches. Its "autosize" mode overwrites the inner container's own
    // inline style to height:100% — that only resolves correctly if *some*
    // ancestor has a real, definite (non-percentage) height for it to chain
    // up to, which this div provides.
    <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 flex flex-col" style={{ height }}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 mb-3 px-1 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-black text-foreground">Live Chart</h2>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Info className="w-2.5 h-2.5" /> International reference · MCX data pending
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">{symbol}</span>
      </div>
      <div
        ref={containerRef}
        className="tradingview-widget-container rounded-xl overflow-hidden bg-background/50 flex-1 min-h-0"
      />
      <p className="mt-2 px-1 text-[10px] text-muted-foreground leading-relaxed shrink-0">
        This chart tracks the international spot/futures equivalent (not MCX INR pricing) — TradingView's free public
        widget doesn't carry licensed MCX real-time data. The AI recommendation, risk figures, and other panels on this
        page already use MCX-style INR pricing; wiring a real MCX feed here is a future integration.
      </p>
    </div>
  );
}
