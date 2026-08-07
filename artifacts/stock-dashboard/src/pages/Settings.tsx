import { useEffect, useState } from "react";
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
  Save, KeyRound, Pencil, X, Loader2, Phone, Bell, ShieldCheck, LogOut, CreditCard,
} from "lucide-react";
import { useAuth, api } from "@/contexts/AuthContext";
import { useFeatureAccess, useFeatureAccessState } from "@/contexts/FeatureAccessContext";
import { UpgradeGate } from "@/components/UpgradeGate";
import { loadRazorpayCheckout, openRazorpayCheckout } from "@/lib/razorpay";

function cn(...c: (string | false | undefined | null)[]) {
  return c.filter(Boolean).join(" ");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

// ── Email verification status + change email ────────────────────────────────
function EmailVerificationCard() {
  const { user, resendVerification, changeEmail } = useAuth();
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [changing, setChanging] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [changeError, setChangeError] = useState("");
  const [changeMsg, setChangeMsg] = useState("");
  const [changeSaving, setChangeSaving] = useState(false);

  if (!user) return null;

  const resend = async () => {
    setResending(true); setResendMsg("");
    const res = await resendVerification();
    setResending(false);
    setResendMsg(res.message ?? res.error ?? "");
  };

  const submitChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError(""); setChangeMsg("");
    if (!EMAIL_RE.test(newEmail)) { setChangeError("Enter a valid email address"); return; }
    if (!currentPassword) { setChangeError("Enter your current password"); return; }
    setChangeSaving(true);
    const res = await changeEmail(newEmail.trim(), currentPassword);
    setChangeSaving(false);
    if (!res.success) { setChangeError(res.error ?? "Failed to change email"); return; }
    setChangeMsg(res.message ?? "Check your new email to confirm this change.");
    setNewEmail(""); setCurrentPassword(""); setChanging(false);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-base font-bold text-foreground flex items-center gap-2 mb-4">
        <Mail className="w-4 h-4 text-primary" /> Email Verification
      </h2>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {user.emailVerified ? (
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold">
              <AlertCircle className="w-3.5 h-3.5" /> Not verified
            </span>
          )}
          <span className="text-sm text-muted-foreground">{user.email}</span>
        </div>

        <div className="flex items-center gap-2">
          {!user.emailVerified && (
            <button onClick={resend} disabled={resending}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 border border-primary/30 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50">
              {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {resending ? "Sending…" : "Resend verification email"}
            </button>
          )}
          {!changing && (
            <button onClick={() => { setChanging(true); setChangeError(""); setChangeMsg(""); }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors">
              <Pencil className="w-3 h-3" /> Change email
            </button>
          )}
        </div>
      </div>

      {resendMsg && <p className="mt-3 text-xs text-muted-foreground">{resendMsg}</p>}

      {changing && (
        <form onSubmit={submitChangeEmail} className="mt-4 pt-4 border-t border-border space-y-3 max-w-md">
          <div>
            <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">New email address</label>
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Current password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Confirm with your current password" autoComplete="current-password"
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          {changeError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {changeError}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button type="submit" disabled={changeSaving}
              className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50">
              {changeSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Send confirmation
            </button>
            <button type="button" onClick={() => { setChanging(false); setChangeError(""); }}
              className="inline-flex items-center gap-1.5 border border-border text-muted-foreground hover:text-foreground text-xs font-bold px-3 py-1.5 rounded-lg transition-all">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </form>
      )}
      {changeMsg && !changing && <p className="mt-3 text-xs text-emerald-400">{changeMsg}</p>}
    </div>
  );
}

// ── Profile card (editable name) ────────────────────────────────────────────
function ProfileCard() {
  const { user, updateProfile } = useAuth();
  const { planKey } = useFeatureAccessState();
  const { plans } = usePlanCatalog();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  if (!user) return null;
  const currentPlan = plans.find((p) => p.planKey === (planKey ?? user.plan));
  const planBadge = planColorClasses(currentPlan?.color ?? null).badge;
  const planName = currentPlan?.name ?? user.plan;

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
                <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-bold capitalize", planBadge)}>
                  <Crown className="w-3 h-3" /> {planName}
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

// ── Profile details (phone / bio / timezone / avatar) ───────────────────────
const TIMEZONES = [
  "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo", "Asia/Shanghai",
  "Europe/London", "Europe/Berlin", "America/New_York", "America/Chicago",
  "America/Los_Angeles", "Australia/Sydney", "UTC",
];

interface ProfileDetails { avatarUrl: string | null; phone: string | null; bio: string | null; timezone: string; }

function ProfileDetailsCard() {
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ avatarUrl: "", phone: "", bio: "", timezone: "Asia/Kolkata" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await api<ProfileDetails>("/auth/profile-details");
      if (res.ok) {
        const d = res.data as ProfileDetails;
        setForm({ avatarUrl: d.avatarUrl ?? "", phone: d.phone ?? "", bio: d.bio ?? "", timezone: d.timezone });
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true); setError("");
    const res = await api<ProfileDetails>("/auth/profile-details", {
      method: "PATCH",
      body: JSON.stringify({
        avatarUrl: form.avatarUrl.trim() || null,
        phone: form.phone.trim() || null,
        bio: form.bio.trim() || null,
        timezone: form.timezone,
      }),
    });
    setSaving(false);
    if (!res.ok) { setError((res.data as { error: string }).error); return; }
    setEditing(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const inputCls = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50";
  const labelCls = "text-xs text-muted-foreground font-semibold mb-1.5 block";

  if (loading) return <div className="h-40 bg-muted/30 animate-pulse rounded-xl" />;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Phone className="w-4 h-4 text-primary" /> Profile Details
        </h2>
        {!editing && (
          <button onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 border border-primary/30 rounded-lg px-2.5 py-1 transition-colors">
            <Pencil className="w-3 h-3" /> Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3 max-w-md">
          <div>
            <label className={labelCls}>Phone (optional)</label>
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+91 98765 43210" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Timezone</label>
            <select value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} className={inputCls}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Bio (optional)</label>
            <textarea value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} rows={3}
              placeholder="A little about you" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Avatar URL (optional)</label>
            <input value={form.avatarUrl} onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
              placeholder="https://…" className={inputCls} />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
            </button>
            <button onClick={() => setEditing(false)} disabled={saving}
              className="inline-flex items-center gap-1.5 border border-border text-muted-foreground hover:text-foreground text-xs font-bold px-3 py-1.5 rounded-lg transition-all">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-background/50 border border-border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">Phone</p>
            <p className="text-sm font-semibold text-foreground">{form.phone || "Not set"}</p>
          </div>
          <div className="bg-background/50 border border-border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">Timezone</p>
            <p className="text-sm font-semibold text-foreground">{form.timezone}</p>
          </div>
          <div className="bg-background/50 border border-border rounded-lg px-4 py-3 sm:col-span-2">
            <p className="text-xs text-muted-foreground mb-1">Bio</p>
            <p className="text-sm text-foreground">{form.bio || "No bio yet"}</p>
          </div>
        </div>
      )}
      {saved && <p className="text-xs text-emerald-400 mt-3 flex items-center gap-1"><Check className="w-3 h-3" /> Saved</p>}
    </div>
  );
}

// ── Notification preferences ─────────────────────────────────────────────────
interface NotificationPrefs { marketAlerts: boolean; productUpdates: boolean; supportUpdates: boolean; billingUpdates: boolean; }

function NotificationPreferencesCard() {
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    marketAlerts: true, productUpdates: true, supportUpdates: true, billingUpdates: true,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await api<NotificationPrefs>("/auth/notification-preferences");
      if (res.ok) setPrefs(res.data as NotificationPrefs);
      setLoading(false);
    })();
  }, []);

  const toggle = async (key: keyof NotificationPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await api("/auth/notification-preferences", { method: "PATCH", body: JSON.stringify(next) });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  if (loading) return <div className="h-40 bg-muted/30 animate-pulse rounded-xl" />;

  const ROWS: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
    { key: "marketAlerts", label: "Market Alerts", desc: "Notable price moves and market events" },
    { key: "productUpdates", label: "Product Updates", desc: "New features and improvements" },
    { key: "supportUpdates", label: "Support Updates", desc: "Non-critical updates about your tickets" },
    { key: "billingUpdates", label: "Billing Updates", desc: "Subscription and invoice reminders (coming soon)" },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-base font-bold text-foreground flex items-center gap-2 mb-1">
        <Bell className="w-4 h-4 text-primary" /> Notification Preferences
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        Security and account emails (verification, password resets, ticket replies) are always sent regardless of these settings.
      </p>
      <div className="space-y-3">
        {ROWS.map((r) => (
          <label key={r.key} className="flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-foreground">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </div>
            <input type="checkbox" checked={prefs[r.key]} onChange={() => void toggle(r.key)}
              className="w-5 h-5 rounded border-border text-primary focus:ring-primary/50 shrink-0" />
          </label>
        ))}
      </div>
      {saved && <p className="text-xs text-emerald-400 mt-3">Saved</p>}
    </div>
  );
}

