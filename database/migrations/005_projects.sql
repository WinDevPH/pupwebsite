-- Student Council projects & initiatives
USE pup_col_sc;

CREATE TABLE IF NOT EXISTS projects (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(191) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NULL,
  image_url VARCHAR(500) NOT NULL,
  icon VARCHAR(64) NOT NULL DEFAULT 'folder-kanban',
  links_json JSON NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_projects_slug (slug),
  KEY idx_projects_published (is_published, sort_order),
  KEY idx_projects_sort (sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO projects
  (slug, title, summary, body, image_url, icon, links_json, sort_order, is_published)
VALUES
  (
    'board-meetings',
    'Board Meetings',
    'Policy Guidelines on the Conduct of Board Meetings and other Assemblies is Board Resolution No. 005, Series of 2026.',
    NULL,
    '/projects/board-meetings.jpg',
    'calendar-check',
    JSON_ARRAY(
      JSON_OBJECT('label', 'Board Resolution No. 005', 'href', 'https://bit.ly/BoardResolution005s2026'),
      JSON_OBJECT('label', 'Legislative', 'to', '/governance/legislative')
    ),
    1,
    1
  ),
  (
    'lex-in-motion',
    'Lex in Motion',
    'Updates for this project are posted on the bulletin and the official Facebook page.',
    NULL,
    '/projects/lex-in-motion.jpg',
    'megaphone',
    JSON_ARRAY(
      JSON_OBJECT('label', 'Bulletin', 'to', '/#bulletin'),
      JSON_OBJECT('label', 'Contact the Council', 'to', '/#contact')
    ),
    2,
    1
  ),
  (
    'free-printing',
    'Free Printing Service',
    'Open days, hours, and the page limit for the council''s free printing service.',
    NULL,
    '/projects/free-printing.jpg',
    'printer',
    JSON_ARRAY(
      JSON_OBJECT('label', 'Free printing service schedule', 'to', '/announcements/printing-schedule'),
      JSON_OBJECT('label', 'Contact the Council', 'to', '/#contact')
    ),
    3,
    1
  ),
  (
    'wifi-library',
    'WiFi Library',
    'Updates for this project are posted on the bulletin and the official Facebook page.',
    NULL,
    '/projects/wifi-library.jpg',
    'wifi',
    JSON_ARRAY(
      JSON_OBJECT('label', 'Bulletin', 'to', '/#bulletin'),
      JSON_OBJECT('label', 'Contact the Council', 'to', '/#contact')
    ),
    4,
    1
  ),
  (
    'online-study-hub',
    'Online Study Hub',
    'Updates for this project are posted on the bulletin and the official Facebook page.',
    NULL,
    '/projects/online-study-hub.jpg',
    'book-open',
    JSON_ARRAY(
      JSON_OBJECT('label', 'Bulletin', 'to', '/#bulletin'),
      JSON_OBJECT('label', 'Contact the Council', 'to', '/#contact')
    ),
    5,
    1
  ),
  (
    'jd-buddies',
    'JD Buddies',
    'Updates for this project are posted on the bulletin and the official Facebook page.',
    NULL,
    '/projects/jd-buddies.jpg',
    'users',
    JSON_ARRAY(
      JSON_OBJECT('label', 'Bulletin', 'to', '/#bulletin'),
      JSON_OBJECT('label', 'Contact the Council', 'to', '/#contact')
    ),
    6,
    1
  )
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  summary = VALUES(summary),
  body = VALUES(body),
  image_url = VALUES(image_url),
  icon = VALUES(icon),
  links_json = VALUES(links_json),
  sort_order = VALUES(sort_order),
  is_published = VALUES(is_published);
