<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/api/includes/bootstrap.php';

$pdo = api_pdo();
$cleared = $pdo->exec(
    "UPDATE shop_items
     SET availability = NULL
     WHERE shop = 'locker'
       AND availability = 'reserved'"
);

echo 'cleared seed reserved lockers: ' . (int) $cleared . PHP_EOL;