// ── Sessions (login history + sign out everywhere) ──────────────────────────
interface LoginHistoryEntry { id: number; ipAddress: string | null; userAgent: string | null; status: "success" | "failed"; createdAt: string; }

function SessionsCard() {
  const [history, setHistory] = useState<LoginHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const res = await api<{ history: LoginHistoryEntry[] }>("/auth/login-history");
      if (res.ok) setHistory((res.data as { history: LoginHistoryEntry[] }).history);
      setLoading(false);
    })();
  }, []);

  const signOutEverywhere = async () => {
    setSigningOut(true); setMsg("");
    const res = await api<{ message: string }>("/auth/logout-all", { method: "POST" });
    setSigningOut(false);
    if (res.ok) setMsg((res.data as { message: string }).message);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" /> Sessions
        </h2>
        <button onClick={() => void signOutEverywhere()} disabled={signingOut}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-400 border border-red-500/30 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50">
          {signingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />} Sign out of other devices
        </button>
      </div>
      {msg && <p className="text-xs text-emerald-400 mb-3">{msg}</p>}
      {loading ? (
        <div className="h-24 bg-muted/30 animate-pulse rounded-lg" />
      ) : history.length === 0 ? (
        <p className="text-xs text-muted-foreground">No login history yet.</p>
      ) : (
        <div className="space-y-1.5">
          {history.slice(0, 8).map((h) => (
            <div key={h.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0 gap-3">
              <span className="text-muted-foreground truncate">{h.ipAddress ?? "Unknown IP"}</span>
              <span className={h.status === "success" ? "text-emerald-500 shrink-0" : "text-red-500 shrink-0"}>
                {h.status === "success" ? "Signed in" : "Failed attempt"}
              </span>
              <span className="text-muted-foreground shrink-0">{fmtDate(h.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Billing ───────────────────────────────────────────────────────────────
interface SubscriptionData {
  id: number;
  planId: "pro" | "premium";
  billingCycle: "monthly" | "annual";
  provider: "razorpay" | "stripe";
  status: "created" | "active" | "past_due" | "cancelled" | "expired";
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}
interface InvoiceData {
  id: number;
  amount: number;
  currency: "INR" | "USD";
  status: "paid" | "failed" | "refunded";
  invoiceNumber: string | null;
  paidAt: string | null;
  createdAt: string;
}

function formatMoney(amount: number, currency: "INR" | "USD"): string {
  const value = (amount / 100).toFixed(2);
  return currency === "INR" ? `₹${value}` : `$${value}`;
}

// ── Usage ─────────────────────────────────────────────────────────────────
// Reuses the already-fetched FeatureAccessContext data (GET /me/features
// includes used/remaining per feature) rather than a second API call — a
// feature only shows a bar once it actually has a limit configured via the
// admin Plan Features grid; unlimited/disabled features show nothing here.
function UsageBarsCard() {
  const { features } = useFeatureAccessState();
  const limited = Object.values(features).filter((f) => f.enabled && !f.isUnlimited && f.remaining !== null);
  if (limited.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-base font-bold text-foreground flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-primary" /> Usage
      </h2>
      <div className="space-y-3">
        {limited.map((f) => {
          const limit = f.dailyLimit ?? f.monthlyLimit ?? f.usageLimit ?? 0;
          const pct = limit > 0 ? Math.min(100, Math.round((f.used / limit) * 100)) : 0;
          return (
            <div key={f.featureKey}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-foreground capitalize">{f.featureKey.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">{f.used} / {limit}{f.dailyLimit ? " today" : f.monthlyLimit ? " this month" : ""}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-primary")} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BillingDetailsCard() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    const res = await api<{ subscription: SubscriptionData | null; invoices: InvoiceData[] }>("/payments/subscription");
    if (res.ok) {
      const data = res.data as { subscription: SubscriptionData | null; invoices: InvoiceData[] };
      setSubscription(data.subscription);
      setInvoices(data.invoices);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const cancel = async () => {
    if (!confirm("Cancel your subscription? You'll keep access until the end of the current billing period.")) return;
    setCancelling(true);
    const res = await api<{ message: string }>("/payments/subscription/cancel", { method: "POST" });
    setCancelling(false);
    if (res.ok) {
      setMessage((res.data as { message: string }).message);
      void load();
    }
  };

  const rows = [
    { label: "Billing Cycle", value: subscription ? (subscription.billingCycle === "monthly" ? "Monthly" : "Annual") : "—" },
    { label: "Next Billing Date", value: subscription?.currentPeriodEnd ? fmtDate(subscription.currentPeriodEnd) : "—" },
    { label: "Payment Method", value: subscription ? (subscription.provider === "razorpay" ? "Razorpay" : "Stripe") : "Not connected" },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-base font-bold text-foreground flex items-center gap-2 mb-1">
        <CreditCard className="w-4 h-4 text-primary" /> Billing Details
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        {subscription
          ? subscription.cancelAtPeriodEnd
            ? "Your subscription is set to cancel at the end of the current billing period."
            : "Manage your active subscription and view past payments."
          : "You don't have an active subscription. Upgrade above to unlock Pro or Premium."}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {rows.map((r) => (
          <div key={r.label} className="bg-background/50 border border-border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">{r.label}</p>
            <p className="text-sm font-semibold text-foreground">{r.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-background/50 border border-border rounded-lg p-4 mb-4">
        <p className="text-xs font-semibold text-foreground mb-2">Payment History</p>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : invoices.length === 0 ? (
          <p className="text-xs text-muted-foreground">No payment history yet.</p>
        ) : (
          <div className="space-y-1.5">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{inv.invoiceNumber ?? "—"} · {fmtDate(inv.paidAt ?? inv.createdAt)}</span>
                <span className={cn("font-semibold", inv.status === "paid" ? "text-emerald-400" : inv.status === "failed" ? "text-red-400" : "text-muted-foreground")}>
                  {formatMoney(inv.amount, inv.currency)} · {inv.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {message && (
        <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-500/10 rounded-lg px-3 py-2 mb-4">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {message}
        </div>
      )}
      {subscription && subscription.status !== "cancelled" && subscription.status !== "expired" && !subscription.cancelAtPeriodEnd && (
        <button onClick={cancel} disabled={cancelling}
          className="w-full text-xs font-bold py-2 rounded-lg border border-border bg-muted/20 text-muted-foreground hover:text-red-400 hover:border-red-500/30 transition-colors disabled:opacity-50">
          {cancelling ? "Cancelling…" : "Cancel Subscription"}
        </button>
      )}
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
interface PlanFeatureEntry {
  featureKey: string;
  name: string;
  enabled: boolean;
  isUnlimited: boolean;
  badge: "none" | "pro" | "premium" | "enterprise";
  comingSoon: boolean;
}
interface PlanPricingEntry {
  billingCycle: "monthly" | "annual";
  amountInrPaise: number;
  amountUsdCents: number;
}
export interface PlanCatalogEntry {
  planKey: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isPopular: boolean;
  isRecommended: boolean;
  color: string | null;
  icon: string | null;
  supportType: string | null;
  trialDays: number;
  pricing: PlanPricingEntry[];
  features: PlanFeatureEntry[];
}

/**
 * Maps a plan's DB-stored `color` (an admin-picked palette name) to Tailwind
 * classes. Every class below must appear as a literal string for Tailwind's
 * JIT scanner to generate it — a template-interpolated class name like
 * `text-${color}-400` would not be detected and would silently render
 * unstyled, so the palette is a fixed, curated set rather than passing an
 * arbitrary admin-entered string straight into a class name.
 */
const PLAN_COLOR_PALETTE: Record<string, { accent: string; badge: string; card: string }> = {
  slate: { accent: "text-slate-300", badge: "bg-slate-500/15 text-slate-300 border-slate-500/30", card: "border-slate-500/30" },
  violet: { accent: "text-violet-400", badge: "bg-violet-500/15 text-violet-300 border-violet-500/30", card: "border-violet-500/40" },
  amber: { accent: "text-amber-400", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30", card: "border-amber-500/40" },
  emerald: { accent: "text-emerald-400", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", card: "border-emerald-500/40" },
  blue: { accent: "text-blue-400", badge: "bg-blue-500/15 text-blue-300 border-blue-500/30", card: "border-blue-500/40" },
  rose: { accent: "text-rose-400", badge: "bg-rose-500/15 text-rose-300 border-rose-500/30", card: "border-rose-500/40" },
};
function planColorClasses(color: string | null): { accent: string; badge: string; card: string } {
  return PLAN_COLOR_PALETTE[color ?? "slate"] ?? PLAN_COLOR_PALETTE["slate"]!;
}

/** Shared by PlanSection and BenefitsTable — both render the same live catalog. */
function usePlanCatalog(): { plans: PlanCatalogEntry[]; loading: boolean } {
  const [plans, setPlans] = useState<PlanCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void (async () => {
      const res = await api<{ plans: PlanCatalogEntry[] }>("/payments/plans");
      if (res.ok) setPlans((res.data as { plans: PlanCatalogEntry[] }).plans);
      setLoading(false);
    })();
  }, []);
  return { plans, loading };
}

function PlanSection({ currentPlan }: { currentPlan: string }) {
  const { user } = useAuth();
  const { plans } = usePlanCatalog();
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [error, setError] = useState("");

  const priceFor = (plan: PlanCatalogEntry): { amount: number; available: boolean } => {
    const entry = plan.pricing.find((p) => p.billingCycle === cycle);
    const amount = entry ? (currency === "INR" ? entry.amountInrPaise : entry.amountUsdCents) : 0;
    return { amount, available: amount > 0 };
  };

  const startCheckout = async (pid: string) => {
    setError("");
    setCheckingOut(pid);
    try {
      const res = await api<{ provider: "razorpay" | "stripe"; subscriptionId: string; razorpayKeyId?: string; redirectUrl?: string }>(
        "/payments/checkout",
        { method: "POST", body: JSON.stringify({ planId: pid, billingCycle: cycle, currency }) },
      );
      if (!res.ok) {
        setError((res.data as { error: string }).error ?? "Failed to start checkout");
        return;
      }
      const data = res.data as { provider: "razorpay" | "stripe"; subscriptionId: string; razorpayKeyId?: string; redirectUrl?: string };
      if (data.provider === "stripe" && data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      if (data.provider === "razorpay" && data.razorpayKeyId) {
        await loadRazorpayCheckout();
        const planName = plans.find((p) => p.planKey === pid)?.name ?? pid;
        openRazorpayCheckout({
          key: data.razorpayKeyId,
          subscription_id: data.subscriptionId,
          name: "MarketPulse AI",
          description: `${planName} — ${cycle === "monthly" ? "Monthly" : "Annual"}`,
          prefill: { name: user?.name, email: user?.email },
          handler: () => { window.location.href = "/settings?checkout=success"; },
        });
      }
    } catch {
      setError("Failed to start checkout");
    } finally {
      setCheckingOut(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> Your Plan
        </h2>
        <div className="flex items-center gap-2 text-xs">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["INR", "USD"] as const).map((c) => (
              <button key={c} onClick={() => setCurrency(c)}
                className={cn("px-2.5 py-1 font-bold", currency === c ? "bg-primary text-white" : "bg-background text-muted-foreground hover:text-foreground")}>
                {c === "INR" ? "₹ INR" : "$ USD"}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["monthly", "annual"] as const).map((c) => (
              <button key={c} onClick={() => setCycle(c)}
                className={cn("px-2.5 py-1 font-bold capitalize", cycle === c ? "bg-primary text-white" : "bg-background text-muted-foreground hover:text-foreground")}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-5">
        You're on the <span className="font-semibold capitalize text-foreground">{plans.find((p) => p.planKey === currentPlan)?.name ?? currentPlan}</span> plan. Upgrade to unlock predictions, live levels and broker integration.
      </p>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2 mb-4">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((p) => {
          const isCurrent = p.planKey === currentPlan;
          const isFree = p.pricing.length === 0;
          const included = p.features.filter((f) => f.enabled);
          const colors = planColorClasses(p.color);
          const { amount, available } = priceFor(p);
          const priceLabel = isFree ? "₹0" : available ? formatMoney(amount, currency) : "Coming soon";
          return (
            <div key={p.planKey} className={cn("relative rounded-xl border bg-background/40 p-4 flex flex-col", isCurrent ? "border-primary/50 ring-1 ring-primary/30" : colors.card)}>
              {isCurrent && (
                <span className="absolute -top-2.5 left-4 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary text-white">
                  Current
                </span>
              )}
              {!isCurrent && p.isPopular && (
                <span className="absolute -top-2.5 right-4 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/80 text-white">
                  Popular
                </span>
              )}
              <div className="flex items-baseline justify-between mb-1">
                <span className={cn("text-base font-black", colors.accent)}>{p.name}</span>
                <div className="text-right">
                  <span className="text-sm font-bold text-foreground">{priceLabel}</span>
                  {!isFree && available && <span className="text-[10px] text-muted-foreground ml-1">/{cycle === "monthly" ? "mo" : "yr"}</span>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{p.description}</p>

              <ul className="space-y-1.5 mb-4 flex-1">
                {included.map((f) => (
                  <li key={f.featureKey} className="flex items-start gap-1.5 text-xs text-foreground">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" /> {f.name}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <button disabled className="w-full text-xs font-bold py-2 rounded-lg border border-border bg-muted/30 text-muted-foreground cursor-default">
                  Your current plan
                </button>
              ) : isFree ? (
                <button disabled className="w-full text-xs font-bold py-2 rounded-lg border border-border bg-muted/20 text-muted-foreground cursor-default">
                  Included
                </button>
              ) : !available ? (
                <button disabled className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-lg border border-primary/30 bg-primary/10 text-primary cursor-default">
                  <Sparkles className="w-3.5 h-3.5" /> Upgrade — coming soon
                </button>
              ) : (
                <button onClick={() => void startCheckout(p.planKey)} disabled={checkingOut === p.planKey}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-lg bg-primary hover:bg-primary/90 text-white transition-colors disabled:opacity-50">
                  {checkingOut === p.planKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {checkingOut === p.planKey ? "Starting…" : "Upgrade"}
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
function BenefitsTable({ currentPlan }: { currentPlan: string }) {
  const { plans } = usePlanCatalog();
  // Row list = the union of every feature that appears on any plan, in the
  // order the highest-tier plan lists them — a plan created later with a
  // feature no other plan has still shows up as a row.
  const featureRows = new Map<string, string>();
  for (const p of plans) for (const f of p.features) if (!featureRows.has(f.featureKey)) featureRows.set(f.featureKey, f.name);

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
              {plans.map((p) => (
                <th key={p.planKey} className={cn("text-center font-bold py-2 px-3 w-24", planColorClasses(p.color).accent, p.planKey === currentPlan && "underline underline-offset-4")}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...featureRows.entries()].map(([featureKey, label]) => (
              <tr key={featureKey} className="border-b border-border/40 last:border-0">
                <td className="py-2.5 pr-4">
                  <p className="text-xs font-semibold text-foreground">{label}</p>
                </td>
                {plans.map((p) => {
                  const enabled = p.features.find((f) => f.featureKey === featureKey)?.enabled ?? false;
                  return (
                    <td key={p.planKey} className="text-center py-2.5 px-3">
                      {enabled ? (
                        <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-muted-foreground/60 mx-auto" />
                      )}
                    </td>
                  );
                })}
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
  const canApi = useFeatureAccess("api_settings");
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
  // The resolved effective plan (subscriptions row when one exists, else the
  // legacy users.plan enum) — not just `user.plan` directly, since a custom
  // admin-created plan isn't reflected there. See lib/features/resolve.ts.
  const { planKey } = useFeatureAccessState();
  const plan = planKey ?? user?.plan ?? "free";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-xl font-black text-foreground flex items-center gap-2">
        <User className="w-5 h-5 text-primary" /> Account Settings
      </h1>

      <ProfileCard />
      <ProfileDetailsCard />
      <EmailVerificationCard />
      <NotificationPreferencesCard />
      <ChangePassword />
      <SessionsCard />
      <PlanSection currentPlan={plan} />
      <UsageBarsCard />
      <BillingDetailsCard />
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
            <div key={row.label} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-0.5 sm:gap-4 py-2 border-b border-border/50 last:border-0">
              <span className="text-xs text-muted-foreground font-medium sm:shrink-0">{row.label}</span>
              <span className="text-xs text-foreground font-medium sm:text-right">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
