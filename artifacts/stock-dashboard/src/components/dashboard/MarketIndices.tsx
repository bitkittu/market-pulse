import React from "react";
import { useGetMarketIndices } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { clsx } from "clsx";

export function MarketIndices() {
  const { data: indices, isLoading } = useGetMarketIndices({
    query: { refetchInterval: 15000 }
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!indices) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {indices.map((index) => {
        const isPositive = index.change >= 0;
        return (
          <Card key={index.symbol} className="group hover:border-white/20 transition-all duration-300">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{index.symbol}</h4>
                  <p className="text-[10px] text-muted-foreground/70 truncate max-w-[100px]">{index.name}</p>
                </div>
                {isPositive ? (
                  <ArrowUpRight className="h-4 w-4 text-positive" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-destructive" />
                )}
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-mono font-semibold tracking-tight">
                  {index.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className={clsx(
                "flex items-center space-x-2 text-xs font-mono mt-1",
                isPositive ? "text-positive" : "text-destructive"
              )}>
                <span>{isPositive ? '+' : ''}{index.change.toFixed(2)}</span>
                <span className={clsx(
                  "px-1 rounded-sm",
                  isPositive ? "bg-positive/10" : "bg-destructive/10"
                )}>
                  {formatPercent(index.changePercent)}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
