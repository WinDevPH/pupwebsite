<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/api/includes/bootstrap.php';

$pdo = api_pdo();

$pdo->exec(
    "CREATE TABLE IF NOT EXISTS council_display_settings (
      board ENUM('officers', 'commissioners', 'advisory') NOT NULL,
      pinned_academic_year VARCHAR(32) NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (board)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
);

echo "council_display_settings ready\n";
