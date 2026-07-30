-- Market Pulse AI — MP-ACCOUNT-001 additive schema upgrade.
--
-- Additive-only, like lib/db/holding_stocks.sql: every statement is
-- CREATE TABLE IF NOT EXISTS or ADD COLUMN IF NOT EXISTS, no DROP/ALTER of
-- existing columns, so this is safe to run against a live database with real
-- users. Apply by hand via phpMyAdmin (or the XAMPP MySQL console locally),
-- exactly like every other schema change in this project — nothing in the
-- application creates or alters tables at runtime.
--
-- IMPORTANT: application code that depends on these columns/tables degrades
-- gracefully (falls back to pre-migration behavior) until this file has been
-- applied, EXCEPT the users.* column additions below, which should be applied
-- BEFORE deploying the new api-server code — see the accompanying report for
-- why (this is the one part of this migration that sits on the login/register
-- hot path for every user).

-- ── Users: consent + session hardening ───────────────────────────────────────

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `token_version` int unsigned NOT NULL DEFAULT 0;

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `terms_accepted_at` timestamp NULL;

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `marketing_consent` tinyint(1) NOT NULL DEFAULT 0;

-- Existing accounts predate consent capture and email verification. Backfill
-- so they are never nagged/blocked retroactively for something that did not
-- exist when they signed up.
UPDATE `users` SET `terms_accepted_at` = `created_at` WHERE `terms_accepted_at` IS NULL;
UPDATE `users` SET `email_verified_at` = `created_at` WHERE `email_verified_at` IS NULL;

-- ── Email verification: also used for "confirm email change" ────────────────
-- new_email IS NULL  -> verifying the account's current registered email.
-- new_email NOT NULL -> confirming a pending change to that new address.

ALTER TABLE `email_verifications`
  ADD COLUMN IF NOT EXISTS `new_email` varchar(190) NULL;

-- ── SMTP settings (single configured row; id is always 1) ───────────────────

CREATE TABLE IF NOT EXISTS `smtp_settings` (
  `id` tinyint unsigned NOT NULL DEFAULT 1,
  `host` varchar(255),
  `port` int unsigned NOT NULL DEFAULT 587,
  `encryption` enum('none','ssl','tls') NOT NULL DEFAULT 'tls',
  `username` varchar(255),
  `password_encrypted` varchar(500),
  `from_name` varchar(120) NOT NULL DEFAULT 'Market Pulse AI',
  `from_email` varchar(190),
  `reply_to_email` varchar(190),
  `support_email` varchar(190),
  `updated_by` bigint unsigned,
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `smtp_settings_id` PRIMARY KEY (`id`),
  CONSTRAINT `smtp_settings_singleton` CHECK (`id` = 1)
);

-- ── Email templates ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `email_templates` (
  `id` int unsigned AUTO_INCREMENT NOT NULL,
  `template_key` varchar(60) NOT NULL,
  `name` varchar(150) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `preheader` varchar(255),
  `body` mediumtext NOT NULL,
  `cta_label` varchar(120),
  `cta_url_template` varchar(500),
  `footer_note` varchar(500),
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `email_templates_id` PRIMARY KEY (`id`),
  CONSTRAINT `email_templates_key_unique` UNIQUE (`template_key`)
);

