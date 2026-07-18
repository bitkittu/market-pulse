import { useAuth } from "@/contexts/AuthContext";

export type PlanId = "free" | "pro" | "premium";

/** Every gate-able feature in the app. */
export type Feature =
  | "keyLevels" // Nifty resistance & support levels
  | "intraday" // Intraday predictions
  | "options" // Options predictions
  | "commodities" // Commodities predictions
  | "insights" // Stock insights
  | "portfolio" // Portfolio tracking
  | "performance" // Performance analytics
  | "apiSettings"; // Upstox API integration

/**
 * Features a FREE user can use. Everything not listed here is locked on the
 * free plan. Pro and Premium currently unlock everything — their richer,
 * plan-specific benefits are defined later.
 */
const FREE_ACCESS: Feature[] = ["commodities", "insights", "portfolio", "performance"];

export function hasAccess(plan: PlanId | undefined, feature: Feature): boolean {
  if (plan === "pro" || plan === "premium") return true;
  return FREE_ACCESS.includes(feature);
}

/** Hook form: is the current user allowed to use `feature`? */
export function useFeatureAccess(feature: Feature): boolean {
  const { user } = useAuth();
  return hasAccess(user?.plan, feature);
}

// ── Plan metadata ───────────────────────────────────────────────────────────
export interface PlanMeta {
  id: PlanId;
  name: string;
  tagline: string;
  price: string;
  priceNote: string;
  accent: string; // text color for the plan name
  badge: string; // pill classes for the plan badge
  card: string; // border/background accent for the plan card
  /** Whether the plan can currently be self-selected / purchased. */
  available: boolean;
}

export const PLANS: Record<PlanId, PlanMeta> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Core market tools at no cost",
    price: "₹0",
    priceNote: "forever",
    accent: "text-slate-300",
    badge: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    card: "border-slate-500/30",
    available: true,
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Full predictions & live trade levels",
    price: "Coming soon",
    priceNote: "",
    accent: "text-violet-400",
    badge: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    card: "border-violet-500/40",
    available: false,
  },
  premium: {
    id: "premium",
    name: "Premium",
    tagline: "Everything in Pro, plus more",
    price: "Coming soon",
    priceNote: "",
    accent: "text-amber-400",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    card: "border-amber-500/40",
    available: false,
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "pro", "premium"];

// ── Feature comparison rows (for the benefits table) ────────────────────────
export interface FeatureRow {
  feature: Feature;
  label: string;
  desc: string;
}

export const FEATURE_ROWS: FeatureRow[] = [
  { feature: "keyLevels", label: "Nifty Resistance & Support", desc: "Pivot, R1–R3 & S1–S3 key levels" },
  { feature: "intraday", label: "Intraday Predictions", desc: "AI intraday buy/sell/stop-loss picks" },
  { feature: "options", label: "Options Predictions", desc: "CE/PE picks with IV & OI analysis" },
  { feature: "commodities", label: "Commodities Predictions", desc: "Gold, silver, crude & more" },
  { feature: "insights", label: "Stock Insights", desc: "News-driven market insights" },
  { feature: "portfolio", label: "Portfolio Tracking", desc: "Track holdings & live P&L" },
  { feature: "performance", label: "Performance Analytics", desc: "Signal accuracy & returns" },
  { feature: "apiSettings", label: "Upstox API Integration", desc: "Connect your broker for live data" },
];
