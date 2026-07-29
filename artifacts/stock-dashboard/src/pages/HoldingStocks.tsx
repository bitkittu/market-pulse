import { Fragment, useMemo, useState } from "react";
import {
  useGetHoldingScan,
  useGetHoldingAnalysis,
  getGetHoldingAnalysisQueryKey,
  getGetHoldingScanQueryKey,
  type HoldingPick,
  type HoldingUniverseId,
} from "@workspace/api-client-react";
import { CalendarRange, Info, RefreshCw, ShieldQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  HoldingAnalysisPanel,
  PickCard,
  PickRow,
  PreviousPicks,
  SummaryCards,
} from "@/components/holding";

/**
 * Market Hub → Holding Stocks.
 *
 * A research and ranking surface for 1-3 month positional opportunities. It is
 * not intraday, not options, not long-term investing, and it does not issue
 * buy instructions — every classification is a setup-quality band (§11).
 *
 * The scan itself is post-close (§27): this page never polls. Refresh is manual
 * and simply re-reads the cached scan the server built at the last boundary.
 */

type TabId = "top" | "breakouts" | "momentum" | "catalysts" | "watchlist" | "previous";

const TABS: { id: TabId; label: string }[] = [
  { id: "top", label: "Top Picks" },
  { id: "breakouts", label: "Breakouts" },
  { id: "momentum", label: "Momentum" },
  { id: "catalysts", label: "Catalysts" },
  { id: "watchlist", label: "Watchlist" },
  { id: "previous", label: "Previous Picks" },
];

const COLS = [
  "Rank", "Stock", "Current", "1M", "3M", "52W High",
  "Trend", "Catalyst", "Score", "Risk", "Why?",
];

const RISK_ORDER = { Low: 0, Medium: 1, High: 2 } as const;

/** Local-only watchlist — the server-side watchlist API is scoped to quotes. */
const WATCHLIST_KEY = "mp-holding-watchlist";

function loadWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
}) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
      <span className="whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-semibold text-foreground focus:border-primary focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function HoldingStocks() {
  const [tab, setTab] = useState<TabId>("top");
  const [universe, setUniverse] = useState<HoldingUniverseId>("NIFTY_500");
  const [sector, setSector] = useState("all");
  const [minScore, setMinScore] = useState("0");
  const [maxRisk, setMaxRisk] = useState("High");
  const [maxHighDistance, setMaxHighDistance] = useState("100");
  const [watchlist, setWatchlist] = useState<string[]>(loadWatchlist);
  // Only one pick is ever expanded, so a single symbol is enough state.
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useGetHoldingScan(
    { universe },
    {
      query: {
        queryKey: getGetHoldingScanQueryKey({ universe }),
        // Post-close scan (§27) — no polling, and the cached scan stays fresh
        // for the rest of the session.
        staleTime: 900_000,
      },
    }
  );

  const {
    data: analysis,
    isLoading: analysisLoading,
    isError: analysisError,
  } = useGetHoldingAnalysis(
    expanded ?? "",
    { universe },
    {
      query: {
        queryKey: getGetHoldingAnalysisQueryKey(expanded ?? "", { universe }),
        enabled: !!expanded,
        staleTime: 900_000,
      },
    }
  );

  const toggleWatch = (symbol: string) => {
    setWatchlist((prev) => {
      const next = prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol];
      try {
        localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
      return next;
    });
  };

  const picks = useMemo<HoldingPick[]>(() => {
    const all = data?.picks ?? [];
    const scoreFloor = Number(minScore);
    const riskCap = RISK_ORDER[maxRisk as keyof typeof RISK_ORDER] ?? 2;
    const distanceCap = Number(maxHighDistance);

    const base = all.filter(
      (p) =>
        (sector === "all" || p.sector === sector) &&
        p.score >= scoreFloor &&
        RISK_ORDER[p.riskLevel] <= riskCap &&
        (p.distanceFrom52wHighPct == null || p.distanceFrom52wHighPct <= distanceCap)
    );

    switch (tab) {
      case "breakouts":
        // Within 5% of the 52-week high — the breakout-adjacent cohort.
        return base.filter((p) => p.distanceFrom52wHighPct != null && p.distanceFrom52wHighPct <= 5);
      case "momentum":
        return base.filter((p) => (p.return1m ?? 0) > 0 && (p.return3m ?? 0) > 0);
      case "catalysts":
        return base.filter((p) => p.catalystImpact === "Positive");
      case "watchlist":
        return base.filter((p) => watchlist.includes(p.symbol));
      default:
        return base;
    }
  }, [data, tab, sector, minScore, maxRisk, maxHighDistance, watchlist]);

  const summary = data?.summary;
  const universeOptions = (data?.universes ?? []).map((u) => ({
    value: u.id,
    label: u.available ? `${u.label} (${u.size})` : `${u.label} — unavailable`,
    disabled: !u.available,
  }));

  const Header = (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/15">
          <CalendarRange className="h-4 w-4 text-cyan-500 dark:text-cyan-400" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-black text-foreground">Holding Stocks</h1>
          <p className="text-xs text-muted-foreground">
            AI-screened 1–3 month opportunities based on trend, momentum, fundamentals, catalysts and risk.
          </p>
        </div>
      </div>
      <button
        onClick={() => refetch()}
        disabled={isFetching}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-all hover:text-foreground"
      >
        <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} /> Refresh
      </button>
    </div>
  );

  const EducationalNote = (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" aria-hidden="true" />
      <p className="text-xs leading-relaxed text-muted-foreground">
        <span className="font-semibold text-yellow-600 dark:text-yellow-400">Research signals:</span>{" "}
        MarketPulse scores are research signals, not guaranteed returns or personalized investment
        advice. This module ranks opportunities for an approximately 1–3 month holding period — it is
        not intraday trading, options trading, or long-term investing.
      </p>
    </div>
  );

  return (
    <div>
      {Header}
      {EducationalNote}

      {isError && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
          The Holding Stocks scan could not be loaded. Try refreshing in a moment.
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-card" />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-card" />
          ))}
        </div>
      )}

      {summary && (
        <>
          <SummaryCards summary={summary} />

          {summary.universeNote && (
            <p className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              <ShieldQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {summary.universeNote}
            </p>
          )}

          {/* Tabs */}
          <div className="mt-4 flex items-center gap-0 overflow-x-auto border-b border-border">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  aria-current={active}
                  className={cn(
                    "relative shrink-0 whitespace-nowrap px-3 py-2.5 text-xs font-bold transition-colors sm:px-4 sm:text-sm",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                  {active && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-primary" />}
                </button>
              );
            })}
          </div>

          {tab === "previous" ? (
            <div className="mt-4">
              <PreviousPicks />
            </div>
          ) : (
            <>
              {/* Filters */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-3 py-2.5">
                <FilterSelect
                  label="Universe"
                  value={universe}
                  onChange={(v) => setUniverse(v as HoldingUniverseId)}
                  options={universeOptions}
                />
                <FilterSelect
                  label="Sector"
                  value={sector}
                  onChange={setSector}
                  options={[
                    { value: "all", label: "All" },
                    ...(data?.sectors ?? []).map((s) => ({ value: s, label: s })),
                  ]}
                />
                <FilterSelect
                  label="Min score"
                  value={minScore}
                  onChange={setMinScore}
                  options={[
                    { value: "0", label: "Any" },
                    { value: "70", label: "70+" },
                    { value: "78", label: "78+ (Strong)" },
                    { value: "85", label: "85+" },
                  ]}
                />
                <FilterSelect
                  label="Max risk"
                  value={maxRisk}
                  onChange={setMaxRisk}
                  options={[
                    { value: "High", label: "Any" },
                    { value: "Medium", label: "Medium or lower" },
                    { value: "Low", label: "Low only" },
                  ]}
                />
                <FilterSelect
                  label="52W high within"
                  value={maxHighDistance}
                  onChange={setMaxHighDistance}
                  options={[
                    { value: "100", label: "Any" },
                    { value: "15", label: "15%" },
                    { value: "10", label: "10%" },
                    { value: "5", label: "5%" },
                  ]}
                />
                <span className="ml-auto whitespace-nowrap text-[11px] font-semibold text-muted-foreground">
                  {picks.length} shown
                </span>
              </div>

              {picks.length === 0 ? (
                <div className="mt-4 rounded-xl border border-border bg-card p-8 text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {tab === "watchlist"
                      ? "Nothing on your watchlist yet"
                      : "No stocks match these filters"}
                  </p>
                  <p className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground">
                    {tab === "watchlist"
                      ? "Open a stock's analysis and add it to your watchlist to track it here."
                      : summary.qualifiedCount === 0
                        ? `No stock in the screened universe cleared the ${summary.qualificationThreshold}/100 quality bar in this scan. The list is never padded with weaker names.`
                        : "Relax a filter to see more of this scan's qualified opportunities."}
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="mt-4 hidden overflow-hidden rounded-xl border border-border md:block">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[64rem]">
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
                          {picks.map((p) => {
                            const isExpanded = expanded === p.symbol;
                            return (
                              <Fragment key={p.symbol}>
                                <PickRow
                                  pick={p}
                                  expanded={isExpanded}
                                  onToggle={() => setExpanded(isExpanded ? null : p.symbol)}
                                />
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={COLS.length} className="p-0">
                                      <div className="p-3">
                                        <HoldingAnalysisPanel
                                          analysis={analysis}
                                          isLoading={analysisLoading}
                                          isError={analysisError}
                                          onClose={() => setExpanded(null)}
                                          pendingTitle={p.name}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => toggleWatch(p.symbol)}
                                          className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
                                        >
                                          {watchlist.includes(p.symbol)
                                            ? "Remove from watchlist"
                                            : "Add to watchlist"}
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile cards */}
                  <div className="mt-4 space-y-2.5 md:hidden">
                    {picks.map((p) => (
                      <PickCard
                        key={p.symbol}
                        pick={p}
                        expanded={expanded === p.symbol}
                        onToggle={() => setExpanded(expanded === p.symbol ? null : p.symbol)}
                      />
                    ))}
                    {expanded && (
                      <HoldingAnalysisPanel
                        analysis={analysis}
                        isLoading={analysisLoading}
                        isError={analysisError}
                        onClose={() => setExpanded(null)}
                        pendingTitle={picks.find((p) => p.symbol === expanded)?.name}
                      />
                    )}
                  </div>
                </>
              )}

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <p className="rounded-xl border border-border bg-card px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">Scan coverage:</span>{" "}
                  {summary.screened} in {summary.universeResolved.replace("_", " ")} ·{" "}
                  {summary.analysed} with sufficient price history ·{" "}
                  {summary.rejectedIlliquid} excluded by the liquidity floor ·{" "}
                  {summary.shortlisted} deep-analysed · {summary.qualifiedCount} cleared the{" "}
                  {summary.qualificationThreshold}/100 bar.
                </p>
                <p className="rounded-xl border border-border bg-card px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">Refresh:</span> a full scan runs
                  after market close, not continuously — this is a 1–3 month module.{" "}
                  {summary.nextScanAt &&
                    `Next scan ${new Date(summary.nextScanAt).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })} IST.`}
                </p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
