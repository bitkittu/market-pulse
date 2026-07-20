import { useEffect, useState } from "react";
import type {
  CommodityMeta, TimeframeMeta, ExchangeMeta, ExchangeStatus,
  AIRecommendation, SentimentData, NewsItem, RiskInputs, RiskResult,
  CommodityId, TimeframeId, Signal, RiskLevel, MockQueryResult,
} from "./types";

// ── Config (add a new commodity/timeframe/exchange by adding one entry) ────

// TradingView's free public widget doesn't carry MCX real-time data (MCX:*
// symbols returned "only available on TradingView"), so the chart falls back
// to the closest globally-available equivalent — each verified live against
// the actual embed widget. Swap these for real MCX symbols once a licensed
// data feed is wired up.
export const COMMODITIES: CommodityMeta[] = [
  { id: "gold",       label: "Gold",        unit: "₹ / 10g",   lotSize: 100,  lotUnit: "1 kg (100 × 10g)", tvSymbol: "TVC:GOLD",        icon: "gold" },
  { id: "silver",     label: "Silver",      unit: "₹ / kg",    lotSize: 30,   lotUnit: "30 kg",            tvSymbol: "TVC:SILVER",      icon: "silver" },
  { id: "crudeoil",   label: "Crude Oil",   unit: "₹ / bbl",   lotSize: 100,  lotUnit: "100 barrels",      tvSymbol: "TVC:USOIL",       icon: "crudeoil" },
  { id: "naturalgas", label: "Natural Gas", unit: "₹ / mmBtu", lotSize: 1250, lotUnit: "1250 mmBtu",       tvSymbol: "OANDA:NATGASUSD", icon: "naturalgas" },
];

export const TIMEFRAMES: TimeframeMeta[] = [
  { id: "3m",  label: "3 Min" },
  { id: "15m", label: "15 Min" },
  // Add 1m / 1h / 1D etc. here when needed — every consumer reads from this array.
];

// Session hours are approximate placeholders (regular trading hours, not full
// electronic/Globex-style near-24h sessions) — replace with authoritative
// exchange-calendar data when a real integration is wired up.
export const EXCHANGES: ExchangeMeta[] = [
  { id: "MCX",    name: "Multi Commodity Exchange", city: "Mumbai",    timeZone: "Asia/Kolkata",      sessionStart: "09:00", sessionEnd: "23:30", tradingDays: [1, 2, 3, 4, 5] },
  { id: "COMEX",  name: "COMEX",                    city: "New York",  timeZone: "America/New_York",  sessionStart: "08:20", sessionEnd: "13:30", tradingDays: [1, 2, 3, 4, 5] },
  { id: "NYMEX",  name: "NYMEX",                    city: "New York",  timeZone: "America/New_York",  sessionStart: "09:00", sessionEnd: "14:30", tradingDays: [1, 2, 3, 4, 5] },
  { id: "LME",    name: "London Metal Exchange",    city: "London",    timeZone: "Europe/London",     sessionStart: "11:40", sessionEnd: "17:30", tradingDays: [1, 2, 3, 4, 5] },
];

const BASE_PRICES: Record<CommodityId, number> = {
  gold: 71500,
  silver: 84200,
  crudeoil: 6450,
  naturalgas: 205,
};

const RATIONALE: Record<CommodityId, string[]> = {
  gold: [
    "Weak USD/INR and steady festive-season demand are supporting price, with resistance building near recent highs.",
    "Safe-haven flows have picked up on global risk-off sentiment; momentum favors continuation on the current timeframe.",
    "Price is consolidating below a key resistance band — a breakout would confirm the current bias, a rejection would invalidate it.",
  ],
  silver: [
    "Industrial demand from solar and electronics manufacturing continues to underpin price alongside gold's strength.",
    "Silver is tracking gold's move with higher beta; volatility is elevated on this timeframe.",
    "Price is testing a short-term trendline — a clean hold would support the current signal.",
  ],
  crudeoil: [
    "OPEC+ supply signals and US inventory data are the dominant near-term drivers on this timeframe.",
    "Price is reacting to global demand concerns; refinery margins and dollar strength are secondary factors in play.",
    "Geopolitical risk premium remains a wildcard — the current signal assumes no fresh supply-shock headlines.",
  ],
  naturalgas: [
    "Seasonal demand (cooling/heating load) and storage-injection data are driving short-term volatility.",
    "Weather-forecast shifts are the primary swing factor on this timeframe; positioning is tactical, not structural.",
    "Price is reacting to the latest storage report; the current signal assumes the trend holds through the next update.",
  ],
};

// ── Small seeded PRNG so switching tabs/timeframes is stable, not re-randomized on every render ──

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

