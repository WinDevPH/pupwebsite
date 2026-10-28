<?php

declare(strict_types=1);

/** @var list<string> */
const PROJECT_CATEGORY_SLUGS = [
    'internal-affairs',
    'external-linkages',
    'institutional-sustainability',
];

function project_categories_ensure(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $category = $pdo->query("SHOW COLUMNS FROM projects LIKE 'category'")->fetch();
    if (!$category) {
        $pdo->exec(
            "ALTER TABLE projects
             ADD COLUMN category VARCHAR(64) NOT NULL DEFAULT 'internal-affairs' AFTER slug"
        );
        $pdo->exec(
            'ALTER TABLE projects ADD KEY idx_projects_category (category, is_published, sort_order)'
        );
    }

    $images = $pdo->query("SHOW COLUMNS FROM projects LIKE 'images_json'")->fetch();
    if (!$images) {
        $pdo->exec('ALTER TABLE projects ADD COLUMN images_json JSON NULL AFTER image_url');
        $pdo->exec(
            "UPDATE projects
             SET images_json = JSON_ARRAY(image_url)
             WHERE (images_json IS NULL OR JSON_TYPE(images_json) = 'NULL')
               AND image_url <> ''"
        );
    }

    $ready = true;
}

function project_category_normalize(mixed $value): ?string
{
    $slug = strtolower(trim((string) $value));
    return in_array($slug, PROJECT_CATEGORY_SLUGS, true) ? $slug : null;
}

/** @return list<string> */
function project_images_decode(mixed $raw, string $fallback = ''): array
{
    if (is_string($raw)) {
        $decoded = json_decode($raw, true);
    } else {
        $decoded = $raw;
    }

    $images = [];
    if (is_array($decoded)) {
        foreach ($decoded as $item) {
            $url = trim((string) $item);
            if ($url !== '' && !in_array($url, $images, true)) {
                $images[] = $url;
            }
        }
    }

    $cover = trim($fallback);
    if ($cover !== '' && !in_array($cover, $images, true)) {
        array_unshift($images, $cover);
    }

    return $images;
}
