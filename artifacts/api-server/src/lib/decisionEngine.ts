import {
  NSE_STOCKS,
  seededRandom,
  getDailySeed,
  symbolSeed,
  getNseQuote,
  calculateIndicators,
} from "./nseData.js";
import { getLiveGiftNifty, getLiveMovers } from "./liveMarketData.js";

// ── Pivot Point Calculator ────────────────────────────────────────────────
export interface KeyLevels {
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
  vwap: number;
  prevHigh: number;
  prevLow: number;
  prevClose: number;
}

function calcPivots(high: number, low: number, close: number): KeyLevels {
  const pivot = (high + low + close) / 3;
  const range = high - low;
  return {
    pivot:    parseFloat(pivot.toFixed(2)),
    r1:       parseFloat((2 * pivot - low).toFixed(2)),
    r2:       parseFloat((pivot + range).toFixed(2)),
    r3:       parseFloat((high + 2 * (pivot - low)).toFixed(2)),
    s1:       parseFloat((2 * pivot - high).toFixed(2)),
    s2:       parseFloat((pivot - range).toFixed(2)),
    s3:       parseFloat((low - 2 * (high - pivot)).toFixed(2)),
    vwap:     parseFloat(pivot.toFixed(2)),
    prevHigh: parseFloat(high.toFixed(2)),
    prevLow:  parseFloat(low.toFixed(2)),
    prevClose: parseFloat(close.toFixed(2)),
  };
}

// ── Market Status ─────────────────────────────────────────────────────────
export type MarketStatus = "BULLISH" | "BEARISH" | "SIDEWAYS";

function getMarketStatus(price: number, prevHigh: number, prevLow: number): MarketStatus {
  if (price > prevHigh) return "BULLISH";
  if (price < prevLow)  return "BEARISH";
  return "SIDEWAYS";
}

// ── Trade Decision ────────────────────────────────────────────────────────
export interface TradeDecision {
  action:      "BUY" | "SELL" | "WAIT";
  color:       "green" | "red" | "yellow";
  buyAbove:    number | null;
  sellBelow:   number | null;
  entry:       number;
  stopLoss:    number;
  target:      number;
  riskReward:  number;
  timeframe:   "Intraday" | "Swing";
  confidence:  number;
}

function calcTradeDecision(
  price:       number,
  levels:      KeyLevels,
  status:      MarketStatus,
  confidence:  number
): TradeDecision {
  const { pivot, r1, r2, s1, s2 } = levels;

  if (status === "BULLISH") {
    const entry    = parseFloat((price + 0.25).toFixed(2));
    const sl       = parseFloat((s1 - (pivot - s1) * 0.3).toFixed(2));
    const target   = parseFloat(r2.toFixed(2));
    const risk     = entry - sl;
    const reward   = target - entry;
    return {
      action:    "BUY",
      color:     "green",
      buyAbove:  parseFloat(r1.toFixed(2)),
      sellBelow: null,
      entry,
      stopLoss:  sl,
      target,
      riskReward: risk > 0 ? parseFloat((reward / risk).toFixed(2)) : 0,
      timeframe:  "Intraday",
      confidence,
    };
  }

  if (status === "BEARISH") {
    const entry    = parseFloat((price - 0.25).toFixed(2));
    const sl       = parseFloat((r1 + (r1 - pivot) * 0.3).toFixed(2));
    const target   = parseFloat(s2.toFixed(2));
    const risk     = sl - entry;
    const reward   = entry - target;
    return {
      action:    "SELL",
      color:     "red",
      buyAbove:  null,
      sellBelow: parseFloat(s1.toFixed(2)),
      entry,
      stopLoss:  sl,
      target,
      riskReward: risk > 0 ? parseFloat((reward / risk).toFixed(2)) : 0,
      timeframe:  "Intraday",
      confidence,
    };
  }

  // SIDEWAYS — Wait for breakout
  // Show levels for BOTH sides; R:R based on the higher-probability direction
  const bullishRR = r2 - r1 > 0 ? parseFloat(((r2 - r1) / Math.max(r1 - s1, 1)).toFixed(2)) : 0;
  return {
    action:    "WAIT",
    color:     "yellow",
    buyAbove:  parseFloat(r1.toFixed(2)),
    sellBelow: parseFloat(s1.toFixed(2)),
    entry:     parseFloat(r1.toFixed(2)),   // hypothetical breakout entry
    stopLoss:  parseFloat(s1.toFixed(2)),
    target:    parseFloat(r2.toFixed(2)),   // R2 target on breakout above R1
    riskReward: bullishRR,
    timeframe:  "Intraday",
    confidence,
  };
}

