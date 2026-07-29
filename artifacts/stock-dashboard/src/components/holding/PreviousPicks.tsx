import {
  getGetHoldingPreviousPicksQueryKey,
  useGetHoldingPreviousPicks,
} from "@workspace/api-client-react";
import { History, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLASSIFICATION_STYLE, fmtInr, fmtPct, toneClass } from "./shared";

/**
 * Previous Picks (§23).
 *
 * The point of this tab is to make the Holding Score falsifiable: it shows what
 * was picked, at what price, and what actually happened afterwards. Forward
 * returns render as "Pending" until the window has genuinely elapsed — a blank
 * is honest, an extrapolated number would not be (§22).
 */

const COLS = [
  "Stock", "Selected", "Sel. Price", "Current", "Return",
  "1M", "2M", "3M", "Max Gain", "Max DD", "Status",
];

function Cell({ value, dp = 1 }: { value: number | null; dp?: number }) {
  if (value == null) {
    return <span className="text-[10px] italic text-muted-foreground">Pending</span>;
  }
  return (
    <span className={cn("font-mono text-xs font-bold tabular-nums", toneClass(value))}>
      {fmtPct(value, dp)}
    </span>
  );
}

export function PreviousPicks() {
  const { data, isLoading, isError } = useGetHoldingPreviousPicks({
    query: {
      queryKey: getGetHoldingPreviousPicksQueryKey(),
      staleTime: 300_000,
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-card" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
        Could not load previous picks.
      </div>
    );
  }

  if (!data || data.picks.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <History className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="mt-2 text-sm font-semibold text-foreground">No pick history yet</p>
        <p className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground">
          {data?.note ?? "Scan history is not available."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Forward returns are measured from the scan price using real daily closes. A window that
          has not elapsed yet shows <span className="italic">Pending</span> rather than an estimate.
        </p>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {COLS.map((c) => (
                  <th
                    key={c}
                    className="whitespace-nowrap px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.picks.map((p, i) => (
                <tr key={`${p.symbol}-${p.scanDate}-${i}`} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="px-3 py-2.5">
                    <span className="font-bold text-foreground">{p.symbol}</span>
                    <span
                      className={cn(
                        "ml-1.5 rounded border px-1 py-px text-[9px] font-black uppercase",
                        CLASSIFICATION_STYLE[p.classification].badge
                      )}
                    >
                      {p.score}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-center text-xs text-muted-foreground">
                    {new Date(p.scanDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-foreground">
                    {fmtInr(p.scanPrice)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-foreground">
                    {p.currentPrice == null ? "—" : fmtInr(p.currentPrice)}
                  </td>
                  <td className="px-3 py-2.5 text-right"><Cell value={p.returnPct ?? null} dp={2} /></td>
                  <td className="px-3 py-2.5 text-right"><Cell value={p.return1m ?? null} /></td>
                  <td className="px-3 py-2.5 text-right"><Cell value={p.return2m ?? null} /></td>
                  <td className="px-3 py-2.5 text-right"><Cell value={p.return3m ?? null} /></td>
                  <td className="px-3 py-2.5 text-right"><Cell value={p.maxGainPct ?? null} /></td>
                  <td className="px-3 py-2.5 text-right"><Cell value={p.maxDrawdownPct ?? null} /></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-center text-[11px] text-muted-foreground">
                    {p.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2.5 md:hidden">
        {data.picks.map((p, i) => (
          <div key={`${p.symbol}-${p.scanDate}-${i}`} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-bold text-foreground">{p.symbol}</span>
                <p className="text-[11px] text-muted-foreground">
                  Selected {new Date(p.scanDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}
                  {" · "}{fmtInr(p.scanPrice)}
                </p>
              </div>
              <div className="text-right">
                <p className={cn("font-mono text-base font-black tabular-nums", toneClass(p.returnPct ?? null))}>
                  {fmtPct(p.returnPct ?? null, 2)}
                </p>
                <p className="text-[10px] text-muted-foreground">{p.currentPrice == null ? "—" : fmtInr(p.currentPrice)}</p>
              </div>
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1">
              {([["1M", p.return1m], ["2M", p.return2m], ["3M", p.return3m], ["Max Gain", p.maxGainPct], ["Max DD", p.maxDrawdownPct]] as const).map(
                ([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-1">
                    <dt className="text-[10px] text-muted-foreground">{label}</dt>
                    <dd><Cell value={value ?? null} /></dd>
                  </div>
                )
              )}
            </dl>
            <p className="mt-2 text-[10px] text-muted-foreground">{p.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
