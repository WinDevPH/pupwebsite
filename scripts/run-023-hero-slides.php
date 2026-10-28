<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/api/includes/bootstrap.php';
require_once dirname(__DIR__) . '/api/includes/hero-slides.php';

$pdo = api_pdo();
$count = hero_slides_seed_if_empty($pdo);

echo "hero slides ready ({$count} slide" . ($count === 1 ? '' : 's') . ").\n";
