import { Router, type IRouter } from "express";
import { db, type PlanId, type BillingCycle, type Currency, type SubscriptionRow } from "@workspace/db";
import { requireAuth, resolveBaseUrl } from "../lib/auth.js";
import { sendTemplatedEmail } from "../lib/email/index.js";
import { resolveProvider, resolveWebhookSecret, type WebhookEvent } from "../lib/payments/index.js";

const router: IRouter = Router();

const PLAN_IDS: PlanId[] = ["pro", "premium"];
const BILLING_CYCLES: BillingCycle[] = ["monthly", "annual"];

function amountFor(plan: { amountInrPaise: number; amountUsdCents: number }, currency: Currency): number {
  return currency === "INR" ? plan.amountInrPaise : plan.amountUsdCents;
}

// ── Plan catalog (public) ────────────────────────────────────────────────────

router.get("/payments/plans", async (_req, res) => {
  try {
    const plans = await db.subscriptionPlans.all();
    res.json({
      plans: plans
        .filter((p) => p.active)
        .map((p) => ({
          planId: p.planId,
          billingCycle: p.billingCycle,
          amountInrPaise: p.amountInrPaise,
          amountUsdCents: p.amountUsdCents,
        })),
    });
  } catch (err) {
    console.error("[payments] list plans error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load plans" });
  }
});

// ── Checkout ──────────────────────────────────────────────────────────────────

router.post("/payments/checkout", requireAuth, async (req, res) => {
  try {
    const { planId, billingCycle, currency } = req.body ?? {};

    if (!PLAN_IDS.includes(planId)) {
      res.status(400).json({ error: "Invalid plan" });
      return;
    }
    if (!BILLING_CYCLES.includes(billingCycle)) {
      res.status(400).json({ error: "Invalid billing cycle" });
      return;
    }
    if (currency !== "INR" && currency !== "USD") {
      res.status(400).json({ error: "Invalid currency" });
      return;
    }

    const plan = await db.subscriptionPlans.findByPlanCycle(planId, billingCycle);
    if (!plan || !plan.active || amountFor(plan, currency) <= 0) {
      res.status(503).json({ error: "This plan is not available for purchase yet" });
      return;
    }
    const providerPlanId = currency === "INR" ? plan.razorpayPlanId : plan.stripePriceId;
    if (!providerPlanId) {
      res.status(503).json({ error: "This plan is not configured for checkout yet" });
      return;
    }

    const provider = currency === "INR" ? "razorpay" : "stripe";
    const adapter = await resolveProvider(provider);
    if (!adapter) {
      res.status(503).json({ error: `${provider === "razorpay" ? "Razorpay" : "Stripe"} is not configured yet` });
      return;
    }

    const user = req.user!;
    const baseUrl = resolveBaseUrl(req);
    const checkout = await adapter.createCheckout({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      providerPlanId,
      successUrl: `${baseUrl}/settings?checkout=success`,
      cancelUrl: `${baseUrl}/settings?checkout=cancelled`,
    });

    await db.subscriptions.insert({
      userId: user.id,
      planId,
      billingCycle,
      provider,
      providerSubscriptionId: checkout.providerSubscriptionId,
      providerCustomerId: checkout.providerCustomerId,
      status: "created",
    });

    res.json({
      provider,
      subscriptionId: checkout.providerSubscriptionId,
      razorpayKeyId: checkout.razorpayKeyId,
      redirectUrl: checkout.redirectUrl,
    });
  } catch (err) {
    console.error("[payments] checkout error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to start checkout" });
  }
});

// ── Current subscription + invoice history ───────────────────────────────────

router.get("/payments/subscription", requireAuth, async (req, res) => {
  try {
    const [subscription, invoices] = await Promise.all([
      db.subscriptions.findCurrentForUser(req.user!.id),
      db.invoices.findByUser(req.user!.id),
    ]);
    res.json({ subscription, invoices });
  } catch (err) {
    console.error("[payments] get subscription error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load subscription" });
  }
});

