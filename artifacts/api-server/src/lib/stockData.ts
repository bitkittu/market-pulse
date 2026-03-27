export const STOCKS: Record<string, { name: string; sector: string; basePrice: number; marketCap: number; pe: number }> = {
  SPY: { name: "SPDR S&P 500 ETF", sector: "ETF", basePrice: 524.8, marketCap: 540000000000, pe: 24.1 },
  QQQ: { name: "Invesco QQQ Trust", sector: "ETF", basePrice: 448.3, marketCap: 250000000000, pe: 32.4 },
  IWM: { name: "iShares Russell 2000", sector: "ETF", basePrice: 208.6, marketCap: 73000000000, pe: 18.2 },
  AAPL: { name: "Apple Inc.", sector: "Technology", basePrice: 189.5, marketCap: 2950000000000, pe: 29.2 },
  MSFT: { name: "Microsoft Corp.", sector: "Technology", basePrice: 415.3, marketCap: 3080000000000, pe: 36.1 },
  GOOGL: { name: "Alphabet Inc.", sector: "Communication Services", basePrice: 171.2, marketCap: 2120000000000, pe: 24.8 },
  AMZN: { name: "Amazon.com Inc.", sector: "Consumer Discretionary", basePrice: 198.7, marketCap: 2090000000000, pe: 44.3 },
  TSLA: { name: "Tesla Inc.", sector: "Consumer Discretionary", basePrice: 248.9, marketCap: 793000000000, pe: 62.1 },
  META: { name: "Meta Platforms Inc.", sector: "Communication Services", basePrice: 523.6, marketCap: 1360000000000, pe: 27.4 },
  NVDA: { name: "NVIDIA Corp.", sector: "Technology", basePrice: 875.4, marketCap: 2160000000000, pe: 73.8 },
  NFLX: { name: "Netflix Inc.", sector: "Communication Services", basePrice: 628.3, marketCap: 270000000000, pe: 45.2 },
  JPM: { name: "JPMorgan Chase", sector: "Financial Services", basePrice: 198.4, marketCap: 569000000000, pe: 12.1 },
  JNJ: { name: "Johnson & Johnson", sector: "Healthcare", basePrice: 147.8, marketCap: 353000000000, pe: 15.3 },
  V: { name: "Visa Inc.", sector: "Financial Services", basePrice: 276.9, marketCap: 568000000000, pe: 31.4 },
  WMT: { name: "Walmart Inc.", sector: "Consumer Staples", basePrice: 68.2, marketCap: 548000000000, pe: 33.8 },
  XOM: { name: "Exxon Mobil Corp.", sector: "Energy", basePrice: 112.3, marketCap: 449000000000, pe: 14.2 },
  PFE: { name: "Pfizer Inc.", sector: "Healthcare", basePrice: 27.6, marketCap: 156000000000, pe: 18.7 },
  BAC: { name: "Bank of America", sector: "Financial Services", basePrice: 37.8, marketCap: 299000000000, pe: 13.4 },
  DIS: { name: "Walt Disney Co.", sector: "Communication Services", basePrice: 92.4, marketCap: 169000000000, pe: 21.6 },
  AMD: { name: "Advanced Micro Devices", sector: "Technology", basePrice: 163.7, marketCap: 265000000000, pe: 54.3 },
  INTC: { name: "Intel Corp.", sector: "Technology", basePrice: 31.2, marketCap: 132000000000, pe: 19.8 },
  PYPL: { name: "PayPal Holdings", sector: "Financial Services", basePrice: 62.8, marketCap: 67000000000, pe: 16.2 },
  SPOT: { name: "Spotify Technology", sector: "Communication Services", basePrice: 312.5, marketCap: 63000000000, pe: 89.4 },
};

export function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function getPrice(symbol: string, seed: number = 0): number {
  const stock = STOCKS[symbol];
  if (!stock) return 100;
  const variation = (seededRandom(seed + symbol.charCodeAt(0)) - 0.5) * 0.04;
  return parseFloat((stock.basePrice * (1 + variation)).toFixed(2));
}

