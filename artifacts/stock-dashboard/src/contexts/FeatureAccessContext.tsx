import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api, useAuth } from "./AuthContext";

export interface FeatureAccess {
  featureKey: string;
  enabled: boolean;
  isUnlimited: boolean;
  usageLimit: number | null;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  used: number;
  remaining: number | null;
  visibleInMenu: boolean;
  comingSoon: boolean;
  isBeta: boolean;
  badge: "none" | "pro" | "premium" | "enterprise";
  hideCompletely: boolean;
  showUpgradeBanner: boolean;
  readOnly: boolean;
}

interface FeatureAccessContextType {
  planKey: string | null;
  features: Record<string, FeatureAccess>;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const FeatureAccessContext = createContext<FeatureAccessContextType | null>(null);

/**
 * Pure, non-hook version of the access check — for call sites that need to
 * evaluate several features against one already-fetched map (e.g. building a
 * nav lock-state table) without calling a hook once per feature, which the
 * Rules of Hooks disallow inside a loop/callback.
 */
export function evaluateFeatureAccess(access: FeatureAccess | undefined): boolean {
  if (!access || !access.enabled) return false;
  if (access.isUnlimited || access.remaining === null) return true;
  return access.remaining > 0;
}

/**
 * Fetches the resolved feature-access map (GET /me/features, backed by
 * lib/features/resolve.ts on the server) once per login/plan change, rather
 * than one round-trip per feature check. Replaces the old static lookup in
 * lib/plan.ts — MP-PLAN-001 moved plan/feature access to the database.
 */
export function FeatureAccessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [planKey, setPlanKey] = useState<string | null>(null);
  const [features, setFeatures] = useState<Record<string, FeatureAccess>>({});
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setPlanKey(null);
      setFeatures({});
      setIsLoading(false);
      return;
    }
    const res = await api<{ planKey: string; features: Record<string, FeatureAccess> }>("/me/features");
    if (res.ok) {
      const data = res.data as { planKey: string; features: Record<string, FeatureAccess> };
      setPlanKey(data.planKey);
      setFeatures(data.features);
    }
    setIsLoading(false);
  }, [user?.id, user?.plan]);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <FeatureAccessContext.Provider value={{ planKey, features, isLoading, refresh }}>
      {children}
    </FeatureAccessContext.Provider>
  );
}

function useFeatureAccessCtx(): FeatureAccessContextType {
  const ctx = useContext(FeatureAccessContext);
  if (!ctx) throw new Error("useFeatureAccess must be used within FeatureAccessProvider");
  return ctx;
}

/**
 * Same name/signature as the hook lib/plan.ts used to export — every
 * existing call site (IntradayDashboard.tsx, OptionsDashboard.tsx, Home.tsx)
 * keeps working unchanged, only the implementation underneath moved from a
 * static lookup to this context.
 */
export function useFeatureAccess(featureKey: string): boolean {
  const { features } = useFeatureAccessCtx();
  return evaluateFeatureAccess(features[featureKey]);
}

/** Full access detail (limits, remaining, badge, etc.) for UI that needs more than a boolean — usage bars, upgrade dialogs. */
export function useFeatureAccessDetails(featureKey: string): FeatureAccess | undefined {
  const { features } = useFeatureAccessCtx();
  return features[featureKey];
}

export function useFeatureAccessState(): FeatureAccessContextType {
  return useFeatureAccessCtx();
}
