import { useEffect } from "react";
import type { AnalysisMetric, HoldingAnalysis } from "@workspace/api-client-react";
import { AlertCircle, ExternalLink, Minimize2, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  AISignalScore,
  AnalysisCard,
  DataProvenance,
  RiskFactors,
  WhyThisPick,
} from "@/components/ai-analysis";
import { CLASSIFICATION_STYLE, IMPACT_STYLE, fmtPct } from "./shared";

/**
 * The Holding Stocks "Why?" breakdown.
 *
 * Same shell and primitives as the Options AI Decision Breakdown — inline under
 * the row on desktop, full-screen sheet on mobile, one instance mounted at a
 * time (§12, §28). The section composition differs because a 1-3 month
 * positional case is made of different evidence than an options trade: there is
 * no trade plan and no Greeks here, and there is deliberately no price target.
 */

/**
 * Label/value grid used by Technical, Momentum, Fundamentals and Price Levels.
 *
 * `columns` is the widest the grid is ever allowed to get. These cards sit in a
 * four-across dashboard, so a one-column card must stay one column at every
 * breakpoint — and the value/badge pair wraps rather than overflowing, because
 * badges like "percentage points" are wider than the column they live in.
 */
function MetricGrid({ items, columns = 2 }: { items: AnalysisMetric[]; columns?: 1 | 2 | 3 }) {
  return (
    <dl
      className={cn(
        "grid gap-x-6",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        columns === 2 && "sm:grid-cols-2"
      )}
    >
      {items.map((m) => {
        const unavailable = m.provenance === "UNAVAILABLE";
        return (
          <div
            key={m.label}
            className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-border/30 py-1.5 last:border-b-0"
          >
            <dt className="min-w-0 shrink text-xs text-muted-foreground">{m.label}</dt>
            <dd className="flex min-w-0 flex-wrap items-baseline justify-end gap-x-1.5 text-right">
              <span
                className={cn(
                  "font-mono text-xs font-bold tabular-nums",
                  unavailable && "font-sans font-medium italic text-muted-foreground",
                  !unavailable && m.tone === "positive" && "text-emerald-600 dark:text-emerald-400",
                  !unavailable && m.tone === "negative" && "text-red-600 dark:text-red-400",
                  !unavailable && m.tone === "neutral" && "text-foreground"
                )}
              >
                {m.value}
              </span>
              {m.badge && !unavailable && (
                <span className="whitespace-nowrap rounded border border-border bg-muted/30 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                  {m.badge}
                </span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** §20 — the compact 1-3 month outlook. */
function OutlookCard({ outlook }: { outlook: HoldingAnalysis["outlook"] }) {
  const rows: { label: string; value: string; good: boolean | null }[] = [
    { label: "Trend", value: outlook.trend, good: outlook.trend === "Strong" || outlook.trend === "Positive" },
    { label: "Momentum", value: outlook.momentum, good: outlook.momentum === "Strong" ? true : outlook.momentum === "Weak" ? false : null },
    { label: "Catalyst", value: outlook.catalyst, good: outlook.catalyst === "Positive" ? true : outlook.catalyst === "Negative" ? false : null },
    { label: "Risk", value: outlook.risk, good: outlook.risk === "Low" ? true : outlook.risk === "High" ? false : null },
  ];

  return (
    <AnalysisCard title="1–3 Month Outlook">
      <dl className="divide-y divide-border/40">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 py-1.5">
            <dt className="text-xs text-muted-foreground">{r.label}</dt>
            <dd
              className={cn(
                "font-mono text-xs font-bold",
                r.good === true && "text-emerald-600 dark:text-emerald-400",
                r.good === false && "text-red-600 dark:text-red-400",
                r.good === null && "text-foreground"
              )}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-2 rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Overall</p>
        <p className="font-mono text-sm font-black text-primary">{outlook.overall}</p>
      </div>
      <p className="mt-2 text-[10px] leading-snug text-muted-foreground">{outlook.note}</p>
    </AnalysisCard>
  );
}

/** §18 — dated, sourced, classified catalysts. Never model-generated. */
function CatalystsCard({ catalysts }: { catalysts: HoldingAnalysis["catalysts"] }) {
  return (
    <AnalysisCard
      title="Recent Catalysts"
      action={<span className="text-[10px] text-muted-foreground">Source-attributed headlines</span>}
    >
      {catalysts.items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No recent catalysts returned for this stock.</p>
      ) : (
        <ul className="space-y-2">
          {catalysts.items.map((c, i) => {
            const style = IMPACT_STYLE[c.impact];
            return (
              <li key={`${c.title}-${i}`} className="flex items-start gap-2.5">
                <span
                  className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", style.dot)}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-snug text-foreground">
                    {c.url ? (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-start gap-1 hover:text-primary hover:underline"
                      >
                        {c.title}
                        <ExternalLink className="mt-0.5 h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                      </a>
                    ) : (
                      c.title
                    )}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                    <span className={cn("font-bold uppercase tracking-wide", style.text)}>{c.impact}</span>
                    <span>·</span>
                    <span>{c.kind}</span>
                    <span>·</span>
                    <span>{c.source}</span>
                    {c.date && (
                      <>
                        <span>·</span>
                        <span>
                          {new Date(c.date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2.5 text-[10px] leading-snug text-muted-foreground">{catalysts.note}</p>
    </AnalysisCard>
  );
}

function PanelHeader({
  analysis,
  onClose,
  compact,
}: {
  analysis: HoldingAnalysis;
  onClose: () => void;
  compact: boolean;
}) {
  const h = analysis.header;
  const style = CLASSIFICATION_STYLE[analysis.classification];

  const stats: { label: string; value: string; tone?: "positive" | "negative" }[] = [
    { label: "Current Price", value: `₹${h.currentPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` },
    {
      label: "1M",
      value: fmtPct(h.return1m),
      tone: h.return1m == null ? undefined : h.return1m >= 0 ? "positive" : "negative",
    },
    {
      label: "3M",
      value: fmtPct(h.return3m),
      tone: h.return3m == null ? undefined : h.return3m >= 0 ? "positive" : "negative",
    },
    {
      label: "52W High Distance",
      value: h.distanceFrom52wHighPct == null ? "—" : `−${h.distanceFrom52wHighPct.toFixed(1)}%`,
    },
    { label: "Risk", value: h.riskLevel },
    {
      label: "Last Scan",
      value: new Date(h.lastScanAt).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ];

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 className="font-mono text-lg font-black text-foreground">{analysis.name}</h3>
          <span className="rounded border border-border bg-muted/30 px-1.5 py-px font-mono text-[10px] font-bold text-muted-foreground">
            {analysis.displaySymbol}
          </span>
          <span className={cn("rounded-lg border px-2 py-0.5 text-xs font-black", style.badge)}>
            {analysis.classificationLabel}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          MarketPulse Holding Score:{" "}
          <span className="font-mono font-bold text-foreground">{analysis.score.score}/100</span> ·{" "}
          {analysis.sector}
        </p>

        <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <dt>{s.label}</dt>
              <dd
                className={cn(
                  "font-mono font-bold",
                  s.tone === "positive" && "text-emerald-600 dark:text-emerald-400",
                  s.tone === "negative" && "text-red-600 dark:text-red-400",
                  !s.tone && "text-foreground"
                )}
              >
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!compact && (
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <Minimize2 className="h-3 w-3" /> Collapse
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close analysis"
          className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-16 animate-pulse rounded-lg bg-muted/40" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-xl bg-muted/40" />
        ))}
      </div>
    </div>
  );
}

export interface HoldingAnalysisPanelProps {
  analysis: HoldingAnalysis | undefined;
  isLoading: boolean;
  isError: boolean;
  onClose: () => void;
  pendingTitle?: string;
}

export function HoldingAnalysisPanel({
  analysis,
  isLoading,
  isError,
  onClose,
  pendingTitle,
}: HoldingAnalysisPanelProps) {
  const isMobile = useIsMobile();

  // Lock background scroll while the mobile sheet is open.
  useEffect(() => {
    if (!isMobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMobile]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const body = (
    <>
      {isLoading && <PanelSkeleton />}

      {isError && !isLoading && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-center">
          <p className="text-sm font-semibold text-red-600 dark:text-red-400">
            Could not load this stock&apos;s analysis
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The scan engine did not return a breakdown for this symbol. Try refreshing the page.
          </p>
        </div>
      )}

      {analysis && !isLoading && !isError && (
        <>
          <PanelHeader analysis={analysis} onClose={onClose} compact={isMobile} />

          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <AISignalScore
                score={analysis.score}
                title="MarketPulse Holding Score"
                footnote={
                  <>
                    Setup <strong className="font-semibold text-foreground">quality</strong>, not a
                    probability of profit or a return forecast.
                  </>
                }
              />
              <WhyThisPick reasons={analysis.reasons} title="Why MarketPulse Selected It" />
              <AnalysisCard title="Technical Strength">
                <MetricGrid items={analysis.technical} columns={1} />
              </AnalysisCard>
              <div className="flex flex-col gap-3">
                <AnalysisCard title="Momentum">
                  <MetricGrid items={analysis.momentum} columns={1} />
                </AnalysisCard>
                <OutlookCard outlook={analysis.outlook} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <AnalysisCard
                title="Fundamentals"
                action={
                  !analysis.fundamentals.available && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <AlertCircle className="h-3 w-3" /> Limited data
                    </span>
                  )
                }
              >
                <MetricGrid items={analysis.fundamentals.items} columns={2} />
                <p className="mt-2.5 text-[10px] leading-snug text-muted-foreground">
                  {analysis.fundamentals.note}
                </p>
              </AnalysisCard>

              <CatalystsCard catalysts={analysis.catalysts} />
            </div>

            <RiskFactors
              risks={analysis.risks}
              title="What Could Go Wrong?"
              caption="Evidence against this opportunity"
            />

            <AnalysisCard
              title="Price Levels"
              action={
                <span className="text-[10px] text-muted-foreground">
                  Swing structure — no target price is generated
                </span>
              }
            >
              <MetricGrid items={analysis.priceLevels} columns={3} />
            </AnalysisCard>

            <DataProvenance provenance={analysis.provenance} />
          </div>
        </>
      )}
    </>
  );

  if (isMobile) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col bg-background"
        role="dialog"
        aria-modal="true"
        aria-label="Holding stock analysis"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-mono text-sm font-black text-foreground">
            {analysis?.name ?? pendingTitle ?? "Analysis"}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close analysis"
            className="rounded-lg border border-border p-1.5 text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">{body}</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-background/60 p-4 shadow-lg ring-1 ring-primary/10">
      {body}
    </div>
  );
}
