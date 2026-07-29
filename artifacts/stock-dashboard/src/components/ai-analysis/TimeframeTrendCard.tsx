import type { TimeframeTrend } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { AnalysisCard, DIRECTION_BAR, DIRECTION_GLYPH, DIRECTION_TEXT, Meter, Sparkline, StatRow } from "./shared";

/**
 * One timeframe's indicator set.
 *
 * Direction is stated in words and with an arrow glyph as well as colour, and
 * each indicator carries a ✓ / ✕ / — marker, so the card never depends on
 * red-vs-green alone (§8).
 */
export function TimeframeTrendCard({ trend }: { trend: TimeframeTrend }) {
  const dirText = DIRECTION_TEXT[trend.direction] ?? "text-muted-foreground";
  const dirBar = DIRECTION_BAR[trend.direction] ?? "bg-muted";
  const label = trend.direction.charAt(0) + trend.direction.slice(1).toLowerCase();

  return (
    <AnalysisCard title={trend.label} bodyClassName="flex flex-col p-3 pt-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={cn("flex items-center gap-1.5 text-base font-black leading-none", dirText)}>
            <span aria-hidden="true">{DIRECTION_GLYPH[trend.direction]}</span>
            {label}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">{trend.caption}</p>
        </div>
        <div className="w-20 shrink-0">
          <Sparkline data={trend.sparkline} direction={trend.direction} height={30} />
        </div>
      </div>

      <dl className="mt-2 divide-y divide-border/40">
        {trend.indicators.map((ind) => (
          <StatRow
            key={ind.label}
            label={ind.label}
            value={ind.value}
            tone={ind.tone}
            marker={ind.marker}
            className="py-1"
          />
        ))}
      </dl>

      <div className="mt-auto pt-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Trend Strength</span>
          <span className={cn("font-mono text-xs font-black", dirText)}>{trend.strength}/100</span>
        </div>
        <Meter pct={trend.strength} barClass={dirBar} className="mt-1.5" />
      </div>
    </AnalysisCard>
  );
}
