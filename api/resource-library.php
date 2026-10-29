<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/resource-library.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => resource_library_get(),
        'POST' => resource_library_create_link(),
        'PUT', 'PATCH' => resource_library_put(),
        'DELETE' => resource_library_delete_link(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json_db_error($error);
}

function resource_library_get(): never
{
    $pdo = api_pdo();
    resource_library_ensure($pdo);
    $id = (int) ($_GET['id'] ?? 0);
    $includeAll = (string) ($_GET['all'] ?? '') === '1';

    if ($id > 0) {
        $stmt = $pdo->prepare('SELECT * FROM resource_links WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Resource link not found.'], 404);
        }
        if ((int) $row['is_published'] !== 1) {
            api_require_manager();
        }
        api_json(['ok' => true, 'item' => resource_link_row($row)]);
    }

    if ($includeAll) {
        api_require_manager();
        $stmt = $pdo->query('SELECT * FROM resource_links ORDER BY sort_order ASC, id ASC');
    } else {
        $stmt = $pdo->query(
            'SELECT * FROM resource_links WHERE is_published = 1 ORDER BY sort_order ASC, id ASC'
        );
    }

    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $items[] = resource_link_row($row);
    }

    api_json([
        'ok' => true,
        'items' => $items,
    ]);
}

function resource_library_put(): never
{
    api_require_manager();
    $pdo = api_pdo();
    resource_library_ensure($pdo);
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);

    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Resource link id is required.'], 422);
    }

    resource_library_update_link($pdo, $id, $body);
}

function resource_link_payload(array $body): array
{
    $title = trim((string) ($body['title'] ?? ''));
    $url = trim((string) ($body['url'] ?? $body['href'] ?? ''));
    $slug = trim((string) ($body['slug'] ?? ''));
    $sortOrder = (int) ($body['sortOrder'] ?? $body['sort_order'] ?? 0);
    $published = array_key_exists('published', $body)
        ? (bool) $body['published']
        : (array_key_exists('isPublished', $body) ? (bool) $body['isPublished'] : true);

    if ($title === '') {
        api_json(['ok' => false, 'error' => 'Title is required.'], 422);
    }
    if ($url === '' || !preg_match('#^https?://#i', $url)) {
        api_json(['ok' => false, 'error' => 'A valid http(s) link is required.'], 422);
    }
    if (mb_strlen($url) > 800) {
        api_json(['ok' => false, 'error' => 'Link is too long.'], 422);
    }
    if ($slug === '') {
        $slug = api_slugify($title);
    } else {
        $slug = api_slugify($slug);
    }
    $slug = substr($slug, 0, 64);
    if ($slug === '') {
        api_json(['ok' => false, 'error' => 'A valid slug is required.'], 422);
    }

    return [
        'slug' => $slug,
        'title' => $title,
        'url' => $url,
        'sort_order' => $sortOrder,
        'is_published' => $published ? 1 : 0,
    ];
}

function resource_library_create_link(): never
{
    api_require_manager();
    $pdo = api_pdo();
    resource_library_ensure($pdo);
    $data = resource_link_payload(api_read_json());

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO resource_links (slug, title, url, sort_order, is_published)
             VALUES (:slug, :title, :url, :sort_order, :is_published)'
        );
        $stmt->execute($data);
    } catch (PDOException $error) {
        if ((int) $error->getCode() === 23000) {
            api_json(['ok' => false, 'error' => 'A resource link with this slug already exists.'], 409);
        }
        throw $error;
    }

    $id = (int) $pdo->lastInsertId();
    $stmt = $pdo->prepare('SELECT * FROM resource_links WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => resource_link_row($stmt->fetch() ?: [])], 201);
}

function resource_library_update_link(PDO $pdo, int $id, array $body): never
{
    $existing = $pdo->prepare('SELECT id FROM resource_links WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    if (!$existing->fetch()) {
        api_json(['ok' => false, 'error' => 'Resource link not found.'], 404);
    }

    $data = resource_link_payload($body);
    $data['id'] = $id;
    try {
        $stmt = $pdo->prepare(
            'UPDATE resource_links
             SET slug = :slug,
                 title = :title,
                 url = :url,
                 sort_order = :sort_order,
                 is_published = :is_published
             WHERE id = :id'
        );
        $stmt->execute($data);
    } catch (PDOException $error) {
        if ((int) $error->getCode() === 23000) {
            api_json(['ok' => false, 'error' => 'A resource link with this slug already exists.'], 409);
        }
        throw $error;
    }

    $stmt = $pdo->prepare('SELECT * FROM resource_links WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => resource_link_row($stmt->fetch() ?: [])]);
}

function resource_library_delete_link(): never
{
    api_require_manager();
    $pdo = api_pdo();
    resource_library_ensure($pdo);
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Resource link id is required.'], 422);
    }

    $stmt = $pdo->prepare('DELETE FROM resource_links WHERE id = :id');
    $stmt->execute(['id' => $id]);
    if ($stmt->rowCount() < 1) {
        api_json(['ok' => false, 'error' => 'Resource link not found.'], 404);
    }

    api_json(['ok' => true]);
}
