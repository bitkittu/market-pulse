import { useEffect, useState } from "react";
import { Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EXCHANGES, getExchangeStatus } from "./data";

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function ExchangeRow({ exchangeId }: { exchangeId: (typeof EXCHANGES)[number]["id"] }) {
  const exchange = EXCHANGES.find((e) => e.id === exchangeId)!;
  const [status, setStatus] = useState(() => getExchangeStatus(exchange));

  useEffect(() => {
    const id = setInterval(() => setStatus(getExchangeStatus(exchange)), 1000);
    return () => clearInterval(id);
  }, [exchange]);

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border/60 last:border-b-0">
      <div className="min-w-0">
        <div className="text-xs font-bold text-foreground truncate">{exchange.id}</div>
        <div className="text-[10px] text-muted-foreground truncate">{exchange.city}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs font-mono font-bold text-foreground tabular-nums">{status.localTime}</div>
        <div
          className={cn(
            "text-[10px] font-semibold flex items-center justify-end gap-1",
            status.isOpen ? "text-emerald-500" : "text-muted-foreground",
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", status.isOpen ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50")} />
          {status.isOpen ? "Open" : "Closed"} · {status.nextEventLabel} {formatCountdown(status.msRemaining)}
        </div>
      </div>
    </div>
  );
}

export function ExchangeStatusPanel() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="text-sm font-black text-foreground flex items-center gap-1.5 mb-3">
        <Globe2 className="w-4 h-4 text-primary" /> Exchange Status
      </h2>
      <div>
        {EXCHANGES.map((e) => (
          <ExchangeRow key={e.id} exchangeId={e.id} />
        ))}
      </div>
    </div>
  );
}
