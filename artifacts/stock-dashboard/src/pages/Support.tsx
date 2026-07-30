import { useEffect, useState } from "react";
import {
  LifeBuoy, Plus, ArrowLeft, Loader2, AlertCircle, Send, Clock, Tag, CheckCircle2,
} from "lucide-react";
import { api } from "@/contexts/AuthContext";
import {
  SUPPORT_CATEGORY_LABELS as CATEGORY_LABELS,
  type SupportCategory as Category,
  type SupportPriority as Priority,
  type SupportStatus as Status,
} from "@/lib/support";

// ── Types (mirrors artifacts/api-server's SupportTicketRow/SupportMessageRow) ─
// STATUS_LABELS/STATUS_BADGE are deliberately NOT shared with AdminPanel's
// copies — see src/lib/support.ts for why (second-person phrasing, theme-aware
// colors vs. the admin panel's dark-only palette).
const STATUS_LABELS: Record<Status, string> = {
  open: "Open",
  waiting_admin: "Waiting for Admin",
  waiting_user: "Waiting for You",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_BADGE: Record<Status, string> = {
  open: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  waiting_admin: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  waiting_user: "bg-violet-500/15 text-violet-500 border-violet-500/30",
  resolved: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  closed: "bg-muted text-muted-foreground border-border",
};

interface Ticket {
  id: number;
  ticketNumber: string | null;
  category: Category;
  subject: string;
  description: string;
  priority: Priority;
  status: Status;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: number;
  ticketId: number;
  authorUserId: number;
  isAdminReply: boolean;
  body: string;
  createdAt: string;
}

const PRIORITY_BADGE: Record<Priority, string> = {
  low: "text-muted-foreground",
  medium: "text-blue-500",
  high: "text-amber-500",
  urgent: "text-red-500",
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function cn(...c: (string | false | undefined | null)[]) {
  return c.filter(Boolean).join(" ");
}

// ── Ticket list ───────────────────────────────────────────────────────────
const FILTERS: { id: "all" | "open" | "waiting" | "resolved" | "closed"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "waiting", label: "Waiting" },
  { id: "resolved", label: "Resolved" },
  { id: "closed", label: "Closed" },
];

function TicketList({ onOpen, onNew }: { onOpen: (id: number) => void; onNew: () => void }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  useEffect(() => {
    (async () => {
      const res = await api<{ tickets: Ticket[] }>("/support/tickets");
      if (res.ok) setTickets((res.data as { tickets: Ticket[] }).tickets);
      setLoading(false);
    })();
  }, []);

  const filtered = tickets.filter((t) => {
    if (filter === "all") return true;
    if (filter === "waiting") return t.status === "waiting_admin" || t.status === "waiting_user";
    return t.status === filter;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-primary" /> Support
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{tickets.length} tickets</p>
        </div>
        <button onClick={onNew}
          className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold px-4 py-2.5 rounded-lg text-sm transition-all">
          <Plus className="w-4 h-4" /> New Ticket
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0",
              filter === f.id ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-32 bg-muted/30 animate-pulse rounded-xl" />
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <LifeBuoy className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No tickets here yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <button key={t.id} onClick={() => onOpen(t.id)}
              className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-mono text-muted-foreground">{t.ticketNumber ?? `#${t.id}`}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-semibold", STATUS_BADGE[t.status])}>
                      {STATUS_LABELS[t.status]}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate">{t.subject}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Tag className="w-3 h-3" /> {CATEGORY_LABELS[t.category]}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {fmtDateTime(t.updatedAt)}</span>
                  </div>
                </div>
                <span className={cn("text-xs font-bold uppercase shrink-0", PRIORITY_BADGE[t.priority])}>{t.priority}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── New ticket ────────────────────────────────────────────────────────────
function NewTicket({ onBack, onCreated }: { onBack: () => void; onCreated: (id: number) => void }) {
  const [category, setCategory] = useState<Category>("technical_issue");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subject.trim().length < 3) { setError("Subject must be at least 3 characters"); return; }
    if (description.trim().length < 10) { setError("Please describe your issue in a bit more detail"); return; }
    setSaving(true); setError("");
    const res = await api<{ ticket: Ticket }>("/support/tickets", {
      method: "POST",
      body: JSON.stringify({ category, subject: subject.trim(), description: description.trim(), priority }),
    });
    setSaving(false);
    if (!res.ok) { setError((res.data as { error: string }).error); return; }
    onCreated((res.data as { ticket: Ticket }).ticket.id);
  };

  const inputCls = "w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50";
  const labelCls = "block text-xs font-semibold text-muted-foreground mb-1.5";

  return (
    <div className="max-w-2xl space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to tickets
      </button>
      <h1 className="text-xl font-black text-foreground">New Support Ticket</h1>

      <form onSubmit={submit} className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div>
          <label className={labelCls}>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className={inputCls}>
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary of your issue" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className={inputCls}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6}
            placeholder="Describe what happened, what you expected, and any steps to reproduce."
            className={inputCls} />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-500 text-sm bg-red-500/10 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <button type="submit" disabled={saving}
          className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-all disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {saving ? "Submitting…" : "Submit Ticket"}
        </button>
      </form>
    </div>
  );
}

