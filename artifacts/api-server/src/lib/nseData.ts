// NSE India Stock Market Data Simulation
// All prices are in Indian Rupees (₹)

export interface NseStockMeta {
  name: string;
  sector: string;
  basePrice: number;
  marketCap: number; // in crores
  pe: number;
}

export const NSE_STOCKS: Record<string, NseStockMeta> = {
  RELIANCE: { name: "Reliance Industries", sector: "Energy", basePrice: 2948.5, marketCap: 19954820, pe: 27.3 },
  TCS: { name: "Tata Consultancy Services", sector: "IT", basePrice: 3842.3, marketCap: 13942680, pe: 31.2 },
  HDFCBANK: { name: "HDFC Bank", sector: "Banking", basePrice: 1642.8, marketCap: 12489340, pe: 18.7 },
  BHARTIARTL: { name: "Bharti Airtel", sector: "Telecom", basePrice: 1532.4, marketCap: 9154230, pe: 78.4 },
  ICICIBANK: { name: "ICICI Bank", sector: "Banking", basePrice: 1298.6, marketCap: 9148920, pe: 18.2 },
  INFY: { name: "Infosys", sector: "IT", basePrice: 1874.2, marketCap: 7782340, pe: 26.4 },
  SBIN: { name: "State Bank of India", sector: "Banking", basePrice: 812.4, marketCap: 7254810, pe: 10.8 },
  HINDUNILVR: { name: "Hindustan Unilever", sector: "FMCG", basePrice: 2284.7, marketCap: 5361820, pe: 52.3 },
  ITC: { name: "ITC Limited", sector: "FMCG", basePrice: 468.3, marketCap: 5842760, pe: 27.8 },
  LT: { name: "Larsen & Toubro", sector: "Infrastructure", basePrice: 3612.8, marketCap: 5218940, pe: 34.6 },
  KOTAKBANK: { name: "Kotak Mahindra Bank", sector: "Banking", basePrice: 1842.6, marketCap: 3671250, pe: 22.4 },
  AXISBANK: { name: "Axis Bank", sector: "Banking", basePrice: 1142.8, marketCap: 3524160, pe: 14.2 },
  BAJFINANCE: { name: "Bajaj Finance", sector: "NBFC", basePrice: 6892.4, marketCap: 4154820, pe: 28.4 },
  ASIANPAINT: { name: "Asian Paints", sector: "FMCG", basePrice: 2682.4, marketCap: 2567840, pe: 52.4 },
  MARUTI: { name: "Maruti Suzuki India", sector: "Auto", basePrice: 12842.6, marketCap: 3874210, pe: 26.8 },
  WIPRO: { name: "Wipro", sector: "IT", basePrice: 492.8, marketCap: 2574830, pe: 22.4 },
  HCLTECH: { name: "HCL Technologies", sector: "IT", basePrice: 1682.4, marketCap: 4567230, pe: 26.7 },
  SUNPHARMA: { name: "Sun Pharmaceutical", sector: "Pharma", basePrice: 1742.6, marketCap: 4187540, pe: 38.2 },
  TATAMOTORS: { name: "Tata Motors", sector: "Auto", basePrice: 982.4, marketCap: 3621480, pe: 8.4 },
  NTPC: { name: "NTPC Limited", sector: "Power", basePrice: 362.8, marketCap: 3514720, pe: 18.2 },
  POWERGRID: { name: "Power Grid Corp.", sector: "Power", basePrice: 312.4, marketCap: 2901840, pe: 17.4 },
  ULTRACEMCO: { name: "UltraTech Cement", sector: "Cement", basePrice: 10842.6, marketCap: 3128470, pe: 42.8 },
  TITAN: { name: "Titan Company", sector: "Consumer", basePrice: 3542.8, marketCap: 3148720, pe: 84.2 },
  INDUSINDBK: { name: "IndusInd Bank", sector: "Banking", basePrice: 982.4, marketCap: 768420, pe: 10.2 },
  JSWSTEEL: { name: "JSW Steel", sector: "Metals", basePrice: 912.4, marketCap: 2248390, pe: 14.2 },
  TATASTEEL: { name: "Tata Steel", sector: "Metals", basePrice: 168.2, marketCap: 2114730, pe: 12.4 },
  ADANIENT: { name: "Adani Enterprises", sector: "Conglomerate", basePrice: 2842.6, marketCap: 3241870, pe: 78.4 },
  ADANIPORTS: { name: "Adani Ports & SEZ", sector: "Infrastructure", basePrice: 1342.8, marketCap: 2891240, pe: 28.4 },
  BAJAJFINSV: { name: "Bajaj Finserv", sector: "NBFC", basePrice: 1842.6, marketCap: 2941280, pe: 22.4 },
  DRREDDY: { name: "Dr. Reddy's Labs", sector: "Pharma", basePrice: 6842.8, marketCap: 1141820, pe: 18.2 },
  CIPLA: { name: "Cipla Limited", sector: "Pharma", basePrice: 1542.6, marketCap: 1241840, pe: 28.4 },
  HINDALCO: { name: "Hindalco Industries", sector: "Metals", basePrice: 712.4, marketCap: 1601840, pe: 12.4 },
  ONGC: { name: "Oil & Natural Gas Corp.", sector: "Energy", basePrice: 284.2, marketCap: 3571840, pe: 8.2 },
  COALINDIA: { name: "Coal India", sector: "Energy", basePrice: 482.6, marketCap: 2981420, pe: 7.4 },
  BPCL: { name: "Bharat Petroleum Corp.", sector: "Energy", basePrice: 312.4, marketCap: 1351820, pe: 7.8 },
  EICHERMOT: { name: "Eicher Motors", sector: "Auto", basePrice: 4842.6, marketCap: 1328420, pe: 34.2 },
  HEROMOTOCO: { name: "Hero MotoCorp", sector: "Auto", basePrice: 4712.4, marketCap: 941820, pe: 22.4 },
  M_M: { name: "Mahindra & Mahindra", sector: "Auto", basePrice: 2842.8, marketCap: 3521840, pe: 28.4 },
  BAJAJ_AUTO: { name: "Bajaj Auto", sector: "Auto", basePrice: 9842.6, marketCap: 2841720, pe: 34.2 },
  NESTLEIND: { name: "Nestle India", sector: "FMCG", basePrice: 2284.6, marketCap: 2201840, pe: 68.4 },
  BRITANNIA: { name: "Britannia Industries", sector: "FMCG", basePrice: 5384.2, marketCap: 1281420, pe: 52.4 },
  PIDILITIND: { name: "Pidilite Industries", sector: "Chemicals", basePrice: 2842.4, marketCap: 1441820, pe: 84.2 },
  GRASIM: { name: "Grasim Industries", sector: "Cement", basePrice: 2742.6, marketCap: 1841720, pe: 22.4 },
  TECHM: { name: "Tech Mahindra", sector: "IT", basePrice: 1842.4, marketCap: 1801820, pe: 42.8 },
  APOLLOHOSP: { name: "Apollo Hospitals", sector: "Healthcare", basePrice: 6842.6, marketCap: 984120, pe: 84.2 },
  DMART: { name: "Avenue Supermarts (DMart)", sector: "Retail", basePrice: 4284.2, marketCap: 2781420, pe: 94.2 },
  GODREJCP: { name: "Godrej Consumer Products", sector: "FMCG", basePrice: 1284.2, marketCap: 1318420, pe: 58.4 },
  HAVELLS: { name: "Havells India", sector: "Consumer Elec.", basePrice: 1742.6, marketCap: 1098420, pe: 72.4 },
  TATACONSUM: { name: "Tata Consumer Products", sector: "FMCG", basePrice: 1242.6, marketCap: 1148420, pe: 82.4 },
};

