import { Router, type IRouter } from "express";
import { db, type PlanStatus, type FeatureStatus, type FeatureBadge } from "@workspace/db";
import { requireAuth, requirePermission } from "../lib/auth.js";

const router: IRouter = Router();

// requireAuth/requirePermission are applied per-route, not as a blanket
// `router.use()` — see the identical note in admin-payments.ts/admin-email.ts.
// Reuses "payments.manage" rather than a new permission — Plans/Features/
// Plan Features are all part of the same "Subscription Management" admin
// area as the payment settings/pricing screens already gated by it.
const guard = [requireAuth, requirePermission("payments.manage")] as const;

const PLAN_STATUSES: PlanStatus[] = ["active", "inactive", "archived"];
const FEATURE_STATUSES: FeatureStatus[] = ["active", "inactive"];
const FEATURE_BADGES: FeatureBadge[] = ["none", "pro", "premium", "enterprise"];

// ── Plans ─────────────────────────────────────────────────────────────────

router.get("/admin/plans", ...guard, async (_req, res) => {
  try {
    const plans = await db.plans.all();
    res.json({ plans });
  } catch (err) {
    console.error("[admin] list plans error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load plans" });
  }
});

router.post("/admin/plans", ...guard, async (req, res) => {
  try {
    const { planKey, name, description, trialDays, displayOrder, isPopular, isRecommended, status, color, icon,
      maxUsers, maxDevices, maxWatchlists, maxAlerts, maxApiCalls, maxAiRequests, storageLimitMb, supportType } =
      req.body ?? {};

    if (typeof planKey !== "string" || !/^[a-z][a-z0-9_]{1,39}$/.test(planKey)) {
      res.status(400).json({ error: "Plan key must be lowercase letters, numbers, and underscores (2-40 chars)" });
      return;
    }
    if (typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ error: "Plan name is required" });
      return;
    }
    if (await db.plans.findByKey(planKey)) {
      res.status(409).json({ error: "A plan with this key already exists" });
      return;
    }

    const created = await db.plans.insert({
      planKey,
      name: name.trim(),
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      trialDays: Number.isInteger(trialDays) ? trialDays : 0,
      displayOrder: Number.isInteger(displayOrder) ? displayOrder : 0,
      isPopular: isPopular === true,
      isRecommended: isRecommended === true,
      status: PLAN_STATUSES.includes(status) ? status : "active",
      color: typeof color === "string" ? color : null,
      icon: typeof icon === "string" ? icon : null,
      maxUsers: Number.isInteger(maxUsers) ? maxUsers : null,
      maxDevices: Number.isInteger(maxDevices) ? maxDevices : null,
      maxWatchlists: Number.isInteger(maxWatchlists) ? maxWatchlists : null,
      maxAlerts: Number.isInteger(maxAlerts) ? maxAlerts : null,
      maxApiCalls: Number.isInteger(maxApiCalls) ? maxApiCalls : null,
      maxAiRequests: Number.isInteger(maxAiRequests) ? maxAiRequests : null,
      storageLimitMb: Number.isInteger(storageLimitMb) ? storageLimitMb : null,
      supportType: typeof supportType === "string" ? supportType : null,
    });
    res.status(201).json({ plan: created });
  } catch (err) {
    console.error("[admin] create plan error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to create plan" });
  }
});

