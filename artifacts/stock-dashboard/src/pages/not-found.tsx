import { Link } from "wouter";
import { Terminal } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground selection:bg-primary/30 font-mono">
      <div className="glass-panel p-12 text-center rounded-xl max-w-md border border-white/10">
        <Terminal className="h-16 w-16 text-primary mx-auto mb-6 opacity-80" />
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tighter">404</h1>
        <p className="text-muted-foreground mb-8">CONNECTION_REFUSED: The requested terminal module could not be found.</p>
        <Link href="/" className="inline-flex px-6 py-3 bg-primary text-primary-foreground font-bold rounded hover:bg-primary/90 transition-colors uppercase tracking-widest text-sm">
          Return to Terminal
        </Link>
      </div>
    </div>
  );
}
