import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The "Why?" affordance placed at the end of every pick row (§2).
 *
 * Signal and confidence cells open the same panel, so this is a visible entry
 * point rather than the only one.
 */
export function WhyButton({
  active,
  onClick,
  className,
  label = "Why?",
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary",
        className
      )}
    >
      <Sparkles className="h-3 w-3" aria-hidden="true" />
      {active ? "Hide" : label}
    </button>
  );
}
