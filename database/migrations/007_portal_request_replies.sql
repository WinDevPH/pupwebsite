-- Admin replies to portal requests (sent outbound mail copies)
USE pup_col_sc;

CREATE TABLE IF NOT EXISTS portal_request_replies (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id INT UNSIGNED NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body_html MEDIUMTEXT NOT NULL,
  body_text TEXT NOT NULL,
  attachments_json JSON NULL,
  sent_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_portal_request_replies_request (request_id),
  KEY idx_portal_request_replies_created (created_at),
  CONSTRAINT fk_portal_request_replies_request
    FOREIGN KEY (request_id) REFERENCES portal_requests (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
