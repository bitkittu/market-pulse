/**
 * Holding Stocks scan engine.
 *
 * Pipeline (§24):
 *   universe -> market data -> indicators -> fundamentals -> catalysts
 *     -> holding score -> risk -> ranking -> evidence -> payload
 *
 * The AI layer never picks stocks. Ranking is entirely a function of computed
 * indicator readings and provider fields; the explanation layer downstream only
 * narrates evidence this module already produced (§26).
 *
 * Refresh model (§27): a full scan is expensive and this is a 1-3 month module,
 * so a completed scan is cached until the next post-close boundary rather than
 * recomputed per request.
 */

import type { DataProvenance, MetricItem, Provenance, Reason } from "../analysis/types.js";
import {
  BARS,
  buildTechnicalSnapshot,
  relativeStrength,
  returnOver,
  sma,
  type Candle,
  type TechnicalSnapshot,
} from "./indicators.js";
import {
  defaultProviders,
  type CatalystItem,
  type FundamentalSnapshot,
  type ProviderSet,
} from "./providers.js";
import {
  QUALIFICATION_THRESHOLD,
  assessRisk,
  computeHoldingScore,
  type HoldingScoreResult,
  type RiskAssessment,
} from "./score.js";
import {
  passesLiquidityFloor,
  resolveUniverse,
  universeOptions,
  UNIVERSE_NOTE,
  type UniverseId,
  type UniverseMember,
} from "./universe.js";
import type {
  CatalystImpactLabel,
  HoldingPick,
  HoldingScan,
  HoldingScanSummary,
  MarketBias,
} from "./types.js";
import { readLastScanSymbols } from "./store.js";

export const ENGINE = "MarketPulse Holding Engine";
export const ENGINE_VERSION = "1.1.0";

/**
 * How many technically-strongest names get the expensive fundamentals /
 * catalysts pass. Sized well above the ten we publish so a stock that is merely
 * good on price action still gets a chance to be lifted by its fundamentals.
 */
const SHORTLIST_SIZE = 60;

/** How many of the qualifying names are actually published as Top Picks. */
const PUBLISHED_LIMIT = 10;

/** Stand-in for the prescore pass, which deliberately has no fundamental data. */
const EMPTY_FUNDAMENTALS: FundamentalSnapshot = {
  available: false,
  revenueGrowthYoyPct: null,
  profitGrowthYoyPct: null,
  eps: null,
  epsTrend: null,
  operatingMarginPct: null,
  marginTrend: null,
  roePct: null,
  debtToEquity: null,
  latestResultsDate: null,
  source: "none",
  note: "Not fetched during the technical prescreen.",
};

/** Everything the scan computed for one symbol, kept for the analysis endpoint. */
export interface ScannedStock {
  member: UniverseMember;
  tech: TechnicalSnapshot;
  candles: Candle[];
  quotePrice: number;
  quoteChangePct: number;
  priceProvenance: Provenance;
  fundamentals: FundamentalSnapshot;
  catalysts: CatalystItem[];
  nextEarningsDate: string | null;
  corporateNote: string;
  relativeStrength1m: number | null;
  relativeStrength3m: number | null;
  sectorStrengthPct: number | null;
  benchmarkReturn1m: number | null;
  result: HoldingScoreResult;
}

export interface ScanResult {
  scan: HoldingScan;
  /** Every analysed symbol, qualified or not, keyed by symbol. */
  stocks: Map<string, ScannedStock>;
  scannedAt: string;
}

// ── Concurrency helper ──────────────────────────────────────────────────────

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// ── Scan scheduling ─────────────────────────────────────────────────────────

