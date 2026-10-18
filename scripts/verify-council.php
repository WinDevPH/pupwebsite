<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/api/includes/bootstrap.php';

$rows = api_pdo()
    ->query('SELECT board, academic_year, COUNT(*) AS c FROM council_members GROUP BY board, academic_year')
    ->fetchAll(PDO::FETCH_ASSOC);

foreach ($rows as $row) {
    echo $row['board'] . ' | ' . $row['academic_year'] . ' | ' . $row['c'] . PHP_EOL;
}
