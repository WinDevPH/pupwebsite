-- Announcements bulletin
USE pup_col_sc;

CREATE TABLE IF NOT EXISTS announcements (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(191) NOT NULL,
  kind ENUM('issuance', 'event', 'social') NOT NULL DEFAULT 'issuance',
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NULL,
  image_url VARCHAR(500) NOT NULL,
  link_url VARCHAR(500) NULL,
  is_external TINYINT(1) NOT NULL DEFAULT 0,
  source VARCHAR(191) NULL,
  published_at DATETIME NOT NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_announcements_slug (slug),
  KEY idx_announcements_published (is_published, published_at),
  KEY idx_announcements_kind (kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO announcements
  (slug, kind, title, summary, body, image_url, link_url, is_external, source, published_at, is_published)
VALUES
  (
    'general-assembly',
    'event',
    'General Assembly for the first semester',
    'Call for all law students. The council presents the semester plan and opens the floor for concerns.',
    NULL,
    '/announcements/assembly.jpg',
    NULL,
    0,
    NULL,
    '2026-10-18 14:00:00',
    1
  ),
  (
    'enrollment-advisory',
    'issuance',
    'Advisory on the enrollment period',
    'Enrollment dates, required documents, and where to raise a concern before the period closes.',
    NULL,
    '/announcements/enrollment.jpg',
    NULL,
    0,
    NULL,
    '2026-10-06 09:00:00',
    1
  ),
  (
    'town-hall',
    'social',
    'Town hall notes, posted on Facebook',
    'Questions from the open forum and the council’s answers, posted on the official Facebook page.',
    NULL,
    '/announcements/town-hall.jpg',
    'https://www.facebook.com/pupcl.sc',
    1,
    'Facebook /pupcl.sc',
    '2026-10-10 16:44:00',
    1
  ),
  (
    'legal-aid',
    'event',
    'Legal Aid Clinic schedule',
    'Free consultations for students. Clinic days, hours, and how to book a slot are listed here.',
    NULL,
    '/announcements/legal-aid.jpg',
    NULL,
    0,
    NULL,
    '2026-09-28 10:00:00',
    1
  ),
  (
    'consultation-hours',
    'issuance',
    'Memorandum on consultation hours',
    'The days and hours students may meet their professors for academic consultation.',
    NULL,
    '/announcements/consultation.jpg',
    NULL,
    0,
    NULL,
    '2026-09-20 15:30:00',
    1
  ),
  (
    'handbook-update',
    'issuance',
    'Student handbook update for the term',
    'Revisions for this term, including the policies every student is expected to review.',
    NULL,
    '/announcements/handbook.jpg',
    NULL,
    0,
    NULL,
    '2026-09-12 11:15:00',
    1
  ),
  (
    'printing-schedule',
    'event',
    'Free printing service schedule',
    'Open days, hours, and the page limit for the council’s free printing service.',
    NULL,
    '/announcements/printing.jpg',
    NULL,
    0,
    NULL,
    '2026-09-08 13:00:00',
    1
  ),
  (
    'council-recap',
    'social',
    'Week in review from the council page',
    'Council work, events, and posts from the past week, shared from the official page.',
    NULL,
    '/announcements/recap.jpg',
    'https://www.facebook.com/pupcl.sc',
    1,
    'Facebook /pupcl.sc',
    '2026-09-05 18:20:00',
    1
  )
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  summary = VALUES(summary),
  image_url = VALUES(image_url),
  published_at = VALUES(published_at),
  is_published = VALUES(is_published);

-- Admin demo for managing bulletin content: admin@pup.edu.ph / password123
INSERT INTO users (email, password_hash, full_name, student_number, year_level, role, is_active)
VALUES (
  'admin@pup.edu.ph',
  '$2y$10$UkCVdkT9FFiGChJTs6M9juZMobMYgq8B.HY8mDHJxgQcpiH1AC6xa',
  'Council Admin',
  NULL,
  NULL,
  'admin',
  1
)
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  full_name = VALUES(full_name),
  role = 'admin',
  is_active = 1;
