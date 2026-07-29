-- Holding Stocks scan history (MP-HOLD-001).
--
-- Additive migration: no existing table is touched. Apply this by hand on the
-- MySQL instance, the same way nse_pulse_hostinger.sql is applied — the app
-- never runs DDL at runtime, and the Holding Stocks module works (without
-- history) if these tables are absent.
--
-- Forward-return columns are intentionally NOT stored. They are derived on read
-- from the real daily price series between scanned_at and today, so a window
-- that has not elapsed yet reports NULL instead of a fabricated number.

CREATE TABLE IF NOT EXISTS `holding_scans` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `universe`   VARCHAR(32)  NOT NULL,
  `scanned_at` DATETIME     NOT NULL,
  `pick_count` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_universe_scanned_at` (`universe`, `scanned_at`),
  KEY `idx_scanned_at` (`scanned_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `holding_scan_picks` (
  `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `scan_id`          INT UNSIGNED NOT NULL,
  `symbol`           VARCHAR(32)  NOT NULL,
  `name`             VARCHAR(128) NOT NULL,
  `scan_price`       DECIMAL(12,2) NOT NULL,
  `score`            TINYINT UNSIGNED NOT NULL,
  -- Per-category breakdown as JSON, so a score can be audited after the fact
  -- even if the scoring weights change in a later release.
  `score_components` JSON         NULL,
  `classification`   VARCHAR(24)  NOT NULL,
  `risk_level`       VARCHAR(12)  NOT NULL,
  -- The evidence sentences shown at scan time, frozen for the record.
  `reasons`          JSON         NULL,
  `created_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_scan_symbol` (`scan_id`, `symbol`),
  KEY `idx_symbol` (`symbol`),
  CONSTRAINT `fk_holding_pick_scan`
    FOREIGN KEY (`scan_id`) REFERENCES `holding_scans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
