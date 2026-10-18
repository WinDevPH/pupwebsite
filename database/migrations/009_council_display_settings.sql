-- Which academic year each council board shows on the public The Council page.
-- NULL pinned_academic_year = auto (latest published year).
USE pup_col_sc;

CREATE TABLE IF NOT EXISTS council_display_settings (
  board ENUM('officers', 'commissioners', 'advisory') NOT NULL,
  pinned_academic_year VARCHAR(32) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (board)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
