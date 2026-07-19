import { useState } from "react";
import { TrendingUp, Eye, EyeOff, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  onLogin: () => void;
  onBack: () => void;
}

export function Register({ onLogin, onBack }: Props) {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const strength = (() => {
    const p = form.password;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { setError("Please fill in all fields."); return; }
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setError(""); setLoading(true);
    const res = await register(form.name.trim(), form.email.trim(), form.password);
    setLoading(false);
    if (!res.success) setError(res.error ?? "Registration failed.");
  };

  const perks = ["Free forever plan", "AI-powered insights", "NSE/BSE real-time data", "No credit card required"];

  return (
    <div className="min-h-screen bg-[#050b18] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-emerald-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left - Brand info */}
        <div className="hidden lg:block space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-white font-bold text-xl">Market</span>
              <span className="text-emerald-400 font-bold text-xl ml-1">Pulse AI</span>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white leading-tight">
            Start your journey<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              to smarter investing
            </span>
          </h2>
          <p className="text-slate-400 text-base">
            Join 50,000+ investors who use Market Pulse AI to make informed decisions.
          </p>
          <ul className="space-y-3">
            {perks.map(p => (
              <li key={p} className="flex items-center gap-3 text-slate-300 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* Right - Form */}
        <div className="w-full max-w-md mx-auto lg:max-w-none">
          <button onClick={onBack}
            className="mb-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </button>

          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <h1 className="text-2xl font-bold text-white mb-1">Create your account</h1>
            <p className="text-slate-400 text-sm mb-6">Free forever — no credit card required</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Full name</label>
                <input value={form.name} onChange={set("name")} placeholder="Rahul Sharma"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
                <input type="email" value={form.email} onChange={set("email")} placeholder="you@example.com"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={form.password} onChange={set("password")}
                    placeholder="At least 6 characters"
                    className="w-full px-4 py-2.5 pr-10 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors" />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.password && (
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
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm password</label>
                <input type="password" value={form.confirm} onChange={set("confirm")} placeholder="Repeat your password"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors" />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</> : "Create Free Account"}
              </button>

              <p className="text-xs text-slate-500 text-center">
                By creating an account you agree to our Terms of Service and Privacy Policy.
              </p>
            </form>

            <p className="mt-5 text-center text-sm text-slate-400">
              Already have an account?{" "}
              <button onClick={onLogin} className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
