/**
 * Technical indicators for the Holding Stocks engine.
 *
 * Every function here is a pure calculation over a real daily OHLCV series —
 * there is no seeded randomness and no fallback constant anywhere in this file.
 * When the series is too short for an indicator the function returns null and
 * the caller renders "Data unavailable" rather than a filled-in number (§17).
 */

export interface Candle {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Primitives ──────────────────────────────────────────────────────────────

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  // Seed with the SMA of the first `period` values, then walk forward.
  let acc = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) acc = values[i] * k + acc * (1 - k);
  return acc;
}

/** Wilder-smoothed RSI. Needs period+1 closes minimum. */
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }

  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export interface MacdResult {
  macd: number;
  signal: number;
  histogram: number;
}

/** MACD(12,26,9). Returns null until there are enough closes for the signal line. */
export function macd(closes: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult | null {
  if (closes.length < slow + signalPeriod) return null;

  // Build the full MACD series so the signal line is a real EMA of it rather
  // than a single-point approximation.
  const macdSeries: number[] = [];
  for (let i = slow; i <= closes.length; i++) {
    const window = closes.slice(0, i);
    const f = ema(window, fast);
    const s = ema(window, slow);
    if (f == null || s == null) continue;
    macdSeries.push(f - s);
  }
  if (macdSeries.length < signalPeriod) return null;

  const macdNow = macdSeries[macdSeries.length - 1];
  const signal = ema(macdSeries, signalPeriod);
  if (signal == null) return null;

  return { macd: macdNow, signal, histogram: macdNow - signal };
}

/** Wilder ATR. */
export function atr(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null;

  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = candles[i - 1].close;
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose)));
  }

  let acc = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) acc = (acc * (period - 1) + trs[i]) / period;
  return acc;
}