export function getDailySeed(): number {
  const now = new Date();
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

export function getHourlySeed(): number {
  const now = new Date();
  return getDailySeed() * 100 + now.getHours();
}

export function getStockQuote(symbol: string) {
  const stock = STOCKS[symbol];
  if (!stock) return null;

  const seed = getHourlySeed();
  const price = getPrice(symbol, seed);
  const prevClose = getPrice(symbol, seed - 1);
  const change = parseFloat((price - prevClose).toFixed(2));
  const changePercent = parseFloat(((change / prevClose) * 100).toFixed(2));
  const r = seededRandom(seed + symbol.length * 7);

  return {
    symbol,
    name: stock.name,
    price,
    change,
    changePercent,
    volume: Math.floor(seededRandom(seed + symbol.charCodeAt(1) * 13) * 80000000 + 5000000),
    marketCap: stock.marketCap,
    high52w: parseFloat((stock.basePrice * 1.35).toFixed(2)),
    low52w: parseFloat((stock.basePrice * 0.65).toFixed(2)),
    pe: stock.pe,
    open: parseFloat((prevClose * (1 + (seededRandom(seed * 2 + symbol.charCodeAt(0)) - 0.5) * 0.02)).toFixed(2)),
    previousClose: prevClose,
    high: parseFloat((price * (1 + r * 0.02)).toFixed(2)),
    low: parseFloat((price * (1 - r * 0.02)).toFixed(2)),
    avgVolume: Math.floor(seededRandom(seed + symbol.charCodeAt(0) * 11) * 60000000 + 8000000),
    sector: stock.sector,
  };
}

export function generatePriceHistory(symbol: string, period: string) {
  const stock = STOCKS[symbol];
  if (!stock) return [];

  const now = new Date();
  const data = [];

  let numPoints: number;
  let intervalMs: number;

  switch (period) {
    case "1D":
      numPoints = 78; // market hours 9:30-16:00 in 5min intervals
      intervalMs = 5 * 60 * 1000;
      break;
    case "1W":
      numPoints = 5 * 78;
      intervalMs = 5 * 60 * 1000;
      break;
    case "1M":
      numPoints = 30;
      intervalMs = 24 * 60 * 60 * 1000;
      break;
    case "3M":
      numPoints = 90;
      intervalMs = 24 * 60 * 60 * 1000;
      break;
    case "6M":
      numPoints = 180;
      intervalMs = 24 * 60 * 60 * 1000;
      break;
    case "1Y":
      numPoints = 252;
      intervalMs = 24 * 60 * 60 * 1000;
      break;
    default:
      numPoints = 30;
      intervalMs = 24 * 60 * 60 * 1000;
  }

  let price = stock.basePrice;
  for (let i = numPoints - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * intervalMs);
    const seed = Math.floor(timestamp.getTime() / intervalMs) + symbol.charCodeAt(0) * 1000;
    const movement = (seededRandom(seed) - 0.485) * 0.025;
    price = Math.max(price * (1 + movement), 1);
    const open = price;
    const highMod = seededRandom(seed * 3) * 0.015;
    const lowMod = seededRandom(seed * 5) * 0.015;
    const close = parseFloat((price * (1 + (seededRandom(seed * 7) - 0.5) * 0.01)).toFixed(2));
    data.push({
      timestamp: timestamp.toISOString(),
      open: parseFloat(open.toFixed(2)),
      high: parseFloat((Math.max(open, close) * (1 + highMod)).toFixed(2)),
      low: parseFloat((Math.min(open, close) * (1 - lowMod)).toFixed(2)),
      close,
      volume: Math.floor(seededRandom(seed * 11) * 40000000 + 2000000),
    });
  }

  return data;
}

export const SECTORS = [
  "Technology",
  "Healthcare",
  "Financial Services",
  "Consumer Discretionary",
  "Communication Services",
  "Industrials",
  "Consumer Staples",
  "Energy",
  "Utilities",
  "Real Estate",
  "Materials",
];

export function getSectorPerformance() {
  const seed = getDailySeed();
  return SECTORS.map((sector, i) => {
    const r = seededRandom(seed + i * 37);
    const changePercent = parseFloat(((r - 0.48) * 6).toFixed(2));
    const baseMC = [8500, 3200, 4100, 2800, 3600, 2100, 1500, 1800, 800, 1200, 900][i] * 1e9;
    return {
      sector,
      change: parseFloat((changePercent * 0.5).toFixed(2)),
      changePercent,
      marketCap: baseMC,
    };
  });
}

export const AI_RECOMMENDATIONS = ["STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"] as const;
export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as const;

