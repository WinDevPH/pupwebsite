<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/transparency-categories.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => documents_get(),
        'POST' => documents_create(),
        'PUT', 'PATCH' => documents_update(),
        'DELETE' => documents_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json([
        'ok' => false,
        'error' => 'Database unavailable. Run scripts/run-012-public-cms.php and start MySQL.',
        'detail' => $error->getMessage(),
    ], 503);
}

/** @return list<string> */
function documents_fallback_categories(): array
{
    return ['board_resolution', 'appointment_resolution', 'memorandum', 'report', 'financial'];
}

/** @return list<string> */
function documents_categories(?PDO $pdo = null): array
{
    $pdo ??= api_pdo();
    transparency_categories_ensure($pdo);
    $slugs = transparency_categories_slugs($pdo);
    if ($slugs === []) {
        return documents_fallback_categories();
    }
    return $slugs;
}

function documents_ensure_tables(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS documents (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          category VARCHAR(64) NOT NULL,
          doc_number VARCHAR(64) NOT NULL DEFAULT '',
          title VARCHAR(500) NOT NULL,
          url VARCHAR(1000) NOT NULL,
          series_label VARCHAR(120) NOT NULL DEFAULT '',
          sort_order INT NOT NULL DEFAULT 0,
          is_published TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_documents_category (category, is_published, sort_order, id),
          KEY idx_documents_published (is_published, sort_order, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $ready = true;
}

function documents_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'category' => (string) $row['category'],
        'number' => (string) ($row['doc_number'] ?? ''),
        'docNumber' => (string) ($row['doc_number'] ?? ''),
        'title' => (string) $row['title'],
        'url' => (string) $row['url'],
        'href' => (string) $row['url'],
        'seriesLabel' => (string) ($row['series_label'] ?? ''),
        'sortOrder' => (int) ($row['sort_order'] ?? 0),
        'published' => (int) ($row['is_published'] ?? 0) === 1,
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}

function documents_payload(?array $body = null): array
{
    $body ??= api_read_json();
    $category = strtolower(trim((string) ($body['category'] ?? '')));
    $number = trim((string) ($body['number'] ?? $body['docNumber'] ?? $body['doc_number'] ?? ''));
    $title = trim((string) ($body['title'] ?? ''));
    $url = trim((string) ($body['url'] ?? $body['href'] ?? ''));
    $series = trim((string) ($body['seriesLabel'] ?? $body['series_label'] ?? ''));
    $sortOrder = (int) ($body['sortOrder'] ?? $body['sort_order'] ?? 0);
    $published = array_key_exists('published', $body)
        ? (bool) $body['published']
        : (array_key_exists('isPublished', $body) ? (bool) $body['isPublished'] : true);

    if (!in_array($category, documents_categories(), true)) {
        api_json([
            'ok' => false,
            'error' => 'Choose a published transparency tab as the document category.',
        ], 422);
    }
    if ($title === '') {
        api_json(['ok' => false, 'error' => 'Title is required.'], 422);
    }
    if ($url === '' || !preg_match('#^(/|https?://)#i', $url)) {
        api_json(['ok' => false, 'error' => 'Document URL is required.'], 422);
    }
    if (mb_strlen($title) > 500) {
        api_json(['ok' => false, 'error' => 'Title is too long.'], 422);
    }
    if (mb_strlen($url) > 1000) {
        api_json(['ok' => false, 'error' => 'URL is too long.'], 422);
    }

    return [
        'category' => $category,
        'doc_number' => mb_substr($number, 0, 64),
        'title' => $title,
        'url' => $url,
        'series_label' => mb_substr($series, 0, 120),
        'sort_order' => $sortOrder,
        'is_published' => $published ? 1 : 0,
    ];
}

function documents_get(): never
{
    $pdo = api_pdo();
    documents_ensure_tables($pdo);
    transparency_categories_ensure($pdo);

    $id = (int) ($_GET['id'] ?? 0);
    $category = strtolower(trim((string) ($_GET['category'] ?? '')));
    $includeAll = (string) ($_GET['all'] ?? '') === '1';

    if ($id > 0) {
        $stmt = $pdo->prepare('SELECT * FROM documents WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Document not found.'], 404);
        }
        if ((int) $row['is_published'] !== 1) {
            api_require_manager();
        }
        api_json(['ok' => true, 'item' => documents_row($row)]);
    }

    if ($category !== '' && !in_array($category, documents_categories(), true)) {
        api_json(['ok' => false, 'error' => 'Unknown document category.'], 422);
    }

    if ($includeAll) {
        api_require_manager();
        if ($category !== '') {
            $stmt = $pdo->prepare(
                'SELECT * FROM documents
                 WHERE category = :category
                 ORDER BY sort_order ASC, id ASC'
            );
            $stmt->execute(['category' => $category]);
        } else {
            $stmt = $pdo->query('SELECT * FROM documents ORDER BY sort_order ASC, id ASC');
        }
    } elseif ($category !== '') {
        $stmt = $pdo->prepare(
            'SELECT * FROM documents
             WHERE is_published = 1 AND category = :category
             ORDER BY sort_order ASC, id ASC'
        );
        $stmt->execute(['category' => $category]);
    } else {
        $stmt = $pdo->query(
            'SELECT * FROM documents
             WHERE is_published = 1
             ORDER BY sort_order ASC, id ASC'
        );
    }

    $items = [];
    if ($stmt) {
        foreach ($stmt->fetchAll() as $row) {
            $items[] = documents_row($row);
        }
    }

    api_json([
        'ok' => true,
        'items' => $items,
        'category' => $category !== '' ? $category : null,
        'categories' => transparency_categories_options($pdo),
    ]);
}