// ── Conversation ──────────────────────────────────────────────────────────
function TicketConversation({ id, onBack }: { id: number; onBack: () => void }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const res = await api<{ ticket: Ticket; messages: Message[] }>(`/support/tickets/${id}`);
    if (res.ok) {
      const d = res.data as { ticket: Ticket; messages: Message[] };
      setTicket(d.ticket);
      setMessages(d.messages);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true); setError("");
    const res = await api(`/support/tickets/${id}/messages`, { method: "POST", body: JSON.stringify({ body: reply.trim() }) });
    setSending(false);
    if (!res.ok) { setError((res.data as { error: string }).error); return; }
    setReply("");
    await load();
  };

  if (loading) return <div className="h-64 bg-muted/30 animate-pulse rounded-xl" />;
  if (!ticket) return <p className="text-sm text-muted-foreground">Ticket not found.</p>;

  const isClosed = ticket.status === "closed";

  return (
    <div className="max-w-2xl space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to tickets
      </button>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-xs font-mono text-muted-foreground">{ticket.ticketNumber ?? `#${ticket.id}`}</span>
          <span className={cn("text-xs px-2 py-0.5 rounded-full border font-semibold", STATUS_BADGE[ticket.status])}>
            {STATUS_LABELS[ticket.status]}
          </span>
          <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[ticket.category]}</span>
        </div>
        <h1 className="text-lg font-bold text-foreground">{ticket.subject}</h1>
        <p className="text-xs text-muted-foreground mt-1">Created {fmtDateTime(ticket.createdAt)}</p>
      </div>

      <div className="space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.isAdminReply ? "justify-start" : "justify-end")}>
            <div className={cn(
              "max-w-[85%] rounded-xl px-4 py-2.5 border",
              m.isAdminReply ? "bg-card border-border" : "bg-primary/10 border-primary/20",
            )}>
              <p className="text-xs font-semibold mb-1 text-muted-foreground">{m.isAdminReply ? "Support Team" : "You"}</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{m.body}</p>
              <p className="text-[10px] text-muted-foreground mt-1.5">{fmtDateTime(m.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>

      {isClosed ? (
        <div className="bg-muted/30 border border-border rounded-xl p-4 text-sm text-muted-foreground flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> This ticket is closed. Open a new ticket if you need further help.
        </div>
      ) : (
        <form onSubmit={submitReply} className="bg-card border border-border rounded-xl p-4 space-y-2">
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3}
            placeholder="Write a reply…"
            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={sending || !reply.trim()}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
          </button>
        </form>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
type View = { name: "list" } | { name: "new" } | { name: "ticket"; id: number };

export function Support() {
  const [view, setView] = useState<View>({ name: "list" });

  if (view.name === "new") {
    return <NewTicket onBack={() => setView({ name: "list" })} onCreated={(id) => setView({ name: "ticket", id })} />;
  }
  if (view.name === "ticket") {
    return <TicketConversation id={view.id} onBack={() => setView({ name: "list" })} />;
  }
  return <TicketList onOpen={(id) => setView({ name: "ticket", id })} onNew={() => setView({ name: "new" })} />;
}