-- ── Email delivery log ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `email_logs` (
  `id` bigint unsigned AUTO_INCREMENT NOT NULL,
  `user_id` bigint unsigned,
  `template_key` varchar(60) NOT NULL,
  `recipient` varchar(190) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `trigger_source` varchar(80) NOT NULL,
  `status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
  `failure_reason` varchar(500),
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `sent_at` timestamp NULL,
  CONSTRAINT `email_logs_id` PRIMARY KEY (`id`),
  KEY `email_logs_user_id_idx` (`user_id`),
  KEY `email_logs_template_key_idx` (`template_key`),
  KEY `email_logs_status_idx` (`status`),
  KEY `email_logs_created_at_idx` (`created_at`)
);

-- Foreign keys are added separately (IF NOT EXISTS is not supported for
-- constraints in MySQL), guarded so a re-run of this file does not error.
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = 'email_logs_user_id_users_id_fk'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE `email_logs` ADD CONSTRAINT `email_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ── Seed the 13 templates required now, plus 11 future/payment templates ────
-- disabled and never triggered by application code (§13). Re-running this file
-- will not clobber admin edits: ON DUPLICATE KEY UPDATE only touches rows that
-- are still exactly the shipped default (never touches a template an admin has
-- already customized) is intentionally NOT implemented — instead we use
-- INSERT IGNORE, so once a row exists (default or edited), this file never
-- overwrites it again.

INSERT IGNORE INTO `email_templates`
  (`template_key`, `name`, `subject`, `preheader`, `body`, `cta_label`, `cta_url_template`, `footer_note`, `enabled`)
VALUES
(
  'welcome',
  '01 — Welcome to MarketPulse AI',
  'Welcome to MarketPulse AI, {{user_name}}',
  'Your account is ready — here is what to explore first.',
  'Hi {{user_name}},\n\nYour MarketPulse AI account is live. You now have access to real-time market dashboards, AI-driven signals, and portfolio tools built for serious investors.\n\nA quick note on your inbox: transactional emails like this one (security alerts, password resets, support updates) are always sent regardless of your notification preferences, since they keep your account safe.',
  'Go to Dashboard',
  '{{support_url}}',
  NULL,
  1
),
(
  'verify_email',
  '02 — Verify Your Email',
  'Verify your email address',
  'One click to confirm {{user_email}}.',
  'Hi {{user_name}},\n\nPlease confirm that {{user_email}} is your email address. This link expires in 24 hours and can only be used once.\n\nIf you did not create a MarketPulse AI account, you can safely ignore this email.',
  'Verify Email Address',
  '{{verification_url}}',
  NULL,
  1
),
(
  'email_verified',
  '03 — Email Verified',
  'Your email is verified',
  'You are all set, {{user_name}}.',
  'Hi {{user_name}},\n\n{{user_email}} has been verified. Your account now has full access to MarketPulse AI.',
  'Go to Dashboard',
  '{{support_url}}',
  NULL,
  1
),
(
  'password_reset_request',
  '04 — Password Reset Request',
  'Reset your MarketPulse AI password',
  'This link expires in 1 hour.',
  'We received a request to reset the password for {{user_email}}.\n\nIf this was you, use the button below to choose a new password. This link expires in 1 hour and can only be used once.\n\nIf you did not request this, you can safely ignore this email — your password will not be changed.',
  'Reset Password',
  '{{reset_url}}',
  'For your security, we never include your existing password in email.',
  1
),
(
  'password_changed',
  '05 — Password Changed',
  'Your MarketPulse AI password was changed',
  'Security confirmation for {{user_email}}.',
  'Hi {{user_name}},\n\nYour MarketPulse AI password was changed. If you made this change, no further action is needed.\n\nIf you did not perform this action, please contact support immediately using the link below.',
  'Contact Support',
  '{{support_url}}',
  NULL,
  1
),
(
  'new_login_alert',
  '06 — New Login / Security Alert',
  'New sign-in to your MarketPulse AI account',
  'A sign-in from a new location was detected.',
  'Hi {{user_name}},\n\nWe noticed a sign-in to your account from a new location:\n\nIP address: {{login_ip}}\nTime: {{login_time}}\n\nIf this was you, no action is needed. If you do not recognize this activity, please change your password immediately and contact support.',
  'Review Account Security',
  '{{support_url}}',
  NULL,
  1
),
(
  'email_changed',
  '07 — Email Address Changed',
  'Your MarketPulse AI email address was changed',
  'Security confirmation for your account.',
  'Hi {{user_name}},\n\nThe email address on your MarketPulse AI account was changed from {{old_email}} to {{new_email}}.\n\nIf you made this change, no further action is needed. If you did not request this, please contact support immediately — your account may be at risk.',
  'Contact Support',
  '{{support_url}}',
  NULL,
  1
),
(
  'ticket_created',
  '08 — Support Ticket Created',
  'We received your support request ({{ticket_id}})',
  '{{ticket_subject}}',
  'Hi {{user_name}},\n\nWe have received your support ticket and our team will respond as soon as possible.\n\nTicket: {{ticket_id}}\nSubject: {{ticket_subject}}\nStatus: {{ticket_status}}',
  'View Ticket',
  '{{support_url}}',
  NULL,
  1
),
(
  'ticket_reply',
  '09 — New Reply to Your Support Ticket',
  'New reply on ticket {{ticket_id}}',
  '{{ticket_subject}}',
  'Hi {{user_name}},\n\nOur support team has replied to your ticket.\n\nTicket: {{ticket_id}}\nSubject: {{ticket_subject}}\n\nSign in to MarketPulse AI to read the full reply and respond.',
  'View Ticket',
  '{{support_url}}',
  NULL,
  1
),
(
  'ticket_status_changed',
  '10 — Ticket Status Changed',
  'Ticket {{ticket_id}} status updated: {{ticket_status}}',
  '{{ticket_subject}}',
  'Hi {{user_name}},\n\nThe status of your support ticket has changed.\n\nTicket: {{ticket_id}}\nSubject: {{ticket_subject}}\nNew status: {{ticket_status}}',
  'View Ticket',
  '{{support_url}}',
  NULL,
  1
),
(
  'ticket_resolved',
  '11 — Ticket Resolved',
  'Your ticket {{ticket_id}} has been resolved',
  '{{ticket_subject}}',
  'Hi {{user_name}},\n\nGood news — your support ticket has been marked resolved.\n\nTicket: {{ticket_id}}\nSubject: {{ticket_subject}}\n\nIf this did not fully solve your issue, you can reopen the ticket from MarketPulse AI.',
  'View Ticket',
  '{{support_url}}',
  NULL,
  1
),
(
  'ticket_closed',
  '12 — Ticket Closed',
  'Your ticket {{ticket_id}} has been closed',
  '{{ticket_subject}}',
  'Hi {{user_name}},\n\nYour support ticket has been closed.\n\nTicket: {{ticket_id}}\nSubject: {{ticket_subject}}\n\nIf you need further help on this topic, you can open a new ticket referencing this one at any time.',
  'View Ticket',
  '{{support_url}}',
  NULL,
  1
),
(
  'admin_announcement',
  '13 — Admin / Service Announcement',
  '{{announcement_title}}',
  'An update from the MarketPulse AI team.',
  '{{announcement_body}}',
  'Go to Dashboard',
  '{{support_url}}',
  NULL,
  1
),
-- Future payment templates (§13) — seeded disabled, no trigger code exists yet.
('subscription_activated', '14 — Subscription Activated', 'Your {{plan_name}} subscription is active', NULL, 'Hi {{user_name}},\n\nYour {{plan_name}} subscription is now active.', 'View Billing', '{{support_url}}', NULL, 0),
('payment_successful', '15 — Payment Successful', 'Payment received — {{invoice_number}}', NULL, 'Hi {{user_name}},\n\nWe received your payment of {{amount}} on {{payment_date}}.', 'View Invoice', '{{support_url}}', NULL, 0),
('payment_failed', '16 — Payment Failed', 'We could not process your payment', NULL, 'Hi {{user_name}},\n\nYour payment of {{amount}} could not be processed. Please update your payment method.', 'Update Payment Method', '{{support_url}}', NULL, 0),
('subscription_renewal_reminder', '17 — Subscription Renewal Reminder', 'Your {{plan_name}} plan renews soon', NULL, 'Hi {{user_name}},\n\nYour {{plan_name}} subscription renews on {{payment_date}}.', 'Manage Subscription', '{{support_url}}', NULL, 0),
('subscription_renewed', '18 — Subscription Renewed', 'Your {{plan_name}} subscription was renewed', NULL, 'Hi {{user_name}},\n\nYour {{plan_name}} subscription has been renewed.', 'View Billing', '{{support_url}}', NULL, 0),
('subscription_expiring', '19 — Subscription Expiring', 'Your {{plan_name}} plan is expiring soon', NULL, 'Hi {{user_name}},\n\nYour {{plan_name}} subscription is expiring soon.', 'Renew Now', '{{support_url}}', NULL, 0),
('subscription_cancelled', '20 — Subscription Cancelled', 'Your subscription has been cancelled', NULL, 'Hi {{user_name}},\n\nYour {{plan_name}} subscription has been cancelled.', 'Reactivate', '{{support_url}}', NULL, 0),
('refund_processed', '21 — Refund Processed', 'Your refund has been processed — {{invoice_number}}', NULL, 'Hi {{user_name}},\n\nA refund of {{amount}} has been processed for {{invoice_number}}.', 'View Details', '{{support_url}}', NULL, 0),
('invoice_receipt', '22 — Invoice / Receipt', 'Your invoice {{invoice_number}}', NULL, 'Hi {{user_name}},\n\nYour invoice {{invoice_number}} for {{amount}} is attached/available online.', 'View Invoice', '{{support_url}}', NULL, 0),
('plan_upgraded', '23 — Plan Upgraded', 'You are now on the {{plan_name}} plan', NULL, 'Hi {{user_name}},\n\nYour account has been upgraded to {{plan_name}}.', 'View Billing', '{{support_url}}', NULL, 0),
('plan_downgraded', '24 — Plan Downgraded', 'Your plan has changed to {{plan_name}}', NULL, 'Hi {{user_name}},\n\nYour account has moved to the {{plan_name}} plan.', 'View Billing', '{{support_url}}', NULL, 0);
