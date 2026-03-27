import React from "react";
import { useGetAiAnalysis, useGetAiMarketSummary, AiAnalysisRecommendation } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BrainCircuit, Target, ShieldAlert, CheckCircle2, XCircle, TrendingUp, AlertTriangle, Zap } from "lucide-react";
import { clsx } from "clsx";
import { formatCurrency } from "@/lib/utils";

const getRecColor = (rec: AiAnalysisRecommendation) => {
  switch (rec) {
    case "STRONG_BUY": return "bg-positive/20 text-positive border-positive/30";
    case "BUY": return "bg-positive/10 text-positive border-positive/20";
    case "HOLD": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    case "SELL": return "bg-destructive/10 text-destructive border-destructive/20";
    case "STRONG_SELL": return "bg-destructive/20 text-destructive border-destructive/30";
    default: return "bg-muted text-muted-foreground";
  }
};

export function AiAnalysisPanel({ symbol }: { symbol: string }) {
  const { data: analysis, isLoading } = useGetAiAnalysis(symbol);

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full rounded-md" />;
  }

  if (!analysis) return null;

  return (
    <Card className="border-primary/20 shadow-[0_0_15px_rgba(59,130,246,0.05)] bg-gradient-to-b from-card to-card/50 relative overflow-hidden">
      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-primary/10 rounded-full blur-[30px] pointer-events-none" />
      
      <CardHeader className="border-b border-white/5 py-3">
        <CardTitle className="flex items-center space-x-2 text-primary">
          <BrainCircuit className="h-4 w-4" />
          <span>Nexus AI Analysis</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-6">
        
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-mono mb-1 uppercase">Recommendation</p>
            <div className={clsx("inline-flex items-center px-3 py-1 rounded-sm border font-bold text-sm tracking-wider", getRecColor(analysis.recommendation))}>
              {analysis.recommendation.replace('_', ' ')}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground font-mono mb-1 uppercase">Confidence</p>
            <div className="flex items-center justify-end space-x-2">
              <div className="w-16 h-1.5 bg-black/50 rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${analysis.confidence}%` }} />
              </div>
              <span className="font-mono text-sm font-bold text-white">{analysis.confidence}%</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
          <div className="glass-panel p-3 rounded flex flex-col border-none bg-white/[0.02]">
            <span className="flex items-center text-xs text-muted-foreground font-mono uppercase mb-2">
              <Target className="h-3.5 w-3.5 mr-1.5 text-primary" /> Price Target
            </span>
            <span className="text-xl font-mono font-bold text-white">{formatCurrency(analysis.priceTarget)}</span>
          </div>
          <div className="glass-panel p-3 rounded flex flex-col border-none bg-white/[0.02]">
            <span className="flex items-center text-xs text-muted-foreground font-mono uppercase mb-2">
              <ShieldAlert className="h-3.5 w-3.5 mr-1.5 text-yellow-500" /> Risk Level
            </span>
            <Badge variant="outline" className={clsx(
              "self-start mt-0.5",
              analysis.riskLevel === 'HIGH' || analysis.riskLevel === 'VERY_HIGH' ? 'text-destructive border-destructive/30' : 'text-yellow-500 border-yellow-500/30'
            )}>
              {analysis.riskLevel}
            </Badge>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-mono uppercase text-muted-foreground mb-2">AI Summary</h4>
          <p className="text-sm text-white/80 leading-relaxed font-light">
            {analysis.summary}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="flex items-center text-xs font-mono uppercase text-positive mb-3">
              <TrendingUp className="h-3.5 w-3.5 mr-1" /> Bullish Factors
            </h4>
            <ul className="space-y-2">
              {analysis.bullishPoints.map((point, i) => (
                <li key={i} className="flex items-start text-xs text-white/70">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-positive/70 shrink-0 mt-0.5" />
                  <span className="leading-tight">{point}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="flex items-center text-xs font-mono uppercase text-destructive mb-3">
              <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Bearish Factors
            </h4>
            <ul className="space-y-2">
              {analysis.bearishPoints.map((point, i) => (
                <li key={i} className="flex items-start text-xs text-white/70">
                  <XCircle className="h-3.5 w-3.5 mr-2 text-destructive/70 shrink-0 mt-0.5" />
                  <span className="leading-tight">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}

export function AiMarketSummaryPanel() {
  const { data: summary, isLoading } = useGetAiMarketSummary({ query: { refetchInterval: 60000 } });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!summary) return null;

  return (
    <Card className="border-border/60 bg-gradient-to-br from-card to-black/40">
      <CardHeader className="py-3 border-b border-border/40">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-primary">
            <Zap className="h-4 w-4" />
            <span>Market Pulse</span>
          </div>
          <Badge variant={
            summary.sentiment === 'BULLISH' ? 'positive' : 
            summary.sentiment === 'BEARISH' ? 'destructive' : 'secondary'
          }>
            {summary.sentiment}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <p className="text-sm text-white/80 leading-relaxed">
          {summary.summary}
        </p>
        
        <div>
          <p className="text-xs font-mono uppercase text-muted-foreground mb-2 border-b border-white/5 pb-1">Key Drivers</p>
          <ul className="space-y-1.5">
            {summary.keyEvents.map((event, i) => (
              <li key={i} className="text-xs text-white/60 flex items-start">
                <span className="text-primary mr-2 font-bold">•</span>
                <span>{event}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
