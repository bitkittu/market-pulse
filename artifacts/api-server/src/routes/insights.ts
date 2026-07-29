import { Router, type IRouter } from "express";
import YahooFinance from "yahoo-finance2";
import { NSE_STOCKS } from "../lib/nseData.js";

const yahooFinance = new YahooFinance();

const router: IRouter = Router();

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round(100 - 100 / (1 + rs));
}

function calcVWAP(candles: { close: number; volume: number }[]): number {
  let pv = 0, vol = 0;
  for (const c of candles) {
    pv += c.close * (c.volume ?? 1);
    vol += c.volume ?? 1;
  }
  return vol > 0 ? pv / vol : 0;
}

const POSITIVE_WEIGHTS: Record<string, number> = {
  surge: 9, soar: 9, skyrocket: 10, boom: 8, rally: 8,
  outperform: 8, upgrade: 8, bullish: 8, record: 7, beat: 7,
  profit: 7, rebound: 7, recover: 6, boost: 6, gain: 6,
  growth: 6, rise: 5, climb: 5, expand: 5, dividend: 5,
  revenue: 4, earn: 4, strong: 5, high: 4, opportunity: 6,
  buy: 5, positive: 5, exceed: 6, increase: 5,
};

const NEGATIVE_WEIGHTS: Record<string, number> = {
  crash: 10, plunge: 9, collapse: 9, fraud: 9, tumble: 8,
  slump: 8, bearish: 8, downgrade: 8, warn: 7, loss: 7,
  miss: 7, layoff: 7, lawsuit: 7, decline: 6, penalty: 6,
  investigation: 6, recall: 6, fall: 5, drop: 5, sell: 5,
  risk: 5, weak: 5, debt: 5, cut: 5, below: 4, concern: 4,
  down: 3, delay: 4, negative: 5,
};

interface SentimentResult {
  score: number;
  label: "Positive" | "Negative" | "Neutral";
}

function deriveSentimentWithScore(articles: Array<{ title?: string; description?: string }>): SentimentResult {
  let totalPos = 0;
  let totalNeg = 0;

  const sample = articles.slice(0, 15);
  for (const a of sample) {
    const text = ((a.title ?? "") + " " + (a.description ?? "")).toLowerCase();
    for (const [word, weight] of Object.entries(POSITIVE_WEIGHTS)) {
      if (text.includes(word)) totalPos += weight;
    }
    for (const [word, weight] of Object.entries(NEGATIVE_WEIGHTS)) {
      if (text.includes(word)) totalNeg += weight;
    }
  }

  const total = totalPos + totalNeg;
  let score: number;
  if (total === 0) {
    score = 50;
  } else {
    const raw = (totalPos / total) * 100;
    score = Math.round(Math.max(0, Math.min(100, raw)));
  }

  const label: "Positive" | "Negative" | "Neutral" =
    score >= 60 ? "Positive" : score <= 40 ? "Negative" : "Neutral";

  return { score, label };
}

function deriveForecast(rsi: number, price: number, vwap: number): "Bullish" | "Bearish" | "Neutral" {
  const aboveVWAP = vwap > 0 ? price > vwap : null;
  if (rsi >= 60 && aboveVWAP !== false) return "Bullish";
  if (rsi <= 40 && aboveVWAP !== true) return "Bearish";
  return "Neutral";
}

// ── Yahoo search plumbing ──────────────────────────────────────────────────
/** One equity row out of Yahoo's search() `quotes` array. */
interface YahooSearchQuote {
  symbol?: string;
  shortname?: string;
  longname?: string;
  exchDisp?: string;
  quoteType?: string;
}

interface YahooSearchNews {
  title?: string;
  link?: string;
  publisher?: string;
  providerPublishTime?: unknown;
  relatedTickers?: string[];
  thumbnail?: { resolutions?: Array<{ url?: string }> };
}

async function yahooSearch(
  q: string,
  opts: { newsCount?: number; quotesCount?: number }
): Promise<{ quotes: YahooSearchQuote[]; news: YahooSearchNews[] }> {
  try {
    const r = (await yahooFinance.search(q, opts, { validateResult: false })) as {
      quotes?: unknown;
      news?: unknown;
    };
    return {
      quotes: Array.isArray(r?.quotes) ? (r.quotes as YahooSearchQuote[]) : [],
      news: Array.isArray(r?.news) ? (r.news as YahooSearchNews[]) : [],
    };
  } catch {
    return { quotes: [], news: [] };
  }
}

