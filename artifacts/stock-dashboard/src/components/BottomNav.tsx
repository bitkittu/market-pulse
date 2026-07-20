import { useState } from "react";
import {
  LayoutDashboard, Briefcase, Store, MoreHorizontal,
  Newspaper, BarChart2, Link2, User, Sun, Moon, LogOut,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { MARKETS, type MarketId, type Tab } from "@/lib/marketHub";
import { MarketHubMenu } from "@/components/AppSidebar";

function BottomNavButton({
  icon: Icon, label, active, onClick,
}: {
  icon: typeof LayoutDashboard;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );
}

function MoreRow({
  icon: Icon, label, onClick, danger,
}: {
  icon: typeof LayoutDashboard;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-left transition-colors rounded-lg ${
        danger ? "text-red-500 hover:bg-red-500/10" : "text-foreground hover:bg-accent"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" /> {label}
    </button>
  );
}

export function BottomNav({
  tab, goTab, moduleLocked, theme, setTheme, onAccountSettings,
}: {
  tab: Tab;
  goTab: (t: Tab) => void;
  moduleLocked: Record<MarketId, boolean>;
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  onAccountSettings: () => void;
}) {
  const { logout } = useAuth();
  const [marketHubOpen, setMarketHubOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const inMarketHub = MARKETS.some((m) => tab.startsWith(`${m.id}-`));

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 flex items-stretch">
        <BottomNavButton icon={LayoutDashboard} label="Home" active={tab === "home"} onClick={() => goTab("home")} />
        <BottomNavButton icon={Store} label="Market Hub" active={inMarketHub} onClick={() => setMarketHubOpen(true)} />
        <BottomNavButton icon={Briefcase} label="Portfolio" active={tab === "portfolio"} onClick={() => goTab("portfolio")} />
        <BottomNavButton icon={MoreHorizontal} label="More" active={moreOpen} onClick={() => setMoreOpen(true)} />
      </nav>

      <Sheet open={marketHubOpen} onOpenChange={setMarketHubOpen}>
        <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
          <SheetHeader className="px-4 pt-4 pb-2 text-left">
            <SheetTitle className="flex items-center gap-1.5 text-base">
              <Store className="w-4 h-4" /> Market Hub
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            <MarketHubMenu
              tab={tab}
              goTab={goTab}
              moduleLocked={moduleLocked}
              onNavigate={() => setMarketHubOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] flex flex-col p-0">
          <SheetHeader className="px-4 pt-4 pb-2 text-left">
            <SheetTitle className="text-base">More</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
            <MoreRow icon={Newspaper} label="Insights" onClick={() => { goTab("insights"); setMoreOpen(false); }} />
            <MoreRow icon={BarChart2} label="Performance" onClick={() => { goTab("performance"); setMoreOpen(false); }} />
            <MoreRow icon={Link2} label="API" onClick={() => { goTab("api"); setMoreOpen(false); }} />
            <MoreRow icon={User} label="Account Settings" onClick={() => { onAccountSettings(); setMoreOpen(false); }} />
            <MoreRow
              icon={theme === "dark" ? Moon : Sun}
              label={theme === "dark" ? "Switch to Day Mode" : "Switch to Night Mode"}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            />
            <div className="my-1 border-t border-border" />
            <MoreRow icon={LogOut} label="Sign Out" danger onClick={() => { setMoreOpen(false); logout(); }} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
