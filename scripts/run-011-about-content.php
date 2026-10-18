<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/api/includes/bootstrap.php';
require_once dirname(__DIR__) . '/api/about-content-defaults.php';

$pdo = api_pdo();

$pdo->exec(
    "CREATE TABLE IF NOT EXISTS about_content (
      section_key VARCHAR(64) NOT NULL,
      payload_json LONGTEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (section_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
);

$count = (int) $pdo->query('SELECT COUNT(*) FROM about_content')->fetchColumn();
if ($count > 0) {
    echo "about_content already seeded ({$count} sections)\n";
    exit(0);
}

$insert = $pdo->prepare(
    'INSERT INTO about_content (section_key, payload_json)
     VALUES (:section_key, :payload_json)'
);

$defaults = about_content_defaults();
foreach ($defaults as $key => $payload) {
    $insert->execute([
        'section_key' => $key,
        'payload_json' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
}

echo 'about_content seeded: ' . count($defaults) . " sections\n";