/** Rank Indian listings first — this is an India-first product. */
function exchangeRank(exch?: string): number {
  if (exch === "NSE") return 0;
  if (exch === "Bombay") return 1;
  return 2;
}

/** Corporate suffixes carry no signal when matching a company name in prose. */
function coreCompanyName(name: string): string {
  return name
    .replace(/\b(limited|ltd|inc|incorporated|corporation|corp|plc|company|co|the)\b\.?/gi, "")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Resolve input to a valid Yahoo Finance symbol ─────────────────────────
// Layered, cheapest-first (see §10): exact-ish quote() candidates on the local
// symbol conventions, then Yahoo's own search index for company-name queries.
// Handles: "SBIN" → "SBIN.NS", "NSE:SBIN" → "SBIN.NS", "SBIN.NS" → "SBIN.NS",
//          "AAPL" → "AAPL" (US stocks pass through), "HDFC Bank" → "HDFCBANK.NS"
async function resolveSymbol(
  raw: string
): Promise<{ symbol: string; quote: Awaited<ReturnType<typeof yahooFinance.quote>> } | null> {
  // 1. Normalise input
  const cleaned = raw.trim().replace(/^(NSE|BSE|MCX)\s*[:|\s]\s*/i, "");
  const input = cleaned.toUpperCase();

  // 2. A ticker-shaped query (no spaces) can be tried directly against quote().
  if (!/\s/.test(input)) {
    const candidates: string[] = [];
    if (input.endsWith(".NS") || input.endsWith(".BO")) {
      candidates.push(input);
      if (input.endsWith(".NS")) candidates.push(input.replace(/\.NS$/, ".BO"));
      else candidates.push(input.replace(/\.BO$/, ".NS"));
    } else {
      candidates.push(`${input}.NS`, `${input}.BO`, input);
    }

    for (const sym of candidates) {
      try {
        const q = await yahooFinance.quote(sym, {}, { validateResult: false });
        if (q?.regularMarketPrice) return { symbol: sym, quote: q };
      } catch {
        // try next candidate
      }
    }
  }

  // 3. Fall back to Yahoo's search index so company names resolve
  //    ("Tata Consultancy Services" → TCS.NS). NSE/BSE listings win ties.
  const { quotes } = await yahooSearch(cleaned, { newsCount: 0, quotesCount: 10 });
  const equities = quotes
    .filter((x) => x.symbol && x.quoteType === "EQUITY")
    .sort((a, b) => exchangeRank(a.exchDisp) - exchangeRank(b.exchDisp));

  for (const cand of equities.slice(0, 5)) {
    try {
      const q = await yahooFinance.quote(cand.symbol!, {}, { validateResult: false });
      if (q?.regularMarketPrice) return { symbol: cand.symbol!, quote: q };
    } catch {
      // try next candidate
    }
  }

  return null;
}

// ── News timestamp normalisation ──────────────────────────────────────────
/**
 * Yahoo's `providerPublishTime` is not one consistent type.
 *
 * yahoo-finance2 v3 coerces it to a **Date** even when `validateResult:false`,
 * but older payloads delivered unix **seconds**, and some rows carry an ISO
 * string. The previous implementation assumed seconds unconditionally and did
 * `new Date(Number(v) * 1000)` — when v is already a Date, Number(v) is
 * milliseconds, so multiplying by 1000 landed the article in the year ~58500
 * and every "time ago" calculation went hugely negative.
 *
 * Returns null when the value is missing or implausible; callers must render
 * that as "Published time unavailable" rather than substituting `now`.
 */
export function normalisePublishTime(v: unknown, now = Date.now()): string | null {
  let ms: number | null = null;

  if (v instanceof Date) ms = v.getTime();
  else if (typeof v === "number" && Number.isFinite(v)) {
    // Values below ~1e11 cannot be milliseconds (that is 1973 in ms) so they
    // are seconds. Above it, they are already milliseconds.
    ms = v < 1e11 ? v * 1000 : v;
  } else if (typeof v === "string" && v.trim()) {
    const parsed = Date.parse(v);
    if (!Number.isNaN(parsed)) ms = parsed;
  }

  if (ms == null || !Number.isFinite(ms)) return null;

  // Guard against any remaining unit confusion: reject anything more than a
  // day in the future or older than 20 years rather than rendering nonsense.
  const DAY = 86_400_000;
  if (ms > now + DAY) return null;
  if (ms < now - 20 * 365 * DAY) return null;

  return new Date(ms).toISOString();
}

// ── News relevance ─────────────────────────────────────────────────────────
/**
 * Decide whether an article is actually about the selected company.
 *
 * Yahoo's search() news feed is only loosely bound to the query: asking for
 * "HDFCBANK.NS" returns the same generic wire stories (silver prices, Ford,
 * Bloom Energy) it returns for "RELIANCE.NS". Two signals are trustworthy:
 *
 *  1. `relatedTickers` — provider metadata, so it is preferred (§13). We match
 *     it against every known listing of the company, including foreign ADRs,
 *     because Indian names are frequently tagged with their US ADR (HDFC Bank
 *     articles carry `HDB`, not `HDFCBANK.NS`).
 *  2. The company's core name appearing as a phrase in the headline.
 *
 * A bare symbol substring is deliberately NOT accepted: "TCS" occurs inside
 * unrelated names and tickers on other exchanges.
 */
function isRelevantArticle(
  article: YahooSearchNews,
  ctx: { tickers: Set<string>; coreName: string }
): boolean {
  const related = (article.relatedTickers ?? []).map((t) => t.toUpperCase());
  if (related.some((t) => ctx.tickers.has(t))) return true;

  if (ctx.coreName.length >= 4) {
    const title = (article.title ?? "").toLowerCase();
    if (title.includes(ctx.coreName.toLowerCase())) return true;
  }

  return false;
}

/**
 * Every ticker that identifies this company, across exchanges.
 *
 * Built from Yahoo's own search index rather than guessed: any equity whose
 * long/short name matches the resolved company is the same issuer listed
 * elsewhere, which is how the NYSE ADR (HDB) gets associated with HDFCBANK.NS.
 */
function buildTickerSet(symbol: string, companyName: string, quotes: YahooSearchQuote[]): Set<string> {
  const base = symbol.replace(/\.(NS|BO)$/, "").toUpperCase();
  const set = new Set<string>([symbol.toUpperCase(), base, `${base}.NS`, `${base}.BO`]);

  const core = coreCompanyName(companyName).toLowerCase();
  for (const q of quotes) {
    if (!q.symbol || q.quoteType !== "EQUITY") continue;
    const qName = coreCompanyName(q.longname ?? q.shortname ?? "").toLowerCase();
    if (core && qName && qName === core) set.add(q.symbol.toUpperCase());
  }

  return set;
}

// ── Autocomplete ───────────────────────────────────────────────────────────
// Layer 1 is the in-process NSE index (no network); layer 2 is Yahoo's search
// index. Local hits rank first so common Indian names resolve instantly.
router.get("/insights/lookup", async (req, res) => {
  const raw = ((req.query.q as string) || "").trim();
  if (raw.length < 2) {
    res.json({ results: [] });
    return;
  }

  const needle = raw.toLowerCase();
  const results: Array<{ symbol: string; displaySymbol: string; name: string; exchange: string }> = [];
  const seen = new Set<string>();

  const push = (symbol: string, name: string, exchange: string) => {
    const key = symbol.toUpperCase();
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ symbol, displaySymbol: symbol.replace(/\.(NS|BO)$/, ""), name, exchange });
  };

  try {
    for (const [sym, meta] of Object.entries(NSE_STOCKS)) {
      if (sym.toLowerCase().includes(needle) || meta.name.toLowerCase().includes(needle)) {
        push(`${sym}.NS`, meta.name, "NSE");
      }
      if (results.length >= 8) break;
    }

    if (results.length < 8) {
      const { quotes } = await yahooSearch(raw, { newsCount: 0, quotesCount: 12 });
      const equities = quotes
        .filter((q) => q.symbol && q.quoteType === "EQUITY")
        .sort((a, b) => exchangeRank(a.exchDisp) - exchangeRank(b.exchDisp));

      for (const q of equities) {
        if (results.length >= 8) break;
        push(q.symbol!, q.longname ?? q.shortname ?? q.symbol!, q.exchDisp ?? "—");
      }
    }

    res.json({ results: results.slice(0, 8) });
  } catch (err: unknown) {
    // Autocomplete is an assist, never a blocker — degrade to whatever the
    // local index produced rather than failing the keystroke.
    console.error("[insights] lookup error:", err instanceof Error ? err.message : String(err));
    res.json({ results: results.slice(0, 8) });
  }
});

