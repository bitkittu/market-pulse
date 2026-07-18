import { useState } from "react";
import { TrendingUp, Eye, EyeOff, ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  onRegister: () => void;
  onBack: () => void;
  onForgot: () => void;
}

export function Login({ onRegister, onBack, onForgot }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setError(""); setLoading(true);
    const res = await login(email.trim(), password);
    setLoading(false);
    if (!res.success) setError(res.error ?? "Login failed.");
  };

  return (
    <div className="min-h-screen bg-[#050b18] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Back button */}
        <button onClick={onBack}
          className="mb-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="ml-3">
              <span className="text-white font-bold text-xl">Market</span>
              <span className="text-emerald-400 font-bold text-xl ml-1">Pulse AI</span>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-1">Welcome back</h1>
          <p className="text-slate-400 text-sm text-center mb-8">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-slate-300">Password</label>
                <button type="button" onClick={onForgot}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-2.5 pr-10 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Don't have an account?{" "}
            <button onClick={onRegister} className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
              Create one free
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
