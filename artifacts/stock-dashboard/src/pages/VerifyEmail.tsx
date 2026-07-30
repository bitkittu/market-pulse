import { useEffect, useState } from "react";
import { TrendingUp, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  token: string;
  onDone: () => void;
}

export function VerifyEmail({ token, onDone }: Props) {
  const { verifyEmail } = useAuth();
  const [status, setStatus] = useState<"checking" | "success" | "error">("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await verifyEmail(token);
      if (cancelled) return;
      if (res.success) {
        setStatus("success");
        setMessage(res.message ?? "Your email address has been verified.");
      } else {
        setStatus("error");
        setMessage(res.error ?? "This verification link is invalid or has expired.");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen bg-[#050b18] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
          <div className="flex items-center justify-center mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="ml-3">
              <span className="text-white font-bold text-xl">Market</span>
              <span className="text-emerald-400 font-bold text-xl ml-1">Pulse AI</span>
            </div>
          </div>

          {status === "checking" && (
            <div className="space-y-4">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
              <p className="text-slate-400 text-sm">Verifying your email address…</p>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-5">
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Email verified</h1>
                <p className="text-slate-400 text-sm">{message}</p>
              </div>
              <button onClick={onDone}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-semibold rounded-lg transition-all">
                Continue
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-5">
              <div className="mx-auto w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <XCircle className="w-7 h-7 text-red-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Verification failed</h1>
                <p className="text-slate-400 text-sm">{message}</p>
              </div>
              <button onClick={onDone}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-semibold rounded-lg transition-all">
                Continue
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