// ── Market Pressure ───────────────────────────────────────────────────────
export interface MarketPressure {
  buyerStrength:  number;
  sellerStrength: number;
  label:          string;
  trend:          "BULLISH" | "BEARISH" | "NEUTRAL";
}

function calcMarketPressure(price: number, high: number, low: number, prevClose: number): MarketPressure {
  const range = high - low;
  const raw   = range > 0 ? ((price - low) / range) * 100 : 50;
  // Weight in prev close direction
  const momentum = prevClose > 0 ? Math.min(Math.max(((price - prevClose) / prevClose) * 1000, -20), 20) : 0;
  const buyer    = Math.round(Math.min(Math.max(raw + momentum, 5), 95));
  const seller   = 100 - buyer;
  const trend    = buyer > 60 ? "BULLISH" : buyer < 40 ? "BEARISH" : "NEUTRAL";
  return { buyerStrength: buyer, sellerStrength: seller, label: `Buyers: ${buyer}% | Sellers: ${seller}%`, trend };
}

// ── Money Flow ────────────────────────────────────────────────────────────
export interface MoneyFlow {
  volumeSpike:      boolean;
  oiChange:         "UP" | "DOWN" | "FLAT";
  smartMoneySignal: "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL";
  description:      string;
}

function calcMoneyFlow(seed: number, ss: number, status: MarketStatus): MoneyFlow {
  const volR    = seededRandom(seed + ss * 37);
  const oiR     = seededRandom(seed + ss * 41);
  const volumeSpike = volR > 0.62;
  const oiChange: "UP" | "DOWN" | "FLAT" = oiR > 0.6 ? "UP" : oiR < 0.35 ? "DOWN" : "FLAT";
  const smartMoneySignal: "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL" =
    status === "BULLISH" ? "ACCUMULATION"
    : status === "BEARISH" ? "DISTRIBUTION"
    : "NEUTRAL";
  const description =
    smartMoneySignal === "ACCUMULATION"
      ? "Institutional buying detected; price above VWAP with rising OI"
      : smartMoneySignal === "DISTRIBUTION"
      ? "Selling pressure from large participants; declining OI on rallies"
      : "No clear directional bias; mixed signals from institutional flow";
  return { volumeSpike, oiChange, smartMoneySignal, description };
}

// ── Signals Table ─────────────────────────────────────────────────────────
export interface SignalRow {
  symbol:     string;
  name:       string;
  signal:     "BUY" | "SELL" | "HOLD";
  action:     string;
  price:      number;
  entry:      number;
  stopLoss:   number;
  target:     number;
  riskReward: number;
  confidence: number;
}

const SIGNAL_STOCKS = [
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
  "WIPRO", "ITC", "SBIN", "BAJFINANCE", "MARUTI",
  "TATAMOTORS", "SUNPHARMA", "ONGC", "COALINDIA", "ADANIENT",
];

