import { NSE_STOCKS, getNseQuote, seededRandom, getDailySeed, symbolSeed, calculateIndicators } from "./nseData.js";

// ── Signals ───────────────────────────────────────────────────────────────
export const SIGNALS = ["STRONG_BUY", "BUY", "WATCH", "SELL", "STRONG_SELL"] as const;

const INTRADAY_RATIONALES = {
  STRONG_BUY: [
    "Price breaking above key resistance with high volume; momentum strongly bullish. VWAP crossover confirmed on 15-min chart.",
    "Bullish engulfing on 30-min candle near critical support. RSI recovering from oversold zone — ideal intraday entry.",
    "Gap-up opening with strong buying in first 30 mins. Supertrend indicator flipped green. Price above VWAP.",
    "Breakout from consolidation zone with 3× average volume. F&O data shows call writing unwinding — squeeze imminent.",
    "Institutional accumulation visible in OI data. Price close to 52-week high; breakout likely in today's session.",
  ],
  BUY: [
    "Positive price action above 20-EMA on hourly chart. MACD histogram turning bullish. Target aligned with Fib 1.618.",
    "Strong sector tailwinds and relative strength vs Nifty. RSI above 55. Volume rising on up-candles.",
    "Demand zone held on two retests. Risk-reward favourable at 1:3. FII buying seen in futures segment.",
    "Price consolidating above VWAP after morning sell-off. Second half usually bullish for this pattern.",
  ],
  WATCH: [
    "Indecisive doji at resistance — wait for breakout confirmation above the level before entering.",
    "Mixed signals: bullish on hourly but bearish on 15-min. Watch for directional clarity at opening price.",
    "High IV; premium expensive. Wait for OI buildup direction before committing. Event risk today.",
    "Range-bound between support and resistance. Breakout in either direction gives a tradeable move.",
  ],
  SELL: [
    "Breakdown below key support with heavy volume. RSI below 40 and falling. VWAP acting as overhead resistance.",
    "Distribution pattern on 30-min chart. OI data shows PE writing accumulation — bearish near term.",
    "Bearish engulfing at resistance. Selling pressure visible; stop above today's high for short entry.",
  ],
  STRONG_SELL: [
    "Confirmed breakdown of multi-month support on high volume. RSI near overbought on short-term rally — sell the bounce.",
    "Gap-down opening with continuation selling. Supertrend remains red. Avoid long positions today.",
  ],
};

const OPTIONS_RATIONALES = {
  CE: {
    STRONG_BUY: [
      "PCR declining sharply; max pain significantly above CMP. Strong CE accumulation in OI — bullish bias.",
      "IV crush post-event; CE underpriced. Underlying showing breakout — momentum CE play with defined risk.",
      "ATM CE OI building with price momentum above VWAP. Ideal for positional CE buying into trend.",
    ],
    BUY: [
      "Moderate bullish bias from OI analysis. CE OI increasing at current strike. Trend supports upward move.",
      "Support held for second day; CE premium attractive with 2-3 session holding view.",
    ],
    WATCH: [
      "Theta decay accelerating with expiry near. Monitor closely — profitable only with swift underlying move.",
      "Mixed OI signals. IV elevated — premium may erode even with directional move. Caution warranted.",
    ],
  },
  PE: {
    STRONG_BUY: [
      "Heavy CE unwinding + PE accumulation at resistance. Bearish divergence on RSI. PE play into resistance.",
      "Underlying making lower highs; PCR rising above 1.2. Put-call data confirms bearish sentiment.",
      "Nifty/BankNifty unable to hold key support on multiple retests. PE momentum building for today.",
    ],
    BUY: [
      "Short covering in PEs ended; fresh PE writing. Underlying weak relative to sectoral index — buy PE dip.",
      "Distribution pattern in underlying matches PE accumulation. Risk-defined bearish trade.",
    ],
    WATCH: [
      "High premium with event risk — wait for clear direction before entry. Premium may decay rapidly.",
    ],
  },
};

