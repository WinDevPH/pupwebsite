<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/api/includes/bootstrap.php';

$pdo = api_pdo();

$exists = $pdo->query("SHOW COLUMNS FROM users LIKE 'avatar_url'")->fetch();
if (!$exists) {
    $pdo->exec('ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL AFTER year_level');
    echo "users.avatar_url added.\n";
} else {
    echo "users.avatar_url already exists.\n";
}
