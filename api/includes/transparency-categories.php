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
            'kicker' => 'Audit',
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
            'kicker' => 'Audit',
            'note' => 'Monthly and semestral financial statements, liquidations, budget allocations, and audit reports.',
            'folder' => '',
            'series_label' => 'Financial Report',
            'icon' => 'wallet',
            'sort_order' => 50,
        ],
    ];
}

function transparency_categories_ensure(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

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
