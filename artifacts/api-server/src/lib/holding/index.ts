/**
 * Holding Stocks service facade.
 *
 * Routes talk to this module only; the pipeline internals (universe, providers,
 * indicators, scoring, risk, persistence) stay behind it so a provider swap
 * never reaches the HTTP layer (§24).
 */

import { getDailyOhlcv } from "../liveMarketData.js";
import { buildHoldingAnalysis } from "./analysis.js";
import { buildReasons, runScan } from "./engine.js";
import { persistScan, readPreviousPicks } from "./store.js";
import { DEFAULT_UNIVERSE, isUniverseId, type UniverseId } from "./universe.js";
import type { HoldingAnalysis, HoldingScan, PreviousPicksResponse } from "./types.js";

export { DEFAULT_UNIVERSE, isUniverseId };
export type { UniverseId };

export function parseUniverse(raw: unknown): UniverseId {
  return typeof raw === "string" && isUniverseId(raw) ? raw : DEFAULT_UNIVERSE;
}

/**
 * Latest scan for a universe.
 *
 * Persisting is fire-and-forget: recording history must never delay or fail the
 * response, and the store already tolerates the tables being absent.
 */
export async function getHoldingScan(universe: UniverseId): Promise<HoldingScan> {
  const result = await runScan(universe);
  void persistCurrentScan(result);
  return result.scan;
}

/** Shared persist step, so the request path and the scheduler store identically. */
function persistCurrentScan(result: Awaited<ReturnType<typeof runScan>>): Promise<void> {
  return persistScan({
    universe: result.scan.summary.universeResolved,
    scannedAt: result.scannedAt,
    picks: result.scan.picks,
    stocks: result.stocks,
    reasonsFor: (symbol) => {
      const stock = result.stocks.get(symbol);
      return stock ? buildReasons(stock).map((r) => r.text) : [];
    },
  });
}

/**
 * Scan and persist, awaiting both.
 *
 * The request path fires persistence off and returns — a user waiting on a page
 * render should not also wait on a history write. The scheduler is the opposite:
 * recording the scan IS its job, so it awaits the write and reports the outcome
 * so a failed persist can be retried on the next tick rather than silently lost.
 */
export async function runScheduledScan(
  universe: UniverseId = DEFAULT_UNIVERSE
): Promise<{ scannedAt: string; universe: UniverseId; pickCount: number }> {
  const result = await runScan(universe);
  await persistCurrentScan(result);
  return {
    scannedAt: result.scannedAt,
    universe: result.scan.summary.universeResolved,
    pickCount: result.scan.picks.length,
  };
}

/** Full breakdown for one symbol. Null when it was not part of the scan. */
export async function getHoldingAnalysis(
  universe: UniverseId,
  symbol: string
): Promise<HoldingAnalysis | null> {
  const result = await runScan(universe);
  const stock = result.stocks.get(symbol.toUpperCase());
  return stock ? buildHoldingAnalysis(stock, result.scannedAt) : null;
}

export async function getPreviousPicks(): Promise<PreviousPicksResponse> {
  return readPreviousPicks({
    candles: async (symbol) => {
      const rows = await getDailyOhlcv(symbol, 200);
      return rows
        .filter((r) => r.high != null && r.low != null && r.close != null)
        .map((r) => ({ date: r.date, high: r.high!, low: r.low!, close: r.close! }));
    },
  });
}
