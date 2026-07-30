import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { db } from "@workspace/db";
import {
  hashPassword,
  verifyPassword,
  signSessionToken,
  setSessionCookie,
  clearSessionCookie,
  sanitizeUser,
  loadAuthedUser,
  requireAuth,
  EMAIL_RE,
  resolveBaseUrl,
} from "../lib/auth.js";
import { sendTemplatedEmail } from "../lib/email/index.js";

const router: IRouter = Router();

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function clientIp(req: { ip?: string }): string | null {
  return req.ip ?? null;
}

function clientUserAgent(req: { headers: Record<string, unknown> }): string | null {
  const ua = req.headers["user-agent"];
  return typeof ua === "string" ? ua.slice(0, 255) : null;
}

// ── Rate limiting ────────────────────────────────────────────────────────────
// Simple in-memory limiters (per instance). Fine at this scale — see the
// forgot-password limiter this pattern was lifted from.

function createFailureLimiter(windowMs: number, max: number) {
  const attempts = new Map<string, { count: number; windowStart: number }>();
  return {
    isLimited(key: string): boolean {
      const entry = attempts.get(key);
      if (!entry) return false;
      if (Date.now() - entry.windowStart > windowMs) {
        attempts.delete(key);
        return false;
      }
      return entry.count >= max;
    },
    recordFailure(key: string): void {
      const now = Date.now();
      const entry = attempts.get(key);
      if (!entry || now - entry.windowStart > windowMs) {
        attempts.set(key, { count: 1, windowStart: now });
      } else {
        entry.count += 1;
      }
    },
    reset(key: string): void {
      attempts.delete(key);
    },
  };
}

/** A limiter where every call counts against the budget, not just failures. */
function createWindowLimiter(windowMs: number, max: number) {
  const limiter = createFailureLimiter(windowMs, max);
  return (key: string): boolean => {
    const limited = limiter.isLimited(key);
    limiter.recordFailure(key);
    return limited;
  };
}

const RESET_WINDOW_MS = 15 * 60 * 1000;
const isResetRateLimited = createWindowLimiter(RESET_WINDOW_MS, 5);
const isResendVerificationRateLimited = createWindowLimiter(RESET_WINDOW_MS, 3);
const isChangeEmailRateLimited = createWindowLimiter(RESET_WINDOW_MS, 3);
// Failed logins only — a correct password never burns the budget, and a
// success clears it, so shared IPs (offices, NAT) don't get punished for one
// person mistyping a password.
const loginFailureLimiter = createFailureLimiter(RESET_WINDOW_MS, 8);

// ── Token TTLs ────────────────────────────────────────────────────────────────
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

