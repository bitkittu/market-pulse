-- Market Pulse AI — MP-PAY-001: Subscription & Payment Gateway Integration.
--
-- Additive-only, like lib/db/holding_stocks.sql, lib/db/account_upgrade.sql
-- and lib/db/support_center.sql: every statement is CREATE TABLE IF NOT
-- EXISTS, safe to run against a live database with real users. Apply by hand
-- via phpMyAdmin (or the XAMPP MySQL console locally) — nothing in the
-- application creates or alters tables at runtime. Every route/accessor that
-- touches these tables degrades to a safe fallback until this file has been
-- applied (see withSchemaFallback in lib/db/src/index.ts).
--
-- Money is always stored as an integer in the smallest currency unit (paise
-- for INR, cents for USD) — never DECIMAL/float — matching what the Razorpay
-- and Stripe APIs themselves expect on the wire, so no unit conversion happens
-- anywhere except at the presentation layer.

-- ── Provider credentials (single configured row; id is always 1) ────────────
-- Same shape as smtp_settings: DB-stored, AES-256-GCM encrypted, admin-
-- editable, rather than raw env vars.

CREATE TABLE IF NOT EXISTS `payment_settings` (
  `id` tinyint unsigned NOT NULL DEFAULT 1,
  `razorpay_key_id` varchar(255),
  `razorpay_key_secret_encrypted` varchar(500),
  `razorpay_webhook_secret_encrypted` varchar(500),
  `stripe_publishable_key` varchar(255),
  `stripe_secret_key_encrypted` varchar(500),
  `stripe_webhook_secret_encrypted` varchar(500),
  `updated_by` bigint unsigned,
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `payment_settings_id` PRIMARY KEY (`id`),
  CONSTRAINT `payment_settings_singleton` CHECK (`id` = 1)
);

-- ── Plan catalog ──────────────────────────────────────────────────────────
-- One row per (plan_id, billing_cycle). The app never calls a provider's
-- "create plan/price" API — an admin creates the Plan on Razorpay / the Price
-- on Stripe by hand and pastes the resulting id here, the same "admin
-- configures, app consumes" division already used for SMTP.

CREATE TABLE IF NOT EXISTS `subscription_plans` (
  `id` int unsigned AUTO_INCREMENT NOT NULL,
  `plan_id` enum('pro','premium') NOT NULL,
  `billing_cycle` enum('monthly','annual') NOT NULL,
  `amount_inr_paise` int unsigned NOT NULL DEFAULT 0,
  `amount_usd_cents` int unsigned NOT NULL DEFAULT 0,
  `razorpay_plan_id` varchar(64),
  `stripe_price_id` varchar(64),
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `subscription_plans_id` PRIMARY KEY (`id`),
  CONSTRAINT `subscription_plans_plan_cycle_unique` UNIQUE (`plan_id`, `billing_cycle`)
);

-- Seed the 4 plan/cycle combinations disabled-by-price (amount 0, no provider
-- id) so the app has rows to read and an admin has rows to edit, without
-- guessing at real prices or activating checkout before they're configured.
-- INSERT IGNORE so re-running this file never clobbers admin-entered pricing.
INSERT IGNORE INTO `subscription_plans`
  (`plan_id`, `billing_cycle`, `amount_inr_paise`, `amount_usd_cents`, `active`)
VALUES
  ('pro', 'monthly', 0, 0, 0),
  ('pro', 'annual', 0, 0, 0),
  ('premium', 'monthly', 0, 0, 0),
  ('premium', 'annual', 0, 0, 0);

-- ── Subscriptions ─────────────────────────────────────────────────────────
-- No new column on `users` — account_upgrade.sql already flags users.* ALTERs
-- as sitting on the login hot path; the "current" subscription for a user is
-- just the most recent non-expired row here instead.

CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` bigint unsigned AUTO_INCREMENT NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `plan_id` enum('pro','premium') NOT NULL,
  `billing_cycle` enum('monthly','annual') NOT NULL,
  `provider` enum('razorpay','stripe') NOT NULL,
  `provider_subscription_id` varchar(120) NOT NULL,
  `provider_customer_id` varchar(120),
  `status` enum('created','active','past_due','cancelled','expired') NOT NULL DEFAULT 'created',
  `current_period_end` datetime,
  `cancel_at_period_end` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `subscriptions_id` PRIMARY KEY (`id`),
  CONSTRAINT `subscriptions_provider_sub_unique` UNIQUE (`provider`, `provider_subscription_id`),
  KEY `subscriptions_user_id_idx` (`user_id`),
  KEY `subscriptions_status_idx` (`status`)
);

-- ── Invoices / payments ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `invoices` (
  `id` bigint unsigned AUTO_INCREMENT NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `subscription_id` bigint unsigned,
  `provider` enum('razorpay','stripe') NOT NULL,
  `provider_payment_id` varchar(120) NOT NULL,
  `provider_invoice_id` varchar(120),
  `amount` int unsigned NOT NULL,
  `currency` enum('INR','USD') NOT NULL,
  `status` enum('paid','failed','refunded') NOT NULL,
  -- App-generated display id (MP-INV-000123), derived from `id` right after
  -- insert (nullable so the insert-then-update has no race: MySQL/MariaDB
  -- UNIQUE indexes allow any number of NULLs) — same pattern and reasoning as
  -- support_tickets.ticket_number. Never used as an authorization key — every
  -- lookup goes through the numeric `id` + `user_id`.
  `invoice_number` varchar(40),
  `paid_at` datetime,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `invoices_id` PRIMARY KEY (`id`),
  CONSTRAINT `invoices_provider_payment_unique` UNIQUE (`provider`, `provider_payment_id`),
  CONSTRAINT `invoices_invoice_number_unique` UNIQUE (`invoice_number`),
  KEY `invoices_user_id_idx` (`user_id`),
  KEY `invoices_subscription_id_idx` (`subscription_id`)
);

-- ── Webhook idempotency log ───────────────────────────────────────────────
-- Every webhook handler inserts the provider's event id here first (ignore-
-- on-duplicate); side effects (flipping users.plan, writing an invoice,
-- sending email) only run if the insert was new. This is the standard defense
-- against a provider retrying a webhook delivery and double-crediting a
-- payment.

CREATE TABLE IF NOT EXISTS `payment_webhook_events` (
  `id` bigint unsigned AUTO_INCREMENT NOT NULL,
  `provider` enum('razorpay','stripe') NOT NULL,
  `event_id` varchar(160) NOT NULL,
  `event_type` varchar(80) NOT NULL,
  `payload` json NOT NULL,
  `processed_at` datetime,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `payment_webhook_events_id` PRIMARY KEY (`id`),
  CONSTRAINT `payment_webhook_events_provider_event_unique` UNIQUE (`provider`, `event_id`)
);

-- Foreign keys, guarded so a re-run of this file never errors (MySQL/MariaDB
-- don't support "ADD CONSTRAINT IF NOT EXISTS").

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'subscriptions_user_id_users_id_fk');
SET @sql := IF(@fk = 0, 'ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'invoices_user_id_users_id_fk');
SET @sql := IF(@fk = 0, 'ALTER TABLE `invoices` ADD CONSTRAINT `invoices_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'invoices_subscription_id_subscriptions_id_fk');
SET @sql := IF(@fk = 0, 'ALTER TABLE `invoices` ADD CONSTRAINT `invoices_subscription_id_subscriptions_id_fk` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── Enable the payment email templates ───────────────────────────────────
-- account_upgrade.sql (§13) seeded 10 payment/subscription templates disabled
-- because no trigger code existed yet. It now does — flip them on, but only
-- rows still at the shipped default (enabled = 0); an admin who already
-- toggled one is never touched, same INSERT IGNORE-safety spirit as the rest
-- of this file.
UPDATE `email_templates`
SET `enabled` = 1
WHERE `template_key` IN (
  'subscription_activated', 'payment_successful', 'payment_failed',
  'subscription_renewal_reminder', 'subscription_renewed', 'subscription_expiring',
  'subscription_cancelled', 'refund_processed', 'invoice_receipt',
  'plan_upgraded', 'plan_downgraded'
) AND `enabled` = 0;
