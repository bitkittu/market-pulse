/**
 * Scan persistence for Holding Stocks (§22, §23).
 *
 * Two tables, created by lib/db/holding_stocks.sql, which has to be applied to
 * the MySQL instance by hand like every other schema change in this project —
 * nothing here creates or alters tables at runtime.
 *
 * Every function degrades to a no-op / empty result when the tables are absent
 * so the module works fully on a database that has not been migrated yet. That
 * is deliberate: a missing history table must not take down the scan.
 *
 * Forward returns (1M / 2M / 3M, max gain, max drawdown) are NOT written at
 * scan time. They are computed later from real price history once the window
 * has actually elapsed — until then the columns stay NULL and the UI shows a
 * pending state rather than a number (§22).
 */

import { db } from "@workspace/db";
import { logger } from "../logger.js";
import { BARS } from "./indicators.js";
import type { HoldingPick, PreviousPick, PreviousPicksResponse } from "./types.js";
import type { UniverseId } from "./universe.js";
import { displaySymbolFor } from "./symbols.js";
import type { ScannedStock } from "./engine.js";

/**
 * When the tables were last found missing, or null if they are present (or we
 * have not looked yet).
 *
 * This used to be a permanent latch, which meant a schema applied while the
 * process was running could never take effect — the module short-circuited
 * every subsequent call and kept reporting "not migrated" until a redeploy.
 * Since applying this schema by hand to a *running* server is exactly the
 * documented workflow, the check now expires so the module self-heals within a
 * minute of the tables appearing.
 */
let schemaMissingSince: number | null = null;
/** How long to skip DB work after finding the tables absent, before re-probing. */
const SCHEMA_RECHECK_MS = 60_000;
/** Keeps the "history disabled" warning to one line per outage, not per request. */
let warnedMissingSchema = false;

const MISSING_TABLE_CODES = new Set(["ER_NO_SUCH_TABLE", "ER_BAD_DB_ERROR"]);

function isMissingSchema(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code != null && MISSING_TABLE_CODES.has(code);
}

/** True while we are inside the cooldown after a confirmed missing schema. */
function skipWhileMissing(): boolean {
  if (schemaMissingSince == null) return false;
  if (Date.now() - schemaMissingSince < SCHEMA_RECHECK_MS) return true;
  // Cooldown elapsed — let one call through to re-probe.
  schemaMissingSince = null;
  return false;
}

/** Runs `fn`, swallowing "table/database not there" and connection errors. */
async function safe<T>(label: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  if (skipWhileMissing()) return fallback;
  try {
    const out = await fn();
    // Recovered (or never broken) — re-arm the warning for a future outage.
    schemaMissingSince = null;
    warnedMissingSchema = false;
    return out;
  } catch (err) {
    if (isMissingSchema(err)) {
      if (!warnedMissingSchema) {
        warnedMissingSchema = true;
        logger.warn(
          `[holding] ${label}: holding_scans tables not found — history disabled, ` +
            `re-checking in ${SCHEMA_RECHECK_MS / 1000}s. ` +
            `Apply lib/db/holding_stocks.sql to enable pick tracking.`
        );
      }
      schemaMissingSince = Date.now();
      return fallback;
    }
    logger.warn(`[holding] ${label} failed: ${(err as Error).message}`);
    return fallback;
  }
}

// ── Writes ──────────────────────────────────────────────────────────────────

export interface PersistArgs {
  universe: UniverseId;
  scannedAt: string;
  picks: HoldingPick[];
  stocks: Map<string, ScannedStock>;
  reasonsFor: (symbol: string) => string[];
}

/**
 * Store one scan and its picks. Idempotent per (universe, scannedAt) — a repeat
 * call for the same post-close boundary updates rather than duplicating.
 */
export async function persistScan(args: PersistArgs): Promise<void> {
  await safe("persistScan", undefined, async () => {
    const scanId = await db.holdingScans.upsertScan({
      universe: args.universe,
      scannedAt: new Date(args.scannedAt),
      pickCount: args.picks.length,
    });

    // A re-scan of the same boundary can rank a different top ten. Clear out
    // anything that dropped off first, so the stored list is the scan's list
    // rather than the union of every list it has ever produced.
    await db.holdingScans.deleteStalePicks(scanId, args.picks.map((p) => p.symbol));

    for (const pick of args.picks) {
      const stock = args.stocks.get(pick.symbol);
      await db.holdingScans.upsertPick({
        scanId,
        symbol: pick.symbol,
        name: pick.name,
        scanPrice: pick.currentPrice,
        score: pick.score,
        scoreComponents: JSON.stringify(stock?.result.score.categories ?? []),
        classification: pick.classification,
        riskLevel: pick.riskLevel,
        reasons: JSON.stringify(args.reasonsFor(pick.symbol)),
      });
    }
  });
}

