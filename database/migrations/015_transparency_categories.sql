-- Transparency page tabs (document categories shown on /transparency)
USE pup_col_sc;

CREATE TABLE IF NOT EXISTS transparency_categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(64) NOT NULL,
  label VARCHAR(160) NOT NULL,
  title VARCHAR(160) NOT NULL,
  accent VARCHAR(160) NOT NULL DEFAULT '',
  kicker VARCHAR(80) NOT NULL DEFAULT '',
  note VARCHAR(800) NOT NULL DEFAULT '',
  folder VARCHAR(160) NOT NULL DEFAULT '',
  series_label VARCHAR(120) NOT NULL DEFAULT '',
  icon VARCHAR(64) NOT NULL DEFAULT 'file-text',
  sort_order INT NOT NULL DEFAULT 0,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_transparency_categories_slug (slug),
  KEY idx_transparency_categories_published (is_published, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
