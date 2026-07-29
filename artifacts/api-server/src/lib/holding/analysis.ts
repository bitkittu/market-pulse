/**
 * Holding Stocks explainability payload (§13-§21).
 *
 * The explanation layer. It formats evidence the scan engine already computed
 * and never adds a reading of its own — if `buildTechnicalSnapshot` returned
 * null for an indicator, the metric here is "Data unavailable" with
 * UNAVAILABLE provenance rather than a substituted value (§17, §26).
 */

import type { DataProvenance, MetricItem, Provenance, RiskFactor, Tone } from "../analysis/types.js";
import { ENGINE, ENGINE_VERSION, buildReasons, type ScannedStock } from "./engine.js";
import type {
  CatalystBlock,
  CatalystImpactLabel,
  FundamentalsBlock,
  HoldingAnalysis,
  HoldingOutlook,
} from "./types.js";

const UNAVAILABLE = "Data unavailable";

function metric(
  label: string,
  value: string | null,
  opts: { tone?: Tone; badge?: string | null; provenance?: Provenance } = {}
): MetricItem {
  const missing = value == null;
  return {
    label,
    value: missing ? UNAVAILABLE : value,
    badge: missing ? null : (opts.badge ?? null),
    tone: missing ? "neutral" : (opts.tone ?? "neutral"),
    provenance: missing ? "UNAVAILABLE" : (opts.provenance ?? "CALCULATED"),
  };
}

