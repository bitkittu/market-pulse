import nodemailer from "nodemailer";
import { db } from "@workspace/db";
import { decryptSecret } from "./crypto.js";

export interface ResolvedSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
  fromName: string;
  fromEmail: string;
  replyToEmail: string | null;
  supportEmail: string | null;
}

/**
 * Resolves SMTP config from the admin-configured smtp_settings row first
 * (§8), falling back to the legacy SMTP_* environment variables so a
 * deployment that only ever used the .env-based setup keeps working. Returns
 * null when neither source has enough to send mail.
 */
export async function resolveSmtpConfig(): Promise<ResolvedSmtpConfig | null> {
  const row = await db.smtpSettings.get();
  if (row?.host && row.fromEmail) {
    const password = row.passwordEncrypted ? decryptSecret(row.passwordEncrypted) : null;
    return {
      host: row.host,
      port: row.port,
      secure: row.encryption === "ssl",
      auth: row.username && password ? { user: row.username, pass: password } : undefined,
      fromName: row.fromName,
      fromEmail: row.fromEmail,
      replyToEmail: row.replyToEmail,
      supportEmail: row.supportEmail,
    };
  }

  const host = process.env["SMTP_HOST"];
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  if (!host || !user || !pass) return null;

  return {
    host,
    port: Number(process.env["SMTP_PORT"] ?? 587),
    secure: process.env["SMTP_SECURE"] === "true",
    auth: { user, pass },
    fromName: "Market Pulse AI",
    fromEmail: process.env["SMTP_FROM"] ?? user,
    replyToEmail: null,
    supportEmail: null,
  };
}

export async function isEmailConfigured(): Promise<boolean> {
  return (await resolveSmtpConfig()) !== null;
}

export function createTransport(config: ResolvedSmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });
}
