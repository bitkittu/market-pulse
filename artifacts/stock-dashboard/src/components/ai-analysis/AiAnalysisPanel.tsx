import { useEffect, useState } from "react";
import type { AiAnalysis } from "@workspace/api-client-react";
import { Minimize2, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { AISignalScore } from "./AISignalScore";
import { AnalysisMetrics } from "./AnalysisMetrics";
import { DataProvenance } from "./DataProvenance";
import { MultiTimeframeSummaryCard } from "./MultiTimeframeSummaryCard";
import { OptionsTradePlan } from "./OptionsTradePlan";
import { RiskFactors } from "./RiskFactors";
import { TimeframeTrendCard } from "./TimeframeTrendCard";
import { WhyThisPick } from "./WhyThisPick";
import { AnalysisCard, SIGNAL_BADGE, Sparkline, StatRow } from "./shared";

type TabId = "ai" | "charts" | "oi" | "strategy" | "risk";

interface TabDef {
  id: TabId;
  label: string;
}

function ChangeChip({ pct }: { pct: number }) {
  const pos = pct >= 0;
  return (
    <span className={cn("font-mono text-xs font-bold", pos ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
      {pos ? "▲" : "▼"}
      {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

/** Charts tab — the two timeframe series at a readable size. */
function ChartsTab({ analysis }: { analysis: AiAnalysis }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {analysis.timeframes.map((tf) => (
        <AnalysisCard key={tf.timeframe} title={`${tf.label} · ${tf.direction}`}>
          <Sparkline data={tf.sparkline} direction={tf.direction} height={120} />
          <p className="mt-2 text-[10px] text-muted-foreground">
            Normalised {tf.caption.toLowerCase()} over the {tf.timeframe} window · strength {tf.strength}/100
          </p>
        </AnalysisCard>
      ))}
      <p className="text-[10px] text-muted-foreground lg:col-span-2">
        Full candlestick charts with drawable levels arrive with the live OHLCV feed.
      </p>
    </div>
  );
}

/** OI Analysis tab — option-chain context and the Greeks placeholders. */
function OiTab({ analysis }: { analysis: AiAnalysis }) {
  const chain = analysis.optionChain;
  const greeks = analysis.greeks;
  if (!chain && !greeks) return null;

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {chain && (
        <AnalysisCard title="Option Chain Context" className="lg:col-span-2">
          <dl className="grid gap-x-6 sm:grid-cols-2">
            {chain.pcr != null && <StatRow label="Put/Call Ratio" value={chain.pcr.toFixed(2)} tone={chain.pcr > 1 ? "negative" : "positive"} />}
            {chain.maxPain != null && <StatRow label="Max Pain" value={`₹${chain.maxPain.toLocaleString("en-IN")}`} />}
            {chain.callOi != null && <StatRow label="Call OI" value={chain.callOi.toLocaleString("en-IN")} />}
            {chain.putOi != null && <StatRow label="Put OI" value={chain.putOi.toLocaleString("en-IN")} />}
            {chain.moneyness && <StatRow label="Moneyness" value={chain.moneyness} />}
            {chain.oiBuildup && <StatRow label="OI Buildup" value={chain.oiBuildup} />}
          </dl>

          {chain.nearbyStrikes.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[20rem] text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-1.5 font-bold">Strike</th>
                    <th className="py-1.5 text-right font-bold">Call OI</th>
                    <th className="py-1.5 text-right font-bold">Put OI</th>
                  </tr>
                </thead>
                <tbody>
                  {chain.nearbyStrikes.map((s) => (
                    <tr key={s.strike} className="border-b border-border/30">
                      <td className="py-1.5 font-mono font-bold text-foreground">₹{s.strike.toLocaleString("en-IN")}</td>
                      <td className="py-1.5 text-right font-mono text-emerald-600 dark:text-emerald-400">{s.callOi.toLocaleString("en-IN")}</td>
                      <td className="py-1.5 text-right font-mono text-red-600 dark:text-red-400">{s.putOi.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[10px] text-muted-foreground">{chain.note}</p>
        </AnalysisCard>
      )}

      {greeks && (
        <AnalysisCard title="Greeks">
          <dl className="divide-y divide-border/40">
            {greeks.values.map((g) => (
              <StatRow
                key={g.label}
                label={g.label}
                value={g.available && g.value ? g.value : "Unavailable"}
                tone={g.available ? "neutral" : "neutral"}
              />
            ))}
          </dl>
          <p className="mt-2 text-[10px] leading-snug text-muted-foreground">{greeks.note}</p>
        </AnalysisCard>
      )}
    </div>
  );
}

function ComingSoonTab({ title, features }: { title: string; features: string[] }) {
  return (
    <AnalysisCard title={title}>
      <p className="text-xs text-muted-foreground">This tab is reserved for the next release. Planned:</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {features.map((f) => (
          <li key={f} className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground">
            {f}
          </li>
        ))}
      </ul>
    </AnalysisCard>
  );
}

function AiTab({ analysis }: { analysis: AiAnalysis }) {
  return (
    <div className="space-y-3">
      {/* Mirrors the mockup: score+why, 3m, 15m, alignment, plan across five columns. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className="flex flex-col gap-3">
          <AISignalScore score={analysis.score} />
          <WhyThisPick reasons={analysis.reasons} />
        </div>
        {analysis.timeframes.map((tf) => (
          <TimeframeTrendCard key={tf.timeframe} trend={tf} />
        ))}
        <MultiTimeframeSummaryCard summary={analysis.multiTimeframe} />
        <OptionsTradePlan plan={analysis.tradePlan} />
      </div>

      <RiskFactors risks={analysis.risks} />
      <AnalysisMetrics metrics={analysis.metrics} updatedAt={analysis.provenance.dataUpdatedAt} />
      <DataProvenance provenance={analysis.provenance} />
    </div>
  );
}

function PanelHeader({
  analysis,
  onClose,
  compact,
}: {
  analysis: AiAnalysis;
  onClose: () => void;
  compact: boolean;
}) {
  const { headline } = analysis;
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 className="font-mono text-lg font-black text-foreground">{analysis.title}</h3>
          <span className={cn("rounded-lg border px-2 py-0.5 text-xs font-black", SIGNAL_BADGE[analysis.signal])}>
            {analysis.signalLabel}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{analysis.subtitle}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {headline.primaryLabel}
            <span className="font-mono font-bold text-foreground">{headline.primaryValue}</span>
            {headline.primaryChangePercent != null && <ChangeChip pct={headline.primaryChangePercent} />}
          </span>
          {headline.secondaryLabel && headline.secondaryValue && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {headline.secondaryLabel}
              <span className="font-mono font-bold text-foreground">{headline.secondaryValue}</span>
              {headline.secondaryChangePercent != null && <ChangeChip pct={headline.secondaryChangePercent} />}
            </span>
          )}
        </div>
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
      <div className="h-12 animate-pulse rounded-lg bg-muted/40" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-xl bg-muted/40" />
        ))}
      </div>
    </div>
  );
}

export interface AiAnalysisPanelProps {
  analysis: AiAnalysis | undefined;
  isLoading: boolean;
  isError: boolean;
  onClose: () => void;
  /** Fallback title shown while the analysis is still loading. */
  pendingTitle?: string;
}

/**
 * The AI Decision Breakdown.
 *
 * On desktop this renders inline underneath the selected row; on mobile it
 * becomes a full-screen sheet, because squeezing a five-column dashboard into a
 * phone-width table is unreadable (§20). Only one instance is ever mounted —
 * the parent owns which pick is expanded.
 */
export function AiAnalysisPanel({ analysis, isLoading, isError, onClose, pendingTitle }: AiAnalysisPanelProps) {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<TabId>("ai");

  // Reset to the primary tab whenever a different pick is opened.
  useEffect(() => {
    setTab("ai");
  }, [analysis?.id]);

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

  const hasChain = !!analysis?.optionChain || !!analysis?.greeks;
  const tabs: TabDef[] = [
    { id: "ai", label: "AI Analysis" },
    { id: "charts", label: "Charts" },
    ...(hasChain ? [{ id: "oi" as TabId, label: "OI Analysis" }] : []),
    { id: "strategy", label: "Strategy" },
    { id: "risk", label: "Risk Calculator" },
  ];

  const body = (
    <>
      {isLoading && <PanelSkeleton />}

      {isError && !isLoading && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-center">
          <p className="text-sm font-semibold text-red-600 dark:text-red-400">Could not load the AI analysis</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The signal engine did not return a breakdown for this pick. Try refreshing the page.
          </p>
        </div>
      )}

      {analysis && !isLoading && !isError && (
        <>
          <PanelHeader analysis={analysis} onClose={onClose} compact={isMobile} />

          <div className="mt-3 flex gap-1 overflow-x-auto border-b border-border">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id}
                className={cn(
                  "relative shrink-0 whitespace-nowrap px-3 py-2 text-xs font-bold transition-colors",
                  tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                {tab === t.id && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-primary" />}
              </button>
            ))}
          </div>

          <div className="mt-3">
            {tab === "ai" && <AiTab analysis={analysis} />}
            {tab === "charts" && <ChartsTab analysis={analysis} />}
            {tab === "oi" && <OiTab analysis={analysis} />}
            {tab === "strategy" && (
              <ComingSoonTab
                title="Strategy"
                features={["Spreads", "Straddle / Strangle", "Iron Condor", "Covered Call", "Hedge Builder", "Backtest"]}
              />
            )}
            {tab === "risk" && (
              <ComingSoonTab
                title="Risk Calculator"
                features={["Position sizing", "Capital at risk", "Break-even", "Payoff diagram", "Margin estimate", "Kelly sizing"]}
              />
            )}
          </div>
        </>
      )}
    </>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="AI analysis">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-mono text-sm font-black text-foreground">
            {analysis?.title ?? pendingTitle ?? "AI Analysis"}
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
    <div className="rounded-xl border border-primary/30 bg-background/60 p-4 shadow-lg ring-1 ring-primary/10">{body}</div>
  );
}
