import { Router, type IRouter } from "express";
import { db, type SupportCategory, type SupportPriority, type SupportStatus } from "@workspace/db";
import { requireAuth, resolveBaseUrl } from "../lib/auth.js";
import { sendTemplatedEmail } from "../lib/email/index.js";

const router: IRouter = Router();

const CATEGORIES: readonly SupportCategory[] = [
  "account_login", "technical_issue", "market_data", "ai_signals",
  "holding_stocks", "intraday", "options", "commodities",
  "subscription_billing", "payment", "feature_request", "feedback", "other",
];
export const PRIORITIES: readonly SupportPriority[] = ["low", "medium", "high", "urgent"];

export const STATUS_LABELS: Record<SupportStatus, string> = {
  open: "Open",
  waiting_admin: "Waiting for Admin",
  waiting_user: "Waiting for You",
  resolved: "Resolved",
  closed: "Closed",
};

router.post("/support/tickets", requireAuth, async (req, res) => {
  try {
    const { category, subject, description, priority } = req.body ?? {};
    const user = req.user!;

    if (typeof category !== "string" || !CATEGORIES.includes(category as SupportCategory)) {
      res.status(400).json({ error: "Select a valid category" });
      return;
    }
    if (typeof subject !== "string" || subject.trim().length < 3 || subject.trim().length > 200) {
      res.status(400).json({ error: "Subject must be between 3 and 200 characters" });
      return;
    }
    if (typeof description !== "string" || description.trim().length < 10) {
      res.status(400).json({ error: "Please describe your issue in at least 10 characters" });
      return;
    }
    const ticketPriority: SupportPriority =
      typeof priority === "string" && PRIORITIES.includes(priority as SupportPriority)
        ? (priority as SupportPriority)
        : "medium";

    const ticket = await db.supportTickets.insert({
      userId: user.id,
      category: category as SupportCategory,
      subject: subject.trim(),
      description: description.trim(),
      priority: ticketPriority,
    });
    if (!ticket) {
      res.status(503).json({ error: "Support tickets aren't available yet. Please try again later." });
      return;
    }

    // The initial description doubles as the first message in the thread,
    // so the conversation view never needs to special-case "message zero".
    await db.supportMessages.insert({
      ticketId: ticket.id,
      authorUserId: user.id,
      isAdminReply: false,
      body: ticket.description,
    });

    res.status(201).json({ ticket });

    const baseUrl = resolveBaseUrl(req);
    void sendTemplatedEmail(
      "ticket_created",
      user.email,
      {
        user_name: user.name,
        user_email: user.email,
        ticket_id: ticket.ticketNumber ?? String(ticket.id),
        ticket_subject: ticket.subject,
        ticket_status: STATUS_LABELS[ticket.status],
        support_url: `${baseUrl}/`,
      },
      { userId: user.id, triggerSource: "ticket-created" },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[support] create ticket error:", msg);
    if (!res.headersSent) res.status(500).json({ error: "Failed to create ticket" });
  }
});

router.get("/support/tickets", requireAuth, async (req, res) => {
  try {
    const tickets = await db.supportTickets.findByUser(req.user!.id);
    res.json({ tickets });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[support] list tickets error:", msg);
    res.status(500).json({ error: "Failed to load tickets" });
  }
});

router.get("/support/tickets/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid ticket id" });
      return;
    }

    const ticket = await db.supportTickets.findById(id);
    // 404, not 403, for someone else's ticket — don't confirm the id exists.
    if (!ticket || ticket.userId !== req.user!.id) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const messages = await db.supportMessages.findByTicket(id);
    res.json({ ticket, messages });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[support] get ticket error:", msg);
    res.status(500).json({ error: "Failed to load ticket" });
  }
});

router.post("/support/tickets/:id/messages", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { body } = req.body ?? {};
    const user = req.user!;

    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid ticket id" });
      return;
    }
    if (typeof body !== "string" || body.trim().length === 0) {
      res.status(400).json({ error: "Message cannot be empty" });
      return;
    }

    const ticket = await db.supportTickets.findById(id);
    if (!ticket || ticket.userId !== user.id) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    if (ticket.status === "closed") {
      res.status(400).json({ error: "This ticket is closed. Please open a new ticket if you need further help." });
      return;
    }

    const message = await db.supportMessages.insert({
      ticketId: id,
      authorUserId: user.id,
      isAdminReply: false,
      body: body.trim(),
    });
    // The ball is back in the admin's court — surfaces in their queue.
    await db.supportTickets.updateStatus(id, "waiting_admin");

    res.status(201).json({ message });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[support] reply error:", msg);
    if (!res.headersSent) res.status(500).json({ error: "Failed to send reply" });
  }
});

export default router;
