import { logger } from "./logger";

/**
 * Whether outbound email is configured. Set SMTP_HOST / SMTP_USER / SMTP_PASS
 * (and optionally SMTP_PORT, SMTP_SECURE, SMTP_FROM) in the environment to
 * enable real delivery. Until then, reset links are only logged.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env["SMTP_HOST"] && process.env["SMTP_USER"] && process.env["SMTP_PASS"]);
}

/**
 * Sends a password-reset email. Returns true only if an email was actually
 * delivered. When SMTP isn't configured (or nodemailer isn't installed) it
 * logs the link and returns false so the caller can fall back to showing the
 * link for local testing.
 *
 * To enable real email later: `pnpm --filter @workspace/api-server add nodemailer`
 * and set the SMTP_* environment variables.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  if (!isEmailConfigured()) {
    logger.warn({ to, resetUrl }, "[email] SMTP not configured — reset link logged, not emailed");
    return false;
  }

  try {
    // Dynamic import via a non-literal specifier so the app type-checks and
    // runs without nodemailer installed until email is turned on. nodemailer
    // is externalized in the esbuild config.
    const specifier = "nodemailer";
    const nodemailer = (await import(specifier)) as {
      createTransport: (opts: unknown) => { sendMail: (msg: unknown) => Promise<unknown> };
    };
    const transport = nodemailer.createTransport({
      host: process.env["SMTP_HOST"],
      port: Number(process.env["SMTP_PORT"] ?? 587),
      secure: process.env["SMTP_SECURE"] === "true",
      auth: { user: process.env["SMTP_USER"], pass: process.env["SMTP_PASS"] },
    });

    await transport.sendMail({
      from: process.env["SMTP_FROM"] ?? process.env["SMTP_USER"],
      to,
      subject: "Reset your Market Pulse AI password",
      text:
        `We received a request to reset your Market Pulse AI password.\n\n` +
        `Reset it here (link expires in 1 hour):\n${resetUrl}\n\n` +
        `If you didn't request this, you can safely ignore this email.`,
      html:
        `<p>We received a request to reset your Market Pulse AI password.</p>` +
        `<p><a href="${resetUrl}">Click here to reset your password</a> (link expires in 1 hour).</p>` +
        `<p>If you didn't request this, you can safely ignore this email.</p>`,
    });
    logger.info({ to }, "[email] Password reset email sent");
    return true;
  } catch (err) {
    logger.error({ err, to }, "[email] Failed to send password reset email");
    return false;
  }
}
