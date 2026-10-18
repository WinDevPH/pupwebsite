-- Council gallery batches (academic year) with multiple labeled images
USE pup_col_sc;

CREATE TABLE IF NOT EXISTS gallery_batches (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  academic_year VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT 'Council Photographs',
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gallery_batches_year (academic_year),
  KEY idx_gallery_batches_published (is_published, academic_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gallery_images (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_id INT UNSIGNED NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  title VARCHAR(255) NOT NULL,
  caption VARCHAR(255) NOT NULL DEFAULT '',
  alt_text VARCHAR(500) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_gallery_images_batch (batch_id, sort_order, id),
  CONSTRAINT fk_gallery_images_batch
    FOREIGN KEY (batch_id) REFERENCES gallery_batches (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gallery_display_settings (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  pinned_academic_year VARCHAR(32) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO gallery_display_settings (id, pinned_academic_year)
VALUES (1, NULL)
ON DUPLICATE KEY UPDATE id = id;
