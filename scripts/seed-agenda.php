<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/api/includes/bootstrap.php';
require_once dirname(__DIR__) . '/api/about-content-defaults.php';

$pdo = api_pdo();
$defaults = about_content_defaults();
$payload = json_encode($defaults['agenda'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$stmt = $pdo->prepare(
    'INSERT INTO about_content (section_key, payload_json)
     VALUES (\'agenda\', :payload)
     ON DUPLICATE KEY UPDATE payload_json = VALUES(payload_json)'
);
$stmt->execute(['payload' => $payload]);
echo "agenda seeded\n";
