<?php

declare(strict_types=1);

/** @return list<array{slug:string,label:string,title:string,accent:string,kicker:string,note:string,folder:string,series_label:string,icon:string,sort_order:int}> */
function transparency_categories_defaults(): array
{
    return [
        [
            'slug' => 'board_resolution',
            'label' => 'Board Resolutions',
            'title' => 'Board Resolutions',
            'accent' => 'and En Banc Issuances',
            'kicker' => 'Secretariat',
            'note' => 'Organized archive of resolutions arranged by Series/Academic Year. Downloadable PDF links provided.',
            'folder' => '01 Board Resolution & Memoranda',
            'series_label' => 'Board Resolution',
            'icon' => 'landmark',
            'sort_order' => 10,
        ],
        [
            'slug' => 'appointment_resolution',
            'label' => 'Commission Resolutions',
            'title' => 'Commission on Appointments',
            'accent' => 'Resolutions',
            'kicker' => 'Secretariat',
            'note' => 'Resolutions issued by the Commission on Appointments.',
            'folder' => '',
            'series_label' => 'Resolution',
            'icon' => 'gavel',
            'sort_order' => 20,
        ],
        [
            'slug' => 'memorandum',
            'label' => 'Memoranda & Requests',
            'title' => 'Memoranda and',
            'accent' => 'Administrative Requests',
            'kicker' => 'Secretariat',
            'note' => 'Repository of formal communications sent to and memorandas received from the Office of the Dean',
            'folder' => '',
            'series_label' => 'Memorandum',
            'icon' => 'mail',
            'sort_order' => 30,
        ],
        [
            'slug' => 'report',
            'label' => 'Accomplishment Reports',
            'title' => 'Accomplishment',
            'accent' => 'Reports',
            'kicker' => 'Secretariat',
            'note' => 'Semester-end and annual records of Council programs and outputs.',
            'folder' => '',
            'series_label' => 'Report',
            'icon' => 'clipboard-check',
            'sort_order' => 40,
        ],
        [
            'slug' => 'financial',
            'label' => 'Financial Reports',
            'title' => 'Financial',
            'accent' => 'Reports',
            'kicker' => 'Finance & Audit',
            'note' => 'Monthly and semestral financial statements, liquidations, budget allocations, and audit reports.',
            'folder' => '',
            'series_label' => 'Financial Report',
            'icon' => 'wallet',
            'sort_order' => 50,
        ],
    ];
}

/** @return list<array{slug:string,label:string}> */
function transparency_financial_tabs(): array
{
    return [
        ['slug' => 'quarterly-liquidations', 'label' => 'Quarterly liquidations'],
        ['slug' => 'budget-allocations', 'label' => 'Budget allocations'],
        ['slug' => 'financial-statements', 'label' => 'Financial statements'],
    ];
}

/** @return list<array{slug:string,label:string}> */
function transparency_tabs_normalize(mixed $raw): array
{
    if (is_string($raw) && trim($raw) !== '') {
        $decoded = json_decode($raw, true);
        $raw = is_array($decoded) ? $decoded : [];
    }
    if (!is_array($raw)) {
        return [];
    }

    $tabs = [];
    $seen = [];
    foreach ($raw as $item) {
        if (!is_array($item)) {
            continue;
        }
        $label = trim((string) ($item['label'] ?? ''));
        $slug = trim((string) ($item['slug'] ?? ''));
        if ($slug === '') {
            $slug = api_slugify($label);
        } else {
            $slug = api_slugify($slug);
        }
        $slug = substr($slug, 0, 64);
        if ($slug === '' || $label === '' || isset($seen[$slug])) {
            continue;
        }
        $seen[$slug] = true;
        $tabs[] = [
            'slug' => $slug,
            'label' => mb_substr($label, 0, 120),
        ];
    }

    return $tabs;
}

/** @return list<array{slug:string,label:string}> */
function transparency_category_tabs(PDO $pdo, string $slug): array
{
    transparency_categories_ensure($pdo);
    $stmt = $pdo->prepare('SELECT tabs_json FROM transparency_categories WHERE slug = :slug LIMIT 1');
    $stmt->execute(['slug' => $slug]);
    $row = $stmt->fetch();
    $tabs = transparency_tabs_normalize($row['tabs_json'] ?? '');
    if ($tabs === [] && $slug === 'financial') {
        return transparency_financial_tabs();
    }
    return $tabs;
}

