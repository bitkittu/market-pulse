import YahooFinance from "yahoo-finance2";
import { NSE_STOCKS, getNseQuote, getGiftNiftyQuote, getNseSectors } from "./nseData.js";
import {
  fetchUpstoxStockQuotes,
  fetchUpstoxIndexQuote,
  fetchUpstoxIndexBatch,
  SECTOR_UPSTOX_MAP,
  type UpstoxQuoteData,
} from "./upstoxClient.js";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// ── TTL in-memory cache ────────────────────────────────────────────────────
class TTLCache {
  private store = new Map<string, { data: unknown; expiry: number }>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (entry && entry.expiry > Date.now()) return entry.data as T;
    this.store.delete(key);
    return null;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expiry: Date.now() + ttlMs });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }
}

const cache = new TTLCache();
const STOCK_TTL  = 90_000;  // 90 seconds
const INDEX_TTL  = 30_000;  // 30 seconds (real-time NSE data)

// ── NSE India real-time index API ─────────────────────────────────────────
// Single call returns ALL NSE indices (Nifty 50, Bank Nifty, IT, etc.)
// Real-time — no 15-minute Yahoo Finance delay.
interface NseIndexEntry {
  indexSymbol: string;
  last: number;
  variation: number;
  percentChange: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  yearHigh: number;
  yearLow: number;
}

const NSE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/",
};

let nseIndexMap: Map<string, NseIndexEntry> | null = null;
let nseIndexExpiry = 0;

async function fetchNseAllIndices(): Promise<Map<string, NseIndexEntry> | null> {
  if (nseIndexMap && Date.now() < nseIndexExpiry) return nseIndexMap;

  try {
    const resp = await fetch("https://www.nseindia.com/api/allIndices", {
      headers: NSE_HEADERS,
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as { data: NseIndexEntry[] };
    if (!json.data || !Array.isArray(json.data)) return null;

    nseIndexMap = new Map(json.data.map((e) => [e.indexSymbol, e]));
    nseIndexExpiry = Date.now() + INDEX_TTL;
    return nseIndexMap;
  } catch {
    return null;
  }
}

export function invalidateAllCache() {
  ["movers", "nsei", "sectors"].forEach((k) => cache.invalidate(k));
}

// ── NSE symbol → Yahoo Finance symbol ────────────────────────────────────
const YF_SYMBOL_MAP: Record<string, string> = {
  M_M:        "M&M.NS",
  BAJAJ_AUTO: "BAJAJ-AUTO.NS",
};

function toYF(nseSymbol: string): string {
  return YF_SYMBOL_MAP[nseSymbol] ?? `${nseSymbol}.NS`;
}

// ── Quote shape ───────────────────────────────────────────────────────────
export interface LiveQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
  marketCap: number;
  sector: string;
  pe: number;
  week52High: number;
  week52Low: number;
  dataSource: "upstox" | "yahoo" | "simulated";
}

// ── Build quote from Yahoo Finance response ───────────────────────────────
function buildQuoteFromYF(nseSymbol: string, q: Record<string, unknown>): LiveQuote {
  const meta = NSE_STOCKS[nseSymbol];
  const price = (q.regularMarketPrice as number) ?? 0;
  return {
    symbol: nseSymbol,
    name: (q.longName ?? q.shortName ?? meta?.name ?? nseSymbol) as string,
    price,
    change: (q.regularMarketChange as number) ?? 0,
    changePercent: (q.regularMarketChangePercent as number) ?? 0,
    open: (q.regularMarketOpen as number) ?? price,
    high: (q.regularMarketDayHigh as number) ?? price,
    low: (q.regularMarketDayLow as number) ?? price,
    previousClose: (q.regularMarketPreviousClose as number) ?? price,
    volume: (q.regularMarketVolume as number) ?? 0,
    marketCap: (q.marketCap as number) ?? (meta?.marketCap ?? 0),
    sector: meta?.sector ?? "N/A",
    pe: (q.trailingPE as number) ?? (meta?.pe ?? 0),
    week52High: (q.fiftyTwoWeekHigh as number) ?? 0,
    week52Low: (q.fiftyTwoWeekLow as number) ?? 0,
    dataSource: "yahoo",
  };
}

// ── Build quote from Upstox response ─────────────────────────────────────
function buildQuoteFromUpstox(nseSymbol: string, u: UpstoxQuoteData): LiveQuote {
  const meta = NSE_STOCKS[nseSymbol];
  const price = u.last_price;
  const prevClose = u.ohlc.close; // previous close from Upstox
  const change = u.net_change;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    symbol: nseSymbol,
    name: meta?.name ?? nseSymbol,
    price,
    change,
    changePercent,
    open: u.ohlc.open,
    high: u.ohlc.high,
    low: u.ohlc.low,
    previousClose: prevClose,
    volume: u.volume,
    marketCap: meta?.marketCap ?? 0,
    sector: meta?.sector ?? "N/A",
    pe: meta?.pe ?? 0,
    week52High: 0, // not in Upstox quote endpoint
    week52Low: 0,
    dataSource: "upstox",
  };
}