const BULLISH_POINTS: Record<string, string[]> = {
  AAPL: ["Strong iPhone upgrade cycle driving revenue growth", "Services segment growing 15% YoY", "Robust balance sheet with $160B+ cash", "AI integration in iOS creating new monetization opportunities"],
  MSFT: ["Azure cloud growth accelerating at 28% YoY", "Copilot AI integration boosting enterprise productivity suite sales", "Gaming segment expanded via Activision acquisition", "Strong dividend growth track record"],
  GOOGL: ["Search market dominance with 91% global share", "YouTube advertising revenue rebounding strongly", "Gemini AI competitive against OpenAI", "Waymo autonomous driving optionality"],
  AMZN: ["AWS cloud dominance with 32% market share", "Advertising business reaching $50B+ run rate", "Logistics network creating durable competitive moat", "Prime membership growth in international markets"],
  TSLA: ["Full Self-Driving progress ahead of competitors", "Energy storage business growing 100%+ YoY", "Gigafactory expansion reducing production costs", "Robotaxi optionality not priced in"],
  NVDA: ["Data center GPU demand far exceeds supply", "CUDA ecosystem lock-in creates durable moat", "AI training/inference market growing exponentially", "Blackwell architecture maintains performance lead"],
  META: ["Instagram Reels monetization closing gap with TikTok", "WhatsApp business messaging revenue accelerating", "Reality Labs headset gaining enterprise adoption", "AI-driven ad targeting improving ROAS for advertisers"],
  NFLX: ["Password sharing crackdown drove 30M+ new subscribers", "Ad-supported tier monetizing price-sensitive users", "Live events (sports) opening new revenue streams", "Strong content slate driving engagement"],
};

const BEARISH_POINTS: Record<string, string[]> = {
  AAPL: ["China market facing regulatory headwinds", "Antitrust pressure on App Store fees", "Hardware saturation limiting unit growth", "High valuation relative to growth rate"],
  MSFT: ["Premium valuation requires sustained execution", "AI infrastructure spending pressuring margins near term", "Azure growth decelerating vs prior year", "Enterprise budget scrutiny in uncertain macro"],
  GOOGL: ["Search disruption risk from AI chatbots", "Regulatory antitrust exposure in multiple jurisdictions", "YouTube ad revenue cyclical with macro", "Cloud still subscale vs AWS/Azure"],
  AMZN: ["Retail margin structurally below historical levels", "Heavy capex requirements for AI infrastructure", "Regulatory scrutiny on marketplace practices", "International markets slower to profitability"],
  TSLA: ["Increasing EV competition from legacy OEMs and Chinese brands", "Price cuts compressing automotive gross margins", "Execution risk on FSD timeline", "CEO distraction with other ventures"],
  NVDA: ["Supply chain concentrated, creating geopolitical risk", "Customer concentration in hyperscalers", "AMD and Intel closing performance gap", "China export restrictions limiting TAM"],
  META: ["Digital ad market cyclicality", "Regulatory risk in EU on data privacy", "Reality Labs losses weighing on profitability", "Teen engagement declining on core platform"],
  NFLX: ["Content cost inflation persisting", "Mature US market limiting domestic growth", "Competition from Disney+, Max, and Apple TV+", "Macro sensitivity of consumer spending on streaming"],
};

function getDefaultBullishPoints(symbol: string): string[] {
  return [
    "Strong revenue growth trajectory",
    "Improving operating margins",
    "Competitive positioning in growing market",
    "Management executing on strategic initiatives",
  ];
}

function getDefaultBearishPoints(symbol: string): string[] {
  return [
    "Elevated valuation multiples",
    "Macro uncertainty weighing on near-term outlook",
    "Competitive pressure intensifying",
    "Execution risk on new product launches",
  ];
}

export function getAiAnalysis(symbol: string, price: number) {
  const seed = getDailySeed() + symbol.charCodeAt(0) * 17;
  const r = seededRandom(seed);
  const recIndex = Math.floor(r * 5);
  const recommendation = AI_RECOMMENDATIONS[recIndex];
  const confidence = parseFloat((55 + seededRandom(seed * 3) * 40).toFixed(1));
  const riskIndex = Math.floor(seededRandom(seed * 7) * 4);
  const riskLevel = RISK_LEVELS[riskIndex];
  const priceTargetMod = 1 + (seededRandom(seed * 11) - 0.4) * 0.3;
  const priceTarget = parseFloat((price * priceTargetMod).toFixed(2));

  const bullish = BULLISH_POINTS[symbol] || getDefaultBullishPoints(symbol);
  const bearish = BEARISH_POINTS[symbol] || getDefaultBearishPoints(symbol);

  const summaries: Record<string, Record<string, string>> = {
    STRONG_BUY: {
      default: `${symbol} presents a compelling buying opportunity with strong fundamental tailwinds and technical momentum. Current price levels offer an attractive entry point with significant upside potential to our $${priceTarget} price target. We see ${(priceTargetMod * 100 - 100).toFixed(1)}% upside over the next 12 months.`,
    },
    BUY: {
      default: `${symbol} remains attractive at current levels with solid earnings growth and improving business fundamentals. We recommend accumulating shares with a 12-month price target of $${priceTarget}, representing ${((priceTargetMod - 1) * 100).toFixed(1)}% potential upside.`,
    },
    HOLD: {
      default: `${symbol} is fairly valued at current levels with balanced risk/reward. While long-term fundamentals remain intact, near-term catalysts are limited. Our price target of $${priceTarget} implies modest upside. Existing holders should maintain positions.`,
    },
    SELL: {
      default: `${symbol} faces meaningful headwinds that are not fully reflected in the current valuation. We see limited upside and recommend reducing exposure. Our 12-month price target of $${priceTarget} is below consensus, reflecting our more cautious fundamental view.`,
    },
    STRONG_SELL: {
      default: `${symbol} is significantly overvalued relative to fundamentals and faces structural challenges. We see material downside risk to current levels. Investors should reduce or eliminate positions. Our 12-month price target of $${priceTarget} reflects our bearish thesis.`,
    },
  };

  const summary = summaries[recommendation]?.default || summaries.HOLD.default;

  return {
    symbol,
    recommendation,
    confidence,
    summary,
    bullishPoints: bullish.slice(0, 4),
    bearishPoints: bearish.slice(0, 4),
    priceTarget,
    riskLevel,
    generatedAt: new Date().toISOString(),
  };
}

