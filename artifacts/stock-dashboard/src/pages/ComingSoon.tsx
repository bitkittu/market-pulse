import { Clock, Sparkles, ArrowLeft, Home as HomeIcon } from "lucide-react";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  MARKETS, SECTIONS, SECTION_CONTENT, ACCENT_CLASSES,
  type MarketId, type SectionId,
} from "@/lib/marketHub";

const PAID_BADGE: Record<"pro" | "premium", { label: string; className: string; noteColor: string }> = {
  pro: {
    label: "Early Access — Pro",
    className: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
    noteColor: "text-violet-600 dark:text-violet-400",
  },
  premium: {
    label: "Early Access — Premium",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    noteColor: "text-amber-600 dark:text-amber-400",
  },
};

export function ComingSoonPage({
  marketId, section, onHome, onMarket,
}: {
  marketId: MarketId;
  section: SectionId;
  onHome: () => void;
  onMarket: () => void;
}) {
  const { user } = useAuth();
  const mod = MARKETS.find((m) => m.id === marketId)!;
  const sec = SECTIONS.find((s) => s.id === section)!;
  const content = SECTION_CONTENT[section];
  const accent = ACCENT_CLASSES[mod.accent];
  const SectionIcon = sec.icon;
  const ModuleIcon = mod.icon;

  const paidBadge = user?.plan === "pro" || user?.plan === "premium" ? PAID_BADGE[user.plan] : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#" onClick={(e) => { e.preventDefault(); onHome(); }} className="flex items-center gap-1">
              <HomeIcon className="w-3.5 h-3.5" /> Dashboard
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="text-muted-foreground/70">
            Market Hub
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="#" onClick={(e) => { e.preventDefault(); onMarket(); }} className="flex items-center gap-1">
              <ModuleIcon className="w-3.5 h-3.5" /> {mod.label}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{sec.label}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 text-center sm:p-12">
        <div className={cn("pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full blur-3xl", accent.glow)} />
        <div className="relative mx-auto flex max-w-lg flex-col items-center gap-4">
          <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl border", accent.iconBg, accent.iconBorder)}>
            <SectionIcon className={cn("h-6 w-6", accent.text)} />
          </div>

          <div className={cn("flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider", accent.text)}>
            <ModuleIcon className="w-3.5 h-3.5" /> {mod.label}
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-foreground">{content.title}</h1>

          {paidBadge ? (
            <Badge variant="outline" className={cn("gap-1.5", paidBadge.className)}>
              <Sparkles className="w-3 h-3" /> {paidBadge.label}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1.5">
              <Clock className="w-3 h-3" /> Coming Soon
            </Badge>
          )}

          <p className="text-sm text-muted-foreground">{content.description}</p>

          {paidBadge && (
            <p className={cn("text-xs font-semibold", paidBadge.noteColor)}>
              As a {user?.plan === "premium" ? "Premium" : "Pro"} member, you'll get early access as soon as this launches.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h2 className="text-sm font-bold text-foreground mb-4">What's planned</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {content.features.map((feature) => (
            <div
              key={feature}
              className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/50 px-3.5 py-2.5 text-xs font-semibold text-muted-foreground"
            >
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", accent.dot)} />
              {feature}
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onMarket}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to {mod.label} Dashboard
      </button>
    </div>
  );
}
