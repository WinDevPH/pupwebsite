<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/api/includes/bootstrap.php';

$root = api_project_root();
$moved = 0;

$jobs = [
    ['public/announcements/uploads', 'public/uploads/announcements'],
    ['public/announcements', 'public/uploads/announcements'],
    ['public/hero/seed', 'public/uploads/hero'],
    ['public/hero/uploads', 'public/uploads/hero'],
    ['public/gallery/seed', 'public/uploads/gallery'],
    ['public/gallery/uploads', 'public/uploads/gallery'],
    ['public/council/people', 'public/uploads/council'],
    ['public/council/uploads', 'public/uploads/council'],
    ['public/shop/uploads', 'public/uploads/shop'],
    ['public/shop', 'public/uploads/shop'],
    ['public/projects/uploads', 'public/uploads/projects'],
    ['public/projects', 'public/uploads/projects'],
    ['public/calendar/defaults', 'public/uploads/calendar'],
    ['public/calendar/uploads', 'public/uploads/calendar'],
    ['public/org-logos', 'public/uploads/org-logos'],
    ['public/users/uploads', 'public/uploads/users'],
    ['release/announcements/uploads', 'release/uploads/announcements'],
    ['release/announcements', 'release/uploads/announcements'],
    ['release/hero/seed', 'release/uploads/hero'],
    ['release/hero/uploads', 'release/uploads/hero'],
    ['release/gallery/seed', 'release/uploads/gallery'],
    ['release/gallery/uploads', 'release/uploads/gallery'],
    ['release/council/people', 'release/uploads/council'],
    ['release/council/uploads', 'release/uploads/council'],
    ['release/shop/uploads', 'release/uploads/shop'],
    ['release/shop', 'release/uploads/shop'],
    ['release/projects/uploads', 'release/uploads/projects'],
    ['release/projects', 'release/uploads/projects'],
    ['release/calendar/defaults', 'release/uploads/calendar'],
    ['release/calendar/uploads', 'release/uploads/calendar'],
    ['release/org-logos', 'release/uploads/org-logos'],
    ['release/users/uploads', 'release/uploads/users'],
];

function migrate_is_picture(string $name): bool
{
    return (bool) preg_match('/\.(jpe?g|png|webp|gif|svg)$/i', $name);
}

function migrate_copy_dir(string $from, string $to, int &$moved): void
{
    if (!is_dir($from)) {
        return;
    }
    if (!is_dir($to) && !mkdir($to, 0755, true) && !is_dir($to)) {
        fwrite(STDERR, "Could not create {$to}\n");
        return;
    }
    $items = scandir($from) ?: [];
    foreach ($items as $name) {
        if ($name === '.' || $name === '..' || $name === '.gitkeep') {
            continue;
        }
        $src = $from . DIRECTORY_SEPARATOR . $name;
        if (!is_file($src) || !migrate_is_picture($name)) {
            continue;
        }
        $dest = $to . DIRECTORY_SEPARATOR . $name;
        if (!is_file($dest) && !copy($src, $dest)) {
            fwrite(STDERR, "Could not copy {$src}\n");
            continue;
        }
        if (is_file($dest)) {
            unlink($src);
        }
        $moved++;
    }
}

function migrate_rmdir(string $dir): void
{
    if (!is_dir($dir)) {
        return;
    }
    $items = scandir($dir) ?: [];
    foreach ($items as $name) {
        if ($name === '.' || $name === '..') {
            continue;
        }
        $path = $dir . DIRECTORY_SEPARATOR . $name;
        if (is_dir($path)) {
            migrate_rmdir($path);
            continue;
        }
        unlink($path);
    }
    rmdir($dir);
}

foreach ($jobs as [$from, $to]) {
    migrate_copy_dir($root . '/' . $from, $root . '/' . $to, $moved);
}

$cleanup = [
    'public/announcements',
    'public/hero',
    'public/gallery',
    'public/council',
    'public/shop',
    'public/projects',
    'public/calendar',
    'public/org-logos',
    'public/users',
    'release/announcements',
    'release/hero',
    'release/gallery',
    'release/council',
    'release/shop',
    'release/projects',
    'release/calendar',
    'release/org-logos',
    'release/users',
];

foreach ($cleanup as $relative) {
    migrate_rmdir($root . '/' . $relative);
}

echo "Moved {$moved} picture(s) into uploads/.\n";

