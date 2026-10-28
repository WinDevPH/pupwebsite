<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/api/includes/bootstrap.php';

$pdo = api_pdo();

$updates = [
    ['A', 600.00],
    ['B', 600.00],
    ['C', 600.00],
    ['D', 450.00],
    ['E', 350.00],
];

$stmt = $pdo->prepare(
    "UPDATE shop_items
        SET price = :price, unit = 'per rental period'
      WHERE shop = 'locker'
        AND UPPER(LEFT(COALESCE(number_label, item_key), 1)) = :row"
);

$total = 0;
foreach ($updates as [$row, $price]) {
    $stmt->execute([
        'price' => $price,
        'row' => $row,
    ]);
    $total += $stmt->rowCount();
}

echo "locker rates updated ({$total} lockers).\n";
