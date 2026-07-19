import { useState } from "react";
import { TrendingUp, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  token: string;
  onDone: () => void;
}

export function ResetPassword({ token: initialToken, onDone }: Props) {
  const { resetPassword } = useAuth();
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const strength = (() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) { setError("Reset token is missing. Please use the link from your email."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setError(""); setLoading(true);
    const res = await resetPassword(token.trim(), password);
    setLoading(false);
    if (!res.success) { setError(res.error ?? "Failed to reset password."); return; }
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-[#050b18] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center justify-center mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="ml-3">
              <span className="text-white font-bold text-xl">Market</span>
              <span className="text-emerald-400 font-bold text-xl ml-1">Pulse AI</span>
            </div>
          </div>

          {done ? (
            <div className="text-center space-y-5">
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Password reset</h1>
                <p className="text-slate-400 text-sm">Your password has been updated. You can now sign in with your new password.</p>
              </div>
              <button onClick={onDone}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-semibold rounded-lg transition-all">
                Go to Sign In
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white text-center mb-1">Set a new password</h1>
              <p className="text-slate-400 text-sm text-center mb-8">Choose a strong password for your account.</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {!initialToken && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Reset token</label>
                    <input value={token} onChange={e => setToken(e.target.value)}
                      placeholder="Paste your reset token"
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors" />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">New password</label>
                  <div className="relative">
                    <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full px-4 py-2.5 pr-10 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors" />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password && (
                    <div className="mt-2 flex gap-1">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= strength
                            ? strength <= 1 ? "bg-red-500" : strength <= 2 ? "bg-amber-500" : strength <= 3 ? "bg-blue-500" : "bg-emerald-500"
                            : "bg-slate-700"
                        }`} />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm new password</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat your new password"
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors" />
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Resetting...</> : "Reset Password"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-400">
                <button onClick={onDone} className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                  Back to Sign In
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
