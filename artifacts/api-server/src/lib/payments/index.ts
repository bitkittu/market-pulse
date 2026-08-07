import { db } from "@workspace/db";
import type { Currency, PaymentProvider } from "@workspace/db";
import { decryptSecret } from "./crypto.js";
import { createRazorpayAdapter } from "./razorpay.js";
import { createStripeAdapter } from "./stripe.js";
import type { PaymentProviderAdapter } from "./types.js";

export type { CheckoutInput, CheckoutResult, PaymentProviderAdapter, WebhookEvent } from "./types.js";
export { encryptSecret, decryptSecret } from "./crypto.js";

/** INR checkout always goes through Razorpay, USD through Stripe — currency picks the provider. */
export function currencyToProvider(currency: Currency): PaymentProvider {
  return currency === "INR" ? "razorpay" : "stripe";
}

/**
 * Builds the concrete adapter for `provider` from the admin-configured,
 * encrypted keys in payment_settings. Returns null if that provider isn't
 * configured yet — callers surface this as "checkout unavailable" rather
 * than a 500, same tone as sendTemplatedEmail returning false when SMTP
 * isn't configured.
 */
export async function resolveProvider(provider: PaymentProvider): Promise<PaymentProviderAdapter | null> {
  const settings = await db.paymentSettings.get();
  if (!settings) return null;

  if (provider === "razorpay") {
    if (!settings.razorpayKeyId || !settings.razorpayKeySecretEncrypted) return null;
    const secret = decryptSecret(settings.razorpayKeySecretEncrypted);
    if (!secret) return null;
    return createRazorpayAdapter(settings.razorpayKeyId, secret);
  }

  if (!settings.stripeSecretKeyEncrypted) return null;
  const secret = decryptSecret(settings.stripeSecretKeyEncrypted);
  if (!secret) return null;
  return createStripeAdapter(secret);
}

/** The webhook secret for `provider`, decrypted — null if not configured. */
export async function resolveWebhookSecret(provider: PaymentProvider): Promise<string | null> {
  const settings = await db.paymentSettings.get();
  if (!settings) return null;
  const encrypted =
    provider === "razorpay" ? settings.razorpayWebhookSecretEncrypted : settings.stripeWebhookSecretEncrypted;
  return encrypted ? decryptSecret(encrypted) : null;
}
