import { Router, type IRouter } from "express";
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

const router: IRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

router.post("/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: sanitizeUser(req.user!) });
});

export default router;
