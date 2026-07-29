/**
 * Provider abstraction for the Holding Stocks module (§24).
 *
 * The scoring engine only ever sees the normalised shapes declared here, so a
 * data source can be swapped or added without touching indicators, scoring,
 * risk or the UI. Each provider reports its own id and, critically, is allowed
 * to say "I don't have this" — every optional field is `null`, never a filled-in
 * placeholder, so "Data unavailable" reaches the screen intact (§17, §25).
 */

import YahooFinance from "yahoo-finance2";
import { getDailyOhlcv, getDailyOhlcvByTicker, getLiveQuote } from "../liveMarketData.js";
import type { Candle } from "./indicators.js";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// ── Normalised shapes ───────────────────────────────────────────────────────

export interface NormalisedQuote {
  symbol: string;
  price: number;
  changePercent: number;
  volume: number;
  marketCap: number | null;
  source: string;
}

export interface FundamentalSnapshot {
  /** Whether the provider returned anything usable at all. */
  available: boolean;
  revenueGrowthYoyPct: number | null;
  profitGrowthYoyPct: number | null;
  eps: number | null;
  epsTrend: "improving" | "declining" | "flat" | null;
  operatingMarginPct: number | null;
  marginTrend: "improving" | "declining" | "flat" | null;
  roePct: number | null;
  debtToEquity: number | null;
  /** ISO date the results were reported, or a quarter label if that is all we get. */
  latestResultsDate: string | null;
  source: string;
  /** Human-readable reason when `available` is false. */
  note: string;
}

export type CatalystImpact = "positive" | "neutral" | "negative";

export interface CatalystItem {
  title: string;
  date: string | null;
  source: string;
  impact: CatalystImpact;
  url: string | null;
  /** What kind of event this is, when we can tell. */
  kind: string;
}

export interface CorporateEvents {
  available: boolean;
  /** Next scheduled earnings date, ISO. Drives event risk. */
  nextEarningsDate: string | null;
  events: CatalystItem[];
  source: string;
  note: string;
}

// ── Provider interfaces ─────────────────────────────────────────────────────

export interface MarketDataProvider {
  id: string;
  dailyCandles(symbol: string, lookbackDays?: number): Promise<Candle[]>;
  benchmarkCandles(lookbackDays?: number): Promise<Candle[]>;
  quote(symbol: string): Promise<NormalisedQuote | null>;
}

export interface FundamentalDataProvider {
  id: string;
  fundamentals(symbol: string): Promise<FundamentalSnapshot>;
}

export interface CorporateDataProvider {
  id: string;
  corporateEvents(symbol: string): Promise<CorporateEvents>;
}

export interface NewsProvider {
  id: string;
  news(symbol: string, name: string): Promise<CatalystItem[]>;
}

