import { useEffect, useState } from "react";
import {
  LayoutDashboard, Briefcase, Newspaper, BarChart2, Link2, ChevronRight, Lock,
  TrendingUp, Store,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  MARKETS, SECTIONS, ACCENT_CLASSES, marketTab,
  type MarketId, type Tab,
} from "@/lib/marketHub";

const GENERAL_ITEMS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "home",        label: "Dashboard",  icon: LayoutDashboard },
  { id: "insights",    label: "Insights",   icon: Newspaper },
  { id: "portfolio",   label: "Portfolio",  icon: Briefcase },
  { id: "performance", label: "Performance", icon: BarChart2 },
  { id: "api",         label: "API",        icon: Link2 },
];

/**
 * The 5-market x 7-section Market Hub tree. Shared between the desktop/
 * tablet sidebar and the mobile "Market Hub" sheet so both stay in sync
 * with a single MARKETS/SECTIONS-driven render — both call sites are
 * descendants of the same SidebarProvider (mounted once, high up in
 * AppShell), so SidebarMenuButton's internal useSidebar() call resolves
 * fine even inside the mobile Sheet's portal.
 */
export function MarketHubMenu({
  tab, goTab, moduleLocked, onNavigate,
}: {
  tab: Tab;
  goTab: (t: Tab) => void;
  moduleLocked: Record<MarketId, boolean>;
  /** Called after navigating to a leaf — used by the mobile sheet to close itself. */
  onNavigate?: () => void;
}) {
  const currentMarket = MARKETS.find((m) => tab.startsWith(`${m.id}-`))?.id ?? null;
  const [expandedMarket, setExpandedMarket] = useState<MarketId | null>(currentMarket);

  useEffect(() => {
    if (currentMarket) setExpandedMarket(currentMarket);
  }, [currentMarket]);

  return (
    <SidebarMenu>
      {MARKETS.map((mkt) => {
        const MarketIcon = mkt.icon;
        const accent = ACCENT_CLASSES[mkt.accent];
        const isExpanded = expandedMarket === mkt.id;
        const isActiveMarket = currentMarket === mkt.id;

        return (
          <Collapsible
            key={mkt.id}
            asChild
            open={isExpanded}
            onOpenChange={(open) => setExpandedMarket(open ? mkt.id : null)}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton isActive={isActiveMarket} tooltip={mkt.label}>
                  <MarketIcon className={accent.text} />
                  <span>{mkt.label}</span>
                  <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {SECTIONS.map((sec) => {
                    const SecIcon = sec.icon;
                    const t = marketTab(mkt.id, sec.id);
                    const locked = sec.id === "dashboard" && moduleLocked[mkt.id];
                    return (
                      <SidebarMenuSubItem key={sec.id}>
                        <SidebarMenuSubButton
                          isActive={tab === t}
                          onClick={() => { goTab(t); onNavigate?.(); }}
                          className={cn("cursor-pointer", tab !== t && accent.text)}
                        >
                          <SecIcon />
                          <span>{sec.label}</span>
                          {locked && <Lock className="ml-auto h-3 w-3 shrink-0 opacity-60" />}
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        );
      })}
    </SidebarMenu>
  );
}

export function AppSidebar({
  tab, goTab, moduleLocked,
}: {
  tab: Tab;
  goTab: (t: Tab) => void;
  moduleLocked: Record<MarketId, boolean>;
}) {
  return (
    <Sidebar collapsible="icon" className="hidden md:flex">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <span className="text-foreground font-bold text-sm tracking-wide">Market</span>
            <span className="text-primary font-bold text-sm tracking-wide ml-0.5">Pulse AI</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>General</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {GENERAL_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={tab === item.id}
                      tooltip={item.label}
                      onClick={() => goTab(item.id)}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5" /> Market Hub
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <MarketHubMenu tab={tab} goTab={goTab} moduleLocked={moduleLocked} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
