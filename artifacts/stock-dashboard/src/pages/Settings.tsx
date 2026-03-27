import { useState } from "react";
import {
  useGetUpstoxSettings,
  useSaveUpstoxSettings,
  useDisconnectUpstox,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Settings2, Link2, Unlink, CheckCircle2, AlertCircle, ExternalLink, Eye, EyeOff, Zap, Clock } from "lucide-react";

function cn(...c: (string | false | undefined | null)[]) {
  return c.filter(Boolean).join(" ");
}

function ConnectedPanel({ data, onDisconnect }: {
  data: { connected: boolean; apiKeyMasked?: string; clientId?: string; connectedAt?: string; liveDataEnabled: boolean };
  onDisconnect: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
        <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
        <div>
          <p className="text-sm font-bold text-emerald-400">Upstox API Connected</p>
          <p className="text-xs text-muted-foreground">Live market data is active from your Upstox account</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: "API Key", value: data.apiKeyMasked ?? "—" },
          { label: "Client ID", value: data.clientId ?? "—" },
          { label: "Connected At", value: data.connectedAt ? new Date(data.connectedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—" },
          { label: "Live Data", value: data.liveDataEnabled ? "Enabled" : "Disabled" },
        ].map((row) => (
          <div key={row.label} className="bg-background/50 border border-border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">{row.label}</p>
            <p className="text-sm font-mono font-semibold text-foreground">{row.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
        <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-primary">Live Data Active:</span> Market data for your portfolio stocks is now sourced from Upstox. VWAP and RSI calculations use real-time tick data.
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
    saveMut.mutate({ data: { apiKey: apiKey.trim(), apiSecret: apiSecret || undefined, clientId: clientId || undefined, accessToken: accessToken || undefined } });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Instructions */}
      <div className="bg-background/50 border border-border rounded-xl p-4 space-y-2">
        <p className="text-xs font-bold text-foreground">How to get your Upstox API credentials:</p>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Visit <a href="https://developer.upstox.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">developer.upstox.com <ExternalLink className="w-3 h-3" /></a></li>
          <li>Log in with your Upstox trading account</li>
          <li>Create a new app in the Developer Console</li>
          <li>Copy the API Key and API Secret from your app</li>
          <li>Generate an Access Token via OAuth for live data</li>
        </ol>
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
        <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Access Token <span className="text-muted-foreground font-normal">(for live data)</span></label>
        <div className="relative">
          <input
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            type={showToken ? "text" : "password"}
            placeholder="OAuth Access Token (optional)"
            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 pr-10 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button type="button" onClick={() => setShowToken(!showToken)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Access Token enables real-time market data. Without it, simulated data is used.</p>
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
        {saveMut.isPending ? "Connecting..." : "Connect Upstox API"}
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
            { label: "Data Refresh", value: "Every 30 seconds (simulated) | Real-time with Upstox API" },
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
      <div className="flex items-start gap-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl text-xs text-muted-foreground">
        <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-yellow-400">Simulated Data:</span> Without an Upstox API connection, all market data is algorithmically simulated for demonstration. Connect your Upstox API to get real live NSE market data.
        </div>
      </div>
    </div>
  );
}
