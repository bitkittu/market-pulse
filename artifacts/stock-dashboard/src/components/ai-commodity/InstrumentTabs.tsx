import { Gem, CircleDollarSign, Fuel, Flame } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { COMMODITIES } from "./data";
import type { CommodityId } from "./types";

const ICONS = {
  gold: Gem,
  silver: CircleDollarSign,
  crudeoil: Fuel,
  naturalgas: Flame,
} as const;

export function InstrumentTabs({
  value, onChange,
}: {
  value: CommodityId;
  onChange: (id: CommodityId) => void;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as CommodityId)}>
      <TabsList className="h-auto flex-wrap gap-1 bg-muted p-1">
        {COMMODITIES.map((c) => {
          const Icon = ICONS[c.icon];
          return (
            <TabsTrigger key={c.id} value={c.id} className="gap-1.5 px-3.5 py-1.5 text-xs font-bold">
              <Icon className="w-3.5 h-3.5" /> {c.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
