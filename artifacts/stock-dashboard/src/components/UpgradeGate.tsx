import type { ReactNode } from "react";
import { Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Full-section lock shown in place of a feature that the current plan can't
 * access (e.g. Intraday / Options predictions, API settings for free users).
 */
export function UpgradeGate({
  title,
  description,
  plan = "Pro",
  className,
}: {
  title: string;
  description?: string;
  plan?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-primary/25 bg-card p-8 text-center sm:p-12",
        className,
      )}
    >
      {/* soft glow backdrop */}
      <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative mx-auto flex max-w-md flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-black text-foreground">{title}</h3>
          {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Available on the {plan} plan
        </div>
        <p className="text-[11px] text-muted-foreground">
          See what each plan includes in{" "}
          <span className="font-semibold text-foreground">Settings → Your Plan</span>.
        </p>
      </div>
    </div>
  );
}

/**
 * Locks an inline panel: renders its real content blurred underneath a
 * centered "upgrade to unlock" ribbon. Keeps the panel's footprint so the
 * layout doesn't jump between plans.
 */
export function LockOverlay({
  label,
  plan = "Pro",
  children,
}: {
  label: string;
  plan?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[6px]" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/30">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/95 px-4 py-1.5 text-xs font-bold text-primary shadow-lg">
          <Lock className="h-3.5 w-3.5" />
          {label} — {plan} feature
        </div>
      </div>
    </div>
  );
}
