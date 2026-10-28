<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/api/includes/bootstrap.php';
require_once dirname(__DIR__) . '/api/includes/resource-library.php';

$pdo = api_pdo();
resource_library_ensure($pdo);

$count = (int) $pdo->query('SELECT COUNT(*) FROM resource_links')->fetchColumn();
echo "resource library ready ({$count} link" . ($count === 1 ? '' : 's') . ").\n";
