<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/api/includes/bootstrap.php';
require_once dirname(__DIR__) . '/api/includes/resource-forms.php';

$pdo = api_pdo();
resource_forms_ensure($pdo);

$groups = (int) $pdo->query('SELECT COUNT(*) FROM form_groups')->fetchColumn();
$files = (int) $pdo->query('SELECT COUNT(*) FROM form_files')->fetchColumn();
echo "resource forms ready ({$groups} group" . ($groups === 1 ? '' : 's') . ", {$files} file" . ($files === 1 ? '' : 's') . ").\n";
