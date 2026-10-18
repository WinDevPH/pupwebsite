-- Shop reservations (locker / merch)
USE pup_col_sc;

CREATE TABLE IF NOT EXISTS shop_reservations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(32) NOT NULL,
  shop VARCHAR(32) NOT NULL,
  shop_item_id INT UNSIGNED NULL,
  item_key VARCHAR(64) NOT NULL DEFAULT '',
  item_name VARCHAR(255) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  customer_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL DEFAULT '',
  mobile VARCHAR(64) NOT NULL DEFAULT '',
  student_id VARCHAR(64) NOT NULL DEFAULT '',
  year_level VARCHAR(64) NOT NULL DEFAULT '',
  remarks TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'submitted',
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_shop_reservations_code (code),
  KEY idx_shop_reservations_shop (shop, status, submitted_at),
  KEY idx_shop_reservations_status (status, submitted_at),
  KEY idx_shop_reservations_item (shop_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