// ── Single live quote ─────────────────────────────────────────────────────
export async function getLiveQuote(
  nseSymbol: string
): Promise<LiveQuote | ReturnType<typeof getNseQuote>> {
  const key = `q:${nseSymbol}`;
  const cached = cache.get<LiveQuote>(key);
  if (cached) return cached;

  // 1. Try Upstox
  try {
    const upstoxMap = await fetchUpstoxStockQuotes([nseSymbol]);
    const upstoxData = upstoxMap?.get(nseSymbol);
    if (upstoxData) {
      const result = buildQuoteFromUpstox(nseSymbol, upstoxData);
      cache.set(key, result, STOCK_TTL);
      return result;
    }
  } catch {
    // fall through to Yahoo Finance
  }

  // 2. Try Yahoo Finance
  try {
    const q = await yf.quote(toYF(nseSymbol));
    const result = buildQuoteFromYF(nseSymbol, q as Record<string, unknown>);
    cache.set(key, result, STOCK_TTL);
    return result;
  } catch {
    // fall through to simulation
  }

  // 3. Simulated fallback
  return getNseQuote(nseSymbol);
}

// ── Bulk movers ───────────────────────────────────────────────────────────
export async function getLiveMovers() {
  const key = "movers";
  const cached = cache.get<{
    gainers: LiveQuote[];
    losers: LiveQuote[];
    timestamp: string;
    dataSource: string;
  }>(key);
  if (cached) return cached;

  const nseSymbols = Object.keys(NSE_STOCKS);
  const allQuotes: LiveQuote[] = [];
  let dataSource = "yahoo";

  // 1. Batch fetch all from Upstox (one API call for all symbols)
  try {
    const upstoxMap = await fetchUpstoxStockQuotes(nseSymbols);
    if (upstoxMap && upstoxMap.size > 0) {
      dataSource = "upstox";
      for (const sym of nseSymbols) {
        const u = upstoxMap.get(sym);
        if (u) {
          const quote = buildQuoteFromUpstox(sym, u);
          cache.set(`q:${sym}`, quote, STOCK_TTL);
          allQuotes.push(quote);
        }
      }
    }
  } catch {
    // fall through to Yahoo
  }

  // 2. Yahoo Finance fallback (chunked to avoid rate limits)
  if (allQuotes.length === 0) {
    const CHUNK = 12;
    for (let i = 0; i < nseSymbols.length; i += CHUNK) {
      const chunk = nseSymbols.slice(i, i + CHUNK);
      const results = await Promise.all(
        chunk.map(async (sym) => {
          const qKey = `q:${sym}`;
          const cq = cache.get<LiveQuote>(qKey);
          if (cq) return cq;
          try {
            const q = await yf.quote(toYF(sym));
            const r = buildQuoteFromYF(sym, q as Record<string, unknown>);
            cache.set(qKey, r, STOCK_TTL);
            return r;
          } catch {
            return getNseQuote(sym) as LiveQuote;
          }
        })
      );
      allQuotes.push(...results.filter(Boolean));
    }
  }

  const sorted = [...allQuotes].sort((a, b) => b.changePercent - a.changePercent);
  const result = {
    gainers: sorted.slice(0, 10),
    losers: sorted.slice(-10).reverse(),
    timestamp: new Date().toISOString(),
    dataSource,
  };
  cache.set(key, result, STOCK_TTL);
  return result;
}