router.put("/admin/plans/:planKey", ...guard, async (req, res) => {
  try {
    // Multiple middleware before the handler loses Express's literal-path
    // param inference — see the identical note in admin-email.ts.
    const planKey = req.params.planKey as string;
    if (!(await db.plans.findByKey(planKey))) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    const body = req.body ?? {};
    if (body.status !== undefined && !PLAN_STATUSES.includes(body.status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    await db.plans.update(planKey, {
      name: typeof body.name === "string" ? body.name.trim() : undefined,
      description: body.description === null ? null : typeof body.description === "string" ? body.description.trim() : undefined,
      trialDays: Number.isInteger(body.trialDays) ? body.trialDays : undefined,
      displayOrder: Number.isInteger(body.displayOrder) ? body.displayOrder : undefined,
      isPopular: typeof body.isPopular === "boolean" ? body.isPopular : undefined,
      isRecommended: typeof body.isRecommended === "boolean" ? body.isRecommended : undefined,
      status: body.status,
      color: body.color === null ? null : typeof body.color === "string" ? body.color : undefined,
      icon: body.icon === null ? null : typeof body.icon === "string" ? body.icon : undefined,
      maxUsers: body.maxUsers === null ? null : Number.isInteger(body.maxUsers) ? body.maxUsers : undefined,
      maxDevices: body.maxDevices === null ? null : Number.isInteger(body.maxDevices) ? body.maxDevices : undefined,
      maxWatchlists: body.maxWatchlists === null ? null : Number.isInteger(body.maxWatchlists) ? body.maxWatchlists : undefined,
      maxAlerts: body.maxAlerts === null ? null : Number.isInteger(body.maxAlerts) ? body.maxAlerts : undefined,
      maxApiCalls: body.maxApiCalls === null ? null : Number.isInteger(body.maxApiCalls) ? body.maxApiCalls : undefined,
      maxAiRequests: body.maxAiRequests === null ? null : Number.isInteger(body.maxAiRequests) ? body.maxAiRequests : undefined,
      storageLimitMb: body.storageLimitMb === null ? null : Number.isInteger(body.storageLimitMb) ? body.storageLimitMb : undefined,
      supportType: body.supportType === null ? null : typeof body.supportType === "string" ? body.supportType : undefined,
    });

    const updated = await db.plans.findByKey(planKey);
    res.json({ plan: updated });
  } catch (err) {
    console.error("[admin] update plan error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to update plan" });
  }
});

router.delete("/admin/plans/:planKey", ...guard, async (req, res) => {
  try {
    const planKey = req.params.planKey as string;
    const deleted = await db.plans.delete(planKey);
    if (!deleted) {
      res.status(409).json({ error: "This plan has active subscribers and cannot be deleted" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[admin] delete plan error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to delete plan" });
  }
});

// ── Feature categories (read-only — seeded, not admin-editable yet) ────────

router.get("/admin/feature-categories", ...guard, async (_req, res) => {
  try {
    const categories = await db.featureCategories.all();
    res.json({ categories });
  } catch (err) {
    console.error("[admin] list feature categories error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load feature categories" });
  }
});

// ── Features ─────────────────────────────────────────────────────────────

router.get("/admin/features", ...guard, async (_req, res) => {
  try {
    const features = await db.features.all();
    res.json({ features });
  } catch (err) {
    console.error("[admin] list features error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load features" });
  }
});

router.post("/admin/features", ...guard, async (req, res) => {
  try {
    const { featureKey, name, description, categoryKey, parentModule, displayOrder, icon, status } = req.body ?? {};

    if (typeof featureKey !== "string" || !/^[a-z][a-z0-9_]{1,59}$/.test(featureKey)) {
      res.status(400).json({ error: "Feature key must be lowercase letters, numbers, and underscores (2-60 chars)" });
      return;
    }
    if (typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ error: "Feature name is required" });
      return;
    }
    if (typeof categoryKey !== "string" || !(await db.featureCategories.all()).some((c) => c.categoryKey === categoryKey)) {
      res.status(400).json({ error: "Invalid category" });
      return;
    }
    if (await db.features.findByKey(featureKey)) {
      res.status(409).json({ error: "A feature with this key already exists" });
      return;
    }

    const created = await db.features.insert({
      featureKey,
      name: name.trim(),
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      categoryKey,
      parentModule: typeof parentModule === "string" && parentModule.trim() ? parentModule.trim() : null,
      displayOrder: Number.isInteger(displayOrder) ? displayOrder : 0,
      icon: typeof icon === "string" ? icon : null,
      status: FEATURE_STATUSES.includes(status) ? status : "active",
    });
    res.status(201).json({ feature: created });
  } catch (err) {
    console.error("[admin] create feature error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to create feature" });
  }
});