function documents_create(): never
{
    api_require_manager();
    $pdo = api_pdo();
    documents_ensure_tables($pdo);
    $data = documents_payload();

    $stmt = $pdo->prepare(
        'INSERT INTO documents
          (category, doc_number, title, url, series_label, sort_order, is_published)
         VALUES
          (:category, :doc_number, :title, :url, :series_label, :sort_order, :is_published)'
    );
    $stmt->execute($data);

    $id = (int) $pdo->lastInsertId();
    $fetch = $pdo->prepare('SELECT * FROM documents WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => documents_row($fetch->fetch() ?: [])], 201);
}

function documents_update(): never
{
    api_require_manager();
    $pdo = api_pdo();
    documents_ensure_tables($pdo);
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Document id is required.'], 422);
    }

    $existing = $pdo->prepare('SELECT id FROM documents WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    if (!$existing->fetch()) {
        api_json(['ok' => false, 'error' => 'Document not found.'], 404);
    }

    $data = documents_payload($body);
    $data['id'] = $id;

    $stmt = $pdo->prepare(
        'UPDATE documents
         SET category = :category,
             doc_number = :doc_number,
             title = :title,
             url = :url,
             series_label = :series_label,
             sort_order = :sort_order,
             is_published = :is_published
         WHERE id = :id'
    );
    $stmt->execute($data);

    $fetch = $pdo->prepare('SELECT * FROM documents WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => documents_row($fetch->fetch() ?: [])]);
}

function documents_delete(): never
{
    api_require_manager();
    $pdo = api_pdo();
    documents_ensure_tables($pdo);
    $body = api_read_json();
    $ids = $body['ids'] ?? null;
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);

    if (is_array($ids) && $ids !== []) {
        $deleted = 0;
        $stmt = $pdo->prepare('DELETE FROM documents WHERE id = :id');
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
        api_json(['ok' => false, 'error' => 'Document id is required.'], 422);
    }

    $stmt = $pdo->prepare('DELETE FROM documents WHERE id = :id');
    $stmt->execute(['id' => $id]);
    if ($stmt->rowCount() < 1) {
        api_json(['ok' => false, 'error' => 'Document not found.'], 404);
    }
    api_json(['ok' => true]);
}
