import type { PaymentProvider } from "@workspace/db";

export interface CheckoutInput {
  userId: number;
  userEmail: string;
  userName: string;
  /** The provider's own plan/price id — razorpay_plan_id or stripe_price_id. */
  providerPlanId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  providerSubscriptionId: string;
  providerCustomerId: string | null;
  /** Razorpay only — the frontend opens Checkout.js with this + subscriptionId. */
  razorpayKeyId?: string;
  /** Stripe only — the frontend redirects the browser here. */
  redirectUrl?: string;
}

export interface WebhookEvent {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

/**
 * Common surface both gateways implement so routes/payments.ts never
 * branches on `provider` itself — resolveProvider() in ./index.ts picks the
 * concrete adapter once, by currency.
 */
export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Returns null if the signature doesn't verify — callers must reject the webhook. */
  verifyWebhook(rawBody: Buffer, signature: string, secret: string): WebhookEvent | null;
  cancelSubscription(providerSubscriptionId: string): Promise<void>;
}
