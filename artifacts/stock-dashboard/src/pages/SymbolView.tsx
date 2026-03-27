import React, { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { StockChart } from "@/components/dashboard/StockChart";
import { AiAnalysisPanel } from "@/components/dashboard/AiPanels";
import { 
  useGetStockQuotes, 
  useGetWatchlist, 
  useAddToWatchlist, 
  useRemoveFromWatchlist,
  GetStockHistoryPeriod
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent, formatLargeNumber } from "@/lib/utils";
import { BookmarkPlus, BookmarkCheck, ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { clsx } from "clsx";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

export default function SymbolView() {
  const [, params] = useRoute("/symbol/:symbol");
  const symbol = params?.symbol?.toUpperCase();
  const queryClient = useQueryClient();

  const [period, setPeriod] = useState<GetStockHistoryPeriod>("1M");

  const { data: quotes, isLoading: isLoadingQuote } = useGetStockQuotes(
    { symbols: symbol },
    { query: { enabled: !!symbol, refetchInterval: 10000 } }
  );
  
  const quote = quotes?.[0];

  const { data: watchlist } = useGetWatchlist();
  const isWatched = watchlist?.some(w => w.symbol === symbol);

  const { mutate: addWatchlist, isPending: isAdding } = useAddToWatchlist({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] }) }
  });
  
  const { mutate: removeWatchlist, isPending: isRemoving } = useRemoveFromWatchlist({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] }) }
  });

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [symbol]);

  if (!symbol) return null;

  const toggleWatchlist = () => {
    if (isWatched) removeWatchlist({ symbol });
    else addWatchlist({ data: { symbol } });
  };

  return (
    <AppLayout>
      <div className="flex flex-col space-y-6 pb-20">
        
        {/* Breadcrumb & Actions */}
        <div className="flex items-center justify-between">
          <Link href="/" className="text-muted-foreground hover:text-white flex items-center text-sm font-mono transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Terminal
          </Link>
          <button 
            onClick={toggleWatchlist}
            disabled={isAdding || isRemoving}
            className={clsx(
              "flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-bold font-mono transition-all disabled:opacity-50",
              isWatched 
                ? "bg-white/10 text-white hover:bg-destructive/20 hover:text-destructive border border-white/5 hover:border-destructive/30" 
                : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_15px_rgba(59,130,246,0.5)]"
            )}
          >
            {isWatched ? (
              <><BookmarkCheck className="h-4 w-4" /> <span>Watching</span></>
            ) : (
              <><BookmarkPlus className="h-4 w-4" /> <span>Add to Watchlist</span></>
            )}
          </button>
        </div>

        {/* Header Quote Data */}
        {isLoadingQuote ? (
          <Skeleton className="h-32 w-full" />
        ) : quote ? (
          <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-white/10 pb-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white flex items-baseline space-x-4">
                <span>{quote.symbol}</span>
                <span className="text-xl md:text-2xl text-muted-foreground font-medium tracking-normal">{quote.name}</span>
              </h1>
              <div className="flex items-center mt-2 space-x-3 text-sm font-mono text-muted-foreground">
                <span className="bg-white/5 px-2 py-0.5 rounded border border-white/10">{quote.sector}</span>
              </div>
            </div>
            
            <div className="mt-6 md:mt-0 flex flex-col items-start md:items-end">
              <div className="text-4xl md:text-5xl font-mono font-bold text-white">
                {formatCurrency(quote.price)}
              </div>
              <div className={clsx(
                "flex items-center space-x-2 text-lg font-mono font-bold mt-1",
                quote.change >= 0 ? "text-positive text-shadow-glow-positive" : "text-destructive text-shadow-glow-negative"
              )}>
                {quote.change >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                <span>{quote.change >= 0 ? '+' : ''}{quote.change.toFixed(2)}</span>
                <span>({formatPercent(quote.changePercent)})</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground border border-dashed border-white/10 rounded-lg">
            Could not load quote data for {symbol}.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Col: Chart & Stats */}
          <div className="lg:col-span-8 flex flex-col space-y-6">
            <div className="h-[450px]">
              <StockChart symbol={symbol} period={period} onPeriodChange={setPeriod} height={400} />
            </div>

            {/* Detailed Stats Grid */}
            {quote && (
              <Card className="border-border/60 bg-black/40">
                <CardContent className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6 font-mono text-sm">
                  <StatItem label="Market Cap" value={formatLargeNumber(quote.marketCap)} />
                  <StatItem label="Volume" value={formatLargeNumber(quote.volume)} />
                  <StatItem label="Avg Vol (3m)" value={quote.avgVolume ? formatLargeNumber(quote.avgVolume) : '-'} />
                  <StatItem label="P/E Ratio" value={quote.pe ? quote.pe.toFixed(2) : '-'} />
                  
                  <StatItem label="Open" value={formatCurrency(quote.open)} />
                  <StatItem label="Prev Close" value={formatCurrency(quote.previousClose)} />
                  <StatItem label="52W High" value={formatCurrency(quote.high52w)} />
                  <StatItem label="52W Low" value={formatCurrency(quote.low52w)} />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Col: AI Analysis */}
          <div className="lg:col-span-4">
            <AiAnalysisPanel symbol={symbol} />
          </div>
        </div>

      </div>
    </AppLayout>
  );
}

function StatItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground text-xs uppercase mb-1">{label}</span>
      <span className="text-white font-semibold text-base">{value}</span>
    </div>
  );
}
