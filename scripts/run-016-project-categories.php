<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/api/includes/bootstrap.php';
require_once dirname(__DIR__) . '/api/includes/project-categories.php';

$pdo = api_pdo();
project_categories_ensure($pdo);

$count = (int) $pdo->query('SELECT COUNT(*) FROM projects')->fetchColumn();
echo "projects category columns ready ({$count} project" . ($count === 1 ? '' : 's') . ").\n";
