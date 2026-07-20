export type CommodityId = "gold" | "silver" | "crudeoil" | "naturalgas";
export type TimeframeId = "3m" | "15m";
export type Signal = "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
export type RiskLevel = "Low" | "Medium" | "High";
export type ExchangeId = "MCX" | "COMEX" | "NYMEX" | "LME";

export interface CommodityMeta {
  id: CommodityId;
  label: string;
  unit: string;
  /** MCX contract lot size, used for position sizing. Approximate — verify against the live MCX contract spec when wiring a real API. */
  lotSize: number;
  lotUnit: string;
  tvSymbol: string;
  icon: "gold" | "silver" | "crudeoil" | "naturalgas";
}

export interface TimeframeMeta {
  id: TimeframeId;
  label: string;
}

export interface ExchangeMeta {
  id: ExchangeId;
  name: string;
  city: string;
  /** IANA timezone. */
  timeZone: string;
  /** Approximate session window in the exchange's own local time, "HH:mm". Placeholder — not authoritative trading-calendar data. */
  sessionStart: string;
  sessionEnd: string;
  /** 0=Sun..6=Sat, days the exchange trades. */
  tradingDays: number[];
}

export interface AIRecommendation {
  commodityId: CommodityId;
  timeframe: TimeframeId;
  signal: Signal;
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  target: number;
  riskLevel: RiskLevel;
  riskRewardRatio: number;
  rationale: string;
  generatedAt: string;
}

export interface ExchangeStatus {
  exchange: ExchangeMeta;
  isOpen: boolean;
  localTime: string;
  nextEventLabel: "Opens" | "Closes";
  nextEventAt: Date;
  msRemaining: number;
}

export interface SentimentData {
  commodityId: CommodityId;
  score: number;
  grade: "Very Bearish" | "Bearish" | "Neutral" | "Bullish" | "Very Bullish";
  bullishPct: number;
  bearishPct: number;
  neutralPct: number;
}

export interface NewsItem {
  id: string;
  commodityId: CommodityId;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
}

export interface RiskInputs {
  capital: number;
  riskPercent: number;
}

export interface RiskResult {
  riskAmount: number;
  perLotRisk: number;
  suggestedLots: number;
  maxLoss: number;
  potentialGain: number;
  riskRewardRatio: number;
  /** Capital needed (at the current risk %) to afford at least 1 lot. */
  minCapitalForOneLot: number;
}

/** Mirrors the {data, isLoading, error} shape of a real @workspace/api-client-react hook, so swapping in a live endpoint later is a drop-in change. */
export interface MockQueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: null;
}
