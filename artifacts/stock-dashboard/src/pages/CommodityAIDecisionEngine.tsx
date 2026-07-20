import { useState } from "react";
import { Sparkles } from "lucide-react";
import { InstrumentTabs } from "@/components/ai-commodity/InstrumentTabs";
import { TimeframeSelector } from "@/components/ai-commodity/TimeframeSelector";
import { AIRecommendationCard } from "@/components/ai-commodity/AIRecommendationCard";
import { TradingViewChart } from "@/components/ai-commodity/TradingViewChart";
import { ExchangeStatusPanel } from "@/components/ai-commodity/ExchangeStatusPanel";
import { SentimentGauge } from "@/components/ai-commodity/SentimentGauge";
import { RiskManagementPanel } from "@/components/ai-commodity/RiskManagementPanel";
import { NewsFeed } from "@/components/ai-commodity/NewsFeed";
import { COMMODITIES } from "@/components/ai-commodity/data";
import type { CommodityId, TimeframeId } from "@/components/ai-commodity/types";

export function CommodityAIDecisionEngine() {
  const [commodityId, setCommodityId] = useState<CommodityId>("gold");
  const [timeframe, setTimeframe] = useState<TimeframeId>("3m");
  const commodity = COMMODITIES.find((c) => c.id === commodityId)!;

  return (
    <div className="w-full space-y-4">
      <h1 className="text-lg font-black text-foreground flex items-center gap-2">
        <Sparkles className="w-4.5 h-4.5 text-primary" /> AI Decision Engine
      </h1>

      {/* Top toolbar — instrument selector + timeframe, like a trading terminal */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3">
        <InstrumentTabs value={commodityId} onChange={setCommodityId} />
        <TimeframeSelector value={timeframe} onChange={setTimeframe} />
      </div>

      <div className="flex flex-col xl:flex-row gap-4 items-start">
        {/* Chart — center stage, large */}
        <div className="w-full xl:flex-1 xl:min-w-0">
          <TradingViewChart symbol={commodity.tvSymbol} timeframe={timeframe} height={680} />
        </div>

        {/* Info rail — AI recommendation, sentiment, risk, news */}
        <div className="w-full xl:w-[380px] xl:shrink-0 space-y-4">
          <ExchangeStatusPanel />
          <AIRecommendationCard commodity={commodity} timeframe={timeframe} />
          <SentimentGauge commodityId={commodityId} />
          <RiskManagementPanel commodity={commodity} timeframe={timeframe} />
          <NewsFeed commodityId={commodityId} />
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground text-center pb-2">
        AI recommendations and market data on this page are illustrative placeholders for demonstrating the interface — not live trading signals. Live data integration is planned for a future release.
      </p>
    </div>
  );
}