function getRationale(category: keyof typeof INTRADAY_RATIONALES, seed: number): string {
  const list = INTRADAY_RATIONALES[category];
  return list[Math.floor(seededRandom(seed) * list.length)];
}

function getOptionsRationale(optType: "CE" | "PE", signal: "STRONG_BUY" | "BUY" | "WATCH", seed: number): string {
  const list = OPTIONS_RATIONALES[optType][signal] ?? OPTIONS_RATIONALES[optType].WATCH;
  return list[Math.floor(seededRandom(seed) * list.length)];
}

// ── Intraday Suggestions ──────────────────────────────────────────────────
const INTRADAY_POOL = [
  "RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "INFY", "SBIN", "LT",
  "BAJFINANCE", "KOTAKBANK", "AXISBANK", "TATAMOTORS", "MARUTI",
  "WIPRO", "HCLTECH", "SUNPHARMA", "NTPC", "TITAN", "JSWSTEEL",
  "BHARTIARTL", "ADANIENT", "HINDUNILVR", "ITC", "ADANIPORTS",
  "TECHM", "DRREDDY", "CIPLA", "POWERGRID", "EICHERMOT", "M_M",
];

export function getIntradaySuggestions() {
  const daySeed = getDailySeed();
  const now = new Date().toISOString();

  // Deterministically pick 10 from pool based on today's date
  const scored = INTRADAY_POOL.map((sym, i) => ({
    sym,
    score: seededRandom(daySeed + i * 37 + symbolSeed(sym)),
  }));
  scored.sort((a, b) => b.score - a.score);
  const picked = scored.slice(0, 10);

  return picked.map(({ sym }, rank) => {
    const stock = NSE_STOCKS[sym];
    const ss = symbolSeed(sym);
    const seed = daySeed + ss;
    const quote = getNseQuote(sym)!;
    const price = quote.price;

    // Generate support/resistance levels
    const r = seededRandom(seed * 3);
    const support = parseFloat((price * (1 - 0.01 - r * 0.012)).toFixed(2));  // ~1-2.2% below
    const resistance = parseFloat((price * (1 + 0.012 + seededRandom(seed * 7) * 0.015)).toFixed(2)); // ~1.2-2.7% above
    const stopLoss = parseFloat((support * (1 - 0.004)).toFixed(2)); // tight stop below support

    // Signal based on RSI-like calculation
    const rsiVal = parseFloat((30 + seededRandom(seed * 11) * 60).toFixed(1));
    const sigIdx = rsiVal > 70 ? 0 : rsiVal > 58 ? 1 : rsiVal > 42 ? 2 : rsiVal > 30 ? 3 : 4;
    const signal = SIGNALS[sigIdx];

    const vwapVariant = seededRandom(seed * 13);
    const vwapStatus = vwapVariant > 0.6 ? "ABOVE" : vwapVariant > 0.25 ? "BELOW" : "AT";

    // Confidence (signal-weighted + RSI alignment)
    const confBase = sigIdx === 0 ? 82 : sigIdx === 1 ? 68 : sigIdx === 2 ? 52 : sigIdx === 3 ? 38 : 25;
    const confRange = sigIdx === 0 ? 13 : sigIdx === 1 ? 14 : sigIdx === 2 ? 16 : 14;
    const confidence = parseFloat((confBase + seededRandom(seed * 41) * confRange).toFixed(1));

    // Risk level based on stop-loss distance from price
    const slDist = ((price - stopLoss) / price) * 100;
    const riskLevel: "Low" | "Medium" | "High" = slDist < 1.8 ? "Low" : slDist < 3.5 ? "Medium" : "High";

    return {
      rank: rank + 1,
      symbol: sym,
      name: stock.name,
      currentPrice: price,
      buyBelow: support,
      sellAbove: resistance,
      stopLoss,
      signal,
      changePercent: quote.changePercent,
      change: quote.change,
      volume: quote.volume,
      sector: stock.sector,
      rationale: getRationale(signal as keyof typeof INTRADAY_RATIONALES, seed * 17),
      rsi: rsiVal,
      vwapStatus: vwapStatus as "ABOVE" | "BELOW" | "AT",
      confidence,
      riskLevel,
      updatedAt: now,
    };
  });
}

