import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { requireAuth, requirePermission, toPublicUser } from "../lib/auth.js";

const router: IRouter = Router();

// Deliberately NOT a blanket `router.use(requireAuth)` — every router in
// routes/index.ts is mounted with no path prefix, so a bare `.use()` with no
// path here would run for every request that falls through earlier routers
// (including ones meant for completely unrelated routes), not just this
// file's own `/admin/*` paths. Each route below takes requireAuth directly
// instead, exactly like every route in auth.ts already does.

router.get("/admin/users", requireAuth, requirePermission("users.view"), async (_req, res) => {
  try {
    const [users, roles] = await Promise.all([db.users.all(), db.roles.all()]);
    const roleName = (roleId: number) => roles.find((r) => r.id === roleId)?.name ?? "user";
    res.json(users.map((user) => toPublicUser(user, roleName(user.roleId))));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin] list users error:", msg);
    res.status(500).json({ error: "Failed to load users" });
  }
});

// 360° user view (§31): profile, support tickets, and recent email history —
// intentionally read-only and simple, not a dashboard.
router.get("/admin/users/:id", requireAuth, requirePermission("users.view"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }
    const user = await db.users.findById(id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [role, profile, tickets, emailLogs] = await Promise.all([
      db.roles.findById(user.roleId),
      db.userProfiles.get(id),
      db.supportTickets.findByUser(id),
      db.emailLogs.search({ userId: id, limit: 20 }),
    ]);

    res.json({
      user: toPublicUser(user, role?.name ?? "user"),
      profile: profile
        ? { avatarUrl: profile.avatarUrl, phone: profile.phone, bio: profile.bio, timezone: profile.timezone }
        : null,
      tickets,
      emailLogs,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin] get user detail error:", msg);
    res.status(500).json({ error: "Failed to load user detail" });
  }
});

router.delete("/admin/users/:id", requireAuth, requirePermission("users.manage"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  try {
    const user = await db.users.findById(id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const role = await db.roles.findById(user.roleId);
    if (role?.name === "admin") {
      res.status(403).json({ error: "Cannot delete an admin account" });
      return;
    }

    await db.users.deleteById(id);
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin] delete user error:", msg);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

router.post("/admin/users/:id/plan", requireAuth, requirePermission("users.manage"), async (req, res) => {
  const id = Number(req.params.id);
  const { plan } = req.body ?? {};

  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  if (plan !== "free" && plan !== "pro" && plan !== "premium") {
    res.status(400).json({ error: "Plan must be free, pro, or premium" });
    return;
  }

  try {
    const user = await db.users.findById(id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const role = await db.roles.findById(user.roleId);

    await db.users.updatePlan(id, plan);
    const updated = await db.users.findById(id);
    res.json({ user: toPublicUser(updated!, role?.name ?? "user") });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin] update plan error:", msg);
    res.status(500).json({ error: "Failed to update plan" });
  }
});

export default router;
