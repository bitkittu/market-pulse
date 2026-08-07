import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, Brain, Newspaper, Server, CreditCard,
  MessageSquare, FileText, Shield, Activity, LogOut, TrendingUp,
  ChevronRight, Trash2, Edit3, Search, BadgeCheck, Crown, Zap,
  CheckCircle2, XCircle, Clock, Globe, Database, Cpu, AlertCircle,
  BarChart2, ArrowUp, ArrowDown, Sun, Moon, Mail, ScrollText,
  Eye, EyeOff, Loader2, Save, Send, X, ToggleLeft, ToggleRight,
  LifeBuoy, ArrowLeft, UserPlus, Tag, StickyNote,
} from "lucide-react";
import { useAuth, api } from "@/contexts/AuthContext";
import {
  SUPPORT_CATEGORY_LABELS,
  type SupportCategory,
  type SupportPriority,
  type SupportStatus,
} from "@/lib/support";

type AdminView = "dashboard" | "users" | "ai" | "news" | "apis" | "plans" | "feedback" | "reports" | "audit" | "system" | "email" | "templates" | "emaillogs" | "support";

const SECTIONS = [
  { id: "dashboard", label: "Dashboard",       icon: LayoutDashboard },
  { id: "users",     label: "User Management", icon: Users },
  { id: "support",   label: "Support Center",  icon: LifeBuoy },
  { id: "email",     label: "Email / SMTP",    icon: Mail },
  { id: "templates", label: "Email Templates", icon: Edit3 },
  { id: "emaillogs", label: "Email Logs",      icon: ScrollText },
  { id: "ai",        label: "AI Model Settings", icon: Brain },
  { id: "news",      label: "News Sources",    icon: Newspaper },
  { id: "apis",      label: "Market APIs",     icon: Server },
  { id: "plans",     label: "Subscription Plans", icon: CreditCard },
  { id: "feedback",  label: "Feedback",        icon: MessageSquare },
  { id: "reports",   label: "Reports",         icon: FileText },
  { id: "audit",     label: "Audit Logs",      icon: Shield },
  { id: "system",    label: "System Monitor",  icon: Activity },
] as const;

// ── Stat Card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, trend, color }: {
  label: string; value: string; sub: string;
  icon: typeof LayoutDashboard; trend?: "up" | "down"; color: string;
}) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-400 text-xs font-medium">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color} shrink-0`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <div className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-1">{value}</div>
      <div className={`flex items-center gap-1 text-xs ${trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-slate-400"}`}>
        {trend === "up" && <ArrowUp className="w-3 h-3" />}
        {trend === "down" && <ArrowDown className="w-3 h-3" />}
        {sub}
      </div>
    </div>
  );
}

