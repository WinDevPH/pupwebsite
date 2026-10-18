-- Portal student service requests
USE pup_col_sc;

CREATE TABLE IF NOT EXISTS portal_requests (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tracking_id VARCHAR(32) NOT NULL,
  sender_name VARCHAR(255) NOT NULL,
  sender_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  attachment_name VARCHAR(255) NOT NULL,
  attachment_path VARCHAR(500) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Submitted',
  mail_sent TINYINT(1) NOT NULL DEFAULT 0,
  mail_error TEXT NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_portal_requests_tracking (tracking_id),
  KEY idx_portal_requests_email (sender_email),
  KEY idx_portal_requests_created (created_at),
  KEY idx_portal_requests_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
