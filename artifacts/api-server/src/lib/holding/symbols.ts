/**
 * Symbol spelling conversions.
 *
 * This codebase keys stock metadata by object literal (`NSE_STOCKS`), so two
 * NIFTY names had to be spelled with underscores — `M&M` became `M_M` and
 * `BAJAJ-AUTO` became `BAJAJ_AUTO`. Everything downstream (Upstox lookups,
 * `toYF()`, cache keys) is built on those internal keys, while NSE's
 * constituent feed and the UI both want the real exchange spelling.
 *
 * Kept in its own module so `universe.ts` and `constituents.ts` can both use it
 * without importing each other.
 */

/** Internal key -> exchange ticker, for the handful that differ. */
const DISPLAY_SYMBOLS: Record<string, string> = {
  M_M: "M&M",
  BAJAJ_AUTO: "BAJAJ-AUTO",
};

const INTERNAL_SYMBOLS: Record<string, string> = Object.fromEntries(
  Object.entries(DISPLAY_SYMBOLS).map(([internal, exchange]) => [exchange, internal])
);

/** Internal key -> how the ticker is written on the exchange. */
export function displaySymbolFor(symbol: string): string {
  return DISPLAY_SYMBOLS[symbol] ?? symbol;
}

/**
 * Exchange ticker -> internal key.
 *
 * Only the two known collisions are rewritten. Every other exchange spelling
 * passes through untouched, including ones containing `&` or `-` (`J&KBANK`,
 * `M&MFIN`) — `toYF()` appends `.NS` to those and Yahoo accepts them as-is, so
 * inventing more underscore aliases would break them.
 */
export function internalSymbolFor(exchangeSymbol: string): string {
  return INTERNAL_SYMBOLS[exchangeSymbol] ?? exchangeSymbol;
}
