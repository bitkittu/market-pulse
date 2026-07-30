import { Router, type IRouter } from "express";
import { db, type SmtpSettingsRow } from "@workspace/db";
import { requireAuth, requirePermission, resolveBaseUrl, EMAIL_RE } from "../lib/auth.js";
import { encryptSecret, sendTestEmail, sendTemplatedEmail } from "../lib/email/index.js";
import { DEFAULT_TEMPLATES } from "../lib/email/defaults.js";

const router: IRouter = Router();

// requireAuth/requirePermission are applied per-route, not as a blanket
// `router.use()` — every router in routes/index.ts is mounted with no path
// prefix, so a path-less `.use()` here would run for every request that
// falls through earlier routers, not just this file's own `/admin/*` paths.
const guard = [requireAuth, requirePermission("email.manage")] as const;

function maskSmtpSettings(row: SmtpSettingsRow | null) {
  if (!row) {
    return {
      configured: false,
      host: "",
      port: 587,
      encryption: "tls" as const,
      username: "",
      hasPassword: false,
      fromName: "Market Pulse AI",
      fromEmail: "",
      replyToEmail: "",
      supportEmail: "",
      updatedAt: null,
    };
  }
  return {
    configured: Boolean(row.host && row.fromEmail),
    host: row.host ?? "",
    port: row.port,
    encryption: row.encryption,
    username: row.username ?? "",
    hasPassword: Boolean(row.passwordEncrypted),
    fromName: row.fromName,
    fromEmail: row.fromEmail ?? "",
    replyToEmail: row.replyToEmail ?? "",
    supportEmail: row.supportEmail ?? "",
    updatedAt: row.updatedAt,
  };
}

// ── SMTP settings (§8) ───────────────────────────────────────────────────────

router.get("/admin/settings/email", ...guard, async (_req, res) => {
  try {
    const row = await db.smtpSettings.get();
    res.json(maskSmtpSettings(row));
  } catch (err) {
    console.error("[admin] get email settings error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load email settings" });
  }
});

router.put("/admin/settings/email", ...guard, async (req, res) => {
  try {
    const { host, port, encryption, username, password, fromName, fromEmail, replyToEmail, supportEmail } =
      req.body ?? {};

    if (typeof host !== "string" || host.trim().length === 0) {
      res.status(400).json({ error: "SMTP host is required" });
      return;
    }
    const portNum = Number(port);
    if (!Number.isInteger(portNum) || portNum <= 0 || portNum > 65535) {
      res.status(400).json({ error: "Enter a valid SMTP port" });
      return;
    }
    if (encryption !== "none" && encryption !== "ssl" && encryption !== "tls") {
      res.status(400).json({ error: "Encryption must be none, ssl, or tls" });
      return;
    }
    if (typeof fromEmail !== "string" || !EMAIL_RE.test(fromEmail)) {
      res.status(400).json({ error: "Enter a valid From email address" });
      return;
    }
    if (replyToEmail && !EMAIL_RE.test(replyToEmail)) {
      res.status(400).json({ error: "Enter a valid Reply-To email address" });
      return;
    }
    if (supportEmail && !EMAIL_RE.test(supportEmail)) {
      res.status(400).json({ error: "Enter a valid support email address" });
      return;
    }

    // Never log the password itself, and only touch it when the admin
    // actually entered a new one — otherwise leave the stored secret as-is.
    const passwordEncrypted =
      typeof password === "string" && password.length > 0 ? encryptSecret(password) : undefined;

    await db.smtpSettings.upsert({
      host: host.trim(),
      port: portNum,
      encryption,
      username: typeof username === "string" && username.trim() ? username.trim() : null,
      ...(passwordEncrypted !== undefined ? { passwordEncrypted } : {}),
      fromName: typeof fromName === "string" && fromName.trim() ? fromName.trim() : "Market Pulse AI",
      fromEmail: fromEmail.trim().toLowerCase(),
      replyToEmail: typeof replyToEmail === "string" && replyToEmail.trim() ? replyToEmail.trim().toLowerCase() : null,
      supportEmail: typeof supportEmail === "string" && supportEmail.trim() ? supportEmail.trim().toLowerCase() : null,
      updatedBy: req.user!.id,
    });

    const row = await db.smtpSettings.get();
    res.json(maskSmtpSettings(row));
  } catch (err) {
    console.error("[admin] save email settings error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to save email settings" });
  }
});

router.post("/admin/settings/email/test", ...guard, async (req, res) => {
  try {
    const { recipient } = req.body ?? {};
    if (typeof recipient !== "string" || !EMAIL_RE.test(recipient)) {
      res.status(400).json({ error: "Enter a valid recipient email address" });
      return;
    }
    const result = await sendTestEmail(recipient.trim().toLowerCase());
    res.status(result.ok ? 200 : 502).json(result);
  } catch (err) {
    console.error("[admin] send test email error:", err instanceof Error ? err.message : err);
    res.status(500).json({ ok: false, message: "Failed to send test email" });
  }
});

// ── Email templates (§10) ────────────────────────────────────────────────────

