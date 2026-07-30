import { db } from "@workspace/db";
import { logger } from "../logger.js";
import { DEFAULT_TEMPLATES } from "./defaults.js";
import { renderEmailHtml, renderEmailText, substituteVars, type FooterLinks } from "./layout.js";
import { resolveSmtpConfig, createTransport } from "./transport.js";

export { isEmailConfigured } from "./transport.js";

function deriveLinks(vars: Record<string, string>): FooterLinks {
  const supportUrl = vars["support_url"] ?? "/";
  let origin = supportUrl;
  try {
    origin = new URL(supportUrl).origin;
  } catch {
    // supportUrl wasn't absolute — leave origin as-is, the links just won't be perfect.
  }
  return { supportUrl, privacyUrl: `${origin}/#privacy`, termsUrl: `${origin}/#terms` };
}

export interface SendTemplatedEmailOptions {
  /** The account this email concerns, for the delivery log — null for pre-account emails. */
  userId: number | null;
  /** Short label for what triggered the send, e.g. "register", "forgot-password", "ticket-reply". */
  triggerSource: string;
}

/**
 * Sends a one-off test email using the currently saved SMTP settings (§9).
 * Settings must be saved first — this never accepts unsaved draft
 * credentials, so a test can't be used to probe/exfiltrate via an arbitrary
 * SMTP relay. Returns a safe, non-revealing message on failure (no stack
 * traces or credential details leak to the browser).
 */
export async function sendTestEmail(to: string): Promise<{ ok: boolean; message: string }> {
  const smtpConfig = await resolveSmtpConfig();
  if (!smtpConfig) {
    return { ok: false, message: "SMTP is not configured yet. Save your settings first." };
  }
  try {
    const transport = createTransport(smtpConfig);
    await transport.sendMail({
      from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`,
      to,
      replyTo: smtpConfig.replyToEmail ?? undefined,
      subject: "MarketPulse AI — Test Email",
      text: "This is a test email from your MarketPulse AI SMTP configuration. If you received this, delivery is working correctly.",
      html: "<p>This is a test email from your MarketPulse AI SMTP configuration. If you received this, delivery is working correctly.</p>",
    });
    logger.info({ to }, "[email] test email sent");
    return { ok: true, message: `Test email sent to ${to}.` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ to, err: msg }, "[email] test email failed");
    return { ok: false, message: "Failed to send test email. Check your SMTP host, port, and credentials." };
  }
}

/**
 * Renders and sends one of the templates seeded by
 * lib/db/account_upgrade.sql. Loads the admin-edited row from the database
 * when present, otherwise falls back to the shipped default content (so
 * sending still works before the migration lands or before an admin has
 * touched a given template). Every attempt is written to email_logs
 * (best-effort — logging failure never blocks the send).
 *
 * Returns false if the template is disabled, unknown, or SMTP isn't
 * configured/the send failed — callers should treat this as "not delivered",
 * never as a reason to fail the surrounding request (registering, resetting
 * a password, etc. must succeed even when email is down).
 */
export async function sendTemplatedEmail(
  key: string,
  to: string,
  vars: Record<string, string>,
  opts: SendTemplatedEmailOptions,
): Promise<boolean> {
  // Independent lookups — resolving SMTP config doesn't depend on the
  // template, so run them concurrently instead of paying two round-trips.
  const [dbTemplate, smtpConfig] = await Promise.all([db.emailTemplates.findByKey(key), resolveSmtpConfig()]);
  const fallback = DEFAULT_TEMPLATES[key];
  if (!dbTemplate && !fallback) {
    logger.warn(`[email] unknown template key "${key}" — not sent`);
    return false;
  }
  if (dbTemplate && !dbTemplate.enabled) {
    logger.info(`[email] template "${key}" is disabled — not sent`);
    return false;
  }

  const src = dbTemplate ?? fallback!;
  const subject = substituteVars(src.subject, vars);
  const preheader = src.preheader ? substituteVars(src.preheader, vars) : null;
  const body = substituteVars(src.body, vars);
  const ctaLabel = src.ctaLabel ?? null;
  const ctaUrl = src.ctaUrlTemplate ? substituteVars(src.ctaUrlTemplate, vars) : null;
  const footerNote = src.footerNote ?? null;
  const links = deriveLinks(vars);

  const content = { subject, preheader, body, ctaLabel, ctaUrl, footerNote };
  const html = renderEmailHtml(content, links);
  const text = renderEmailText(content, links);

  const logId = await db.emailLogs.insert({
    userId: opts.userId,
    templateKey: key,
    recipient: to,
    subject,
    triggerSource: opts.triggerSource,
  });

  if (!smtpConfig) {
    logger.warn({ to, key }, "[email] SMTP not configured — email not sent");
    await db.emailLogs.markFailed(logId, "SMTP not configured");
    return false;
  }

  try {
    const transport = createTransport(smtpConfig);
    await transport.sendMail({
      from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`,
      to,
      replyTo: smtpConfig.replyToEmail ?? undefined,
      subject,
      text,
      html,
    });
    await db.emailLogs.markSent(logId);
    logger.info({ to, key }, "[email] sent");
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ to, key, err: msg }, "[email] send failed");
    await db.emailLogs.markFailed(logId, msg.slice(0, 500));
    return false;
  }
}
