<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/api/includes/bootstrap.php';
require_once dirname(__DIR__) . '/api/includes/transparency-categories.php';

$pdo = api_pdo();
transparency_categories_ensure($pdo);

$count = (int) $pdo->query('SELECT COUNT(*) FROM transparency_categories')->fetchColumn();
echo "transparency_categories ready ({$count} tab" . ($count === 1 ? '' : 's') . ").\n";
