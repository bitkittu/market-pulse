import { db, upstoxSettingsTable } from "@workspace/db";

const UPSTOX_BASE = "https://api.upstox.com/v2";

// ── Symbol mappings ────────────────────────────────────────────────────────
const NSE_TO_UPSTOX: Record<string, string> = {
  M_M:        "NSE_EQ|M&M",
  BAJAJ_AUTO: "NSE_EQ|BAJAJ-AUTO",
  BAJAJ_FINSERV: "NSE_EQ|BAJAJFINSV",
  ADANI_ENT:  "NSE_EQ|ADANIENT",
  ADANI_PORTS:"NSE_EQ|ADANIPORTS",
};

function toUpstoxKey(nseSymbol: string): string {
  return NSE_TO_UPSTOX[nseSymbol] ?? `NSE_EQ|${nseSymbol}`;
}

// Sector index instrument keys for Upstox
export const SECTOR_UPSTOX_MAP: Record<string, string> = {
  Banking:            "NSE_INDEX|Nifty Bank",
  IT:                 "NSE_INDEX|Nifty IT",
  Auto:               "NSE_INDEX|Nifty Auto",
  Pharma:             "NSE_INDEX|Nifty Pharma",
  FMCG:               "NSE_INDEX|Nifty FMCG",
  Metals:             "NSE_INDEX|Nifty Metal",
  Realty:             "NSE_INDEX|Nifty Realty",
  Energy:             "NSE_INDEX|Nifty Energy",
  Infrastructure:     "NSE_INDEX|Nifty Infra",
  Media:              "NSE_INDEX|Nifty Media",
  "PSU Banks":        "NSE_INDEX|Nifty PSU Bank",
  "Financial Services":"NSE_INDEX|Nifty Fin Services",
};

// ── Upstox quote response shapes ───────────────────────────────────────────
interface UpstoxOHLC {
  open: number;
  high: number;
  low: number;
  close: number; // previous close
}

export interface UpstoxQuoteData {
  ohlc: UpstoxOHLC;
  last_price: number;
  volume: number;
  average_trade_price: number; // VWAP/ATP
  net_change: number;          // absolute change from prev close
  instrument_token: string;
  symbol?: string;
}

// ── Token cache (5-minute TTL) ─────────────────────────────────────────────
let tokenCache: { token: string; expiry: number } | null = null;

export function invalidateTokenCache() {
  tokenCache = null;
}

export async function getUpstoxToken(): Promise<string | null> {
  if (tokenCache && tokenCache.expiry > Date.now()) return tokenCache.token;

  try {
    const [settings] = await db.select().from(upstoxSettingsTable).limit(1);
    if (!settings?.accessToken) return null;
    tokenCache = { token: settings.accessToken, expiry: Date.now() + 5 * 60_000 };
    return settings.accessToken;
  } catch {
    return null;
  }
}

export async function isUpstoxConfigured(): Promise<boolean> {
  const token = await getUpstoxToken();
  return token !== null;
}

// ── Core fetch helper ──────────────────────────────────────────────────────
async function upstoxGet(path: string, token: string): Promise<Response> {
  return fetch(`${UPSTOX_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Api-Version": "2.0",
      Accept: "application/json",
    },
  });
}

// ── Fetch full market quotes for multiple instrument keys ──────────────────
async function fetchRawQuotes(
  instrumentKeys: string[],
  token: string
): Promise<Record<string, UpstoxQuoteData> | null> {
  const encoded = instrumentKeys.map(encodeURIComponent).join(",");
  try {
    const resp = await upstoxGet(`/market-quote/quotes?instrument_key=${encoded}`, token);
    if (!resp.ok) return null;
    const json = (await resp.json()) as { status: string; data: Record<string, UpstoxQuoteData> };
    if (json.status !== "success" || !json.data) return null;
    return json.data;
  } catch {
    return null;
  }
}

// ── Public: fetch quotes for NSE symbols ──────────────────────────────────
export async function fetchUpstoxStockQuotes(
  nseSymbols: string[]
): Promise<Map<string, UpstoxQuoteData> | null> {
  const token = await getUpstoxToken();
  if (!token) return null;

  const keys = nseSymbols.map(toUpstoxKey);
  const raw = await fetchRawQuotes(keys, token);
  if (!raw) return null;

  const out = new Map<string, UpstoxQuoteData>();
  for (const sym of nseSymbols) {
    const key = toUpstoxKey(sym);
    // Upstox response uses "NSE_EQ:SYMBOL" (pipe → colon) as the map key
    const responseKey = key.replace("|", ":");
    const data = raw[responseKey];
    if (data) out.set(sym, data);
  }
  return out;
}

// ── Public: fetch a single NSE index (e.g. Nifty 50) ─────────────────────
export async function fetchUpstoxIndexQuote(
  instrumentKey: string // e.g. "NSE_INDEX|Nifty 50"
): Promise<UpstoxQuoteData | null> {
  const token = await getUpstoxToken();
  if (!token) return null;

  const raw = await fetchRawQuotes([instrumentKey], token);
  if (!raw) return null;

  const responseKey = instrumentKey.replace("|", ":");
  return raw[responseKey] ?? null;
}

// ── Public: fetch multiple index quotes at once ────────────────────────────
export async function fetchUpstoxIndexBatch(
  instrumentKeys: string[]
): Promise<Map<string, UpstoxQuoteData> | null> {
  const token = await getUpstoxToken();
  if (!token) return null;

  const raw = await fetchRawQuotes(instrumentKeys, token);
  if (!raw) return null;

  const out = new Map<string, UpstoxQuoteData>();
  for (const key of instrumentKeys) {
    const responseKey = key.replace("|", ":");
    const data = raw[responseKey];
    if (data) out.set(key, data);
  }
  return out;
}

// ── Public: test connection & return status ────────────────────────────────
export async function testUpstoxConnection(): Promise<{
  ok: boolean;
  source: "upstox" | "none";
  message: string;
  samplePrice?: number;
  sampleSymbol?: string;
}> {
  const token = await getUpstoxToken();
  if (!token) {
    return { ok: false, source: "none", message: "No access token configured" };
  }

  const resp = await fetchRawQuotes(["NSE_EQ|RELIANCE"], token);
  if (!resp) {
    return {
      ok: false,
      source: "none",
      message: "Token may be expired or invalid. Generate a new access token from Upstox developer portal.",
    };
  }

  const data = resp["NSE_EQ:RELIANCE"];
  if (!data) {
    return {
      ok: false,
      source: "none",
      message: "Received response but could not parse quote data.",
    };
  }

  return {
    ok: true,
    source: "upstox",
    message: "Connected successfully. Live NSE data is now sourced from Upstox.",
    samplePrice: data.last_price,
    sampleSymbol: "RELIANCE",
  };
}
