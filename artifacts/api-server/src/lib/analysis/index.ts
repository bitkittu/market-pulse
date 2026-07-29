import { getLiveCommodities, getUsdToInr } from "../liveMarketData.js";
import { buildCommodityAnalysis } from "./commodity.js";

export type { AiAnalysis } from "./types.js";
export { buildOptionsAnalysis, computeOptionsSignal, optionAnalysisId } from "./options.js";
export { buildIntradayAnalysis, computeIntradaySignal } from "./intraday.js";
export { buildCommodityAnalysis, computeCommoditySignal } from "./commodity.js";

/** Full AI Decision Breakdown for one commodity, addressed by its Yahoo symbol. */
export async function getCommodityAnalysis(symbol: string) {
  const [commodities, usdToInr] = await Promise.all([getLiveCommodities(), getUsdToInr()]);
  const match = commodities.find((c) => c.symbol.toUpperCase() === symbol.toUpperCase());
  if (!match) return null;

  return buildCommodityAnalysis({
    ...match,
    usdToInr,
    updatedAt: new Date().toISOString(),
  });
}
