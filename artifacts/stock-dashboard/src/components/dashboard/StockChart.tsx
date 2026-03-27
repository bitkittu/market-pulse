import React, { useMemo } from "react";
import { useGetStockHistory, GetStockHistoryPeriod } from "@workspace/api-client-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface StockChartProps {
  symbol: string;
  period: GetStockHistoryPeriod;
  onPeriodChange?: (period: GetStockHistoryPeriod) => void;
  height?: number;
}

const PERIODS: GetStockHistoryPeriod[] = ["1D", "1W", "1M", "3M", "6M", "1Y"];

export function StockChart({ symbol, period, onPeriodChange, height = 400 }: StockChartProps) {
  const { data, isLoading } = useGetStockHistory(symbol, { period }, {
    query: { refetchInterval: 30000, enabled: !!symbol }
  });

  const chartData = useMemo(() => {
    if (!data?.data) return [];
    return data.data.map(p => ({
      ...p,
      timeLabel: period === "1D" || period === "1W" 
        ? format(new Date(p.timestamp), "HH:mm") 
        : format(new Date(p.timestamp), "MMM dd")
    }));
  }, [data, period]);

  const isPositive = useMemo(() => {
    if (chartData.length < 2) return true;
    return chartData[chartData.length - 1].close >= chartData[0].close;
  }, [chartData]);

  const color = isPositive ? "hsl(var(--positive))" : "hsl(var(--destructive))";
  const glowColor = isPositive ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)";

  if (isLoading) {
    return <Skeleton style={{ height }} className="w-full rounded-md" />;
  }

  if (!data || chartData.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[400px] text-muted-foreground font-mono text-sm">
          No data available for {symbol}
        </CardContent>
      </Card>
    );
  }

  const minPrice = Math.min(...chartData.map(d => d.low));
  const maxPrice = Math.max(...chartData.map(d => d.high));
  const padding = (maxPrice - minPrice) * 0.1;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="glass-panel p-3 rounded-md border border-white/10 shadow-xl font-mono text-sm">
          <p className="text-muted-foreground mb-2">{format(new Date(data.timestamp), "MMM dd, yyyy HH:mm")}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-muted-foreground">Open</span>
            <span className="text-right">${data.open.toFixed(2)}</span>
            <span className="text-muted-foreground">High</span>
            <span className="text-right text-positive">${data.high.toFixed(2)}</span>
            <span className="text-muted-foreground">Low</span>
            <span className="text-right text-destructive">${data.low.toFixed(2)}</span>
            <span className="text-muted-foreground">Close</span>
            <span className="text-right font-bold text-white">${data.close.toFixed(2)}</span>
            <span className="text-muted-foreground mt-1">Vol</span>
            <span className="text-right mt-1 text-white/70">{(data.volume / 1000000).toFixed(2)}M</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="flex items-center space-x-2">
          <span className="text-white text-lg font-bold">{symbol}</span>
          <span className="text-muted-foreground text-sm">Price History</span>
        </CardTitle>
        {onPeriodChange && (
          <div className="flex bg-black/40 rounded p-1 border border-white/5">
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => onPeriodChange(p)}
                className={`px-3 py-1 text-xs font-mono rounded-sm transition-all ${
                  period === p 
                    ? "bg-white/10 text-white font-bold shadow-sm" 
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0 pl-0 pb-4">
        <div style={{ height, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="timeLabel" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                minTickGap={30}
              />
              <YAxis 
                domain={[minPrice - padding, maxPrice + padding]} 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                tickFormatter={(val) => `$${val.toFixed(0)}`}
                orientation="right"
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <ReferenceLine y={chartData[0]?.close} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
              <Area 
                type="monotone" 
                dataKey="close" 
                stroke={color} 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorPrice)" 
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