/** Annualised close-to-close volatility, in percent. */
export function volatilityPct(closes: number[], period = 60): number | null {
  if (closes.length < period + 1) return null;
  const window = closes.slice(-(period + 1));
  const rets: number[] = [];
  for (let i = 1; i < window.length; i++) rets.push(Math.log(window[i] / window[i - 1]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

/** Percentage return over `bars` sessions. */
export function returnOver(closes: number[], bars: number): number | null {
  if (closes.length < bars + 1) return null;
  const then = closes[closes.length - 1 - bars];
  if (!then) return null;
  return ((closes[closes.length - 1] - then) / then) * 100;
}

// ── Swing structure ─────────────────────────────────────────────────────────

/**
 * Nearest swing level below (support) and above (resistance) the last close.
 *
 * A swing point is a bar whose low (or high) is the extreme of a
 * `2*lookaround+1` window, which is the standard pivot definition — no
 * arbitrary "price × 0.98" levels are generated anywhere (§21).
 */
export function swingLevels(
  candles: Candle[],
  lookaround = 5
): { support: number | null; secondarySupport: number | null; resistance: number | null } {
  if (candles.length < lookaround * 2 + 1) {
    return { support: null, secondarySupport: null, resistance: null };
  }

  const price = candles[candles.length - 1].close;
  const lows: number[] = [];
  const highs: number[] = [];

  for (let i = lookaround; i < candles.length - lookaround; i++) {
    const window = candles.slice(i - lookaround, i + lookaround + 1);
    const c = candles[i];
    if (window.every((w) => c.low <= w.low)) lows.push(c.low);
    if (window.every((w) => c.high >= w.high)) highs.push(c.high);
  }

  const below = lows.filter((l) => l < price).sort((a, b) => b - a);
  const above = highs.filter((h) => h > price).sort((a, b) => a - b);

  return {
    support: below[0] ?? null,
    secondarySupport: below[1] ?? null,
    resistance: above[0] ?? null,
  };
}

// ── Aggregate snapshot ──────────────────────────────────────────────────────

export interface TechnicalSnapshot {
  price: number;
  dma20: number | null;
  dma50: number | null;
  dma200: number | null;
  /** True only when price > 20 > 50 > 200 — a full bullish stack. */
  maAligned: boolean;
  aboveDma20: boolean | null;
  aboveDma50: boolean | null;
  aboveDma200: boolean | null;
  /** Percent the close sits above (positive) or below the 20 DMA. */
  extensionFrom20Pct: number | null;
  rsi14: number | null;
  macd: MacdResult | null;
  atr14: number | null;
  atrPct: number | null;
  volatilityPct: number | null;

  volume: number;
  avgVolume20: number | null;
  volumeRatio: number | null;
  /** Volume on the day the 52-week-high run started, vs average. */
  breakoutVolumeRatio: number | null;

  week52High: number | null;
  week52Low: number | null;
  distanceFrom52wHighPct: number | null;
  isNew52wHigh: boolean;

  support: number | null;
  secondarySupport: number | null;
  resistance: number | null;
  /** Resistance level a close above would confirm a breakout. */
  breakoutLevel: number | null;
  brokeResistance: boolean;

  return1w: number | null;
  return1m: number | null;
  return3m: number | null;

  /** Sessions of real data behind this snapshot. */
  bars: number;
}

/** Approximate NSE session counts. */
export const BARS = { week: 5, month: 21, quarter: 63, year: 250 };

export function buildTechnicalSnapshot(candles: Candle[]): TechnicalSnapshot | null {
  if (candles.length < 30) return null;

  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const price = closes[closes.length - 1];

  const dma20 = sma(closes, 20);
  const dma50 = sma(closes, 50);
  const dma200 = sma(closes, 200);

  const yearWindow = candles.slice(-BARS.year);
  const week52High = yearWindow.length ? Math.max(...yearWindow.map((c) => c.high)) : null;
  const week52Low = yearWindow.length ? Math.min(...yearWindow.map((c) => c.low)) : null;

  const avgVolume20 = sma(volumes, 20);
  const atr14 = atr(candles, 14);

  const { support, secondarySupport, resistance } = swingLevels(candles);

  // A "breakout" here means the last close cleared a swing high that was
  // resistance a month ago — not merely that price is rising.
  const priorWindow = candles.slice(-BARS.quarter, -BARS.week);
  const priorHigh = priorWindow.length ? Math.max(...priorWindow.map((c) => c.high)) : null;
  const brokeResistance = priorHigh != null && price > priorHigh;

  // Volume behind the breakout: the heaviest session since the prior high was
  // cleared, relative to the 20-day average.
  let breakoutVolumeRatio: number | null = null;
  if (brokeResistance && avgVolume20 && avgVolume20 > 0) {
    const since = candles.slice(-BARS.week);
    breakoutVolumeRatio = Math.max(...since.map((c) => c.volume)) / avgVolume20;
  }

  return {
    price,
    dma20,
    dma50,
    dma200,
    maAligned: dma20 != null && dma50 != null && dma200 != null && price > dma20 && dma20 > dma50 && dma50 > dma200,
    aboveDma20: dma20 == null ? null : price > dma20,
    aboveDma50: dma50 == null ? null : price > dma50,
    aboveDma200: dma200 == null ? null : price > dma200,
    extensionFrom20Pct: dma20 == null || dma20 === 0 ? null : ((price - dma20) / dma20) * 100,
    rsi14: rsi(closes, 14),
    macd: macd(closes),
    atr14,
    atrPct: atr14 == null || price === 0 ? null : (atr14 / price) * 100,
    volatilityPct: volatilityPct(closes),

    volume: volumes[volumes.length - 1],
    avgVolume20,
    volumeRatio: avgVolume20 && avgVolume20 > 0 ? volumes[volumes.length - 1] / avgVolume20 : null,
    breakoutVolumeRatio,

    week52High,
    week52Low,
    distanceFrom52wHighPct:
      week52High == null || week52High === 0 ? null : ((week52High - price) / week52High) * 100,
    isNew52wHigh: week52High != null && price >= week52High * 0.999,

    support,
    secondarySupport,
    resistance,
    breakoutLevel: resistance ?? priorHigh,
    brokeResistance,

    return1w: returnOver(closes, BARS.week),
    return1m: returnOver(closes, BARS.month),
    return3m: returnOver(closes, BARS.quarter),

    bars: candles.length,
  };
}

/** Stock return minus benchmark return over the same window, in percentage points. */
export function relativeStrength(
  stockReturn: number | null,
  benchmarkReturn: number | null
): number | null {
  if (stockReturn == null || benchmarkReturn == null) return null;
  return stockReturn - benchmarkReturn;
}