export function getAiMarketSummary() {
  const seed = getDailySeed();
  const r = seededRandom(seed * 3);
  const sentiments = ["BULLISH", "BEARISH", "NEUTRAL"] as const;
  const sentiment = sentiments[Math.floor(r * 3)];
  const sentimentScore = parseFloat(((r - 0.33) * 200).toFixed(1));

  const summaryMap = {
    BULLISH: "Markets are exhibiting strong bullish momentum driven by better-than-expected earnings, easing inflation data, and growing confidence in a soft landing scenario. The Fed's dovish pivot expectations are providing tailwinds for risk assets, particularly in technology and growth sectors. Breadth has been improving with small-caps beginning to participate in the rally.",
    BEARISH: "Markets face persistent headwinds from stubborn inflation keeping rates higher for longer, corporate earnings revisions trending downward, and geopolitical uncertainty weighing on investor sentiment. Deteriorating credit spreads and elevated volatility suggest institutional investors are reducing risk exposure. Defensive positioning recommended.",
    NEUTRAL: "Markets are consolidating after recent moves, with bulls and bears in equilibrium. Mixed economic signals — strong labor market but softening consumer spending — create an uncertain near-term outlook. Sector rotation is underway as investors reposition ahead of key data releases and Fed communications. Stock selection will be critical in this environment.",
  };

  const keyEventsMap = {
    BULLISH: [
      "Fed signals pause in rate hikes, markets pricing in cuts by Q3",
      "S&P 500 earnings beat rate tracking at 74%, above 5-year average",
      "CPI inflation prints below expectations for second consecutive month",
      "Strong tech earnings from megacap companies driving index gains",
      "Foreign capital inflows accelerating into US equities",
    ],
    BEARISH: [
      "Persistent core inflation above Fed 2% target complicating rate cut timeline",
      "Earnings guidance revisions trending negative across consumer sectors",
      "Yield curve inversion deepening, historical recession predictor",
      "Credit spreads widening in high yield, signaling credit stress",
      "China economic slowdown weighing on global growth outlook",
    ],
    NEUTRAL: [
      "Labor market resilience: unemployment at 3.7%, jobs adding 180K monthly",
      "Manufacturing PMI below 50, signaling contraction, services holding up",
      "Q1 earnings season showing mixed results with wide dispersion",
      "Fed officials messaging data-dependency, keeping market guessing",
      "Bitcoin and crypto markets showing signs of institutional accumulation",
    ],
  };

  const outlookMap = {
    BULLISH: "We maintain a constructive outlook for equities over the next 6-12 months. While volatility may persist near-term, the combination of easing financial conditions, resilient corporate balance sheets, and AI-driven productivity gains support continued upside. Overweight technology, healthcare, and industrials. Target S&P 500 at 5,800 by year-end.",
    BEARISH: "We adopt a cautious near-term stance with a preference for quality and defensives. Elevated valuations in the context of higher rates and slowing earnings growth create a challenging risk/reward for equities broadly. Underweight cyclicals and small caps. Hold cash and short-duration bonds as safe haven. S&P 500 fair value range: 4,200-4,600.",
    NEUTRAL: "A balanced portfolio approach is warranted given the current macro crosscurrents. We recommend maintaining market-weight equity exposure with a tilt toward quality factors. Active stock selection and sector diversification will be key. Watch the 10-year Treasury yield and upcoming CPI/FOMC data for directional signals. S&P 500 range-bound: 4,800-5,200.",
  };

  return {
    sentiment,
    sentimentScore: Math.max(-100, Math.min(100, sentimentScore)),
    summary: summaryMap[sentiment],
    keyEvents: keyEventsMap[sentiment],
    outlook: outlookMap[sentiment],
    generatedAt: new Date().toISOString(),
  };
}
