import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, rolesTable } from "@workspace/db";
import { requireAuth, requirePermission, toPublicUser } from "../lib/auth.js";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/admin/users", requirePermission("users.view"), async (_req, res) => {
  try {
    const rows = await db
      .select({ user: usersTable, roleName: rolesTable.name })
      .from(usersTable)
      .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id));
    res.json(rows.map(({ user, roleName }) => toPublicUser(user, roleName)));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin] list users error:", msg);
    res.status(500).json({ error: "Failed to load users" });
  }
});

router.delete("/admin/users/:id", requirePermission("users.manage"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  try {
    const [row] = await db
      .select({ user: usersTable, roleName: rolesTable.name })
      .from(usersTable)
      .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
      .where(eq(usersTable.id, id));
    if (!row) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (row.roleName === "admin") {
      res.status(403).json({ error: "Cannot delete an admin account" });
      return;
    }

    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin] delete user error:", msg);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

router.post("/admin/users/:id/plan", requirePermission("users.manage"), async (req, res) => {
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
    const [row] = await db
      .select({ user: usersTable, roleName: rolesTable.name })
      .from(usersTable)
      .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
      .where(eq(usersTable.id, id));
    if (!row) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await db.update(usersTable).set({ plan }).where(eq(usersTable.id, id));
    const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    res.json({ user: toPublicUser(updated, row.roleName) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin] update plan error:", msg);
    res.status(500).json({ error: "Failed to update plan" });
  }
});

export default router;
