<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => faq_get(),
        'POST' => faq_create(),
        'PUT', 'PATCH' => faq_update(),
        'DELETE' => faq_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json([
        'ok' => false,
        'error' => 'Database unavailable. Run scripts/run-012-public-cms.php and start MySQL.',
        'detail' => $error->getMessage(),
    ], 503);
}

function faq_ensure_tables(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS faq_items (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          slug VARCHAR(64) NOT NULL,
          question VARCHAR(500) NOT NULL,
          answer_html LONGTEXT NOT NULL,
          sort_order INT NOT NULL DEFAULT 0,
          is_published TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_faq_items_slug (slug),
          KEY idx_faq_items_published (is_published, sort_order, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $ready = true;
}

function faq_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'slug' => (string) $row['slug'],
        'question' => (string) $row['question'],
        'answerHtml' => (string) $row['answer_html'],
        'answer' => (string) $row['answer_html'],
        'sortOrder' => (int) ($row['sort_order'] ?? 0),
        'published' => (int) ($row['is_published'] ?? 0) === 1,
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}

function faq_payload(?array $body = null): array
{
    $body ??= api_read_json();
    $question = trim((string) ($body['question'] ?? ''));
    $answer = trim((string) ($body['answerHtml'] ?? $body['answer'] ?? $body['answer_html'] ?? ''));
    $slug = trim((string) ($body['slug'] ?? ''));
    $sortOrder = (int) ($body['sortOrder'] ?? $body['sort_order'] ?? 0);
    $published = array_key_exists('published', $body)
        ? (bool) $body['published']
        : (array_key_exists('isPublished', $body) ? (bool) $body['isPublished'] : true);

    if ($question === '') {
        api_json(['ok' => false, 'error' => 'Question is required.'], 422);
    }
    if ($answer === '') {
        api_json(['ok' => false, 'error' => 'Answer is required.'], 422);
    }
    if (mb_strlen($question) > 500) {
        api_json(['ok' => false, 'error' => 'Question is too long.'], 422);
    }
    if ($slug === '') {
        $slug = api_slugify($question);
    } else {
        $slug = api_slugify($slug);
    }

    return [
        'slug' => $slug,
        'question' => $question,
        'answer_html' => $answer,
        'sort_order' => $sortOrder,
        'is_published' => $published ? 1 : 0,
    ];
}

function faq_get(): never
{
    $pdo = api_pdo();
    faq_ensure_tables($pdo);

    $id = (int) ($_GET['id'] ?? 0);
    $slug = trim((string) ($_GET['slug'] ?? ''));
    $includeAll = (string) ($_GET['all'] ?? '') === '1';

    if ($id > 0 || $slug !== '') {
        if ($id > 0) {
            $stmt = $pdo->prepare('SELECT * FROM faq_items WHERE id = :id LIMIT 1');
            $stmt->execute(['id' => $id]);
        } else {
            $stmt = $pdo->prepare('SELECT * FROM faq_items WHERE slug = :slug LIMIT 1');
            $stmt->execute(['slug' => $slug]);
        }
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'FAQ item not found.'], 404);
        }
        if ((int) $row['is_published'] !== 1) {
            api_require_manager();
        }
        api_json(['ok' => true, 'item' => faq_row($row)]);
    }

    if ($includeAll) {
        api_require_manager();
        $stmt = $pdo->query('SELECT * FROM faq_items ORDER BY sort_order ASC, id ASC');
    } else {
        $stmt = $pdo->query(
            'SELECT * FROM faq_items
             WHERE is_published = 1
             ORDER BY sort_order ASC, id ASC'
        );
    }

    $items = [];
    if ($stmt) {
        foreach ($stmt->fetchAll() as $row) {
            $items[] = faq_row($row);
        }
    }

    api_json(['ok' => true, 'items' => $items]);
}

function faq_create(): never
{
    api_require_manager();
    $pdo = api_pdo();
    faq_ensure_tables($pdo);
    $data = faq_payload();

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO faq_items (slug, question, answer_html, sort_order, is_published)
             VALUES (:slug, :question, :answer_html, :sort_order, :is_published)'
        );
        $stmt->execute($data);
    } catch (PDOException $error) {
        if ((int) $error->getCode() === 23000) {
            api_json(['ok' => false, 'error' => 'An FAQ with this slug already exists.'], 409);
        }
        throw $error;
    }

    $id = (int) $pdo->lastInsertId();
    $fetch = $pdo->prepare('SELECT * FROM faq_items WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => faq_row($fetch->fetch() ?: [])], 201);
}

function faq_update(): never
{
    api_require_manager();
    $pdo = api_pdo();
    faq_ensure_tables($pdo);
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'FAQ id is required.'], 422);
    }

    $existing = $pdo->prepare('SELECT id FROM faq_items WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    if (!$existing->fetch()) {
        api_json(['ok' => false, 'error' => 'FAQ item not found.'], 404);
    }

    $data = faq_payload($body);
    $data['id'] = $id;

    try {
        $stmt = $pdo->prepare(
            'UPDATE faq_items
             SET slug = :slug,
                 question = :question,
                 answer_html = :answer_html,
                 sort_order = :sort_order,
                 is_published = :is_published
             WHERE id = :id'
        );
        $stmt->execute($data);
    } catch (PDOException $error) {
        if ((int) $error->getCode() === 23000) {
            api_json(['ok' => false, 'error' => 'An FAQ with this slug already exists.'], 409);
        }
        throw $error;
    }

    $fetch = $pdo->prepare('SELECT * FROM faq_items WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => faq_row($fetch->fetch() ?: [])]);
}

function faq_delete(): never
{
    api_require_manager();
    $pdo = api_pdo();
    faq_ensure_tables($pdo);
    $body = api_read_json();
    $ids = $body['ids'] ?? null;
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);

    if (is_array($ids) && $ids !== []) {
        $deleted = 0;
        $stmt = $pdo->prepare('DELETE FROM faq_items WHERE id = :id');
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
        api_json(['ok' => false, 'error' => 'FAQ id is required.'], 422);
    }

    $stmt = $pdo->prepare('DELETE FROM faq_items WHERE id = :id');
    $stmt->execute(['id' => $id]);
    if ($stmt->rowCount() < 1) {
        api_json(['ok' => false, 'error' => 'FAQ item not found.'], 404);
    }
    api_json(['ok' => true]);
}
