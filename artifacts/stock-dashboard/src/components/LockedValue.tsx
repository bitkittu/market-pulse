import { Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

/**
 * Trade levels (entry, stop-loss, target, buy/sell triggers) are a paid
 * feature. Free-plan users see them blurred; Pro/Premium users see the
 * real numbers. Admins never reach these pages (they get the admin panel).
 */
export function useIsLocked() {
  const { user } = useAuth();
  return user?.plan === "free";
}

// Deterministically scramble the digits so the blurred shape still *looks*
// like a price, but the true value never lands in the DOM (can't be read via
// devtools or copy-paste). Same input → same output, so there's no flicker
// on re-render / refetch.
function scramble(text: string) {
  let i = 0;
  return text.replace(/\d/g, () => String((i++ * 7 + 3) % 10));
}

/**
 * Wraps a formatted numeric string. When the current user is on the free
 * plan the value is rendered blurred, unselectable and scrambled; otherwise
 * the real string is shown untouched.
 */
export function LockedValue({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const locked = useIsLocked();
  if (!locked) return <>{children}</>;
  return (
    <span
      aria-hidden="true"
      title="Upgrade to unlock live trade levels"
      className={cn(
        "inline-block blur-[5px] select-none pointer-events-none opacity-90",
        className,
      )}
    >
      {scramble(children)}
    </span>
  );
}

/**
 * A one-line notice explaining why the levels are blurred. Renders nothing
 * for paid users.
 */
export function LockedHint({ fields }: { fields: string }) {
  const locked = useIsLocked();
  if (!locked) return null;
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-primary/25 bg-primary/5 p-3">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-primary">{fields}</span> are hidden
        on the <span className="font-semibold">Free</span> plan. Upgrade to Pro
        to unlock live trade levels.
      </p>
    </div>
  );
}
