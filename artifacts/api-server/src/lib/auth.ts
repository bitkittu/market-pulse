import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  rolesTable,
  permissionsTable,
  rolePermissionsTable,
  type UserRow,
} from "@workspace/db";
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
  const [row] = await db
    .select({ user: usersTable, roleName: rolesTable.name })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .where(eq(usersTable.id, userId));
  if (!row) return null;

  const permRows = await db
    .select({ name: permissionsTable.name })
    .from(rolePermissionsTable)
    .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id))
    .where(eq(rolePermissionsTable.roleId, row.user.roleId));

  return {
    ...row.user,
    roleName: row.roleName,
    permissions: new Set(permRows.map((p) => p.name)),
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

// Bootstraps roles/permissions/role_permissions on a fresh database, and
// creates the first admin account if none exists yet. On a database that
// already has this data (e.g. a hand-seeded one) every step is a no-op.
export async function seedAuthDefaults(): Promise<void> {
  const existingRoles = await db.select().from(rolesTable);
  const roleByName = new Map(existingRoles.map((r) => [r.name, r]));

  for (const role of DEFAULT_ROLES) {
    if (!roleByName.has(role.name)) {
      const [{ id }] = await db.insert(rolesTable).values(role).$returningId();
      roleByName.set(role.name, { ...role, id, createdAt: new Date() });
    }
  }

  const existingPermissions = await db.select().from(permissionsTable);
  const permByName = new Map(existingPermissions.map((p) => [p.name, p]));

  for (const perm of DEFAULT_PERMISSIONS) {
    if (!permByName.has(perm.name)) {
      const [{ id }] = await db.insert(permissionsTable).values(perm).$returningId();
      permByName.set(perm.name, { ...perm, id, createdAt: new Date() });
    }
  }

  const existingRolePerms = await db.select().from(rolePermissionsTable);
  const existingPairs = new Set(existingRolePerms.map((rp) => `${rp.roleId}:${rp.permissionId}`));

  for (const [roleName, permNames] of Object.entries(ROLE_PERMISSIONS)) {
    const role = roleByName.get(roleName);
    if (!role) continue;
    for (const permName of permNames) {
      const perm = permByName.get(permName);
      if (!perm) continue;
      const key = `${role.id}:${perm.id}`;
      if (!existingPairs.has(key)) {
        await db.insert(rolePermissionsTable).values({ roleId: role.id, permissionId: perm.id });
        existingPairs.add(key);
      }
    }
  }

  const adminRole = roleByName.get("admin");
  if (!adminRole) return;

  const [existingAdmin] = await db.select().from(usersTable).where(eq(usersTable.roleId, adminRole.id));
  if (existingAdmin) return;

  const email = (process.env["ADMIN_EMAIL"] ?? "admin@marketpulse.ai").trim().toLowerCase();
  const password = process.env["ADMIN_PASSWORD"] ?? "Admin@123";
  const passwordHash = await hashPassword(password);
  await db.insert(usersTable).values({
    name: "Admin",
    email,
    passwordHash,
    roleId: adminRole.id,
    plan: "premium",
  });
}
