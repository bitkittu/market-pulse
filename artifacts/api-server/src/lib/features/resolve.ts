import { db } from "@workspace/db";

export interface FeatureAccess {
  featureKey: string;
  enabled: boolean;
  isUnlimited: boolean;
  usageLimit: number | null;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  used: number;
  /** null = unlimited, or no limit configured (gate is purely enabled/disabled). */
  remaining: number | null;
  visibleInMenu: boolean;
  comingSoon: boolean;
  isBeta: boolean;
  badge: "none" | "pro" | "premium" | "enterprise";
  hideCompletely: boolean;
  showUpgradeBanner: boolean;
  readOnly: boolean;
}

function todayPeriod(): string {
  return new Date().toISOString().slice(0, 10);
}
function monthPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}
/** Used for a usage_limit with no daily/monthly reset — one fixed counter for the life of the account. */
const LIFETIME_PERIOD = "lifetime";

/**
 * A user's effective plan is their current `subscriptions` row when one
 * exists (the source of truth for anyone on a purchased plan, including a
 * custom admin-created one outside the legacy free/pro/premium enum) —
 * otherwise `users.plan` (everyone who predates MP-PLAN-001, or was granted
 * a plan directly via the admin Users table).
 */
export async function resolveEffectivePlanKey(userId: number, legacyPlan: string): Promise<string> {
  const sub = await db.subscriptions.findCurrentForUser(userId);
  if (sub && (sub.status === "active" || sub.status === "past_due")) return sub.planId;
  return legacyPlan;
}

/**
 * The single source of truth for what a user can do — both `requireFeature`
 * (backend authorization) and `GET /me/features` (frontend display) call
 * this. A feature with no matrix row for the plan defaults to disabled
 * (fail closed), never silently open.
 */
export async function resolveUserFeatureAccess(
  userId: number,
  planKey: string,
): Promise<Record<string, FeatureAccess>> {
  const [planFeatures, features] = await Promise.all([db.planFeatures.forPlan(planKey), db.features.all()]);
  const byFeature = new Map(planFeatures.map((pf) => [pf.featureKey, pf]));

  const result: Record<string, FeatureAccess> = {};
  for (const feature of features) {
    if (feature.status !== "active") continue;
    const pf = byFeature.get(feature.featureKey);
    if (!pf) {
      result[feature.featureKey] = {
        featureKey: feature.featureKey, enabled: false, isUnlimited: false,
        usageLimit: null, dailyLimit: null, monthlyLimit: null, used: 0, remaining: 0,
        visibleInMenu: true, comingSoon: false, isBeta: false, badge: "none",
        hideCompletely: false, showUpgradeBanner: true, readOnly: false,
      };
      continue;
    }

    let used = 0;
    let remaining: number | null = null;
    if (pf.enabled && !pf.isUnlimited) {
      const [limit, period] =
        pf.dailyLimit != null ? [pf.dailyLimit, todayPeriod()]
        : pf.monthlyLimit != null ? [pf.monthlyLimit, monthPeriod()]
        : pf.usageLimit != null ? [pf.usageLimit, LIFETIME_PERIOD]
        : [null, null];
      if (limit != null && period != null) {
        const usage = await db.featureUsage.get(userId, feature.featureKey, period);
        used = usage?.count ?? 0;
        remaining = Math.max(0, limit - used);
      }
    }

    result[feature.featureKey] = {
      featureKey: feature.featureKey, enabled: pf.enabled, isUnlimited: pf.isUnlimited,
      usageLimit: pf.usageLimit, dailyLimit: pf.dailyLimit, monthlyLimit: pf.monthlyLimit,
      used, remaining, visibleInMenu: pf.visibleInMenu, comingSoon: pf.comingSoon, isBeta: pf.isBeta,
      badge: pf.badge, hideCompletely: pf.hideCompletely, showUpgradeBanner: pf.showUpgradeBanner,
      readOnly: pf.readOnly,
    };
  }
  return result;
}

export function canAccessFeature(access: FeatureAccess | undefined): boolean {
  if (!access || !access.enabled) return false;
  if (access.isUnlimited || access.remaining === null) return true;
  return access.remaining > 0;
}

/** The period key `recordFeatureUsage` should increment for a given plan_features row — mirrors the lookup above. */
export function usagePeriodFor(pf: { dailyLimit: number | null; monthlyLimit: number | null; usageLimit: number | null }): string | null {
  if (pf.dailyLimit != null) return todayPeriod();
  if (pf.monthlyLimit != null) return monthPeriod();
  if (pf.usageLimit != null) return LIFETIME_PERIOD;
  return null;
}

/** Increments today's/this-month's/lifetime usage counter for a feature, if that feature is actually limited for the user's plan. No-op otherwise (unlimited features aren't tracked). */
export async function recordFeatureUsage(userId: number, planKey: string, featureKey: string): Promise<void> {
  const pf = await db.planFeatures.find(planKey, featureKey);
  if (!pf) return;
  const period = usagePeriodFor(pf);
  if (!period) return;
  await db.featureUsage.increment(userId, featureKey, period);
}