// ── Dashboard Overview ────────────────────────────────────────────────────
function DashboardView({ users }: { users: ReturnType<ReturnType<typeof useAuth>["allUsers"]> }) {
  const total = users.length;
  const free   = users.filter(u => u.plan === "free").length;
  const pro    = users.filter(u => u.plan === "pro").length;
  const prem   = users.filter(u => u.plan === "premium").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Admin Dashboard</h2>
        <p className="text-slate-400 text-sm">Platform overview and key metrics</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={total.toString()} sub="+3 this week" icon={Users} trend="up" color="bg-blue-600" />
        <StatCard label="Pro Subscribers" value={pro.toString()} sub="24% conversion" icon={Crown} trend="up" color="bg-violet-600" />
        <StatCard label="Premium Users" value={prem.toString()} sub="8% of total" icon={Zap} trend="up" color="bg-amber-600" />
        <StatCard label="Free Users" value={free.toString()} sub="Eligible for upgrade" icon={Users} color="bg-slate-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue */}
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-emerald-400" /> Monthly Revenue
          </h3>
          <div className="space-y-2">
            {[
              { month: "Jun 2025", rev: "₹2,94,500", bars: 90 },
              { month: "May 2025", rev: "₹2,61,000", bars: 80 },
              { month: "Apr 2025", rev: "₹2,18,000", bars: 67 },
              { month: "Mar 2025", rev: "₹1,95,000", bars: 60 },
            ].map(r => (
              <div key={r.month} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-20">{r.month}</span>
                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full" style={{ width: `${r.bars}%` }} />
                </div>
                <span className="text-xs text-white font-mono w-24 text-right">{r.rev}</span>
              </div>
            ))}
          </div>
        </div>

        {/* System health */}
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" /> System Health
          </h3>
          <div className="space-y-3">
            {[
              { label: "API Uptime", value: "99.97%", ok: true },
              { label: "NSE Data Feed", value: "Live", ok: true },
              { label: "AI Model", value: "Online", ok: true },
              { label: "Database", value: "Healthy", ok: true },
              { label: "Last Backup", value: "2h ago", ok: true },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{s.label}</span>
                <div className="flex items-center gap-1.5">
                  {s.ok
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                  <span className={`text-xs font-medium ${s.ok ? "text-emerald-400" : "text-red-400"}`}>{s.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── User Management ───────────────────────────────────────────────────────
function UsersView({ users, onDelete, onPlanChange, onOpen }: {
  users: ReturnType<ReturnType<typeof useAuth>["allUsers"]>;
  onDelete: (id: number) => void;
  onPlanChange: (id: number, plan: "free" | "pro" | "premium") => void;
  onOpen: (id: number) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const planColor = (p: string) =>
    p === "premium" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
    p === "pro"     ? "bg-violet-500/20 text-violet-400 border border-violet-500/30" :
                      "bg-slate-600/40 text-slate-400 border border-slate-600/30";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">User Management</h2>
          <p className="text-slate-400 text-sm">{users.length} total accounts</p>
        </div>
        <div className="relative w-full sm:w-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search users..."
            className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full sm:w-56" />
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-slate-700/50">
              {["User", "Role", "Plan", "Joined", "Last Login", "Actions"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-slate-700/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{u.name}</div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-slate-600/40 text-slate-400 border border-slate-600/30"}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <select value={u.plan}
                    onChange={e => onPlanChange(u.id, e.target.value as "free" | "pro" | "premium")}
                    disabled={u.role === "admin"}
                    className={`text-xs px-2 py-0.5 rounded-full border bg-transparent cursor-pointer disabled:cursor-not-allowed ${planColor(u.plan)}`}>
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="premium">Premium</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {new Date(u.joinedAt).toLocaleDateString("en-IN")}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString("en-IN") : "Never"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => onOpen(u.id)}
                      className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {u.role !== "admin" && (
                      <button onClick={() => { if (confirm(`Delete ${u.name}?`)) onDelete(u.id); }}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

// ── User 360° detail (§31) ────────────────────────────────────────────────
interface UserDetailData {
  user: {
    id: number; name: string; email: string; role: string; plan: string;
    joinedAt: string; lastLogin: string | null; emailVerified: boolean;
  };
  profile: { avatarUrl: string | null; phone: string | null; bio: string | null; timezone: string } | null;
  tickets: { id: number; ticketNumber: string | null; subject: string; status: SupportStatus; priority: string; updatedAt: string }[];
  emailLogs: { id: number; templateKey: string; subject: string; status: string; createdAt: string }[];
}

function UserDetailView({ id, onBack }: { id: number; onBack: () => void }) {
  const [data, setData] = useState<UserDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await api<UserDetailData>(`/admin/users/${id}`);
      if (res.ok) setData(res.data as UserDetailData);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="h-64 bg-slate-800/40 animate-pulse rounded-xl" />;
  if (!data) return <p className="text-slate-400 text-sm">User not found.</p>;

  const { user, profile, tickets, emailLogs } = data;

  return (
    <div className="max-w-3xl space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to users
      </button>

      <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white text-xl font-black shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-white truncate">{user.name}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${user.role === "admin" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-slate-600/40 text-slate-400 border-slate-600/30"}`}>
                {user.role}
              </span>
              {user.emailVerified ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">Verified</span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold">Unverified</span>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-0.5">{user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2">
            <p className="text-xs text-slate-500">Plan</p>
            <p className="text-sm font-semibold text-white capitalize">{user.plan}</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2">
            <p className="text-xs text-slate-500">Created</p>
            <p className="text-sm font-semibold text-white">{new Date(user.joinedAt).toLocaleDateString("en-IN")}</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2">
            <p className="text-xs text-slate-500">Last Login</p>
            <p className="text-sm font-semibold text-white">{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString("en-IN") : "Never"}</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2">
            <p className="text-xs text-slate-500">Phone</p>
            <p className="text-sm font-semibold text-white">{profile?.phone || "—"}</p>
          </div>
        </div>
        {profile?.bio && <p className="text-xs text-slate-400 mt-3">{profile.bio}</p>}
      </div>

      <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
          <LifeBuoy className="w-4 h-4 text-blue-400" /> Support Tickets ({tickets.length})
        </h3>
        {tickets.length === 0 ? (
          <p className="text-xs text-slate-500">No tickets yet.</p>
        ) : (
          <div className="space-y-1.5">
            {tickets.slice(0, 10).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-slate-700/30 last:border-0">
                <span className="text-slate-400 font-mono shrink-0">{t.ticketNumber ?? `#${t.id}`}</span>
                <span className="text-white truncate flex-1">{t.subject}</span>
                <span className={`px-2 py-0.5 rounded-full border font-semibold shrink-0 ${SUPPORT_STATUS_BADGE[t.status]}`}>
                  {SUPPORT_STATUS_LABELS[t.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
          <Mail className="w-4 h-4 text-blue-400" /> Email History ({emailLogs.length})
        </h3>
        {emailLogs.length === 0 ? (
          <p className="text-xs text-slate-500">No emails sent yet.</p>
        ) : (
          <div className="space-y-1.5">
            {emailLogs.slice(0, 10).map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-slate-700/30 last:border-0">
                <span className="text-slate-400 font-mono shrink-0">{e.templateKey}</span>
                <span className="text-white truncate flex-1">{e.subject}</span>
                <span className={`shrink-0 ${e.status === "sent" ? "text-emerald-400" : e.status === "failed" ? "text-red-400" : "text-slate-400"}`}>
                  {e.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UsersSection({ users, onDelete, onPlanChange }: {
  users: ReturnType<ReturnType<typeof useAuth>["allUsers"]>;
  onDelete: (id: number) => void;
  onPlanChange: (id: number, plan: "free" | "pro" | "premium") => void;
}) {
  const [view, setView] = useState<{ name: "list" } | { name: "detail"; id: number }>({ name: "list" });
  if (view.name === "detail") {
    return <UserDetailView id={view.id} onBack={() => setView({ name: "list" })} />;
  }
  return <UsersView users={users} onDelete={onDelete} onPlanChange={onPlanChange} onOpen={(id) => setView({ name: "detail", id })} />;
}

// ── Placeholder section ───────────────────────────────────────────────────
function PlaceholderView({ title, desc, icon: Icon }: { title: string; desc: string; icon: typeof LayoutDashboard }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
      <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-slate-500" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
      <p className="text-slate-400 text-sm max-w-xs">{desc}</p>
      <div className="mt-4 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs">
        Coming soon
      </div>
    </div>
  );
}

// ── System Monitor ────────────────────────────────────────────────────────
function SystemView() {
  const metrics = [
    { label: "CPU Usage", value: 23, unit: "%", icon: Cpu, color: "text-blue-400" },
    { label: "Memory", value: 61, unit: "%", icon: Database, color: "text-violet-400" },
    { label: "API Requests/min", value: 342, unit: "", icon: Globe, color: "text-emerald-400" },
    { label: "Active Sessions", value: 18, unit: "", icon: Users, color: "text-amber-400" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">System Monitor</h2>
        <p className="text-slate-400 text-sm">Real-time platform health and performance</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(m => (
          <div key={m.label} className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs">{m.label}</span>
              <m.icon className={`w-4 h-4 ${m.color} shrink-0`} />
            </div>
            <div className={`text-lg sm:text-xl md:text-2xl font-bold font-mono ${m.color}`}>
              {m.value}{m.unit}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Recent Alerts</h3>
        <div className="space-y-2">
          {[
            { type: "ok", msg: "NSE data feed connected successfully", time: "2 min ago" },
            { type: "ok", msg: "Database backup completed (2.4 GB)", time: "2h ago" },
            { type: "warn", msg: "Upstox API rate limit: 89% capacity", time: "4h ago" },
            { type: "ok", msg: "AI model inference latency: 142ms avg", time: "6h ago" },
          ].map((a, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
              {a.type === "ok"
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                : <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />}
              <span className="text-sm text-slate-300 flex-1">{a.msg}</span>
              <span className="text-xs text-slate-500">{a.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Email views shared styles ────────────────────────────────────────────────
const emailInputCls = "w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50";
const emailLabelCls = "block text-xs font-medium text-slate-400 mb-1.5";

// ── Email / SMTP settings ────────────────────────────────────────────────────
interface SmtpSettingsData {
  configured: boolean;
  host: string; port: number; encryption: "none" | "ssl" | "tls";
  username: string; hasPassword: boolean;
  fromName: string; fromEmail: string; replyToEmail: string; supportEmail: string;
  updatedAt: string | null;
}

function EmailSettingsView() {
  const [loading, setLoading] = useState(true);
  const [hasPassword, setHasPassword] = useState(false);
  const [form, setForm] = useState({
    host: "", port: 587, encryption: "tls" as "none" | "ssl" | "tls", username: "", password: "",
    fromName: "Market Pulse AI", fromEmail: "", replyToEmail: "", supportEmail: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [testRecipient, setTestRecipient] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await api<SmtpSettingsData>("/admin/settings/email");
      if (res.ok) {
        const d = res.data as SmtpSettingsData;
        setForm({
          host: d.host, port: d.port, encryption: d.encryption, username: d.username, password: "",
          fromName: d.fromName, fromEmail: d.fromEmail, replyToEmail: d.replyToEmail, supportEmail: d.supportEmail,
        });
        setHasPassword(d.hasPassword);
      }
      setLoading(false);
    })();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg(""); setErr("");
    const res = await api<SmtpSettingsData>("/admin/settings/email", {
      method: "PUT",
      body: JSON.stringify({ ...form, port: Number(form.port) }),
    });
    setSaving(false);
    if (!res.ok) { setErr((res.data as { error: string }).error); return; }
    const d = res.data as SmtpSettingsData;
    setHasPassword(d.hasPassword);
    setForm((f) => ({ ...f, password: "" }));
    setMsg("Email settings saved.");
  };

  const sendTest = async () => {
    if (!testRecipient) return;
    setTesting(true); setTestResult(null);
    const res = await api<{ ok: boolean; message: string }>("/admin/settings/email/test", {
      method: "POST",
      body: JSON.stringify({ recipient: testRecipient }),
    });
    setTesting(false);
    setTestResult(res.data as { ok: boolean; message: string });
  };

  if (loading) return <div className="h-64 bg-slate-800/40 animate-pulse rounded-xl" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Email / SMTP Settings</h2>
        <p className="text-slate-400 text-sm">Configure the outbound mail server used for every MarketPulse AI email.</p>
      </div>

      <form onSubmit={save} className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className={emailLabelCls}>SMTP Host</label>
            <input value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
              placeholder="smtp.example.com" className={emailInputCls} />
          </div>
          <div>
            <label className={emailLabelCls}>Port</label>
            <input type="number" value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))}
              className={emailInputCls} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={emailLabelCls}>Encryption</label>
            <select value={form.encryption} onChange={(e) => setForm((f) => ({ ...f, encryption: e.target.value as typeof f.encryption }))}
              className={emailInputCls}>
              <option value="tls">TLS (STARTTLS)</option>
              <option value="ssl">SSL</option>
              <option value="none">None</option>
            </select>
          </div>
          <div>
            <label className={emailLabelCls}>SMTP Username</label>
            <input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              className={emailInputCls} />
          </div>
        </div>

        <div>
          <label className={emailLabelCls}>SMTP Password {hasPassword && <span className="text-emerald-400 font-normal">(currently set — leave blank to keep it)</span>}</label>
          <div className="relative">
            <input type={showPw ? "text" : "password"} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder={hasPassword ? "••••••••" : "Enter SMTP password"} className={`${emailInputCls} pr-10`} />
            <button type="button" onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={emailLabelCls}>From Name</label>
            <input value={form.fromName} onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))} className={emailInputCls} />
          </div>
          <div>
            <label className={emailLabelCls}>From Email</label>
            <input type="email" value={form.fromEmail} onChange={(e) => setForm((f) => ({ ...f, fromEmail: e.target.value }))}
              placeholder="no-reply@yourdomain.com" className={emailInputCls} />
          </div>
          <div>
            <label className={emailLabelCls}>Reply-To Email</label>
            <input type="email" value={form.replyToEmail} onChange={(e) => setForm((f) => ({ ...f, replyToEmail: e.target.value }))} className={emailInputCls} />
          </div>
          <div>
            <label className={emailLabelCls}>Support Email</label>
            <input type="email" value={form.supportEmail} onChange={(e) => setForm((f) => ({ ...f, supportEmail: e.target.value }))} className={emailInputCls} />
          </div>
        </div>

        {err && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{err}</div>}
        {msg && <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">{msg}</div>}

        <button type="submit" disabled={saving}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </form>

      <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Send className="w-4 h-4 text-blue-400" /> Send Test Email</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="email" value={testRecipient} onChange={(e) => setTestRecipient(e.target.value)}
            placeholder="you@example.com" className={`${emailInputCls} sm:flex-1`} />
          <button onClick={sendTest} disabled={testing || !testRecipient}
            className="inline-flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50 shrink-0">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {testing ? "Sending…" : "Send Test"}
          </button>
        </div>
        {testResult && (
          <div className={`p-3 rounded-lg border text-sm ${testResult.ok ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
            {testResult.message}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Email templates ──────────────────────────────────────────────────────────
interface EmailTemplateData {
  id: number | null;
  templateKey: string;
  name: string;
  subject: string;
  preheader: string | null;
  body: string;
  ctaLabel: string | null;
  ctaUrlTemplate: string | null;
  footerNote: string | null;
  enabled: boolean;
}

// ── Send Announcement (template 13 — admin_announcement) ────────────────────
function AnnouncementComposer() {
  const { allUsers } = useAuth();
  const users = allUsers();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [recipient, setRecipient] = useState("all");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ recipientCount: number; sentCount: number } | null>(null);
  const [err, setErr] = useState("");

  const send = async () => {
    if (!title.trim() || !body.trim()) { setErr("Title and message are required"); return; }
    setSending(true); setErr(""); setResult(null);
    const res = await api<{ recipientCount: number; sentCount: number }>("/admin/announcements", {
      method: "POST",
      body: JSON.stringify({ title: title.trim(), body: body.trim(), recipient: recipient === "all" ? "all" : Number(recipient) }),
    });
    setSending(false);
    if (!res.ok) { setErr((res.data as { error: string }).error); return; }
    setResult(res.data as { recipientCount: number; sentCount: number });
    setTitle(""); setBody("");
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-5 space-y-3">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <Send className="w-4 h-4 text-blue-400" /> Send Announcement
      </h3>
      <p className="text-xs text-slate-400">Uses the "13 — Admin / Service Announcement" template. Not automated — you compose and review every send.</p>

      <select value={recipient} onChange={(e) => setRecipient(e.target.value)}
        className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500">
        <option value="all">All active users</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
      </select>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title"
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Message"
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500" />

      {err && <p className="text-xs text-red-400">{err}</p>}
      {result && (
        <p className="text-xs text-emerald-400">Sent to {result.sentCount} of {result.recipientCount} recipient(s).</p>
      )}

      <button onClick={() => void send()} disabled={sending || !title.trim() || !body.trim()}
        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50">
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {sending ? "Sending…" : "Send Announcement"}
      </button>
    </div>
  );
}

function EmailTemplatesView() {
  const [loading, setLoading] = useState(true);
  const [migrated, setMigrated] = useState(true);
  const [templates, setTemplates] = useState<EmailTemplateData[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<EmailTemplateData | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await api<{ migrated: boolean; templates: EmailTemplateData[] }>("/admin/email-templates");
    if (res.ok) {
      const d = res.data as { migrated: boolean; templates: EmailTemplateData[] };
      setMigrated(d.migrated);
      setTemplates(d.templates);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const startEdit = (t: EmailTemplateData) => { setEditingKey(t.templateKey); setDraft({ ...t }); setErr(""); };
  const cancelEdit = () => { setEditingKey(null); setDraft(null); };

  const save = async () => {
    if (!draft) return;
    setSaving(true); setErr("");
    const res = await api<{ template: EmailTemplateData }>(`/admin/email-templates/${draft.templateKey}`, {
      method: "PUT",
      body: JSON.stringify({
        name: draft.name, subject: draft.subject, preheader: draft.preheader, body: draft.body,
        ctaLabel: draft.ctaLabel, ctaUrlTemplate: draft.ctaUrlTemplate, footerNote: draft.footerNote, enabled: draft.enabled,
      }),
    });
    setSaving(false);
    if (!res.ok) { setErr((res.data as { error: string }).error); return; }
    await load();
    setEditingKey(null); setDraft(null);
  };

  const toggleEnabled = async (t: EmailTemplateData) => {
    if (!migrated) return;
    await api(`/admin/email-templates/${t.templateKey}`, { method: "PUT", body: JSON.stringify({ enabled: !t.enabled }) });
    await load();
  };

  if (loading) return <div className="h-64 bg-slate-800/40 animate-pulse rounded-xl" />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Email Templates</h2>
        <p className="text-slate-400 text-sm">Edit subject, body, and call-to-action for every transactional email.</p>
      </div>

      {!migrated && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
          Showing shipped defaults — apply the pending database migration (lib/db/account_upgrade.sql) to edit and persist templates.
        </div>
      )}

      <AnnouncementComposer />

      <div className="space-y-2">
        {templates.map((t) => (
          <div key={t.templateKey} className="bg-slate-800/60 border border-slate-700/40 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">{t.name}</div>
                <div className="text-xs text-slate-400 truncate">{t.subject}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggleEnabled(t)} disabled={!migrated} title={t.enabled ? "Enabled" : "Disabled"}
                  className="text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  {t.enabled ? <ToggleRight className="w-6 h-6 text-emerald-400" /> : <ToggleLeft className="w-6 h-6" />}
                </button>
                <button onClick={() => startEdit(t)} disabled={!migrated}
                  className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {editingKey === t.templateKey && draft && (
              <div className="border-t border-slate-700/40 p-4 space-y-3">
                <div>
                  <label className={emailLabelCls}>Subject</label>
                  <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} className={emailInputCls} />
                </div>
                <div>
                  <label className={emailLabelCls}>Preheader</label>
                  <input value={draft.preheader ?? ""} onChange={(e) => setDraft({ ...draft, preheader: e.target.value })} className={emailInputCls} />
                </div>
                <div>
                  <label className={emailLabelCls}>Body</label>
                  <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={6}
                    className={`${emailInputCls} font-mono text-xs`} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={emailLabelCls}>CTA Label</label>
                    <input value={draft.ctaLabel ?? ""} onChange={(e) => setDraft({ ...draft, ctaLabel: e.target.value })} className={emailInputCls} />
                  </div>
                  <div>
                    <label className={emailLabelCls}>CTA URL (supports {"{{vars}}"})</label>
                    <input value={draft.ctaUrlTemplate ?? ""} onChange={(e) => setDraft({ ...draft, ctaUrlTemplate: e.target.value })} className={emailInputCls} />
                  </div>
                </div>
                <div>
                  <label className={emailLabelCls}>Footer Note</label>
                  <input value={draft.footerNote ?? ""} onChange={(e) => setDraft({ ...draft, footerNote: e.target.value })} className={emailInputCls} />
                </div>
                {err && <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">{err}</div>}
                <div className="flex items-center gap-2">
                  <button onClick={save} disabled={saving}
                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                  </button>
                  <button onClick={cancelEdit} className="inline-flex items-center gap-1.5 border border-slate-700 text-slate-400 hover:text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all">
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Email delivery log ────────────────────────────────────────────────────────
interface EmailLogData {
  id: number;
  userId: number | null;
  templateKey: string;
  recipient: string;
  subject: string;
  triggerSource: string;
  status: "pending" | "sent" | "failed";
  failureReason: string | null;
  createdAt: string;
  sentAt: string | null;
}

function EmailLogsView() {
  const [logs, setLogs] = useState<EmailLogData[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    const res = await api<{ logs: EmailLogData[] }>(`/admin/email-logs?${params.toString()}`);
    if (res.ok) setLogs((res.data as { logs: EmailLogData[] }).logs);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statusColor = (s: EmailLogData["status"]) =>
    s === "sent" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
    s === "failed" ? "bg-red-500/20 text-red-400 border-red-500/30" :
    "bg-slate-600/40 text-slate-400 border-slate-600/30";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Email Logs</h2>
          <p className="text-slate-400 text-sm">{logs.length} recent deliveries</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Search recipient/subject..."
              className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 w-56" />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
            <option value="">All statuses</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
          <button onClick={load} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors">Filter</button>
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-slate-700/50">
              {["Recipient", "Template", "Subject", "Trigger", "Status", "Created"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500 text-sm">Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500 text-sm">No email activity yet.</td></tr>
            ) : logs.map((l) => (
              <tr key={l.id} className="hover:bg-slate-700/20 transition-colors">
                <td className="px-4 py-3 text-xs text-white">{l.recipient}</td>
                <td className="px-4 py-3 text-xs text-slate-400 font-mono">{l.templateKey}</td>
                <td className="px-4 py-3 text-xs text-slate-400 max-w-[220px] truncate">{l.subject}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{l.triggerSource}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(l.status)}`}>{l.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{new Date(l.createdAt).toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

// ── Support Center ────────────────────────────────────────────────────────
interface SupportTicketData {
  id: number;
  ticketNumber: string | null;
  userId: number;
  category: SupportCategory;
  subject: string;
  priority: SupportPriority;
  status: SupportStatus;
  assignedAdminId: number | null;
  createdAt: string;
  updatedAt: string;
}
interface SupportMessageData {
  id: number; authorUserId: number; isAdminReply: boolean; body: string; createdAt: string;
}
interface SupportNoteData {
  id: number; adminUserId: number; body: string; createdAt: string;
}

const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  open: "Open", waiting_admin: "Waiting for Admin", waiting_user: "Waiting for User",
  resolved: "Resolved", closed: "Closed",
};
const SUPPORT_STATUS_BADGE: Record<SupportStatus, string> = {
  open: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  waiting_admin: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  waiting_user: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  resolved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  closed: "bg-slate-600/40 text-slate-400 border-slate-600/30",
};

function SupportCounters() {
  const [counts, setCounts] = useState<{ open: number; waitingAdmin: number; waitingUser: number; resolvedToday: number; total: number } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await api<typeof counts>("/admin/support/counts");
      if (res.ok) setCounts(res.data as NonNullable<typeof counts>);
    })();
  }, []);

  if (!counts) return <div className="h-24 bg-slate-800/40 animate-pulse rounded-xl" />;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <StatCard label="Open" value={String(counts.open)} sub="Awaiting triage" icon={LifeBuoy} color="bg-blue-600" />
      <StatCard label="Waiting for Admin" value={String(counts.waitingAdmin)} sub="Needs a reply" icon={MessageSquare} color="bg-amber-600" />
      <StatCard label="Waiting for User" value={String(counts.waitingUser)} sub="Ball in their court" icon={Clock} color="bg-violet-600" />
      <StatCard label="Resolved Today" value={String(counts.resolvedToday)} sub="Closed the loop" icon={CheckCircle2} color="bg-emerald-600" />
      <StatCard label="Total" value={String(counts.total)} sub="All time" icon={Tag} color="bg-slate-600" />
    </div>
  );
}

function SupportQueue({ onOpen }: { onOpen: (id: number) => void }) {
  const [tickets, setTickets] = useState<SupportTicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    if (priority) params.set("priority", priority);
    if (q) params.set("q", q);
    const res = await api<{ tickets: SupportTicketData[] }>(`/admin/support/tickets?${params.toString()}`);
    if (res.ok) setTickets((res.data as { tickets: SupportTicketData[] }).tickets);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectCls = "px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Support Center</h2>
        <p className="text-slate-400 text-sm">Ticket queue and counters</p>
      </div>

      <SupportCounters />

      <div className="flex flex-wrap gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
          <option value="">All statuses</option>
          {(Object.keys(SUPPORT_STATUS_LABELS) as SupportStatus[]).map((s) => (
            <option key={s} value={s}>{SUPPORT_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
          <option value="">All categories</option>
          {(Object.keys(SUPPORT_CATEGORY_LABELS) as SupportCategory[]).map((c) => (
            <option key={c} value={c}>{SUPPORT_CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className={selectCls}>
          <option value="">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search subject / ticket #"
            className="pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500 w-52" />
        </div>
        <button onClick={load} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-colors">Filter</button>
      </div>

      {loading ? (
        <div className="h-32 bg-slate-800/40 animate-pulse rounded-xl" />
      ) : tickets.length === 0 ? (
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-8 text-center text-slate-400 text-sm">No tickets match these filters.</div>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <button key={t.id} onClick={() => onOpen(t.id)}
              className="w-full text-left bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 hover:border-blue-500/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-mono text-slate-400">{t.ticketNumber ?? `#${t.id}`}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${SUPPORT_STATUS_BADGE[t.status]}`}>
                      {SUPPORT_STATUS_LABELS[t.status]}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white truncate">{t.subject}</p>
                  <p className="text-xs text-slate-400 mt-1">{SUPPORT_CATEGORY_LABELS[t.category]} · Updated {new Date(t.updatedAt).toLocaleString("en-IN")}</p>
                </div>
                <span className="text-xs font-bold uppercase text-slate-400 shrink-0">{t.priority}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SupportTicketDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const { allUsers } = useAuth();
  const admins = allUsers().filter((u) => u.role === "admin");
  const [ticket, setTicket] = useState<SupportTicketData | null>(null);
  const [messages, setMessages] = useState<SupportMessageData[]>([]);
  const [notes, setNotes] = useState<SupportNoteData[]>([]);
  const [requester, setRequester] = useState<{ id: number; name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const load = async () => {
    const res = await api<{
      ticket: SupportTicketData; messages: SupportMessageData[];
      internalNotes: SupportNoteData[]; requester: { id: number; name: string; email: string } | null;
    }>(`/admin/support/tickets/${id}`);
    if (res.ok) {
      const d = res.data as {
        ticket: SupportTicketData; messages: SupportMessageData[];
        internalNotes: SupportNoteData[]; requester: { id: number; name: string; email: string } | null;
      };
      setTicket(d.ticket); setMessages(d.messages); setNotes(d.internalNotes); setRequester(d.requester);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    await api(`/admin/support/tickets/${id}/messages`, { method: "POST", body: JSON.stringify({ body: reply.trim() }) });
    setSending(false); setReply("");
    await load();
  };
  const changeStatus = async (status: string) => {
    await api(`/admin/support/tickets/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    await load();
  };
  const changePriority = async (priority: string) => {
    await api(`/admin/support/tickets/${id}/priority`, { method: "PATCH", body: JSON.stringify({ priority }) });
    await load();
  };
  const assign = async (adminId: string) => {
    await api(`/admin/support/tickets/${id}/assign`, { method: "POST", body: JSON.stringify({ adminId: adminId ? Number(adminId) : null }) });
    await load();
  };
  const addNote = async () => {
    if (!note.trim()) return;
    setSavingNote(true);
    await api(`/admin/support/tickets/${id}/notes`, { method: "POST", body: JSON.stringify({ body: note.trim() }) });
    setSavingNote(false); setNote("");
    await load();
  };

  if (loading) return <div className="h-64 bg-slate-800/40 animate-pulse rounded-xl" />;
  if (!ticket) return <p className="text-slate-400 text-sm">Ticket not found.</p>;

  const selectCls = "w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500";

  return (
    <div className="max-w-3xl space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to queue
      </button>

      <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-slate-400">{ticket.ticketNumber ?? `#${ticket.id}`}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${SUPPORT_STATUS_BADGE[ticket.status]}`}>
            {SUPPORT_STATUS_LABELS[ticket.status]}
          </span>
        </div>
        <h2 className="text-lg font-bold text-white">{ticket.subject}</h2>
        <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
          {requester && <span>{requester.name} ({requester.email})</span>}
          <span>{SUPPORT_CATEGORY_LABELS[ticket.category]}</span>
          <span>Created {new Date(ticket.createdAt).toLocaleString("en-IN")}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div>
            <label className="text-xs text-slate-400 flex items-center gap-1 mb-1"><CheckCircle2 className="w-3 h-3" /> Status</label>
            <select value={ticket.status} onChange={(e) => void changeStatus(e.target.value)} className={selectCls}>
              {(Object.keys(SUPPORT_STATUS_LABELS) as SupportStatus[]).map((s) => (
                <option key={s} value={s}>{SUPPORT_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 flex items-center gap-1 mb-1"><Zap className="w-3 h-3" /> Priority</label>
            <select value={ticket.priority} onChange={(e) => void changePriority(e.target.value)} className={selectCls}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 flex items-center gap-1 mb-1"><UserPlus className="w-3 h-3" /> Assigned Admin</label>
            <select value={ticket.assignedAdminId ?? ""} onChange={(e) => void assign(e.target.value)} className={selectCls}>
              <option value="">Unassigned</option>
              {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.isAdminReply ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-2.5 border ${m.isAdminReply ? "bg-blue-500/10 border-blue-500/20" : "bg-slate-800/60 border-slate-700/40"}`}>
              <p className="text-xs font-semibold mb-1 text-slate-400">{m.isAdminReply ? "You (Support Team)" : requester?.name ?? "User"}</p>
              <p className="text-sm text-white whitespace-pre-wrap">{m.body}</p>
              <p className="text-[10px] text-slate-500 mt-1.5">{new Date(m.createdAt).toLocaleString("en-IN")}</p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void sendReply(); }} className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 space-y-2">
        <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Reply to the user…"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500" />
        <button type="submit" disabled={sending || !reply.trim()}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-50">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Reply
        </button>
      </form>

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
          <StickyNote className="w-4 h-4" /> Internal Notes — never visible to the user
        </h3>
        {notes.map((n) => (
          <div key={n.id} className="text-xs text-slate-300 bg-slate-800/50 rounded-lg p-2.5">
            {n.body}
            <div className="text-[10px] text-slate-500 mt-1">{new Date(n.createdAt).toLocaleString("en-IN")}</div>
          </div>
        ))}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add an internal note…"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500" />
        <button onClick={() => void addNote()} disabled={savingNote || !note.trim()}
          className="inline-flex items-center gap-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30 text-xs font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50">
          {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <StickyNote className="w-3.5 h-3.5" />} Add Note
        </button>
      </div>
    </div>
  );
}

function SupportCenterView() {
  const [view, setView] = useState<{ name: "queue" } | { name: "ticket"; id: number }>({ name: "queue" });
  if (view.name === "ticket") {
    return <SupportTicketDetail id={view.id} onBack={() => setView({ name: "queue" })} />;
  }
  return <SupportQueue onOpen={(id) => setView({ name: "ticket", id })} />;
}

// ── Payment settings (Razorpay / Stripe credentials) ─────────────────────────
interface PaymentSettingsData {
  razorpayKeyId: string; hasRazorpaySecret: boolean; hasRazorpayWebhookSecret: boolean;
  stripePublishableKey: string; hasStripeSecret: boolean; hasStripeWebhookSecret: boolean;
  updatedAt: string | null;
}

function PaymentSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState({ hasRazorpaySecret: false, hasRazorpayWebhookSecret: false, hasStripeSecret: false, hasStripeWebhookSecret: false });
  const [form, setForm] = useState({
    razorpayKeyId: "", razorpayKeySecret: "", razorpayWebhookSecret: "",
    stripePublishableKey: "", stripeSecretKey: "", stripeWebhookSecret: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const res = await api<PaymentSettingsData>("/admin/payment-settings");
      if (res.ok) {
        const d = res.data as PaymentSettingsData;
        setForm((f) => ({ ...f, razorpayKeyId: d.razorpayKeyId, stripePublishableKey: d.stripePublishableKey }));
        setFlags({ hasRazorpaySecret: d.hasRazorpaySecret, hasRazorpayWebhookSecret: d.hasRazorpayWebhookSecret, hasStripeSecret: d.hasStripeSecret, hasStripeWebhookSecret: d.hasStripeWebhookSecret });
      }
      setLoading(false);
    })();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg(""); setErr("");
    const res = await api<PaymentSettingsData>("/admin/payment-settings", { method: "PUT", body: JSON.stringify(form) });
    setSaving(false);
    if (!res.ok) { setErr((res.data as { error: string }).error); return; }
    const d = res.data as PaymentSettingsData;
    setFlags({ hasRazorpaySecret: d.hasRazorpaySecret, hasRazorpayWebhookSecret: d.hasRazorpayWebhookSecret, hasStripeSecret: d.hasStripeSecret, hasStripeWebhookSecret: d.hasStripeWebhookSecret });
    setForm((f) => ({ ...f, razorpayKeySecret: "", razorpayWebhookSecret: "", stripeSecretKey: "", stripeWebhookSecret: "" }));
    setMsg("Payment settings saved.");
  };

  if (loading) return <div className="h-64 bg-slate-800/40 animate-pulse rounded-xl" />;

  return (
    <form onSubmit={save} className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-5 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-white mb-1">Razorpay (INR)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={emailLabelCls}>Key ID</label>
            <input value={form.razorpayKeyId} onChange={(e) => setForm((f) => ({ ...f, razorpayKeyId: e.target.value }))} className={emailInputCls} placeholder="rzp_live_..." />
          </div>
          <div>
            <label className={emailLabelCls}>Key Secret {flags.hasRazorpaySecret && <span className="text-emerald-400 font-normal">(set — leave blank to keep it)</span>}</label>
            <input type="password" value={form.razorpayKeySecret} onChange={(e) => setForm((f) => ({ ...f, razorpayKeySecret: e.target.value }))} className={emailInputCls} placeholder={flags.hasRazorpaySecret ? "••••••••" : "Enter key secret"} />
          </div>
          <div className="sm:col-span-2">
            <label className={emailLabelCls}>Webhook Secret {flags.hasRazorpayWebhookSecret && <span className="text-emerald-400 font-normal">(set — leave blank to keep it)</span>}</label>
            <input type="password" value={form.razorpayWebhookSecret} onChange={(e) => setForm((f) => ({ ...f, razorpayWebhookSecret: e.target.value }))} className={emailInputCls} placeholder={flags.hasRazorpayWebhookSecret ? "••••••••" : "Enter webhook secret"} />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-1">Stripe (USD)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={emailLabelCls}>Publishable Key</label>
            <input value={form.stripePublishableKey} onChange={(e) => setForm((f) => ({ ...f, stripePublishableKey: e.target.value }))} className={emailInputCls} placeholder="pk_live_..." />
          </div>
          <div>
            <label className={emailLabelCls}>Secret Key {flags.hasStripeSecret && <span className="text-emerald-400 font-normal">(set — leave blank to keep it)</span>}</label>
            <input type="password" value={form.stripeSecretKey} onChange={(e) => setForm((f) => ({ ...f, stripeSecretKey: e.target.value }))} className={emailInputCls} placeholder={flags.hasStripeSecret ? "••••••••" : "Enter secret key"} />
          </div>
          <div className="sm:col-span-2">
            <label className={emailLabelCls}>Webhook Secret {flags.hasStripeWebhookSecret && <span className="text-emerald-400 font-normal">(set — leave blank to keep it)</span>}</label>
            <input type="password" value={form.stripeWebhookSecret} onChange={(e) => setForm((f) => ({ ...f, stripeWebhookSecret: e.target.value }))} className={emailInputCls} placeholder={flags.hasStripeWebhookSecret ? "••••••••" : "Enter webhook secret"} />
          </div>
        </div>
      </div>

      {err && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{err}</div>}
      {msg && <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">{msg}</div>}

      <button type="submit" disabled={saving}
        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? "Saving…" : "Save Credentials"}
      </button>
    </form>
  );
}

// ── Subscription plan pricing ─────────────────────────────────────────────────
interface SubscriptionPlanData {
  planId: "pro" | "premium"; billingCycle: "monthly" | "annual";
  amountInrPaise: number; amountUsdCents: number;
  razorpayPlanId: string | null; stripePriceId: string | null; active: boolean;
}

function SubscriptionPlansCard() {
  const [plans, setPlans] = useState<SubscriptionPlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");

  const load = async () => {
    const res = await api<{ plans: SubscriptionPlanData[] }>("/admin/subscription-plans");
    if (res.ok) setPlans((res.data as { plans: SubscriptionPlanData[] }).plans);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const savePlan = async (p: SubscriptionPlanData, patch: Partial<SubscriptionPlanData>) => {
    const key = `${p.planId}:${p.billingCycle}`;
    setSavingKey(key);
    await api(`/admin/subscription-plans/${p.planId}/${p.billingCycle}`, { method: "PUT", body: JSON.stringify(patch) });
    await load();
    setSavingKey("");
  };

  if (loading) return <div className="h-64 bg-slate-800/40 animate-pulse rounded-xl" />;

  return (
    <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-5 overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-slate-700/50 text-left text-xs text-slate-400">
            <th className="py-2 pr-3">Plan</th>
            <th className="py-2 pr-3">Cycle</th>
            <th className="py-2 pr-3">₹ (INR)</th>
            <th className="py-2 pr-3">$ (USD)</th>
            <th className="py-2 pr-3">Razorpay Plan ID</th>
            <th className="py-2 pr-3">Stripe Price ID</th>
            <th className="py-2 pr-3">Active</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => {
            const key = `${p.planId}:${p.billingCycle}`;
            return (
              <tr key={key} className="border-b border-slate-700/30 last:border-0">
                <td className="py-2 pr-3 capitalize font-semibold text-white">{p.planId}</td>
                <td className="py-2 pr-3 capitalize text-slate-300">{p.billingCycle}</td>
                <td className="py-2 pr-3">
                  <input type="number" step="0.01" defaultValue={(p.amountInrPaise / 100).toFixed(2)}
                    onBlur={(e) => void savePlan(p, { amountInrPaise: Math.round(Number(e.target.value) * 100) })}
                    className="w-24 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-xs" />
                </td>
                <td className="py-2 pr-3">
                  <input type="number" step="0.01" defaultValue={(p.amountUsdCents / 100).toFixed(2)}
                    onBlur={(e) => void savePlan(p, { amountUsdCents: Math.round(Number(e.target.value) * 100) })}
                    className="w-24 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-xs" />
                </td>
                <td className="py-2 pr-3">
                  <input defaultValue={p.razorpayPlanId ?? ""} placeholder="plan_..."
                    onBlur={(e) => void savePlan(p, { razorpayPlanId: e.target.value.trim() || null })}
                    className="w-36 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-xs" />
                </td>
                <td className="py-2 pr-3">
                  <input defaultValue={p.stripePriceId ?? ""} placeholder="price_..."
                    onBlur={(e) => void savePlan(p, { stripePriceId: e.target.value.trim() || null })}
                    className="w-36 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-xs" />
                </td>
                <td className="py-2 pr-3">
                  <button onClick={() => void savePlan(p, { active: !p.active })} disabled={savingKey === key}>
                    {p.active ? <ToggleRight className="w-6 h-6 text-emerald-400" /> : <ToggleLeft className="w-6 h-6 text-slate-500" />}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-slate-500 mt-3">
        A plan only becomes purchasable once its price is above zero, its provider plan/price id is set, and it's marked active.
      </p>
    </div>
  );
}

// ── Subscriptions / invoices (read-only) ──────────────────────────────────────
interface AdminSubscriptionData {
  id: number; userId: number; planId: string; billingCycle: string; provider: string;
  status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; createdAt: string;
}
interface AdminInvoiceData {
  id: number; userId: number; provider: string; amount: number; currency: "INR" | "USD";
  status: string; invoiceNumber: string | null; createdAt: string;
}

function SubscriptionsInvoicesCard() {
  const [tab, setTab] = useState<"subscriptions" | "invoices">("subscriptions");
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionData[]>([]);
  const [invoices, setInvoices] = useState<AdminInvoiceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [subRes, invRes] = await Promise.all([
        api<{ subscriptions: AdminSubscriptionData[] }>("/admin/subscriptions"),
        api<{ invoices: AdminInvoiceData[] }>("/admin/invoices"),
      ]);
      if (subRes.ok) setSubscriptions((subRes.data as { subscriptions: AdminSubscriptionData[] }).subscriptions);
      if (invRes.ok) setInvoices((invRes.data as { invoices: AdminInvoiceData[] }).invoices);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="h-64 bg-slate-800/40 animate-pulse rounded-xl" />;

  return (
    <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-5">
      <div className="flex gap-2 mb-4">
        {(["subscriptions", "invoices"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${tab === t ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        {tab === "subscriptions" ? (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 text-left text-xs text-slate-400">
                <th className="py-2 pr-3">User ID</th><th className="py-2 pr-3">Plan</th><th className="py-2 pr-3">Cycle</th>
                <th className="py-2 pr-3">Provider</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Period End</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.length === 0 ? (
                <tr><td colSpan={6} className="py-4 text-center text-slate-500 text-xs">No subscriptions yet.</td></tr>
              ) : subscriptions.map((s) => (
                <tr key={s.id} className="border-b border-slate-700/30 last:border-0 text-slate-300">
                  <td className="py-2 pr-3">{s.userId}</td>
                  <td className="py-2 pr-3 capitalize">{s.planId}</td>
                  <td className="py-2 pr-3 capitalize">{s.billingCycle}</td>
                  <td className="py-2 pr-3 capitalize">{s.provider}</td>
                  <td className="py-2 pr-3 capitalize">{s.status}{s.cancelAtPeriodEnd ? " (cancelling)" : ""}</td>
                  <td className="py-2 pr-3">{s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString("en-IN") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 text-left text-xs text-slate-400">
                <th className="py-2 pr-3">Invoice #</th><th className="py-2 pr-3">User ID</th>
                <th className="py-2 pr-3">Amount</th><th className="py-2 pr-3">Provider</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan={6} className="py-4 text-center text-slate-500 text-xs">No invoices yet.</td></tr>
              ) : invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-700/30 last:border-0 text-slate-300">
                  <td className="py-2 pr-3">{inv.invoiceNumber ?? "—"}</td>
                  <td className="py-2 pr-3">{inv.userId}</td>
                  <td className="py-2 pr-3">{inv.currency === "INR" ? "₹" : "$"}{(inv.amount / 100).toFixed(2)}</td>
                  <td className="py-2 pr-3 capitalize">{inv.provider}</td>
                  <td className="py-2 pr-3 capitalize">{inv.status}</td>
                  <td className="py-2 pr-3">{new Date(inv.createdAt).toLocaleDateString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function PaymentsView() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Subscription Plans & Payments</h2>
        <p className="text-slate-400 text-sm">Configure Razorpay/Stripe credentials, plan pricing, and review subscriptions and invoices.</p>
      </div>
      <PaymentSettingsCard />
      <SubscriptionPlansCard />
      <SubscriptionsInvoicesCard />
    </div>
  );
}

// ── Main Admin Panel ──────────────────────────────────────────────────────
export function AdminPanel() {
  const { user, logout, allUsers, deleteUser, updateUserPlan } = useAuth();
  const [view, setView] = useState<AdminView>("dashboard");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const users = allUsers();

  const activeSection = SECTIONS.find(s => s.id === view);

  return (
    <div className="min-h-screen bg-[#080d1a] flex text-white">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-48 sm:w-60" : "w-16"} shrink-0 bg-slate-900/80 border-r border-slate-800 flex flex-col transition-all duration-200`}>
        {/* Brand */}
        <div className="h-14 flex items-center gap-3 px-4 border-b border-slate-800">
          <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-lg flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          {sidebarOpen && (
            <div>
              <div className="text-sm font-bold text-white leading-none">Market Pulse</div>
              <div className="text-xs text-slate-400">Admin Panel</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setView(id as AdminView)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                view === id
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}>
              <Icon className="w-4 h-4 shrink-0" />
              {sidebarOpen && <span className="text-xs font-medium">{label}</span>}
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-slate-800">
          <div className={`flex items-center gap-2.5 ${sidebarOpen ? "px-2" : "justify-center"}`}>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-xs font-bold shrink-0">
              {user?.name.charAt(0)}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white truncate">{user?.name}</div>
                <div className="text-xs text-slate-500 truncate">{user?.email}</div>
              </div>
            )}
          </div>
          <button onClick={logout}
            className={`mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors ${sidebarOpen ? "" : "justify-center"}`}>
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {sidebarOpen && "Logout"}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-3 sm:px-4 md:px-6 shrink-0 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(v => !v)}
              className="text-slate-400 hover:text-white transition-colors p-1 shrink-0">
              <LayoutDashboard className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 text-sm text-slate-400 min-w-0">
              <span className="hidden sm:inline">Admin</span>
              <ChevronRight className="w-3 h-3 hidden sm:block shrink-0" />
              <span className="text-white font-medium truncate">{activeSection?.label}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
              className="p-1.5 text-slate-400 hover:text-white transition-colors">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-xs font-medium text-emerald-400 hidden sm:inline">System Online</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto">
          {view === "dashboard" && <DashboardView users={users} />}
          {view === "users" && (
            <UsersSection users={users} onDelete={deleteUser}
              onPlanChange={(id, plan) => { updateUserPlan(id, plan); }} />
          )}
          {view === "system" && <SystemView />}
          {view === "support" && <SupportCenterView />}
          {view === "email" && <EmailSettingsView />}
          {view === "templates" && <EmailTemplatesView />}
          {view === "emaillogs" && <EmailLogsView />}
          {view === "ai" && <PlaceholderView title="AI Model Settings" desc="Configure AI analysis models, prompt templates, and inference parameters." icon={Brain} />}
          {view === "news" && <PlaceholderView title="News Sources" desc="Manage news APIs, RSS feeds, and sentiment analysis sources." icon={Newspaper} />}
          {view === "apis" && <PlaceholderView title="Market APIs" desc="Configure NSE, BSE, Upstox, and Yahoo Finance API credentials." icon={Server} />}
          {view === "plans" && <PaymentsView />}
          {view === "feedback" && <PlaceholderView title="User Feedback" desc="View and respond to user feedback, bug reports, and feature requests." icon={MessageSquare} />}
          {view === "reports" && <PlaceholderView title="Reports" desc="Download platform analytics, revenue reports, and user activity exports." icon={FileText} />}
          {view === "audit" && <PlaceholderView title="Audit Logs" desc="Complete activity trail of all admin actions and system events." icon={Shield} />}
        </main>
      </div>
    </div>
  );
}