// ── Options Suggestions ───────────────────────────────────────────────────
const OPTIONS_POOL = [
  { sym: "NIFTY", name: "Nifty 50 Index", basePrice: 23284.5, lotSize: 25 },
  { sym: "BANKNIFTY", name: "Nifty Bank Index", basePrice: 48234.6, lotSize: 15 },
  { sym: "FINNIFTY", name: "Nifty Financial Services", basePrice: 21284.4, lotSize: 40 },
  { sym: "RELIANCE", name: "Reliance Industries", basePrice: 2948.5, lotSize: 250 },
  { sym: "TCS", name: "Tata Consultancy Services", basePrice: 3842.3, lotSize: 150 },
  { sym: "HDFCBANK", name: "HDFC Bank", basePrice: 1642.8, lotSize: 550 },
  { sym: "ICICIBANK", name: "ICICI Bank", basePrice: 1298.6, lotSize: 700 },
  { sym: "INFY", name: "Infosys", basePrice: 1874.2, lotSize: 400 },
  { sym: "SBIN", name: "State Bank of India", basePrice: 812.4, lotSize: 1500 },
  { sym: "BAJFINANCE", name: "Bajaj Finance", basePrice: 6892.4, lotSize: 125 },
  { sym: "LT", name: "Larsen & Toubro", basePrice: 3612.8, lotSize: 150 },
  { sym: "AXISBANK", name: "Axis Bank", basePrice: 1142.8, lotSize: 1200 },
  { sym: "TATAMOTORS", name: "Tata Motors", basePrice: 982.4, lotSize: 550 },
  { sym: "WIPRO", name: "Wipro", basePrice: 492.8, lotSize: 1500 },
  { sym: "KOTAKBANK", name: "Kotak Mahindra Bank", basePrice: 1842.6, lotSize: 400 },
];

// Next Thursday expiry dates
function getNextExpiry(): string {
  const now = new Date();
  const day = now.getDay();
  const daysUntilThursday = (4 - day + 7) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilThursday);
  return next.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

