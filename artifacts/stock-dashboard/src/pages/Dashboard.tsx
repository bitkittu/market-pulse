import React, { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MarketIndices } from "@/components/dashboard/MarketIndices";
import { StockChart } from "@/components/dashboard/StockChart";
import { Watchlist } from "@/components/dashboard/Watchlist";
import { AiMarketSummaryPanel } from "@/components/dashboard/AiPanels";
import { TopMoversTable, SectorPerformanceChart } from "@/components/dashboard/DataTables";
import { GetStockHistoryPeriod } from "@workspace/api-client-react";

export default function Dashboard() {
  const [mainChartPeriod, setMainChartPeriod] = useState<GetStockHistoryPeriod>("1M");

  return (
    <AppLayout>
      <div className="flex flex-col space-y-6 pb-20">
        
        {/* Top Row: Market Indices */}
        <section>
          <MarketIndices />
        </section>

        {/* Middle Row: Main Chart & AI Summary & Watchlist */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto lg:h-[450px]">
          {/* Main Chart takes 8 cols */}
          <div className="lg:col-span-8 flex flex-col h-[400px] lg:h-full">
            <StockChart 
              symbol="SPY" 
              period={mainChartPeriod} 
              onPeriodChange={setMainChartPeriod} 
              height={390} // accounting for card header
            />
          </div>
          
          {/* Sidebar takes 4 cols */}
          <div className="lg:col-span-4 flex flex-col space-y-6 h-full">
            <div className="shrink-0">
              <AiMarketSummaryPanel />
            </div>
            <div className="flex-1 min-h-[250px] overflow-hidden">
              <Watchlist />
            </div>
          </div>
        </section>

        {/* Bottom Row: Data Tables */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopMoversTable />
          <SectorPerformanceChart />
        </section>

      </div>
    </AppLayout>
  );
}
