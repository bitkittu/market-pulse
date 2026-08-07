import { Router, type IRouter } from "express";
import { db, type PaymentSettingsRow, type PlanId, type BillingCycle } from "@workspace/db";
import { requireAuth, requirePermission } from "../lib/auth.js";
import { encryptSecret } from "../lib/payments/index.js";

const router: IRouter = Router();

// requireAuth/requirePermission are applied per-route, not as a blanket
// `router.use()` — every router in routes/index.ts is mounted with no path
// prefix, so a path-less `.use()` here would run for every request that
// falls through earlier routers, not just this file's own `/admin/*` paths.
const guard = [requireAuth, requirePermission("payments.manage")] as const;

const PLAN_IDS: PlanId[] = ["pro", "premium"];
const BILLING_CYCLES: BillingCycle[] = ["monthly", "annual"];

function maskPaymentSettings(row: PaymentSettingsRow | null) {
  if (!row) {
    return {
      razorpayKeyId: "",
      hasRazorpaySecret: false,
      hasRazorpayWebhookSecret: false,
      stripePublishableKey: "",
      hasStripeSecret: false,
      hasStripeWebhookSecret: false,
      updatedAt: null,
    };
  }
  return {
    razorpayKeyId: row.razorpayKeyId ?? "",
    hasRazorpaySecret: Boolean(row.razorpayKeySecretEncrypted),
    hasRazorpayWebhookSecret: Boolean(row.razorpayWebhookSecretEncrypted),
    stripePublishableKey: row.stripePublishableKey ?? "",
    hasStripeSecret: Boolean(row.stripeSecretKeyEncrypted),
    hasStripeWebhookSecret: Boolean(row.stripeWebhookSecretEncrypted),
    updatedAt: row.updatedAt,
  };
}

// ── Provider credentials ─────────────────────────────────────────────────────

router.get("/admin/payment-settings", ...guard, async (_req, res) => {
  try {
    const row = await db.paymentSettings.get();
    res.json(maskPaymentSettings(row));
  } catch (err) {
    console.error("[admin] get payment settings error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load payment settings" });
  }
});

router.put("/admin/payment-settings", ...guard, async (req, res) => {
  try {
    const {
      razorpayKeyId, razorpayKeySecret, razorpayWebhookSecret,
      stripePublishableKey, stripeSecretKey, stripeWebhookSecret,
    } = req.body ?? {};

    if (razorpayKeyId !== undefined && typeof razorpayKeyId !== "string") {
      res.status(400).json({ error: "Invalid Razorpay key id" });
      return;
    }
    if (stripePublishableKey !== undefined && typeof stripePublishableKey !== "string") {
      res.status(400).json({ error: "Invalid Stripe publishable key" });
      return;
    }

    // Only touch a secret when the admin actually entered a new one —
    // otherwise leave the stored ciphertext as-is, same convention as
    // admin-email.ts's SMTP password handling.
    await db.paymentSettings.upsert({
      razorpayKeyId: typeof razorpayKeyId === "string" && razorpayKeyId.trim() ? razorpayKeyId.trim() : null,
      ...(typeof razorpayKeySecret === "string" && razorpayKeySecret.length > 0
        ? { razorpayKeySecretEncrypted: encryptSecret(razorpayKeySecret) }
        : {}),
      ...(typeof razorpayWebhookSecret === "string" && razorpayWebhookSecret.length > 0
        ? { razorpayWebhookSecretEncrypted: encryptSecret(razorpayWebhookSecret) }
        : {}),
      stripePublishableKey:
        typeof stripePublishableKey === "string" && stripePublishableKey.trim() ? stripePublishableKey.trim() : null,
      ...(typeof stripeSecretKey === "string" && stripeSecretKey.length > 0
        ? { stripeSecretKeyEncrypted: encryptSecret(stripeSecretKey) }
        : {}),
      ...(typeof stripeWebhookSecret === "string" && stripeWebhookSecret.length > 0
        ? { stripeWebhookSecretEncrypted: encryptSecret(stripeWebhookSecret) }
        : {}),
      updatedBy: req.user!.id,
    });

    const row = await db.paymentSettings.get();
    res.json(maskPaymentSettings(row));
  } catch (err) {
    console.error("[admin] save payment settings error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to save payment settings" });
  }
});

// ── Plan catalog ──────────────────────────────────────────────────────────────

router.get("/admin/subscription-plans", ...guard, async (_req, res) => {
  try {
    const plans = await db.subscriptionPlans.all();
    res.json({ plans });
  } catch (err) {
    console.error("[admin] list subscription plans error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load subscription plans" });
  }
});

router.put("/admin/subscription-plans/:planId/:billingCycle", ...guard, async (req, res) => {
  try {
    // Spreading the guard middleware array loses Express's literal-path param
    // inference — see the identical note in admin-email.ts.
    const planId = req.params.planId as string;
    const billingCycle = req.params.billingCycle as string;
    if (!PLAN_IDS.includes(planId as PlanId) || !BILLING_CYCLES.includes(billingCycle as BillingCycle)) {
      res.status(400).json({ error: "Invalid plan or billing cycle" });
      return;
    }

    const { amountInrPaise, amountUsdCents, razorpayPlanId, stripePriceId, active } = req.body ?? {};
    if (amountInrPaise !== undefined && (!Number.isInteger(amountInrPaise) || amountInrPaise < 0)) {
      res.status(400).json({ error: "amountInrPaise must be a non-negative integer" });
      return;
    }
    if (amountUsdCents !== undefined && (!Number.isInteger(amountUsdCents) || amountUsdCents < 0)) {
      res.status(400).json({ error: "amountUsdCents must be a non-negative integer" });
      return;
    }

    await db.subscriptionPlans.update(planId as PlanId, billingCycle as BillingCycle, {
      amountInrPaise: typeof amountInrPaise === "number" ? amountInrPaise : undefined,
      amountUsdCents: typeof amountUsdCents === "number" ? amountUsdCents : undefined,
      razorpayPlanId: razorpayPlanId === null ? null : typeof razorpayPlanId === "string" ? razorpayPlanId.trim() : undefined,
      stripePriceId: stripePriceId === null ? null : typeof stripePriceId === "string" ? stripePriceId.trim() : undefined,
      active: typeof active === "boolean" ? active : undefined,
    });

    const plan = await db.subscriptionPlans.findByPlanCycle(planId as PlanId, billingCycle as BillingCycle);
    res.json({ plan });
  } catch (err) {
    console.error("[admin] update subscription plan error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to update subscription plan" });
  }
});

// ── Subscriptions / invoices (read-only) ─────────────────────────────────────

router.get("/admin/subscriptions", ...guard, async (req, res) => {
  try {
    const { limit } = req.query;
    const subscriptions = await db.subscriptions.all({
      limit: typeof limit === "string" && limit ? Number(limit) : undefined,
    });
    res.json({ subscriptions });
  } catch (err) {
    console.error("[admin] list subscriptions error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load subscriptions" });
  }
});

router.get("/admin/invoices", ...guard, async (req, res) => {
  try {
    const { limit } = req.query;
    const invoices = await db.invoices.all({
      limit: typeof limit === "string" && limit ? Number(limit) : undefined,
    });
    res.json({ invoices });
  } catch (err) {
    console.error("[admin] list invoices error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load invoices" });
  }
});

export default router;