export interface ProviderSet {
  market: MarketDataProvider;
  fundamentals: FundamentalDataProvider;
  corporate: CorporateDataProvider;
  news: NewsProvider;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const BENCHMARK_TICKER = "^NSEI";

function toCandles(rows: Awaited<ReturnType<typeof getDailyOhlcv>>): Candle[] {
  const out: Candle[] = [];
  for (const r of rows) {
    if (r.open == null || r.high == null || r.low == null || r.close == null) continue;
    out.push({
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume ?? 0,
    });
  }
  return out;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function pct(v: unknown): number | null {
  const n = num(v);
  // Yahoo returns growth/margin ratios as fractions (0.184 = 18.4%).
  return n == null ? null : n * 100;
}

// ── Yahoo market data ───────────────────────────────────────────────────────

export const yahooMarketProvider: MarketDataProvider = {
  id: "yahoo-finance",

  async dailyCandles(symbol, lookbackDays = 420) {
    return toCandles(await getDailyOhlcv(symbol, lookbackDays));
  },

  async benchmarkCandles(lookbackDays = 420) {
    return toCandles(await getDailyOhlcvByTicker(BENCHMARK_TICKER, lookbackDays));
  },

  async quote(symbol) {
    try {
      const q = await getLiveQuote(symbol);
      if (!q) return null;
      return {
        symbol,
        price: q.price,
        changePercent: q.changePercent,
        volume: q.volume,
        marketCap: num(q.marketCap),
        source: "dataSource" in q ? q.dataSource : "simulated",
      };
    } catch {
      return null;
    }
  },
};

// ── Yahoo fundamentals ──────────────────────────────────────────────────────

/**
 * Fundamentals from Yahoo's quoteSummary.
 *
 * Only fields Yahoo actually returns are populated. Yahoo does not expose an
 * Indian-market quarterly revenue/profit series reliably for every NSE name, so
 * a missing module yields nulls plus a note — the UI then prints "Data
 * unavailable" (§17). Nothing here is derived, estimated or back-filled.
 */
export const yahooFundamentalProvider: FundamentalDataProvider = {
  id: "yahoo-finance-quoteSummary",

  async fundamentals(symbol) {
    const empty = (note: string): FundamentalSnapshot => ({
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
      source: yahooFundamentalProvider.id,
      note,
    });

    const yahooSymbol = symbol === "M_M" ? "M&M.NS" : symbol === "BAJAJ_AUTO" ? "BAJAJ-AUTO.NS" : `${symbol}.NS`;

    let summary: Record<string, Record<string, unknown> | undefined>;
    try {
      summary = (await yf.quoteSummary(
        yahooSymbol,
        { modules: ["financialData", "defaultKeyStatistics", "earnings", "calendarEvents"] },
        { validateResult: false }
      )) as Record<string, Record<string, unknown> | undefined>;
    } catch {
      return empty("Fundamental provider did not return data for this symbol.");
    }

    const fin = summary?.financialData ?? {};
    const stats = summary?.defaultKeyStatistics ?? {};

    const revenueGrowthYoyPct = pct(fin.revenueGrowth);
    const profitGrowthYoyPct = pct(fin.earningsGrowth);
    const eps = num(stats.trailingEps);
    const operatingMarginPct = pct(fin.operatingMargins);
    const roePct = pct(fin.returnOnEquity);
    const debtToEquityRaw = num(fin.debtToEquity);

    // Yahoo reports debt/equity as a percentage (e.g. 42.1 meaning 0.42x).
    const debtToEquity = debtToEquityRaw == null ? null : debtToEquityRaw / 100;

    // Latest reported quarter. `date` on this row is a quarter LABEL ("2Q2026"),
    // not a date — the real timestamp is `reportedDate`, so use that and fall
    // back to the label only as a last resort.
    let latestResultsDate: string | null = null;
    const earnings = summary?.earnings as { earningsChart?: { quarterly?: unknown[] } } | undefined;
    const quarterly = earnings?.earningsChart?.quarterly;
    if (Array.isArray(quarterly) && quarterly.length > 0) {
      const last = quarterly[quarterly.length - 1] as { reportedDate?: unknown; date?: unknown };
      const reported = last?.reportedDate;
      if (reported instanceof Date) latestResultsDate = reported.toISOString();
      else if (typeof reported === "string" && !Number.isNaN(Date.parse(reported))) {
        latestResultsDate = new Date(reported).toISOString();
      } else if (typeof last?.date === "string") {
        latestResultsDate = last.date;
      }
    }

    // Trends need a series; Yahoo's quarterly EPS chart gives us one when present.
    let epsTrend: FundamentalSnapshot["epsTrend"] = null;
    if (Array.isArray(quarterly) && quarterly.length >= 2) {
      const actuals = quarterly
        .map((q) => num((q as { actual?: unknown }).actual))
        .filter((n): n is number => n != null);
      if (actuals.length >= 2) {
        const delta = actuals[actuals.length - 1] - actuals[actuals.length - 2];
        epsTrend = delta > 0.01 ? "improving" : delta < -0.01 ? "declining" : "flat";
      }
    }

    const anyValue =
      revenueGrowthYoyPct != null ||
      profitGrowthYoyPct != null ||
      eps != null ||
      operatingMarginPct != null ||
      roePct != null ||
      debtToEquity != null;

    if (!anyValue) return empty("Fundamental provider returned no usable fields for this symbol.");

    return {
      available: true,
      revenueGrowthYoyPct,
      profitGrowthYoyPct,
      eps,
      epsTrend,
      operatingMarginPct,
      // A single-point margin cannot establish a trend; we do not guess one.
      marginTrend: null,
      roePct,
      debtToEquity,
      latestResultsDate,
      source: yahooFundamentalProvider.id,
      note: "Trailing figures from the fundamental provider. Margin trend needs a multi-quarter statement feed.",
    };
  },
};

// ── Corporate events ────────────────────────────────────────────────────────

/**
 * Scheduled corporate events.
 *
 * Yahoo's calendarEvents gives a real next-earnings date, which is what the
 * risk engine needs. Genuine filings — order wins, capacity expansion,
 * regulatory approvals — require an NSE/BSE corporate-announcements feed, which
 * this project does not integrate yet; we say so instead of inventing them (§18).
 */
export const yahooCorporateProvider: CorporateDataProvider = {
  id: "yahoo-finance-calendarEvents",

  async corporateEvents(symbol) {
    const yahooSymbol = symbol === "M_M" ? "M&M.NS" : symbol === "BAJAJ_AUTO" ? "BAJAJ-AUTO.NS" : `${symbol}.NS`;
    const note =
      "Scheduled events only. NSE/BSE corporate filings (order wins, capacity " +
      "expansion, regulatory approvals) require a corporate-announcements provider.";

    try {
      const summary = (await yf.quoteSummary(
        yahooSymbol,
        { modules: ["calendarEvents"] },
        { validateResult: false }
      )) as { calendarEvents?: { earnings?: { earningsDate?: unknown[] } } };

      const dates = summary?.calendarEvents?.earnings?.earningsDate;
      const first = Array.isArray(dates) ? dates[0] : null;
      const nextEarningsDate =
        first instanceof Date ? first.toISOString() : typeof first === "string" ? first : null;

      return {
        available: nextEarningsDate != null,
        nextEarningsDate,
        events: nextEarningsDate
          ? [
              {
                title: "Scheduled quarterly results",
                date: nextEarningsDate,
                source: "Yahoo Finance calendar",
                impact: "neutral" as CatalystImpact,
                url: null,
                kind: "Earnings",
              },
            ]
          : [],
        source: yahooCorporateProvider.id,
        note,
      };
    } catch {
      return {
        available: false,
        nextEarningsDate: null,
        events: [],
        source: yahooCorporateProvider.id,
        note,
      };
    }
  },
};

// ── News / catalysts ────────────────────────────────────────────────────────

/**
 * Headlines from Yahoo's search feed — the same provider the Stock Insights
 * module already uses, so there is one news source in the product rather than
 * two that can disagree.
 *
 * Classification is keyword-based over the real headline text. It never
 * generates a headline, and a headline it cannot classify stays "neutral"
 * rather than being nudged to fit the technical picture (§18, §26).
 */
const POSITIVE_KEYWORDS = [
  "order win", "order book", "wins order", "bags order", "contract", "awarded",
  "capacity expansion", "expansion", "approval", "approved", "record", "beats",
  "profit rises", "profit jumps", "revenue growth", "upgrade", "raises guidance",
  "acquisition", "partnership", "dividend", "buyback", "all-time high",
];

const NEGATIVE_KEYWORDS = [
  "probe", "investigation", "fraud", "penalty", "fine", "downgrade", "cuts guidance",
  "profit falls", "profit declines", "loss", "misses", "recall", "lawsuit", "resigns",
  "layoff", "default", "stake sale", "block deal", "regulatory action", "ban",
  "ransomware", "cyberattack", "cyber attack", "data breach", "hacked",
  "halts production", "shutdown", "strike", "downtime",
];

const KIND_KEYWORDS: [string, string][] = [
  ["Quarterly Results", "results"],
  ["Quarterly Results", "earnings"],
  ["Quarterly Results", "q1"],
  ["Quarterly Results", "q2"],
  ["Quarterly Results", "q3"],
  ["Quarterly Results", "q4"],
  ["Order Win", "order"],
  ["Contract", "contract"],
  ["Capacity Expansion", "capacity"],
  ["Capacity Expansion", "plant"],
  ["Regulatory Approval", "approval"],
  ["Management Guidance", "guidance"],
  ["Corporate Announcement", "board"],
  ["Corporate Announcement", "dividend"],
];

function classify(title: string): { impact: CatalystImpact; kind: string } {
  const t = title.toLowerCase();
  const positive = POSITIVE_KEYWORDS.some((k) => t.includes(k));
  const negative = NEGATIVE_KEYWORDS.some((k) => t.includes(k));

  const impact: CatalystImpact =
    positive && !negative ? "positive" : negative && !positive ? "negative" : "neutral";

  const kind = KIND_KEYWORDS.find(([, needle]) => t.includes(needle))?.[0] ?? "News";
  return { impact, kind };
}

/** Corporate suffixes carry no signal when matching a company name in prose. */
function coreCompanyName(name: string): string {
  return name
    .replace(/\b(limited|ltd|inc|incorporated|corporation|corp|plc|company|co|the)\b\.?/gi, "")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Yahoo's `providerPublishTime` is not one consistent type across payloads —
 * v3 usually coerces to Date, older rows carry unix seconds, some carry an ISO
 * string. Returns null rather than substituting "now" when it cannot be read.
 */
function publishedAt(v: unknown): string | null {
  let ms: number | null = null;
  if (v instanceof Date) ms = v.getTime();
  else if (typeof v === "number" && Number.isFinite(v)) ms = v > 1e12 ? v : v * 1000;
  else if (typeof v === "string" && !Number.isNaN(Date.parse(v))) ms = Date.parse(v);

  if (ms == null || !Number.isFinite(ms)) return null;
  // Reject implausible timestamps outright rather than rendering year 58500.
  const year = new Date(ms).getUTCFullYear();
  if (year < 1990 || year > new Date().getUTCFullYear() + 1) return null;
  return new Date(ms).toISOString();
}

/** Exchange tag a headline uses to name its subject, e.g. "(NSE:SOUTHWEST)". */
const EXCHANGE_TAG = /\((?:NSE|BSE|BOM|NYSE|NAS|NASDAQ|WBO|LON|HKG|TSE|FRA|SHA):([A-Z0-9.\-&]+)\)/gi;

type Relevance = "direct" | "tagged" | null;

/**
 * How strongly an article belongs to this company.
 *
 * Yahoo's search news is only loosely tied to the query. Two observed failure
 * modes drive this function:
 *
 *  1. A ticker query ("RELIANCE.NS") returns generic wire stories with no
 *     connection to the company at all.
 *  2. `relatedTickers` is generous: a GuruFocus roundup titled "South West
 *     Pinnacle Exploration Ltd (NSE:SOUTHWEST) Q1 Earnings ... Record" carries
 *     RELIANCE.NS in its tags. Scoring that as a positive Reliance catalyst
 *     would be exactly the mis-attribution §18 forbids.
 *
 * So relevance has two tiers:
 *   "direct" — the company's core name is in the headline. This is an article
 *              ABOUT the company, and only these are allowed to move the score.
 *   "tagged" — provider metadata links it, but the headline is about something
 *              else. Shown as neutral context; never scored.
 *
 * An article whose headline names a DIFFERENT company via an exchange tag is
 * dropped outright unless the core name also appears (Reliance's own Vienna
 * listing shows up as "Reliance Industries Ltd (WBO:RLI)", which must survive).
 */
function relevanceOf(
  article: { title?: unknown; relatedTickers?: unknown },
  tickers: Set<string>,
  coreName: string
): Relevance {
  const title = typeof article.title === "string" ? article.title : "";
  if (!title) return null;

  const named = coreName.length >= 4 && title.toLowerCase().includes(coreName.toLowerCase());

  // Headline explicitly attributes itself to another issuer.
  if (!named) {
    EXCHANGE_TAG.lastIndex = 0;
    for (const m of title.matchAll(EXCHANGE_TAG)) {
      const tag = m[1]?.toUpperCase();
      if (!tag) continue;
      const matchesUs = tickers.has(tag) || tickers.has(`${tag}.NS`) || tickers.has(`${tag}.BO`);
      if (!matchesUs) return null;
    }
  }

  if (named) return "direct";

  const related = Array.isArray(article.relatedTickers)
    ? article.relatedTickers.filter((t): t is string => typeof t === "string").map((t) => t.toUpperCase())
    : [];
  // Only exchange-qualified tags count: a bare "RELIANCE" also matches
  // Reliance Global Group, a different issuer entirely.
  return related.some((t) => tickers.has(t) && t.includes(".")) ? "tagged" : null;
}

export const yahooNewsProvider: NewsProvider = {
  id: "yahoo-finance-search",

  async news(symbol, name) {
    const base = symbol.replace(/[_]/g, "&").toUpperCase();
    const yahooSymbol = symbol === "M_M" ? "M&M.NS" : symbol === "BAJAJ_AUTO" ? "BAJAJ-AUTO.NS" : `${symbol}.NS`;
    const tickers = new Set(
      [yahooSymbol, base, `${base}.NS`, `${base}.BO`, symbol.toUpperCase()].map((t) => t.toUpperCase())
    );
    const coreName = coreCompanyName(name);

    // Query by company name only. A ticker query ("RELIANCE.NS") was measured
    // to return generic wire stories that never survive the relevance filter,
    // so it is a wasted round trip on every symbol in the universe.
    const seen = new Set<string>();
    const out: CatalystItem[] = [];

    let items: unknown[] = [];
    try {
      const r = (await yf.search(coreName, { newsCount: 10, quotesCount: 0 }, { validateResult: false })) as {
        news?: unknown;
      };
      items = Array.isArray(r?.news) ? r.news : [];
    } catch {
      return [];
    }

    for (const raw of items) {
      const n = raw as {
        title?: unknown;
        link?: unknown;
        publisher?: unknown;
        providerPublishTime?: unknown;
        relatedTickers?: unknown;
      };
      if (typeof n.title !== "string" || !n.title.trim()) continue;

      const relevance = relevanceOf(n, tickers, coreName);
      if (!relevance) continue;

      const key = n.title.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      // Only headlines about the company itself carry a rated impact; merely
      // tagged articles are shown as neutral context and never move the score.
      const rated = classify(n.title);
      out.push({
        title: n.title,
        date: publishedAt(n.providerPublishTime),
        source: typeof n.publisher === "string" ? n.publisher : "Yahoo Finance",
        impact: relevance === "direct" ? rated.impact : "neutral",
        url: typeof n.link === "string" ? n.link : null,
        kind: relevance === "direct" ? rated.kind : "Sector / related news",
      });
    }

    // Newest first; undated articles sink to the bottom.
    out.sort((a, b) => (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0));
    return out.slice(0, 6);
  },
};

export const defaultProviders: ProviderSet = {
  market: yahooMarketProvider,
  fundamentals: yahooFundamentalProvider,
  corporate: yahooCorporateProvider,
  news: yahooNewsProvider,
};