// ── Gift Nifty / Nifty 50 ─────────────────────────────────────────────────
// Priority: 1. NSE India API (real-time) → 2. Upstox → 3. Yahoo Finance
export async function getLiveGiftNifty() {
  const key = "nsei";
  const cached = cache.get<ReturnType<typeof getGiftNiftyQuote>>(key);
  if (cached) return cached;

  // 1. NSE India real-time API (no delay — same data shown on nseindia.com)
  try {
    const indices = await fetchNseAllIndices();
    const n = indices?.get("NIFTY 50");
    if (n && n.last > 0) {
      const result = {
        symbol: "GIFT NIFTY",
        name: "Gift Nifty 50 Futures (Nifty 50)",
        price: n.last,
        change: n.variation,
        changePercent: n.percentChange,
        yesterdayHigh: n.high,
        yesterdayLow: n.low,
        yesterdayClose: n.previousClose,
        open: n.open,
        high: n.high,
        low: n.low,
        yearHigh: n.yearHigh,
        yearLow: n.yearLow,
        volume: 0,
        dataSource: "nse",
        updatedAt: new Date().toISOString(),
      };
      cache.set(key, result, INDEX_TTL);
      return result;
    }
  } catch {
    // fall through
  }

  // 2. Upstox Nifty 50 index
  try {
    const u = await fetchUpstoxIndexQuote("NSE_INDEX|Nifty 50");
    if (u) {
      const price = u.last_price;
      const prevClose = u.ohlc.close;
      const result = {
        symbol: "GIFT NIFTY",
        name: "Gift Nifty 50 Futures (Nifty 50)",
        price,
        change: u.net_change,
        changePercent: prevClose > 0 ? (u.net_change / prevClose) * 100 : 0,
        yesterdayHigh: u.ohlc.high,
        yesterdayLow: u.ohlc.low,
        yesterdayClose: prevClose,
        open: u.ohlc.open,
        high: u.ohlc.high,
        low: u.ohlc.low,
        volume: u.volume,
        dataSource: "upstox",
        updatedAt: new Date().toISOString(),
      };
      cache.set(key, result, INDEX_TTL);
      return result;
    }
  } catch {
    // fall through
  }

  // 3. Yahoo Finance fallback (^NSEI — 15-min delayed)
  try {
    const q = await yf.quote("^NSEI");
    const qr = q as Record<string, unknown>;
    const price = (qr.regularMarketPrice as number) ?? 0;
    const result = {
      symbol: "GIFT NIFTY",
      name: "Gift Nifty 50 Futures (Nifty 50)",
      price,
      change: (qr.regularMarketChange as number) ?? 0,
      changePercent: (qr.regularMarketChangePercent as number) ?? 0,
      yesterdayHigh: (qr.regularMarketDayHigh as number) ?? price,
      yesterdayLow: (qr.regularMarketDayLow as number) ?? price,
      yesterdayClose: (qr.regularMarketPreviousClose as number) ?? price,
      open: (qr.regularMarketOpen as number) ?? price,
      high: (qr.regularMarketDayHigh as number) ?? price,
      low: (qr.regularMarketDayLow as number) ?? price,
      volume: (qr.regularMarketVolume as number) ?? 0,
      dataSource: "yahoo",
      updatedAt: new Date().toISOString(),
    };
    cache.set(key, result, INDEX_TTL);
    return result;
  } catch {
    return getGiftNiftyQuote();
  }
}

// ── NSE Sector indices ─────────────────────────────────────────────────────
const SECTOR_MAP = [
  { sector: "Banking",            index: "NIFTY BANK",        yfSym: "^NSEBANK"    },
  { sector: "IT",                 index: "NIFTY IT",          yfSym: "^CNXIT"      },
  { sector: "Auto",               index: "NIFTY AUTO",        yfSym: "^CNXAUTO"    },
  { sector: "Pharma",             index: "NIFTY PHARMA",      yfSym: "^CNXPHARMA"  },
  { sector: "FMCG",               index: "NIFTY FMCG",        yfSym: "^CNXFMCG"    },
  { sector: "Metals",             index: "NIFTY METAL",       yfSym: "^CNXMETAL"   },
  { sector: "Realty",             index: "NIFTY REALTY",      yfSym: "^CNXREALTY"  },
  { sector: "Energy",             index: "NIFTY ENERGY",      yfSym: "^CNXENERGY"  },
  { sector: "Infrastructure",     index: "NIFTY INFRA",       yfSym: "^CNXINFRA"   },
  { sector: "Media",              index: "NIFTY MEDIA",       yfSym: "^CNXMEDIA"   },
  { sector: "PSU Banks",          index: "NIFTY PSU BANK",    yfSym: "^CNXPSUBANK" },
  { sector: "Financial Services", index: "NIFTY FIN SERVICE", yfSym: "^CNXFINANCE" },
];

