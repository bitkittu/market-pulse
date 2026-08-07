import Razorpay from "razorpay";
import type { CheckoutInput, CheckoutResult, PaymentProviderAdapter, WebhookEvent } from "./types.js";

/**
 * Razorpay subscriptions are billed against a Plan created by hand on the
 * Razorpay dashboard (§ payment_gateway.sql `subscription_plans.razorpay_plan_id`)
 * — this app only ever creates the Subscription instance, never the Plan.
 * total_count is the number of billing cycles Razorpay will attempt before
 * the subscription auto-completes; 100 cycles (100 months / 100 years) is
 * effectively "renew indefinitely" for a plan a user can cancel any time.
 */
const TOTAL_BILLING_CYCLES = 100;

/** Pulls `payload.<entityKind>.entity.id` out of a Razorpay webhook body, if present. */
function extractEntityId(payload: unknown, entityKind: string): string | null {
  if (!payload || typeof payload !== "object") return null;
  const entity = (payload as Record<string, unknown>)[entityKind];
  if (!entity || typeof entity !== "object") return null;
  const inner = (entity as Record<string, unknown>)["entity"];
  if (!inner || typeof inner !== "object") return null;
  const id = (inner as Record<string, unknown>)["id"];
  return typeof id === "string" ? id : null;
}

export function createRazorpayAdapter(keyId: string, keySecret: string): PaymentProviderAdapter {
  const client = new Razorpay({ key_id: keyId, key_secret: keySecret });

  return {
    provider: "razorpay",

    async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
      const subscription = await client.subscriptions.create({
        plan_id: input.providerPlanId,
        customer_notify: 1,
        total_count: TOTAL_BILLING_CYCLES,
        notes: { userId: String(input.userId), userEmail: input.userEmail },
      });
      return {
        providerSubscriptionId: subscription.id,
        providerCustomerId: null, // Razorpay attaches the customer during checkout, not before
        razorpayKeyId: keyId,
      };
    },

    /**
     * Uses the official SDK's HMAC-SHA256 signature check (X-Razorpay-Signature
     * header against the raw body) rather than reimplementing it.
     */
    verifyWebhook(rawBody: Buffer, signature: string, secret: string): WebhookEvent | null {
      const raw = rawBody.toString("utf8");
      if (!Razorpay.validateWebhookSignature(raw, signature, secret)) return null;

      const payload = JSON.parse(raw) as Record<string, unknown>;
      const eventType = String(payload["event"] ?? "unknown");
      // Razorpay doesn't send a top-level event id — the (subscription/payment
      // entity id + event type) pair is what's unique per delivery.
      const entityId = extractEntityId(payload["payload"], "subscription") ?? extractEntityId(payload["payload"], "payment") ?? "unknown";
      return { eventId: `${eventType}:${entityId}`, eventType, payload };
    },

    async cancelSubscription(providerSubscriptionId: string): Promise<void> {
      await client.subscriptions.cancel(providerSubscriptionId, true);
    },
  };
}
