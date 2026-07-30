-- Market Pulse AI — MP-ACCOUNT-001 Phase 2: Support Ticket Center.
--
-- Additive-only, like lib/db/holding_stocks.sql and lib/db/account_upgrade.sql:
-- every statement is CREATE TABLE IF NOT EXISTS, safe to run against a live
-- database with real users. Apply by hand via phpMyAdmin (or the XAMPP MySQL
-- console locally) — nothing in the application creates or alters tables at
-- runtime. Every route/accessor that touches these tables degrades to a safe
-- fallback until this file has been applied (see withSchemaFallback in
-- lib/db/src/index.ts).

CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id` bigint unsigned AUTO_INCREMENT NOT NULL,
  -- Human-readable display id (e.g. MP-2026-000123), derived from `id` right
  -- after insert (nullable so the insert-then-update has no race: MySQL/
  -- MariaDB UNIQUE indexes allow any number of NULLs). Never used as an
  -- authorization key — every lookup/route guard goes through the numeric
  -- `id` + `user_id`, per the spec's explicit warning against using the
  -- public ticket number that way.
  `ticket_number` varchar(24),
  `user_id` bigint unsigned NOT NULL,
  `category` enum(
    'account_login','technical_issue','market_data','ai_signals',
    'holding_stocks','intraday','options','commodities',
    'subscription_billing','payment','feature_request','feedback','other'
  ) NOT NULL,
  `subject` varchar(200) NOT NULL,
  `description` text NOT NULL,
  `priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  `status` enum('open','waiting_admin','waiting_user','resolved','closed') NOT NULL DEFAULT 'open',
  `assigned_admin_id` bigint unsigned,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `resolved_at` timestamp NULL,
  `closed_at` timestamp NULL,
  CONSTRAINT `support_tickets_id` PRIMARY KEY (`id`),
  CONSTRAINT `support_tickets_ticket_number_unique` UNIQUE (`ticket_number`)
);

-- One row per message in the conversation, both user and admin authored.
CREATE TABLE IF NOT EXISTS `support_messages` (
  `id` bigint unsigned AUTO_INCREMENT NOT NULL,
  `ticket_id` bigint unsigned NOT NULL,
  `author_user_id` bigint unsigned NOT NULL,
  `is_admin_reply` tinyint(1) NOT NULL DEFAULT 0,
  `body` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `support_messages_id` PRIMARY KEY (`id`),
  KEY `support_messages_ticket_id_idx` (`ticket_id`)
);

-- Admin-only notes. Never surfaced on any user-facing route.
CREATE TABLE IF NOT EXISTS `support_internal_notes` (
  `id` bigint unsigned AUTO_INCREMENT NOT NULL,
  `ticket_id` bigint unsigned NOT NULL,
  `admin_user_id` bigint unsigned NOT NULL,
  `body` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `support_internal_notes_id` PRIMARY KEY (`id`),
  KEY `support_internal_notes_ticket_id_idx` (`ticket_id`)
);

-- Assignment history (who was assigned, by whom, when) — support_tickets.
-- assigned_admin_id is a denormalized "current assignee" pointer kept in sync
-- so ticket-queue queries don't need a join; this table is the audit trail.
CREATE TABLE IF NOT EXISTS `support_assignments` (
  `id` bigint unsigned AUTO_INCREMENT NOT NULL,
  `ticket_id` bigint unsigned NOT NULL,
  `admin_user_id` bigint unsigned NOT NULL,
  `assigned_by` bigint unsigned NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `support_assignments_id` PRIMARY KEY (`id`),
  KEY `support_assignments_ticket_id_idx` (`ticket_id`)
);

-- Foreign keys, guarded so a re-run of this file never errors (MySQL/MariaDB
-- don't support "ADD CONSTRAINT IF NOT EXISTS"). Deliberately not a stored
-- procedure/loop — shared hosting MySQL users don't always have CREATE
-- ROUTINE privileges, so this repeats the same guarded-prepared-statement
-- shape account_upgrade.sql already uses, once per constraint.

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'support_tickets_user_id_users_id_fk');
SET @sql := IF(@fk = 0, 'ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'support_tickets_assigned_admin_id_users_id_fk');
SET @sql := IF(@fk = 0, 'ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_assigned_admin_id_users_id_fk` FOREIGN KEY (`assigned_admin_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'support_messages_ticket_id_support_tickets_id_fk');
SET @sql := IF(@fk = 0, 'ALTER TABLE `support_messages` ADD CONSTRAINT `support_messages_ticket_id_support_tickets_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'support_messages_author_user_id_users_id_fk');
SET @sql := IF(@fk = 0, 'ALTER TABLE `support_messages` ADD CONSTRAINT `support_messages_author_user_id_users_id_fk` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'support_internal_notes_ticket_id_support_tickets_id_fk');
SET @sql := IF(@fk = 0, 'ALTER TABLE `support_internal_notes` ADD CONSTRAINT `support_internal_notes_ticket_id_support_tickets_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'support_internal_notes_admin_user_id_users_id_fk');
SET @sql := IF(@fk = 0, 'ALTER TABLE `support_internal_notes` ADD CONSTRAINT `support_internal_notes_admin_user_id_users_id_fk` FOREIGN KEY (`admin_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'support_assignments_ticket_id_support_tickets_id_fk');
SET @sql := IF(@fk = 0, 'ALTER TABLE `support_assignments` ADD CONSTRAINT `support_assignments_ticket_id_support_tickets_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'support_assignments_admin_user_id_users_id_fk');
SET @sql := IF(@fk = 0, 'ALTER TABLE `support_assignments` ADD CONSTRAINT `support_assignments_admin_user_id_users_id_fk` FOREIGN KEY (`admin_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'support_assignments_assigned_by_users_id_fk');
SET @sql := IF(@fk = 0, 'ALTER TABLE `support_assignments` ADD CONSTRAINT `support_assignments_assigned_by_users_id_fk` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
