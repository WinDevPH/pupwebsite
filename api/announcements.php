<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => announcements_get(),
        'POST' => announcements_create(),
        'PUT', 'PATCH' => announcements_update(),
        'DELETE' => announcements_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json_db_error($error);
}

function announcements_row(array $row): array
{
    $slug = (string) $row['slug'];
    $link = $row['link_url'] !== null && $row['link_url'] !== ''
        ? (string) $row['link_url']
        : '/announcements/' . $slug;
    $external = (int) $row['is_external'] === 1;

    return [
        'id' => (int) $row['id'],
        'slug' => $slug,
        'kind' => (string) $row['kind'],
        'title' => (string) $row['title'],
        'summary' => (string) $row['summary'],
        'body' => $row['body'] !== null ? (string) $row['body'] : null,
        'image' => (string) $row['image_url'],
        'href' => $link,
        'external' => $external,
        'source' => $row['source'] !== null ? (string) $row['source'] : null,
        'date' => api_iso((string) $row['published_at']),
        'published' => (int) $row['is_published'] === 1,
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}

function announcements_get(): never
{
    $pdo = api_pdo();
    $slug = trim((string) ($_GET['slug'] ?? ''));
    $id = (int) ($_GET['id'] ?? 0);
    $includeAll = (string) ($_GET['all'] ?? '') === '1';

    if ($slug !== '' || $id > 0) {
        if ($id > 0) {
            $stmt = $pdo->prepare('SELECT * FROM announcements WHERE id = :id LIMIT 1');
            $stmt->execute(['id' => $id]);
        } else {
            $stmt = $pdo->prepare('SELECT * FROM announcements WHERE slug = :slug LIMIT 1');
            $stmt->execute(['slug' => $slug]);
        }
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Announcement not found.'], 404);
        }
        if ((int) $row['is_published'] !== 1) {
            $user = api_current_user();
            $role = strtolower((string) ($user['role'] ?? ''));
            if (!in_array($role, ['admin', 'officer'], true)) {
                api_json(['ok' => false, 'error' => 'Announcement not found.'], 404);
            }
        }
        api_json(['ok' => true, 'item' => announcements_row($row)]);
    }

    if ($includeAll) {
        api_require_manager();
        $stmt = $pdo->query(
            'SELECT * FROM announcements ORDER BY published_at DESC, id DESC'
        );
    } else {
        $stmt = $pdo->query(
            'SELECT * FROM announcements
             WHERE is_published = 1
             ORDER BY published_at DESC, id DESC'
        );
    }

    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $items[] = announcements_row($row);
    }

    api_json(['ok' => true, 'items' => $items]);
}

function announcements_payload(): array
{
    $body = api_read_json();
    $title = trim((string) ($body['title'] ?? ''));
    $summary = trim((string) ($body['summary'] ?? ''));
    $kind = strtolower(trim((string) ($body['kind'] ?? 'issuance')));
    $slug = trim((string) ($body['slug'] ?? ''));
    $image = trim((string) ($body['image'] ?? $body['imageUrl'] ?? ''));
    $link = trim((string) ($body['href'] ?? $body['linkUrl'] ?? ''));
    $source = trim((string) ($body['source'] ?? ''));
    $content = trim((string) ($body['body'] ?? ''));
    $external = (bool) ($body['external'] ?? $body['isExternal'] ?? false);
    $published = array_key_exists('published', $body)
        ? (bool) $body['published']
        : (array_key_exists('isPublished', $body) ? (bool) $body['isPublished'] : true);
    $dateRaw = trim((string) ($body['date'] ?? $body['publishedAt'] ?? ''));

    if ($title === '') {
        api_json(['ok' => false, 'error' => 'Title is required.'], 422);
    }
    if ($summary === '') {
        api_json(['ok' => false, 'error' => 'Summary is required.'], 422);
    }
    if (!in_array($kind, ['issuance', 'event', 'social'], true)) {
        api_json(['ok' => false, 'error' => 'Kind must be issuance, event, or social.'], 422);
    }
    if ($image === '') {
        api_json(['ok' => false, 'error' => 'Image URL is required.'], 422);
    }

    if ($slug === '') {
        $slug = api_slugify($title);
    } else {
        $slug = api_slugify($slug);
    }

    if ($dateRaw === '') {
        $publishedAt = strtotime(date('Y-m-d') . ' 00:00:00');
    } elseif (preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateRaw) === 1) {
        $publishedAt = strtotime($dateRaw . ' 00:00:00');
    } else {
        $publishedAt = strtotime($dateRaw);
    }
    if ($publishedAt === false) {
        api_json(['ok' => false, 'error' => 'Enter a valid publish date.'], 422);
    }

    return [
        'slug' => $slug,
        'kind' => $kind,
        'title' => $title,
        'summary' => $summary,
        'body' => $content !== '' ? $content : null,
        'image_url' => $image,
        'link_url' => $link !== '' ? $link : null,
        'is_external' => $external ? 1 : 0,
        'source' => $source !== '' ? $source : null,
        'published_at' => date('Y-m-d 00:00:00', $publishedAt),
        'is_published' => $published ? 1 : 0,
    ];
}

function announcements_create(): never
{
    api_require_manager();
    $data = announcements_payload();
    $pdo = api_pdo();

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO announcements
              (slug, kind, title, summary, body, image_url, link_url, is_external, source, published_at, is_published)
             VALUES
              (:slug, :kind, :title, :summary, :body, :image_url, :link_url, :is_external, :source, :published_at, :is_published)'
        );
        $stmt->execute($data);
    } catch (PDOException $error) {
        if ((int) $error->getCode() === 23000) {
            api_json(['ok' => false, 'error' => 'An announcement with this slug already exists.'], 409);
        }
        throw $error;
    }

    $id = (int) $pdo->lastInsertId();
    $stmt = $pdo->prepare('SELECT * FROM announcements WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();
    api_json(['ok' => true, 'item' => announcements_row($row ?: $data + ['id' => $id, 'created_at' => date('c'), 'updated_at' => date('c')])], 201);
}

function announcements_update(): never
{
    api_require_manager();
    $pdo = api_pdo();
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Announcement id is required.'], 422);
    }

    $existing = $pdo->prepare('SELECT id FROM announcements WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    if (!$existing->fetch()) {
        api_json(['ok' => false, 'error' => 'Announcement not found.'], 404);
    }

    $data = announcements_payload();
    $data['id'] = $id;

    try {
        $stmt = $pdo->prepare(
            'UPDATE announcements
             SET slug = :slug,
                 kind = :kind,
                 title = :title,
                 summary = :summary,
                 body = :body,
                 image_url = :image_url,
                 link_url = :link_url,
                 is_external = :is_external,
                 source = :source,
                 published_at = :published_at,
                 is_published = :is_published
             WHERE id = :id'
        );
        $stmt->execute($data);
    } catch (PDOException $error) {
        if ((int) $error->getCode() === 23000) {
            api_json(['ok' => false, 'error' => 'An announcement with this slug already exists.'], 409);
        }
        throw $error;
    }

    $stmt = $pdo->prepare('SELECT * FROM announcements WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => announcements_row($stmt->fetch() ?: [])]);
}

function announcements_delete(): never
{
    api_require_manager();
    $pdo = api_pdo();
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Announcement id is required.'], 422);
    }

    $stmt = $pdo->prepare('DELETE FROM announcements WHERE id = :id');
    $stmt->execute(['id' => $id]);
    if ($stmt->rowCount() < 1) {
        api_json(['ok' => false, 'error' => 'Announcement not found.'], 404);
    }

    api_json(['ok' => true]);
}
