<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => gallery_get(),
        'POST' => gallery_create(),
        'PUT', 'PATCH' => gallery_put(),
        'DELETE' => gallery_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json([
        'ok' => false,
        'error' => 'Database unavailable. Run scripts/run-010-gallery.php and start MySQL.',
        'detail' => $error->getMessage(),
    ], 503);
}

function gallery_normalize_year(string $year): string
{
    $year = trim($year);
    $year = str_replace(['-', '—', '–'], '–', $year);
    $year = preg_replace('/\s+/', '', $year) ?? $year;
    return $year;
}

function gallery_ensure_tables(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS gallery_batches (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          academic_year VARCHAR(32) NOT NULL,
          title VARCHAR(255) NOT NULL DEFAULT 'Council Photographs',
          is_published TINYINT(1) NOT NULL DEFAULT 1,
          sort_order INT NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_gallery_batches_year (academic_year),
          KEY idx_gallery_batches_published (is_published, academic_year)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS gallery_images (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          batch_id INT UNSIGNED NOT NULL,
          image_url VARCHAR(500) NOT NULL,
          title VARCHAR(255) NOT NULL,
          caption VARCHAR(255) NOT NULL DEFAULT '',
          alt_text VARCHAR(500) NOT NULL DEFAULT '',
          sort_order INT NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_gallery_images_batch (batch_id, sort_order, id),
          CONSTRAINT fk_gallery_images_batch
            FOREIGN KEY (batch_id) REFERENCES gallery_batches (id)
            ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS gallery_display_settings (
          id TINYINT UNSIGNED NOT NULL DEFAULT 1,
          pinned_academic_year VARCHAR(32) NULL,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        'INSERT INTO gallery_display_settings (id, pinned_academic_year)
         VALUES (1, NULL)
         ON DUPLICATE KEY UPDATE id = id'
    );
    $ready = true;
}

function gallery_image_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'batchId' => (int) $row['batch_id'],
        'src' => (string) $row['image_url'],
        'title' => (string) $row['title'],
        'caption' => (string) ($row['caption'] ?? ''),
        'alt' => (string) ($row['alt_text'] ?? ''),
        'sortOrder' => (int) ($row['sort_order'] ?? 0),
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}

function gallery_batch_row(array $row, int $imageCount = 0, ?string $coverImage = null): array
{
    $cover = $coverImage;
    if ($cover === null && isset($row['cover_image']) && is_string($row['cover_image']) && $row['cover_image'] !== '') {
        $cover = (string) $row['cover_image'];
    }

    return [
        'id' => (int) $row['id'],
        'academicYear' => (string) $row['academic_year'],
        'title' => (string) $row['title'],
        'published' => (int) ($row['is_published'] ?? 0) === 1,
        'sortOrder' => (int) ($row['sort_order'] ?? 0),
        'imageCount' => $imageCount,
        'coverImage' => $cover,
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}

function gallery_get_pinned_year(PDO $pdo): ?string
{
    gallery_ensure_tables($pdo);
    $stmt = $pdo->query('SELECT pinned_academic_year FROM gallery_display_settings WHERE id = 1 LIMIT 1');
    $row = $stmt ? $stmt->fetch() : false;
    if (!$row) {
        return null;
    }
    $year = gallery_normalize_year((string) ($row['pinned_academic_year'] ?? ''));
    return $year !== '' ? $year : null;
}

function gallery_resolve_public_year(PDO $pdo, string $requested = ''): string
{
    if ($requested !== '') {
        return $requested;
    }
    $pinned = gallery_get_pinned_year($pdo);
    if ($pinned !== null) {
        $check = $pdo->prepare(
            'SELECT 1 FROM gallery_batches
             WHERE academic_year = :year AND is_published = 1
             LIMIT 1'
        );
        $check->execute(['year' => $pinned]);
        if ($check->fetch()) {
            return $pinned;
        }
    }
    $latest = $pdo->query(
        'SELECT academic_year FROM gallery_batches
         WHERE is_published = 1
         ORDER BY academic_year DESC, id DESC
         LIMIT 1'
    );
    $row = $latest ? $latest->fetch() : false;
    return $row ? (string) $row['academic_year'] : '';
}

/** @return list<array<string, mixed>> */
function gallery_images_for_batch(PDO $pdo, int $batchId): array
{
    $stmt = $pdo->prepare(
        'SELECT * FROM gallery_images WHERE batch_id = :id ORDER BY sort_order ASC, id ASC'
    );
    $stmt->execute(['id' => $batchId]);
    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $items[] = gallery_image_row($row);
    }
    return $items;
}

function gallery_get(): never
{
    $pdo = api_pdo();
    gallery_ensure_tables($pdo);

    $id = (int) ($_GET['id'] ?? 0);
    $yearsOnly = (string) ($_GET['years'] ?? '') === '1';
    $displayOnly = (string) ($_GET['display'] ?? '') === '1';
    $includeAll = (string) ($_GET['all'] ?? '') === '1';
    $year = gallery_normalize_year((string) ($_GET['year'] ?? $_GET['academicYear'] ?? ''));

    if ($displayOnly) {
        $pinned = gallery_get_pinned_year($pdo);
        $resolved = gallery_resolve_public_year($pdo);
        api_json([
            'ok' => true,
            'pinnedYear' => $pinned,
            'publicYear' => $resolved !== '' ? $resolved : null,
            'mode' => $pinned !== null ? 'pinned' : 'auto',
        ]);
    }

    if ($yearsOnly) {
        if ($includeAll) {
            api_require_manager();
            $stmt = $pdo->query('SELECT DISTINCT academic_year FROM gallery_batches ORDER BY academic_year DESC');
        } else {
            $stmt = $pdo->query(
                'SELECT DISTINCT academic_year FROM gallery_batches
                 WHERE is_published = 1
                 ORDER BY academic_year DESC'
            );
        }
        $years = [];
        if ($stmt) {
            foreach ($stmt->fetchAll() as $row) {
                $years[] = (string) $row['academic_year'];
            }
        }
        api_json(['ok' => true, 'years' => $years]);
    }

    if ($id > 0) {
        $stmt = $pdo->prepare('SELECT * FROM gallery_batches WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Gallery batch not found.'], 404);
        }
        if ((int) $row['is_published'] !== 1) {
            api_require_manager();
        }
        $images = gallery_images_for_batch($pdo, $id);
        $cover = $images[0]['src'] ?? null;
        api_json([
            'ok' => true,
            'item' => gallery_batch_row($row, count($images), is_string($cover) ? $cover : null),
            'images' => $images,
        ]);
    }

    if ($includeAll) {
        api_require_manager();
        $stmt = $pdo->query(
            'SELECT b.*,
                    (SELECT COUNT(*) FROM gallery_images i WHERE i.batch_id = b.id) AS image_count,
                    (SELECT i2.image_url FROM gallery_images i2
                     WHERE i2.batch_id = b.id
                     ORDER BY i2.sort_order ASC, i2.id ASC
                     LIMIT 1) AS cover_image
             FROM gallery_batches b
             ORDER BY b.academic_year DESC, b.id DESC'
        );
        $items = [];
        if ($stmt) {
            foreach ($stmt->fetchAll() as $row) {
                $items[] = gallery_batch_row($row, (int) ($row['image_count'] ?? 0));
            }
        }
        $pinned = gallery_get_pinned_year($pdo);
        api_json([
            'ok' => true,
            'items' => $items,
            'pinnedYear' => $pinned,
            'publicYear' => gallery_resolve_public_year($pdo) ?: null,
            'displayMode' => $pinned !== null ? 'pinned' : 'auto',
        ]);
    }

    $year = gallery_resolve_public_year($pdo, $year);
    if ($year === '') {
        api_json([
            'ok' => true,
            'academicYear' => null,
            'pinnedYear' => gallery_get_pinned_year($pdo),
            'displayMode' => gallery_get_pinned_year($pdo) !== null ? 'pinned' : 'auto',
            'batch' => null,
            'images' => [],
        ]);
    }

    $batchStmt = $pdo->prepare(
        'SELECT * FROM gallery_batches
         WHERE academic_year = :year AND is_published = 1
         LIMIT 1'
    );
    $batchStmt->execute(['year' => $year]);
    $batch = $batchStmt->fetch();
    if (!$batch) {
        api_json([
            'ok' => true,
            'academicYear' => $year,
            'pinnedYear' => gallery_get_pinned_year($pdo),
            'displayMode' => gallery_get_pinned_year($pdo) !== null ? 'pinned' : 'auto',
            'batch' => null,
            'images' => [],
        ]);
    }

    $images = gallery_images_for_batch($pdo, (int) $batch['id']);
    $pinned = gallery_get_pinned_year($pdo);
    $cover = $images[0]['src'] ?? null;
    api_json([
        'ok' => true,
        'academicYear' => $year,
        'pinnedYear' => $pinned,
        'displayMode' => $pinned !== null ? 'pinned' : 'auto',
        'batch' => gallery_batch_row($batch, count($images), is_string($cover) ? $cover : null),
        'images' => $images,
    ]);
}

