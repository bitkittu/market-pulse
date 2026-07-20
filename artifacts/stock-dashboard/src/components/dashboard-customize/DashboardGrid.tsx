import type { ReactNode } from "react";
import { Reorder } from "framer-motion";
import { WidgetShell } from "./WidgetShell";
import { WIDGETS, type WidgetId, type DashboardLayout } from "@/lib/dashboardLayout";

function titleFor(id: WidgetId) {
  return WIDGETS.find((w) => w.id === id)?.title ?? id;
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function DashboardGrid({
  layout, editMode, content, onReorder, onToggleVisibility,
}: {
  layout: DashboardLayout;
  editMode: boolean;
  content: Record<WidgetId, ReactNode>;
  onReorder: (newVisibleOrder: WidgetId[]) => void;
  onToggleVisibility: (id: WidgetId) => void;
}) {
  const visibleIds = layout.widgets.filter((w) => w.visible).map((w) => w.id);

  if (visibleIds.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        All widgets are hidden on this layout. Use "Manage Widgets" to bring some back.
      </div>
    );
  }

  if (!editMode) {
    return (
      <div className="space-y-4">
        {visibleIds.map((id) => <div key={id}>{content[id]}</div>)}
      </div>
    );
  }

  return (
    <Reorder.Group axis="y" values={visibleIds} onReorder={onReorder} className="space-y-4">
      {visibleIds.map((id, idx) => (
        <WidgetShell
          key={id}
          id={id}
          title={titleFor(id)}
          canMoveUp={idx > 0}
          canMoveDown={idx < visibleIds.length - 1}
          onMoveUp={() => onReorder(swap(visibleIds, idx, idx - 1))}
          onMoveDown={() => onReorder(swap(visibleIds, idx, idx + 1))}
          onHide={() => onToggleVisibility(id)}
        >
          {content[id]}
        </WidgetShell>
      ))}
    </Reorder.Group>
  );
}
