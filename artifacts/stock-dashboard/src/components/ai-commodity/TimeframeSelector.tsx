import { cn } from "@/lib/utils";
import { TIMEFRAMES } from "./data";
import type { TimeframeId } from "./types";

export function TimeframeSelector({
  value, onChange,
}: {
  value: TimeframeId;
  onChange: (id: TimeframeId) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf.id}
          onClick={() => onChange(tf.id)}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-bold transition-colors border",
            value === tf.id
              ? "bg-primary text-white border-primary"
              : "bg-transparent text-muted-foreground border-border hover:text-foreground hover:bg-accent",
          )}
        >
          {tf.label}
        </button>
      ))}
    </div>
  );
}
