import { useState } from "react";
import {
  LayoutDashboard, Users, Brain, Newspaper, Server, CreditCard,
  MessageSquare, FileText, Shield, Activity, LogOut, TrendingUp,
  ChevronRight, Trash2, Edit3, Search, BadgeCheck, Crown, Zap,
  CheckCircle2, XCircle, Clock, Globe, Database, Cpu, AlertCircle,
  BarChart2, ArrowUp, ArrowDown, Sun, Moon
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type AdminView = "dashboard" | "users" | "ai" | "news" | "apis" | "plans" | "feedback" | "reports" | "audit" | "system";

const SECTIONS = [
  { id: "dashboard", label: "Dashboard",       icon: LayoutDashboard },
  { id: "users",     label: "User Management", icon: Users },
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
    <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-400 text-xs font-medium">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
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
function UsersView({ users, onDelete, onPlanChange }: {
  users: ReturnType<ReturnType<typeof useAuth>["allUsers"]>;
  onDelete: (id: number) => void;
  onPlanChange: (id: number, plan: "free" | "pro" | "premium") => void;
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">User Management</h2>
          <p className="text-slate-400 text-sm">{users.length} total accounts</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search users..."
            className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 w-56" />
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl overflow-hidden">
        <table className="w-full">
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
                  {u.role !== "admin" && (
                    <button onClick={() => { if (confirm(`Delete ${u.name}?`)) onDelete(u.id); }}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
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
          <div key={m.label} className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs">{m.label}</span>
              <m.icon className={`w-4 h-4 ${m.color}`} />
            </div>
            <div className={`text-2xl font-bold font-mono ${m.color}`}>
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
      <aside className={`${sidebarOpen ? "w-60" : "w-16"} shrink-0 bg-slate-900/80 border-r border-slate-800 flex flex-col transition-all duration-200`}>
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
        <header className="h-14 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(v => !v)}
              className="text-slate-400 hover:text-white transition-colors p-1">
              <LayoutDashboard className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 text-sm text-slate-400">
              <span>Admin</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-white font-medium">{activeSection?.label}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
              className="p-1.5 text-slate-400 hover:text-white transition-colors">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">System Online</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
          {view === "dashboard" && <DashboardView users={users} />}
          {view === "users" && (
            <UsersView users={users} onDelete={deleteUser}
              onPlanChange={(id, plan) => { updateUserPlan(id, plan); }} />
          )}
          {view === "system" && <SystemView />}
          {view === "ai" && <PlaceholderView title="AI Model Settings" desc="Configure AI analysis models, prompt templates, and inference parameters." icon={Brain} />}
          {view === "news" && <PlaceholderView title="News Sources" desc="Manage news APIs, RSS feeds, and sentiment analysis sources." icon={Newspaper} />}
          {view === "apis" && <PlaceholderView title="Market APIs" desc="Configure NSE, BSE, Upstox, and Yahoo Finance API credentials." icon={Server} />}
          {view === "plans" && <PlaceholderView title="Subscription Plans" desc="Create and manage Free, Pro, and Premium plan features and pricing." icon={CreditCard} />}
          {view === "feedback" && <PlaceholderView title="User Feedback" desc="View and respond to user feedback, bug reports, and feature requests." icon={MessageSquare} />}
          {view === "reports" && <PlaceholderView title="Reports" desc="Download platform analytics, revenue reports, and user activity exports." icon={FileText} />}
          {view === "audit" && <PlaceholderView title="Audit Logs" desc="Complete activity trail of all admin actions and system events." icon={Shield} />}
        </main>
      </div>
    </div>
  );
}
