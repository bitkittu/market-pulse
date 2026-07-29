import type { HoldingPick } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { WhyButton } from "@/components/ai-analysis";
import { CLASSIFICATION_STYLE, IMPACT_STYLE, RISK_STYLE, fmtInr, fmtPct, scoreColor, toneClass } from "./shared";

/** Desktop table row (§10). Column order matches the spec exactly. */
export function PickRow({
  pick,
  expanded,
  onToggle,
}: {
  pick: HoldingPick;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cls = CLASSIFICATION_STYLE[pick.classification];

  return (
    <tr
      className={cn(
        "border-b border-border/40 transition-colors",
        expanded ? "bg-primary/5" : "hover:bg-muted/20"
      )}
    >
      <td className="px-3 py-3 text-center">
        <span className="font-mono text-sm font-black text-muted-foreground tabular-nums">{pick.rank}</span>
      </td>

      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-foreground">{pick.displaySymbol}</span>
          {pick.isNew && (
            <span className="rounded border border-primary/40 bg-primary/10 px-1 py-px text-[9px] font-black uppercase text-primary">
              New
            </span>
          )}
        </div>
        <p className="max-w-[13rem] truncate text-[10px] text-muted-foreground" title={pick.name}>
          {pick.name}
        </p>
      </td>

      <td className="px-3 py-3 text-right">
        <span className="font-mono text-sm font-bold tabular-nums text-foreground">{fmtInr(pick.currentPrice)}</span>
        <p className={cn("font-mono text-[10px] tabular-nums", toneClass(pick.changePercent))}>
          {fmtPct(pick.changePercent, 2)}
        </p>
      </td>

      <td className={cn("px-3 py-3 text-right font-mono text-xs font-bold tabular-nums", toneClass(pick.return1m))}>
        {fmtPct(pick.return1m)}
      </td>

      <td className={cn("px-3 py-3 text-right font-mono text-xs font-bold tabular-nums", toneClass(pick.return3m))}>
        {fmtPct(pick.return3m)}
      </td>

      <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
        {pick.distanceFrom52wHighPct == null ? "—" : `−${pick.distanceFrom52wHighPct.toFixed(1)}%`}
      </td>

      <td className="px-3 py-3 text-center">
        <span className="whitespace-nowrap text-xs font-semibold text-foreground">{pick.trendLabel}</span>
      </td>

      <td className="px-3 py-3 text-center">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", IMPACT_STYLE[pick.catalystImpact].dot)}
            aria-hidden="true"
          />
          <span className={cn("whitespace-nowrap text-xs", IMPACT_STYLE[pick.catalystImpact].text)}>
            {pick.catalystLabel}
          </span>
        </span>
      </td>

      <td className="px-3 py-3 text-center">
        <button
          type="button"
          onClick={onToggle}
          title="See how this score was calculated"
          className="font-mono text-sm font-black tabular-nums transition-opacity hover:opacity-70"
        >
          <span className={scoreColor(pick.score)}>{pick.score}</span>
          <span className="text-[10px] font-normal text-muted-foreground">/100</span>
        </button>
        <p>
          <span className={cn("mt-0.5 inline-block rounded border px-1.5 py-px text-[9px] font-black uppercase", cls.badge)}>
            {pick.classificationLabel}
          </span>
        </p>
      </td>

      <td className={cn("px-3 py-3 text-center text-xs font-bold", RISK_STYLE[pick.riskLevel])}>
        {pick.riskLevel}
      </td>

      <td className="px-3 py-3 text-center">
        <WhyButton active={expanded} onClick={onToggle} />
      </td>
    </tr>
  );
}

/**
 * Mobile card (§28).
 *
 * The desktop table is never squeezed onto a phone — this is a separate layout
 * with the same data, and "Why This Stock?" opens the same full-screen panel.
 */
export function PickCard({
  pick,
  expanded,
  onToggle,
}: {
  pick: HoldingPick;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cls = CLASSIFICATION_STYLE[pick.classification];

  const rows: { label: string; value: string; className?: string }[] = [
    { label: "1M", value: fmtPct(pick.return1m), className: toneClass(pick.return1m) },
    { label: "3M", value: fmtPct(pick.return3m), className: toneClass(pick.return3m) },
    {
      label: "52W High",
      value: pick.distanceFrom52wHighPct == null ? "—" : `−${pick.distanceFrom52wHighPct.toFixed(1)}%`,
    },
    { label: "Risk", value: pick.riskLevel, className: RISK_STYLE[pick.riskLevel] },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-black text-muted-foreground">#{pick.rank}</span>
            <span className="truncate font-bold text-foreground">{pick.displaySymbol}</span>
            {pick.isNew && (
              <span className="rounded border border-primary/40 bg-primary/10 px-1 py-px text-[9px] font-black uppercase text-primary">
                New
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{pick.name}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-lg font-black leading-none tabular-nums">
            <span className={scoreColor(pick.score)}>{pick.score}</span>
            <span className="text-[10px] font-normal text-muted-foreground">/100</span>
          </p>
          <span className={cn("mt-1 inline-block rounded border px-1.5 py-px text-[9px] font-black uppercase", cls.badge)}>
            {pick.classificationLabel}
          </span>
        </div>
      </div>

      <p className="mt-2 font-mono text-base font-black tabular-nums text-foreground">
        {fmtInr(pick.currentPrice)}
        <span className={cn("ml-2 text-xs font-bold", toneClass(pick.changePercent))}>
          {fmtPct(pick.changePercent, 2)}
        </span>
      </p>

      <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-2">
            <dt className="text-[11px] text-muted-foreground">{r.label}</dt>
            <dd className={cn("font-mono text-xs font-bold tabular-nums", r.className ?? "text-foreground")}>
              {r.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-2.5 border-t border-border/50 pt-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Catalyst</p>
        <p className="mt-0.5 flex items-center gap-1.5">
          <span
            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", IMPACT_STYLE[pick.catalystImpact].dot)}
            aria-hidden="true"
          />
          <span className={cn("text-xs", IMPACT_STYLE[pick.catalystImpact].text)}>{pick.catalystLabel}</span>
          <span className="ml-auto text-[11px] text-muted-foreground">{pick.trendLabel}</span>
        </p>
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="mt-3 w-full rounded-lg border border-primary/40 bg-primary/10 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
      >
        Why This Stock?
      </button>
    </div>
  );
}
