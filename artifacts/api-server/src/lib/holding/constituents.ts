/**
 * NIFTY index constituent feed.
 *
 * NSE publishes the membership of each broad-market index as a CSV under
 * nsearchives.nseindia.com. That is the authoritative source, so the Holding
 * Stocks universe is built from it rather than from a list hardcoded in this
 * repo — which is what previously capped the module at a stale NIFTY 50
 * snapshot (§7, §25).
 *
 * The feed is treated as best-effort: it is cached for a day, concurrent
 * first-requests are collapsed, and a failure falls back to the static
 * snapshot with a note rather than emptying the universe.
 */

import { logger } from "../logger.js";
import type { UniverseId, UniverseMember } from "./universe.js";
import { displaySymbolFor, internalSymbolFor } from "./symbols.js";

const CSV_BY_UNIVERSE: Record<UniverseId, string> = {
  NIFTY_50: "ind_nifty50list",
  NIFTY_100: "ind_nifty100list",
  NIFTY_200: "ind_nifty200list",
  NIFTY_500: "ind_nifty500list",
};

/**
 * nseindia.com rejects requests without a browser-ish UA and a same-site
 * referer — the same headers liveMarketData already uses for the indices API.
 */
const NSE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/csv,application/csv,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/",
};

/** Index membership changes on NSE's review cycle, so a day is plenty. */
const TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 20_000;

interface CacheEntry {
  members: UniverseMember[];
  expiry: number;
}

const cache = new Map<UniverseId, CacheEntry>();
const inFlight = new Map<UniverseId, Promise<UniverseMember[] | null>>();

/**
 * Minimal RFC-4180 row splitter — company names in this file contain commas
 * inside quotes ("Bajaj Holdings & Investment Ltd., Class A"), so splitting on
 * bare commas mangles the symbol column.
 */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ",") { out.push(field); field = ""; continue; }
    field += c;
  }
  out.push(field);
  return out.map((f) => f.trim());
}

/** Column order has been stable, but resolve by header name rather than index. */
function parseConstituentCsv(csv: string): UniverseMember[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const iSymbol = header.indexOf("symbol");
  const iName = header.findIndex((h) => h.includes("company"));
  const iIndustry = header.indexOf("industry");
  const iSeries = header.indexOf("series");
  if (iSymbol === -1) return [];

  const members: UniverseMember[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const exchangeSymbol = cols[iSymbol]?.toUpperCase();
    if (!exchangeSymbol) continue;

    // Only the rolling-settlement equity series is tradeable as a holding.
    const series = iSeries === -1 ? "EQ" : cols[iSeries]?.toUpperCase();
    if (series && series !== "EQ") continue;

    const symbol = internalSymbolFor(exchangeSymbol);
    if (seen.has(symbol)) continue;
    seen.add(symbol);

    members.push({
      symbol,
      displaySymbol: displaySymbolFor(symbol),
      // Strip the corporate suffix NSE appends to every row.
      name: (cols[iName] ?? exchangeSymbol).replace(/\s+Ltd\.?$/i, "").trim() || exchangeSymbol,
      sector: cols[iIndustry] || "Unclassified",
    });
  }

  return members;
}

async function fetchCsv(universe: UniverseId): Promise<UniverseMember[] | null> {
  const file = CSV_BY_UNIVERSE[universe];
  const url = `https://nsearchives.nseindia.com/content/indices/${file}.csv`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { headers: NSE_HEADERS, signal: controller.signal });
    if (!resp.ok) {
      logger.warn(`[holding] constituent feed ${universe}: HTTP ${resp.status}`);
      return null;
    }
    const members = parseConstituentCsv(await resp.text());

    // A feed that parses to a handful of rows is a broken feed, not a small
    // index — better to fall back than to screen a truncated universe.
    const expectedMin = universe === "NIFTY_50" ? 40 : universe === "NIFTY_100" ? 80 : universe === "NIFTY_200" ? 160 : 400;
    if (members.length < expectedMin) {
      logger.warn(`[holding] constituent feed ${universe}: only ${members.length} rows, expected >= ${expectedMin}`);
      return null;
    }
    return members;
  } catch (err) {
    logger.warn(`[holding] constituent feed ${universe} failed: ${(err as Error).message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface ConstituentProvider {
  id: string;
  /** Null when the feed is unavailable — the caller then falls back. */
  constituents(universe: UniverseId): Promise<UniverseMember[] | null>;
}

export const nseConstituentProvider: ConstituentProvider = {
  id: "nse-india-index-csv",

  async constituents(universe) {
    const cached = cache.get(universe);
    if (cached && cached.expiry > Date.now()) return cached.members;

    const pending = inFlight.get(universe);
    if (pending) return pending;

    const promise = fetchCsv(universe)
      .then((members) => {
        if (members) cache.set(universe, { members, expiry: Date.now() + TTL_MS });
        return members;
      })
      .finally(() => inFlight.delete(universe));

    inFlight.set(universe, promise);
    return promise;
  },
};