/**
 * @param array<string, mixed> $body
 * @return list<array{image_url: string, title: string, caption: string, alt_text: string, sort_order: int}>
 */
function gallery_parse_images(array $body): array
{
    $raw = $body['images'] ?? null;
    if (!is_array($raw) || $raw === []) {
        api_json(['ok' => false, 'error' => 'Add at least one gallery image.'], 422);
    }

    $images = [];
    $index = 0;
    foreach ($raw as $item) {
        if (!is_array($item)) {
            continue;
        }
        $url = trim((string) ($item['src'] ?? $item['image'] ?? $item['imageUrl'] ?? ''));
        $title = trim((string) ($item['title'] ?? ''));
        $caption = trim((string) ($item['caption'] ?? $item['label'] ?? ''));
        $alt = trim((string) ($item['alt'] ?? $item['altText'] ?? ''));
        $sort = (int) ($item['sortOrder'] ?? ($index + 1) * 10);

        if ($url === '' || !preg_match('#^(/|https?://)#i', $url)) {
            api_json(['ok' => false, 'error' => 'Each image needs a valid path or URL.'], 422);
        }
        if (mb_strlen($url) > 500) {
            api_json(['ok' => false, 'error' => 'Image path is too long.'], 422);
        }
        if ($title === '') {
            api_json(['ok' => false, 'error' => 'Each image needs a title label.'], 422);
        }
        if (mb_strlen($title) > 255 || mb_strlen($caption) > 255) {
            api_json(['ok' => false, 'error' => 'Image title or caption is too long.'], 422);
        }
        if ($alt === '') {
            $alt = $title . ($caption !== '' ? ' — ' . $caption : '');
        }
        if (mb_strlen($alt) > 500) {
            api_json(['ok' => false, 'error' => 'Image alt text is too long.'], 422);
        }

        $images[] = [
            'image_url' => $url,
            'title' => $title,
            'caption' => $caption,
            'alt_text' => $alt,
            'sort_order' => $sort,
        ];
        $index += 1;
    }

    if ($images === []) {
        api_json(['ok' => false, 'error' => 'Add at least one gallery image.'], 422);
    }

    return $images;
}