router.get("/insights/search", async (req, res) => {
  const raw = (req.query.q as string || "").trim();
  if (!raw) {
    res.status(400).json({ error: "Query parameter 'q' is required" });
    return;
  }

  try {
    const resolved = await resolveSymbol(raw);
    if (!resolved) {
      res.status(404).json({ error: `Stock '${raw}' not found. Try a valid NSE symbol like SBIN, RELIANCE, or COALINDIA.` });
      return;
    }
    const { symbol: q, quote } = resolved;

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 90);

    const companyName = quote.longName ?? quote.shortName ?? q;
    const coreName = coreCompanyName(companyName);

    // News is fetched by COMPANY NAME, not by ticker. Querying Yahoo with an
    // Indian ticker ("HDFCBANK.NS") returns its generic global wire feed —
    // byte-for-byte the same stories it returns for "RELIANCE.NS". Querying
    // the name ("HDFC Bank") returns articles actually tagged to the issuer.
    const newsQuery = coreName || companyName || q;

    const [chart, searchResult] = await Promise.allSettled([
      yahooFinance.chart(q, { period1: start.toISOString().split("T")[0], interval: "1d" }, { validateResult: false }),
      yahooSearch(newsQuery, { newsCount: 30, quotesCount: 10 }),
    ]);

    // yahoo-finance2 returns `unknown` for chart() when validateResult is false
    // (it skips runtime schema validation), so we cast to the documented
    // response shape ourselves, only once the promise is confirmed fulfilled.
    const chartValue = chart.status === "fulfilled"
      ? (chart.value as { quotes?: Array<{ date: Date; close: number | null; volume: number | null }> })
      : undefined;
    const searchValue = searchResult.status === "fulfilled"
      ? searchResult.value
      : { quotes: [] as YahooSearchQuote[], news: [] as YahooSearchNews[] };

    const candles: { date: string; close: number; volume: number }[] = [];
    if (chartValue?.quotes) {
      for (const c of chartValue.quotes) {
        if (c.close != null) candles.push({ date: new Date(c.date).toISOString().split("T")[0], close: c.close, volume: c.volume ?? 0 });
      }
    }

    const closes = candles.map((c) => c.close);
    const rsi = calcRSI(closes);
    const vwap = calcVWAP(candles);
    const price = quote.regularMarketPrice ?? 0;
    const change = quote.regularMarketChange ?? 0;
    const changePercent = quote.regularMarketChangePercent ?? 0;

    const tickers = buildTickerSet(q, companyName, searchValue.quotes);
    const relevant = searchValue.news.filter((n) => isRelevantArticle(n, { tickers, coreName }));

    // Deliberately NOT topped up with unrelated market news when this is empty
    // (§11): an honest empty state beats articles about a different company.
    const news = relevant.slice(0, 15).map((n) => ({
      title: n.title ?? "Untitled",
      description: "",
      url: n.link ?? "",
      source: n.publisher ?? "Unknown",
      publishedAt: normalisePublishTime(n.providerPublishTime),
      thumbnail: n.thumbnail?.resolutions?.[0]?.url ?? "",
    }));

    const { score: sentimentScore, label: sentiment } = deriveSentimentWithScore(news);
    const forecast = deriveForecast(rsi, price, vwap);

    // Strip Yahoo Finance exchange suffix for clean display (SBIN.NS → SBIN)
    const displaySymbol = q.replace(/\.(NS|BO)$/, "");
    const exchange = q.endsWith(".NS") ? "NSE" : q.endsWith(".BO") ? "BSE" : (quote.fullExchangeName ?? "");

    res.json({
      symbol: displaySymbol,
      name: companyName,
      exchange,
      // Provenance (§15). Both feeds are Yahoo today; naming them separately
      // means a future split (e.g. a dedicated India news wire) needs no UI change.
      priceSource: "Yahoo Finance",
      newsSource: "Yahoo Finance",
      lastUpdated: new Date().toISOString(),
      newsScanned: searchValue.news.length,
      price,
      change,
      changePercent,
      rsi,
      vwap: Math.round(vwap * 100) / 100,
      forecast,
      sentiment,
      sentimentScore,
      currency: quote.currency ?? "INR",
      marketCap: quote.marketCap ?? 0,
      volume: quote.regularMarketVolume ?? 0,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? 0,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? 0,
      priceHistory: candles,
      news,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[insights] error:", msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