router.post("/payments/subscription/cancel", requireAuth, async (req, res) => {
  try {
    const sub = await db.subscriptions.findCurrentForUser(req.user!.id);
    if (!sub || (sub.status !== "active" && sub.status !== "past_due")) {
      res.status(400).json({ error: "You don't have an active subscription to cancel" });
      return;
    }

    const adapter = await resolveProvider(sub.provider);
    if (!adapter) {
      res.status(503).json({ error: "Payment provider is not configured" });
      return;
    }
    await adapter.cancelSubscription(sub.providerSubscriptionId);
    await db.subscriptions.setCancelAtPeriodEnd(sub.id, true);

    res.json({
      message: "Your subscription will remain active until the end of the current billing period and will not renew.",
    });
  } catch (err) {
    console.error("[payments] cancel subscription error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

// ── Webhooks ──────────────────────────────────────────────────────────────────
// No requireAuth — these are called by the payment provider, not the browser.
// app.ts mounts express.raw() on these two paths ahead of the global
// express.json(), so req.body here is the exact Buffer the provider signed.

async function emailVarsFor(userId: number, baseUrl: string): Promise<Record<string, string> | null> {
  const user = await db.users.findById(userId);
  if (!user) return null;
  return { user_name: user.name, user_email: user.email, support_url: `${baseUrl}/` };
}

router.post("/payments/webhook/razorpay", async (req, res) => {
  try {
    const signature = req.header("x-razorpay-signature");
    const rawBody = req.body;
    if (!signature || !Buffer.isBuffer(rawBody)) {
      res.status(400).json({ error: "Invalid webhook payload" });
      return;
    }

    const [adapter, secret] = await Promise.all([resolveProvider("razorpay"), resolveWebhookSecret("razorpay")]);
    if (!adapter || !secret) {
      res.status(503).json({ error: "Razorpay is not configured" });
      return;
    }

    const event = adapter.verifyWebhook(rawBody, signature, secret);
    if (!event) {
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    const isNew = await db.webhookEvents.insertIfNew({
      provider: "razorpay",
      eventId: event.eventId,
      eventType: event.eventType,
      payload: event.payload,
    });
    // Acknowledge immediately — Razorpay retries on any non-2xx, and a
    // duplicate delivery is expected/harmless once logged.
    res.status(200).json({ ok: true });
    if (!isNew) return;

    await applyRazorpayEvent(event, resolveBaseUrl(req));
    await db.webhookEvents.markProcessed("razorpay", event.eventId);
  } catch (err) {
    console.error("[payments] razorpay webhook error:", err instanceof Error ? err.message : err);
    if (!res.headersSent) res.status(500).json({ error: "Webhook processing failed" });
  }
});

router.post("/payments/webhook/stripe", async (req, res) => {
  try {
    const signature = req.header("stripe-signature");
    const rawBody = req.body;
    if (!signature || !Buffer.isBuffer(rawBody)) {
      res.status(400).json({ error: "Invalid webhook payload" });
      return;
    }

    const [adapter, secret] = await Promise.all([resolveProvider("stripe"), resolveWebhookSecret("stripe")]);
    if (!adapter || !secret) {
      res.status(503).json({ error: "Stripe is not configured" });
      return;
    }

    const event = adapter.verifyWebhook(rawBody, signature, secret);
    if (!event) {
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    const isNew = await db.webhookEvents.insertIfNew({
      provider: "stripe",
      eventId: event.eventId,
      eventType: event.eventType,
      payload: event.payload,
    });
    res.status(200).json({ ok: true });
    if (!isNew) return;

    await applyStripeEvent(event, resolveBaseUrl(req));
    await db.webhookEvents.markProcessed("stripe", event.eventId);
  } catch (err) {
    console.error("[payments] stripe webhook error:", err instanceof Error ? err.message : err);
    if (!res.headersSent) res.status(500).json({ error: "Webhook processing failed" });
  }
});

// ── Razorpay event handling ──────────────────────────────────────────────────

function razorpayEntity(payload: Record<string, unknown>, kind: string): Record<string, unknown> | null {
  const container = payload["payload"];
  if (!container || typeof container !== "object") return null;
  const wrapper = (container as Record<string, unknown>)[kind];
  if (!wrapper || typeof wrapper !== "object") return null;
  const entity = (wrapper as Record<string, unknown>)["entity"];
  return entity && typeof entity === "object" ? (entity as Record<string, unknown>) : null;
}

async function applyRazorpayEvent(event: WebhookEvent, baseUrl: string): Promise<void> {
  const subscriptionEntity = razorpayEntity(event.payload, "subscription");
  const paymentEntity = razorpayEntity(event.payload, "payment");
  const providerSubscriptionId =
    (subscriptionEntity?.["id"] as string | undefined) ??
    (paymentEntity?.["subscription_id"] as string | undefined);
  if (!providerSubscriptionId) return;

  const sub = await db.subscriptions.findByProviderSubscriptionId("razorpay", providerSubscriptionId);
  if (!sub) return;

  switch (event.eventType) {
    case "subscription.activated": {
      const periodEnd = subscriptionEntity?.["current_end"];
      await db.subscriptions.updateStatus(
        sub.id,
        "active",
        typeof periodEnd === "number" ? new Date(periodEnd * 1000) : null,
      );
      await db.users.updatePlan(sub.userId, sub.planId);
      const vars = await emailVarsFor(sub.userId, baseUrl);
      if (vars) void sendTemplatedEmail("subscription_activated", vars["user_email"]!, { ...vars, plan_name: sub.planId }, { userId: sub.userId, triggerSource: "razorpay-webhook" });
      break;
    }
    case "subscription.charged": {
      if (paymentEntity) await recordInvoice(sub, "razorpay", paymentEntity, baseUrl);
      const periodEnd = subscriptionEntity?.["current_end"];
      if (typeof periodEnd === "number") {
        await db.subscriptions.updateStatus(sub.id, "active", new Date(periodEnd * 1000));
      }
      break;
    }
    case "subscription.cancelled":
    case "subscription.completed": {
      await db.subscriptions.updateStatus(sub.id, "cancelled");
      await db.users.updatePlan(sub.userId, "free");
      const vars = await emailVarsFor(sub.userId, baseUrl);
      if (vars) void sendTemplatedEmail("subscription_cancelled", vars["user_email"]!, vars, { userId: sub.userId, triggerSource: "razorpay-webhook" });
      break;
    }
    case "payment.failed": {
      await db.subscriptions.updateStatus(sub.id, "past_due");
      const vars = await emailVarsFor(sub.userId, baseUrl);
      const amount = paymentEntity?.["amount"];
      if (vars) {
        void sendTemplatedEmail(
          "payment_failed",
          vars["user_email"]!,
          { ...vars, amount: typeof amount === "number" ? formatPaise(amount) : "" },
          { userId: sub.userId, triggerSource: "razorpay-webhook" },
        );
      }
      break;
    }
    default:
      break;
  }
}

async function recordInvoice(
  sub: SubscriptionRow,
  provider: "razorpay" | "stripe",
  paymentEntity: Record<string, unknown>,
  baseUrl: string,
): Promise<void> {
  const providerPaymentId = String(paymentEntity["id"] ?? "");
  if (!providerPaymentId) return;
  const existing = await db.invoices.findByProviderPaymentId(provider, providerPaymentId);
  if (existing) return; // idempotency belt-and-braces alongside payment_webhook_events

  const amount = Number(paymentEntity["amount"] ?? 0);
  const currency = String(paymentEntity["currency"] ?? "INR").toUpperCase() === "USD" ? "USD" : "INR";
  const invoice = await db.invoices.insert({
    userId: sub.userId,
    subscriptionId: sub.id,
    provider,
    providerPaymentId,
    providerInvoiceId: null,
    amount,
    currency,
    status: "paid",
    paidAt: new Date(),
  });

  const vars = await emailVarsFor(sub.userId, baseUrl);
  if (!vars) return;
  const isFirstPayment = sub.status !== "active";
  void sendTemplatedEmail(
    isFirstPayment ? "payment_successful" : "subscription_renewed",
    vars["user_email"]!,
    { ...vars, amount: formatMinorUnits(amount, currency), invoice_number: invoice.invoiceNumber ?? "", payment_date: new Date().toISOString(), plan_name: sub.planId },
    { userId: sub.userId, triggerSource: `${provider}-webhook` },
  );
}

function formatPaise(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

function formatMinorUnits(amount: number, currency: Currency): string {
  const value = (amount / 100).toFixed(2);
  return currency === "INR" ? `₹${value}` : `$${value}`;
}

// ── Stripe event handling ────────────────────────────────────────────────────

async function applyStripeEvent(event: WebhookEvent, baseUrl: string): Promise<void> {
  const obj = (event.payload["data"] as Record<string, unknown> | undefined)?.["object"] as
    | Record<string, unknown>
    | undefined;
  if (!obj) return;

  switch (event.eventType) {
    case "checkout.session.completed": {
      const sessionId = String(obj["id"] ?? "");
      const realSubscriptionId = obj["subscription"];
      const customerId = obj["customer"];
      if (!sessionId || typeof realSubscriptionId !== "string") return;

      const sub = await db.subscriptions.findByProviderSubscriptionId("stripe", sessionId);
      if (!sub) return;

      // A Checkout Session doesn't carry a real subscription id until payment
      // completes — the placeholder id used at createCheckout() time (the
      // session id itself) is swapped for the real one here.
      await db.subscriptions.reattachProviderSubscriptionId(
        sub.id,
        realSubscriptionId,
        typeof customerId === "string" ? customerId : null,
      );
      await db.subscriptions.updateStatus(sub.id, "active");
      await db.users.updatePlan(sub.userId, sub.planId);
      const vars = await emailVarsFor(sub.userId, baseUrl);
      if (vars) void sendTemplatedEmail("subscription_activated", vars["user_email"]!, { ...vars, plan_name: sub.planId }, { userId: sub.userId, triggerSource: "stripe-webhook" });
      break;
    }
    case "invoice.paid": {
      const stripeSubId = obj["subscription"];
      if (typeof stripeSubId !== "string") return;
      const sub = await db.subscriptions.findByProviderSubscriptionId("stripe", stripeSubId);
      if (!sub) return;

      const periodEnd = obj["period_end"];
      if (typeof periodEnd === "number") {
        await db.subscriptions.updateStatus(sub.id, "active", new Date(periodEnd * 1000));
      } else {
        await db.subscriptions.updateStatus(sub.id, "active");
      }
      await db.users.updatePlan(sub.userId, sub.planId);

      const paymentIntent = obj["payment_intent"];
      const invoiceId = obj["id"];
      await recordInvoice(
        sub,
        "stripe",
        {
          id: typeof paymentIntent === "string" ? paymentIntent : String(invoiceId ?? ""),
          amount: obj["amount_paid"],
          currency: obj["currency"],
        },
        baseUrl,
      );
      break;
    }
    case "invoice.payment_failed": {
      const stripeSubId = obj["subscription"];
      if (typeof stripeSubId !== "string") return;
      const sub = await db.subscriptions.findByProviderSubscriptionId("stripe", stripeSubId);
      if (!sub) return;
      await db.subscriptions.updateStatus(sub.id, "past_due");
      const vars = await emailVarsFor(sub.userId, baseUrl);
      const amount = obj["amount_due"];
      if (vars) {
        void sendTemplatedEmail(
          "payment_failed",
          vars["user_email"]!,
          { ...vars, amount: typeof amount === "number" ? formatMinorUnits(amount, "USD") : "" },
          { userId: sub.userId, triggerSource: "stripe-webhook" },
        );
      }
      break;
    }
    case "customer.subscription.deleted": {
      const stripeSubId = String(obj["id"] ?? "");
      const sub = await db.subscriptions.findByProviderSubscriptionId("stripe", stripeSubId);
      if (!sub) return;
      await db.subscriptions.updateStatus(sub.id, "cancelled");
      await db.users.updatePlan(sub.userId, "free");
      const vars = await emailVarsFor(sub.userId, baseUrl);
      if (vars) void sendTemplatedEmail("subscription_cancelled", vars["user_email"]!, vars, { userId: sub.userId, triggerSource: "stripe-webhook" });
      break;
    }
    default:
      break;
  }
}

export default router;
