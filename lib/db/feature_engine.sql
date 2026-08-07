-- Market Pulse AI — MP-PLAN-001: Dynamic Subscription Plan & Feature Access.
--
-- Additive-only, like every other schema file in this project — hand-applied
-- via phpMyAdmin (or the XAMPP MySQL console locally), never at runtime.
-- Replaces the two previously-fixed plan enums (`users.plan` stays as-is —
-- see note below — and `subscription_plans`/`subscriptions.plan_id`, added by
-- lib/db/payment_gateway.sql) with a `plans` catalog an admin can extend
-- without a schema change, plus a `features`/`plan_features` matrix that is
-- the single source of truth both the frontend display and backend
-- authorization read from.
--
-- `users.plan` is intentionally NOT touched here: it stays `enum('free',
-- 'pro','premium')`. Changing it to reference `plans.plan_key` would require
-- rewriting every login/session code path that reads `UserRow.plan` for a
-- cosmetic win with real regression risk, for no functional gain — every
-- actual access decision goes through `plan_features` via the user's current
-- plan key, and `users.plan` already holds exactly one of the three plan
-- keys this migration seeds. A plan key outside that enum (e.g. an
-- admin-created "starter" or "enterprise" plan) is assigned via
-- `subscriptions.plan_id` (now a free-form key, see below) — `users.plan`
-- keeps tracking the free/pro/premium tier for everything that predates this
-- system, while `subscriptions` is the source of truth for anyone on a
-- purchased, non-legacy plan. Revisit only if a plan outside those three
-- needs to become a user's *primary* recorded plan.