/**
 * Scans are stamped to the most recent post-close boundary (16:00 IST) so every
 * request inside the same session sees the same ranking, and the "Last Scan"
 * label means something (§27).
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const CLOSE_HOUR_IST = 16;

function lastScanBoundary(now = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const boundary = new Date(ist);
  boundary.setUTCHours(CLOSE_HOUR_IST, 0, 0, 0);
  if (ist < boundary) boundary.setUTCDate(boundary.getUTCDate() - 1);
  return new Date(boundary.getTime() - IST_OFFSET_MS);
}

function nextScanBoundary(now = new Date()): Date {
  const boundary = lastScanBoundary(now);
  const next = new Date(boundary.getTime() + 24 * 60 * 60 * 1000);
  return next;
}

// ── Labels ──────────────────────────────────────────────────────────────────

function trendLabel(tech: TechnicalSnapshot): string {
  if (tech.maAligned) return "Strong Uptrend";
  if (tech.aboveDma50 && tech.aboveDma200) return "Uptrend";
  if (tech.aboveDma200 && tech.aboveDma20 === false) return "Uptrend, pulling back";
  if (tech.aboveDma200 === false && tech.aboveDma50 === false) return "Downtrend";
  return "Sideways";
}

function impactLabel(i: CatalystItem["impact"]): CatalystImpactLabel {
  return i === "positive" ? "Positive" : i === "negative" ? "Negative" : "Neutral";
}

function headlineCatalyst(catalysts: CatalystItem[]): { label: string; impact: CatalystImpactLabel } {
  const positive = catalysts.find((c) => c.impact === "positive");
  const negative = catalysts.find((c) => c.impact === "negative");
  const chosen = positive ?? negative;
  if (!chosen) return { label: "No rated catalyst", impact: "Neutral" };
  return { label: chosen.kind, impact: impactLabel(chosen.impact) };
}

// ── Evidence ────────────────────────────────────────────────────────────────

/**
 * The "Why MarketPulse selected it" list.
 *
 * Each entry is emitted only when its underlying reading exists and clears the
 * stated bar, and carries the score category it came from. Nothing here is
 * phrased by a language model and nothing is emitted without a number behind
 * it (§14, §26).
 */
export function buildReasons(s: ScannedStock): Reason[] {
  const { tech, fundamentals: f } = s;
  const reasons: Reason[] = [];

  if (tech.maAligned) {
    reasons.push({ text: "Price is above the 20, 50 and 200 DMA in a rising stack", source: "trendMomentum" });
  } else if (tech.aboveDma200 && tech.aboveDma50) {
    reasons.push({ text: "Price holds above both the 50 and 200 DMA", source: "trendMomentum" });
  }

  if (tech.distanceFrom52wHighPct != null && tech.distanceFrom52wHighPct <= 10) {
    reasons.push({
      text: tech.isNew52wHigh
        ? "Trading at a new 52-week high"
        : `Trading ${tech.distanceFrom52wHighPct.toFixed(1)}% below its 52-week high`,
      source: "breakoutStrength",
    });
  }

  if (s.relativeStrength1m != null && s.relativeStrength1m > 2) {
    reasons.push({
      text: `1-month return is outperforming NIFTY by ${s.relativeStrength1m.toFixed(1)} percentage points`,
      source: "trendMomentum",
    });
  }

  if (tech.return3m != null && tech.return3m > 8) {
    reasons.push({ text: `Up ${tech.return3m.toFixed(1)}% over the last three months`, source: "trendMomentum" });
  }

  if (tech.volumeRatio != null && tech.volumeRatio >= 1.3) {
    reasons.push({
      text: `Volume running at ${tech.volumeRatio.toFixed(1)}x the 20-day average`,
      source: "participation",
    });
  }

  if (tech.brokeResistance) {
    reasons.push({
      text:
        tech.breakoutVolumeRatio != null && tech.breakoutVolumeRatio >= 1.5
          ? `Cleared prior resistance on ${tech.breakoutVolumeRatio.toFixed(1)}x volume`
          : "Cleared prior three-month resistance",
      source: "breakoutStrength",
    });
  }

  if (tech.macd && tech.macd.macd > tech.macd.signal && tech.macd.histogram > 0) {
    reasons.push({ text: "MACD is above its signal line with a positive histogram", source: "trendMomentum" });
  }

  if (f.profitGrowthYoyPct != null && f.profitGrowthYoyPct > 5) {
    reasons.push({
      text: `Latest reported profit growth of ${f.profitGrowthYoyPct.toFixed(1)}% year on year`,
      source: "fundamentalsCatalysts",
    });
  }

  if (f.revenueGrowthYoyPct != null && f.revenueGrowthYoyPct > 5) {
    reasons.push({
      text: `Revenue growing ${f.revenueGrowthYoyPct.toFixed(1)}% year on year`,
      source: "fundamentalsCatalysts",
    });
  }

  if (f.roePct != null && f.roePct > 15) {
    reasons.push({ text: `Return on equity of ${f.roePct.toFixed(1)}%`, source: "fundamentalsCatalysts" });
  }

  const positiveNews = s.catalysts.filter((c) => c.impact === "positive");
  if (positiveNews.length) {
    reasons.push({
      text: `Recent ${positiveNews[0].kind.toLowerCase()} headline: "${positiveNews[0].title}"`,
      source: "fundamentalsCatalysts",
    });
  }

  if (s.sectorStrengthPct != null && s.sectorStrengthPct > 2) {
    reasons.push({
      text: `Sector peers are up a median ${s.sectorStrengthPct.toFixed(1)}% over the last month`,
      source: "trendMomentum",
    });
  }

  // 4-6 strongest reasons (§14) — the list above is already ordered by weight.
  return reasons.slice(0, 6);
}

