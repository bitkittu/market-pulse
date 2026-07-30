import { Router, type IRouter } from "express";
import { db, type SupportCategory, type SupportPriority, type SupportStatus } from "@workspace/db";
import { requireAuth, requirePermission, resolveBaseUrl } from "../lib/auth.js";
import { sendTemplatedEmail } from "../lib/email/index.js";
import { STATUS_LABELS, PRIORITIES } from "./support.js";

const router: IRouter = Router();

// requireAuth/requirePermission are applied per-route, not as a blanket
// `router.use()` — every router in routes/index.ts is mounted with no path
// prefix, so a path-less `.use()` here would run for every request that
// falls through earlier routers, not just this file's own `/admin/*` paths.
const viewGuard = [requireAuth, requirePermission("support.view")] as const;
const manageGuard = [requireAuth, requirePermission("support.manage")] as const;

const STATUSES: readonly SupportStatus[] = ["open", "waiting_admin", "waiting_user", "resolved", "closed"];

router.get("/admin/support/counts", ...viewGuard, async (_req, res) => {
  try {
    const counts = await db.supportTickets.counts();
    res.json(counts);
  } catch (err) {
    console.error("[admin-support] counts error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load ticket counts" });
  }
});

router.get("/admin/support/tickets", ...viewGuard, async (req, res) => {
  try {
    const { status, category, priority, assignedAdminId, q } = req.query;
    const tickets = await db.supportTickets.search({
      status: typeof status === "string" && STATUSES.includes(status as SupportStatus) ? (status as SupportStatus) : undefined,
      category: typeof category === "string" ? (category as SupportCategory) : undefined,
      priority: typeof priority === "string" && PRIORITIES.includes(priority as SupportPriority) ? (priority as SupportPriority) : undefined,
      assignedAdminId: typeof assignedAdminId === "string" && assignedAdminId ? Number(assignedAdminId) : undefined,
      q: typeof q === "string" && q.trim() ? q.trim() : undefined,
    });
    res.json({ tickets });
  } catch (err) {
    console.error("[admin-support] list tickets error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load tickets" });
  }
});

router.get("/admin/support/tickets/:id", ...viewGuard, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid ticket id" });
      return;
    }
    const ticket = await db.supportTickets.findById(id);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const [messages, internalNotes, requester] = await Promise.all([
      db.supportMessages.findByTicket(id),
      db.supportInternalNotes.findByTicket(id),
      db.users.findById(ticket.userId),
    ]);
    res.json({
      ticket,
      messages,
      internalNotes,
      requester: requester ? { id: requester.id, name: requester.name, email: requester.email } : null,
    });
  } catch (err) {
    console.error("[admin-support] get ticket error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load ticket" });
  }
});

router.post("/admin/support/tickets/:id/messages", ...manageGuard, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { body } = req.body ?? {};
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid ticket id" });
      return;
    }
    if (typeof body !== "string" || body.trim().length === 0) {
      res.status(400).json({ error: "Reply cannot be empty" });
      return;
    }

    const ticket = await db.supportTickets.findById(id);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const admin = req.user!;
    const message = await db.supportMessages.insert({
      ticketId: id,
      authorUserId: admin.id,
      isAdminReply: true,
      body: body.trim(),
    });
    await db.supportTickets.updateStatus(id, "waiting_user");

    res.status(201).json({ message });

    const requester = await db.users.findById(ticket.userId);
    if (requester) {
      const baseUrl = resolveBaseUrl(req);
      void sendTemplatedEmail(
        "ticket_reply",
        requester.email,
        {
          user_name: requester.name,
          user_email: requester.email,
          ticket_id: ticket.ticketNumber ?? String(ticket.id),
          ticket_subject: ticket.subject,
          support_url: `${baseUrl}/`,
        },
        { userId: requester.id, triggerSource: "admin-ticket-reply" },
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin-support] reply error:", msg);
    if (!res.headersSent) res.status(500).json({ error: "Failed to send reply" });
  }
});

router.patch("/admin/support/tickets/:id/status", ...manageGuard, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body ?? {};
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid ticket id" });
      return;
    }
    if (typeof status !== "string" || !STATUSES.includes(status as SupportStatus)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const ticket = await db.supportTickets.findById(id);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    await db.supportTickets.updateStatus(id, status as SupportStatus);
    const updated = await db.supportTickets.findById(id);
    res.json({ ticket: updated });

    const requester = await db.users.findById(ticket.userId);
    if (requester && updated) {
      const baseUrl = resolveBaseUrl(req);
      const vars = {
        user_name: requester.name,
        user_email: requester.email,
        ticket_id: updated.ticketNumber ?? String(updated.id),
        ticket_subject: updated.subject,
        ticket_status: STATUS_LABELS[updated.status],
        support_url: `${baseUrl}/`,
      };
      const templateKey =
        updated.status === "resolved" ? "ticket_resolved" : updated.status === "closed" ? "ticket_closed" : "ticket_status_changed";
      void sendTemplatedEmail(templateKey, requester.email, vars, {
        userId: requester.id,
        triggerSource: "admin-status-change",
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin-support] status change error:", msg);
    if (!res.headersSent) res.status(500).json({ error: "Failed to update status" });
  }
});

router.patch("/admin/support/tickets/:id/priority", ...manageGuard, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { priority } = req.body ?? {};
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid ticket id" });
      return;
    }
    if (typeof priority !== "string" || !PRIORITIES.includes(priority as SupportPriority)) {
      res.status(400).json({ error: "Invalid priority" });
      return;
    }
    const ticket = await db.supportTickets.findById(id);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    await db.supportTickets.updatePriority(id, priority as SupportPriority);
    const updated = await db.supportTickets.findById(id);
    res.json({ ticket: updated });
  } catch (err) {
    console.error("[admin-support] priority change error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to update priority" });
  }
});

router.post("/admin/support/tickets/:id/assign", ...manageGuard, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { adminId } = req.body ?? {};
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid ticket id" });
      return;
    }
    const ticket = await db.supportTickets.findById(id);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    if (adminId === null) {
      await db.supportTickets.assign(id, null);
      const updated = await db.supportTickets.findById(id);
      res.json({ ticket: updated });
      return;
    }

    const targetId = Number(adminId);
    if (!Number.isInteger(targetId)) {
      res.status(400).json({ error: "Invalid admin id" });
      return;
    }
    const target = await db.users.findById(targetId);
    const targetRole = target ? await db.roles.findById(target.roleId) : null;
    if (!target || targetRole?.name !== "admin") {
      res.status(400).json({ error: "That user is not an admin" });
      return;
    }

    await db.supportTickets.assign(id, targetId);
    await db.supportAssignments.insert({ ticketId: id, adminUserId: targetId, assignedBy: req.user!.id });
    const updated = await db.supportTickets.findById(id);
    res.json({ ticket: updated });
  } catch (err) {
    console.error("[admin-support] assign error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to assign ticket" });
  }
});

router.post("/admin/support/tickets/:id/notes", ...manageGuard, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { body } = req.body ?? {};
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid ticket id" });
      return;
    }
    if (typeof body !== "string" || body.trim().length === 0) {
      res.status(400).json({ error: "Note cannot be empty" });
      return;
    }
    const ticket = await db.supportTickets.findById(id);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const note = await db.supportInternalNotes.insert({ ticketId: id, adminUserId: req.user!.id, body: body.trim() });
    res.status(201).json({ note });
  } catch (err) {
    console.error("[admin-support] add note error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to add note" });
  }
});

export default router;
