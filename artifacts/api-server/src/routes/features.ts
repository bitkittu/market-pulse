import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { resolveEffectivePlanKey, resolveUserFeatureAccess } from "../lib/features/resolve.js";

const router: IRouter = Router();

// The resolved feature-access map for the logged-in user's effective plan —
// the frontend's FeatureAccessContext fetches this once per session/plan
// change rather than making one call per feature check.
router.get("/me/features", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const planKey = await resolveEffectivePlanKey(user.id, user.plan);
    const access = await resolveUserFeatureAccess(user.id, planKey);
    res.json({ planKey, features: access });
  } catch (err) {
    console.error("[features] get /me/features error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load feature access" });
  }
});

router.get("/me/feature-usage", requireAuth, async (req, res) => {
  try {
    const usage = await db.featureUsage.forUser(req.user!.id);
    res.json({ usage });
  } catch (err) {
    console.error("[features] get /me/feature-usage error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load feature usage" });
  }
});

export default router;
