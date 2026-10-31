<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/api/includes/bootstrap.php';

$pdo = api_pdo();

$exists = $pdo->query("SHOW COLUMNS FROM shop_reservations LIKE 'rental_type'")->fetch();
if (!$exists) {
    $pdo->exec(
        "ALTER TABLE shop_reservations
         ADD COLUMN rental_type VARCHAR(16) NOT NULL DEFAULT 'new' AFTER item_name"
    );
    echo "shop_reservations.rental_type added.\n";
} else {
    echo "shop_reservations.rental_type already exists.\n";
}
