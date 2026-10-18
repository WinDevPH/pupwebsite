-- About the Council content (mission, vision, values, goals, mandate, history)
USE pup_col_sc;

CREATE TABLE IF NOT EXISTS about_content (
  section_key VARCHAR(64) NOT NULL,
  payload_json LONGTEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (section_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
