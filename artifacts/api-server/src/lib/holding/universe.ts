/**
 * Configurable equity universe for the Holding Stocks module.
 *
 * Membership comes from NSE's own published index CSVs via
 * `constituents.ts` — the authoritative source — so NIFTY 50/100/200/500 are
 * all genuinely screenable and stay current through NSE's review cycle (§7).
 *
 * A hardcoded NIFTY 50 snapshot remains as an offline fallback only. It is
 * clearly labelled as such when it is used, because a stale membership list
 * silently standing in for NIFTY 500 would misrepresent what was screened (§25).
 */

import { NSE_STOCKS, type NseStockMeta } from "../nseData.js";
import { nseConstituentProvider, type ConstituentProvider } from "./constituents.js";
import { displaySymbolFor } from "./symbols.js";

export { displaySymbolFor, internalSymbolFor } from "./symbols.js";

export type UniverseId = "NIFTY_50" | "NIFTY_100" | "NIFTY_200" | "NIFTY_500";

export const UNIVERSE_IDS: UniverseId[] = ["NIFTY_50", "NIFTY_100", "NIFTY_200", "NIFTY_500"];

export interface UniverseMember {
  /** Internal symbol — the key used by nseData / liveMarketData / toYF(). */
  symbol: string;
  /**
   * How the ticker is actually written on the exchange. The internal keys use
   * underscores because `M&M` and `BAJAJ-AUTO` are not valid object-key
   * spellings here, and that quirk must not reach the screen.
   */
  displaySymbol: string;
  name: string;
  sector: string;
}

export interface UniverseMeta {
  id: UniverseId;
  label: string;
  available: boolean;
  /** Constituent count once the feed has been read, else null. */
  size: number | null;
  note: string;
}

/** Snapshot date for the offline fallback list below. */
export const UNIVERSE_SNAPSHOT = "2025-01";

export const UNIVERSE_NOTE =
  "Constituents come from NSE's published index CSV and are refreshed daily.";

const FALLBACK_NOTE =
  "The NSE constituent feed could not be reached, so a static NIFTY 50 snapshot " +
  `(${UNIVERSE_SNAPSHOT}) was screened instead. Membership may be out of date.`;

/**
 * NIFTY 50 members that nseData does not carry metadata for. Name and sector
 * only — every price, volume and fundamental still comes from a live provider.
 */
const EXTRA_META: Record<string, NseStockMeta> = {
  BEL:        { name: "Bharat Electronics",     sector: "Defence",   basePrice: 0, marketCap: 0, pe: 0 },
  HDFCLIFE:   { name: "HDFC Life Insurance",    sector: "Insurance", basePrice: 0, marketCap: 0, pe: 0 },
  SBILIFE:    { name: "SBI Life Insurance",     sector: "Insurance", basePrice: 0, marketCap: 0, pe: 0 },
  SHRIRAMFIN: { name: "Shriram Finance",        sector: "NBFC",      basePrice: 0, marketCap: 0, pe: 0 },
  JIOFIN:     { name: "Jio Financial Services", sector: "NBFC",      basePrice: 0, marketCap: 0, pe: 0 },
  TRENT:      { name: "Trent Limited",          sector: "Retail",    basePrice: 0, marketCap: 0, pe: 0 },
  SHREECEM:   { name: "Shree Cement",           sector: "Cement",    basePrice: 0, marketCap: 0, pe: 0 },
};

/** Offline fallback only — the live feed is the real source. */
const FALLBACK_50_SYMBOLS: string[] = [
  "ADANIENT", "ADANIPORTS", "APOLLOHOSP", "ASIANPAINT", "AXISBANK",
  "BAJAJ_AUTO", "BAJFINANCE", "BAJAJFINSV", "BEL", "BHARTIARTL",
  "CIPLA", "COALINDIA", "DRREDDY", "EICHERMOT", "GRASIM",
  "HCLTECH", "HDFCBANK", "HDFCLIFE", "HEROMOTOCO", "HINDALCO",
  "HINDUNILVR", "ICICIBANK", "INDUSINDBK", "INFY", "ITC",
  "JIOFIN", "JSWSTEEL", "KOTAKBANK", "LT", "M_M",
  "MARUTI", "NESTLEIND", "NTPC", "ONGC", "POWERGRID",
  "RELIANCE", "SBILIFE", "SBIN", "SHRIRAMFIN", "SUNPHARMA",
  "TATACONSUM", "TATAMOTORS", "TATASTEEL", "TCS", "TECHM",
  "TITAN", "TRENT", "ULTRACEMCO", "WIPRO", "SHREECEM",
];

const FALLBACK_50: UniverseMember[] = FALLBACK_50_SYMBOLS.map((symbol) => {
  const meta = NSE_STOCKS[symbol] ?? EXTRA_META[symbol];
  return {
    symbol,
    displaySymbol: displaySymbolFor(symbol),
    name: meta?.name ?? symbol,
    sector: meta?.sector ?? "Unclassified",
  };
});

/** Sizes last observed from the feed, so the picker can show counts up front. */
const observedSize = new Map<UniverseId, number>();

export function universeOptions(): UniverseMeta[] {
  return UNIVERSE_IDS.map((id) => ({
    id,
    label: id.replace("_", " "),
    available: true,
    size: observedSize.get(id) ?? null,
    note: UNIVERSE_NOTE,
  }));
}

export const DEFAULT_UNIVERSE: UniverseId = "NIFTY_500";

export function isUniverseId(v: string): v is UniverseId {
  return (UNIVERSE_IDS as string[]).includes(v);
}

export interface ResolvedUniverse {
  requested: UniverseId;
  /** What we actually screened — differs only when the feed was unreachable. */
  resolved: UniverseId;
  members: UniverseMember[];
  /** Where membership came from, for provenance. */
  source: string;
  /** Set when we had to fall back, so the UI can be honest about it. */
  fallbackNote: string | null;
}

export async function resolveUniverse(
  requested: UniverseId = DEFAULT_UNIVERSE,
  provider: ConstituentProvider = nseConstituentProvider
): Promise<ResolvedUniverse> {
  const members = await provider.constituents(requested);

  if (members?.length) {
    observedSize.set(requested, members.length);
    return { requested, resolved: requested, members, source: provider.id, fallbackNote: null };
  }

  return {
    requested,
    resolved: "NIFTY_50",
    members: FALLBACK_50,
    source: `static-snapshot-${UNIVERSE_SNAPSHOT}`,
    fallbackNote:
      requested === "NIFTY_50"
        ? FALLBACK_NOTE
        : `${requested.replace("_", " ")} could not be loaded. ${FALLBACK_NOTE}`,
  };
}

// ── Liquidity floor ─────────────────────────────────────────────────────────
/**
 * Penny and illiquid names are excluded before scoring rather than penalised
 * inside it, so a thin stock can never rank on a strong-looking chart (§7).
 * This matters far more on NIFTY 500 than it did on NIFTY 50.
 */
export const LIQUIDITY_FLOOR = {
  minPrice: 50,
  /** Shares, 20-day average. */
  minAvgVolume: 100_000,
  /** Rupees, 20-day average traded value. */
  minAvgTurnover: 50_000_000,
};

export function passesLiquidityFloor(price: number, avgVolume: number): boolean {
  return (
    price >= LIQUIDITY_FLOOR.minPrice &&
    avgVolume >= LIQUIDITY_FLOOR.minAvgVolume &&
    price * avgVolume >= LIQUIDITY_FLOOR.minAvgTurnover
  );
}