export async function getLiveSectors() {
  const key = "sectors";
  const cached = cache.get<unknown[]>(key);
  if (cached) return cached;

  const simFallback = getNseSectors();
  const simByName = Object.fromEntries(simFallback.map((s) => [s.sector, s]));

  // 1. NSE India real-time API — single call for all sector indices
  // Index symbols in SECTOR_MAP "index" field match NSE allIndices exactly
  try {
    const nseMap = await fetchNseAllIndices();
    if (nseMap && nseMap.size > 0) {
      const hits = SECTOR_MAP.filter((s) => nseMap.has(s.index));
      if (hits.length >= 6) {
        const results = SECTOR_MAP.map((s) => {
          const n = nseMap.get(s.index);
          const sim = simByName[s.sector] ?? simFallback[0];
          if (!n || !n.last) return sim;
          return {
            sector: s.sector,
            index: s.index,
            value: n.last,
            change: n.variation,
            changePercent: n.percentChange,
            advancers: sim.advancers,
            decliners: sim.decliners,
            dataSource: "nse",
          };
        });
        cache.set(key, results, INDEX_TTL);
        return results;
      }
    }
  } catch {
    // fall through to Upstox
  }

  // 2. Upstox batch for all sector indices
  try {
    const upstoxKeys = SECTOR_MAP.map((s) => SECTOR_UPSTOX_MAP[s.sector]).filter(Boolean);
    if (upstoxKeys.length > 0) {
      const upstoxBatch = await fetchUpstoxIndexBatch(upstoxKeys);
      if (upstoxBatch && upstoxBatch.size > 0) {
        const results = SECTOR_MAP.map((s) => {
          const indexKey = SECTOR_UPSTOX_MAP[s.sector];
          const u = upstoxBatch.get(indexKey);
          const sim = simByName[s.sector] ?? simFallback[0];
          if (!u) return sim;
          const prevClose = u.ohlc.close;
          return {
            sector: s.sector,
            index: s.index,
            value: u.last_price,
            change: u.net_change,
            changePercent: prevClose > 0 ? (u.net_change / prevClose) * 100 : 0,
            advancers: sim.advancers,
            decliners: sim.decliners,
            dataSource: "upstox",
          };
        });
        cache.set(key, results, INDEX_TTL);
        return results;
      }
    }
  } catch {
    // fall through to Yahoo Finance
  }

  // 3. Yahoo Finance fallback
  const results = await Promise.all(
    SECTOR_MAP.map(async (s) => {
      const sim = simByName[s.sector] ?? simFallback[0];
      try {
        const q = await yf.quote(s.yfSym);
        const qr = q as Record<string, unknown>;
        if (!qr.regularMarketPrice) return sim;
        return {
          sector: s.sector,
          index: s.index,
          value: qr.regularMarketPrice as number,
          change: (qr.regularMarketChange as number) ?? sim.change,
          changePercent: (qr.regularMarketChangePercent as number) ?? sim.changePercent,
          advancers: sim.advancers,
          decliners: sim.decliners,
          dataSource: "yahoo",
        };
      } catch {
        return sim;
      }
    })
  );

  cache.set(key, results, INDEX_TTL);
  return results;
}

// ── Global Indices (Yahoo Finance) ─────────────────────────────────────────
const GLOBAL_TTL = 120_000; // 2 minutes

const GLOBAL_INDEX_META: Record<string, { label: string; currency: string }> = {
  "^NYA":      { label: "NYSE Composite",     currency: "USD" },
  "000001.SS": { label: "Shanghai Composite", currency: "CNY" },
  "^HSI":      { label: "Hang Seng Index",    currency: "HKD" },
  "^NSEI":     { label: "Nifty 50",           currency: "INR" },
};

export async function getGlobalIndexQuote(ticker: string) {
  const key = `global-quote-${ticker}`;
  const cached = cache.get<object>(key);
  if (cached) return cached;

  const q = await yf.quote(ticker);
  const qr = q as Record<string, unknown>;
  const meta = GLOBAL_INDEX_META[ticker];
  const result = {
    ticker,
    name:          (qr.shortName as string) ?? meta?.label ?? ticker,
    price:         (qr.regularMarketPrice as number)        ?? 0,
    change:        (qr.regularMarketChange as number)       ?? 0,
    changePercent: (qr.regularMarketChangePercent as number) ?? 0,
    currency:      (qr.currency as string) ?? meta?.currency ?? "USD",
    dataSource:    "yahoo",
  };
  cache.set(key, result, GLOBAL_TTL);
  return result;
}

export async function getGlobalIndexHistory(ticker: string, period: string) {
  const key = `global-history-${ticker}-${period}`;
  const cached = cache.get<object[]>(key);
  if (cached) return cached;

  const months = period === "1M" ? 1 : 3;
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const rows = await yf.historical(ticker, {
    period1: startDate.toISOString().split("T")[0],
    period2: new Date().toISOString().split("T")[0],
    interval: "1d",
  });

  const data = rows.map((d) => ({
    timestamp: (d.date as Date).toISOString(),
    open:   d.open  ?? 0,
    high:   d.high  ?? 0,
    low:    d.low   ?? 0,
    close:  d.close ?? 0,
    volume: d.volume ?? 0,
  }));

  cache.set(key, data, GLOBAL_TTL);
  return data;
}
