// Shared between the user-facing Support page and the Admin Support Center —
// mirrors artifacts/api-server's SupportCategory/SupportPriority/SupportStatus
// types and the STATUS_LABELS map in routes/support.ts.

export type SupportCategory =
  | "account_login" | "technical_issue" | "market_data" | "ai_signals"
  | "holding_stocks" | "intraday" | "options" | "commodities"
  | "subscription_billing" | "payment" | "feature_request" | "feedback" | "other";
export type SupportPriority = "low" | "medium" | "high" | "urgent";
export type SupportStatus = "open" | "waiting_admin" | "waiting_user" | "resolved" | "closed";

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  account_login: "Account & Login",
  technical_issue: "Technical Issue",
  market_data: "Market Data",
  ai_signals: "AI Signals",
  holding_stocks: "Holding Stocks",
  intraday: "Intraday",
  options: "Options",
  commodities: "Commodities",
  subscription_billing: "Subscription & Billing",
  payment: "Payment",
  feature_request: "Feature Request",
  feedback: "Feedback",
  other: "Other",
};

// Status labels AND status badge colors are deliberately NOT shared here:
// the user-facing page addresses the ticket owner directly ("Waiting for
// You", matching the wording the backend itself uses in emails — see
// STATUS_LABELS in artifacts/api-server/src/routes/support.ts) and is
// theme-aware (light/dark), while the admin queue describes the same state
// in the third person ("Waiting for User") on a dark-only backdrop with
// deliberately different color values. Each page keeps its own copy.