function inr(n: number | null): string | null {
  return n == null ? null : `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(n: number | null, dp = 2): string | null {
  return n == null ? null : `${n >= 0 ? "+" : ""}${n.toFixed(dp)}%`;
}

function plainPct(n: number | null, dp = 1): string | null {
  return n == null ? null : `${n.toFixed(dp)}%`;
}

/**
 * The fundamental provider may hand back a real reported date or, when that is
 * missing, a quarter label such as "2Q2026". Render whichever it is — never
 * push an unparseable label through Date and print "Invalid Date".
 */
function formatResultsDate(v: string | null): string | null {
  if (v == null) return null;
  const ms = Date.parse(v);
  if (Number.isNaN(ms)) return v;
  return new Date(ms).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function retTone(n: number | null): Tone {
  if (n == null) return "neutral";
  return n > 0 ? "positive" : n < 0 ? "negative" : "neutral";
}

// ── §15 Technical Strength ──────────────────────────────────────────────────

function technicalMetrics(s: ScannedStock): MetricItem[] {
  const t = s.tech;

  const maMetric = (label: string, value: number | null, above: boolean | null) =>
    metric(label, inr(value), {
      tone: above == null ? "neutral" : above ? "positive" : "negative",
      badge: above == null ? null : above ? "Above" : "Below",
    });

  return [
    metric("Trend", trendWord(s), {
      tone: t.maAligned ? "positive" : t.aboveDma200 ? "positive" : "negative",
    }),
    maMetric("20 DMA", t.dma20, t.aboveDma20),
    maMetric("50 DMA", t.dma50, t.aboveDma50),
    maMetric("200 DMA", t.dma200, t.aboveDma200),
    metric("RSI (14)", t.rsi14 == null ? null : t.rsi14.toFixed(1), {
      tone: t.rsi14 == null ? "neutral" : t.rsi14 > 70 ? "negative" : t.rsi14 >= 50 ? "positive" : "neutral",
      badge: t.rsi14 == null ? null : t.rsi14 > 70 ? "Overbought" : t.rsi14 < 30 ? "Oversold" : "Neutral",
    }),
    metric(
      "MACD",
      t.macd == null ? null : t.macd.histogram.toFixed(2),
      {
        tone: t.macd == null ? "neutral" : t.macd.histogram > 0 ? "positive" : "negative",
        badge: t.macd == null ? null : t.macd.macd > t.macd.signal ? "Above signal" : "Below signal",
      }
    ),
    metric("Volume Ratio", t.volumeRatio == null ? null : `${t.volumeRatio.toFixed(2)}x`, {
      tone: t.volumeRatio == null ? "neutral" : t.volumeRatio >= 1.2 ? "positive" : t.volumeRatio < 0.7 ? "negative" : "neutral",
      badge: "vs 20d avg",
    }),
    metric("Support", inr(t.support), { badge: "swing low" }),
    metric("Resistance", inr(t.resistance), { badge: "swing high" }),
    metric("52-Week High", inr(t.week52High)),
    metric("Distance from 52W High", plainPct(t.distanceFrom52wHighPct), {
      tone:
        t.distanceFrom52wHighPct == null
          ? "neutral"
          : t.distanceFrom52wHighPct <= 10
            ? "positive"
            : t.distanceFrom52wHighPct >= 25
              ? "negative"
              : "neutral",
    }),
    metric("ATR (14)", t.atrPct == null ? null : `${t.atrPct.toFixed(2)}%`, {
      tone: t.atrPct == null ? "neutral" : t.atrPct > 4 ? "negative" : "neutral",
      badge: "of price",
    }),
  ];
}

function trendWord(s: ScannedStock): string {
  const t = s.tech;
  if (t.maAligned) return "Strong Uptrend";
  if (t.aboveDma50 && t.aboveDma200) return "Uptrend";
  if (t.aboveDma200 && t.aboveDma20 === false) return "Uptrend, pulling back";
  if (t.aboveDma200 === false && t.aboveDma50 === false) return "Downtrend";
  return "Sideways";
}

// ── §16 Momentum ────────────────────────────────────────────────────────────

function momentumMetrics(s: ScannedStock): MetricItem[] {
  const t = s.tech;
  const sector = s.sectorStrengthPct;

  return [
    metric("1 Week", pct(t.return1w), { tone: retTone(t.return1w) }),
    metric("1 Month", pct(t.return1m), { tone: retTone(t.return1m) }),
    metric("3 Months", pct(t.return3m), { tone: retTone(t.return3m) }),
    metric("vs NIFTY (1M)", pct(s.relativeStrength1m), {
      tone: retTone(s.relativeStrength1m),
      badge: "pts vs index",
    }),
    metric("vs NIFTY (3M)", pct(s.relativeStrength3m), {
      tone: retTone(s.relativeStrength3m),
      badge: "pts vs index",
    }),
    metric(
      "Sector Strength",
      sector == null ? null : `${sector >= 0 ? "+" : ""}${sector.toFixed(1)}%`,
      {
        tone: sector == null ? "neutral" : sector > 2 ? "positive" : sector < -2 ? "negative" : "neutral",
        badge: sector == null ? null : sector > 2 ? "Strong" : sector < -2 ? "Weak" : "Neutral",
      }
    ),
  ];
}

// ── §17 Fundamentals ────────────────────────────────────────────────────────

function fundamentalsBlock(s: ScannedStock): FundamentalsBlock {
  const f = s.fundamentals;
  const api: Provenance = "API";

  const items: MetricItem[] = [
    metric("Revenue Growth (YoY)", pct(f.revenueGrowthYoyPct, 1), {
      tone: retTone(f.revenueGrowthYoyPct),
      provenance: api,
    }),
    metric("Profit Growth (YoY)", pct(f.profitGrowthYoyPct, 1), {
      tone: retTone(f.profitGrowthYoyPct),
      provenance: api,
    }),
    metric("EPS (trailing)", f.eps == null ? null : `₹${f.eps.toFixed(2)}`, {
      badge: f.epsTrend,
      tone: f.epsTrend === "improving" ? "positive" : f.epsTrend === "declining" ? "negative" : "neutral",
      provenance: api,
    }),
    metric("Operating Margin", plainPct(f.operatingMarginPct), {
      tone: f.operatingMarginPct == null ? "neutral" : f.operatingMarginPct > 15 ? "positive" : "neutral",
      // Margin direction needs a multi-quarter statement feed we do not have.
      badge: f.marginTrend,
      provenance: api,
    }),
    metric("ROE", plainPct(f.roePct), {
      tone: f.roePct == null ? "neutral" : f.roePct > 15 ? "positive" : "neutral",
      provenance: api,
    }),
    metric("Debt / Equity", f.debtToEquity == null ? null : `${f.debtToEquity.toFixed(2)}x`, {
      tone: f.debtToEquity == null ? "neutral" : f.debtToEquity < 0.5 ? "positive" : f.debtToEquity > 2 ? "negative" : "neutral",
      provenance: api,
    }),
    metric("Latest Results", formatResultsDate(f.latestResultsDate), { provenance: api }),
  ];

  return { available: f.available, note: f.note, items };
}

// ── §18 Catalysts ───────────────────────────────────────────────────────────

function impactLabel(i: "positive" | "neutral" | "negative"): CatalystImpactLabel {
  return i === "positive" ? "Positive" : i === "negative" ? "Negative" : "Neutral";
}

function catalystBlock(s: ScannedStock): CatalystBlock {
  const items = s.catalysts.map((c) => ({
    title: c.title,
    date: c.date,
    source: c.source,
    impact: impactLabel(c.impact),
    kind: c.kind,
    url: c.url,
  }));

  return {
    available: items.length > 0,
    note: items.length
      ? `Headlines from the news provider, classified by keyword against the real headline text. ${s.corporateNote}`
      : `No recent headlines returned for this symbol. ${s.corporateNote}`,
    items,
  };
}

// ── §19 Risk factors ────────────────────────────────────────────────────────

function riskFactors(s: ScannedStock): RiskFactor[] {
  const factors = [...s.result.risk.factors];
  if (!factors.length) {
    factors.push({
      text: "No elevated risk condition was detected — this is not the same as low risk. Position sizing still applies.",
      severity: "low",
    });
  }
  return factors;
}

// ── §20 Outlook ─────────────────────────────────────────────────────────────

function buildOutlook(s: ScannedStock): HoldingOutlook {
  const t = s.tech;

  const trend: HoldingOutlook["trend"] = t.maAligned
    ? "Strong"
    : t.aboveDma50 && t.aboveDma200
      ? "Positive"
      : t.aboveDma200
        ? "Neutral"
        : "Weak";

  const mom = s.relativeStrength1m;
  const momentum: HoldingOutlook["momentum"] =
    mom == null ? "Moderate" : mom > 4 ? "Strong" : mom > -1 ? "Moderate" : "Weak";

  const positive = s.catalysts.filter((c) => c.impact === "positive").length;
  const negative = s.catalysts.filter((c) => c.impact === "negative").length;
  const catalyst: CatalystImpactLabel =
    positive > negative ? "Positive" : negative > positive ? "Negative" : "Neutral";

  return {
    trend,
    momentum,
    catalyst,
    risk: s.result.risk.level,
    overall: s.result.classification.label,
    note:
      "A 1-3 month view of the setup's quality, not a price forecast. MarketPulse " +
      "does not publish a target price for holding positions.",
  };
}

// ── §21 Price levels ────────────────────────────────────────────────────────

function priceLevels(s: ScannedStock): MetricItem[] {
  const t = s.tech;
  return [
    metric("Current Price", inr(s.quotePrice), { provenance: s.priceProvenance }),
    metric("Important Support", inr(t.support), { tone: "positive", badge: "swing low" }),
    metric("Secondary Support", inr(t.secondarySupport), { badge: "prior low" }),
    metric("Resistance", inr(t.resistance), { tone: "negative", badge: "swing high" }),
    metric("52-Week High", inr(t.week52High)),
    metric("Potential Breakout Level", inr(t.breakoutLevel), {
      badge: t.brokeResistance ? "Cleared" : "Not yet cleared",
      tone: t.brokeResistance ? "positive" : "neutral",
    }),
  ];
}

// ── Assembly ────────────────────────────────────────────────────────────────

export function buildHoldingAnalysis(s: ScannedStock, scannedAt: string): HoldingAnalysis {
  const fundamentals = fundamentalsBlock(s);
  const catalysts = catalystBlock(s);

  const provenance: DataProvenance = {
    signalGeneratedAt: scannedAt,
    dataUpdatedAt: new Date().toISOString(),
    timeframes: ["1W", "1M", "3M", "52W"],
    dataSource: `Yahoo Finance (OHLCV, fundamentals, news)${s.priceProvenance === "MOCK" ? " + simulated fallback" : ""}`,
    engine: ENGINE,
    engineVersion: ENGINE_VERSION,
    mode: s.priceProvenance === "MOCK" ? "MOCK" : fundamentals.available ? "LIVE" : "PARTIAL",
    fields: [
      { name: "Price", provenance: s.priceProvenance },
      { name: `Daily OHLCV (${s.tech.bars} sessions)`, provenance: "LIVE" },
      { name: "Moving averages / RSI / MACD / ATR", provenance: "CALCULATED" },
      { name: "52-week high & distance", provenance: "CALCULATED" },
      { name: "Momentum & relative strength", provenance: "CALCULATED" },
      { name: "Support / resistance (swing pivots)", provenance: "CALCULATED" },
      { name: "Sector strength (median peer 1M return)", provenance: "CALCULATED" },
      { name: "Fundamentals", provenance: fundamentals.available ? "API" : "UNAVAILABLE" },
      { name: "News catalysts", provenance: catalysts.available ? "API" : "UNAVAILABLE" },
      { name: "Corporate filings (NSE/BSE)", provenance: "UNAVAILABLE" },
      { name: "Delivery % / F&O participation", provenance: "UNAVAILABLE" },
      { name: "Holding score", provenance: "CALCULATED" },
    ],
  };

  return {
    id: s.member.symbol,
    symbol: s.member.symbol,
    displaySymbol: s.member.displaySymbol,
    name: s.member.name,
    sector: s.member.sector,
    classification: s.result.classification.id,
    classificationLabel: s.result.classification.label,
    header: {
      currentPrice: parseFloat(s.quotePrice.toFixed(2)),
      return1m: s.tech.return1m,
      return3m: s.tech.return3m,
      distanceFrom52wHighPct: s.tech.distanceFrom52wHighPct,
      riskLevel: s.result.risk.level,
      lastScanAt: scannedAt,
    },
    score: s.result.score,
    reasons: buildReasons(s),
    technical: technicalMetrics(s),
    momentum: momentumMetrics(s),
    fundamentals,
    catalysts,
    risks: riskFactors(s),
    outlook: buildOutlook(s),
    priceLevels: priceLevels(s),
    provenance,
  };
}
