import {
  Zap, Activity, Wheat, Coins, Bitcoin,
  LayoutDashboard, GraduationCap, LineChart, Sparkles, Filter, Target, FileText,
  type LucideIcon,
} from "lucide-react";

export type MarketId = "intraday" | "options" | "commodities" | "forex" | "crypto";
export type SectionId = "dashboard" | "learn" | "indicators" | "ai" | "screeners" | "strategies" | "reports";
export type AccentColor = "emerald" | "violet" | "orange" | "blue" | "amber";

/** Top-level destinations outside the Market Hub tree. */
export type GeneralTab = "home" | "portfolio" | "performance" | "insights" | "api" | "account";
export type MarketTab = `${MarketId}-${SectionId}`;
export type Tab = GeneralTab | MarketTab;

export interface MarketMeta {
  id: MarketId;
  label: string;
  icon: LucideIcon;
  accent: AccentColor;
}

export interface SectionMeta {
  id: SectionId;
  /** Label used in menus (sidebar, bottom nav, breadcrumbs). */
  label: string;
  icon: LucideIcon;
}

/**
 * Every market shown in the Market Hub. Add a new market by adding one entry
 * here (plus the id to the MarketId union above) — the sidebar, mobile nav,
 * breadcrumbs, and routing all derive from this array.
 */
export const MARKETS: MarketMeta[] = [
  { id: "intraday",    label: "Intraday",    icon: Zap,      accent: "emerald" },
  { id: "options",     label: "Options",     icon: Activity, accent: "violet" },
  { id: "commodities", label: "Commodities", icon: Wheat,    accent: "orange" },
  { id: "forex",       label: "Forex",       icon: Coins,    accent: "blue" },
  { id: "crypto",      label: "Crypto",      icon: Bitcoin,  accent: "amber" },
];

/** Every section under a market. Same 7 sections apply to every market. */
export const SECTIONS: SectionMeta[] = [
  { id: "dashboard",   label: "Dashboard",   icon: LayoutDashboard },
  { id: "learn",       label: "Learn",       icon: GraduationCap },
  { id: "indicators",  label: "Indicators",  icon: LineChart },
  { id: "ai",          label: "AI Decision", icon: Sparkles },
  { id: "screeners",   label: "Screeners",   icon: Filter },
  { id: "strategies",  label: "Strategies",  icon: Target },
  { id: "reports",     label: "Reports",     icon: FileText },
];

/**
 * Markets whose "dashboard" section is a real, already-built page rather
 * than a Coming Soon placeholder. Keep this in sync with the lazy imports
 * wired up in App.tsx.
 */
export const LIVE_DASHBOARD_MARKETS: MarketId[] = ["intraday", "options", "commodities"];

export interface SectionContent {
  /** Page title — may differ from the menu label (e.g. "AI Decision" -> "AI Decision Engine"). */
  title: string;
  description: string;
  features: string[];
}

/** Coming Soon copy per section, shared across every market. */
export const SECTION_CONTENT: Record<SectionId, SectionContent> = {
  dashboard: {
    title: "Dashboard",
    description: "This will become the landing page for each market, bringing together a live market summary, index, movers, and AI insights in one view.",
    features: [
      "Market Summary", "Live Index", "Top Gainers", "Top Losers",
      "Volume Leaders", "Heatmap", "News", "Market Statistics",
      "Market Sentiment", "Quick AI Recommendation",
    ],
  },
  learn: {
    title: "Learn",
    description: "We are building a comprehensive learning center to help traders understand markets, strategies, and risk management.",
    features: [
      "Beginner Guides", "Intermediate Courses", "Advanced Courses",
      "Trading Psychology", "Risk Management", "Video Tutorials",
      "Documentation", "FAQs",
    ],
  },
  indicators: {
    title: "Indicators",
    description: "Technical indicators and advanced chart analysis tools will be available in an upcoming release.",
    features: [
      "RSI", "MACD", "EMA", "SMA", "VWAP", "Bollinger Bands", "ATR", "ADX",
      "Supertrend", "Ichimoku", "Fibonacci", "Pivot Points",
      "Support & Resistance", "Volume Indicators", "Moving Average Crossovers",
    ],
  },
  ai: {
    title: "AI Decision Engine",
    description: "Our AI Decision Engine is currently under development and will provide intelligent trading insights powered by multiple market indicators and AI models.",
    features: [
      "Buy Recommendation", "Sell Recommendation", "Hold Recommendation",
      "Entry Price", "Exit Target", "Stop Loss", "Confidence Score",
      "Risk Score", "Risk/Reward Ratio", "Pattern Recognition",
      "AI Market Sentiment", "Multi-Timeframe Analysis", "Probability Analysis",
      "Trade Explanation", "AI Confidence Meter",
    ],
  },
  screeners: {
    title: "Screeners",
    description: "A powerful suite of screeners to help you filter stocks and instruments by breakout, volume, momentum, and AI-driven signals is on its way.",
    features: [
      "Breakout Screener", "Breakdown Screener", "Volume Screener",
      "Delivery Screener", "Momentum Screener", "Swing Screener",
      "Intraday Screener", "AI Screener", "Multi-Timeframe Screener",
    ],
  },
  strategies: {
    title: "Strategies",
    description: "Ready-to-use trading strategies and playbooks for every style and market are currently in development.",
    features: [
      "Intraday Strategies", "Swing Trading", "Scalping", "Option Buying",
      "Option Selling", "Commodity Strategies", "Forex Strategies",
      "Crypto Strategies", "AI Strategies", "Risk Management Strategies",
    ],
  },
  reports: {
    title: "Reports",
    description: "Detailed daily, weekly, and monthly performance reports with export options are coming soon.",
    features: [
      "Daily Report", "Weekly Report", "Monthly Report", "AI Reports",
      "Performance Reports", "Trading Journal", "Export to Excel", "Export to PDF",
    ],
  },
};

export const ACCENT_CLASSES: Record<AccentColor, {
  text: string; dot: string; iconBg: string; iconBorder: string; glow: string;
}> = {
  emerald: {
    text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500",
    iconBg: "bg-emerald-500/10", iconBorder: "border-emerald-500/30", glow: "bg-emerald-500/15",
  },
  violet: {
    text: "text-violet-600 dark:text-violet-400", dot: "bg-violet-500",
    iconBg: "bg-violet-500/10", iconBorder: "border-violet-500/30", glow: "bg-violet-500/15",
  },
  orange: {
    text: "text-orange-600 dark:text-orange-400", dot: "bg-orange-500",
    iconBg: "bg-orange-500/10", iconBorder: "border-orange-500/30", glow: "bg-orange-500/15",
  },
  blue: {
    text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500",
    iconBg: "bg-blue-500/10", iconBorder: "border-blue-500/30", glow: "bg-blue-500/15",
  },
  amber: {
    text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500",
    iconBg: "bg-amber-500/10", iconBorder: "border-amber-500/30", glow: "bg-amber-500/15",
  },
};

export function marketTab(marketId: MarketId, section: SectionId): `${MarketId}-${SectionId}` {
  return `${marketId}-${section}`;
}
