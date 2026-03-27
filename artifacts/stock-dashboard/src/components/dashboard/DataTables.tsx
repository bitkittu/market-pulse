import React from "react";
import { useGetTopMovers, useGetSectorPerformance } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency, formatPercent, formatLargeNumber } from "@/lib/utils";
import { TrendingUp, TrendingDown, Layers } from "lucide-react";
import { Link } from "wouter";
import { clsx } from "clsx";

export function TopMoversTable() {
  const { data, isLoading } = useGetTopMovers({ query: { refetchInterval: 30000 } });

  if (isLoading) return <div className="h-[300px] bg-card animate-pulse rounded-md" />;
  if (!data) return null;

  return (
    <Card className="border-border/60 h-full">
      <CardHeader className="py-3 border-b border-white/5">
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span>Market Movers</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex h-[350px]">
        {/* Gainers */}
        <div className="flex-1 border-r border-white/5">
          <div className="bg-positive/10 text-positive text-xs font-mono font-bold p-2 text-center uppercase tracking-widest border-b border-positive/20">
            Top Gainers
          </div>
          <div className="overflow-auto h-[310px]">
            <table className="w-full text-sm">
              <tbody>
                {data.gainers.slice(0, 8).map((stock) => (
                  <tr key={stock.symbol} className="border-b border-white/5 hover:bg-white/[0.02] group">
                    <td className="p-2">
                      <Link href={`/symbol/${stock.symbol}`} className="font-bold font-mono text-white group-hover:text-primary transition-colors">
                        {stock.symbol}
                      </Link>
                    </td>
                    <td className="p-2 text-right font-mono">{formatCurrency(stock.price)}</td>
                    <td className="p-2 text-right font-mono text-positive font-bold">{formatPercent(stock.changePercent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {/* Losers */}
        <div className="flex-1">
          <div className="bg-destructive/10 text-destructive text-xs font-mono font-bold p-2 text-center uppercase tracking-widest border-b border-destructive/20">
            Top Losers
          </div>
          <div className="overflow-auto h-[310px]">
            <table className="w-full text-sm">
              <tbody>
                {data.losers.slice(0, 8).map((stock) => (
                  <tr key={stock.symbol} className="border-b border-white/5 hover:bg-white/[0.02] group">
                    <td className="p-2">
                      <Link href={`/symbol/${stock.symbol}`} className="font-bold font-mono text-white group-hover:text-primary transition-colors">
                        {stock.symbol}
                      </Link>
                    </td>
                    <td className="p-2 text-right font-mono">{formatCurrency(stock.price)}</td>
                    <td className="p-2 text-right font-mono text-destructive font-bold">{formatPercent(stock.changePercent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SectorPerformanceChart() {
  const { data: sectors, isLoading } = useGetSectorPerformance({ query: { refetchInterval: 60000 } });

  if (isLoading) return <div className="h-[300px] bg-card animate-pulse rounded-md" />;
  if (!sectors) return null;

  // Sort by performance
  const sorted = [...sectors].sort((a, b) => b.changePercent - a.changePercent);

  return (
    <Card className="border-border/60 h-full flex flex-col">
      <CardHeader className="py-3 border-b border-white/5">
        <CardTitle className="flex items-center space-x-2">
          <Layers className="h-4 w-4 text-primary" />
          <span>Sector Performance</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 flex-1 overflow-auto">
        <div className="space-y-4">
          {sorted.map((sector) => {
            const isPositive = sector.changePercent >= 0;
            const barWidth = Math.min(Math.abs(sector.changePercent) * 15, 100); // Scale for visual

            return (
              <div key={sector.sector} className="group">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-xs font-semibold text-white/80">{sector.sector}</span>
                  <span className={clsx("text-xs font-mono font-bold", isPositive ? "text-positive" : "text-destructive")}>
                    {formatPercent(sector.changePercent)}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
                  {/* Zero line logic for bar visual */}
                  <div className="w-1/2 flex justify-end">
                    {!isPositive && (
                      <div 
                        className="h-full bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.8)]" 
                        style={{ width: `${barWidth}%`, transition: 'width 1s ease-out' }} 
                      />
                    )}
                  </div>
                  <div className="w-[1px] bg-white/20 h-full z-10" />
                  <div className="w-1/2 flex justify-start">
                    {isPositive && (
                      <div 
                        className="h-full bg-positive shadow-[0_0_8px_rgba(16,185,129,0.8)]" 
                        style={{ width: `${barWidth}%`, transition: 'width 1s ease-out' }} 
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