function mulberry32(seed: number) {
  let s = seed;
  return function rand() {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRand(key: string) {
  return mulberry32(hashString(key));
}

// ── Mock generators (shaped so a real API hook can replace the body later) ──

function generateRecommendation(commodityId: CommodityId, timeframe: TimeframeId): AIRecommendation {
  const rand = seededRand(`${commodityId}-${timeframe}-rec`);
  const signals: Signal[] = ["STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"];
  const signal = signals[Math.floor(rand() * signals.length)];
  const confidence = Math.round(55 + rand() * 40);
  const base = BASE_PRICES[commodityId];
  const bullish = signal === "STRONG_BUY" || signal === "BUY";
  const bearish = signal === "STRONG_SELL" || signal === "SELL";
  const direction = bullish ? 1 : bearish ? -1 : 0;

  const entryPrice = round2(base * (1 + (rand() - 0.5) * 0.01));
  const stopLossPct = 0.008 + rand() * 0.01;
  const targetPct = 0.015 + rand() * 0.02;
  const sign = direction === 0 ? (rand() > 0.5 ? 1 : -1) : direction;
  const stopLoss = round2(entryPrice * (1 - sign * stopLossPct));
  const target = round2(entryPrice * (1 + sign * targetPct));

  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(target - entryPrice);
  const riskLevel: RiskLevel = confidence >= 80 ? "Low" : confidence >= 65 ? "Medium" : "High";
  const options = RATIONALE[commodityId];

  return {
    commodityId,
    timeframe,
    signal,
    confidence,
    entryPrice,
    stopLoss,
    target,
    riskLevel,
    riskRewardRatio: round2(reward / risk),
    rationale: options[Math.floor(rand() * options.length)],
    generatedAt: new Date().toISOString(),
  };
}

function generateSentiment(commodityId: CommodityId): SentimentData {
  const rand = seededRand(`${commodityId}-sentiment`);
  const score = Math.round(rand() * 100);
  const grade =
    score >= 80 ? "Very Bullish" :
    score >= 60 ? "Bullish" :
    score >= 40 ? "Neutral" :
    score >= 20 ? "Bearish" : "Very Bearish";
  const bullishPct = Math.round(30 + rand() * 40);
  const bearishPct = Math.round(rand() * (100 - bullishPct));
  const neutralPct = 100 - bullishPct - bearishPct;
  return { commodityId, score, grade, bullishPct, bearishPct, neutralPct };
}

const NEWS_TEMPLATES: Record<CommodityId, { title: string; summary: string }[]> = {
  gold: [
    { title: "Gold holds steady as investors await central bank commentary", summary: "MCX Gold futures traded in a narrow range as markets positioned ahead of upcoming policy signals." },
    { title: "Festive demand lifts physical gold buying across India", summary: "Jewellers report a pickup in retail demand, providing underlying support to domestic prices." },
    { title: "Dollar index softens, offering gold a mild tailwind", summary: "A weaker greenback made gold more attractive to holders of other currencies." },
  ],
  silver: [
    { title: "Silver tracks gold higher amid industrial demand optimism", summary: "Solar-panel manufacturing demand continues to add a structural bid under silver prices." },
    { title: "Silver volatility rises as gold-silver ratio narrows", summary: "Traders are watching the ratio closely for signs of a rotation between the two metals." },
  ],
  crudeoil: [
    { title: "Crude steadies after inventory data surprises to the downside", summary: "A larger-than-expected draw in US crude stockpiles offered support to prices." },
    { title: "OPEC+ output signals keep traders cautious", summary: "Markets are weighing the group's next move on production quotas." },
  ],
  naturalgas: [
    { title: "Natural gas swings on shifting weather forecasts", summary: "Updated temperature outlooks are driving short-term repricing of near-term demand." },
    { title: "Storage report keeps natural gas traders on edge", summary: "Inventory levels remain a key input for near-term price direction." },
  ],
};

function generateNews(commodityId: CommodityId): NewsItem[] {
  const rand = seededRand(`${commodityId}-news`);
  const templates = NEWS_TEMPLATES[commodityId];
  const sources = ["Reuters", "Bloomberg", "MoneyControl", "Economic Times", "Business Standard"];
  return templates.map((t, i) => ({
    id: `${commodityId}-news-${i}`,
    commodityId,
    title: t.title,
    summary: t.summary,
    source: sources[Math.floor(rand() * sources.length)],
    publishedAt: new Date(Date.now() - (i + 1) * (2 + Math.floor(rand() * 6)) * 3600_000).toISOString(),
  }));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// ── Mock hooks (same {data, isLoading, error} shape a real query hook returns) ──

function useMockQuery<T>(key: string, generate: () => T, delayMs = 350): MockQueryResult<T> {
  const [state, setState] = useState<MockQueryResult<T>>({ data: undefined, isLoading: true, error: null });

  useEffect(() => {
    setState({ data: undefined, isLoading: true, error: null });
    const timer = setTimeout(() => {
      setState({ data: generate(), isLoading: false, error: null });
    }, delayMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

export function useAIRecommendation(commodityId: CommodityId, timeframe: TimeframeId) {
  return useMockQuery(`${commodityId}-${timeframe}-rec`, () => generateRecommendation(commodityId, timeframe));
}

export function useSentiment(commodityId: CommodityId) {
  return useMockQuery(`${commodityId}-sentiment`, () => generateSentiment(commodityId));
}

export function useCommodityNews(commodityId: CommodityId) {
  return useMockQuery(`${commodityId}-news`, () => generateNews(commodityId), 400);
}

// ── Risk management ──────────────────────────────────────────────────────

export function computeRisk(commodity: CommodityMeta, rec: AIRecommendation, inputs: RiskInputs): RiskResult {
  const riskAmount = inputs.capital * (inputs.riskPercent / 100);
  const perUnitRisk = Math.abs(rec.entryPrice - rec.stopLoss);
  const perUnitReward = Math.abs(rec.target - rec.entryPrice);
  const perLotRisk = perUnitRisk * commodity.lotSize;
  const suggestedLots = perLotRisk > 0 ? Math.max(0, Math.floor(riskAmount / perLotRisk)) : 0;
  const maxLoss = suggestedLots * perLotRisk;
  const potentialGain = suggestedLots * perUnitReward * commodity.lotSize;

  return {
    riskAmount: round2(riskAmount),
    perLotRisk: round2(perLotRisk),
    suggestedLots,
    maxLoss: round2(maxLoss),
    potentialGain: round2(potentialGain),
    riskRewardRatio: maxLoss > 0 ? round2(potentialGain / maxLoss) : 0,
    minCapitalForOneLot: inputs.riskPercent > 0 ? round2(perLotRisk / (inputs.riskPercent / 100)) : 0,
  };
}

// ── Exchange status (DST-safe: reads actual wall-clock offset per instant via Intl, not a string round-trip) ──

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function getZonedParts(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    weekday: "short",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second),
    weekday: parts.weekday,
  };
}

/** UTC ms of the given (y, mo, d, h, mi) wall-clock time as observed in `timeZone`, DST-aware. */
function zonedWallTimeToUtc(y: number, mo: number, d: number, h: number, mi: number, timeZone: string): number {
  let guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  const target = guess;
  for (let i = 0; i < 2; i++) {
    const p = getZonedParts(new Date(guess), timeZone);
    const zonedAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess -= zonedAsUtc - target;
  }
  return guess;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function getExchangeStatus(exchange: ExchangeMeta, now: Date = new Date()): ExchangeStatus {
  const nowParts = getZonedParts(now, exchange.timeZone);
  const localTime = `${pad(nowParts.hour)}:${pad(nowParts.minute)}:${pad(nowParts.second)}`;

  const [startH, startM] = exchange.sessionStart.split(":").map(Number);
  const [endH, endM] = exchange.sessionEnd.split(":").map(Number);

  const isTradingDay = exchange.tradingDays.includes(WEEKDAY_INDEX[nowParts.weekday]);
  const todayOpenMs = zonedWallTimeToUtc(nowParts.year, nowParts.month, nowParts.day, startH, startM, exchange.timeZone);
  const todayCloseMs = zonedWallTimeToUtc(nowParts.year, nowParts.month, nowParts.day, endH, endM, exchange.timeZone);
  const nowMs = now.getTime();

  if (isTradingDay && nowMs >= todayOpenMs && nowMs < todayCloseMs) {
    return { exchange, isOpen: true, localTime, nextEventLabel: "Closes", nextEventAt: new Date(todayCloseMs), msRemaining: todayCloseMs - nowMs };
  }

  for (let offset = 0; offset <= 8; offset++) {
    const d = new Date(nowMs + offset * 86_400_000);
    const dParts = getZonedParts(d, exchange.timeZone);
    if (!exchange.tradingDays.includes(WEEKDAY_INDEX[dParts.weekday])) continue;
    const openMs = zonedWallTimeToUtc(dParts.year, dParts.month, dParts.day, startH, startM, exchange.timeZone);
    if (openMs > nowMs) {
      return { exchange, isOpen: false, localTime, nextEventLabel: "Opens", nextEventAt: new Date(openMs), msRemaining: openMs - nowMs };
    }
  }

  return { exchange, isOpen: false, localTime, nextEventLabel: "Opens", nextEventAt: new Date(nowMs + 86_400_000), msRemaining: 86_400_000 };
}
