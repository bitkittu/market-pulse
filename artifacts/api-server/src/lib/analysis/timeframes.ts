import { seededRandom } from "../nseData.js";
import type {
  Direction,
  MultiTimeframeSummary,
  TimeframeIndicator,
  TimeframeTrend,
  Tone,
} from "./types.js";

/**
 * Indicator engine.
 *
 * Every reading on a timeframe card is derived from one signed conviction
 * number (`directionalScore`, -1..1), so RSI, VWAP, MACD and EMA can never
 * contradict the direction printed at the top of the card. Direction is read
 * *out of* the indicators, not asserted independently.
 *
 * DATA NOTE: `directionalScore` is currently produced from a deterministic
 * seed, not from real candles — see buildTimeframe's `MOCK` provenance. When a
 * real OHLCV feed lands, only `deriveDirectionalScore` needs replacing; the
 * indicator derivation, scoring and UI all stay as they are.
 */

const NEUTRAL_BAND = 0.1;

export function directionOf(ds: number): Direction {
  if (ds > NEUTRAL_BAND) return "BULLISH";
  if (ds < -NEUTRAL_BAND) return "BEARISH";
  return "NEUTRAL";
}

/** Is a bullish-leaning reading good or bad for the trade we are analysing? */
function toneFor(favours: Direction, tradeDirection: Direction): Tone {
  if (favours === "NEUTRAL" || tradeDirection === "NEUTRAL") return "neutral";
  return favours === tradeDirection ? "positive" : "negative";
}

