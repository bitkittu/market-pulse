import { Newspaper, Globe } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommodityNews } from "./data";
import type { CommodityId } from "./types";

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NewsFeed({ commodityId }: { commodityId: CommodityId }) {
  const { data: news, isLoading } = useCommodityNews(commodityId);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="text-sm font-black text-foreground flex items-center gap-1.5 mb-4">
        <Newspaper className="w-4 h-4 text-primary" /> Related News
      </h2>

      {isLoading || !news ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {news.map((item, i) => (
            <div
              key={item.id}
              className="rounded-xl border border-border bg-background/50 p-3.5 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className="text-[10px] font-bold text-primary/70 bg-primary/10 px-2 py-0.5 rounded-full shrink-0">#{i + 1}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(item.publishedAt)}</span>
              </div>
              <h3 className="text-xs font-bold text-foreground leading-snug mb-1">{item.title}</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">{item.summary}</p>
              <div className="flex items-center gap-1">
                <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-[10px] text-muted-foreground">{item.source}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
