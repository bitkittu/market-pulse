import { LayoutGrid } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { WIDGETS, type WidgetId, type DashboardLayout } from "@/lib/dashboardLayout";

export function WidgetPicker({
  layout, onToggle,
}: {
  layout: DashboardLayout;
  onToggle: (id: WidgetId) => void;
}) {
  const visibleById = new Map(layout.widgets.map((w) => [w.id, w.visible]));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground hover:bg-accent transition-colors">
          <LayoutGrid className="w-3.5 h-3.5" /> Manage Widgets
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <div className="text-xs font-bold text-foreground mb-2 px-1">Widget visibility</div>
        <div className="space-y-0.5">
          {WIDGETS.map((w) => (
            <label
              key={w.id}
              className="flex items-center justify-between gap-3 px-2 py-2 rounded-lg hover:bg-accent cursor-pointer"
            >
              <span className="text-xs font-semibold text-foreground">{w.title}</span>
              <Switch
                checked={visibleById.get(w.id) ?? true}
                onCheckedChange={() => onToggle(w.id)}
              />
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