function getMonthlyExpiry(): string {
  const now = new Date();
  // Last Thursday of current month
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const lastThursday = new Date(lastDay);
  lastThursday.setDate(lastDay.getDate() - ((lastDay.getDay() + 3) % 7));
  if (lastThursday < now) {
    // Next month
    const nm = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    nm.setDate(nm.getDate() - ((nm.getDay() + 3) % 7));
    return nm.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
  }
  return lastThursday.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

export function getOptionsSuggestions() {
  const daySeed = getDailySeed();
  const now = new Date().toISOString();
  const weeklyExpiry = getNextExpiry();
  const monthlyExpiry = getMonthlyExpiry();

  // Pick 10 from pool
  const scored = OPTIONS_POOL.map((item, i) => ({
    item,
    score: seededRandom(daySeed * 2 + i * 43 + symbolSeed(item.sym)),
  }));
  scored.sort((a, b) => b.score - a.score);
  const picked = scored.slice(0, 10);

  return picked.map(({ item }, rank) => {
    const seed = daySeed + symbolSeed(item.sym) * 3;
    const r = seededRandom(seed);

    // Option type: CE or PE
    const optionType: "CE" | "PE" = r > 0.5 ? "CE" : "PE";

    // Underlying price with daily variation
    const uvariaton = (seededRandom(seed * 5) - 0.5) * 0.025;
    const underlyingPrice = parseFloat((item.basePrice * (1 + uvariaton)).toFixed(2));

    // Round strike price to nearest tick
    const tick = underlyingPrice < 500 ? 5 : underlyingPrice < 2000 ? 50 : underlyingPrice < 10000 ? 100 : 500;
    const strikeMod = seededRandom(seed * 7) > 0.5 ? 1 : -1;
    const strikePrice = Math.round((underlyingPrice * (1 + strikeMod * 0.01)) / tick) * tick;

    // Option premium (simplified Black-Scholes feel)
    const ivPct = 0.12 + seededRandom(seed * 11) * 0.25; // 12-37% IV
    const timeDecay = 0.85 + seededRandom(seed * 13) * 0.15;
    const intrinsic = optionType === "CE"
      ? Math.max(underlyingPrice - strikePrice, 0)
      : Math.max(strikePrice - underlyingPrice, 0);
    const extrinsic = underlyingPrice * ivPct * timeDecay * 0.05;
    const premium = parseFloat(Math.max(intrinsic + extrinsic, underlyingPrice * 0.005).toFixed(2));

    const buyBelow = parseFloat((premium * (1 + 0.03 + seededRandom(seed * 17) * 0.05)).toFixed(2));
    const sellAbove = parseFloat((premium * (1 + 0.12 + seededRandom(seed * 19) * 0.15)).toFixed(2));
    const stopLoss = parseFloat((premium * (1 - 0.25 - seededRandom(seed * 23) * 0.15)).toFixed(2));

    // Change
    const prevPremium = parseFloat((premium * (1 - (seededRandom(seed * 29) - 0.4) * 0.15)).toFixed(2));
    const change = parseFloat((premium - prevPremium).toFixed(2));
    const changePercent = parseFloat(((change / prevPremium) * 100).toFixed(2));

    // OI and IV
    const oi = Math.floor(seededRandom(seed * 31) * 5000000 + 100000);
    const iv = parseFloat((ivPct * 100).toFixed(1));

    // Signal
    const sigSeed = seededRandom(seed * 37);
    const sigIdx = optionType === "CE"
      ? (sigSeed > 0.75 ? 0 : sigSeed > 0.45 ? 1 : 2)
      : (sigSeed > 0.75 ? 0 : sigSeed > 0.45 ? 1 : 2);
    const signal = (["STRONG_BUY", "BUY", "WATCH"] as const)[sigIdx];

    // Expiry: weekly for NIFTY/BANKNIFTY/FINNIFTY, monthly for stocks
    const isIndex = ["NIFTY", "BANKNIFTY", "FINNIFTY"].includes(item.sym);
    const expiry = isIndex ? weeklyExpiry : monthlyExpiry;

    const rationaleKey = signal as "STRONG_BUY" | "BUY" | "WATCH";
    const rationale = getOptionsRationale(optionType, rationaleKey, seed * 41);

    // OI Trend
    const oiTrendSeed = seededRandom(seed * 47);
    const oiTrend: "Increasing" | "Decreasing" | "Stable" = oiTrendSeed > 0.6 ? "Increasing" : oiTrendSeed > 0.25 ? "Decreasing" : "Stable";

    // Confidence
    const confBase = sigIdx === 0 ? 82 : sigIdx === 1 ? 68 : 52;
    const confidence = parseFloat((confBase + seededRandom(seed * 53) * 13).toFixed(1));

    return {
      rank: rank + 1,
      symbol: item.sym,
      name: item.name,
      optionType,
      strikePrice,
      expiry,
      currentPrice: premium,
      buyBelow,
      sellAbove,
      stopLoss,
      underlyingPrice,
      signal,
      changePercent,
      change,
      volume: Math.floor(seededRandom(seed * 43) * 2000000 + 50000),
      openInterest: oi,
      oiTrend,
      confidence,
      impliedVolatility: iv,
      rationale,
      updatedAt: now,
    };
  });
}
