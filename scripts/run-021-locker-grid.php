<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/api/includes/bootstrap.php';

$pdo = api_pdo();

$assigned = [
    'A-03', 'B-08', 'C-01', 'C-02', 'C-04', 'C-06', 'C-08', 'D-04', 'D-06', 'E-02', 'E-08',
];
$assignedLookup = array_fill_keys($assigned, true);
$rows = ['A', 'B', 'C', 'D', 'E'];

$pdo->exec("DELETE FROM shop_items WHERE shop = 'locker'");

$insert = $pdo->prepare(
    'INSERT INTO shop_items
      (shop, item_key, name, price, unit, stock, image_url, alt_text, number_label, availability, sort_order, is_published)
     VALUES
      (:shop, :item_key, :name, :price, :unit, :stock, :image_url, :alt_text, :number_label, :availability, :sort_order, 1)'
);

function locker_new_rental_price(string $row): float
{
    if ($row === 'D') {
        return 450.00;
    }
    if ($row === 'E') {
        return 350.00;
    }
    return 600.00;
}

$count = 0;
foreach ($rows as $rowIndex => $row) {
    for ($col = 1; $col <= 12; $col++) {
        $code = sprintf('%s-%02d', $row, $col);
        $insert->execute([
            'shop' => 'locker',
            'item_key' => strtolower($code),
            'name' => 'Locker ' . $code,
            'price' => locker_new_rental_price($row),
            'unit' => 'per rental period',
            'stock' => 1,
            'image_url' => '/shop/locker-bay.jpg',
            'alt_text' => 'Locker ' . $code,
            'number_label' => $code,
            'availability' => isset($assignedLookup[$code]) ? 'reserved' : null,
            'sort_order' => ($rowIndex * 12) + $col,
        ]);
        $count++;
    }
}

echo "locker grid ready ({$count} lockers).\n";
