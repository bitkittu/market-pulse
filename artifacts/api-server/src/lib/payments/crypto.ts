import crypto from "node:crypto";

/**
 * Encrypts Razorpay/Stripe secrets before they're stored in payment_settings,
 * same AES-256-GCM/scrypt-from-JWT_SECRET shape as ../email/crypto.ts. Kept
 * as its own small copy rather than a shared import — this codebase already
 * duplicates this exact ~20-line helper once per feature rather than
 * introducing a cross-feature crypto module for it.
 */
function getKey(): Buffer {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("JWT_SECRET must be set");
  return crypto.scryptSync(secret, "mp-payment-settings", 32);
}

const IV_LENGTH = 12; // GCM standard nonce size

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptSecret(stored: string): string | null {
  try {
    const raw = Buffer.from(stored, "base64");
    const iv = raw.subarray(0, IV_LENGTH);
    const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
    const ciphertext = raw.subarray(IV_LENGTH + 16);
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
