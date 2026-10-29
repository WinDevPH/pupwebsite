<?php

declare(strict_types=1);

function hero_slides_ensure(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS hero_slides (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          image_url VARCHAR(800) NOT NULL,
          alt_text VARCHAR(400) NOT NULL DEFAULT '',
          sort_order INT NOT NULL DEFAULT 0,
          is_published TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_hero_slides_published (is_published, sort_order, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $ready = true;
}

function hero_slide_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'image' => (string) $row['image_url'],
        'alt' => (string) ($row['alt_text'] ?? ''),
        'sortOrder' => (int) ($row['sort_order'] ?? 0),
        'published' => (int) ($row['is_published'] ?? 0) === 1,
        'createdAt' => (string) ($row['created_at'] ?? ''),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
    ];
}

function hero_slide_payload(array $body): array
{
    $image = trim((string) ($body['image'] ?? $body['image_url'] ?? $body['src'] ?? ''));
    $alt = trim((string) ($body['alt'] ?? $body['alt_text'] ?? ''));
    $sort = (int) ($body['sortOrder'] ?? $body['sort_order'] ?? 0);
    if (array_key_exists('published', $body)) {
        $published = filter_var($body['published'], FILTER_VALIDATE_BOOLEAN);
    } elseif (array_key_exists('is_published', $body)) {
        $published = filter_var($body['is_published'], FILTER_VALIDATE_BOOLEAN);
    } else {
        $published = true;
    }

    if ($image === '') {
        api_json(['ok' => false, 'error' => 'Upload a hero image.'], 422);
    }
    if (strlen($image) > 800) {
        api_json(['ok' => false, 'error' => 'Image path is too long.'], 422);
    }
    if (strlen($alt) > 400) {
        api_json(['ok' => false, 'error' => 'Alt text is too long.'], 422);
    }

    return [
        'image_url' => $image,
        'alt_text' => $alt,
        'sort_order' => $sort,
        'is_published' => $published ? 1 : 0,
    ];
}

/** @return list<array{file: string, alt: string, sort: int}> */
function hero_slides_seed_items(): array
{
    return [
        [
            'file' => 'hero-council-4.0.jpg',
            'alt' => 'PUP College of Law students at TAGUYOD Together Toward the Bar, with a Lady Justice banner and purple balloons',
            'sort' => 10,
        ],
        [
            'file' => 'hero-council-4.1.jpg',
            'alt' => 'The Solicitor covering a night gathering of PUP College of Law students',
            'sort' => 20,
        ],
        [
            'file' => 'hero-council-4.2.jpg',
            'alt' => 'Student Council members at Law in Motion, a legal forum on current national and international issues',
            'sort' => 30,
        ],
        [
            'file' => 'hero-council-4.3.jpg',
            'alt' => 'Law in Motion session with speaker Armando Virgil D. Ligutan via Zoom',
            'sort' => 40,
        ],
    ];
}

function hero_slides_seed_if_empty(PDO $pdo): int
{
    hero_slides_ensure($pdo);
    $count = (int) $pdo->query('SELECT COUNT(*) FROM hero_slides')->fetchColumn();
    if ($count > 0) {
        return $count;
    }

    $root = api_project_root();
    $seedDir = api_uploads_dir('hero');
    $sourceDir = $root . '/src/assets/hero';
    if (!is_dir($seedDir)) {
        mkdir($seedDir, 0755, true);
    }

    $insert = $pdo->prepare(
        'INSERT INTO hero_slides (image_url, alt_text, sort_order, is_published)
         VALUES (:image_url, :alt_text, :sort_order, 1)'
    );

    foreach (hero_slides_seed_items() as $item) {
        $from = $sourceDir . '/' . $item['file'];
        $to = $seedDir . '/' . $item['file'];
        if (is_file($from) && !is_file($to)) {
            copy($from, $to);
        }
        $insert->execute([
            'image_url' => api_uploads_url('hero', $item['file']),
            'alt_text' => $item['alt'],
            'sort_order' => $item['sort'],
        ]);
        $count++;
    }

    return $count;
}
