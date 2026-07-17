import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { collections, nextId, type UserRow } from "@workspace/db";
import type { Request, Response, NextFunction } from "express";

export const SESSION_COOKIE = "mp_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

const DEFAULT_ROLES = [
  { name: "admin", description: "Full system access — user management, system monitor" },
  { name: "user", description: "Standard end-user access to the dashboard" },
] as const;

const DEFAULT_PERMISSIONS = [
  { name: "users.manage", description: "Create, update, delete user accounts" },
  { name: "users.view", description: "View user accounts" },
  { name: "dashboard.view", description: "View the trading dashboard" },
  { name: "watchlist.manage", description: "Add/remove watchlist symbols" },
  { name: "portfolio.manage", description: "Add/remove portfolio holdings" },
  { name: "settings.manage", description: "Manage own account/API settings" },
  { name: "system.monitor", description: "View system health / admin monitor panel" },
] as const;

const ROLE_PERMISSIONS: Record<(typeof DEFAULT_ROLES)[number]["name"], readonly string[]> = {
  admin: DEFAULT_PERMISSIONS.map((p) => p.name),
  user: ["dashboard.view", "portfolio.manage", "watchlist.manage", "settings.manage"],
};

function getJwtSecret(): string {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("JWT_SECRET must be set");
  return secret;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

interface SessionPayload {
  uid: number;
}

function isSessionPayload(payload: unknown): payload is SessionPayload {
  return typeof payload === "object" && payload !== null && typeof (payload as SessionPayload).uid === "number";
}

export function signSessionToken(userId: number): string {
  return jwt.sign({ uid: userId } satisfies SessionPayload, getJwtSecret(), {
    expiresIn: SESSION_TTL_SECONDS,
  });
}

function verifySessionToken(token: string): number | null {
  try {
    const payload = jwt.verify(token, getJwtSecret());
    return isSessionPayload(payload) ? payload.uid : null;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export interface AuthedUser extends UserRow {
  roleName: string;
  permissions: Set<string>;
}

export async function loadAuthedUser(userId: number): Promise<AuthedUser | null> {
  const user = await collections.users().findOne({ id: userId });
  if (!user) return null;

  const role = await collections.roles().findOne({ id: user.roleId });

  return {
    ...user,
    roleName: role?.name ?? "user",
    permissions: new Set(role?.permissions ?? []),
  };
}

export function toPublicUser(user: UserRow, roleName: string) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: roleName,
    plan: user.plan,
    joinedAt: user.createdAt,
    lastLogin: user.lastLoginAt,
  };
}

export function sanitizeUser(user: AuthedUser) {
  return toPublicUser(user, user.roleName);
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  const userId = token ? verifySessionToken(token) : null;
  const user = userId ? await loadAuthedUser(userId) : null;
  if (!user || user.status !== "active") {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  req.user = user;
  next();
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user?.permissions.has(permission)) {
      res.status(403).json({ error: "You do not have permission to perform this action" });
      return;
    }
    next();
  };
}

// Bootstraps the roles (with their embedded permission lists) on a fresh
// database, and creates the first admin account if none exists yet. Every
// step is idempotent, so this is safe to run on every boot.
export async function seedAuthDefaults(): Promise<void> {
  for (const role of DEFAULT_ROLES) {
    const permissions = ROLE_PERMISSIONS[role.name] ?? [];
    const existing = await collections.roles().findOne({ name: role.name });
    if (existing) {
      // Keep the permission list in sync as the app's defaults evolve.
      await collections.roles().updateOne(
        { name: role.name },
        { $set: { description: role.description, permissions: [...permissions] } },
      );
    } else {
      await collections.roles().insertOne({
        id: await nextId("roles"),
        name: role.name,
        description: role.description,
        permissions: [...permissions],
        createdAt: new Date(),
      });
    }
  }

  const adminRole = await collections.roles().findOne({ name: "admin" });
  if (!adminRole) return;

  const existingAdmin = await collections.users().findOne({ roleId: adminRole.id });
  if (existingAdmin) return;

  const email = (process.env["ADMIN_EMAIL"] ?? "admin@marketpulse.ai").trim().toLowerCase();
  const password = process.env["ADMIN_PASSWORD"] ?? "Admin@123";
  const passwordHash = await hashPassword(password);
  const now = new Date();
  await collections.users().insertOne({
    id: await nextId("users"),
    name: "Admin",
    email,
    passwordHash,
    roleId: adminRole.id,
    plan: "premium",
    status: "active",
    emailVerifiedAt: null,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  });
}
