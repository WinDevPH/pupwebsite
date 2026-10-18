-- PUP College of Law Student Council — auth schema
-- Import via phpMyAdmin or: mysql -u root < database/schema.sql

CREATE DATABASE IF NOT EXISTS pup_col_sc
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pup_col_sc;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(191) NOT NULL,
  student_number VARCHAR(64) NULL,
  year_level TINYINT UNSIGNED NULL,
  role ENUM('student', 'officer', 'admin') NOT NULL DEFAULT 'student',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id CHAR(64) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  remember TINYINT(1) NOT NULL DEFAULT 0,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_auth_sessions_user (user_id),
  KEY idx_auth_sessions_expires (expires_at),
  CONSTRAINT fk_auth_sessions_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ip_address VARCHAR(45) NOT NULL,
  email VARCHAR(191) NULL,
  succeeded TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_login_attempts_ip_created (ip_address, created_at),
  KEY idx_login_attempts_email_created (email, created_at),
  KEY idx_login_attempts_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Demo account: student@pup.edu.ph / password123
INSERT INTO users (email, password_hash, full_name, student_number, year_level, role, is_active)
VALUES (
  'student@pup.edu.ph',
  '$2y$10$UkCVdkT9FFiGChJTs6M9juZMobMYgq8B.HY8mDHJxgQcpiH1AC6xa',
  'Demo Law Student',
  '2026-00001',
  1,
  'student',
  1
)
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  full_name = VALUES(full_name),
  is_active = 1;
