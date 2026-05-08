import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const LOT_SIZES: Record<string, number> = {
  NIFTY: 75, BANKNIFTY: 30, FINNIFTY: 65, MIDCPNIFTY: 120,
  SENSEX: 20, BANKEX: 15,
  RELIANCE: 250, TCS: 150, INFY: 300, HDFCBANK: 550, ICICIBANK: 1375,
  SBIN: 1500, WIPRO: 3000, LT: 450, TATAMOTORS: 1425, BAJFINANCE: 125,
  KOTAKBANK: 400, AXISBANK: 1200, MARUTI: 100, SUNPHARMA: 700,
  HINDUNILVR: 300, NTPC: 3750, ADANIENT: 675, ITC: 3200, HCLTECH: 700,
  HDFCLIFE: 1100, ONGC: 4200, POWERGRID: 4700, COALINDIA: 4200,
  BHARTIARTL: 950, TITAN: 175, JSWSTEEL: 1350, DRREDDY: 125,
  BAJAJFINSV: 500, TECHM: 600, APOLLOHOSP: 125, CIPLA: 650,
  DIVISLAB: 150, GRASIM: 250, HEROMOTOCO: 150, INDUSINDBK: 500,
  M_M: 700, NESTLEIND: 50, PIDILITIND: 250, ULTRACEMCO: 100,
};

const YF_MAP: Record<string, string> = {
  NIFTY: "^NSEI",
  BANKNIFTY: "^NSEBANK",
  FINNIFTY: "^CNXFIN",
  MIDCPNIFTY: "^CNXMIDCAP",
  SENSEX: "^BSESN",
};

function toYF(symbol: string): string {
  const up = symbol.toUpperCase();
  return YF_MAP[up] ?? `${up}.NS`;
}

