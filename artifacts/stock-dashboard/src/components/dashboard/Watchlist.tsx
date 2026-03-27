import React from "react";
import { useGetWatchlist, useGetStockQuotes, useRemoveFromWatchlist } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Trash2, TrendingDown, TrendingUp, Activity } from "lucide-react";
import { Link } from "wouter";
import { clsx } from "clsx";
import { useQueryClient } from "@tanstack/react-query";

export function Watchlist() {
  const queryClient = useQueryClient();
  const { data: watchlist, isLoading: isLoadingWatchlist } = useGetWatchlist();
  
  const symbols = watchlist?.map(w => w.symbol).join(',') || "";
  
  const { data: quotes, isLoading: isLoadingQuotes } = useGetStockQuotes(
    { symbols },
    { 
      query: { 
        enabled: !!symbols,
        refetchInterval: 15000 
      } 
    }
  );

  const { mutate: remove } = useRemoveFromWatchlist({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      }
    }
  });

  if (isLoadingWatchlist) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Watchlist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-white/5 animate-pulse rounded" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full border-border/60 bg-black/20 flex flex-col">
      <CardHeader className="py-3 border-b border-border/40 bg-transparent flex flex-row items-center justify-between">
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-4 w-4 text-primary" />
          <span>Live Watchlist</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-auto">
        {(!watchlist || watchlist.length === 0) ? (
          <div className="p-6 text-center text-muted-foreground text-sm font-mono flex flex-col items-center">
            <Activity className="h-8 w-8 mb-2 opacity-20" />
            <p>Your watchlist is empty.</p>
            <p className="text-xs mt-1 opacity-70">Search for a ticker to add.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {quotes?.map((quote) => {
              const isPositive = quote.change >= 0;
              return (
                <div key={quote.symbol} className="group relative flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors">
                  <Link href={`/symbol/${quote.symbol}`} className="absolute inset-0 z-0" />
                  
                  <div className="z-10 flex flex-col relative pointer-events-none">
                    <span className="font-bold font-mono text-sm tracking-tight text-white">{quote.symbol}</span>
                    <span className="text-[10px] text-muted-foreground truncate w-24">{quote.name}</span>
                  </div>
                  
                  <div className="z-10 flex items-center space-x-3 text-right">
                    <div className="flex flex-col">
                      <span className="font-mono text-sm font-medium text-white">
                        {formatCurrency(quote.price)}
                      </span>
                      <span className={clsx(
                        "font-mono text-[11px] font-semibold flex items-center justify-end",
                        isPositive ? "text-positive" : "text-destructive"
                      )}>
                        {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                        {isPositive ? '+' : ''}{quote.change.toFixed(2)} ({formatPercent(quote.changePercent)})
                      </span>
                    </div>
                    
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        remove({ symbol: quote.symbol });
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all z-20 cursor-pointer"
                      title="Remove from watchlist"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
            
            {isLoadingQuotes && !quotes && (
              <div className="p-4 flex justify-center">
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