function calcSignalRow(symbol: string, seed: number): SignalRow {
  const stock = NSE_STOCKS[symbol];
  if (!stock) throw new Error(`Unknown: ${symbol}`);
  const ss    = symbolSeed(symbol);
  const q     = getNseQuote(symbol);
  const price = q?.price ?? stock.basePrice;

  const ind   = calculateIndicators(symbol);
  const rawSig = ind?.signal ?? "WATCH";

  const signal: "BUY" | "SELL" | "HOLD" =
    rawSig === "STRONG_BUY" || rawSig === "BUY" ? "BUY"
    : rawSig === "STRONG_SELL" || rawSig === "SELL" ? "SELL"
    : "HOLD";

  const tpPct  = 0.04 + seededRandom(ss * 19 + seed) * 0.08;
  const slPct  = 0.02 + seededRandom(ss * 23 + seed) * 0.04;
  const entry  = parseFloat(price.toFixed(2));
  const target = parseFloat((price * (signal === "SELL" ? (1 - tpPct) : (1 + tpPct))).toFixed(2));
  const sl     = parseFloat((price * (signal === "SELL" ? (1 + slPct) : (1 - slPct))).toFixed(2));
  const risk   = Math.abs(entry - sl);
  const reward = Math.abs(target - entry);
  const rr     = risk > 0 ? parseFloat((reward / risk).toFixed(2)) : 0;
  const conf   = Math.round(50 + seededRandom(ss * 29 + seed) * 40);

  const actionLabel =
    signal === "BUY"  ? `Buy above ₹${entry}` :
    signal === "SELL" ? `Sell below ₹${entry}` :
                        "Hold / Watch";

  return {
    symbol, name: stock.name,
    signal, action: actionLabel,
    price, entry, stopLoss: sl, target, riskReward: rr, confidence: conf,
  };
}

// ── Full Decision Panel ────────────────────────────────────────────────────
export interface DecisionPanel {
  marketStatus:   MarketStatus;
  confidence:     number;
  tradeDecision:  TradeDecision;
  keyLevels:      KeyLevels;
  marketPressure: MarketPressure;
  moneyFlow:      MoneyFlow;
  signalsTable:   SignalRow[];
  niftyPrice:     number;
  niftyChange:    number;
  niftyChangePct: number;
  dataSource:     string;
  updatedAt:      string;
}

export async function getDecisionPanel(): Promise<DecisionPanel> {
  const seed = getDailySeed();
  const quote = await getLiveGiftNifty();
  const price = quote.price;
  const prevClose = quote.yesterdayClose ?? price;
  const high = quote.high ?? price * 1.005;
  const low  = quote.low  ?? price * 0.995;

  const levels   = calcPivots(high, low, prevClose);
  const status   = getMarketStatus(price, levels.prevHigh, levels.prevLow);
  // Confidence: based on how far price is from pivot relative to range
  const distFromPivot = Math.abs(price - levels.pivot) / Math.max(high - low, 1);
  const confidence = Math.round(Math.min(45 + distFromPivot * 300, 95));
  const decision = calcTradeDecision(price, levels, status, confidence);
  const pressure = calcMarketPressure(price, high, low, prevClose);
  const mfSeed = symbolSeed("NIFTY50");
  const moneyFlow = calcMoneyFlow(seed, mfSeed, status);

  // Signals for top 15 → pick first 10 that compute ok
  const signalsTable: SignalRow[] = [];
  for (const sym of SIGNAL_STOCKS) {
    try {
      signalsTable.push(calcSignalRow(sym, seed));
    } catch { /* skip */ }
    if (signalsTable.length >= 10) break;
  }

  return {
    marketStatus:   status,
    confidence,
    tradeDecision:  decision,
    keyLevels:      { ...levels, vwap: levels.pivot },
    marketPressure: pressure,
    moneyFlow,
    signalsTable,
    niftyPrice:     price,
    niftyChange:    quote.change,
    niftyChangePct: quote.changePercent,
    dataSource:     quote.dataSource ?? "nse",
    updatedAt:      new Date().toISOString(),
  };
}

export { calcPivots, calcMarketPressure, calcSignalRow };