/**
 * Symbols in the most recent stored scan before `beforeIso`, used to mark
 * "New This Scan". Returns null when there is no prior scan to compare with —
 * the caller then reports 0 new rather than claiming every pick is new.
 */
export async function readLastScanSymbols(
  universe: UniverseId,
  beforeIso: string
): Promise<Set<string> | null> {
  return safe("readLastScanSymbols", null, async () => {
    const symbols = await db.holdingScans.previousScanSymbols(universe, new Date(beforeIso));
    return symbols.length ? new Set(symbols) : null;
  });
}

// ── Reads ───────────────────────────────────────────────────────────────────

const NOT_MIGRATED_NOTE =
  "Pick history is not available yet. Apply lib/db/holding_stocks.sql to the " +
  "database to start recording each scan; forward returns then populate as the " +
  "1, 2 and 3-month windows elapse.";

const NO_HISTORY_NOTE =
  "No completed scans recorded yet. Previous picks and their forward returns " +
  "appear here once scans have been stored and time has passed.";

export interface PreviousPicksDeps {
  /** Daily candles for one symbol — injected so this module stays provider-free. */
  candles: (symbol: string) => Promise<{ date: Date; high: number; low: number; close: number }[]>;
}

/**
 * Previous picks with forward performance.
 *
 * Forward returns are derived from the real daily series between the scan date
 * and today. A window that has not elapsed yet stays null — this never
 * extrapolates or annualises a partial period.
 */
export async function readPreviousPicks(deps: PreviousPicksDeps): Promise<PreviousPicksResponse> {
  const rows = await safe("readPreviousPicks", null as Awaited<ReturnType<typeof db.holdingScans.recentPicks>> | null, () =>
    db.holdingScans.recentPicks(60)
  );

  if (rows == null) {
    return { available: false, note: NOT_MIGRATED_NOTE, picks: [] };
  }
  if (rows.length === 0) {
    return { available: true, note: NO_HISTORY_NOTE, picks: [] };
  }

  const bySymbol = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = bySymbol.get(r.symbol) ?? [];
    list.push(r);
    bySymbol.set(r.symbol, list);
  }

  const seriesBySymbol = new Map<string, Awaited<ReturnType<PreviousPicksDeps["candles"]>>>();
  await Promise.all(
    [...bySymbol.keys()].map(async (symbol) => {
      try {
        seriesBySymbol.set(symbol, await deps.candles(symbol));
      } catch {
        /* leave unset — forward returns stay null for this symbol */
      }
    })
  );

  const picks: PreviousPick[] = rows.map((r) => {
    const series = seriesBySymbol.get(r.symbol) ?? [];
    const scanTime = r.scannedAt.getTime();
    const forward = series.filter((c) => c.date.getTime() >= scanTime);

    const currentPrice = forward.length ? forward[forward.length - 1].close : null;
    const elapsedBars = forward.length;

    const atBar = (bars: number): number | null => {
      if (elapsedBars <= bars) return null; // window has not elapsed yet
      const c = forward[bars];
      return c ? ((c.close - r.scanPrice) / r.scanPrice) * 100 : null;
    };

    const maxGainPct = forward.length
      ? ((Math.max(...forward.map((c) => c.high)) - r.scanPrice) / r.scanPrice) * 100
      : null;
    const maxDrawdownPct = forward.length
      ? ((Math.min(...forward.map((c) => c.low)) - r.scanPrice) / r.scanPrice) * 100
      : null;

    const returnPct = currentPrice == null ? null : ((currentPrice - r.scanPrice) / r.scanPrice) * 100;

    return {
      // Stored rows key on the internal symbol; the UI wants the exchange
      // spelling, and it is derivable rather than worth a schema column.
      symbol: displaySymbolFor(r.symbol),
      name: r.name,
      scanDate: r.scannedAt.toISOString(),
      scanPrice: r.scanPrice,
      score: r.score,
      classification: r.classification as PreviousPick["classification"],
      classificationLabel: r.classification
        .split("_")
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(" "),
      riskLevel: r.riskLevel as PreviousPick["riskLevel"],
      currentPrice,
      returnPct,
      return1m: atBar(BARS.month),
      return2m: atBar(BARS.month * 2),
      return3m: atBar(BARS.quarter),
      maxGainPct,
      maxDrawdownPct,
      status:
        elapsedBars > BARS.quarter
          ? "Window complete"
          : elapsedBars > 0
            ? `Open · ${elapsedBars} session${elapsedBars === 1 ? "" : "s"} tracked`
            : "Awaiting first session",
    };
  });

  return { available: true, note: "", picks };
}
