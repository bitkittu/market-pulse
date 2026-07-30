-- Market Pulse AI — MP-ACCOUNT-001 Phase 3: notification preferences.
--
-- Additive-only, same convention as account_upgrade.sql / support_center.sql.
-- Apply by hand via phpMyAdmin — nothing in the application creates or alters
-- tables at runtime.
--
-- Note: `user_profiles` (avatar_url/phone/bio/timezone) is NOT part of this
-- file — it already exists in the base schema (nse_pulse.sql /
-- nse_pulse_hostinger.sql) on every install, local and production; it simply
-- had no code touching it until this phase.

CREATE TABLE IF NOT EXISTS `user_notification_preferences` (
  `user_id` bigint unsigned NOT NULL,
  -- Security and transactional emails (verification, password reset/changed,
  -- ticket notifications, new-login alerts) are never gated by these — they
  -- always send. These toggles only apply to future non-critical broadcast
  -- email (market digests, product announcements); nothing sends against
  -- them automatically yet, since no such broadcast job exists.
  `market_alerts` tinyint(1) NOT NULL DEFAULT 1,
  `product_updates` tinyint(1) NOT NULL DEFAULT 1,
  `support_updates` tinyint(1) NOT NULL DEFAULT 1,
  `billing_updates` tinyint(1) NOT NULL DEFAULT 1,
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `user_notification_preferences_user_id` PRIMARY KEY (`user_id`)
);

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'user_notification_preferences_user_id_users_id_fk');
SET @sql := IF(@fk = 0, 'ALTER TABLE `user_notification_preferences` ADD CONSTRAINT `user_notification_preferences_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
