import mysql, {
  type Pool,
  type RowDataPacket,
  type ResultSetHeader,
} from "mysql2/promise";

// ── Connection ──────────────────────────────────────────────────────────────
// Accept the common env-var names shared hosts inject for the connection
// string, but only ever use a value that is actually a mysql:// string — this
// avoids accidentally picking up a stale mongodb+srv:// URI from the old
// Atlas setup. Hosts that expose discrete credentials instead of a URL
// (Hostinger's MySQL panel does) are supported via DB_HOST/DB_USER/etc.
const URL_ENV_VARS = ["DATABASE_URL", "MYSQL_URL", "MYSQL_URI"] as const;

interface ConnectionConfig {
  uri?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}

function resolveConnection(): ConnectionConfig {
  const present: { name: string; value: string }[] = [];
  for (const name of URL_ENV_VARS) {
    const value = process.env[name]?.trim();
    if (value) present.push({ name, value });
  }

  const url = present.find((c) => c.value.startsWith("mysql"));
  if (url) return { uri: url.value };

  // Fall back to discrete credentials before complaining about the URL.
  const host = process.env["DB_HOST"]?.trim() ?? process.env["MYSQL_HOST"]?.trim();
  const user = process.env["DB_USER"]?.trim() ?? process.env["MYSQL_USER"]?.trim();
  const database = process.env["DB_NAME"]?.trim() ?? process.env["MYSQL_DATABASE"]?.trim();
  if (host && user && database) {
    const rawPort = process.env["DB_PORT"]?.trim() ?? process.env["MYSQL_PORT"]?.trim();
    return {
      host,
      port: rawPort ? Number(rawPort) : 3306,
      user,
      password: process.env["DB_PASSWORD"]?.trim() ?? process.env["MYSQL_PASSWORD"]?.trim() ?? "",
      database,
    };
  }

  if (present.length > 0) {
    throw new Error(
      `Found ${present.map((c) => c.name).join(", ")} but no value is a mysql:// connection ` +
        `string. Set DATABASE_URL to your MySQL string (mysql://user:pass@host:3306/dbname). ` +
        `A leftover MongoDB URI will not work.`,
    );
  }

  throw new Error(
    `MySQL connection details missing. Set DATABASE_URL (checked: ${URL_ENV_VARS.join(", ")}) ` +
      `or DB_HOST/DB_USER/DB_NAME.`,
  );
}

let pool: Pool | null = null;

/**
 * Creates the connection pool and verifies it with a round-trip, so a bad
 * host/credential fails here at startup rather than on the first request.
 * Idempotent — safe to call more than once.
 */
export async function connectDb(): Promise<Pool> {
  if (pool) return pool;

  const config = resolveConnection();
  const created = config.uri
    ? mysql.createPool(config.uri)
    : mysql.createPool({
        host: config.host!,
        port: config.port!,
        user: config.user!,
        password: config.password!,
        database: config.database!,
      });

  // Prove the credentials work before we hand the pool out.
  const conn = await created.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }

  pool = created;
  return pool;
}

function getPool(): Pool {
  if (!pool) {
    throw new Error("Database not connected. connectDb() must be awaited at startup.");
  }
  return pool;
}

/** Everything this layer ever binds to a placeholder. */
type SqlParam = string | number | boolean | Date | null;

async function query(sql: string, params: SqlParam[] = []): Promise<RowDataPacket[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(sql, params);
  return rows;
}

async function execute(sql: string, params: SqlParam[] = []): Promise<ResultSetHeader> {
  const [result] = await getPool().execute<ResultSetHeader>(sql, params);
  return result;
}

