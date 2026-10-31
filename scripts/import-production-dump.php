<?php

declare(strict_types=1);

/**
 * Adapt a Hostinger/phpMyAdmin dump to the current local schema, then load it
 * into pup_col_sc.
 *
 * Usage:
 *   php scripts/import-production-dump.php [path-to-dump.sql]
 */

require_once dirname(__DIR__) . '/api/includes/bootstrap.php';

$source = $argv[1] ?? 'C:\\Users\\HomePC\\Downloads\\u785185569_pup_db (1).sql';
if (!is_file($source)) {
    fwrite(STDERR, "Dump not found: {$source}\n");
    exit(1);
}

$outDir = dirname(__DIR__) . '/database/imports';
if (!is_dir($outDir) && !mkdir($outDir, 0755, true) && !is_dir($outDir)) {
    fwrite(STDERR, "Could not create {$outDir}\n");
    exit(1);
}

$adaptedBase = preg_replace('/[^A-Za-z0-9._-]+/', '_', (string) pathinfo($source, PATHINFO_FILENAME));
$adaptedBase = trim((string) $adaptedBase, '._-') ?: 'dump';
$adaptedPath = $outDir . '/' . $adaptedBase . '.adapted.sql';

function adapt_public_url_sql(string $sql): string
{
    $rules = [
        ['#(?<!/uploads)/(announcements|calendar|projects|council|gallery|hero|users|shop)/uploads/#', '/uploads/$1/'],
        ['#(?<!/uploads)/hero/seed/#', '/uploads/hero/'],
        ['#(?<!/uploads)/gallery/seed/#', '/uploads/gallery/'],
        ['#(?<!/uploads)/council/people/#', '/uploads/council/'],
        ['#(?<!/uploads)/calendar/defaults/#', '/uploads/calendar/'],
        ['#(?<!/uploads)/org-logos/#', '/uploads/org-logos/'],
        ['#(?<!/uploads)/shop/#', '/uploads/shop/'],
        ['#(?<!/uploads)/users/#', '/uploads/users/'],
        ['#(?<!/uploads)/announcements/#', '/uploads/announcements/'],
        ['#(?<!/uploads)/calendar/#', '/uploads/calendar/'],
        ['#(?<!/uploads)/projects/#', '/uploads/projects/'],
        ['#(?<!/uploads)/council/#', '/uploads/council/'],
        ['#(?<!/uploads)/gallery/#', '/uploads/gallery/'],
        ['#(?<!/uploads)/hero/#', '/uploads/hero/'],
    ];

    foreach ($rules as [$pattern, $replace]) {
        $next = preg_replace($pattern, $replace, $sql);
        if (is_string($next)) {
            $sql = $next;
        }
    }

    return $sql;
}

$sql = file_get_contents($source);
if (!is_string($sql) || $sql === '') {
    fwrite(STDERR, "Could not read dump.\n");
    exit(1);
}

$sql = adapt_public_url_sql($sql);

// phpMyAdmin "Quick" dumps omit DROP TABLE, so a second import dies on the first
// table that already exists. Drop each table before recreating it.
$sql = preg_replace(
    '/^CREATE TABLE IF NOT EXISTS\s+`?([A-Za-z0-9_]+)`?/m',
    'CREATE TABLE `$1`',
    $sql
) ?? $sql;
$sql = preg_replace(
    '/^CREATE TABLE\s+`?([A-Za-z0-9_]+)`?/m',
    "DROP TABLE IF EXISTS `\$1`;\nCREATE TABLE `\$1`",
    $sql
) ?? $sql;

$header = <<<SQL
-- Adapted dump for localhost pup_col_sc
-- Image URLs rewritten to /uploads/{bucket}/
-- Replaces the local database so CREATE TABLE cannot collide

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
DROP DATABASE IF EXISTS pup_col_sc;
CREATE DATABASE pup_col_sc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pup_col_sc;

SQL;

$sql = $header . "\n" . $sql;

if (str_contains($sql, '/uploads/uploads/')) {
    fwrite(STDERR, "Adapted dump still has doubled /uploads/uploads/ paths.\n");
    exit(1);
}

if (!file_put_contents($adaptedPath, $sql)) {
    fwrite(STDERR, "Could not write {$adaptedPath}\n");
    exit(1);
}

echo "Wrote adapted dump: {$adaptedPath}\n";

$mysql = 'C:\\xampp\\mysql\\bin\\mysql.exe';
if (!is_file($mysql)) {
    fwrite(STDERR, "mysql.exe not found at {$mysql}\n");
    exit(1);
}

$sourceSql = str_replace('\\', '/', $adaptedPath);
$cmd = '"' . $mysql . '" -u root --default-character-set=utf8mb4 -e "source ' . $sourceSql . '"';
echo "Importing into localhost pup_col_sc…\n";
passthru($cmd, $code);
if ($code !== 0) {
    fwrite(STDERR, "mysql import failed with exit code {$code}\n");
    exit($code);
}

$pdo = api_pdo();

$sizeCol = $pdo->query("SHOW COLUMNS FROM shop_items LIKE 'size'")->fetch();
if ($sizeCol) {
    $pdo->exec('ALTER TABLE shop_items DROP COLUMN size');
    echo "Dropped shop_items.size\n";
}

$pdo->exec("DELETE FROM site_settings WHERE setting_key = 'forms'");

$pdo->exec(
    "UPDATE shop_reservations r
     INNER JOIN shop_items i ON i.shop = r.shop AND i.item_key = r.item_key
     SET r.shop_item_id = i.id
     WHERE r.shop_item_id IS NULL OR r.shop_item_id = 0"
);

$cleared = $pdo->exec(
    "UPDATE shop_items
     SET availability = NULL
     WHERE shop = 'locker'
       AND availability IN ('reserved', 'out')"
);
if ($cleared) {
    echo "Cleared {$cleared} locker flags that were not backed by a reservation.\n";
}

$pdo->exec(
    "DELETE FROM shop_items
     WHERE shop = 'merch'
       AND item_key IN ('college-shirt', 'college-polo', 'lanyard')"
);

$counts = $pdo->query(
    "SELECT
        (SELECT COUNT(*) FROM announcements) AS announcements,
        (SELECT COUNT(*) FROM calendar_events) AS calendar_events,
        (SELECT COUNT(*) FROM council_members) AS council_members,
        (SELECT COUNT(*) FROM projects) AS projects,
        (SELECT COUNT(*) FROM shop_items WHERE shop = 'locker') AS lockers,
        (SELECT COUNT(*) FROM shop_items WHERE shop = 'merch') AS merch,
        (SELECT COUNT(*) FROM shop_reservations) AS reservations,
        (SELECT COUNT(*) FROM hero_slides) AS hero_slides,
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM chat_threads) AS chat_threads"
)->fetch(PDO::FETCH_ASSOC);

echo "Import complete.\n";
foreach ($counts ?: [] as $table => $count) {
    echo "  {$table}: {$count}\n";
}

$sample = $pdo->query("SELECT image_url FROM announcements WHERE image_url <> '' LIMIT 1")->fetchColumn();
echo '  sample announcement image: ' . ($sample ?: '(none)') . "\n";
echo "Done.\n";
