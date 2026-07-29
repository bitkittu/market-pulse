import { useState } from "react";
import type { AnalysisProvenance, Provenance } from "@workspace/api-client-react";
import { ChevronDown, Database, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSynthetic } from "./shared";

const TAG: Record<Provenance, string> = {
  LIVE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  API: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  CALCULATED: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  MOCK: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
  GENERATED: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
  STATIC: "bg-muted/50 text-muted-foreground border-border",
  UNAVAILABLE: "bg-muted/50 text-muted-foreground border-border",
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

/**
 * Where this recommendation came from (§17).
 *
 * When any scored input is synthetic the banner says so in plain language.
 * A simulated signal must never be able to pass for a live production
 * recommendation (§18).
 */
export function DataProvenance({ provenance }: { provenance: AnalysisProvenance }) {
  const [open, setOpen] = useState(false);
  const simulated = provenance.mode !== "LIVE";

  return (
    <div
      className={cn(
        "rounded-xl border",
        simulated ? "border-orange-500/30 bg-orange-500/5" : "border-emerald-500/25 bg-emerald-500/5"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2">
        {simulated ? (
          <FlaskConical className="h-3.5 w-3.5 shrink-0 text-orange-500" aria-hidden="true" />
        ) : (
          <Database className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
        )}
        <span className={cn("text-[11px] font-bold", simulated ? "text-orange-600 dark:text-orange-400" : "text-emerald-600 dark:text-emerald-400")}>
          {provenance.mode === "MOCK"
            ? "Simulated data — not a live recommendation"
            : provenance.mode === "PARTIAL"
              ? "Partly simulated — some inputs are not live"
              : "Live market data"}
        </span>

        <span className="text-[10px] text-muted-foreground">
          Signal generated <span className="font-mono text-foreground">{fmtTime(provenance.signalGeneratedAt)}</span>
        </span>
        <span className="text-[10px] text-muted-foreground">
          Data updated <span className="font-mono text-foreground">{fmtTime(provenance.dataUpdatedAt)}</span>
        </span>
        <span className="text-[10px] text-muted-foreground">
          Timeframes <span className="font-mono text-foreground">{provenance.timeframes.join(" + ")}</span>
        </span>
        <span className="text-[10px] text-muted-foreground">
          Engine{" "}
          <span className="font-mono text-foreground">
            {provenance.engine} {provenance.engineVersion}
          </span>
        </span>

        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          aria-expanded={open}
          className="ml-auto flex items-center gap-1 text-[10px] font-bold text-muted-foreground transition-colors hover:text-foreground"
        >
          Field sources
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="border-t border-border/50 px-3 py-2">
          <p className="mb-2 text-[10px] text-muted-foreground">
            Source: <span className="text-foreground">{provenance.dataSource}</span>
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {provenance.fields.map((f) => (
              <li key={f.name} className="flex items-center justify-between gap-2">
                <span className={cn("truncate text-[10px]", isSynthetic(f.provenance) ? "text-muted-foreground" : "text-foreground")}>
                  {f.name}
                </span>
                <span className={cn("shrink-0 rounded border px-1.5 py-px text-[9px] font-black", TAG[f.provenance])}>
                  {f.provenance}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
