-- Market Pulse AI — schema for shared hosting (Hostinger / cPanel).
--
-- No CREATE DATABASE / USE: on shared hosting your MySQL user may only
-- access the database the panel already made for you. Before importing,
-- SELECT that database in phpMyAdmin (e.g. u371102514_trading) so these
-- tables land inside it. Then use the Import tab and pick this file.

SET FOREIGN_KEY_CHECKS = 0;

-- ── Roles & permissions ──────────────────────────────────────

CREATE TABLE `roles` (
  `id` int unsigned AUTO_INCREMENT NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` varchar(255),
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `roles_id` PRIMARY KEY(`id`),
  CONSTRAINT `roles_name_unique` UNIQUE(`name`)
);

CREATE TABLE `permissions` (
  `id` int unsigned AUTO_INCREMENT NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` varchar(255),
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
  CONSTRAINT `permissions_name_unique` UNIQUE(`name`)
);

CREATE TABLE `role_permissions` (
  `role_id` int unsigned NOT NULL,
  `permission_id` int unsigned NOT NULL,
  CONSTRAINT `role_permissions_role_id_permission_id_pk` PRIMARY KEY(`role_id`,`permission_id`)
);

-- ── Users ────────────────────────────────────────────────────

CREATE TABLE `users` (
  `id` bigint unsigned AUTO_INCREMENT NOT NULL,
  `name` varchar(120) NOT NULL,
  `email` varchar(190) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role_id` int unsigned NOT NULL,
  `plan` enum('free','pro','premium') NOT NULL DEFAULT 'free',
  `status` enum('active','suspended') NOT NULL DEFAULT 'active',
  `email_verified_at` timestamp NULL,
  `last_login_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `users_id` PRIMARY KEY(`id`),
  CONSTRAINT `users_email_unique` UNIQUE(`email`)
);

CREATE TABLE `user_profiles` (
  `id` bigint unsigned AUTO_INCREMENT NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `avatar_url` varchar(500),
  `phone` varchar(20),
  `bio` varchar(500),
  `timezone` varchar(50) NOT NULL DEFAULT 'Asia/Kolkata',
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `user_profiles_id` PRIMARY KEY(`id`),
  CONSTRAINT `user_profiles_user_id_unique` UNIQUE(`user_id`)
);

-- ── Auth: sessions, resets, verification ─────────────────────

CREATE TABLE `login_history` (
  `id` bigint unsigned AUTO_INCREMENT NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `ip_address` varchar(45),
  `user_agent` varchar(255),
  `status` enum('success','failed') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `login_history_id` PRIMARY KEY(`id`)
);

CREATE TABLE `password_resets` (
  `id` bigint unsigned AUTO_INCREMENT NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT (now()),
  `used_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `password_resets_id` PRIMARY KEY(`id`)
);

CREATE TABLE `remember_tokens` (
  `id` bigint unsigned AUTO_INCREMENT NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `selector` char(24) NOT NULL,
  `validator_hash` char(64) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT (now()),
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `remember_tokens_id` PRIMARY KEY(`id`),
  CONSTRAINT `remember_tokens_selector_unique` UNIQUE(`selector`)
);

CREATE TABLE `email_verifications` (
  `id` bigint unsigned AUTO_INCREMENT NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT (now()),
  `verified_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `email_verifications_id` PRIMARY KEY(`id`)
);

-- ── App data ─────────────────────────────────────────────────

CREATE TABLE `watchlist` (
  `id` bigint unsigned AUTO_INCREMENT NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `symbol` varchar(30) NOT NULL,
  `added_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `watchlist_id` PRIMARY KEY(`id`),
  CONSTRAINT `uq_watchlist_user_symbol` UNIQUE(`user_id`,`symbol`)
);

CREATE TABLE `portfolio` (
  `id` bigint unsigned AUTO_INCREMENT NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `symbol` varchar(30) NOT NULL,
  `exchange` varchar(10) NOT NULL DEFAULT 'NSE',
  `buy_price` decimal(14,4),
  `quantity` int,
  `added_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `portfolio_id` PRIMARY KEY(`id`),
  CONSTRAINT `uq_portfolio_user_symbol` UNIQUE(`user_id`,`symbol`)
);

CREATE TABLE `upstox_settings` (
  `id` bigint unsigned AUTO_INCREMENT NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `api_key` varchar(255) NOT NULL,
  `api_secret` varchar(255),
  `client_id` varchar(100),
  `access_token` varchar(500),
  `live_data_enabled` boolean NOT NULL DEFAULT true,
  `connected_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `upstox_settings_id` PRIMARY KEY(`id`),
  CONSTRAINT `upstox_settings_user_id_unique` UNIQUE(`user_id`)
);

-- ── Foreign keys ─────────────────────────────────────────────

ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_permissions_id_fk` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `login_history` ADD CONSTRAINT `login_history_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `password_resets` ADD CONSTRAINT `password_resets_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `remember_tokens` ADD CONSTRAINT `remember_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `email_verifications` ADD CONSTRAINT `email_verifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `watchlist` ADD CONSTRAINT `watchlist_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `portfolio` ADD CONSTRAINT `portfolio_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `upstox_settings` ADD CONSTRAINT `upstox_settings_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;

-- ── Seed data ────────────────────────────────────────────────

INSERT INTO `roles` (`id`, `name`, `description`) VALUES
  (1, 'admin', 'Full system access — user management, system monitor'),
  (2, 'user', 'Standard end-user access to the dashboard');

INSERT INTO `permissions` (`id`, `name`, `description`) VALUES
  (1, 'users.manage', 'Create, update, delete user accounts'),
  (2, 'users.view', 'View user accounts'),
  (3, 'dashboard.view', 'View the trading dashboard'),
  (4, 'watchlist.manage', 'Add/remove watchlist symbols'),
  (5, 'portfolio.manage', 'Add/remove portfolio holdings'),
  (6, 'settings.manage', 'Manage own account/API settings'),
  (7, 'system.monitor', 'View system health / admin monitor panel');

INSERT INTO `role_permissions` (`role_id`, `permission_id`) VALUES
  (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7),
  (2, 3), (2, 4), (2, 5), (2, 6);

SET FOREIGN_KEY_CHECKS = 1;
