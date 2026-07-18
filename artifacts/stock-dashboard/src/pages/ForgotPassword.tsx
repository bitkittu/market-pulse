import { useState } from "react";
import { TrendingUp, ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  onBack: () => void;
}

export function ForgotPassword({ onBack }: Props) {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [devResetUrl, setDevResetUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError("Please enter your email address."); return; }
    setError(""); setMessage(""); setDevResetUrl(""); setLoading(true);
    const res = await requestPasswordReset(email.trim());
    setLoading(false);
    if (!res.success) { setError(res.error ?? "Something went wrong. Please try again."); return; }
    setMessage(res.message ?? "If an account exists for that email, a reset link has been sent.");
    if (res.devResetUrl) setDevResetUrl(res.devResetUrl);
  };

  return (
    <div className="min-h-screen bg-[#050b18] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <button onClick={onBack}
          className="mb-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Sign In
        </button>

        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center justify-center mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="ml-3">
              <span className="text-white font-bold text-xl">Market</span>
              <span className="text-emerald-400 font-bold text-xl ml-1">Pulse AI</span>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-1">Forgot password?</h1>
          <p className="text-slate-400 text-sm text-center mb-8">
            Enter your email and we'll send you a link to reset your password.
          </p>

          {message ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-start gap-2">
                <MailCheck className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{message}</span>
              </div>

              {devResetUrl && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-slate-300">
                  <p className="text-blue-400 font-semibold mb-1">Testing mode (email not configured)</p>
                  <p className="mb-2 text-slate-400">Use this link to reset your password:</p>
                  <a href={devResetUrl}
                    className="text-blue-400 hover:text-blue-300 break-all underline">
                    {devResetUrl}
                  </a>
                </div>
              )}

              <button onClick={onBack}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-semibold rounded-lg transition-all">
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors"
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending link...</> : "Send Reset Link"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-slate-400">
            Remember your password?{" "}
            <button onClick={onBack} className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