// ── Market bias ─────────────────────────────────────────────────────────────

function computeMarketBias(benchmark: Candle[]): { bias: MarketBias; note: string } {
  const closes = benchmark.map((c) => c.close);
  if (closes.length < 60) {
    return { bias: "Neutral", note: "Benchmark history too short to establish a bias." };
  }

  const price = closes[closes.length - 1];
  const dma50 = sma(closes, 50);
  const dma200 = sma(closes, 200);
  const ret1m = returnOver(closes, BARS.month);

  let points = 0;
  const parts: string[] = [];

  if (dma50 != null) {
    points += price > dma50 ? 1 : -1;
    parts.push(`NIFTY ${price > dma50 ? "above" : "below"} its 50 DMA`);
  }
  if (dma200 != null) {
    points += price > dma200 ? 1 : -1;
    parts.push(`${price > dma200 ? "above" : "below"} its 200 DMA`);
  }
  if (ret1m != null) {
    points += ret1m > 1 ? 1 : ret1m < -1 ? -1 : 0;
    parts.push(`${ret1m >= 0 ? "+" : ""}${ret1m.toFixed(1)}% over one month`);
  }

  const bias: MarketBias = points >= 2 ? "Bullish" : points <= -2 ? "Bearish" : "Neutral";
  return { bias, note: parts.join(", ") + "." };
}

// ── Scan ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  result: ScanResult;
  boundary: number;
}

const scanCache = new Map<UniverseId, CacheEntry>();
const inFlight = new Map<UniverseId, Promise<ScanResult>>();

export async function runScan(
  requested: UniverseId,
  providers: ProviderSet = defaultProviders
): Promise<ScanResult> {
  const boundary = lastScanBoundary().getTime();

  const cached = scanCache.get(requested);
  if (cached && cached.boundary === boundary) return cached.result;

  // Collapse concurrent first-requests onto one scan — 50 symbols x 4 providers
  // is not something to run twice because two users loaded the page together.
  const pending = inFlight.get(requested);
  if (pending) return pending;

  const promise = executeScan(requested, providers, boundary)
    .then((result) => {
      scanCache.set(requested, { result, boundary });
      return result;
    })
    .finally(() => {
      inFlight.delete(requested);
    });

  inFlight.set(requested, promise);
  return promise;
}