export function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export function getDailySeed(): number {
  const now = new Date();
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

export function getHourlySeed(): number {
  const now = new Date();
  return getDailySeed() * 100 + now.getHours();
}

export function symbolSeed(symbol: string): number {
  return symbol.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

export function getNseQuote(symbol: string) {
  const stock = NSE_STOCKS[symbol];
  if (!stock) return null;

  const seed = getHourlySeed();
  const ss = symbolSeed(symbol);
  const variation = (seededRandom(seed + ss * 7) - 0.5) * 0.04;
  const price = parseFloat((stock.basePrice * (1 + variation)).toFixed(2));
  const prevVariation = (seededRandom(seed - 1 + ss * 7) - 0.5) * 0.04;
  const previousClose = parseFloat((stock.basePrice * (1 + prevVariation)).toFixed(2));
  const change = parseFloat((price - previousClose).toFixed(2));
  const changePercent = parseFloat(((change / previousClose) * 100).toFixed(2));
  const r = seededRandom(seed + ss * 13);

  return {
    symbol,
    name: stock.name,
    price,
    change,
    changePercent,
    open: parseFloat((previousClose * (1 + (seededRandom(seed * 3 + ss) - 0.5) * 0.01)).toFixed(2)),
    high: parseFloat((price * (1 + r * 0.015)).toFixed(2)),
    low: parseFloat((price * (1 - r * 0.015)).toFixed(2)),
    previousClose,
    volume: Math.floor(seededRandom(seed + ss * 17) * 5000000 + 100000),
    marketCap: stock.marketCap,
    sector: stock.sector,
    pe: stock.pe,
    week52High: parseFloat((stock.basePrice * 1.4).toFixed(2)),
    week52Low: parseFloat((stock.basePrice * 0.6).toFixed(2)),
  };
}

export function getNseHistory(symbol: string, period: string) {
  const stock = NSE_STOCKS[symbol];
  if (!stock) return [];

  const now = new Date();
  const data = [];

  let numPoints: number;
  let intervalMs: number;

  switch (period) {
    case "1D": numPoints = 75; intervalMs = 5 * 60 * 1000; break;
    case "1W": numPoints = 5 * 75; intervalMs = 5 * 60 * 1000; break;
    case "1M": numPoints = 22; intervalMs = 24 * 60 * 60 * 1000; break;
    case "3M": numPoints = 66; intervalMs = 24 * 60 * 60 * 1000; break;
    case "6M": numPoints = 132; intervalMs = 24 * 60 * 60 * 1000; break;
    case "1Y": numPoints = 252; intervalMs = 24 * 60 * 60 * 1000; break;
    default: numPoints = 22; intervalMs = 24 * 60 * 60 * 1000;
  }

  const ss = symbolSeed(symbol);
  let price = stock.basePrice;
  for (let i = numPoints - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * intervalMs);
    const seed = Math.floor(timestamp.getTime() / intervalMs) + ss * 1000;
    const movement = (seededRandom(seed) - 0.485) * 0.022;
    price = Math.max(price * (1 + movement), 1);
    const open = price;
    const closeMod = (seededRandom(seed * 7) - 0.5) * 0.01;
    const close = parseFloat((price * (1 + closeMod)).toFixed(2));
    const hMod = seededRandom(seed * 3) * 0.012;
    const lMod = seededRandom(seed * 5) * 0.012;
    data.push({
      timestamp: timestamp.toISOString(),
      open: parseFloat(open.toFixed(2)),
      high: parseFloat((Math.max(open, close) * (1 + hMod)).toFixed(2)),
      low: parseFloat((Math.min(open, close) * (1 - lMod)).toFixed(2)),
      close,
      volume: Math.floor(seededRandom(seed * 11) * 3000000 + 100000),
    });
  }
  return data;
}

// Gift Nifty (SGX/GIFT City Nifty Futures)
const GIFT_NIFTY_BASE = 23284.5;

export function getGiftNiftyQuote() {
  const seed = getHourlySeed();
  const variation = (seededRandom(seed * 3) - 0.49) * 0.02;
  const price = parseFloat((GIFT_NIFTY_BASE * (1 + variation)).toFixed(2));

  const prevVariation = (seededRandom((seed - 1) * 3) - 0.49) * 0.02;
  const yesterdayClose = parseFloat((GIFT_NIFTY_BASE * (1 + prevVariation)).toFixed(2));

  const yHigh = parseFloat((yesterdayClose * (1 + seededRandom(seed * 7) * 0.012)).toFixed(2));
  const yLow = parseFloat((yesterdayClose * (1 - seededRandom(seed * 11) * 0.012)).toFixed(2));

  const change = parseFloat((price - yesterdayClose).toFixed(2));
  const changePercent = parseFloat(((change / yesterdayClose) * 100).toFixed(2));

  const r = seededRandom(seed * 13);
  return {
    symbol: "GIFT NIFTY",
    name: "GIFT Nifty 50 Futures",
    price,
    change,
    changePercent,
    yesterdayHigh: yHigh,
    yesterdayLow: yLow,
    yesterdayClose,
    open: parseFloat((yesterdayClose * (1 + (seededRandom(seed * 5) - 0.5) * 0.008)).toFixed(2)),
    high: parseFloat((price * (1 + r * 0.008)).toFixed(2)),
    low: parseFloat((price * (1 - r * 0.008)).toFixed(2)),
    volume: Math.floor(seededRandom(seed * 17) * 500000 + 50000),
    updatedAt: new Date().toISOString(),
  };
}

export function getGiftNiftyHistory(period: string) {
  const now = new Date();
  const data = [];
  let numPoints: number;
  let intervalMs: number;

  switch (period) {
    case "1M": numPoints = 22; intervalMs = 24 * 60 * 60 * 1000; break;
    case "3M": numPoints = 66; intervalMs = 24 * 60 * 60 * 1000; break;
    case "6M": numPoints = 132; intervalMs = 24 * 60 * 60 * 1000; break;
    default: numPoints = 66; intervalMs = 24 * 60 * 60 * 1000;
  }

  let price = GIFT_NIFTY_BASE;
  for (let i = numPoints - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * intervalMs);
    const seed = Math.floor(timestamp.getTime() / intervalMs) + 9999;
    const movement = (seededRandom(seed) - 0.485) * 0.018;
    price = Math.max(price * (1 + movement), 1000);
    const open = price;
    const closeMod = (seededRandom(seed * 7) - 0.5) * 0.008;
    const close = parseFloat((price * (1 + closeMod)).toFixed(2));
    const hMod = seededRandom(seed * 3) * 0.008;
    const lMod = seededRandom(seed * 5) * 0.008;
    data.push({
      timestamp: timestamp.toISOString(),
      open: parseFloat(open.toFixed(2)),
      high: parseFloat((Math.max(open, close) * (1 + hMod)).toFixed(2)),
      low: parseFloat((Math.min(open, close) * (1 - lMod)).toFixed(2)),
      close,
      volume: Math.floor(seededRandom(seed * 11) * 200000 + 20000),
    });
  }
  return data;
}