function markerFor(tone: Tone): string {
  return tone === "positive" ? "✓" : tone === "negative" ? "✕" : "—";
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Blend a per-timeframe random draw with the direction the instrument implies.
 * The blend deliberately leaves room for a timeframe to disagree — conflict is
 * a real, useful outcome and must not be engineered away (§10).
 */
function deriveDirectionalScore(seed: number, bias: Direction): number {
  const raw = (seededRandom(seed) - 0.5) * 2; // -1..1
  const pull = bias === "BULLISH" ? 0.45 : bias === "BEARISH" ? -0.45 : 0;
  return clamp(raw * 0.7 + pull, -1, 1);
}

function buildSparkline(seed: number, ds: number, points = 24): number[] {
  const series: number[] = [];
  let level = 0.5;
  for (let i = 0; i < points; i++) {
    const noise = (seededRandom(seed * 7 + i * 13) - 0.5) * 0.09;
    level = clamp(level + ds * 0.022 + noise, 0.04, 0.96);
    series.push(parseFloat(level.toFixed(4)));
  }
  return series;
}

export interface TimeframeInput {
  seed: number;
  timeframe: string;
  label: string;
  caption: string;
  /** Direction that would make the analysed trade profitable. */
  tradeDirection: Direction;
  /** Direction the underlying is expected to lean. Usually === tradeDirection. */
  bias: Direction;
}

export function buildTimeframe(input: TimeframeInput): TimeframeTrend {
  const { seed, timeframe, label, caption, tradeDirection, bias } = input;
  const ds = deriveDirectionalScore(seed, bias);
  const direction = directionOf(ds);
  const mag = Math.abs(ds);

  // RSI tracks conviction: strongly bullish pushes it up, bearish pulls it down.
  const rsi = clamp(50 + ds * 24 + (seededRandom(seed * 3) - 0.5) * 7, 6, 94);
  const rsiFavours: Direction = rsi > 55 ? "BULLISH" : rsi < 45 ? "BEARISH" : "NEUTRAL";

  const vwapFavours = direction;
  const vwapLabel =
    direction === "BULLISH" ? "Above VWAP" : direction === "BEARISH" ? "Below VWAP" : "At VWAP";

  const macdFavours: Direction = mag > 0.14 ? direction : "NEUTRAL";
  const macdLabel =
    macdFavours === "BULLISH" ? "Bullish" : macdFavours === "BEARISH" ? "Bearish" : "Flat";

  const emaFavours: Direction = mag > 0.18 ? direction : "NEUTRAL";
  const emaLabel =
    emaFavours === "BULLISH" ? "Bullish" : emaFavours === "BEARISH" ? "Bearish" : "Crossover";

  // Volume is independent of direction — it tells you how much to trust it.
  const volRaw = seededRandom(seed * 11);
  const volLabel = volRaw > 0.72 ? "High" : volRaw > 0.45 ? "Above Avg" : volRaw > 0.22 ? "Average" : "Low";
  const volTone: Tone = volRaw > 0.45 ? "positive" : volRaw > 0.22 ? "neutral" : "negative";

  const momRaw = seededRandom(seed * 17);
  const momLabel = mag < 0.12 ? "Flat" : momRaw > 0.6 ? "Accelerating" : momRaw > 0.3 ? "Steady" : "Fading";
  const momTone: Tone = momLabel === "Accelerating" ? "positive" : momLabel === "Fading" || momLabel === "Flat" ? "negative" : "neutral";

  const volumeBoost = volRaw > 0.72 ? 9 : volRaw > 0.45 ? 4 : 0;
  const strength = Math.round(clamp(34 + mag * 56 + volumeBoost, 12, 97));

  const indicators: TimeframeIndicator[] = [
    {
      label: `RSI (${timeframe})`,
      value: rsi.toFixed(1),
      tone: toneFor(rsiFavours, tradeDirection),
      marker: markerFor(toneFor(rsiFavours, tradeDirection)),
      provenance: "MOCK",
    },
    {
      label: "Price vs VWAP",
      value: vwapLabel,
      tone: toneFor(vwapFavours, tradeDirection),
      marker: markerFor(toneFor(vwapFavours, tradeDirection)),
      provenance: "MOCK",
    },
    {
      label: `MACD (${timeframe})`,
      value: macdLabel,
      tone: toneFor(macdFavours, tradeDirection),
      marker: markerFor(toneFor(macdFavours, tradeDirection)),
      provenance: "MOCK",
    },
    {
      label: "EMA 9/21",
      value: emaLabel,
      tone: toneFor(emaFavours, tradeDirection),
      marker: markerFor(toneFor(emaFavours, tradeDirection)),
      provenance: "MOCK",
    },
    {
      label: "Volume",
      value: volLabel,
      tone: volTone,
      marker: markerFor(volTone),
      provenance: "MOCK",
    },
    {
      label: "Momentum",
      value: momLabel,
      tone: momTone,
      marker: markerFor(momTone),
      provenance: "MOCK",
    },
  ];

  return {
    timeframe,
    label,
    caption,
    direction,
    strength,
    directionalScore: parseFloat(ds.toFixed(4)),
    indicators,
    sparkline: buildSparkline(seed, ds),
  };
}

/** The standard 3-minute + 15-minute pair used across every market. */
export function buildTimeframePair(
  seed: number,
  tradeDirection: Direction,
  bias: Direction = tradeDirection
): TimeframeTrend[] {
  return [
    buildTimeframe({
      seed: seed * 3 + 101,
      timeframe: "3m",
      label: "3 MIN TREND",
      caption: "Short-term momentum",
      tradeDirection,
      bias,
    }),
    buildTimeframe({
      seed: seed * 5 + 307,
      timeframe: "15m",
      label: "15 MIN TREND",
      caption: "Medium-term momentum",
      tradeDirection,
      bias,
    }),
  ];
}

const DIRECTION_WORD: Record<Direction, string> = {
  BULLISH: "bullish",
  BEARISH: "bearish",
  NEUTRAL: "neutral",
};

/**
 * Compare the two timeframes. Agreement earns a bounded bonus; disagreement
 * costs points and forces a WAIT verdict.
 */
export function summariseTimeframes(
  frames: TimeframeTrend[],
  tradeDirection: Direction
): MultiTimeframeSummary {
  const [short, medium] = frames;
  const rows = frames.map((f) => ({ label: f.label.replace(" TREND", ""), direction: f.direction }));

  const bothNeutral = short.direction === "NEUTRAL" && medium.direction === "NEUTRAL";
  const aligned = short.direction === medium.direction && !bothNeutral;
  const avgStrength = (short.strength + medium.strength) / 2;

  if (aligned) {
    const supportsTrade = short.direction === tradeDirection;
    const alignmentStrength = avgStrength >= 72 ? "Strong" : avgStrength >= 55 ? "Moderate" : "Weak";
    // A strong agreement that points the *wrong* way must not be a bonus.
    const magnitude = alignmentStrength === "Strong" ? 18 : alignmentStrength === "Moderate" ? 11 : 5;
    const confidenceBoost = supportsTrade ? magnitude : -magnitude;
    const word = DIRECTION_WORD[short.direction];

    return {
      aligned: true,
      alignment: short.direction,
      alignmentLabel: `${short.direction} — CONFIRMED`,
      alignmentStrength,
      confidenceBoost,
      probability: alignmentStrength === "Strong" ? "High" : alignmentStrength === "Moderate" ? "Medium" : "Low",
      verdict: supportsTrade ? null : "AGAINST POSITION",
      explanation: supportsTrade
        ? `Both 3-minute and 15-minute trends are aligned ${word}, strengthening the directional case for this trade.`
        : `Both timeframes are aligned ${word}, which runs against this position. Conviction has been reduced accordingly.`,
      rows,
    };
  }

  if (bothNeutral) {
    return {
      aligned: false,
      alignment: "NEUTRAL",
      alignmentLabel: "NO CLEAR TREND",
      alignmentStrength: "Weak",
      confidenceBoost: -6,
      probability: "Low",
      verdict: "WAIT / LOWER CONVICTION",
      explanation:
        "Neither the 3-minute nor the 15-minute timeframe shows a decisive trend. There is no directional edge to act on yet.",
      rows,
    };
  }

  return {
    aligned: false,
    alignment: "CONFLICT",
    alignmentLabel: "TIMEFRAME CONFLICT",
    alignmentStrength: "Weak",
    confidenceBoost: -14,
    probability: "Low",
    verdict: "WAIT / LOWER CONVICTION",
    explanation:
      `The 3-minute trend is ${DIRECTION_WORD[short.direction]} while the 15-minute trend is ` +
      `${DIRECTION_WORD[medium.direction]}. Conflicting timeframes reduce conviction — wait for them to agree.`,
    rows,
  };
}

/** 0-100 score for the alignment category, fed into the scoring engine. */
export function alignmentScore(mtf: MultiTimeframeSummary, tradeDirection: Direction): number {
  if (!mtf.aligned) return mtf.alignment === "CONFLICT" ? 18 : 34;
  const supportsTrade = mtf.alignment === tradeDirection;
  if (!supportsTrade) return 12;
  return mtf.alignmentStrength === "Strong" ? 94 : mtf.alignmentStrength === "Moderate" ? 76 : 58;
}
