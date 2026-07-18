import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { collections, nextId } from "@workspace/db";
import {
  hashPassword,
  verifyPassword,
  signSessionToken,
  setSessionCookie,
  clearSessionCookie,
  sanitizeUser,
  loadAuthedUser,
  requireAuth,
} from "../lib/auth.js";
import { sendPasswordResetEmail } from "../lib/email.js";

const router: IRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Password reset helpers ──────────────────────────────────────────────────
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Simple in-memory rate limiter for reset requests (per instance). Keyed by
// ip+email; allows RESET_MAX requests per RESET_WINDOW_MS window.
const RESET_WINDOW_MS = 15 * 60 * 1000;
const RESET_MAX = 5;
const resetAttempts = new Map<string, { count: number; windowStart: number }>();

function isResetRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = resetAttempts.get(key);
  if (!entry || now - entry.windowStart > RESET_WINDOW_MS) {
    resetAttempts.set(key, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RESET_MAX;
}

function clientIp(req: { ip?: string }): string | null {
  return req.ip ?? null;
}

function clientUserAgent(req: { headers: Record<string, unknown> }): string | null {
  const ua = req.headers["user-agent"];
  return typeof ua === "string" ? ua.slice(0, 255) : null;
}

router.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body ?? {};

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

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await collections.users().findOne({ email: normalizedEmail });
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const userRole = await collections.roles().findOne({ name: "user" });
    if (!userRole) {
      res.status(500).json({ error: "Server is not configured correctly (missing default role)" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const newId = await nextId("users");
    const now = new Date();
    await collections.users().insertOne({
      id: newId,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      roleId: userRole.id,
      plan: "free",
      status: "active",
      emailVerifiedAt: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const authedUser = await loadAuthedUser(newId);
    if (!authedUser) {
      res.status(500).json({ error: "Failed to create account" });
      return;
    }

    const token = signSessionToken(authedUser.id);
    setSessionCookie(res, token);
    res.status(201).json({ user: sanitizeUser(authedUser) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[auth] register error:", msg);
    res.status(500).json({ error: "Failed to create account" });
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
    const user = await collections.users().findOne({ email: normalizedEmail });

    const ipAddress = clientIp(req);
    const userAgent = clientUserAgent(req);

    const recordLogin = async (userId: number, status: "success" | "failed") => {
      await collections.loginHistory().insertOne({
        id: await nextId("login_history"),
        userId,
        ipAddress,
        userAgent,
        status,
        createdAt: new Date(),
      });
    };

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      if (user) {
        await recordLogin(user.id, "failed");
      }
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (user.status !== "active") {
      await recordLogin(user.id, "failed");
      res.status(403).json({ error: "This account has been suspended" });
      return;
    }

    await recordLogin(user.id, "success");
    await collections.users().updateOne(
      { id: user.id },
      { $set: { lastLoginAt: new Date(), updatedAt: new Date() } },
    );

    const authedUser = await loadAuthedUser(user.id);
    if (!authedUser) {
      res.status(500).json({ error: "Failed to sign in" });
      return;
    }

    const token = signSessionToken(authedUser.id);
    setSessionCookie(res, token);
    res.json({ user: sanitizeUser(authedUser) });
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

    const user = await collections.users().findOne({ email: normalizedEmail });
    if (!user) {
      res.json({ message: RESET_GENERIC_MESSAGE });
      return;
    }

    // Invalidate any previous outstanding tokens for this user.
    await collections.passwordResets().deleteMany({ userId: user.id, usedAt: null });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const now = new Date();
    await collections.passwordResets().insertOne({
      id: await nextId("password_resets"),
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS),
      usedAt: null,
      createdAt: now,
    });

    const baseUrl = (
      process.env["APP_BASE_URL"] ?? `${req.protocol}://${req.get("host")}`
    ).replace(/\/$/, "");
    const resetUrl = `${baseUrl}/?reset_token=${rawToken}`;

    const emailed = await sendPasswordResetEmail(normalizedEmail, resetUrl);

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

    const record = await collections.passwordResets().findOne({
      tokenHash: hashToken(token),
      usedAt: null,
    });
    if (!record || record.expiresAt.getTime() < Date.now()) {
      res.status(400).json({ error: "Invalid or expired reset link" });
      return;
    }

    const passwordHash = await hashPassword(password);
    await collections.users().updateOne(
      { id: record.userId },
      { $set: { passwordHash, updatedAt: new Date() } },
    );

    // Mark this token used and clear any other outstanding tokens for the user.
    await collections.passwordResets().updateOne(
      { id: record.id },
      { $set: { usedAt: new Date() } },
    );
    await collections.passwordResets().deleteMany({ userId: record.userId, usedAt: null });

    res.json({ message: "Your password has been reset. You can now sign in." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[auth] reset-password error:", msg);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// Update own profile (currently just the display name). Email changes are
// intentionally excluded — they'd need a re-verification flow.
router.patch("/auth/profile", requireAuth, async (req, res) => {
  try {
    const { name } = req.body ?? {};
    if (typeof name !== "string" || name.trim().length < 2) {
      res.status(400).json({ error: "Name must be at least 2 characters" });
      return;
    }

    const user = req.user!;
    await collections.users().updateOne(
      { id: user.id },
      { $set: { name: name.trim(), updatedAt: new Date() } },
    );

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

    const passwordHash = await hashPassword(newPassword);
    await collections.users().updateOne(
      { id: user.id },
      { $set: { passwordHash, updatedAt: new Date() } },
    );

    res.json({ message: "Your password has been changed." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[auth] change-password error:", msg);
    res.status(500).json({ error: "Failed to change password" });
  }
});

router.post("/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: sanitizeUser(req.user!) });
});

export default router;