async function executeScan(
  requested: UniverseId,
  providers: ProviderSet,
  boundary: number
): Promise<ScanResult> {
  const scannedAt = new Date(boundary).toISOString();
  const universe = await resolveUniverse(requested);

  // Benchmark first — relative strength and market bias both depend on it.
  let benchmark: Candle[] = [];
  try {
    benchmark = await providers.market.benchmarkCandles();
  } catch {
    benchmark = [];
  }
  const benchmarkCloses = benchmark.map((c) => c.close);
  const benchReturn1m = returnOver(benchmarkCloses, BARS.month);
  const benchReturn3m = returnOver(benchmarkCloses, BARS.quarter);
  const { bias, note: biasNote } = computeMarketBias(benchmark);

  // ── Pass 1: candles + technicals + liquidity floor ───────────────────────
  interface Stage1 {
    member: UniverseMember;
    candles: Candle[];
    tech: TechnicalSnapshot | null;
    liquid: boolean;
  }

  const stage1 = await mapLimit<UniverseMember, Stage1>(universe.members, 8, async (member) => {
    try {
      const candles = await providers.market.dailyCandles(member.symbol);
      const tech = buildTechnicalSnapshot(candles);
      const liquid = tech != null && passesLiquidityFloor(tech.price, tech.avgVolume20 ?? 0);
      return { member, candles, tech, liquid };
    } catch {
      return { member, candles: [], tech: null, liquid: false };
    }
  });

  const analysable = stage1.filter((s): s is Stage1 & { tech: TechnicalSnapshot } => s.tech != null);
  const rejectedIlliquid = analysable.filter((s) => !s.liquid).length;
  const viable = analysable.filter((s) => s.liquid);

  // Sector strength, computed from this scan's own real returns rather than a
  // daily sector-index tick — the window has to match the holding horizon.
  const sectorReturns = new Map<string, number[]>();
  for (const s of viable) {
    if (s.tech.return1m == null) continue;
    const list = sectorReturns.get(s.member.sector) ?? [];
    list.push(s.tech.return1m);
    sectorReturns.set(s.member.sector, list);
  }
  const sectorMedian = new Map<string, number>();
  for (const [sector, rets] of sectorReturns) {
    const sorted = [...rets].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    sectorMedian.set(
      sector,
      sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    );
  }

  // ── Shortlist ────────────────────────────────────────────────────────────
  /**
   * NIFTY 500 makes the second pass the expensive one: four provider calls per
   * symbol is two thousand requests, which is both slow and a good way to get
   * rate-limited. So the deep dive runs on a shortlist.
   *
   * The shortlist is chosen by scoring each stock on its technicals alone —
   * literally the same `computeHoldingScore`, given an empty fundamental
   * snapshot and no catalysts, so the omitted category renormalises instead of
   * scoring zero. That covers 80 of the 100 available points (trend, breakout,
   * participation, risk), which makes it a sound funnel: a stock outside the
   * top `SHORTLIST_SIZE` on four fifths of the weighting cannot climb into a
   * top-ten that only admits scores of 65+.
   */
  const prescored = viable
    .map((s) => ({
      s,
      prescore: computeHoldingScore({
        tech: s.tech,
        relativeStrength1m: relativeStrength(s.tech.return1m, benchReturn1m),
        relativeStrength3m: relativeStrength(s.tech.return3m, benchReturn3m),
        sectorChangePct: sectorMedian.get(s.member.sector) ?? null,
        fundamentals: EMPTY_FUNDAMENTALS,
        catalysts: [],
        nextEarningsDate: null,
        benchmarkReturn1m: benchReturn1m,
      }).score.score,
    }))
    .sort((a, b) => b.prescore - a.prescore);

  const shortlist =
    prescored.length <= SHORTLIST_SIZE
      ? prescored.map((p) => p.s)
      : prescored.slice(0, SHORTLIST_SIZE).map((p) => p.s);

  // ── Pass 2: fundamentals, corporate events, news, scoring ────────────────
  const scanned = await mapLimit<typeof viable[number], ScannedStock>(shortlist, 5, async (s) => {
    const [fundamentals, corporate, news, quote] = await Promise.all([
      providers.fundamentals.fundamentals(s.member.symbol),
      providers.corporate.corporateEvents(s.member.symbol),
      providers.news.news(s.member.symbol, s.member.name),
      providers.market.quote(s.member.symbol),
    ]);

    const catalysts = [...news, ...corporate.events].slice(0, 8);
    const sectorStrengthPct = sectorMedian.get(s.member.sector) ?? null;

    const scoreInputs = {
      tech: s.tech,
      relativeStrength1m: relativeStrength(s.tech.return1m, benchReturn1m),
      relativeStrength3m: relativeStrength(s.tech.return3m, benchReturn3m),
      sectorChangePct: sectorStrengthPct,
      fundamentals,
      catalysts,
      nextEarningsDate: corporate.nextEarningsDate,
      benchmarkReturn1m: benchReturn1m,
    };

    const result = computeHoldingScore(scoreInputs);

    return {
      member: s.member,
      tech: s.tech,
      candles: s.candles,
      quotePrice: quote?.price ?? s.tech.price,
      quoteChangePct: quote?.changePercent ?? 0,
      priceProvenance:
        quote == null
          ? "CALCULATED"
          : quote.source === "simulated"
            ? "MOCK"
            : "LIVE",
      fundamentals,
      catalysts,
      nextEarningsDate: corporate.nextEarningsDate,
      corporateNote: corporate.note,
      relativeStrength1m: scoreInputs.relativeStrength1m,
      relativeStrength3m: scoreInputs.relativeStrength3m,
      sectorStrengthPct,
      benchmarkReturn1m: benchReturn1m,
      result,
    } satisfies ScannedStock;
  });

  const stocks = new Map(scanned.map((s) => [s.member.symbol, s]));

  // ── Ranking ──────────────────────────────────────────────────────────────
  // Only stocks clearing the quality bar are ranked. A short list is correct
  // output; padding it with weak names is not (§8).
  //
  // `allQualified` is what "Qualified Opportunities" reports — the honest count
  // of names that cleared the bar. On NIFTY 500 that is routinely more than ten,
  // so the published list is the strongest slice of it, not the whole of it.
  const allQualified = scanned
    .filter((s) => s.result.qualified)
    .sort((a, b) => b.result.score.score - a.result.score.score);
  const qualified = allQualified.slice(0, PUBLISHED_LIMIT);

  const previousSymbols = await readLastScanSymbols(universe.resolved, scannedAt);

  const picks: HoldingPick[] = qualified.map((s, idx) => {
    const catalyst = headlineCatalyst(s.catalysts);
    return {
      rank: idx + 1,
      symbol: s.member.symbol,
      displaySymbol: s.member.displaySymbol,
      name: s.member.name,
      sector: s.member.sector,
      currentPrice: parseFloat(s.quotePrice.toFixed(2)),
      changePercent: parseFloat(s.quoteChangePct.toFixed(2)),
      return1w: s.tech.return1w,
      return1m: s.tech.return1m,
      return3m: s.tech.return3m,
      distanceFrom52wHighPct: s.tech.distanceFrom52wHighPct,
      trendLabel: trendLabel(s.tech),
      catalystLabel: catalyst.label,
      catalystImpact: catalyst.impact,
      score: s.result.score.score,
      classification: s.result.classification.id,
      classificationLabel: s.result.classification.label,
      riskLevel: s.result.risk.level,
      isNew: previousSymbols != null && !previousSymbols.has(s.member.symbol),
      priceProvenance: s.priceProvenance,
    };
  });

  const anyMock = scanned.some((s) => s.priceProvenance === "MOCK");
  const anyFundamentals = scanned.some((s) => s.fundamentals.available);

  const summary: HoldingScanSummary = {
    qualifiedCount: allQualified.length,
    published: picks.length,
    strongSetups: allQualified.filter((s) => s.result.classification.id === "STRONG_SETUP").length,
    newThisScan: previousSymbols == null ? 0 : picks.filter((p) => p.isNew).length,
    marketBias: bias,
    marketBiasNote: biasNote,
    lastScanAt: scannedAt,
    nextScanAt: nextScanBoundary().toISOString(),
    universeRequested: universe.requested,
    universeResolved: universe.resolved,
    universeNote: universe.fallbackNote,
    screened: universe.members.length,
    analysed: analysable.length,
    rejectedIlliquid,
    shortlisted: shortlist.length,
    belowThreshold: scanned.length - scanned.filter((s) => s.result.qualified).length,
    qualificationThreshold: QUALIFICATION_THRESHOLD,
  };

  const provenance: DataProvenance = {
    signalGeneratedAt: scannedAt,
    dataUpdatedAt: new Date().toISOString(),
    timeframes: ["1W", "1M", "3M", "52W"],
    dataSource: `${providers.market.id} + ${providers.fundamentals.id} + ${providers.news.id}`,
    engine: ENGINE,
    engineVersion: ENGINE_VERSION,
    mode: anyMock ? "PARTIAL" : anyFundamentals ? "LIVE" : "PARTIAL",
    fields: [
      { name: "Price / OHLCV", provenance: anyMock ? "MOCK" : "LIVE" },
      { name: "Moving averages, RSI, MACD, ATR", provenance: "CALCULATED" },
      { name: "52-week high / low", provenance: "CALCULATED" },
      { name: "Momentum & relative strength", provenance: "CALCULATED" },
      { name: "Sector strength", provenance: "CALCULATED" },
      { name: "Fundamentals", provenance: anyFundamentals ? "API" : "UNAVAILABLE" },
      { name: "News catalysts", provenance: "API" },
      { name: "Corporate filings", provenance: "UNAVAILABLE" },
      { name: "Delivery % / F&O participation", provenance: "UNAVAILABLE" },
      {
        name: `Index constituents (${universe.source})`,
        provenance: universe.fallbackNote ? "STATIC" : "LIVE",
      },
    ],
  };

  const sectors = [...new Set(picks.map((p) => p.sector))].sort();

  return {
    scan: {
      summary,
      picks,
      universes: universeOptions(),
      sectors,
      provenance,
    },
    stocks,
    scannedAt,
  };
}

export { UNIVERSE_NOTE };