// NSE Sector Indices
const NSE_SECTORS = [
  { sector: "Banking", index: "NIFTY BANK", baseValue: 48234.6, advBase: 18, declBase: 14 },
  { sector: "IT", index: "NIFTY IT", baseValue: 38124.8, advBase: 8, declBase: 2 },
  { sector: "Auto", index: "NIFTY AUTO", baseValue: 21842.4, advBase: 10, declBase: 5 },
  { sector: "Pharma", index: "NIFTY PHARMA", baseValue: 19284.6, advBase: 12, declBase: 8 },
  { sector: "FMCG", index: "NIFTY FMCG", baseValue: 56284.8, advBase: 9, declBase: 6 },
  { sector: "Metals", index: "NIFTY METAL", baseValue: 9284.2, advBase: 8, declBase: 7 },
  { sector: "Realty", index: "NIFTY REALTY", baseValue: 1024.6, advBase: 7, declBase: 3 },
  { sector: "Energy", index: "NIFTY ENERGY", baseValue: 42184.8, advBase: 6, declBase: 4 },
  { sector: "Infrastructure", index: "NIFTY INFRA", baseValue: 8284.4, advBase: 15, declBase: 10 },
  { sector: "Media", index: "NIFTY MEDIA", baseValue: 1842.4, advBase: 5, declBase: 7 },
  { sector: "PSU Banks", index: "NIFTY PSU BANK", baseValue: 7184.6, advBase: 9, declBase: 3 },
  { sector: "Financial Services", index: "NIFTY FIN SERVICE", baseValue: 21284.4, advBase: 14, declBase: 7 },
];