function transparency_categories_ensure(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $locked = false;
    try {
        $lock = $pdo->query("SELECT GET_LOCK('pup_transparency_categories', 8)");
        $locked = $lock !== false && (int) $lock->fetchColumn() === 1;

        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS transparency_categories (
              id INT UNSIGNED NOT NULL AUTO_INCREMENT,
              slug VARCHAR(64) NOT NULL,
              label VARCHAR(160) NOT NULL,
              title VARCHAR(160) NOT NULL,
              accent VARCHAR(160) NOT NULL DEFAULT '',
              kicker VARCHAR(80) NOT NULL DEFAULT '',
              note VARCHAR(800) NOT NULL DEFAULT '',
              folder VARCHAR(160) NOT NULL DEFAULT '',
              series_label VARCHAR(120) NOT NULL DEFAULT '',
              icon VARCHAR(64) NOT NULL DEFAULT 'file-text',
              sort_order INT NOT NULL DEFAULT 0,
              is_published TINYINT(1) NOT NULL DEFAULT 1,
              created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (id),
              UNIQUE KEY uq_transparency_categories_slug (slug),
              KEY idx_transparency_categories_published (is_published, sort_order, id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );

        $count = (int) $pdo->query('SELECT COUNT(*) FROM transparency_categories')->fetchColumn();
        if ($count === 0) {
            $stmt = $pdo->prepare(
                'INSERT INTO transparency_categories
                  (slug, label, title, accent, kicker, note, folder, series_label, icon, sort_order, is_published)
                 VALUES
                  (:slug, :label, :title, :accent, :kicker, :note, :folder, :series_label, :icon, :sort_order, 1)'
            );
            foreach (transparency_categories_defaults() as $row) {
                $stmt->execute($row);
            }
        }

        $pdo->exec(
            "UPDATE transparency_categories
             SET kicker = 'Secretariat'
             WHERE slug = 'report' AND kicker = 'Audit'"
        );
        $pdo->exec(
            "UPDATE transparency_categories
             SET kicker = 'Finance & Audit'
             WHERE slug = 'financial' AND kicker IN ('Secretariat', 'Audit', '')"
        );

        $tabsCol = $pdo->query("SHOW COLUMNS FROM transparency_categories LIKE 'tabs_json'")->fetch();
        if (!$tabsCol) {
            try {
                $pdo->exec('ALTER TABLE transparency_categories ADD COLUMN tabs_json LONGTEXT NULL AFTER note');
            } catch (PDOException $error) {
                if (!str_contains(strtolower($error->getMessage()), 'duplicate')) {
                    throw $error;
                }
            }
        }

        $financial = $pdo->query(
            "SELECT id, tabs_json FROM transparency_categories WHERE slug = 'financial' LIMIT 1"
        )->fetch();
        if ($financial && transparency_tabs_normalize($financial['tabs_json'] ?? '') === []) {
            $seedTabs = $pdo->prepare('UPDATE transparency_categories SET tabs_json = :tabs WHERE id = :id');
            $seedTabs->execute([
                'tabs' => json_encode(transparency_financial_tabs(), JSON_UNESCAPED_UNICODE),
                'id' => (int) $financial['id'],
            ]);
        }
    } finally {
        if ($locked) {
            $pdo->query("SELECT RELEASE_LOCK('pup_transparency_categories')");
        }
    }

    $ready = true;
}

function transparency_categories_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'slug' => (string) $row['slug'],
        'label' => (string) $row['label'],
        'title' => (string) $row['title'],
        'accent' => (string) ($row['accent'] ?? ''),
        'kicker' => (string) ($row['kicker'] ?? ''),
        'note' => (string) ($row['note'] ?? ''),
        'tabs' => transparency_tabs_normalize($row['tabs_json'] ?? ''),
        'folder' => (string) ($row['folder'] ?? ''),
        'seriesLabel' => (string) ($row['series_label'] ?? ''),
        'icon' => (string) ($row['icon'] ?? 'file-text'),
        'sortOrder' => (int) ($row['sort_order'] ?? 0),
        'published' => (int) ($row['is_published'] ?? 0) === 1,
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}

/** @return list<string> */
function transparency_categories_slugs(PDO $pdo, bool $publishedOnly = false): array
{
    transparency_categories_ensure($pdo);
    $sql = $publishedOnly
        ? 'SELECT slug FROM transparency_categories WHERE is_published = 1 ORDER BY sort_order ASC, id ASC'
        : 'SELECT slug FROM transparency_categories ORDER BY sort_order ASC, id ASC';
    $stmt = $pdo->query($sql);
    $slugs = [];
    if ($stmt) {
        foreach ($stmt->fetchAll() as $row) {
            $slugs[] = (string) $row['slug'];
        }
    }
    return $slugs;
}

/** @return list<array{value:string,label:string}> */
function transparency_categories_options(PDO $pdo, bool $publishedOnly = false): array
{
    transparency_categories_ensure($pdo);
    $sql = $publishedOnly
        ? 'SELECT slug, label FROM transparency_categories WHERE is_published = 1 ORDER BY sort_order ASC, id ASC'
        : 'SELECT slug, label FROM transparency_categories ORDER BY sort_order ASC, id ASC';
    $stmt = $pdo->query($sql);
    $items = [];
    if ($stmt) {
        foreach ($stmt->fetchAll() as $row) {
            $items[] = [
                'value' => (string) $row['slug'],
                'label' => (string) $row['label'],
            ];
        }
    }
    return $items;
}

function transparency_categories_slug_exists(PDO $pdo, string $slug, ?int $exceptId = null): bool
{
    if ($exceptId !== null && $exceptId > 0) {
        $stmt = $pdo->prepare(
            'SELECT id FROM transparency_categories WHERE slug = :slug AND id <> :id LIMIT 1'
        );
        $stmt->execute(['slug' => $slug, 'id' => $exceptId]);
    } else {
        $stmt = $pdo->prepare('SELECT id FROM transparency_categories WHERE slug = :slug LIMIT 1');
        $stmt->execute(['slug' => $slug]);
    }
    return (bool) $stmt->fetch();
}

function transparency_categories_document_count(PDO $pdo, string $slug): int
{
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM documents WHERE category = :category');
    $stmt->execute(['category' => $slug]);
    return (int) $stmt->fetchColumn();
}