-- ── Plan catalog ──────────────────────────────────────────────────────────
-- Identity + display + limit metadata, one row per plan. Pricing stays in
-- subscription_plans (lib/db/payment_gateway.sql) — this table doesn't
-- duplicate it. max_* columns are informational/display only (e.g. "up to 20
-- watchlists" on a pricing card) — the actual enforcement mechanism is
-- exclusively `plan_features` below, so there is one place, not two, that
-- decides what a user can do.

CREATE TABLE IF NOT EXISTS `plans` (
  `plan_key` varchar(40) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` varchar(255),
  `trial_days` smallint unsigned NOT NULL DEFAULT 0,
  `display_order` smallint unsigned NOT NULL DEFAULT 0,
  `is_popular` tinyint(1) NOT NULL DEFAULT 0,
  `is_recommended` tinyint(1) NOT NULL DEFAULT 0,
  `status` enum('active','inactive','archived') NOT NULL DEFAULT 'active',
  `color` varchar(30),
  `icon` varchar(40),
  `max_users` int unsigned,
  `max_devices` int unsigned,
  `max_watchlists` int unsigned,
  `max_alerts` int unsigned,
  `max_api_calls` int unsigned,
  `max_ai_requests` int unsigned,
  `storage_limit_mb` int unsigned,
  `support_type` varchar(40),
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `plans_plan_key` PRIMARY KEY (`plan_key`)
);

-- Seeded to reproduce today's three plans exactly, so the cutover changes no
-- user's access. INSERT IGNORE — re-running this file never overwrites an
-- admin's edits.
INSERT IGNORE INTO `plans`
  (`plan_key`, `name`, `description`, `display_order`, `status`, `color`, `icon`, `max_watchlists`, `max_alerts`, `support_type`)
VALUES
  ('free', 'Free', 'Core market tools at no cost', 1, 'active', 'slate', 'User', 3, 5, 'email'),
  ('pro', 'Pro', 'Full predictions & live trade levels', 2, 'active', 'violet', 'Crown', 20, 100, 'email'),
  ('premium', 'Premium', 'Everything in Pro, plus more', 3, 'active', 'amber', 'Sparkles', NULL, NULL, 'priority');

-- ── Feature categories ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `feature_categories` (
  `category_key` varchar(40) NOT NULL,
  `name` varchar(100) NOT NULL,
  `display_order` smallint unsigned NOT NULL DEFAULT 0,
  `icon` varchar(40),
  CONSTRAINT `feature_categories_category_key` PRIMARY KEY (`category_key`)
);

INSERT IGNORE INTO `feature_categories` (`category_key`, `name`, `display_order`, `icon`) VALUES
  ('dashboard', 'Dashboard', 1, 'LayoutDashboard'),
  ('market_hub', 'Market Hub', 2, 'Globe'),
  ('holding_stocks', 'Holding Stocks', 3, 'Briefcase'),
  ('intraday', 'Intraday', 4, 'Zap'),
  ('options', 'Options', 5, 'Layers'),
  ('commodities', 'Commodities', 6, 'Gem'),
  ('forex', 'Forex', 7, 'DollarSign'),
  ('crypto', 'Crypto', 8, 'Bitcoin'),
  ('portfolio', 'Portfolio', 9, 'PieChart'),
  ('ai', 'AI', 10, 'Brain'),
  ('reports', 'Reports', 11, 'FileText'),
  ('alerts', 'Alerts', 12, 'Bell'),
  ('learning', 'Learning', 13, 'GraduationCap'),
  ('support', 'Support', 14, 'LifeBuoy'),
  ('api', 'API', 15, 'Server'),
  ('administration', 'Administration', 16, 'Shield'),
  ('billing', 'Billing', 17, 'CreditCard');

-- ── Feature master list ───────────────────────────────────────────────────
-- Seeded only with features that already have real, working functionality
-- behind them today — a row for something with no page/endpoint yet would
-- be gate-able marketing copy with nothing to enforce. New features (Forex,
-- Crypto, WhatsApp/Telegram alerts, etc.) are added here through the admin
-- Features page once they exist, which is the point of this system.

CREATE TABLE IF NOT EXISTS `features` (
  `feature_key` varchar(60) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` varchar(255),
  `category_key` varchar(40) NOT NULL,
  `parent_module` varchar(60),
  `display_order` smallint unsigned NOT NULL DEFAULT 0,
  `icon` varchar(40),
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  CONSTRAINT `features_feature_key` PRIMARY KEY (`feature_key`)
);

INSERT IGNORE INTO `features` (`feature_key`, `name`, `description`, `category_key`, `display_order`, `icon`) VALUES
  ('dashboard', 'Dashboard', 'Home market overview', 'dashboard', 1, 'LayoutDashboard'),
  ('key_levels', 'Nifty Resistance & Support', 'Pivot, R1-R3 & S1-S3 key levels', 'dashboard', 2, 'TrendingUp'),
  ('holding_stocks', 'Holding Stocks', '1-3 month AI-ranked positional opportunities', 'holding_stocks', 1, 'Briefcase'),
  ('intraday', 'Intraday Predictions', 'AI intraday buy/sell/stop-loss picks', 'intraday', 1, 'Zap'),
  ('options', 'Options Predictions', 'CE/PE picks with IV & OI analysis', 'options', 1, 'Layers'),
  ('commodities', 'Commodities Predictions', 'Gold, silver, crude & more', 'commodities', 1, 'Gem'),
  ('portfolio', 'Portfolio Tracking', 'Track holdings & live P&L', 'portfolio', 1, 'PieChart'),
  ('watchlist', 'Watchlist', 'Track symbols of interest', 'portfolio', 2, 'Star'),
  ('performance', 'Performance Analytics', 'Signal accuracy & returns', 'reports', 1, 'BarChart2'),
  ('insights', 'Stock Insights', 'News-driven market insights', 'reports', 2, 'Newspaper'),
  ('api_settings', 'Upstox API Integration', 'Connect your broker for live data', 'api', 1, 'Server');

-- ── Plan / feature matrix ─────────────────────────────────────────────────
-- The single source of truth both frontend display and backend
-- authorization (requireFeature middleware) read from.

CREATE TABLE IF NOT EXISTS `plan_features` (
  `id` int unsigned AUTO_INCREMENT NOT NULL,
  `plan_key` varchar(40) NOT NULL,
  `feature_key` varchar(60) NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT 0,
  `usage_limit` int unsigned,
  `daily_limit` int unsigned,
  `monthly_limit` int unsigned,
  `is_unlimited` tinyint(1) NOT NULL DEFAULT 0,
  `visible_in_menu` tinyint(1) NOT NULL DEFAULT 1,
  `coming_soon` tinyint(1) NOT NULL DEFAULT 0,
  `is_beta` tinyint(1) NOT NULL DEFAULT 0,
  `badge` enum('none','pro','premium','enterprise') NOT NULL DEFAULT 'none',
  `hide_completely` tinyint(1) NOT NULL DEFAULT 0,
  `show_upgrade_banner` tinyint(1) NOT NULL DEFAULT 1,
  `read_only` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `plan_features_id` PRIMARY KEY (`id`),
  CONSTRAINT `plan_features_plan_feature_unique` UNIQUE (`plan_key`, `feature_key`)
);

-- Reproduces today's exact split: FREE_ACCESS (lib/plan.ts) was
-- commodities/insights/portfolio/performance; dashboard, watchlist and
-- holding_stocks are open to everyone today (no gate exists at all yet) so
-- they stay open here too — this migration changes *who can bypass a route
-- anonymously*, never what a logged-in free user can already do. Pro and
-- Premium are identical, matching hasAccess()'s current behavior of not
-- differentiating them.
INSERT IGNORE INTO `plan_features`
  (`plan_key`, `feature_key`, `enabled`, `is_unlimited`, `badge`, `show_upgrade_banner`)
VALUES
  ('free', 'dashboard', 1, 1, 'none', 0),
  ('free', 'holding_stocks', 1, 1, 'none', 0),
  ('free', 'watchlist', 1, 1, 'none', 0),
  ('free', 'commodities', 1, 1, 'none', 0),
  ('free', 'insights', 1, 1, 'none', 0),
  ('free', 'portfolio', 1, 1, 'none', 0),
  ('free', 'performance', 1, 1, 'none', 0),
  ('free', 'key_levels', 0, 0, 'pro', 1),
  ('free', 'intraday', 0, 0, 'pro', 1),
  ('free', 'options', 0, 0, 'pro', 1),
  ('free', 'api_settings', 0, 0, 'pro', 1),

  ('pro', 'dashboard', 1, 1, 'none', 0),
  ('pro', 'holding_stocks', 1, 1, 'none', 0),
  ('pro', 'watchlist', 1, 1, 'none', 0),
  ('pro', 'commodities', 1, 1, 'none', 0),
  ('pro', 'insights', 1, 1, 'none', 0),
  ('pro', 'portfolio', 1, 1, 'none', 0),
  ('pro', 'performance', 1, 1, 'none', 0),
  ('pro', 'key_levels', 1, 1, 'none', 0),
  ('pro', 'intraday', 1, 1, 'none', 0),
  ('pro', 'options', 1, 1, 'none', 0),
  ('pro', 'api_settings', 1, 1, 'none', 0),

  ('premium', 'dashboard', 1, 1, 'none', 0),
  ('premium', 'holding_stocks', 1, 1, 'none', 0),
  ('premium', 'watchlist', 1, 1, 'none', 0),
  ('premium', 'commodities', 1, 1, 'none', 0),
  ('premium', 'insights', 1, 1, 'none', 0),
  ('premium', 'portfolio', 1, 1, 'none', 0),
  ('premium', 'performance', 1, 1, 'none', 0),
  ('premium', 'key_levels', 1, 1, 'none', 0),
  ('premium', 'intraday', 1, 1, 'none', 0),
  ('premium', 'options', 1, 1, 'none', 0),
  ('premium', 'api_settings', 1, 1, 'none', 0);

-- ── Usage tracking ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `user_feature_usage` (
  `id` bigint unsigned AUTO_INCREMENT NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `feature_key` varchar(60) NOT NULL,
  -- 'YYYY-MM-DD' for a daily counter, 'YYYY-MM' for a monthly counter — which
  -- one applies is read off the feature's plan_features row (daily_limit vs
  -- monthly_limit), so a feature only ever has rows in the granularity it's
  -- actually limited at.
  `period` varchar(10) NOT NULL,
  `count` int unsigned NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `user_feature_usage_id` PRIMARY KEY (`id`),
  CONSTRAINT `user_feature_usage_user_feature_period_unique` UNIQUE (`user_id`, `feature_key`, `period`)
);

