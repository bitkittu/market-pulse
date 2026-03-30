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
} from "lucide-react";

function cn(...c: (string | false | undefined | null)[]) {
  return c.filter(Boolean).join(" ");
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

export function Settings() {
  const { data, isLoading, refetch } = useGetUpstoxSettings({ query: {} });
  const qc = useQueryClient();
  const disconnectMut = useDisconnectUpstox({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/settings/upstox"] }) },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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

      {/* General Settings */}
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

      {/* Data Note */}
      {!data?.connected && (
        <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl text-xs text-muted-foreground">
          <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-blue-400">Using Yahoo Finance:</span> Without an Upstox API connection, NSE prices are fetched via Yahoo Finance (free, 15-minute delayed during market hours). Connect Upstox to get real-time tick data directly from NSE.
          </div>
        </div>
      )}
    </div>
  );
}