// ── Row types ───────────────────────────────────────────────────────────────
export interface UserRow {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  roleId: number;
  plan: "free" | "pro" | "premium";
  status: "active" | "suspended";
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  /** Bumped on password change/reset to invalidate previously issued JWTs. */
  tokenVersion: number;
  termsAcceptedAt: Date | null;
  marketingConsent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailVerificationRow {
  id: number;
  userId: number;
  tokenHash: string;
  /** NULL = verifying the account's current email; set = confirming a pending email change. */
  newEmail: string | null;
  expiresAt: Date;
  verifiedAt: Date | null;
  createdAt: Date;
}

export interface SmtpSettingsRow {
  host: string | null;
  port: number;
  encryption: "none" | "ssl" | "tls";
  username: string | null;
  /** AES-256-GCM ciphertext (base64), never the plaintext secret. */
  passwordEncrypted: string | null;
  fromName: string;
  fromEmail: string | null;
  replyToEmail: string | null;
  supportEmail: string | null;
  updatedBy: number | null;
  updatedAt: Date;
}

export interface EmailTemplateRow {
  id: number;
  templateKey: string;
  name: string;
  subject: string;
  preheader: string | null;
  body: string;
  ctaLabel: string | null;
  ctaUrlTemplate: string | null;
  footerNote: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailLogRow {
  id: number;
  userId: number | null;
  templateKey: string;
  recipient: string;
  subject: string;
  triggerSource: string;
  status: "pending" | "sent" | "failed";
  failureReason: string | null;
  createdAt: Date;
  sentAt: Date | null;
}

export type SupportCategory =
  | "account_login" | "technical_issue" | "market_data" | "ai_signals"
  | "holding_stocks" | "intraday" | "options" | "commodities"
  | "subscription_billing" | "payment" | "feature_request" | "feedback" | "other";
export type SupportPriority = "low" | "medium" | "high" | "urgent";
export type SupportStatus = "open" | "waiting_admin" | "waiting_user" | "resolved" | "closed";

export interface SupportTicketRow {
  id: number;
  ticketNumber: string | null;
  userId: number;
  category: SupportCategory;
  subject: string;
  description: string;
  priority: SupportPriority;
  status: SupportStatus;
  assignedAdminId: number | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
}

export interface SupportMessageRow {
  id: number;
  ticketId: number;
  authorUserId: number;
  isAdminReply: boolean;
  body: string;
  createdAt: Date;
}

export interface SupportInternalNoteRow {
  id: number;
  ticketId: number;
  adminUserId: number;
  body: string;
  createdAt: Date;
}

export interface RoleRow {
  id: number;
  name: string;
  description: string | null;
  permissions: string[];
  createdAt: Date;
}

export interface WatchlistRow {
  id: number;
  userId: number;
  symbol: string;
  addedAt: Date;
}

export interface PortfolioRow {
  id: number;
  userId: number;
  symbol: string;
  exchange: string;
  buyPrice: number | null;
  quantity: number | null;
  addedAt: Date;
}

export interface UpstoxSettingsRow {
  id: number;
  userId: number;
  apiKey: string;
  apiSecret: string | null;
  clientId: string | null;
  accessToken: string | null;
  liveDataEnabled: boolean;
  connectedAt: Date;
}

export interface LoginHistoryRow {
  id: number;
  userId: number;
  ipAddress: string | null;
  userAgent: string | null;
  status: "success" | "failed";
  createdAt: Date;
}

export interface UserProfileRow {
  userId: number;
  avatarUrl: string | null;
  phone: string | null;
  bio: string | null;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferencesRow {
  userId: number;
  marketAlerts: boolean;
  productUpdates: boolean;
  supportUpdates: boolean;
  billingUpdates: boolean;
  updatedAt: Date;
}

export interface PasswordResetRow {
  id: number;
  userId: number;
  tokenHash: string; // sha256 of the raw token — the raw token is never stored
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface PaymentSettingsRow {
  razorpayKeyId: string | null;
  razorpayKeySecretEncrypted: string | null;
  razorpayWebhookSecretEncrypted: string | null;
  stripePublishableKey: string | null;
  stripeSecretKeyEncrypted: string | null;
  stripeWebhookSecretEncrypted: string | null;
  updatedBy: number | null;
  updatedAt: Date;
}

/**
 * A `plans.plan_key` value. Was a fixed `"pro"|"premium"` union before
 * MP-PLAN-001 — now a free-form key so an admin-created plan (see `PlanRow`
 * below) is purchasable through the same checkout without a schema change.
 * Validate membership against `db.plans` at runtime, not this type.
 */
export type PlanId = string;
export type BillingCycle = "monthly" | "annual";
export type PaymentProvider = "razorpay" | "stripe";

export interface SubscriptionPlanRow {
  id: number;
  planId: PlanId;
  billingCycle: BillingCycle;
  /** Money is always the smallest currency unit — paise, never rupees. */
  amountInrPaise: number;
  /** Money is always the smallest currency unit — cents, never dollars. */
  amountUsdCents: number;
  razorpayPlanId: string | null;
  stripePriceId: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionStatus = "created" | "active" | "past_due" | "cancelled" | "expired";

export interface SubscriptionRow {
  id: number;
  userId: number;
  planId: PlanId;
  billingCycle: BillingCycle;
  provider: PaymentProvider;
  providerSubscriptionId: string;
  providerCustomerId: string | null;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type InvoiceStatus = "paid" | "failed" | "refunded";
export type Currency = "INR" | "USD";

export interface InvoiceRow {
  id: number;
  userId: number;
  subscriptionId: number | null;
  provider: PaymentProvider;
  providerPaymentId: string;
  providerInvoiceId: string | null;
  /** Smallest currency unit, matching `currency`. */
  amount: number;
  currency: Currency;
  status: InvoiceStatus;
  invoiceNumber: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

// ── Plan / feature access engine (MP-PLAN-001) ───────────────────────────────

export type PlanStatus = "active" | "inactive" | "archived";

export interface PlanRow {
  planKey: string;
  name: string;
  description: string | null;
  trialDays: number;
  displayOrder: number;
  isPopular: boolean;
  isRecommended: boolean;
  status: PlanStatus;
  color: string | null;
  icon: string | null;
  /** Informational/display only — see the note in lib/db/feature_engine.sql. Actual enforcement is exclusively plan_features. */
  maxUsers: number | null;
  maxDevices: number | null;
  maxWatchlists: number | null;
  maxAlerts: number | null;
  maxApiCalls: number | null;
  maxAiRequests: number | null;
  storageLimitMb: number | null;
  supportType: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureCategoryRow {
  categoryKey: string;
  name: string;
  displayOrder: number;
  icon: string | null;
}

export type FeatureStatus = "active" | "inactive";

export interface FeatureRow {
  featureKey: string;
  name: string;
  description: string | null;
  categoryKey: string;
  parentModule: string | null;
  displayOrder: number;
  icon: string | null;
  status: FeatureStatus;
}

export type FeatureBadge = "none" | "pro" | "premium" | "enterprise";

export interface PlanFeatureRow {
  id: number;
  planKey: string;
  featureKey: string;
  enabled: boolean;
  usageLimit: number | null;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  isUnlimited: boolean;
  visibleInMenu: boolean;
  comingSoon: boolean;
  isBeta: boolean;
  badge: FeatureBadge;
  hideCompletely: boolean;
  showUpgradeBanner: boolean;
  readOnly: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserFeatureUsageRow {
  id: number;
  userId: number;
  featureKey: string;
  period: string;
  count: number;
  updatedAt: Date;
}

// ── Row decoders ────────────────────────────────────────────────────────────
// mysql2 hands back snake_case columns, DECIMAL as string, and tinyint(1) as
// 0/1, so each table gets an explicit decoder rather than a blanket cast.
type Raw = RowDataPacket;

/**
 * True for "table/column not there yet" MySQL errors — the signal that
 * lib/db/account_upgrade.sql has not been hand-applied to this database yet.
 * Accessors for columns/tables introduced by that migration catch this and
 * degrade to a safe fallback instead of throwing, so new code can deploy
 * before the migration is applied (same self-healing pattern as
 * artifacts/api-server/src/lib/holding/store.ts, applied here at the data
 * layer instead of a feature module).
 */
const MISSING_SCHEMA_CODES = new Set(["ER_NO_SUCH_TABLE", "ER_BAD_DB_ERROR", "ER_BAD_FIELD_ERROR"]);
function isMissingSchema(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code != null && MISSING_SCHEMA_CODES.has(code);
}

/** Runs `primary`; if it fails because account_upgrade.sql hasn't landed yet, runs `fallback` instead. */
async function withSchemaFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try {
    return await primary();
  } catch (err) {
    if (!isMissingSchema(err)) throw err;
    return fallback();
  }
}

function toUser(r: Raw): UserRow {
  return {
    id: Number(r["id"]),
    name: String(r["name"]),
    email: String(r["email"]),
    passwordHash: String(r["password_hash"]),
    roleId: Number(r["role_id"]),
    plan: r["plan"] as UserRow["plan"],
    status: r["status"] as UserRow["status"],
    emailVerifiedAt: (r["email_verified_at"] as Date | null) ?? null,
    lastLoginAt: (r["last_login_at"] as Date | null) ?? null,
    tokenVersion: r["token_version"] != null ? Number(r["token_version"]) : 0,
    termsAcceptedAt: (r["terms_accepted_at"] as Date | null) ?? null,
    marketingConsent: Boolean(r["marketing_consent"]),
    createdAt: r["created_at"] as Date,
    updatedAt: r["updated_at"] as Date,
  };
}

function toEmailVerification(r: Raw): EmailVerificationRow {
  return {
    id: Number(r["id"]),
    userId: Number(r["user_id"]),
    tokenHash: String(r["token_hash"]),
    newEmail: (r["new_email"] as string | null) ?? null,
    expiresAt: r["expires_at"] as Date,
    verifiedAt: (r["verified_at"] as Date | null) ?? null,
    createdAt: r["created_at"] as Date,
  };
}

function toSmtpSettings(r: Raw): SmtpSettingsRow {
  return {
    host: (r["host"] as string | null) ?? null,
    port: Number(r["port"]),
    encryption: r["encryption"] as SmtpSettingsRow["encryption"],
    username: (r["username"] as string | null) ?? null,
    passwordEncrypted: (r["password_encrypted"] as string | null) ?? null,
    fromName: String(r["from_name"]),
    fromEmail: (r["from_email"] as string | null) ?? null,
    replyToEmail: (r["reply_to_email"] as string | null) ?? null,
    supportEmail: (r["support_email"] as string | null) ?? null,
    updatedBy: r["updated_by"] != null ? Number(r["updated_by"]) : null,
    updatedAt: r["updated_at"] as Date,
  };
}

function toEmailTemplate(r: Raw): EmailTemplateRow {
  return {
    id: Number(r["id"]),
    templateKey: String(r["template_key"]),
    name: String(r["name"]),
    subject: String(r["subject"]),
    preheader: (r["preheader"] as string | null) ?? null,
    body: String(r["body"]),
    ctaLabel: (r["cta_label"] as string | null) ?? null,
    ctaUrlTemplate: (r["cta_url_template"] as string | null) ?? null,
    footerNote: (r["footer_note"] as string | null) ?? null,
    enabled: Boolean(r["enabled"]),
    createdAt: r["created_at"] as Date,
    updatedAt: r["updated_at"] as Date,
  };
}

function toEmailLog(r: Raw): EmailLogRow {
  return {
    id: Number(r["id"]),
    userId: r["user_id"] != null ? Number(r["user_id"]) : null,
    templateKey: String(r["template_key"]),
    recipient: String(r["recipient"]),
    subject: String(r["subject"]),
    triggerSource: String(r["trigger_source"]),
    status: r["status"] as EmailLogRow["status"],
    failureReason: (r["failure_reason"] as string | null) ?? null,
    createdAt: r["created_at"] as Date,
    sentAt: (r["sent_at"] as Date | null) ?? null,
  };
}

function toPaymentSettings(r: Raw): PaymentSettingsRow {
  return {
    razorpayKeyId: (r["razorpay_key_id"] as string | null) ?? null,
    razorpayKeySecretEncrypted: (r["razorpay_key_secret_encrypted"] as string | null) ?? null,
    razorpayWebhookSecretEncrypted: (r["razorpay_webhook_secret_encrypted"] as string | null) ?? null,
    stripePublishableKey: (r["stripe_publishable_key"] as string | null) ?? null,
    stripeSecretKeyEncrypted: (r["stripe_secret_key_encrypted"] as string | null) ?? null,
    stripeWebhookSecretEncrypted: (r["stripe_webhook_secret_encrypted"] as string | null) ?? null,
    updatedBy: r["updated_by"] != null ? Number(r["updated_by"]) : null,
    updatedAt: r["updated_at"] as Date,
  };
}

function toSubscriptionPlan(r: Raw): SubscriptionPlanRow {
  return {
    id: Number(r["id"]),
    planId: r["plan_id"] as PlanId,
    billingCycle: r["billing_cycle"] as BillingCycle,
    amountInrPaise: Number(r["amount_inr_paise"]),
    amountUsdCents: Number(r["amount_usd_cents"]),
    razorpayPlanId: (r["razorpay_plan_id"] as string | null) ?? null,
    stripePriceId: (r["stripe_price_id"] as string | null) ?? null,
    active: Boolean(r["active"]),
    createdAt: r["created_at"] as Date,
    updatedAt: r["updated_at"] as Date,
  };
}

function toSubscription(r: Raw): SubscriptionRow {
  return {
    id: Number(r["id"]),
    userId: Number(r["user_id"]),
    planId: r["plan_id"] as PlanId,
    billingCycle: r["billing_cycle"] as BillingCycle,
    provider: r["provider"] as PaymentProvider,
    providerSubscriptionId: String(r["provider_subscription_id"]),
    providerCustomerId: (r["provider_customer_id"] as string | null) ?? null,
    status: r["status"] as SubscriptionStatus,
    currentPeriodEnd: (r["current_period_end"] as Date | null) ?? null,
    cancelAtPeriodEnd: Boolean(r["cancel_at_period_end"]),
    createdAt: r["created_at"] as Date,
    updatedAt: r["updated_at"] as Date,
  };
}

function toInvoice(r: Raw): InvoiceRow {
  return {
    id: Number(r["id"]),
    userId: Number(r["user_id"]),
    subscriptionId: r["subscription_id"] != null ? Number(r["subscription_id"]) : null,
    provider: r["provider"] as PaymentProvider,
    providerPaymentId: String(r["provider_payment_id"]),
    providerInvoiceId: (r["provider_invoice_id"] as string | null) ?? null,
    amount: Number(r["amount"]),
    currency: r["currency"] as Currency,
    status: r["status"] as InvoiceStatus,
    invoiceNumber: (r["invoice_number"] as string | null) ?? null,
    paidAt: (r["paid_at"] as Date | null) ?? null,
    createdAt: r["created_at"] as Date,
  };
}

function toPlan(r: Raw): PlanRow {
  return {
    planKey: String(r["plan_key"]),
    name: String(r["name"]),
    description: (r["description"] as string | null) ?? null,
    trialDays: Number(r["trial_days"]),
    displayOrder: Number(r["display_order"]),
    isPopular: Boolean(r["is_popular"]),
    isRecommended: Boolean(r["is_recommended"]),
    status: r["status"] as PlanStatus,
    color: (r["color"] as string | null) ?? null,
    icon: (r["icon"] as string | null) ?? null,
    maxUsers: r["max_users"] != null ? Number(r["max_users"]) : null,
    maxDevices: r["max_devices"] != null ? Number(r["max_devices"]) : null,
    maxWatchlists: r["max_watchlists"] != null ? Number(r["max_watchlists"]) : null,
    maxAlerts: r["max_alerts"] != null ? Number(r["max_alerts"]) : null,
    maxApiCalls: r["max_api_calls"] != null ? Number(r["max_api_calls"]) : null,
    maxAiRequests: r["max_ai_requests"] != null ? Number(r["max_ai_requests"]) : null,
    storageLimitMb: r["storage_limit_mb"] != null ? Number(r["storage_limit_mb"]) : null,
    supportType: (r["support_type"] as string | null) ?? null,
    createdAt: r["created_at"] as Date,
    updatedAt: r["updated_at"] as Date,
  };
}

function toFeatureCategory(r: Raw): FeatureCategoryRow {
  return {
    categoryKey: String(r["category_key"]),
    name: String(r["name"]),
    displayOrder: Number(r["display_order"]),
    icon: (r["icon"] as string | null) ?? null,
  };
}

function toFeature(r: Raw): FeatureRow {
  return {
    featureKey: String(r["feature_key"]),
    name: String(r["name"]),
    description: (r["description"] as string | null) ?? null,
    categoryKey: String(r["category_key"]),
    parentModule: (r["parent_module"] as string | null) ?? null,
    displayOrder: Number(r["display_order"]),
    icon: (r["icon"] as string | null) ?? null,
    status: r["status"] as FeatureStatus,
  };
}

function toPlanFeature(r: Raw): PlanFeatureRow {
  return {
    id: Number(r["id"]),
    planKey: String(r["plan_key"]),
    featureKey: String(r["feature_key"]),
    enabled: Boolean(r["enabled"]),
    usageLimit: r["usage_limit"] != null ? Number(r["usage_limit"]) : null,
    dailyLimit: r["daily_limit"] != null ? Number(r["daily_limit"]) : null,
    monthlyLimit: r["monthly_limit"] != null ? Number(r["monthly_limit"]) : null,
    isUnlimited: Boolean(r["is_unlimited"]),
    visibleInMenu: Boolean(r["visible_in_menu"]),
    comingSoon: Boolean(r["coming_soon"]),
    isBeta: Boolean(r["is_beta"]),
    badge: r["badge"] as FeatureBadge,
    hideCompletely: Boolean(r["hide_completely"]),
    showUpgradeBanner: Boolean(r["show_upgrade_banner"]),
    readOnly: Boolean(r["read_only"]),
    createdAt: r["created_at"] as Date,
    updatedAt: r["updated_at"] as Date,
  };
}

function toUserFeatureUsage(r: Raw): UserFeatureUsageRow {
  return {
    id: Number(r["id"]),
    userId: Number(r["user_id"]),
    featureKey: String(r["feature_key"]),
    period: String(r["period"]),
    count: Number(r["count"]),
    updatedAt: r["updated_at"] as Date,
  };
}

function toSupportTicket(r: Raw): SupportTicketRow {
  return {
    id: Number(r["id"]),
    ticketNumber: (r["ticket_number"] as string | null) ?? null,
    userId: Number(r["user_id"]),
    category: r["category"] as SupportCategory,
    subject: String(r["subject"]),
    description: String(r["description"]),
    priority: r["priority"] as SupportPriority,
    status: r["status"] as SupportStatus,
    assignedAdminId: r["assigned_admin_id"] != null ? Number(r["assigned_admin_id"]) : null,
    createdAt: r["created_at"] as Date,
    updatedAt: r["updated_at"] as Date,
    resolvedAt: (r["resolved_at"] as Date | null) ?? null,
    closedAt: (r["closed_at"] as Date | null) ?? null,
  };
}

function toSupportMessage(r: Raw): SupportMessageRow {
  return {
    id: Number(r["id"]),
    ticketId: Number(r["ticket_id"]),
    authorUserId: Number(r["author_user_id"]),
    isAdminReply: Boolean(r["is_admin_reply"]),
    body: String(r["body"]),
    createdAt: r["created_at"] as Date,
  };
}

function toSupportInternalNote(r: Raw): SupportInternalNoteRow {
  return {
    id: Number(r["id"]),
    ticketId: Number(r["ticket_id"]),
    adminUserId: Number(r["admin_user_id"]),
    body: String(r["body"]),
    createdAt: r["created_at"] as Date,
  };
}

function toLoginHistory(r: Raw): LoginHistoryRow {
  return {
    id: Number(r["id"]),
    userId: Number(r["user_id"]),
    ipAddress: (r["ip_address"] as string | null) ?? null,
    userAgent: (r["user_agent"] as string | null) ?? null,
    status: r["status"] as LoginHistoryRow["status"],
    createdAt: r["created_at"] as Date,
  };
}

function toUserProfile(r: Raw): UserProfileRow {
  return {
    userId: Number(r["user_id"]),
    avatarUrl: (r["avatar_url"] as string | null) ?? null,
    phone: (r["phone"] as string | null) ?? null,
    bio: (r["bio"] as string | null) ?? null,
    timezone: String(r["timezone"]),
    createdAt: r["created_at"] as Date,
    updatedAt: r["updated_at"] as Date,
  };
}

function toNotificationPreferences(r: Raw): NotificationPreferencesRow {
  return {
    userId: Number(r["user_id"]),
    marketAlerts: Boolean(r["market_alerts"]),
    productUpdates: Boolean(r["product_updates"]),
    supportUpdates: Boolean(r["support_updates"]),
    billingUpdates: Boolean(r["billing_updates"]),
    updatedAt: r["updated_at"] as Date,
  };
}

function toRole(r: Raw): RoleRow {
  const joined = r["permissions"];
  return {
    id: Number(r["id"]),
    name: String(r["name"]),
    description: (r["description"] as string | null) ?? null,
    permissions: typeof joined === "string" && joined.length > 0 ? joined.split(",") : [],
    createdAt: r["created_at"] as Date,
  };
}

function toWatchlist(r: Raw): WatchlistRow {
  return {
    id: Number(r["id"]),
    userId: Number(r["user_id"]),
    symbol: String(r["symbol"]),
    addedAt: r["added_at"] as Date,
  };
}

function toPortfolio(r: Raw): PortfolioRow {
  return {
    id: Number(r["id"]),
    userId: Number(r["user_id"]),
    symbol: String(r["symbol"]),
    exchange: String(r["exchange"]),
    buyPrice: r["buy_price"] === null ? null : Number(r["buy_price"]),
    quantity: r["quantity"] === null ? null : Number(r["quantity"]),
    addedAt: r["added_at"] as Date,
  };
}

function toUpstoxSettings(r: Raw): UpstoxSettingsRow {
  return {
    id: Number(r["id"]),
    userId: Number(r["user_id"]),
    apiKey: String(r["api_key"]),
    apiSecret: (r["api_secret"] as string | null) ?? null,
    clientId: (r["client_id"] as string | null) ?? null,
    accessToken: (r["access_token"] as string | null) ?? null,
    liveDataEnabled: Boolean(r["live_data_enabled"]),
    connectedAt: r["connected_at"] as Date,
  };
}

function toPasswordReset(r: Raw): PasswordResetRow {
  return {
    id: Number(r["id"]),
    userId: Number(r["user_id"]),
    tokenHash: String(r["token_hash"]),
    expiresAt: r["expires_at"] as Date,
    usedAt: (r["used_at"] as Date | null) ?? null,
    createdAt: r["created_at"] as Date,
  };
}

/** One stored Holding Stocks pick, joined to the scan that produced it. */
export interface HoldingScanPickRow {
  symbol: string;
  name: string;
  scanPrice: number;
  score: number;
  classification: string;
  riskLevel: string;
  scannedAt: Date;
  universe: string;
}

// ── Query helpers ───────────────────────────────────────────────────────────
const ROLE_SELECT = `
  SELECT r.id, r.name, r.description, r.created_at,
         GROUP_CONCAT(p.name ORDER BY p.id) AS permissions
  FROM roles r
  LEFT JOIN role_permissions rp ON rp.role_id = r.id
  LEFT JOIN permissions p ON p.id = rp.permission_id
`;

export const db = {
  users: {
    async findById(id: number): Promise<UserRow | null> {
      const rows = await query("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
      return rows[0] ? toUser(rows[0]) : null;
    },
    async findByEmail(email: string): Promise<UserRow | null> {
      const rows = await query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
      return rows[0] ? toUser(rows[0]) : null;
    },
    async findByRoleId(roleId: number): Promise<UserRow | null> {
      const rows = await query("SELECT * FROM users WHERE role_id = ? LIMIT 1", [roleId]);
      return rows[0] ? toUser(rows[0]) : null;
    },
    async all(): Promise<UserRow[]> {
      const rows = await query("SELECT * FROM users ORDER BY id");
      return rows.map(toUser);
    },
    /**
     * Returns the AUTO_INCREMENT id of the new row. `termsAcceptedAt` and
     * `marketingConsent` are captured for every new registration; if
     * account_upgrade.sql hasn't been applied yet, they're silently dropped
     * (registration still succeeds) rather than failing every signup.
     */
    async insert(u: {
      name: string;
      email: string;
      passwordHash: string;
      roleId: number;
      plan: UserRow["plan"];
      status: UserRow["status"];
      termsAcceptedAt: Date;
      marketingConsent: boolean;
    }): Promise<number> {
      return withSchemaFallback(
        async () => {
          const res = await execute(
            `INSERT INTO users (name, email, password_hash, role_id, plan, status, terms_accepted_at, marketing_consent)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [u.name, u.email, u.passwordHash, u.roleId, u.plan, u.status, u.termsAcceptedAt, u.marketingConsent],
          );
          return res.insertId;
        },
        async () => {
          const res = await execute(
            `INSERT INTO users (name, email, password_hash, role_id, plan, status)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [u.name, u.email, u.passwordHash, u.roleId, u.plan, u.status],
          );
          return res.insertId;
        },
      );
    },
    async updateName(id: number, name: string): Promise<void> {
      await execute("UPDATE users SET name = ? WHERE id = ?", [name, id]);
    },
    /**
     * Also bumps token_version so previously issued session JWTs stop
     * verifying — this is what makes a password reset/change actually
     * invalidate other sessions instead of just changing the credential.
     * Falls back to a plain update if the migration hasn't landed yet.
     */
    async updatePasswordHash(id: number, passwordHash: string): Promise<void> {
      await withSchemaFallback(
        async () => {
          await execute(
            "UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?",
            [passwordHash, id],
          );
        },
        async () => {
          await execute("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, id]);
        },
      );
    },
    async updateEmail(id: number, email: string): Promise<void> {
      await withSchemaFallback(
        async () => {
          await execute(
            "UPDATE users SET email = ?, email_verified_at = NOW(), token_version = token_version + 1 WHERE id = ?",
            [email, id],
          );
        },
        async () => {
          await execute("UPDATE users SET email = ?, email_verified_at = NOW() WHERE id = ?", [email, id]);
        },
      );
    },
    async markEmailVerified(id: number): Promise<void> {
      await execute("UPDATE users SET email_verified_at = NOW() WHERE id = ?", [id]);
    },
    /** Invalidates every previously issued session JWT without changing the password — "sign out everywhere". */
    async bumpTokenVersion(id: number): Promise<void> {
      try {
        await execute("UPDATE users SET token_version = token_version + 1 WHERE id = ?", [id]);
      } catch (err) {
        if (!isMissingSchema(err)) throw err;
      }
    },
    async updatePlan(id: number, plan: UserRow["plan"]): Promise<void> {
      await execute("UPDATE users SET plan = ? WHERE id = ?", [plan, id]);
    },
    async touchLastLogin(id: number): Promise<void> {
      await execute("UPDATE users SET last_login_at = NOW() WHERE id = ?", [id]);
    },
    async deleteById(id: number): Promise<void> {
      await execute("DELETE FROM users WHERE id = ?", [id]);
    },
  },

  roles: {
    async findById(id: number): Promise<RoleRow | null> {
      const rows = await query(`${ROLE_SELECT} WHERE r.id = ? GROUP BY r.id`, [id]);
      return rows[0] ? toRole(rows[0]) : null;
    },
    async findByName(name: string): Promise<RoleRow | null> {
      const rows = await query(`${ROLE_SELECT} WHERE r.name = ? GROUP BY r.id`, [name]);
      return rows[0] ? toRole(rows[0]) : null;
    },
    async all(): Promise<RoleRow[]> {
      const rows = await query(`${ROLE_SELECT} GROUP BY r.id ORDER BY r.id`);
      return rows.map(toRole);
    },
    async upsert(name: string, description: string): Promise<number> {
      await execute(
        `INSERT INTO roles (name, description) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [name, description],
      );
      const row = await this.findByName(name);
      return row!.id;
    },
    /** Replaces the role's permission set, creating any missing permissions. */
    async setPermissions(roleId: number, names: readonly string[]): Promise<void> {
      await execute("DELETE FROM role_permissions WHERE role_id = ?", [roleId]);
      if (names.length === 0) return;
      for (const name of names) {
        await execute(
          `INSERT INTO permissions (name) VALUES (?)
           ON DUPLICATE KEY UPDATE name = VALUES(name)`,
          [name],
        );
      }
      const placeholders = names.map(() => "?").join(", ");
      await execute(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT ?, id FROM permissions WHERE name IN (${placeholders})`,
        [roleId, ...names],
      );
    },
    async describePermission(name: string, description: string): Promise<void> {
      await execute(
        `INSERT INTO permissions (name, description) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [name, description],
      );
    },
  },

  watchlist: {
    async findByUser(userId: number): Promise<WatchlistRow[]> {
      const rows = await query(
        "SELECT * FROM watchlist WHERE user_id = ? ORDER BY added_at",
        [userId],
      );
      return rows.map(toWatchlist);
    },
    async findOne(userId: number, symbol: string): Promise<WatchlistRow | null> {
      const rows = await query(
        "SELECT * FROM watchlist WHERE user_id = ? AND symbol = ? LIMIT 1",
        [userId, symbol],
      );
      return rows[0] ? toWatchlist(rows[0]) : null;
    },
    async insert(userId: number, symbol: string): Promise<WatchlistRow> {
      const res = await execute("INSERT INTO watchlist (user_id, symbol) VALUES (?, ?)", [
        userId,
        symbol,
      ]);
      const rows = await query("SELECT * FROM watchlist WHERE id = ?", [res.insertId]);
      return toWatchlist(rows[0]!);
    },
    async remove(userId: number, symbol: string): Promise<void> {
      await execute("DELETE FROM watchlist WHERE user_id = ? AND symbol = ?", [userId, symbol]);
    },
  },

  portfolio: {
    async findByUser(userId: number): Promise<PortfolioRow[]> {
      const rows = await query(
        "SELECT * FROM portfolio WHERE user_id = ? ORDER BY added_at",
        [userId],
      );
      return rows.map(toPortfolio);
    },
    async findOne(userId: number, symbol: string): Promise<PortfolioRow | null> {
      const rows = await query(
        "SELECT * FROM portfolio WHERE user_id = ? AND symbol = ? LIMIT 1",
        [userId, symbol],
      );
      return rows[0] ? toPortfolio(rows[0]) : null;
    },
    async insert(p: {
      userId: number;
      symbol: string;
      exchange: string;
      buyPrice: number | null;
      quantity: number | null;
    }): Promise<PortfolioRow> {
      const res = await execute(
        `INSERT INTO portfolio (user_id, symbol, exchange, buy_price, quantity)
         VALUES (?, ?, ?, ?, ?)`,
        [p.userId, p.symbol, p.exchange, p.buyPrice, p.quantity],
      );
      const rows = await query("SELECT * FROM portfolio WHERE id = ?", [res.insertId]);
      return toPortfolio(rows[0]!);
    },
    async remove(userId: number, symbol: string): Promise<void> {
      await execute("DELETE FROM portfolio WHERE user_id = ? AND symbol = ?", [userId, symbol]);
    },
  },

  upstoxSettings: {
    async findByUser(userId: number): Promise<UpstoxSettingsRow | null> {
      const rows = await query("SELECT * FROM upstox_settings WHERE user_id = ? LIMIT 1", [userId]);
      return rows[0] ? toUpstoxSettings(rows[0]) : null;
    },
    /** Most recently connected account, used for the shared server-side token. */
    async findLatest(): Promise<UpstoxSettingsRow | null> {
      const rows = await query("SELECT * FROM upstox_settings ORDER BY connected_at DESC LIMIT 1");
      return rows[0] ? toUpstoxSettings(rows[0]) : null;
    },
    async replace(s: {
      userId: number;
      apiKey: string;
      apiSecret: string | null;
      clientId: string | null;
      accessToken: string | null;
    }): Promise<UpstoxSettingsRow> {
      await execute("DELETE FROM upstox_settings WHERE user_id = ?", [s.userId]);
      const res = await execute(
        `INSERT INTO upstox_settings (user_id, api_key, api_secret, client_id, access_token)
         VALUES (?, ?, ?, ?, ?)`,
        [s.userId, s.apiKey, s.apiSecret, s.clientId, s.accessToken],
      );
      const rows = await query("SELECT * FROM upstox_settings WHERE id = ?", [res.insertId]);
      return toUpstoxSettings(rows[0]!);
    },
    async removeForUser(userId: number): Promise<void> {
      await execute("DELETE FROM upstox_settings WHERE user_id = ?", [userId]);
    },
  },

  loginHistory: {
    async record(entry: {
      userId: number;
      ipAddress: string | null;
      userAgent: string | null;
      status: LoginHistoryRow["status"];
    }): Promise<void> {
      await execute(
        `INSERT INTO login_history (user_id, ip_address, user_agent, status)
         VALUES (?, ?, ?, ?)`,
        [entry.userId, entry.ipAddress, entry.userAgent, entry.status],
      );
    },
    /** IP of the user's most recent successful login, if any — used to detect a new-location sign-in. */
    async lastSuccessIp(userId: number): Promise<string | null> {
      const rows = await query(
        "SELECT ip_address FROM login_history WHERE user_id = ? AND status = 'success' ORDER BY created_at DESC LIMIT 1",
        [userId],
      );
      return rows[0] ? ((rows[0]["ip_address"] as string | null) ?? null) : null;
    },
    async recentForUser(userId: number, limit: number): Promise<LoginHistoryRow[]> {
      const rows = await query(
        "SELECT * FROM login_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
        [userId, limit],
      );
      return rows.map(toLoginHistory);
    },
  },

  userProfiles: {
    async get(userId: number): Promise<UserProfileRow | null> {
      const rows = await query("SELECT * FROM user_profiles WHERE user_id = ? LIMIT 1", [userId]);
      return rows[0] ? toUserProfile(rows[0]) : null;
    },
    /** Upserts only the fields provided — omit a field to leave it unchanged. */
    async upsert(
      userId: number,
      p: { avatarUrl?: string | null; phone?: string | null; bio?: string | null; timezone?: string },
    ): Promise<UserProfileRow> {
      const existingRows = await query("SELECT * FROM user_profiles WHERE user_id = ? LIMIT 1", [userId]);
      if (existingRows.length === 0) {
        await execute(
          `INSERT INTO user_profiles (user_id, avatar_url, phone, bio, timezone) VALUES (?, ?, ?, ?, ?)`,
          [userId, p.avatarUrl ?? null, p.phone ?? null, p.bio ?? null, p.timezone ?? "Asia/Kolkata"],
        );
      } else {
        const current = toUserProfile(existingRows[0]!);
        await execute(
          "UPDATE user_profiles SET avatar_url = ?, phone = ?, bio = ?, timezone = ? WHERE user_id = ?",
          [
            p.avatarUrl !== undefined ? p.avatarUrl : current.avatarUrl,
            p.phone !== undefined ? p.phone : current.phone,
            p.bio !== undefined ? p.bio : current.bio,
            p.timezone !== undefined ? p.timezone : current.timezone,
            userId,
          ],
        );
      }
      const rows = await query("SELECT * FROM user_profiles WHERE user_id = ? LIMIT 1", [userId]);
      return toUserProfile(rows[0]!);
    },
  },

  notificationPreferences: {
    async get(userId: number): Promise<NotificationPreferencesRow> {
      const defaults: NotificationPreferencesRow = {
        userId, marketAlerts: true, productUpdates: true, supportUpdates: true, billingUpdates: true,
        updatedAt: new Date(),
      };
      return withSchemaFallback(
        async () => {
          const rows = await query(
            "SELECT * FROM user_notification_preferences WHERE user_id = ? LIMIT 1",
            [userId],
          );
          return rows[0] ? toNotificationPreferences(rows[0]) : defaults;
        },
        async () => defaults,
      );
    },
    /** Returns false only if account_profile.sql hasn't been applied yet. */
    async upsert(
      userId: number,
      p: { marketAlerts: boolean; productUpdates: boolean; supportUpdates: boolean; billingUpdates: boolean },
    ): Promise<boolean> {
      return withSchemaFallback(
        async () => {
          await execute(
            `INSERT INTO user_notification_preferences
               (user_id, market_alerts, product_updates, support_updates, billing_updates)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE market_alerts=VALUES(market_alerts), product_updates=VALUES(product_updates),
               support_updates=VALUES(support_updates), billing_updates=VALUES(billing_updates)`,
            [userId, p.marketAlerts, p.productUpdates, p.supportUpdates, p.billingUpdates],
          );
          return true;
        },
        async () => false,
      );
    },
  },

  passwordResets: {
    async findUnusedByTokenHash(tokenHash: string): Promise<PasswordResetRow | null> {
      const rows = await query(
        "SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL LIMIT 1",
        [tokenHash],
      );
      return rows[0] ? toPasswordReset(rows[0]) : null;
    },
    async insert(r: { userId: number; tokenHash: string; expiresAt: Date }): Promise<void> {
      await execute(
        "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
        [r.userId, r.tokenHash, r.expiresAt],
      );
    },
    async markUsed(id: number): Promise<void> {
      await execute("UPDATE password_resets SET used_at = NOW() WHERE id = ?", [id]);
    },
    async clearOutstanding(userId: number): Promise<void> {
      await execute("DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL", [userId]);
    },
    /** MySQL has no TTL index, so expired rows are swept on demand. */
    async purgeExpired(): Promise<void> {
      await execute("DELETE FROM password_resets WHERE expires_at < NOW()");
    },
  },

  emailVerifications: {
    async findUnusedByTokenHash(tokenHash: string): Promise<EmailVerificationRow | null> {
      const rows = await query(
        "SELECT * FROM email_verifications WHERE token_hash = ? AND verified_at IS NULL LIMIT 1",
        [tokenHash],
      );
      return rows[0] ? toEmailVerification(rows[0]) : null;
    },
    /**
     * Creates a verification token. `newEmail: null` means "verify the
     * account's current email"; a non-null value means "confirm a pending
     * change to this new address". Returns false only when an email-change
     * token was requested but account_upgrade.sql (the new_email column)
     * hasn't been applied yet — verify-current-email tokens always work,
     * falling back to the pre-migration column set.
     */
    async insert(r: {
      userId: number;
      tokenHash: string;
      expiresAt: Date;
      newEmail?: string | null;
    }): Promise<boolean> {
      const newEmail = r.newEmail ?? null;
      return withSchemaFallback(
        async () => {
          await execute(
            "INSERT INTO email_verifications (user_id, token_hash, expires_at, new_email) VALUES (?, ?, ?, ?)",
            [r.userId, r.tokenHash, r.expiresAt, newEmail],
          );
          return true;
        },
        async () => {
          if (newEmail !== null) return false;
          await execute(
            "INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
            [r.userId, r.tokenHash, r.expiresAt],
          );
          return true;
        },
      );
    },
    async markVerified(id: number): Promise<void> {
      await execute("UPDATE email_verifications SET verified_at = NOW() WHERE id = ?", [id]);
    },
    /** Clears outstanding tokens of one kind, so requesting a new one invalidates the old. */
    async clearOutstanding(userId: number, kind: "verify" | "change-email"): Promise<void> {
      const emailFilter = kind === "verify" ? "new_email IS NULL" : "new_email IS NOT NULL";
      await withSchemaFallback(
        async () => {
          await execute(
            `DELETE FROM email_verifications WHERE user_id = ? AND verified_at IS NULL AND ${emailFilter}`,
            [userId],
          );
        },
        async () => {
          if (kind !== "verify") return;
          await execute(
            "DELETE FROM email_verifications WHERE user_id = ? AND verified_at IS NULL",
            [userId],
          );
        },
      );
    },
    async purgeExpired(): Promise<void> {
      await execute("DELETE FROM email_verifications WHERE expires_at < NOW()");
    },
  },

  smtpSettings: {
    async get(): Promise<SmtpSettingsRow | null> {
      return withSchemaFallback(
        async () => {
          const rows = await query("SELECT * FROM smtp_settings WHERE id = 1 LIMIT 1");
          return rows[0] ? toSmtpSettings(rows[0]) : null;
        },
        async () => null,
      );
    },
    /**
     * Upserts the singleton settings row. Omit `passwordEncrypted` to leave
     * the currently stored secret untouched (used when the admin saves the
     * form without re-entering the password).
     */
    async upsert(s: {
      host: string | null;
      port: number;
      encryption: SmtpSettingsRow["encryption"];
      username: string | null;
      passwordEncrypted?: string;
      fromName: string;
      fromEmail: string | null;
      replyToEmail: string | null;
      supportEmail: string | null;
      updatedBy: number | null;
    }): Promise<void> {
      if (s.passwordEncrypted === undefined) {
        await execute(
          `INSERT INTO smtp_settings (id, host, port, encryption, username, from_name, from_email, reply_to_email, support_email, updated_by)
           VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE host=VALUES(host), port=VALUES(port), encryption=VALUES(encryption),
             username=VALUES(username), from_name=VALUES(from_name), from_email=VALUES(from_email),
             reply_to_email=VALUES(reply_to_email), support_email=VALUES(support_email), updated_by=VALUES(updated_by)`,
          [s.host, s.port, s.encryption, s.username, s.fromName, s.fromEmail, s.replyToEmail, s.supportEmail, s.updatedBy],
        );
        return;
      }
      await execute(
        `INSERT INTO smtp_settings (id, host, port, encryption, username, password_encrypted, from_name, from_email, reply_to_email, support_email, updated_by)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE host=VALUES(host), port=VALUES(port), encryption=VALUES(encryption),
           username=VALUES(username), password_encrypted=VALUES(password_encrypted), from_name=VALUES(from_name),
           from_email=VALUES(from_email), reply_to_email=VALUES(reply_to_email), support_email=VALUES(support_email),
           updated_by=VALUES(updated_by)`,
        [s.host, s.port, s.encryption, s.username, s.passwordEncrypted, s.fromName, s.fromEmail, s.replyToEmail, s.supportEmail, s.updatedBy],
      );
    },
  },

  emailTemplates: {
    async all(): Promise<EmailTemplateRow[]> {
      return withSchemaFallback(
        async () => {
          const rows = await query("SELECT * FROM email_templates ORDER BY id");
          return rows.map(toEmailTemplate);
        },
        async () => [],
      );
    },
    async findByKey(key: string): Promise<EmailTemplateRow | null> {
      return withSchemaFallback(
        async () => {
          const rows = await query("SELECT * FROM email_templates WHERE template_key = ? LIMIT 1", [key]);
          return rows[0] ? toEmailTemplate(rows[0]) : null;
        },
        async () => null,
      );
    },
    async update(
      key: string,
      fields: {
        name?: string;
        subject?: string;
        preheader?: string | null;
        body?: string;
        ctaLabel?: string | null;
        ctaUrlTemplate?: string | null;
        footerNote?: string | null;
        enabled?: boolean;
      },
    ): Promise<void> {
      const columnMap: Record<string, unknown> = {
        name: fields.name,
        subject: fields.subject,
        preheader: fields.preheader,
        body: fields.body,
        cta_label: fields.ctaLabel,
        cta_url_template: fields.ctaUrlTemplate,
        footer_note: fields.footerNote,
        enabled: fields.enabled,
      };
      const setClauses: string[] = [];
      const params: SqlParam[] = [];
      for (const [column, value] of Object.entries(columnMap)) {
        if (value === undefined) continue;
        setClauses.push(`${column} = ?`);
        params.push(value as SqlParam);
      }
      if (setClauses.length === 0) return;
      params.push(key);
      await execute(`UPDATE email_templates SET ${setClauses.join(", ")} WHERE template_key = ?`, params);
    },
  },

  emailLogs: {
    /** Returns the new row's id, or null if email_logs isn't migrated yet (logging is best-effort). */
    async insert(e: {
      userId: number | null;
      templateKey: string;
      recipient: string;
      subject: string;
      triggerSource: string;
    }): Promise<number | null> {
      return withSchemaFallback(
        async () => {
          const res = await execute(
            `INSERT INTO email_logs (user_id, template_key, recipient, subject, trigger_source, status)
             VALUES (?, ?, ?, ?, ?, 'pending')`,
            [e.userId, e.templateKey, e.recipient, e.subject, e.triggerSource],
          );
          return res.insertId;
        },
        async () => null,
      );
    },
    async markSent(id: number | null): Promise<void> {
      if (id == null) return;
      await execute("UPDATE email_logs SET status = 'sent', sent_at = NOW() WHERE id = ?", [id]);
    },
    async markFailed(id: number | null, reason: string): Promise<void> {
      if (id == null) return;
      await execute("UPDATE email_logs SET status = 'failed', failure_reason = ? WHERE id = ?", [
        reason.slice(0, 500),
        id,
      ]);
    },
    async search(filters: {
      q?: string;
      templateKey?: string;
      status?: EmailLogRow["status"];
      userId?: number;
      from?: Date;
      to?: Date;
      limit?: number;
    }): Promise<EmailLogRow[]> {
      const clauses: string[] = [];
      const params: SqlParam[] = [];
      if (filters.q) {
        clauses.push("(recipient LIKE ? OR subject LIKE ?)");
        params.push(`%${filters.q}%`, `%${filters.q}%`);
      }
      if (filters.templateKey) {
        clauses.push("template_key = ?");
        params.push(filters.templateKey);
      }
      if (filters.status) {
        clauses.push("status = ?");
        params.push(filters.status);
      }
      if (filters.userId) {
        clauses.push("user_id = ?");
        params.push(filters.userId);
      }
      if (filters.from) {
        clauses.push("created_at >= ?");
        params.push(filters.from);
      }
      if (filters.to) {
        clauses.push("created_at <= ?");
        params.push(filters.to);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
      params.push(limit);

      return withSchemaFallback(
        async () => {
          const rows = await query(
            `SELECT * FROM email_logs ${where} ORDER BY created_at DESC LIMIT ?`,
            params,
          );
          return rows.map(toEmailLog);
        },
        async () => [],
      );
    },
  },

  /**
   * Holding Stocks scan history. Schema lives in lib/db/holding_stocks.sql and
   * is applied by hand like the rest of this project's DDL — callers are
   * expected to tolerate these tables being absent.
   */
  holdingScans: {
    /** Idempotent per (universe, scanned_at) so a repeated scan updates in place. */
    async upsertScan(s: {
      universe: string;
      scannedAt: Date;
      pickCount: number;
    }): Promise<number> {
      await execute(
        `INSERT INTO holding_scans (universe, scanned_at, pick_count)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE pick_count = VALUES(pick_count)`,
        [s.universe, s.scannedAt, s.pickCount],
      );
      const rows = await query(
        "SELECT id FROM holding_scans WHERE universe = ? AND scanned_at = ? LIMIT 1",
        [s.universe, s.scannedAt],
      );
      return Number(rows[0]!["id"]);
    },

    async upsertPick(p: {
      scanId: number;
      symbol: string;
      name: string;
      scanPrice: number;
      score: number;
      scoreComponents: string;
      classification: string;
      riskLevel: string;
      reasons: string;
    }): Promise<void> {
      await execute(
        `INSERT INTO holding_scan_picks
           (scan_id, symbol, name, scan_price, score, score_components,
            classification, risk_level, reasons)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           scan_price = VALUES(scan_price),
           score = VALUES(score),
           score_components = VALUES(score_components),
           classification = VALUES(classification),
           risk_level = VALUES(risk_level),
           reasons = VALUES(reasons)`,
        [
          p.scanId, p.symbol, p.name, p.scanPrice, p.score, p.scoreComponents,
          p.classification, p.riskLevel, p.reasons,
        ],
      );
    },

    /**
     * Drop any pick still attached to this scan that is no longer in its list.
     *
     * A re-scan of the same boundary can produce a different top ten — a stock
     * that fell out must not linger. Without this the upserts only ever add, so
     * one scan date accumulates every symbol it has ever picked.
     */
    async deleteStalePicks(scanId: number, keepSymbols: string[]): Promise<void> {
      if (keepSymbols.length === 0) {
        await execute("DELETE FROM holding_scan_picks WHERE scan_id = ?", [scanId]);
        return;
      }
      const placeholders = keepSymbols.map(() => "?").join(", ");
      await execute(
        `DELETE FROM holding_scan_picks WHERE scan_id = ? AND symbol NOT IN (${placeholders})`,
        [scanId, ...keepSymbols],
      );
    },

    /** Symbols picked by the most recent scan strictly before `before`. */
    async previousScanSymbols(universe: string, before: Date): Promise<string[]> {
      const rows = await query(
        `SELECT p.symbol
         FROM holding_scan_picks p
         JOIN holding_scans s ON s.id = p.scan_id
         WHERE s.universe = ?
           AND s.scanned_at = (
             SELECT MAX(scanned_at) FROM holding_scans
             WHERE universe = ? AND scanned_at < ?
           )`,
        [universe, universe, before],
      );
      return rows.map((r) => String(r["symbol"]));
    },

    async recentPicks(limit: number): Promise<HoldingScanPickRow[]> {
      const rows = await query(
        `SELECT p.symbol, p.name, p.scan_price, p.score, p.classification,
                p.risk_level, s.scanned_at, s.universe
         FROM holding_scan_picks p
         JOIN holding_scans s ON s.id = p.scan_id
         ORDER BY s.scanned_at DESC, p.score DESC
         LIMIT ?`,
        [limit],
      );
      return rows.map((r) => ({
        symbol: String(r["symbol"]),
        name: String(r["name"]),
        scanPrice: Number(r["scan_price"]),
        score: Number(r["score"]),
        classification: String(r["classification"]),
        riskLevel: String(r["risk_level"]),
        scannedAt: r["scanned_at"] as Date,
        universe: String(r["universe"]),
      }));
    },
  },

  /**
   * Support Ticket Center. Schema lives in lib/db/support_center.sql,
   * applied by hand like every other schema change in this project. Only the
   * entry points a route can reach *before* confirming a ticket exists
   * (create/list/search/counts) degrade gracefully — once a ticket lookup
   * has succeeded the tables are known to exist, so replies/notes/status
   * updates don't re-check.
   */
  supportTickets: {
    async insert(t: {
      userId: number;
      category: SupportCategory;
      subject: string;
      description: string;
      priority: SupportPriority;
    }): Promise<SupportTicketRow | null> {
      return withSchemaFallback(
        async () => {
          const res = await execute(
            `INSERT INTO support_tickets (user_id, category, subject, description, priority)
             VALUES (?, ?, ?, ?, ?)`,
            [t.userId, t.category, t.subject, t.description, t.priority],
          );
          // Derived from the row's own id, so it's unique with no extra
          // round-trip or counter table — ticket_number is display-only.
          const ticketNumber = `MP-${new Date().getFullYear()}-${String(res.insertId).padStart(6, "0")}`;
          await execute("UPDATE support_tickets SET ticket_number = ? WHERE id = ?", [ticketNumber, res.insertId]);
          const rows = await query("SELECT * FROM support_tickets WHERE id = ?", [res.insertId]);
          return toSupportTicket(rows[0]!);
        },
        async () => null,
      );
    },
    async findById(id: number): Promise<SupportTicketRow | null> {
      return withSchemaFallback(
        async () => {
          const rows = await query("SELECT * FROM support_tickets WHERE id = ? LIMIT 1", [id]);
          return rows[0] ? toSupportTicket(rows[0]) : null;
        },
        async () => null,
      );
    },
    async findByUser(userId: number, status?: SupportStatus): Promise<SupportTicketRow[]> {
      return withSchemaFallback(
        async () => {
          const rows = status
            ? await query(
                "SELECT * FROM support_tickets WHERE user_id = ? AND status = ? ORDER BY created_at DESC",
                [userId, status],
              )
            : await query("SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC", [userId]);
          return rows.map(toSupportTicket);
        },
        async () => [],
      );
    },
    async search(filters: {
      status?: SupportStatus;
      category?: SupportCategory;
      priority?: SupportPriority;
      assignedAdminId?: number;
      q?: string;
      limit?: number;
    }): Promise<SupportTicketRow[]> {
      return withSchemaFallback(
        async () => {
          const clauses: string[] = [];
          const params: SqlParam[] = [];
          if (filters.status) {
            clauses.push("status = ?");
            params.push(filters.status);
          }
          if (filters.category) {
            clauses.push("category = ?");
            params.push(filters.category);
          }
          if (filters.priority) {
            clauses.push("priority = ?");
            params.push(filters.priority);
          }
          if (filters.assignedAdminId) {
            clauses.push("assigned_admin_id = ?");
            params.push(filters.assignedAdminId);
          }
          if (filters.q) {
            clauses.push("(subject LIKE ? OR ticket_number LIKE ?)");
            params.push(`%${filters.q}%`, `%${filters.q}%`);
          }
          const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
          const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
          params.push(limit);
          const rows = await query(
            `SELECT * FROM support_tickets ${where} ORDER BY created_at DESC LIMIT ?`,
            params,
          );
          return rows.map(toSupportTicket);
        },
        async () => [],
      );
    },
    async counts(): Promise<{
      open: number;
      waitingAdmin: number;
      waitingUser: number;
      resolvedToday: number;
      total: number;
    }> {
      return withSchemaFallback(
        async () => {
          const rows = await query("SELECT status, COUNT(*) as c FROM support_tickets GROUP BY status");
          const byStatus: Record<string, number> = {};
          for (const r of rows) byStatus[String(r["status"])] = Number(r["c"]);
          const resolvedTodayRows = await query(
            "SELECT COUNT(*) as c FROM support_tickets WHERE status = 'resolved' AND DATE(resolved_at) = CURDATE()",
          );
          return {
            open: byStatus["open"] ?? 0,
            waitingAdmin: byStatus["waiting_admin"] ?? 0,
            waitingUser: byStatus["waiting_user"] ?? 0,
            resolvedToday: Number(resolvedTodayRows[0]?.["c"] ?? 0),
            total: Object.values(byStatus).reduce((a, b) => a + b, 0),
          };
        },
        async () => ({ open: 0, waitingAdmin: 0, waitingUser: 0, resolvedToday: 0, total: 0 }),
      );
    },
    async updateStatus(id: number, status: SupportStatus): Promise<void> {
      const extra =
        status === "resolved" ? ", resolved_at = NOW()" : status === "closed" ? ", closed_at = NOW()" : "";
      await execute(`UPDATE support_tickets SET status = ?${extra} WHERE id = ?`, [status, id]);
    },
    async updatePriority(id: number, priority: SupportPriority): Promise<void> {
      await execute("UPDATE support_tickets SET priority = ? WHERE id = ?", [priority, id]);
    },
    async assign(id: number, adminId: number | null): Promise<void> {
      await execute("UPDATE support_tickets SET assigned_admin_id = ? WHERE id = ?", [adminId, id]);
    },
  },

  supportMessages: {
    async insert(m: {
      ticketId: number;
      authorUserId: number;
      isAdminReply: boolean;
      body: string;
    }): Promise<SupportMessageRow> {
      const res = await execute(
        "INSERT INTO support_messages (ticket_id, author_user_id, is_admin_reply, body) VALUES (?, ?, ?, ?)",
        [m.ticketId, m.authorUserId, m.isAdminReply, m.body],
      );
      const rows = await query("SELECT * FROM support_messages WHERE id = ?", [res.insertId]);
      return toSupportMessage(rows[0]!);
    },
    async findByTicket(ticketId: number): Promise<SupportMessageRow[]> {
      const rows = await query(
        "SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC",
        [ticketId],
      );
      return rows.map(toSupportMessage);
    },
  },

  supportInternalNotes: {
    async insert(n: { ticketId: number; adminUserId: number; body: string }): Promise<SupportInternalNoteRow> {
      const res = await execute(
        "INSERT INTO support_internal_notes (ticket_id, admin_user_id, body) VALUES (?, ?, ?)",
        [n.ticketId, n.adminUserId, n.body],
      );
      const rows = await query("SELECT * FROM support_internal_notes WHERE id = ?", [res.insertId]);
      return toSupportInternalNote(rows[0]!);
    },
    async findByTicket(ticketId: number): Promise<SupportInternalNoteRow[]> {
      const rows = await query(
        "SELECT * FROM support_internal_notes WHERE ticket_id = ? ORDER BY created_at ASC",
        [ticketId],
      );
      return rows.map(toSupportInternalNote);
    },
  },

  supportAssignments: {
    async insert(a: { ticketId: number; adminUserId: number; assignedBy: number }): Promise<void> {
      await execute(
        "INSERT INTO support_assignments (ticket_id, admin_user_id, assigned_by) VALUES (?, ?, ?)",
        [a.ticketId, a.adminUserId, a.assignedBy],
      );
    },
  },

  /**
   * Razorpay/Stripe API credentials. Schema lives in lib/db/payment_gateway.sql,
   * same DB-stored-encrypted-secret singleton shape as smtpSettings — callers
   * encrypt secrets before they ever reach this module.
   */
  paymentSettings: {
    async get(): Promise<PaymentSettingsRow | null> {
      return withSchemaFallback(
        async () => {
          const rows = await query("SELECT * FROM payment_settings WHERE id = 1 LIMIT 1");
          return rows[0] ? toPaymentSettings(rows[0]) : null;
        },
        async () => null,
      );
    },
    /**
     * Upserts the singleton settings row. Omit any `*Encrypted` field to leave
     * that currently stored secret untouched (used when the admin saves the
     * form without re-entering it) — generalizes smtpSettings.upsert's
     * single-optional-field branch to this table's four independent secrets.
     */
    async upsert(s: {
      razorpayKeyId: string | null;
      razorpayKeySecretEncrypted?: string;
      razorpayWebhookSecretEncrypted?: string;
      stripePublishableKey: string | null;
      stripeSecretKeyEncrypted?: string;
      stripeWebhookSecretEncrypted?: string;
      updatedBy: number | null;
    }): Promise<void> {
      const cols = ["id", "razorpay_key_id", "stripe_publishable_key", "updated_by"];
      const vals: SqlParam[] = [1, s.razorpayKeyId, s.stripePublishableKey, s.updatedBy];
      const updates = [
        "razorpay_key_id = VALUES(razorpay_key_id)",
        "stripe_publishable_key = VALUES(stripe_publishable_key)",
        "updated_by = VALUES(updated_by)",
      ];

      const optional: [string, string | undefined][] = [
        ["razorpay_key_secret_encrypted", s.razorpayKeySecretEncrypted],
        ["razorpay_webhook_secret_encrypted", s.razorpayWebhookSecretEncrypted],
        ["stripe_secret_key_encrypted", s.stripeSecretKeyEncrypted],
        ["stripe_webhook_secret_encrypted", s.stripeWebhookSecretEncrypted],
      ];
      for (const [col, val] of optional) {
        if (val === undefined) continue;
        cols.push(col);
        vals.push(val);
        updates.push(`${col} = VALUES(${col})`);
      }

      await execute(
        `INSERT INTO payment_settings (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})
         ON DUPLICATE KEY UPDATE ${updates.join(", ")}`,
        vals,
      );
    },
  },

  /**
   * Pro/Premium pricing catalog. The app never calls a provider's "create
   * plan/price" API — an admin creates the Plan on Razorpay / Price on Stripe
   * by hand and pastes the id here, then this table is what checkout reads.
   */
  subscriptionPlans: {
    async all(): Promise<SubscriptionPlanRow[]> {
      return withSchemaFallback(
        async () => {
          const rows = await query("SELECT * FROM subscription_plans ORDER BY plan_id, billing_cycle");
          return rows.map(toSubscriptionPlan);
        },
        async () => [],
      );
    },
    async findByPlanCycle(planId: PlanId, billingCycle: BillingCycle): Promise<SubscriptionPlanRow | null> {
      return withSchemaFallback(
        async () => {
          const rows = await query(
            "SELECT * FROM subscription_plans WHERE plan_id = ? AND billing_cycle = ? LIMIT 1",
            [planId, billingCycle],
          );
          return rows[0] ? toSubscriptionPlan(rows[0]) : null;
        },
        async () => null,
      );
    },
    /**
     * Creates a zero-amount/inactive row for a (planId, billingCycle) combo
     * if one doesn't exist yet — needed once `plans` is admin-extensible
     * (MP-PLAN-001): a newly created plan has no pricing row until an admin
     * sets one via `update()`, and `update()` alone is a no-op against a
     * missing row (its dynamic SET clause has nothing to attach a WHERE to).
     */
    async ensureRow(planId: PlanId, billingCycle: BillingCycle): Promise<void> {
      await execute(
        "INSERT IGNORE INTO subscription_plans (plan_id, billing_cycle) VALUES (?, ?)",
        [planId, billingCycle],
      );
    },
    async update(
      planId: PlanId,
      billingCycle: BillingCycle,
      fields: {
        amountInrPaise?: number;
        amountUsdCents?: number;
        razorpayPlanId?: string | null;
        stripePriceId?: string | null;
        active?: boolean;
      },
    ): Promise<void> {
      const sets: string[] = [];
      const vals: SqlParam[] = [];
      if (fields.amountInrPaise !== undefined) { sets.push("amount_inr_paise = ?"); vals.push(fields.amountInrPaise); }
      if (fields.amountUsdCents !== undefined) { sets.push("amount_usd_cents = ?"); vals.push(fields.amountUsdCents); }
      if (fields.razorpayPlanId !== undefined) { sets.push("razorpay_plan_id = ?"); vals.push(fields.razorpayPlanId); }
      if (fields.stripePriceId !== undefined) { sets.push("stripe_price_id = ?"); vals.push(fields.stripePriceId); }
      if (fields.active !== undefined) { sets.push("active = ?"); vals.push(fields.active); }
      if (sets.length === 0) return;
      vals.push(planId, billingCycle);
      await execute(
        `UPDATE subscription_plans SET ${sets.join(", ")} WHERE plan_id = ? AND billing_cycle = ?`,
        vals,
      );
    },
  },

  subscriptions: {
    async insert(s: {
      userId: number;
      planId: PlanId;
      billingCycle: BillingCycle;
      provider: PaymentProvider;
      providerSubscriptionId: string;
      providerCustomerId: string | null;
      status: SubscriptionStatus;
    }): Promise<SubscriptionRow> {
      const res = await execute(
        `INSERT INTO subscriptions
           (user_id, plan_id, billing_cycle, provider, provider_subscription_id, provider_customer_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [s.userId, s.planId, s.billingCycle, s.provider, s.providerSubscriptionId, s.providerCustomerId, s.status],
      );
      const rows = await query("SELECT * FROM subscriptions WHERE id = ?", [res.insertId]);
      return toSubscription(rows[0]!);
    },
    async findByProviderSubscriptionId(
      provider: PaymentProvider,
      providerSubscriptionId: string,
    ): Promise<SubscriptionRow | null> {
      const rows = await query(
        "SELECT * FROM subscriptions WHERE provider = ? AND provider_subscription_id = ? LIMIT 1",
        [provider, providerSubscriptionId],
      );
      return rows[0] ? toSubscription(rows[0]) : null;
    },
    /** Most recent non-expired subscription for a user — there is no "current subscription" pointer on `users`. */
    async findCurrentForUser(userId: number): Promise<SubscriptionRow | null> {
      return withSchemaFallback(
        async () => {
          const rows = await query(
            `SELECT * FROM subscriptions WHERE user_id = ? AND status != 'expired'
             ORDER BY created_at DESC LIMIT 1`,
            [userId],
          );
          return rows[0] ? toSubscription(rows[0]) : null;
        },
        async () => null,
      );
    },
    async updateStatus(id: number, status: SubscriptionStatus, currentPeriodEnd?: Date | null): Promise<void> {
      if (currentPeriodEnd !== undefined) {
        await execute(
          "UPDATE subscriptions SET status = ?, current_period_end = ? WHERE id = ?",
          [status, currentPeriodEnd, id],
        );
      } else {
        await execute("UPDATE subscriptions SET status = ? WHERE id = ?", [status, id]);
      }
    },
    async setCancelAtPeriodEnd(id: number, cancel: boolean): Promise<void> {
      await execute("UPDATE subscriptions SET cancel_at_period_end = ? WHERE id = ?", [cancel, id]);
    },
    /**
     * Stripe Checkout Sessions don't carry a real subscription id until
     * payment completes, so `insert()` stores the session id as a placeholder
     * `provider_subscription_id` at checkout time — this swaps it for the
     * real subscription id once the `checkout.session.completed` webhook
     * arrives.
     */
    async reattachProviderSubscriptionId(
      id: number,
      providerSubscriptionId: string,
      providerCustomerId: string | null,
    ): Promise<void> {
      await execute(
        "UPDATE subscriptions SET provider_subscription_id = ?, provider_customer_id = ? WHERE id = ?",
        [providerSubscriptionId, providerCustomerId, id],
      );
    },
    async all(filters: { limit?: number } = {}): Promise<SubscriptionRow[]> {
      return withSchemaFallback(
        async () => {
          const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
          const rows = await query("SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT ?", [limit]);
          return rows.map(toSubscription);
        },
        async () => [],
      );
    },
  },

  invoices: {
    /** invoice_number is derived from the row's own id, same pattern as support_tickets.ticket_number. */
    async insert(i: {
      userId: number;
      subscriptionId: number | null;
      provider: PaymentProvider;
      providerPaymentId: string;
      providerInvoiceId: string | null;
      amount: number;
      currency: Currency;
      status: InvoiceStatus;
      paidAt: Date | null;
    }): Promise<InvoiceRow> {
      const res = await execute(
        `INSERT INTO invoices
           (user_id, subscription_id, provider, provider_payment_id, provider_invoice_id, amount, currency, status, paid_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [i.userId, i.subscriptionId, i.provider, i.providerPaymentId, i.providerInvoiceId, i.amount, i.currency, i.status, i.paidAt],
      );
      const invoiceNumber = `MP-INV-${String(res.insertId).padStart(6, "0")}`;
      await execute("UPDATE invoices SET invoice_number = ? WHERE id = ?", [invoiceNumber, res.insertId]);
      const rows = await query("SELECT * FROM invoices WHERE id = ?", [res.insertId]);
      return toInvoice(rows[0]!);
    },
    async findByProviderPaymentId(provider: PaymentProvider, providerPaymentId: string): Promise<InvoiceRow | null> {
      const rows = await query(
        "SELECT * FROM invoices WHERE provider = ? AND provider_payment_id = ? LIMIT 1",
        [provider, providerPaymentId],
      );
      return rows[0] ? toInvoice(rows[0]) : null;
    },
    async findByUser(userId: number): Promise<InvoiceRow[]> {
      return withSchemaFallback(
        async () => {
          const rows = await query("SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC", [userId]);
          return rows.map(toInvoice);
        },
        async () => [],
      );
    },
    async all(filters: { limit?: number } = {}): Promise<InvoiceRow[]> {
      return withSchemaFallback(
        async () => {
          const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
          const rows = await query("SELECT * FROM invoices ORDER BY created_at DESC LIMIT ?", [limit]);
          return rows.map(toInvoice);
        },
        async () => [],
      );
    },
  },

  /**
   * Webhook delivery idempotency log. `insertIfNew` is the only entry point a
   * webhook handler needs — it returns false for a duplicate delivery, so the
   * caller can skip re-applying side effects (flipping users.plan, writing an
   * invoice, sending email) without a separate existence check.
   */
  webhookEvents: {
    async insertIfNew(e: {
      provider: PaymentProvider;
      eventId: string;
      eventType: string;
      payload: unknown;
    }): Promise<boolean> {
      const res = await execute(
        `INSERT IGNORE INTO payment_webhook_events (provider, event_id, event_type, payload)
         VALUES (?, ?, ?, ?)`,
        [e.provider, e.eventId, e.eventType, JSON.stringify(e.payload)],
      );
      return res.affectedRows > 0;
    },
    async markProcessed(provider: PaymentProvider, eventId: string): Promise<void> {
      await execute(
        "UPDATE payment_webhook_events SET processed_at = NOW() WHERE provider = ? AND event_id = ?",
        [provider, eventId],
      );
    },
  },

  /**
   * Plan catalog (MP-PLAN-001). Schema lives in lib/db/feature_engine.sql —
   * replaces the fixed `"pro"|"premium"` enum that subscription_plans/
   * subscriptions used to carry directly.
   */
  plans: {
    async all(): Promise<PlanRow[]> {
      return withSchemaFallback(
        async () => {
          const rows = await query("SELECT * FROM plans ORDER BY display_order, plan_key");
          return rows.map(toPlan);
        },
        async () => [],
      );
    },
    async findByKey(planKey: string): Promise<PlanRow | null> {
      return withSchemaFallback(
        async () => {
          const rows = await query("SELECT * FROM plans WHERE plan_key = ? LIMIT 1", [planKey]);
          return rows[0] ? toPlan(rows[0]) : null;
        },
        async () => null,
      );
    },
    async insert(p: {
      planKey: string; name: string; description: string | null; trialDays: number; displayOrder: number;
      isPopular: boolean; isRecommended: boolean; status: PlanStatus; color: string | null; icon: string | null;
      maxUsers: number | null; maxDevices: number | null; maxWatchlists: number | null; maxAlerts: number | null;
      maxApiCalls: number | null; maxAiRequests: number | null; storageLimitMb: number | null; supportType: string | null;
    }): Promise<PlanRow> {
      await execute(
        `INSERT INTO plans
           (plan_key, name, description, trial_days, display_order, is_popular, is_recommended, status, color, icon,
            max_users, max_devices, max_watchlists, max_alerts, max_api_calls, max_ai_requests, storage_limit_mb, support_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.planKey, p.name, p.description, p.trialDays, p.displayOrder, p.isPopular, p.isRecommended, p.status,
          p.color, p.icon, p.maxUsers, p.maxDevices, p.maxWatchlists, p.maxAlerts, p.maxApiCalls, p.maxAiRequests,
          p.storageLimitMb, p.supportType,
        ],
      );
      const created = await query("SELECT * FROM plans WHERE plan_key = ?", [p.planKey]);
      return toPlan(created[0]!);
    },
    async update(planKey: string, fields: Partial<{
      name: string; description: string | null; trialDays: number; displayOrder: number;
      isPopular: boolean; isRecommended: boolean; status: PlanStatus; color: string | null; icon: string | null;
      maxUsers: number | null; maxDevices: number | null; maxWatchlists: number | null; maxAlerts: number | null;
      maxApiCalls: number | null; maxAiRequests: number | null; storageLimitMb: number | null; supportType: string | null;
    }>): Promise<void> {
      const colMap: Record<string, string> = {
        name: "name", description: "description", trialDays: "trial_days", displayOrder: "display_order",
        isPopular: "is_popular", isRecommended: "is_recommended", status: "status", color: "color", icon: "icon",
        maxUsers: "max_users", maxDevices: "max_devices", maxWatchlists: "max_watchlists", maxAlerts: "max_alerts",
        maxApiCalls: "max_api_calls", maxAiRequests: "max_ai_requests", storageLimitMb: "storage_limit_mb",
        supportType: "support_type",
      };
      const sets: string[] = [];
      const vals: SqlParam[] = [];
      for (const [key, col] of Object.entries(colMap)) {
        const val = (fields as Record<string, unknown>)[key];
        if (val === undefined) continue;
        sets.push(`${col} = ?`);
        vals.push(val as SqlParam);
      }
      if (sets.length === 0) return;
      vals.push(planKey);
      await execute(`UPDATE plans SET ${sets.join(", ")} WHERE plan_key = ?`, vals);
    },
    /**
     * Refuses to delete a plan with real dependents (subscribers or pricing
     * rows) — returns false instead of throwing, so the route layer can
     * surface a clear "still in use" message rather than a raw FK error.
     * `subscriptions` also carries an ON DELETE RESTRICT FK as a backstop.
     */
    async delete(planKey: string): Promise<boolean> {
      const [subs] = await query("SELECT COUNT(*) as c FROM subscriptions WHERE plan_id = ?", [planKey]);
      if (Number(subs?.["c"] ?? 0) > 0) return false;
      await execute("DELETE FROM plans WHERE plan_key = ?", [planKey]);
      return true;
    },
  },

  featureCategories: {
    async all(): Promise<FeatureCategoryRow[]> {
      return withSchemaFallback(
        async () => {
          const rows = await query("SELECT * FROM feature_categories ORDER BY display_order, category_key");
          return rows.map(toFeatureCategory);
        },
        async () => [],
      );
    },
  },

  features: {
    async all(): Promise<FeatureRow[]> {
      return withSchemaFallback(
        async () => {
          const rows = await query("SELECT * FROM features ORDER BY category_key, display_order");
          return rows.map(toFeature);
        },
        async () => [],
      );
    },
    async findByKey(featureKey: string): Promise<FeatureRow | null> {
      return withSchemaFallback(
        async () => {
          const rows = await query("SELECT * FROM features WHERE feature_key = ? LIMIT 1", [featureKey]);
          return rows[0] ? toFeature(rows[0]) : null;
        },
        async () => null,
      );
    },
    async insert(f: {
      featureKey: string; name: string; description: string | null; categoryKey: string;
      parentModule: string | null; displayOrder: number; icon: string | null; status: FeatureStatus;
    }): Promise<FeatureRow> {
      await execute(
        `INSERT INTO features (feature_key, name, description, category_key, parent_module, display_order, icon, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [f.featureKey, f.name, f.description, f.categoryKey, f.parentModule, f.displayOrder, f.icon, f.status],
      );
      const created = await query("SELECT * FROM features WHERE feature_key = ?", [f.featureKey]);
      return toFeature(created[0]!);
    },
    async update(featureKey: string, fields: Partial<{
      name: string; description: string | null; categoryKey: string; parentModule: string | null;
      displayOrder: number; icon: string | null; status: FeatureStatus;
    }>): Promise<void> {
      const colMap: Record<string, string> = {
        name: "name", description: "description", categoryKey: "category_key", parentModule: "parent_module",
        displayOrder: "display_order", icon: "icon", status: "status",
      };
      const sets: string[] = [];
      const vals: SqlParam[] = [];
      for (const [key, col] of Object.entries(colMap)) {
        const val = (fields as Record<string, unknown>)[key];
        if (val === undefined) continue;
        sets.push(`${col} = ?`);
        vals.push(val as SqlParam);
      }
      if (sets.length === 0) return;
      vals.push(featureKey);
      await execute(`UPDATE features SET ${sets.join(", ")} WHERE feature_key = ?`, vals);
    },
  },

  /** The plan/feature access matrix — the single source of truth requireFeature() and the frontend both read. */
  planFeatures: {
    async all(): Promise<PlanFeatureRow[]> {
      return withSchemaFallback(
        async () => {
          const rows = await query("SELECT * FROM plan_features");
          return rows.map(toPlanFeature);
        },
        async () => [],
      );
    },
    async forPlan(planKey: string): Promise<PlanFeatureRow[]> {
      return withSchemaFallback(
        async () => {
          const rows = await query("SELECT * FROM plan_features WHERE plan_key = ?", [planKey]);
          return rows.map(toPlanFeature);
        },
        async () => [],
      );
    },
    async find(planKey: string, featureKey: string): Promise<PlanFeatureRow | null> {
      return withSchemaFallback(
        async () => {
          const rows = await query(
            "SELECT * FROM plan_features WHERE plan_key = ? AND feature_key = ? LIMIT 1",
            [planKey, featureKey],
          );
          return rows[0] ? toPlanFeature(rows[0]) : null;
        },
        async () => null,
      );
    },
    /** Upserts one matrix cell — the admin Plan Features grid saves one cell at a time. */
    async upsert(planKey: string, featureKey: string, fields: {
      enabled: boolean; usageLimit: number | null; dailyLimit: number | null; monthlyLimit: number | null;
      isUnlimited: boolean; visibleInMenu: boolean; comingSoon: boolean; isBeta: boolean; badge: FeatureBadge;
      hideCompletely: boolean; showUpgradeBanner: boolean; readOnly: boolean;
    }): Promise<void> {
      await execute(
        `INSERT INTO plan_features
           (plan_key, feature_key, enabled, usage_limit, daily_limit, monthly_limit, is_unlimited,
            visible_in_menu, coming_soon, is_beta, badge, hide_completely, show_upgrade_banner, read_only)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           enabled = VALUES(enabled), usage_limit = VALUES(usage_limit), daily_limit = VALUES(daily_limit),
           monthly_limit = VALUES(monthly_limit), is_unlimited = VALUES(is_unlimited),
           visible_in_menu = VALUES(visible_in_menu), coming_soon = VALUES(coming_soon), is_beta = VALUES(is_beta),
           badge = VALUES(badge), hide_completely = VALUES(hide_completely),
           show_upgrade_banner = VALUES(show_upgrade_banner), read_only = VALUES(read_only)`,
        [
          planKey, featureKey, fields.enabled, fields.usageLimit, fields.dailyLimit, fields.monthlyLimit,
          fields.isUnlimited, fields.visibleInMenu, fields.comingSoon, fields.isBeta, fields.badge,
          fields.hideCompletely, fields.showUpgradeBanner, fields.readOnly,
        ],
      );
    },
  },

  featureUsage: {
    async get(userId: number, featureKey: string, period: string): Promise<UserFeatureUsageRow | null> {
      return withSchemaFallback(
        async () => {
          const rows = await query(
            "SELECT * FROM user_feature_usage WHERE user_id = ? AND feature_key = ? AND period = ? LIMIT 1",
            [userId, featureKey, period],
          );
          return rows[0] ? toUserFeatureUsage(rows[0]) : null;
        },
        async () => null,
      );
    },
    /** Atomic increment-or-create for one user/feature/period counter. */
    async increment(userId: number, featureKey: string, period: string): Promise<void> {
      await execute(
        `INSERT INTO user_feature_usage (user_id, feature_key, period, count)
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE count = count + 1`,
        [userId, featureKey, period],
      );
    },
    async forUser(userId: number): Promise<UserFeatureUsageRow[]> {
      return withSchemaFallback(
        async () => {
          const rows = await query(
            "SELECT * FROM user_feature_usage WHERE user_id = ? ORDER BY period DESC",
            [userId],
          );
          return rows.map(toUserFeatureUsage);
        },
        async () => [],
      );
    },
    /** Aggregate usage per feature for the given period, across all users — the admin Feature Usage view. */
    async aggregateForPeriod(period: string): Promise<{ featureKey: string; totalCount: number; userCount: number }[]> {
      return withSchemaFallback(
        async () => {
          const rows = await query(
            `SELECT feature_key, SUM(count) as total_count, COUNT(DISTINCT user_id) as user_count
             FROM user_feature_usage WHERE period = ? GROUP BY feature_key`,
            [period],
          );
          return rows.map((r) => ({
            featureKey: String(r["feature_key"]),
            totalCount: Number(r["total_count"]),
            userCount: Number(r["user_count"]),
          }));
        },
        async () => [],
      );
    },
  },
};
