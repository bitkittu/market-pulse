import type { ReactNode } from "react";
import { GripVertical, ChevronUp, ChevronDown, EyeOff } from "lucide-react";
import { useDragControls, Reorder } from "framer-motion";
import type { WidgetId } from "@/lib/dashboardLayout";

/** Only ever rendered while the dashboard is in edit mode — see DashboardGrid. */
export function WidgetShell({
  id, title, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onHide, children,
}: {
  id: WidgetId;
  title: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onHide: () => void;
  children: ReactNode;
}) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={dragControls}
      as="div"
      className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/[0.02] p-2 sm:p-3"
    >
      <div className="flex items-center gap-2 mb-2 px-1">
        <button
          onPointerDown={(e) => dragControls.start(e)}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none p-1 -m-1"
          aria-label={`Drag to reorder ${title}`}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <span className="text-xs font-bold text-foreground flex-1">{title}</span>
        <button
          onClick={onMoveUp}
          disabled={!canMoveUp}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
          aria-label={`Move ${title} up`}
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
          aria-label={`Move ${title} down`}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onHide}
          className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground text-[11px] font-semibold"
          aria-label={`Hide ${title}`}
        >
          <EyeOff className="w-3.5 h-3.5" /> Hide
        </button>
      </div>
      <div className="pointer-events-none">{children}</div>
    </Reorder.Item>
  );
}
