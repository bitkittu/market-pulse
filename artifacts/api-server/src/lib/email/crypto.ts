import crypto from "node:crypto";

/**
 * Encrypts the SMTP password before it's stored in smtp_settings, so the
 * secret isn't sitting in the database as plaintext (unlike the Upstox
 * settings table, which predates this and is out of scope here). Derives a
 * key from JWT_SECRET via scrypt rather than requiring a brand new env var —
 * JWT_SECRET is already a required, long random secret in this app.
 */
function getKey(): Buffer {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("JWT_SECRET must be set");
  return crypto.scryptSync(secret, "mp-smtp-settings", 32);
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