router.put("/admin/features/:featureKey", ...guard, async (req, res) => {
  try {
    const featureKey = req.params.featureKey as string;
    if (!(await db.features.findByKey(featureKey))) {
      res.status(404).json({ error: "Feature not found" });
      return;
    }

    const body = req.body ?? {};
    if (body.status !== undefined && !FEATURE_STATUSES.includes(body.status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    await db.features.update(featureKey, {
      name: typeof body.name === "string" ? body.name.trim() : undefined,
      description: body.description === null ? null : typeof body.description === "string" ? body.description.trim() : undefined,
      categoryKey: typeof body.categoryKey === "string" ? body.categoryKey : undefined,
      parentModule: body.parentModule === null ? null : typeof body.parentModule === "string" ? body.parentModule : undefined,
      displayOrder: Number.isInteger(body.displayOrder) ? body.displayOrder : undefined,
      icon: body.icon === null ? null : typeof body.icon === "string" ? body.icon : undefined,
      status: body.status,
    });

    const updated = await db.features.findByKey(featureKey);
    res.json({ feature: updated });
  } catch (err) {
    console.error("[admin] update feature error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to update feature" });
  }
});

// ── Plan Features matrix ────────────────────────────────────────────────────

router.get("/admin/plan-features", ...guard, async (_req, res) => {
  try {
    const planFeatures = await db.planFeatures.all();
    res.json({ planFeatures });
  } catch (err) {
    console.error("[admin] list plan features error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load the plan/feature matrix" });
  }
});

// Saves one matrix cell at a time — the admin grid fires a PUT per checkbox/
// limit-field edit rather than submitting the whole matrix.
router.put("/admin/plan-features/:planKey/:featureKey", ...guard, async (req, res) => {
  try {
    const planKey = req.params.planKey as string;
    const featureKey = req.params.featureKey as string;
    if (!(await db.plans.findByKey(planKey))) {
      res.status(400).json({ error: "Invalid plan" });
      return;
    }
    if (!(await db.features.findByKey(featureKey))) {
      res.status(400).json({ error: "Invalid feature" });
      return;
    }

    const body = req.body ?? {};
    if (body.badge !== undefined && !FEATURE_BADGES.includes(body.badge)) {
      res.status(400).json({ error: "Invalid badge" });
      return;
    }
    const existing = await db.planFeatures.find(planKey, featureKey);

    await db.planFeatures.upsert(planKey, featureKey, {
      enabled: typeof body.enabled === "boolean" ? body.enabled : (existing?.enabled ?? false),
      usageLimit: body.usageLimit === null ? null : Number.isInteger(body.usageLimit) ? body.usageLimit : (existing?.usageLimit ?? null),
      dailyLimit: body.dailyLimit === null ? null : Number.isInteger(body.dailyLimit) ? body.dailyLimit : (existing?.dailyLimit ?? null),
      monthlyLimit: body.monthlyLimit === null ? null : Number.isInteger(body.monthlyLimit) ? body.monthlyLimit : (existing?.monthlyLimit ?? null),
      isUnlimited: typeof body.isUnlimited === "boolean" ? body.isUnlimited : (existing?.isUnlimited ?? false),
      visibleInMenu: typeof body.visibleInMenu === "boolean" ? body.visibleInMenu : (existing?.visibleInMenu ?? true),
      comingSoon: typeof body.comingSoon === "boolean" ? body.comingSoon : (existing?.comingSoon ?? false),
      isBeta: typeof body.isBeta === "boolean" ? body.isBeta : (existing?.isBeta ?? false),
      badge: body.badge ?? existing?.badge ?? "none",
      hideCompletely: typeof body.hideCompletely === "boolean" ? body.hideCompletely : (existing?.hideCompletely ?? false),
      showUpgradeBanner: typeof body.showUpgradeBanner === "boolean" ? body.showUpgradeBanner : (existing?.showUpgradeBanner ?? true),
      readOnly: typeof body.readOnly === "boolean" ? body.readOnly : (existing?.readOnly ?? false),
    });

    const saved = await db.planFeatures.find(planKey, featureKey);
    res.json({ planFeature: saved });
  } catch (err) {
    console.error("[admin] update plan feature error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to update plan feature" });
  }
});

// ── Feature usage (read-only aggregate) ─────────────────────────────────────

router.get("/admin/feature-usage", ...guard, async (req, res) => {
  try {
    const period = typeof req.query.period === "string" && req.query.period ? req.query.period : new Date().toISOString().slice(0, 7);
    const usage = await db.featureUsage.aggregateForPeriod(period);
    res.json({ period, usage });
  } catch (err) {
    console.error("[admin] get feature usage error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load feature usage" });
  }
});

export default router;