router.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password, acceptTerms, marketingConsent } = req.body ?? {};

    if (typeof name !== "string" || name.trim().length < 2) {
      res.status(400).json({ error: "Name must be at least 2 characters" });
      return;
    }
    if (typeof email !== "string" || !EMAIL_RE.test(email)) {
      res.status(400).json({ error: "Enter a valid email address" });
      return;
    }
    if (typeof password !== "string" || password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }
    if (acceptTerms !== true) {
      res.status(400).json({ error: "You must accept the Terms of Service and Privacy Policy" });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await db.users.findByEmail(normalizedEmail);
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const userRole = await db.roles.findByName("user");
    if (!userRole) {
      res.status(500).json({ error: "Server is not configured correctly (missing default role)" });
      return;
    }

    const newId = await db.users.insert({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      roleId: userRole.id,
      plan: "free",
      status: "active",
      termsAcceptedAt: new Date(),
      marketingConsent: marketingConsent === true,
    });

    const authedUser = await loadAuthedUser(newId);
    if (!authedUser) {
      res.status(500).json({ error: "Failed to create account" });
      return;
    }

    const token = signSessionToken(authedUser.id, authedUser.tokenVersion);
    setSessionCookie(res, token);
    res.status(201).json({ user: sanitizeUser(authedUser) });

    // Welcome + verify-email are informational, not required for account
    // access — never let a slow/broken SMTP server hold up registration.
    const baseUrl = resolveBaseUrl(req);
    const commonVars = { user_name: authedUser.name, user_email: authedUser.email, support_url: `${baseUrl}/` };
    void sendTemplatedEmail("welcome", authedUser.email, commonVars, {
      userId: authedUser.id,
      triggerSource: "register",
    });

    const rawToken = crypto.randomBytes(32).toString("hex");
    await db.emailVerifications.insert({
      userId: authedUser.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
    });
    void sendTemplatedEmail(
      "verify_email",
      authedUser.email,
      { ...commonVars, verification_url: `${baseUrl}/?verify_token=${rawToken}` },
      { userId: authedUser.id, triggerSource: "register" },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[auth] register error:", msg);
    if (!res.headersSent) res.status(500).json({ error: "Failed to create account" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const ipAddress = clientIp(req);
    const userAgent = clientUserAgent(req);
    const limiterKey = `${ipAddress ?? "unknown"}:${normalizedEmail}`;

    if (loginFailureLimiter.isLimited(limiterKey)) {
      res.status(429).json({ error: "Too many failed login attempts. Please try again later." });
      return;
    }

    const user = await db.users.findByEmail(normalizedEmail);

    const recordLogin = (userId: number, status: "success" | "failed") =>
      db.loginHistory.record({ userId, ipAddress, userAgent, status });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      if (user) await recordLogin(user.id, "failed");
      loginFailureLimiter.recordFailure(limiterKey);
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (user.status !== "active") {
      await recordLogin(user.id, "failed");
      loginFailureLimiter.recordFailure(limiterKey);
      res.status(403).json({ error: "This account has been suspended" });
      return;
    }

    loginFailureLimiter.reset(limiterKey);
    // Must read the previous IP before recording this login, but the record
    // itself and the last-login timestamp touch different tables and don't
    // depend on each other.
    const previousIp = await db.loginHistory.lastSuccessIp(user.id);
    await Promise.all([recordLogin(user.id, "success"), db.users.touchLastLogin(user.id)]);

    const authedUser = await loadAuthedUser(user.id);
    if (!authedUser) {
      res.status(500).json({ error: "Failed to sign in" });
      return;
    }

    const token = signSessionToken(authedUser.id, authedUser.tokenVersion);
    setSessionCookie(res, token);
    res.json({ user: sanitizeUser(authedUser) });

    // New-location alert (§6 / template 06) — best-effort, fired only when we
    // have a prior successful login to compare against and the IP changed, so
    // a brand-new account's first login never triggers a spurious alert.
    if (previousIp && ipAddress && previousIp !== ipAddress) {
      const baseUrl = resolveBaseUrl(req);
      void sendTemplatedEmail(
        "new_login_alert",
        authedUser.email,
        {
          user_name: authedUser.name,
          user_email: authedUser.email,
          login_ip: ipAddress,
          login_time: new Date().toISOString(),
          support_url: `${baseUrl}/`,
        },
        { userId: authedUser.id, triggerSource: "login-new-location" },
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[auth] login error:", msg);
    res.status(500).json({ error: "Failed to sign in" });
  }
});

// Generic response used regardless of whether the email exists, to avoid
// leaking which addresses are registered.
const RESET_GENERIC_MESSAGE =
  "If an account exists for that email, a password reset link has been sent.";

router.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body ?? {};
    if (typeof email !== "string" || !EMAIL_RE.test(email)) {
      res.status(400).json({ error: "Enter a valid email address" });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const ip = clientIp(req) ?? "unknown";
    if (isResetRateLimited(`${ip}:${normalizedEmail}`)) {
      res.status(429).json({ error: "Too many reset requests. Please try again later." });
      return;
    }

    const user = await db.users.findByEmail(normalizedEmail);
    if (!user) {
      res.json({ message: RESET_GENERIC_MESSAGE });
      return;
    }

    // Invalidate any previous outstanding tokens for this user, and sweep any
    // expired rows while we're here (MySQL has no TTL index).
    await db.passwordResets.clearOutstanding(user.id);
    await db.passwordResets.purgeExpired();

    const rawToken = crypto.randomBytes(32).toString("hex");
    await db.passwordResets.insert({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });

    const baseUrl = resolveBaseUrl(req);
    const resetUrl = `${baseUrl}/?reset_token=${rawToken}`;

    const emailed = await sendTemplatedEmail(
      "password_reset_request",
      normalizedEmail,
      { user_name: user.name, user_email: user.email, reset_url: resetUrl, support_url: `${baseUrl}/` },
      { userId: user.id, triggerSource: "forgot-password" },
    );

    // When email isn't configured, optionally surface the link for testing.
    // Off in production unless SHOW_RESET_LINK=true is explicitly set.
    const exposeLink =
      !emailed &&
      (process.env["NODE_ENV"] !== "production" || process.env["SHOW_RESET_LINK"] === "true");

    res.json({
      message: RESET_GENERIC_MESSAGE,
      ...(exposeLink ? { devResetUrl: resetUrl } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[auth] forgot-password error:", msg);
    res.status(500).json({ error: "Failed to process reset request" });
  }
});

router.post("/auth/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body ?? {};

    if (typeof token !== "string" || token.length < 20) {
      res.status(400).json({ error: "Invalid or expired reset link" });
      return;
    }
    if (typeof password !== "string" || password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const record = await db.passwordResets.findUnusedByTokenHash(hashToken(token));
    if (!record || record.expiresAt.getTime() < Date.now()) {
      res.status(400).json({ error: "Invalid or expired reset link" });
      return;
    }

    // Bumps token_version too, invalidating any session issued before this reset.
    await db.users.updatePasswordHash(record.userId, await hashPassword(password));

    // Mark this token used and clear any other outstanding tokens for the user.
    await db.passwordResets.markUsed(record.id);
    await db.passwordResets.clearOutstanding(record.userId);

    res.json({ message: "Your password has been reset. You can now sign in." });

    const user = await db.users.findById(record.userId);
    if (user) {
      const baseUrl = resolveBaseUrl(req);
      void sendTemplatedEmail(
        "password_changed",
        user.email,
        { user_name: user.name, user_email: user.email, support_url: `${baseUrl}/` },
        { userId: user.id, triggerSource: "reset-password" },
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[auth] reset-password error:", msg);
    if (!res.headersSent) res.status(500).json({ error: "Failed to reset password" });
  }
});

// Update own profile (currently just the display name). Email changes go
// through /auth/change-email instead, since they need re-verification.
router.patch("/auth/profile", requireAuth, async (req, res) => {
  try {
    const { name } = req.body ?? {};
    if (typeof name !== "string" || name.trim().length < 2) {
      res.status(400).json({ error: "Name must be at least 2 characters" });
      return;
    }

    const user = req.user!;
    await db.users.updateName(user.id, name.trim());

    const reloaded = await loadAuthedUser(user.id);
    if (!reloaded) {
      res.status(500).json({ error: "Failed to update profile" });
      return;
    }
    res.json({ user: sanitizeUser(reloaded) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[auth] update-profile error:", msg);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// Change own password (requires the current password).
router.post("/auth/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body ?? {};

    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      res.status(400).json({ error: "Current and new password are required" });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: "New password must be at least 8 characters" });
      return;
    }

    const user = req.user!;
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }
    if (await verifyPassword(newPassword, user.passwordHash)) {
      res.status(400).json({ error: "New password must be different from the current one" });
      return;
    }

    // Bumps token_version, which would also invalidate the session making this
    // very request — re-sign and re-set the cookie so this browser stays
    // signed in while every other session gets logged out.
    await db.users.updatePasswordHash(user.id, await hashPassword(newPassword));
    const reloaded = await loadAuthedUser(user.id);
    if (reloaded) {
      setSessionCookie(res, signSessionToken(reloaded.id, reloaded.tokenVersion));
    }

    res.json({ message: "Your password has been changed." });

    const baseUrl = resolveBaseUrl(req);
    void sendTemplatedEmail(
      "password_changed",
      user.email,
      { user_name: user.name, user_email: user.email, support_url: `${baseUrl}/` },
      { userId: user.id, triggerSource: "change-password" },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[auth] change-password error:", msg);
    if (!res.headersSent) res.status(500).json({ error: "Failed to change password" });
  }
});

// ── Email verification ───────────────────────────────────────────────────────

router.post("/auth/verify-email", async (req, res) => {
  try {
    const { token } = req.body ?? {};
    if (typeof token !== "string" || token.length < 20) {
      res.status(400).json({ error: "Invalid or expired verification link" });
      return;
    }

    const record = await db.emailVerifications.findUnusedByTokenHash(hashToken(token));
    if (!record || record.expiresAt.getTime() < Date.now()) {
      res.status(400).json({ error: "Invalid or expired verification link" });
      return;
    }

    const user = await db.users.findById(record.userId);
    if (!user) {
      res.status(400).json({ error: "Invalid or expired verification link" });
      return;
    }

    const baseUrl = resolveBaseUrl(req);

    if (record.newEmail === null) {
      await db.users.markEmailVerified(record.userId);
      await db.emailVerifications.markVerified(record.id);
      res.json({ message: "Your email address has been verified." });
      void sendTemplatedEmail(
        "email_verified",
        user.email,
        { user_name: user.name, user_email: user.email, support_url: `${baseUrl}/` },
        { userId: user.id, triggerSource: "verify-email" },
      );
      return;
    }

    // Email-change confirmation — re-check the new address is still free, in
    // case someone else claimed it between the request and this click.
    const taken = await db.users.findByEmail(record.newEmail);
    if (taken && taken.id !== user.id) {
      res.status(409).json({ error: "That email address is now in use by another account." });
      return;
    }

    const oldEmail = user.email;
    const newEmail = record.newEmail;
    await db.users.updateEmail(user.id, newEmail);
    await db.emailVerifications.markVerified(record.id);
    res.json({ message: "Your email address has been updated." });

    void sendTemplatedEmail(
      "email_changed",
      oldEmail,
      { user_name: user.name, old_email: oldEmail, new_email: newEmail, support_url: `${baseUrl}/` },
      { userId: user.id, triggerSource: "change-email" },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[auth] verify-email error:", msg);
    if (!res.headersSent) res.status(500).json({ error: "Failed to verify email" });
  }
});

router.post("/auth/resend-verification", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    if (user.emailVerifiedAt) {
      res.json({ message: "Your email is already verified." });
      return;
    }
    if (isResendVerificationRateLimited(`user:${user.id}`)) {
      res.status(429).json({ error: "Too many requests. Please try again later." });
      return;
    }

    await db.emailVerifications.clearOutstanding(user.id, "verify");
    const rawToken = crypto.randomBytes(32).toString("hex");
    await db.emailVerifications.insert({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
    });

    const baseUrl = resolveBaseUrl(req);
    const emailed = await sendTemplatedEmail(
      "verify_email",
      user.email,
      {
        user_name: user.name,
        user_email: user.email,
        verification_url: `${baseUrl}/?verify_token=${rawToken}`,
        support_url: `${baseUrl}/`,
      },
      { userId: user.id, triggerSource: "resend-verification" },
    );

    res.json({
      message: emailed
        ? "Verification email sent. Check your inbox."
        : "Could not send the verification email right now. Please try again shortly.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[auth] resend-verification error:", msg);
    res.status(500).json({ error: "Failed to resend verification email" });
  }
});

// ── Change email ──────────────────────────────────────────────────────────────

router.post("/auth/change-email", requireAuth, async (req, res) => {
  try {
    const { newEmail, currentPassword } = req.body ?? {};
    const user = req.user!;

    if (typeof newEmail !== "string" || !EMAIL_RE.test(newEmail)) {
      res.status(400).json({ error: "Enter a valid email address" });
      return;
    }
    if (typeof currentPassword !== "string") {
      res.status(400).json({ error: "Enter your current password to confirm this change" });
      return;
    }

    const normalizedEmail = newEmail.trim().toLowerCase();
    if (normalizedEmail === user.email) {
      res.status(400).json({ error: "That is already your current email address" });
      return;
    }
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }
    if (isChangeEmailRateLimited(`user:${user.id}`)) {
      res.status(429).json({ error: "Too many requests. Please try again later." });
      return;
    }

    const existing = await db.users.findByEmail(normalizedEmail);
    if (existing) {
      res.status(409).json({ error: "That email address is already in use" });
      return;
    }

    await db.emailVerifications.clearOutstanding(user.id, "change-email");
    const rawToken = crypto.randomBytes(32).toString("hex");
    const created = await db.emailVerifications.insert({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
      newEmail: normalizedEmail,
    });
    if (!created) {
      res.status(503).json({ error: "This feature isn't available yet. Please try again later." });
      return;
    }

    const baseUrl = resolveBaseUrl(req);
    // Doesn't affect the response body, so don't make the user wait on it.
    void sendTemplatedEmail(
      "verify_email",
      normalizedEmail,
      {
        user_name: user.name,
        user_email: normalizedEmail,
        verification_url: `${baseUrl}/?verify_token=${rawToken}`,
        support_url: `${baseUrl}/`,
      },
      { userId: user.id, triggerSource: "change-email-request" },
    );

    res.json({ message: `Check ${normalizedEmail} to confirm this change.` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[auth] change-email error:", msg);
    res.status(500).json({ error: "Failed to start email change" });
  }
});

router.post("/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: sanitizeUser(req.user!) });
});

// ── Profile details (user_profiles table) ────────────────────────────────────

router.get("/auth/profile-details", requireAuth, async (req, res) => {
  try {
    const profile = await db.userProfiles.get(req.user!.id);
    res.json({
      avatarUrl: profile?.avatarUrl ?? null,
      phone: profile?.phone ?? null,
      bio: profile?.bio ?? null,
      timezone: profile?.timezone ?? "Asia/Kolkata",
    });
  } catch (err) {
    console.error("[auth] get profile-details error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load profile details" });
  }
});

router.patch("/auth/profile-details", requireAuth, async (req, res) => {
  try {
    const { avatarUrl, phone, bio, timezone } = req.body ?? {};

    if (avatarUrl !== undefined && avatarUrl !== null && (typeof avatarUrl !== "string" || avatarUrl.length > 500)) {
      res.status(400).json({ error: "Invalid avatar URL" });
      return;
    }
    if (phone !== undefined && phone !== null && (typeof phone !== "string" || phone.length > 20)) {
      res.status(400).json({ error: "Phone number is too long" });
      return;
    }
    if (bio !== undefined && bio !== null && (typeof bio !== "string" || bio.length > 500)) {
      res.status(400).json({ error: "Bio must be 500 characters or fewer" });
      return;
    }
    if (timezone !== undefined && (typeof timezone !== "string" || timezone.trim().length === 0)) {
      res.status(400).json({ error: "Invalid timezone" });
      return;
    }

    const profile = await db.userProfiles.upsert(req.user!.id, {
      avatarUrl: avatarUrl === undefined ? undefined : (avatarUrl as string | null),
      phone: phone === undefined ? undefined : (phone as string | null),
      bio: bio === undefined ? undefined : (bio as string | null),
      timezone: typeof timezone === "string" ? timezone.trim() : undefined,
    });

    res.json({
      avatarUrl: profile.avatarUrl,
      phone: profile.phone,
      bio: profile.bio,
      timezone: profile.timezone,
    });
  } catch (err) {
    console.error("[auth] update profile-details error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to update profile details" });
  }
});

// ── Notification preferences ─────────────────────────────────────────────────

router.get("/auth/notification-preferences", requireAuth, async (req, res) => {
  try {
    const prefs = await db.notificationPreferences.get(req.user!.id);
    res.json({
      marketAlerts: prefs.marketAlerts,
      productUpdates: prefs.productUpdates,
      supportUpdates: prefs.supportUpdates,
      billingUpdates: prefs.billingUpdates,
    });
  } catch (err) {
    console.error("[auth] get notification-preferences error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load notification preferences" });
  }
});

router.patch("/auth/notification-preferences", requireAuth, async (req, res) => {
  try {
    const { marketAlerts, productUpdates, supportUpdates, billingUpdates } = req.body ?? {};
    if (
      typeof marketAlerts !== "boolean" || typeof productUpdates !== "boolean" ||
      typeof supportUpdates !== "boolean" || typeof billingUpdates !== "boolean"
    ) {
      res.status(400).json({ error: "All preferences must be true or false" });
      return;
    }

    const saved = await db.notificationPreferences.upsert(req.user!.id, {
      marketAlerts, productUpdates, supportUpdates, billingUpdates,
    });
    if (!saved) {
      res.status(503).json({ error: "Notification preferences aren't available yet. Please try again later." });
      return;
    }

    res.json({ marketAlerts, productUpdates, supportUpdates, billingUpdates });
  } catch (err) {
    console.error("[auth] update notification-preferences error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to update notification preferences" });
  }
});

// ── Sessions ──────────────────────────────────────────────────────────────────

router.get("/auth/login-history", requireAuth, async (req, res) => {
  try {
    const history = await db.loginHistory.recentForUser(req.user!.id, 20);
    res.json({ history });
  } catch (err) {
    console.error("[auth] get login-history error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load login history" });
  }
});

// Invalidates every session except this one — bumps token_version and
// re-signs the current cookie with the new version, same pattern as
// change-password.
router.post("/auth/logout-all", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    await db.users.bumpTokenVersion(user.id);
    const reloaded = await loadAuthedUser(user.id);
    if (reloaded) {
      setSessionCookie(res, signSessionToken(reloaded.id, reloaded.tokenVersion));
    }
    res.json({ message: "You have been signed out of all other devices." });
  } catch (err) {
    console.error("[auth] logout-all error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to sign out other sessions" });
  }
});

export default router;