router.get("/admin/email-templates", ...guard, async (_req, res) => {
  try {
    const rows = await db.emailTemplates.all();
    if (rows.length > 0) {
      res.json({ migrated: true, templates: rows });
      return;
    }
    // Pre-migration fallback: show what will exist once the DB upgrade lands,
    // read-only (editing requires the migration for storage to persist).
    const preview = Object.entries(DEFAULT_TEMPLATES).map(([key, t]) => ({
      id: null,
      templateKey: key,
      name: key,
      subject: t.subject,
      preheader: t.preheader ?? null,
      body: t.body,
      ctaLabel: t.ctaLabel ?? null,
      ctaUrlTemplate: t.ctaUrlTemplate ?? null,
      footerNote: t.footerNote ?? null,
      enabled: true,
    }));
    res.json({ migrated: false, templates: preview });
  } catch (err) {
    console.error("[admin] list email templates error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load email templates" });
  }
});

router.put("/admin/email-templates/:key", ...guard, async (req, res) => {
  try {
    // Spreading the guard middleware array (see `guard` above) loses Express's
    // literal-path param inference, so `key` types as string | string[] here
    // even though a single `:key` segment is always a plain string at runtime.
    const key = req.params.key as string;
    const existing = await db.emailTemplates.findByKey(key);
    if (!existing) {
      res.status(404).json({ error: "Template not found — is the pending database migration applied?" });
      return;
    }

    const { name, subject, preheader, body, ctaLabel, ctaUrlTemplate, footerNote, enabled } = req.body ?? {};
    if (subject !== undefined && (typeof subject !== "string" || subject.trim().length === 0)) {
      res.status(400).json({ error: "Subject cannot be empty" });
      return;
    }
    if (body !== undefined && (typeof body !== "string" || body.trim().length === 0)) {
      res.status(400).json({ error: "Body cannot be empty" });
      return;
    }

    await db.emailTemplates.update(key, {
      name: typeof name === "string" ? name : undefined,
      subject: typeof subject === "string" ? subject : undefined,
      preheader: preheader === null ? null : typeof preheader === "string" ? preheader : undefined,
      body: typeof body === "string" ? body : undefined,
      ctaLabel: ctaLabel === null ? null : typeof ctaLabel === "string" ? ctaLabel : undefined,
      ctaUrlTemplate: ctaUrlTemplate === null ? null : typeof ctaUrlTemplate === "string" ? ctaUrlTemplate : undefined,
      footerNote: footerNote === null ? null : typeof footerNote === "string" ? footerNote : undefined,
      enabled: typeof enabled === "boolean" ? enabled : undefined,
    });

    const updated = await db.emailTemplates.findByKey(key);
    res.json({ template: updated });
  } catch (err) {
    console.error("[admin] update email template error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to update template" });
  }
});

// ── Email delivery log (§14) ─────────────────────────────────────────────────

router.get("/admin/email-logs", ...guard, async (req, res) => {
  try {
    const { q, templateKey, status, userId, from, to, limit } = req.query;
    const rows = await db.emailLogs.search({
      q: typeof q === "string" && q.trim() ? q.trim() : undefined,
      templateKey: typeof templateKey === "string" && templateKey ? templateKey : undefined,
      status:
        status === "pending" || status === "sent" || status === "failed" ? status : undefined,
      userId: typeof userId === "string" && userId ? Number(userId) : undefined,
      from: typeof from === "string" && from ? new Date(from) : undefined,
      to: typeof to === "string" && to ? new Date(to) : undefined,
      limit: typeof limit === "string" && limit ? Number(limit) : undefined,
    });
    res.json({ logs: rows });
  } catch (err) {
    console.error("[admin] search email logs error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load email logs" });
  }
});

// ── Announcements (§13, template 13 — admin_announcement) ───────────────────

router.post("/admin/announcements", ...guard, async (req, res) => {
  try {
    const { title, body, recipient } = req.body ?? {};
    if (typeof title !== "string" || title.trim().length === 0) {
      res.status(400).json({ error: "Title is required" });
      return;
    }
    if (typeof body !== "string" || body.trim().length === 0) {
      res.status(400).json({ error: "Message body is required" });
      return;
    }

    let recipients: { id: number; name: string; email: string }[];
    if (recipient === undefined || recipient === null || recipient === "all") {
      const all = await db.users.all();
      recipients = all.filter((u) => u.status === "active").map((u) => ({ id: u.id, name: u.name, email: u.email }));
    } else {
      const targetId = Number(recipient);
      if (!Number.isInteger(targetId)) {
        res.status(400).json({ error: "Invalid recipient" });
        return;
      }
      const target = await db.users.findById(targetId);
      if (!target) {
        res.status(400).json({ error: "Recipient not found" });
        return;
      }
      recipients = [{ id: target.id, name: target.name, email: target.email }];
    }

    const baseUrl = resolveBaseUrl(req);
    const results = await Promise.all(
      recipients.map((r) =>
        sendTemplatedEmail(
          "admin_announcement",
          r.email,
          {
            user_name: r.name,
            announcement_title: title.trim(),
            announcement_body: body.trim(),
            support_url: `${baseUrl}/`,
          },
          { userId: r.id, triggerSource: "admin-announcement" },
        ),
      ),
    );

    res.json({ recipientCount: recipients.length, sentCount: results.filter(Boolean).length });
  } catch (err) {
    console.error("[admin] send announcement error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to send announcement" });
  }
});

export default router;
