import Stripe from "stripe";
import type { CheckoutInput, CheckoutResult, PaymentProviderAdapter, WebhookEvent } from "./types.js";

export function createStripeAdapter(secretKey: string): PaymentProviderAdapter {
  const client = new Stripe(secretKey);

  return {
    provider: "stripe",

    /**
     * Hosted Stripe Checkout (redirect), not embedded Elements — keeps PCI
     * scope off this app's servers and matches Razorpay Checkout's own
     * modal-redirect feel. `providerSubscriptionId` is filled in once the
     * checkout.session.completed webhook fires (a Checkout Session doesn't
     * carry a subscription id until the customer actually pays), so the
     * caller stores the Session id as a placeholder until then.
     */
    async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
      const session = await client.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: input.providerPlanId, quantity: 1 }],
        customer_email: input.userEmail,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: { userId: String(input.userId) },
        subscription_data: { metadata: { userId: String(input.userId) } },
      });
      return {
        providerSubscriptionId: session.id,
        providerCustomerId: typeof session.customer === "string" ? session.customer : null,
        redirectUrl: session.url ?? undefined,
      };
    },

    verifyWebhook(rawBody: Buffer, signature: string, secret: string): WebhookEvent | null {
      try {
        const event = client.webhooks.constructEvent(rawBody, signature, secret);
        return { eventId: event.id, eventType: event.type, payload: event as unknown as Record<string, unknown> };
      } catch {
        return null;
      }
    },

    /**
     * Schedules cancellation for the end of the current billing period rather
     * than cancelling immediately (`subscriptions.cancel` would do that) —
     * matches Razorpay's `cancelAtCycleEnd: true` and this app's
     * `subscriptions.cancel_at_period_end` column: access continues until the
     * period actually ends.
     */
    async cancelSubscription(providerSubscriptionId: string): Promise<void> {
      await client.subscriptions.update(providerSubscriptionId, { cancel_at_period_end: true });
    },
  };
}