/**
 * @param array<string, mixed>|null $body
 * @return array{academic_year: string, title: string, is_published: int, sort_order: int}
 */
function gallery_batch_payload(?array $body = null): array
{
    $body ??= api_read_json();
    $academicYear = gallery_normalize_year((string) ($body['academicYear'] ?? $body['year'] ?? ''));
    $title = trim((string) ($body['title'] ?? 'Council Photographs'));
    $published = array_key_exists('published', $body)
        ? (bool) $body['published']
        : (array_key_exists('isPublished', $body) ? (bool) $body['isPublished'] : true);
    $sortOrder = (int) ($body['sortOrder'] ?? 0);

    if ($academicYear === '' || !preg_match('/^\d{4}–\d{4}$/u', $academicYear)) {
        api_json(['ok' => false, 'error' => 'Enter academic year as YYYY–YYYY (e.g. 2026–2027).'], 422);
    }
    if ($title === '') {
        $title = 'Council Photographs';
    }
    if (mb_strlen($title) > 255) {
        api_json(['ok' => false, 'error' => 'Batch title is too long.'], 422);
    }

    return [
        'academic_year' => $academicYear,
        'title' => $title,
        'is_published' => $published ? 1 : 0,
        'sort_order' => $sortOrder,
    ];
}

function gallery_create(): never
{
    api_require_manager();
    $pdo = api_pdo();
    gallery_ensure_tables($pdo);
    $body = api_read_json();
    $data = gallery_batch_payload($body);
    $images = gallery_parse_images($body);

    $exists = $pdo->prepare('SELECT id FROM gallery_batches WHERE academic_year = :year LIMIT 1');
    $exists->execute(['year' => $data['academic_year']]);
    if ($exists->fetch()) {
        api_json(['ok' => false, 'error' => 'A gallery batch for that academic year already exists.'], 422);
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO gallery_batches (academic_year, title, is_published, sort_order)
             VALUES (:academic_year, :title, :is_published, :sort_order)'
        );
        $stmt->execute($data);
        $batchId = (int) $pdo->lastInsertId();

        $insert = $pdo->prepare(
            'INSERT INTO gallery_images
              (batch_id, image_url, title, caption, alt_text, sort_order)
             VALUES
              (:batch_id, :image_url, :title, :caption, :alt_text, :sort_order)'
        );
        foreach ($images as $image) {
            $image['batch_id'] = $batchId;
            $insert->execute($image);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        if (str_contains($error->getMessage(), 'uq_gallery_batches_year')) {
            api_json(['ok' => false, 'error' => 'A gallery batch for that academic year already exists.'], 422);
        }
        throw $error;
    }

    $fetch = $pdo->prepare('SELECT * FROM gallery_batches WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $batchId]);
    $batch = $fetch->fetch() ?: [];
    $savedImages = gallery_images_for_batch($pdo, $batchId);
    $cover = $savedImages[0]['src'] ?? null;
    api_json([
        'ok' => true,
        'item' => gallery_batch_row($batch, count($savedImages), is_string($cover) ? $cover : null),
        'images' => $savedImages,
    ], 201);
}

function gallery_put(): never
{
    api_require_manager();
    $body = api_read_json();
    $action = strtolower(trim((string) ($body['action'] ?? '')));

    if ($action === 'pin_display_year') {
        gallery_pin_display($body);
    }

    gallery_update($body);
}

/**
 * @param array<string, mixed> $body
 */
function gallery_pin_display(array $body): never
{
    $pdo = api_pdo();
    gallery_ensure_tables($pdo);

    $rawPin = $body['pinnedYear'] ?? null;
    $pinned = null;
    if ($rawPin !== null && $rawPin !== '' && strtolower((string) $rawPin) !== 'auto') {
        $pinned = gallery_normalize_year((string) $rawPin);
        if ($pinned === '' || !preg_match('/^\d{4}–\d{4}$/u', $pinned)) {
            api_json(['ok' => false, 'error' => 'Enter academic year as YYYY–YYYY, or choose Auto.'], 422);
        }
    }

    $stmt = $pdo->prepare(
        'INSERT INTO gallery_display_settings (id, pinned_academic_year)
         VALUES (1, :year)
         ON DUPLICATE KEY UPDATE pinned_academic_year = VALUES(pinned_academic_year)'
    );
    $stmt->execute(['year' => $pinned]);

    $resolved = gallery_resolve_public_year($pdo);
    api_json([
        'ok' => true,
        'pinnedYear' => $pinned,
        'publicYear' => $resolved !== '' ? $resolved : null,
        'mode' => $pinned !== null ? 'pinned' : 'auto',
    ]);
}

/**
 * @param array<string, mixed> $body
 */
function gallery_update(array $body): never
{
    $pdo = api_pdo();
    gallery_ensure_tables($pdo);
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Batch id is required.'], 422);
    }

    $existing = $pdo->prepare('SELECT id FROM gallery_batches WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    if (!$existing->fetch()) {
        api_json(['ok' => false, 'error' => 'Gallery batch not found.'], 404);
    }

    $data = gallery_batch_payload($body);
    $images = gallery_parse_images($body);

    $dup = $pdo->prepare(
        'SELECT id FROM gallery_batches WHERE academic_year = :year AND id <> :id LIMIT 1'
    );
    $dup->execute(['year' => $data['academic_year'], 'id' => $id]);
    if ($dup->fetch()) {
        api_json(['ok' => false, 'error' => 'A gallery batch for that academic year already exists.'], 422);
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'UPDATE gallery_batches
             SET academic_year = :academic_year,
                 title = :title,
                 is_published = :is_published,
                 sort_order = :sort_order
             WHERE id = :id'
        );
        $data['id'] = $id;
        $stmt->execute($data);

        $pdo->prepare('DELETE FROM gallery_images WHERE batch_id = :id')->execute(['id' => $id]);
        $insert = $pdo->prepare(
            'INSERT INTO gallery_images
              (batch_id, image_url, title, caption, alt_text, sort_order)
             VALUES
              (:batch_id, :image_url, :title, :caption, :alt_text, :sort_order)'
        );
        foreach ($images as $image) {
            $image['batch_id'] = $id;
            $insert->execute($image);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }

    $fetch = $pdo->prepare('SELECT * FROM gallery_batches WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    $batch = $fetch->fetch() ?: [];
    $savedImages = gallery_images_for_batch($pdo, $id);
    $cover = $savedImages[0]['src'] ?? null;
    api_json([
        'ok' => true,
        'item' => gallery_batch_row($batch, count($savedImages), is_string($cover) ? $cover : null),
        'images' => $savedImages,
    ]);
}

function gallery_delete(): never
{
    api_require_manager();
    $pdo = api_pdo();
    gallery_ensure_tables($pdo);
    $body = api_read_json();
    $ids = $body['ids'] ?? null;
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);

    if (is_array($ids) && $ids !== []) {
        $deleted = 0;
        $stmt = $pdo->prepare('DELETE FROM gallery_batches WHERE id = :id');
        foreach ($ids as $raw) {
            $rowId = (int) $raw;
            if ($rowId <= 0) {
                continue;
            }
            $stmt->execute(['id' => $rowId]);
            $deleted += $stmt->rowCount();
        }
        api_json(['ok' => true, 'deleted' => $deleted]);
    }

    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Batch id is required.'], 422);
    }

    $stmt = $pdo->prepare('DELETE FROM gallery_batches WHERE id = :id');
    $stmt->execute(['id' => $id]);
    if ($stmt->rowCount() < 1) {
        api_json(['ok' => false, 'error' => 'Gallery batch not found.'], 404);
    }
    api_json(['ok' => true]);
}