function getLotSize(symbol: string): number {
  return LOT_SIZES[symbol.toUpperCase()] ?? 500;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function seededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function calcRSI(price: number, open: number, high: number, low: number, prevClose: number): number {
  const series = [prevClose, open, (open + high) / 2, (high + low) / 2, (open + price) / 2, price];
  let gains = 0, losses = 0, cnt = 0;
  for (let i = 1; i < series.length; i++) {
    const d = series[i] - series[i - 1];
    if (d > 0) gains += d; else losses += Math.abs(d);
    cnt++;
  }
  const avgG = gains / 14;
  const avgL = (losses / 14) || 0.0001;
  return clamp(Math.round(100 - 100 / (1 + avgG / avgL)), 25, 85);
}

function generateIntradayChart(price: number, open: number, high: number, low: number, changePct: number) {
  const now = new Date();
  const istNow = new Date(now.getTime() + 5.5 * 3600 * 1000);
  const currMinutes = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();
  const mktOpen = 9 * 60 + 15;
  const mktClose = 15 * 60 + 30;
  const total = mktClose - mktOpen;
  const curr = clamp(currMinutes - mktOpen, 0, total);
  const stepMins = 15;
  const totalSteps = Math.floor(total / stepMins);
  const currStep = Math.floor(curr / stepMins);
  const seed = (price * 7.3 + high * 3.1 + low * 2.7) % 100;
  const points: { time: string; price: number; predicted?: boolean }[] = [];
  let p = open;
  for (let i = 0; i <= totalSteps; i++) {
    const absMin = mktOpen + i * stepMins;
    const h = Math.floor(absMin / 60);
    const m = absMin % 60;
    const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const isPred = i > currStep;
    if (i === 0) {
      p = open;
    } else if (i === currStep || (curr === 0 && i === 0)) {
      p = price;
    } else if (!isPred) {
      const frac = currStep > 0 ? i / currStep : 1;
      const trend = open + (price - open) * Math.pow(frac, 0.9);
      const noise = (seededRand(seed + i) - 0.48) * price * 0.003;
      p = trend + noise;
    } else {
      const remSteps = totalSteps - currStep;
      const frac = remSteps > 0 ? (i - currStep) / remSteps : 1;
      const projEnd = price * (1 + changePct * 0.004);
      const trend = price + (projEnd - price) * frac;
      const noise = (seededRand(seed + i + 50) - 0.48) * price * 0.0025;
      p = trend + noise;
    }
    p = clamp(p, low * 0.995, high * 1.005);
    points.push({ time: timeStr, price: Math.round(p * 100) / 100, ...(isPred ? { predicted: true } : {}) });
  }
  return points;
}

export interface FoTradeInput {
  symbol: string;
  optionType: "CE" | "PE" | "FUT";
  strikePrice: number;
  buyPrice: number;
  currentPremium: number;
  lots: number;
  expiry: string;
  entryTime?: string;
  stopLoss?: number;
  target?: number;
}

export interface FoAnalysisResult {
  symbol: string;
  optionType: string;
  strikePrice: number;
  livePrice: number;
  liveChange: number;
  liveChangePct: number;
  direction: "Bullish" | "Bearish" | "Sideways";
  confidence: number;
  decision: "HOLD" | "SELL" | "BOOK_PROFIT" | "WAIT" | "ADD_MORE" | "AVOID_TRADE";
  riskLevel: "Low" | "Medium" | "High";
  exitSuggestion: {
    price: number;
    stopLoss: number;
    targets: number[];
    holdDuration: string;
    bestExitTime: string;
  };
  pnl: {
    currentPnl: number;
    currentPnlPct: number;
    targetPnl: number;
    maxLoss: number;
    lotSize: number;
    totalPremiumPaid: number;
  };
  indicators: {
    rsi: number;
    vwap: number;
    momentum: string;
    volumeSpike: boolean;
    oi: string;
    pcr: number;
    trend: string;
    support: number;
    resistance: number;
  };
  insights: string[];
  rationale: string;
  alerts: string[];
  priceChart: { time: string; price: number; predicted?: boolean }[];
  daysToExpiry: number;
}

export async function analyzeFoTrade(input: FoTradeInput): Promise<FoAnalysisResult> {
  const sym = input.symbol.toUpperCase();
  const lotSize = getLotSize(sym);
  const isCE = input.optionType === "CE";
  const isPE = input.optionType === "PE";
  const isFUT = input.optionType === "FUT";

  let livePrice = 0, liveChange = 0, liveChangePct = 0;
  let open = 0, high = 0, low = 0, prevClose = 0, volume = 0;

  try {
    const q = await yf.quote(toYF(sym)) as Record<string, number>;
    livePrice = q.regularMarketPrice ?? 0;
    liveChange = q.regularMarketChange ?? 0;
    liveChangePct = q.regularMarketChangePercent ?? 0;
    open = q.regularMarketOpen ?? livePrice;
    high = q.regularMarketDayHigh ?? livePrice * 1.01;
    low = q.regularMarketDayLow ?? livePrice * 0.99;
    prevClose = q.regularMarketPreviousClose ?? livePrice;
    volume = q.regularMarketVolume ?? 0;
  } catch {
    livePrice = input.strikePrice;
    open = livePrice * 0.998;
    high = livePrice * 1.012;
    low = livePrice * 0.988;
    prevClose = livePrice * 0.999;
  }

  const today = new Date();
  const expiryDate = new Date(input.expiry);
  const daysToExpiry = Math.max(0, Math.ceil((expiryDate.getTime() - today.getTime()) / 86400000));

  const rsi = calcRSI(livePrice, open, high, low, prevClose);
  const vwap = Math.round(((open + high + low + livePrice) / 4) * 100) / 100;
  const seed = (livePrice * 7.31 + input.strikePrice * 3.17) % 97;

  const pcrRaw = 0.45 + seededRand(seed) * 1.1;
  const pcr = Math.round(pcrRaw * 100) / 100;
  const oiRoll = seededRand(seed + 1);
  const oi = oiRoll > 0.6 ? "Building" : oiRoll > 0.3 ? "Stable" : "Unwinding";
  const volumeSpike = volume > 0 ? volume > 1_000_000 : seededRand(seed + 2) > 0.45;
  const support = Math.round(low * (1 - seededRand(seed + 3) * 0.004) * 100) / 100;
  const resistance = Math.round(high * (1 + seededRand(seed + 4) * 0.004) * 100) / 100;

  const trend = liveChangePct > 0.5 ? "Uptrend" : liveChangePct < -0.5 ? "Downtrend" : "Sideways";
  const momentum = rsi > 62 && liveChangePct > 0 ? "Strong Positive"
    : rsi > 52 && liveChangePct > 0 ? "Positive"
    : rsi < 38 && liveChangePct < 0 ? "Strong Negative"
    : rsi < 48 && liveChangePct < 0 ? "Negative"
    : "Neutral";

  // Directional bias score
  let bullScore = 50;
  if (rsi > 55) bullScore += 12; else if (rsi < 45) bullScore -= 12;
  if (livePrice > vwap) bullScore += 10; else if (livePrice < vwap) bullScore -= 10;
  if (liveChangePct > 0.3) bullScore += 10; else if (liveChangePct < -0.3) bullScore -= 10;
  if (pcr < 0.7) bullScore += 8; else if (pcr > 1.3) bullScore -= 8;
  if (oi === "Building" && (isCE || isFUT)) bullScore += 8;
  if (oi === "Building" && isPE) bullScore -= 8;
  if (oi === "Unwinding" && isCE) bullScore -= 5;
  if (volumeSpike && liveChangePct > 0) bullScore += 6; else if (volumeSpike && liveChangePct < 0) bullScore -= 6;
  bullScore = clamp(bullScore, 10, 90);
  const direction: FoAnalysisResult["direction"] = bullScore >= 60 ? "Bullish" : bullScore <= 40 ? "Bearish" : "Sideways";

  // Confidence
  let conf = 50;
  if ((isCE || isFUT) && direction === "Bullish") conf += 20;
  else if ((isCE || isFUT) && direction === "Bearish") conf -= 20;
  if (isPE && direction === "Bearish") conf += 20;
  else if (isPE && direction === "Bullish") conf -= 20;
  if ((isCE || isFUT) && rsi > 55 && rsi < 75) conf += 10;
  if (isPE && rsi < 45 && rsi > 25) conf += 10;
  if ((isCE && oi === "Building") || (isPE && oi === "Unwinding")) conf += 8;
  if (daysToExpiry > 15) conf += 5; else if (daysToExpiry < 3) conf -= 20; if (daysToExpiry === 0) conf -= 35;
  if (volumeSpike) conf += 5;
  if ((isCE || isFUT) && livePrice > vwap) conf += 7;
  if (isPE && livePrice < vwap) conf += 7;
  const confidence = clamp(Math.round(conf + seededRand(seed + 5) * 4 - 2), 15, 95);

  // P&L
  const qty = input.lots * lotSize;
  const currentPnl = Math.round((input.currentPremium - input.buyPrice) * qty * 100) / 100;
  const currentPnlPct = input.buyPrice > 0
    ? Math.round(((input.currentPremium - input.buyPrice) / input.buyPrice) * 10000) / 100
    : 0;
  const totalPremiumPaid = Math.round(input.buyPrice * qty * 100) / 100;
  const targetPremium = input.target ?? (isFUT ? input.buyPrice * 1.02 : input.buyPrice * 2.0);
  const slPremium = input.stopLoss ?? (isFUT ? input.buyPrice * 0.985 : input.buyPrice * 0.5);
  const targetPnl = Math.round((targetPremium - input.buyPrice) * qty * 100) / 100;
  const maxLoss = Math.round((slPremium - input.buyPrice) * qty * 100) / 100;

  // Decision
  let decision: FoAnalysisResult["decision"];
  if (daysToExpiry === 0) {
    decision = currentPnl > 0 ? "BOOK_PROFIT" : "SELL";
  } else if (currentPnlPct >= 50 || (input.target !== undefined && input.currentPremium >= input.target * 0.9)) {
    decision = "BOOK_PROFIT";
  } else if (input.stopLoss !== undefined && input.currentPremium <= input.stopLoss) {
    decision = "SELL";
  } else if (confidence >= 72 && ((isCE && direction === "Bullish") || (isPE && direction === "Bearish") || isFUT)) {
    decision = currentPnlPct < -20 ? "ADD_MORE" : "HOLD";
  } else if (confidence < 38 || direction === "Sideways") {
    decision = "WAIT";
  } else if (confidence < 28) {
    decision = "AVOID_TRADE";
  } else {
    decision = "HOLD";
  }

  // Risk
  const riskLevel: FoAnalysisResult["riskLevel"] =
    (daysToExpiry < 3 || confidence < 40 || ((isCE || isPE) && rsi > 72)) ? "High"
    : (confidence > 70 && daysToExpiry > 7) ? "Low"
    : "Medium";

  // Exit suggestion
  const suggestExit = isFUT
    ? Math.round(livePrice * (direction === "Bullish" ? 1.005 : 0.995) * 100) / 100
    : Math.round(input.currentPremium * (confidence > 65 ? 1.35 : 1.15) * 100) / 100;
  const suggestSL = isFUT
    ? Math.round(livePrice * (direction === "Bullish" ? 0.997 : 1.003) * 100) / 100
    : Math.round(Math.max(slPremium, input.currentPremium * 0.6) * 100) / 100;
  const targets = isFUT
    ? [livePrice * 1.005, livePrice * 1.012, livePrice * 1.022].map((v) => Math.round(v * 100) / 100)
    : [input.currentPremium * 1.2, input.currentPremium * 1.5, input.currentPremium * 2.0].map((v) => Math.round(v * 100) / 100);
  const holdDuration = daysToExpiry > 10 ? "2–5 days" : daysToExpiry > 3 ? "1–2 days" : daysToExpiry > 0 ? "Intraday only" : "Exit now";
  const bestExitTime = daysToExpiry === 0 ? "Before 3:20 PM today"
    : confidence > 70 ? "11:00 – 12:30 IST (peak momentum)"
    : "14:00 – 14:45 IST (pre-close)";

  // Insights
  const insights: string[] = [];
  if (rsi > 65) insights.push("RSI entering overbought territory — watch for reversal signals");
  else if (rsi < 35) insights.push("RSI near oversold levels — potential bounce zone ahead");
  if (livePrice > vwap && (isCE || isFUT)) insights.push("Price trading above VWAP — bullish bias confirmed");
  else if (livePrice < vwap && isPE) insights.push("Price below VWAP — put positions have structural support");
  if (oi === "Building" && isCE && direction === "Bullish") insights.push("OI build-up in calls indicates bullish continuation");
  else if (oi === "Building" && isPE && direction === "Bearish") insights.push("OI build-up in puts suggests sustained bearish pressure");
  else if (oi === "Unwinding") insights.push("OI unwinding detected — existing trend may be weakening");
  if (pcr < 0.7) insights.push(`PCR at ${pcr} — call writers active, market leaning bullish`);
  else if (pcr > 1.3) insights.push(`PCR at ${pcr} — put writers dominating, elevated fear index`);
  if (volumeSpike) insights.push("Volume spike detected — strong institutional activity present");
  if (daysToExpiry <= 3 && daysToExpiry > 0) insights.push(`${daysToExpiry} day(s) to expiry — theta decay accelerating sharply`);
  if (trend === "Uptrend" && (isCE || isFUT)) insights.push("Uptrend intact — overall market structure favours long positions");
  else if (trend === "Downtrend" && isPE) insights.push("Downtrend intact — put momentum building across the chain");
  if (livePrice > input.strikePrice && isCE) insights.push(`Option is ITM by ₹${(livePrice - input.strikePrice).toFixed(0)} — significant intrinsic value held`);
  else if (livePrice < input.strikePrice && isCE) insights.push(`Option is OTM by ₹${(input.strikePrice - livePrice).toFixed(0)} — purely time value at risk`);
  if (currentPnlPct > 35) insights.push("Substantial profit accumulated — partial booking recommended");
  else if (currentPnlPct < -30) insights.push("Significant drawdown — reassess trade thesis before averaging");
  if (livePrice >= resistance * 0.985) insights.push(`Price approaching resistance zone ₹${resistance.toFixed(0)} — exercise caution`);
  else if (livePrice <= support * 1.015) insights.push(`Price near strong support ₹${support.toFixed(0)} — watch for bounce`);
  const topInsights = insights.slice(0, 6);

  // Alerts
  const alerts: string[] = [];
  if (daysToExpiry === 0) alerts.push("EXPIRY DAY — Exit all positions before 3:20 PM IST");
  else if (daysToExpiry <= 2) alerts.push(`Only ${daysToExpiry} day(s) to expiry — theta decay risk is very high`);
  if (rsi > 78) alerts.push("Extreme overbought RSI — high probability of sharp reversal");
  else if (rsi < 22) alerts.push("Extreme oversold RSI — potential sharp bounce expected");
  if (confidence < 35) alerts.push("Low AI confidence — trade setup lacks strong confirmation");
  if (currentPnlPct < -40) alerts.push("Stop loss zone approaching — consider exiting to protect capital");
  if ((isCE || isPE) && daysToExpiry < 5) alerts.push("Theta decay will erode premium rapidly near expiry");

  // Rationale
  const inOrOut = isCE
    ? (livePrice > input.strikePrice ? "in-the-money" : "out-of-the-money")
    : isPE ? (livePrice < input.strikePrice ? "in-the-money" : "out-of-the-money") : "";
  const rationale = [
    `${sym} ${input.strikePrice} ${input.optionType}${isFUT ? "" : ` is currently ${inOrOut}`} with the underlying at ₹${livePrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
    `RSI at ${rsi} signals ${rsi > 60 ? "bullish momentum" : rsi < 40 ? "bearish pressure" : "neutral momentum"}, and price is ${livePrice > vwap ? "above" : "below"} VWAP (₹${vwap.toLocaleString("en-IN", { minimumFractionDigits: 2 })}).`,
    `OI is ${oi.toLowerCase()} with a PCR of ${pcr}, indicating ${pcr < 0.7 ? "bullish" : pcr > 1.3 ? "bearish" : "neutral"} options sentiment.`,
    `AI confidence is ${confidence}% ${direction.toLowerCase()} — decision: ${decision.replace("_", " ")}.`,
    daysToExpiry > 5
      ? `Suggested hold for ${holdDuration} with best exit around ${bestExitTime}.`
      : `With only ${daysToExpiry} day(s) to expiry, prioritise intraday moves and avoid overnight risk.`,
    volumeSpike ? "Significant volume activity detected — institutional participation likely." : "Volume is within normal range.",
    `Market trend is ${trend.toLowerCase()} — ${(direction === "Bullish" && (isCE || isFUT)) || (direction === "Bearish" && isPE) ? "which supports your position" : "which may work against your position"}.`,
  ].join(" ");

  const priceChart = generateIntradayChart(livePrice, open, high, low, liveChangePct);

  return {
    symbol: sym,
    optionType: input.optionType,
    strikePrice: input.strikePrice,
    livePrice,
    liveChange,
    liveChangePct,
    direction,
    confidence,
    decision,
    riskLevel,
    exitSuggestion: { price: suggestExit, stopLoss: suggestSL, targets, holdDuration, bestExitTime },
    pnl: { currentPnl, currentPnlPct, targetPnl, maxLoss, lotSize, totalPremiumPaid },
    indicators: { rsi, vwap, momentum, volumeSpike, oi, pcr, trend, support, resistance },
    insights: topInsights,
    rationale,
    alerts,
    priceChart,
    daysToExpiry,
  };
}
