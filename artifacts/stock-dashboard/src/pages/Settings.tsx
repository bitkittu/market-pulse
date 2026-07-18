import { useState } from "react";
import {
  useGetUpstoxSettings,
  useSaveUpstoxSettings,
  useDisconnectUpstox,
  useTestUpstoxConnection,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Settings2, Link2, Unlink, CheckCircle2, AlertCircle, ExternalLink,
  Eye, EyeOff, Zap, Clock, Wifi, WifiOff, RefreshCw, TriangleAlert,
  User, Crown, Check, Lock, Sparkles, Mail, CalendarDays,
  Save, KeyRound, Pencil, X, Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { UpgradeGate } from "@/components/UpgradeGate";
import {
  PLANS, PLAN_ORDER, FEATURE_ROWS, hasAccess,
  type PlanId,
} from "@/lib/plan";

function cn(...c: (string | false | undefined | null)[]) {
  return c.filter(Boolean).join(" ");
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

type TestResult = { ok: boolean; source: string; message: string; samplePrice?: number; sampleSymbol?: string } | null;

function ConnectedPanel({
  data,
  onDisconnect,
}: {
  data: {
    connected: boolean;
    apiKeyMasked?: string;
    clientId?: string;
    connectedAt?: string;
    liveDataEnabled: boolean;
    hasAccessToken?: boolean;
  };
  onDisconnect: () => void;
}) {
  const [testResult, setTestResult] = useState<TestResult>(null);
  const testMut = useTestUpstoxConnection({
    mutation: { onSuccess: (d) => setTestResult(d), onError: () => setTestResult({ ok: false, source: "none", message: "Test request failed." }) },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
        <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
        <div>
          <p className="text-sm font-bold text-emerald-400">Upstox API Connected</p>
          <p className="text-xs text-muted-foreground">
            {data.hasAccessToken
              ? "Access token present — live NSE data will use Upstox"
              : "No access token — data falls back to Yahoo Finance"}
          </p>
        </div>
      </div>

      {/* Token missing warning */}
      {!data.hasAccessToken && (
        <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-xs text-muted-foreground">
          <TriangleAlert className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-yellow-400">Access Token Missing:</span> Your API Key is saved but no Access Token was provided. Without it, prices continue to use Yahoo Finance.
            <br />To get a token: go to{" "}
            <a href="https://developer.upstox.com" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
              developer.upstox.com <ExternalLink className="w-3 h-3" />
            </a>{" "}
            → your App → Login URL → complete OAuth → copy the Access Token and reconnect below.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: "API Key", value: data.apiKeyMasked ?? "—" },
          { label: "Client ID", value: data.clientId ?? "—" },
          { label: "Connected At", value: data.connectedAt ? new Date(data.connectedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—" },
          { label: "Access Token", value: data.hasAccessToken ? "✓ Configured" : "✗ Not set" },
        ].map((row) => (
          <div key={row.label} className="bg-background/50 border border-border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">{row.label}</p>
            <p className={cn("text-sm font-mono font-semibold", row.label === "Access Token" && (data.hasAccessToken ? "text-emerald-400" : "text-yellow-400"))}>
              {row.value}
            </p>
          </div>
        ))}
      </div>

      {/* Test connection */}
      {data.hasAccessToken && (
        <div className="space-y-2">
          <button
            onClick={() => { setTestResult(null); testMut.mutate({}); }}
            disabled={testMut.isPending}
            className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-semibold px-4 py-2.5 rounded-lg text-sm transition-all disabled:opacity-50"
          >
            {testMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
            {testMut.isPending ? "Testing…" : "Test Live Connection"}
          </button>

          {testResult && (
            <div className={cn(
              "flex items-start gap-3 p-4 rounded-xl border text-xs",
              testResult.ok
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                : "bg-red-500/10 border-red-500/20 text-red-300"
            )}>
              {testResult.ok
                ? <Wifi className="w-4 h-4 shrink-0 mt-0.5" />
                : <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />}
              <div>
                <span className="font-bold">
                  {testResult.ok ? "Upstox Live Data Active" : "Connection Failed"}
                </span>
                {" — "}
                {testResult.message}
                {testResult.ok && testResult.samplePrice && (
                  <span className="ml-1 text-muted-foreground">
                    ({testResult.sampleSymbol} live price: ₹{testResult.samplePrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </span>
                )}
                {!testResult.ok && (
                  <p className="mt-1 text-muted-foreground">
                    Upstox access tokens expire daily. Generate a new one from{" "}
                    <a href="https://developer.upstox.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      developer.upstox.com
                    </a>{" "}
                    and reconnect.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
        <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-primary">Data Priority:</span> When Upstox is active, all NSE prices (movers, sectors, Gift Nifty, intraday picks, options) are sourced directly from your Upstox account. Yahoo Finance is used as fallback.
        </div>
      </div>

      <button
        onClick={onDisconnect}
        className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-semibold px-4 py-2.5 rounded-lg text-sm transition-all"
      >
        <Unlink className="w-4 h-4" />
        Disconnect Upstox
      </button>
    </div>
  );
}

function ConnectForm({ onSuccess }: { onSuccess: () => void }) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [clientId, setClientId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState("");
  const qc = useQueryClient();

  const saveMut = useSaveUpstoxSettings({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/settings/upstox"] });
        onSuccess();
      },
      onError: () => setError("Failed to save credentials. Please check your API key."),
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) { setError("API Key is required"); return; }
    setError("");
    saveMut.mutate({
      data: {
        apiKey: apiKey.trim(),
        apiSecret: apiSecret || undefined,
        clientId: clientId || undefined,
        accessToken: accessToken || undefined,
      },
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Instructions */}
      <div className="bg-background/50 border border-border rounded-xl p-4 space-y-2">
        <p className="text-xs font-bold text-foreground">How to get your Upstox credentials:</p>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>
            Go to{" "}
            <a href="https://developer.upstox.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
              developer.upstox.com <ExternalLink className="w-3 h-3" />
            </a>{" "}
            and log in with your Upstox trading account
          </li>
          <li>Create a new App — set the redirect URL to any URL you control</li>
          <li>Copy the <span className="text-foreground font-semibold">API Key</span> and <span className="text-foreground font-semibold">API Secret</span></li>
          <li>Open your App's Login URL in a browser to complete the OAuth flow</li>
          <li>After redirect, copy the <span className="text-foreground font-semibold">Access Token</span> from the URL / response (it expires daily)</li>
        </ol>

        <div className="flex items-start gap-2 p-2.5 bg-yellow-500/10 rounded-lg border border-yellow-500/20 mt-2">
          <Clock className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-300">
            Access tokens expire every 24 hours. Paste a fresh token here each trading day for live Upstox data.
          </p>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">API Key *</label>
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Your Upstox API Key"
          className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">API Secret</label>
        <div className="relative">
          <input
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            type={showSecret ? "text" : "password"}
            placeholder="Your Upstox API Secret"
            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 pr-10 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button type="button" onClick={() => setShowSecret(!showSecret)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Client ID</label>
        <input
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="Your Upstox Client ID"
          className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">
          Access Token{" "}
          <span className="text-primary font-semibold">(required for Upstox live data)</span>
        </label>
        <div className="relative">
          <input
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            type={showToken ? "text" : "password"}
            placeholder="Paste your OAuth Access Token here"
            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 pr-10 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button type="button" onClick={() => setShowToken(!showToken)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Without an access token, prices will still be fetched via Yahoo Finance.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={saveMut.isPending}
        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-2.5 rounded-lg transition-all disabled:opacity-50 text-sm"
      >
        <Link2 className="w-4 h-4" />
        {saveMut.isPending ? "Connecting…" : "Connect Upstox API"}
      </button>
    </form>
  );
}

// ── Profile card (editable name) ────────────────────────────────────────────
function ProfileCard() {
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  if (!user) return null;
  const plan = PLANS[user.plan];

  const save = async () => {
    if (name.trim().length < 2) { setError("Name must be at least 2 characters"); return; }
    setSaving(true); setError("");
    const res = await updateProfile(name.trim());
    setSaving(false);
    if (!res.success) { setError(res.error ?? "Failed to update profile"); return; }
    setEditing(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const cancel = () => { setName(user.name); setEditing(false); setError(""); };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <User className="w-4 h-4 text-primary" /> Profile
        </h2>
        {!editing && (
          <button onClick={() => { setName(user.name); setEditing(true); }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 border border-primary/30 rounded-lg px-2.5 py-1 transition-colors">
            <Pencil className="w-3 h-3" /> Edit
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 mb-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white text-2xl font-black shrink-0">
          {(editing ? name : user.name).charAt(0).toUpperCase() || "?"}
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                placeholder="Your name"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <div className="flex items-center gap-2">
                <button onClick={save} disabled={saving}
                  className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                </button>
                <button onClick={cancel} disabled={saving}
                  className="inline-flex items-center gap-1.5 border border-border text-muted-foreground hover:text-foreground text-xs font-bold px-3 py-1.5 rounded-lg transition-all">
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold text-foreground truncate">{user.name}</span>
                <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-bold capitalize", plan.badge)}>
                  <Crown className="w-3 h-3" /> {plan.name}
                </span>
                {saved && <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><Check className="w-3 h-3" /> Saved</span>}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <Mail className="w-3 h-3" /> {user.email}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-background/50 border border-border rounded-lg px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><CalendarDays className="w-3 h-3" /> Member since</p>
          <p className="text-sm font-semibold text-foreground">{fmtDate(user.joinedAt)}</p>
        </div>
        <div className="bg-background/50 border border-border rounded-lg px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Last login</p>
          <p className="text-sm font-semibold text-foreground">{fmtDate(user.lastLogin)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Change password ─────────────────────────────────────────────────────────
function ChangePassword() {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setMsg("");
    if (!current) { setError("Enter your current password"); return; }
    if (next.length < 8) { setError("New password must be at least 8 characters"); return; }
    if (next !== confirm) { setError("New passwords do not match"); return; }
    setSaving(true);
    const res = await changePassword(current, next);
    setSaving(false);
    if (!res.success) { setError(res.error ?? "Failed to change password"); return; }
    setMsg(res.message ?? "Your password has been changed.");
    setCurrent(""); setNext(""); setConfirm("");
  };

  const inputCls = "w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-base font-bold text-foreground flex items-center gap-2 mb-4">
        <KeyRound className="w-4 h-4 text-primary" /> Password
      </h2>
      <form onSubmit={submit} className="space-y-3 max-w-md">
        <div>
          <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Current password</label>
          <input type={show ? "text" : "password"} value={current} onChange={(e) => setCurrent(e.target.value)}
            placeholder="••••••••" className={inputCls} autoComplete="current-password" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">New password</label>
          <div className="relative">
            <input type={show ? "text" : "password"} value={next} onChange={(e) => setNext(e.target.value)}
              placeholder="At least 8 characters" className={cn(inputCls, "pr-10")} autoComplete="new-password" />
            <button type="button" onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Confirm new password</label>
          <input type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter new password" className={inputCls} autoComplete="new-password" />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        {msg && (
          <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {msg}
          </div>
        )}

        <button type="submit" disabled={saving}
          className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-2.5 px-5 rounded-lg transition-all disabled:opacity-50 text-sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          {saving ? "Updating…" : "Update Password"}
        </button>
      </form>
    </div>
  );
}

// ── Upgrade / plan cards ────────────────────────────────────────────────────
function PlanSection({ currentPlan }: { currentPlan: PlanId }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-base font-bold text-foreground flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-primary" /> Your Plan
      </h2>
      <p className="text-xs text-muted-foreground mb-5">
        You're on the <span className="font-semibold capitalize text-foreground">{PLANS[currentPlan].name}</span> plan. Upgrade to unlock predictions, live levels and broker integration.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLAN_ORDER.map((pid) => {
          const p = PLANS[pid];
          const isCurrent = pid === currentPlan;
          const included = FEATURE_ROWS.filter((f) => hasAccess(pid, f.feature));
          return (
            <div key={pid} className={cn("relative rounded-xl border bg-background/40 p-4 flex flex-col", isCurrent ? "border-primary/50 ring-1 ring-primary/30" : p.card)}>
              {isCurrent && (
                <span className="absolute -top-2.5 left-4 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary text-white">
                  Current
                </span>
              )}
              <div className="flex items-baseline justify-between mb-1">
                <span className={cn("text-base font-black", p.accent)}>{p.name}</span>
                <div className="text-right">
                  <span className="text-sm font-bold text-foreground">{p.price}</span>
                  {p.priceNote && <span className="text-[10px] text-muted-foreground ml-1">{p.priceNote}</span>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{p.tagline}</p>

              <ul className="space-y-1.5 mb-4 flex-1">
                {included.map((f) => (
                  <li key={f.feature} className="flex items-start gap-1.5 text-xs text-foreground">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" /> {f.label}
                  </li>
                ))}
                {pid !== "free" && (
                  <li className="flex items-start gap-1.5 text-xs text-muted-foreground italic">
                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" /> More benefits announced soon
                  </li>
                )}
              </ul>

              {isCurrent ? (
                <button disabled className="w-full text-xs font-bold py-2 rounded-lg border border-border bg-muted/30 text-muted-foreground cursor-default">
                  Your current plan
                </button>
              ) : pid === "free" ? (
                <button disabled className="w-full text-xs font-bold py-2 rounded-lg border border-border bg-muted/20 text-muted-foreground cursor-default">
                  Included
                </button>
              ) : (
                <button disabled className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-lg border border-primary/30 bg-primary/10 text-primary cursor-default">
                  <Sparkles className="w-3.5 h-3.5" /> Upgrade — coming soon
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Plan benefits comparison ────────────────────────────────────────────────
function BenefitsTable({ currentPlan }: { currentPlan: PlanId }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-base font-bold text-foreground flex items-center gap-2 mb-4">
        <Settings2 className="w-4 h-4 text-primary" /> Plan Benefits
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-semibold text-muted-foreground py-2 pr-4">Feature</th>
              {PLAN_ORDER.map((pid) => (
                <th key={pid} className={cn("text-center font-bold py-2 px-3 w-24", PLANS[pid].accent, pid === currentPlan && "underline underline-offset-4")}>
                  {PLANS[pid].name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURE_ROWS.map((f) => (
              <tr key={f.feature} className="border-b border-border/40 last:border-0">
                <td className="py-2.5 pr-4">
                  <p className="text-xs font-semibold text-foreground">{f.label}</p>
                  <p className="text-[11px] text-muted-foreground">{f.desc}</p>
                </td>
                {PLAN_ORDER.map((pid) => (
                  <td key={pid} className="text-center py-2.5 px-3">
                    {hasAccess(pid, f.feature) ? (
                      <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-muted-foreground/60 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Upstox API section (gated for free) ─────────────────────────────────────
function ApiSection() {
  const canApi = hasAccess(useAuth().user?.plan, "apiSettings");
  const { data, isLoading, refetch } = useGetUpstoxSettings({ query: { enabled: canApi } });
  const qc = useQueryClient();
  const disconnectMut = useDisconnectUpstox({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/settings/upstox"] }) },
  });

  if (!canApi) {
    return (
      <UpgradeGate
        title="API Settings is a Pro feature"
        description="Connect your Upstox broker account for real-time NSE tick data across the whole app. Available once you upgrade to Pro."
      />
    );
  }

  return (
    <>
      {/* Upstox API Section */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#5e27e0] flex items-center justify-center font-black text-white text-lg">U</div>
          <div>
            <h2 className="text-base font-bold text-foreground">Upstox API Integration</h2>
            <p className="text-xs text-muted-foreground">Connect your Upstox account for live NSE market data</p>
          </div>
          <div className="ml-auto">
            {data?.connected
              ? <span className="text-xs px-2.5 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full font-bold">CONNECTED</span>
              : <span className="text-xs px-2.5 py-1 bg-muted text-muted-foreground border border-border rounded-full font-bold">NOT CONNECTED</span>
            }
          </div>
        </div>

        {isLoading ? (
          <div className="h-40 bg-muted/30 animate-pulse rounded-xl" />
        ) : data?.connected ? (
          <ConnectedPanel data={data} onDisconnect={() => disconnectMut.mutate({})} />
        ) : (
          <ConnectForm onSuccess={() => refetch()} />
        )}
      </div>

      {/* Data Note */}
      {!data?.connected && (
        <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl text-xs text-muted-foreground">
          <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-blue-400">Using Yahoo Finance:</span> Without an Upstox API connection, NSE prices are fetched via Yahoo Finance (free, 15-minute delayed during market hours). Connect Upstox to get real-time tick data directly from NSE.
          </div>
        </div>
      )}
    </>
  );
}

// ── Account Settings page (profile, password, plan, benefits) ───────────────
export function Settings() {
  const { user } = useAuth();
  const plan = user?.plan ?? "free";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-xl font-black text-foreground flex items-center gap-2">
        <User className="w-5 h-5 text-primary" /> Account Settings
      </h1>

      <ProfileCard />
      <ChangePassword />
      <PlanSection currentPlan={plan} />
      <BenefitsTable currentPlan={plan} />
    </div>
  );
}

// ── API Settings page (Upstox integration only) ─────────────────────────────
export function ApiSettings() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-black text-foreground flex items-center gap-2">
        <Link2 className="w-5 h-5 text-primary" /> API Settings
      </h1>

      <ApiSection />

      {/* Market / data reference */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2 mb-4">
          <Settings2 className="w-4 h-4 text-primary" />
          Market Information
        </h2>
        <div className="space-y-3">
          {[
            { label: "Exchange", value: "NSE — National Stock Exchange of India" },
            { label: "Market Hours (IST)", value: "9:15 AM – 3:30 PM, Monday to Friday" },
            { label: "Pre-Open Session", value: "9:00 AM – 9:08 AM" },
            { label: "Data Source", value: "Upstox API (primary) · Yahoo Finance (fallback)" },
            { label: "Cache Duration", value: "90 seconds for stocks · 2 minutes for indices" },
            { label: "Indicators", value: "VWAP (14-day) · RSI (14-period)" },
          ].map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-4 py-2 border-b border-border/50 last:border-0">
              <span className="text-xs text-muted-foreground font-medium shrink-0">{row.label}</span>
              <span className="text-xs text-foreground font-medium text-right">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
