import { Router, type IRouter } from "express";
import { collections } from "@workspace/db";
import { requireAuth, requirePermission, toPublicUser } from "../lib/auth.js";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/admin/users", requirePermission("users.view"), async (_req, res) => {
  try {
    const [users, roles] = await Promise.all([
      collections.users().find().toArray(),
      collections.roles().find().toArray(),
    ]);
    const roleName = (roleId: number) => roles.find((r) => r.id === roleId)?.name ?? "user";
    res.json(users.map((user) => toPublicUser(user, roleName(user.roleId))));
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
    const user = await collections.users().findOne({ id });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const role = await collections.roles().findOne({ id: user.roleId });
    if (role?.name === "admin") {
      res.status(403).json({ error: "Cannot delete an admin account" });
      return;
    }

    await collections.users().deleteOne({ id });
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
    const user = await collections.users().findOne({ id });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const role = await collections.roles().findOne({ id: user.roleId });

    await collections.users().updateOne({ id }, { $set: { plan, updatedAt: new Date() } });
    const updated = await collections.users().findOne({ id });
    res.json({ user: toPublicUser(updated!, role?.name ?? "user") });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin] update plan error:", msg);
    res.status(500).json({ error: "Failed to update plan" });
  }
});

export default router;
