/**
 * Post-close scan scheduler (§27).
 *
 * Without this, a scan is only ever computed and recorded when somebody happens
 * to load the page. If no one visits after a market close, that session's picks
 * are never written and the history grows holes — which defeats the point of
 * tracking picks at all, since the Holding Score can only be judged against a
 * complete record.
 *
 * Runs in-process rather than as an external cron because PM2 keeps this app
 * alive as a single fork'd instance (see ecosystem.config.cjs), so a timer here
 * is reliable and needs no separate hPanel configuration. `instances: 1` also
 * means there is no second worker to duplicate the work — if that ever changes
 * to cluster mode, this needs a lock.
 *
 * The schedule is deliberately coarse. This is a 1-3 month module: being within
 * ten minutes of the close is precise enough, and polling for a boundary change
 * is far more robust than trying to fire exactly at 16:00 IST (which drifts
 * across restarts, DST-free though IST is, and misses entirely if the process
 * happens to be down at that instant).
 */

import { logger } from "../logger.js";
import { lastScanBoundary } from "./engine.js";
import { runScheduledScan } from "./index.js";
import { DEFAULT_UNIVERSE, type UniverseId } from "./universe.js";

/** How often to check whether a new post-close boundary has arrived. */
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

/** Delay before the catch-up scan on boot, so startup traffic settles first. */
const BOOT_DELAY_MS = 30 * 1000;

let timer: NodeJS.Timeout | null = null;
let bootTimer: NodeJS.Timeout | null = null;
/** Boundary we have successfully scanned AND persisted. */
let completedBoundary: number | null = null;
/** Guards against a slow scan overlapping the next tick. */
let inFlight = false;

/**
 * NSE trades Monday to Friday. Without this, Saturday and Sunday boundaries
 * would each record another scan carrying Friday's closes, and the same stocks
 * would appear three times in Previous Picks for one trading session.
 *
 * Exchange holidays are not covered — there is no holiday calendar in this
 * project — so a holiday still records a duplicate-looking row. That is
 * cosmetic: forward returns are computed from real candles regardless, so the
 * numbers stay correct either way.
 */
function isWeekendIst(boundary: Date): boolean {
  const istDay = new Date(boundary.getTime() + 5.5 * 60 * 60 * 1000).getUTCDay();
  return istDay === 0 || istDay === 6;
}

async function tick(universe: UniverseId): Promise<void> {
  if (inFlight) return;

  const boundary = lastScanBoundary();
  const key = boundary.getTime();
  if (completedBoundary === key) return;

  if (isWeekendIst(boundary)) {
    // Mark it done so we do not re-evaluate every ten minutes all weekend.
    completedBoundary = key;
    return;
  }

  inFlight = true;
  const started = Date.now();
  try {
    const { scannedAt, pickCount, universe: resolved } = await runScheduledScan(universe);
    // Only now is the boundary genuinely complete — a failed persist leaves it
    // unset so the next tick retries rather than silently skipping the session.
    completedBoundary = key;
    logger.info(
      `[holding] scheduled scan complete: ${resolved} · ${pickCount} picks · ` +
        `scannedAt ${scannedAt} · ${((Date.now() - started) / 1000).toFixed(1)}s`
    );
  } catch (err) {
    logger.warn(
      `[holding] scheduled scan failed (will retry in ${CHECK_INTERVAL_MS / 60000}m): ` +
        `${(err as Error).message}`
    );
  } finally {
    inFlight = false;
  }
}

/**
 * Start the scheduler. Returns a stop function.
 *
 * Set HOLDING_SCAN_SCHEDULE=off to disable — useful in local development, where
 * a cold 500-symbol scan on every restart is a slow, pointless tax on Yahoo.
 */
export function startHoldingScheduler(universe: UniverseId = DEFAULT_UNIVERSE): () => void {
  if (process.env["HOLDING_SCAN_SCHEDULE"]?.toLowerCase() === "off") {
    logger.info("[holding] scheduler disabled via HOLDING_SCAN_SCHEDULE=off");
    return () => {};
  }
  if (timer) return stopHoldingScheduler;

  // Catch-up run: covers a deploy or crash that happened after the close, so a
  // restart at 18:00 still records that day's session.
  bootTimer = setTimeout(() => void tick(universe), BOOT_DELAY_MS);
  bootTimer.unref?.();

  timer = setInterval(() => void tick(universe), CHECK_INTERVAL_MS);
  // Never hold the event loop open on account of the scheduler.
  timer.unref?.();

  logger.info(
    `[holding] scheduler started · universe ${universe} · checking every ` +
      `${CHECK_INTERVAL_MS / 60000}m for a new post-close boundary`
  );
  return stopHoldingScheduler;
}

export function stopHoldingScheduler(): void {
  if (bootTimer) { clearTimeout(bootTimer); bootTimer = null; }
  if (timer) { clearInterval(timer); timer = null; }
}

/** Test seam — lets a test drive a tick without waiting on the interval. */
export const __scheduler = { tick, isWeekendIst };