-- ── Coupons (schema stub — item #16, no application code reads this yet) ──

CREATE TABLE IF NOT EXISTS `coupons` (
  `id` int unsigned AUTO_INCREMENT NOT NULL,
  `code` varchar(40) NOT NULL,
  `discount_type` enum('percent','fixed_inr_paise','fixed_usd_cents') NOT NULL,
  `discount_value` int unsigned NOT NULL,
  `valid_from` datetime,
  `valid_until` datetime,
  `max_redemptions` int unsigned,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `coupons_id` PRIMARY KEY (`id`),
  CONSTRAINT `coupons_code_unique` UNIQUE (`code`)
);

-- ── Migrate subscription_plans / subscriptions off the fixed enum ────────
-- Both columns become free-form keys referencing `plans.plan_key` instead of
-- a hardcoded ('pro','premium') enum, so an admin-created plan is purchasable
-- through the same Razorpay/Stripe integration without a schema change.
-- Production has never had payment_gateway.sql applied, so this is not a
-- live-data migration there; local rows are trivial zero-amount seed data.

ALTER TABLE `subscription_plans` MODIFY COLUMN `plan_id` varchar(40) NOT NULL;
ALTER TABLE `subscriptions` MODIFY COLUMN `plan_id` varchar(40) NOT NULL;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'subscription_plans_plan_key_plans_plan_key_fk');
SET @sql := IF(@fk = 0, 'ALTER TABLE `subscription_plans` ADD CONSTRAINT `subscription_plans_plan_key_plans_plan_key_fk` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`plan_key`) ON DELETE CASCADE ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- RESTRICT, not CASCADE: unlike subscription_plans (pure pricing config,
-- safe to cascade), a `subscriptions` row is a real billing record — a plan
-- with actual subscribers must not be deletable at all, silently or
-- otherwise. db.plans.delete() also guards this at the app level; this FK is
-- the backstop in case that guard is ever bypassed or has a bug.
SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'subscriptions_plan_key_plans_plan_key_fk');
SET @sql := IF(@fk = 0, 'ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_plan_key_plans_plan_key_fk` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`plan_key`) ON DELETE RESTRICT ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'plan_features_plan_key_plans_plan_key_fk');
SET @sql := IF(@fk = 0, 'ALTER TABLE `plan_features` ADD CONSTRAINT `plan_features_plan_key_plans_plan_key_fk` FOREIGN KEY (`plan_key`) REFERENCES `plans`(`plan_key`) ON DELETE CASCADE ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'plan_features_feature_key_features_feature_key_fk');
SET @sql := IF(@fk = 0, 'ALTER TABLE `plan_features` ADD CONSTRAINT `plan_features_feature_key_features_feature_key_fk` FOREIGN KEY (`feature_key`) REFERENCES `features`(`feature_key`) ON DELETE CASCADE ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'features_category_key_feature_categories_category_key_fk');
SET @sql := IF(@fk = 0, 'ALTER TABLE `features` ADD CONSTRAINT `features_category_key_feature_categories_category_key_fk` FOREIGN KEY (`category_key`) REFERENCES `feature_categories`(`category_key`) ON DELETE RESTRICT ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'user_feature_usage_user_id_users_id_fk');
SET @sql := IF(@fk = 0, 'ALTER TABLE `user_feature_usage` ADD CONSTRAINT `user_feature_usage_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'user_feature_usage_feature_key_features_feature_key_fk');
SET @sql := IF(@fk = 0, 'ALTER TABLE `user_feature_usage` ADD CONSTRAINT `user_feature_usage_feature_key_features_feature_key_fk` FOREIGN KEY (`feature_key`) REFERENCES `features`(`feature_key`) ON DELETE CASCADE ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