export function getNseSectors() {
  const seed = getDailySeed();
  return NSE_SECTORS.map((s, i) => {
    const r = seededRandom(seed + i * 41);
    const changePercent = parseFloat(((r - 0.47) * 5).toFixed(2));
    const value = parseFloat((s.baseValue * (1 + changePercent / 100)).toFixed(2));
    const change = parseFloat((value - s.baseValue).toFixed(2));
    const advancers = Math.floor(s.advBase + seededRandom(seed + i * 13) * 4);
    const decliners = Math.floor(s.declBase + seededRandom(seed + i * 17) * 4);
    return {
      sector: s.sector,
      index: s.index,
      changePercent,
      change,
      value,
      advancers,
      decliners,
    };
  });
}

export function getNseMovers() {
  const allSymbols = Object.keys(NSE_STOCKS);
  const quotes = allSymbols.map(getNseQuote).filter(Boolean) as ReturnType<typeof getNseQuote>[];
  const sorted = [...quotes].sort((a, b) => b!.changePercent - a!.changePercent);
  return {
    gainers: sorted.slice(0, 10),
    losers: sorted.slice(-10).reverse(),
    timestamp: new Date().toISOString(),
  };
}

// VWAP and RSI calculation from simulated intraday data
export function calculateIndicators(symbol: string) {
  const stock = NSE_STOCKS[symbol];
  if (!stock) return null;

  const now = new Date();
  const ss = symbolSeed(symbol);
  const seed = getDailySeed();

  // Generate 30 days of daily OHLCV for RSI (need 14+ periods)
  const history: Array<{ timestamp: string; close: number; vwap: number; rsi: number; volume: number }> = [];

  let price = stock.basePrice;
  const dayData: Array<{ close: number; high: number; low: number; volume: number }> = [];

  for (let i = 30; i >= 0; i--) {
    const daySeed = (seed - i) + ss * 100;
    const movement = (seededRandom(daySeed) - 0.485) * 0.025;
    price = Math.max(price * (1 + movement), 1);
    const closeMod = (seededRandom(daySeed * 7) - 0.5) * 0.01;
    const close = parseFloat((price * (1 + closeMod)).toFixed(2));
    const vol = Math.floor(seededRandom(daySeed * 11) * 3000000 + 100000);
    dayData.push({
      close,
      high: parseFloat((close * (1 + seededRandom(daySeed * 3) * 0.012)).toFixed(2)),
      low: parseFloat((close * (1 - seededRandom(daySeed * 5) * 0.012)).toFixed(2)),
      volume: vol,
    });
  }

  // Calculate RSI (14-period)
  function calcRSI(closes: number[], period = 14): number[] {
    const rsiValues: number[] = new Array(period).fill(50);
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
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsiValues.push(parseFloat((100 - 100 / (1 + rs)).toFixed(2)));
    }
    return rsiValues;
  }

  const closes = dayData.map(d => d.close);
  const rsiArr = calcRSI(closes);

  // VWAP: cumulative (price * volume) / cumulative volume using last 20 candles
  let cumPV = 0;
  let cumVol = 0;
  const vwapPoints: number[] = [];
  for (const d of dayData) {
    const typicalPrice = (d.high + d.low + d.close) / 3;
    cumPV += typicalPrice * d.volume;
    cumVol += d.volume;
    vwapPoints.push(parseFloat((cumPV / cumVol).toFixed(2)));
  }

  const currentClose = closes[closes.length - 1];
  const currentVwap = vwapPoints[vwapPoints.length - 1];
  const currentRsi = rsiArr[rsiArr.length - 1];
  const vwapDeviation = parseFloat((((currentClose - currentVwap) / currentVwap) * 100).toFixed(2));

  for (let i = 0; i < dayData.length; i++) {
    const d = dayData[i];
    const tsOffset = (30 - i) * 24 * 60 * 60 * 1000;
    history.push({
      timestamp: new Date(now.getTime() - tsOffset).toISOString(),
      close: d.close,
      vwap: vwapPoints[i],
      rsi: rsiArr[i] ?? 50,
      volume: d.volume,
    });
  }

  const vwapSignal: "ABOVE" | "BELOW" | "AT" =
    Math.abs(vwapDeviation) < 0.1 ? "AT" : currentClose > currentVwap ? "ABOVE" : "BELOW";

  const smartMoneyFlow: "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL" =
    vwapSignal === "ABOVE" && currentRsi > 50
      ? "ACCUMULATION"
      : vwapSignal === "BELOW" && currentRsi < 50
      ? "DISTRIBUTION"
      : "NEUTRAL";

  const rsiSignal: "OVERBOUGHT" | "NEUTRAL" | "OVERSOLD" =
    currentRsi >= 70 ? "OVERBOUGHT" : currentRsi <= 30 ? "OVERSOLD" : "NEUTRAL";

  const momentum: "STRONG_UP" | "UP" | "NEUTRAL" | "DOWN" | "STRONG_DOWN" =
    currentRsi >= 75 ? "STRONG_UP"
    : currentRsi >= 60 ? "UP"
    : currentRsi >= 40 ? "NEUTRAL"
    : currentRsi >= 25 ? "DOWN"
    : "STRONG_DOWN";

  return {
    symbol,
    price: currentClose,
    vwap: currentVwap,
    vwapSignal,
    vwapDeviation,
    rsi: currentRsi,
    rsiSignal,
    smartMoneyFlow,
    momentum,
    history: history.slice(-20),
    updatedAt: now.toISOString(),
  };
}
