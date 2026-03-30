import YahooFinance from "yahoo-finance2";
import { NSE_STOCKS, getNseQuote, getGiftNiftyQuote, getNseSectors } from "./nseData.js";

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
}

const cache = new TTLCache();
const STOCK_TTL  = 90_000;   // 90 seconds
const INDEX_TTL  = 120_000;  // 2 minutes

// ── NSE symbol → Yahoo Finance symbol ────────────────────────────────────
const SYMBOL_MAP: Record<string, string> = {
  M_M:       "M&M.NS",
  BAJAJ_AUTO: "BAJAJ-AUTO.NS",
};

function toYF(nseSymbol: string): string {
  return SYMBOL_MAP[nseSymbol] ?? `${nseSymbol}.NS`;
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
}

function buildQuote(nseSymbol: string, q: Record<string, unknown>): LiveQuote {
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
  };
}

// ── Single live quote ─────────────────────────────────────────────────────
export async function getLiveQuote(nseSymbol: string): Promise<LiveQuote | ReturnType<typeof getNseQuote>> {
  const key = `q:${nseSymbol}`;
  const cached = cache.get<LiveQuote>(key);
  if (cached) return cached;

  try {
    const q = await yf.quote(toYF(nseSymbol));
    const result = buildQuote(nseSymbol, q as Record<string, unknown>);
    cache.set(key, result, STOCK_TTL);
    return result;
  } catch {
    return getNseQuote(nseSymbol);
  }
}

// ── Bulk movers (all NSE_STOCKS fetched in parallel chunks) ───────────────
export async function getLiveMovers() {
  const key = "movers";
  const cached = cache.get<{ gainers: LiveQuote[]; losers: LiveQuote[]; timestamp: string }>(key);
  if (cached) return cached;

  const nseSymbols = Object.keys(NSE_STOCKS);
  const CHUNK = 12;

  const allQuotes: LiveQuote[] = [];

  for (let i = 0; i < nseSymbols.length; i += CHUNK) {
    const chunk = nseSymbols.slice(i, i + CHUNK);
    const results = await Promise.all(
      chunk.map(async (sym) => {
        const qKey = `q:${sym}`;
        const cq = cache.get<LiveQuote>(qKey);
        if (cq) return cq;
        try {
          const q = await yf.quote(toYF(sym));
          const r = buildQuote(sym, q as Record<string, unknown>);
          cache.set(qKey, r, STOCK_TTL);
          return r;
        } catch {
          return getNseQuote(sym) as LiveQuote;
        }
      })
    );
    allQuotes.push(...results.filter(Boolean));
  }

  const sorted = [...allQuotes].sort((a, b) => b.changePercent - a.changePercent);
  const result = {
    gainers: sorted.slice(0, 10),
    losers: sorted.slice(-10).reverse(),
    timestamp: new Date().toISOString(),
  };
  cache.set(key, result, STOCK_TTL);
  return result;
}

// ── Gift Nifty — uses Nifty 50 index (^NSEI) as real-time proxy ───────────
export async function getLiveGiftNifty() {
  const key = "nsei";
  const cached = cache.get<ReturnType<typeof getGiftNiftyQuote>>(key);
  if (cached) return cached;

  try {
    const q = await yf.quote("^NSEI");
    const price = (q as Record<string, unknown>).regularMarketPrice as number ?? 0;
    const result = {
      symbol: "GIFT NIFTY",
      name: "GIFT Nifty 50 Futures",
      price,
      change: (q as Record<string, unknown>).regularMarketChange as number ?? 0,
      changePercent: (q as Record<string, unknown>).regularMarketChangePercent as number ?? 0,
      yesterdayHigh: (q as Record<string, unknown>).regularMarketDayHigh as number ?? price,
      yesterdayLow: (q as Record<string, unknown>).regularMarketDayLow as number ?? price,
      yesterdayClose: (q as Record<string, unknown>).regularMarketPreviousClose as number ?? price,
      open: (q as Record<string, unknown>).regularMarketOpen as number ?? price,
      high: (q as Record<string, unknown>).regularMarketDayHigh as number ?? price,
      low: (q as Record<string, unknown>).regularMarketDayLow as number ?? price,
      volume: (q as Record<string, unknown>).regularMarketVolume as number ?? 0,
      updatedAt: new Date().toISOString(),
    };
    cache.set(key, result, STOCK_TTL);
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
          value: (qr.regularMarketPrice as number),
          change: (qr.regularMarketChange as number) ?? sim.change,
          changePercent: (qr.regularMarketChangePercent as number) ?? sim.changePercent,
          advancers: sim.advancers,
          decliners: sim.decliners,
        };
      } catch {
        return sim;
      }
    })
  );

  cache.set(key, results, INDEX_TTL);
  return results;
}