function migrate_public_url(string $url): string
{
    $url = trim($url);
    if ($url === '' || str_starts_with($url, '/uploads/') || preg_match('#^https?://#i', $url)) {
        return $url;
    }

    $rules = [
        ['#^/(announcements|calendar|projects|council|gallery|hero|users|shop)/uploads/#', '/uploads/$1/'],
        ['#^/hero/seed/#', '/uploads/hero/'],
        ['#^/gallery/seed/#', '/uploads/gallery/'],
        ['#^/council/people/#', '/uploads/council/'],
        ['#^/calendar/defaults/#', '/uploads/calendar/'],
        ['#^/org-logos/#', '/uploads/org-logos/'],
        ['#^/announcements/#', '/uploads/announcements/'],
        ['#^/calendar/#', '/uploads/calendar/'],
        ['#^/projects/#', '/uploads/projects/'],
        ['#^/council/#', '/uploads/council/'],
        ['#^/gallery/#', '/uploads/gallery/'],
        ['#^/hero/#', '/uploads/hero/'],
        ['#^/shop/#', '/uploads/shop/'],
        ['#^/users/#', '/uploads/users/'],
    ];

    foreach ($rules as [$pattern, $replace]) {
        $next = preg_replace($pattern, $replace, $url, 1, $count);
        if ($count && is_string($next)) {
            return $next;
        }
    }

    return $url;
}

function migrate_json_urls(string $json): string
{
    $data = json_decode($json, true);
    if (!is_array($data)) {
        return $json;
    }
    array_walk_recursive($data, static function (&$value): void {
        if (is_string($value)) {
            $value = migrate_public_url($value);
        }
    });
    $encoded = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    return is_string($encoded) ? $encoded : $json;
}

$columns = [
    ['announcements', 'image_url'],
    ['calendar_events', 'image_url'],
    ['projects', 'image_url'],
    ['gallery_images', 'image_url'],
    ['hero_slides', 'image_url'],
    ['shop_items', 'image_url'],
    ['users', 'avatar_url'],
    ['council_members', 'photo_url'],
    ['organizations', 'logo_url'],
];

try {
    $pdo = api_pdo();
    foreach ($columns as [$table, $column]) {
        try {
            $exists = $pdo->query('SHOW TABLES LIKE ' . $pdo->quote($table))->fetch();
            if (!$exists) {
                continue;
            }
            $col = $pdo->query("SHOW COLUMNS FROM `{$table}` LIKE " . $pdo->quote($column))->fetch();
            if (!$col) {
                continue;
            }
            $rows = $pdo->query("SELECT id, `{$column}` AS url FROM `{$table}`")->fetchAll(PDO::FETCH_ASSOC);
            $updated = 0;
            $update = $pdo->prepare("UPDATE `{$table}` SET `{$column}` = :url WHERE id = :id");
            foreach ($rows as $row) {
                $current = (string) ($row['url'] ?? '');
                $next = migrate_public_url($current);
                if ($next === $current) {
                    continue;
                }
                $update->execute(['url' => $next, 'id' => $row['id']]);
                $updated++;
            }
            echo "{$table}.{$column}: {$updated} row(s)\n";
        } catch (Throwable $error) {
            fwrite(STDERR, "{$table}.{$column}: {$error->getMessage()}\n");
        }
    }

    try {
        $col = $pdo->query("SHOW COLUMNS FROM projects LIKE 'images_json'")->fetch();
        if ($col) {
            $rows = $pdo->query('SELECT id, images_json FROM projects WHERE images_json IS NOT NULL')->fetchAll(PDO::FETCH_ASSOC);
            $updated = 0;
            $update = $pdo->prepare('UPDATE projects SET images_json = :json WHERE id = :id');
            foreach ($rows as $row) {
                $current = (string) $row['images_json'];
                $next = migrate_json_urls($current);
                if ($next === $current) {
                    continue;
                }
                $update->execute(['json' => $next, 'id' => $row['id']]);
                $updated++;
            }
            echo "projects.images_json: {$updated} row(s)\n";
        }
    } catch (Throwable $error) {
        fwrite(STDERR, 'projects.images_json: ' . $error->getMessage() . "\n");
    }
} catch (Throwable $error) {
    fwrite(STDERR, 'Database rewrite skipped: ' . $error->getMessage() . "\n");
}

echo "Done. All pictures are in public/uploads/\n";
