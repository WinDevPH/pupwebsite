<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => projects_get(),
        'POST' => projects_create(),
        'PUT', 'PATCH' => projects_update(),
        'DELETE' => projects_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json([
        'ok' => false,
        'error' => 'Database unavailable. Import database/migrations/005_projects.sql and start MySQL.',
        'detail' => $error->getMessage(),
    ], 503);
}

/** @return list<array{label: string, to?: string, href?: string}> */
function projects_decode_links(mixed $raw): array
{
    if (is_string($raw)) {
        $decoded = json_decode($raw, true);
    } else {
        $decoded = $raw;
    }
    if (!is_array($decoded)) {
        return [];
    }

    $links = [];
    foreach ($decoded as $item) {
        if (!is_array($item)) {
            continue;
        }
        $label = trim((string) ($item['label'] ?? ''));
        if ($label === '') {
            continue;
        }
        $to = trim((string) ($item['to'] ?? ''));
        $href = trim((string) ($item['href'] ?? ''));
        $link = ['label' => $label];
        if ($to !== '') {
            $link['to'] = $to;
        }
        if ($href !== '') {
            $link['href'] = $href;
        }
        $links[] = $link;
    }
    return $links;
}

function projects_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'slug' => (string) $row['slug'],
        'title' => (string) $row['title'],
        'summary' => (string) $row['summary'],
        'body' => $row['body'] !== null && $row['body'] !== '' ? (string) $row['body'] : null,
        'image' => (string) $row['image_url'],
        'icon' => (string) $row['icon'],
        'links' => projects_decode_links($row['links_json'] ?? []),
        'sortOrder' => (int) $row['sort_order'],
        'published' => (int) $row['is_published'] === 1,
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}

function projects_get(): never
{
    $pdo = api_pdo();
    $slug = trim((string) ($_GET['slug'] ?? ''));
    $id = (int) ($_GET['id'] ?? 0);
    $includeAll = (string) ($_GET['all'] ?? '') === '1';

    if ($slug !== '' || $id > 0) {
        if ($id > 0) {
            $stmt = $pdo->prepare('SELECT * FROM projects WHERE id = :id LIMIT 1');
            $stmt->execute(['id' => $id]);
        } else {
            $stmt = $pdo->prepare('SELECT * FROM projects WHERE slug = :slug LIMIT 1');
            $stmt->execute(['slug' => $slug]);
        }
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Project not found.'], 404);
        }
        if ((int) $row['is_published'] !== 1) {
            $user = api_current_user();
            $role = strtolower((string) ($user['role'] ?? ''));
            if (!in_array($role, ['admin', 'officer'], true)) {
                api_json(['ok' => false, 'error' => 'Project not found.'], 404);
            }
        }
        api_json(['ok' => true, 'item' => projects_row($row)]);
    }

    if ($includeAll) {
        api_require_manager();
        $stmt = $pdo->query(
            'SELECT * FROM projects ORDER BY sort_order ASC, id ASC'
        );
    } else {
        $stmt = $pdo->query(
            'SELECT * FROM projects
             WHERE is_published = 1
             ORDER BY sort_order ASC, id ASC'
        );
    }

    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $items[] = projects_row($row);
    }

    api_json(['ok' => true, 'items' => $items]);
}

function projects_payload(): array
{
    $body = api_read_json();
    $title = trim((string) ($body['title'] ?? $body['label'] ?? ''));
    $summary = trim((string) ($body['summary'] ?? ''));
    $content = trim((string) ($body['body'] ?? ''));
    $slug = trim((string) ($body['slug'] ?? ''));
    $image = trim((string) ($body['image'] ?? $body['imageUrl'] ?? ''));
    $icon = strtolower(trim((string) ($body['icon'] ?? 'folder-kanban')));
    $sortOrder = (int) ($body['sortOrder'] ?? $body['sort_order'] ?? 0);
    $published = array_key_exists('published', $body)
        ? (bool) $body['published']
        : (array_key_exists('isPublished', $body) ? (bool) $body['isPublished'] : true);
    $linksRaw = $body['links'] ?? [];

    $allowedIcons = [
        'calendar-check',
        'megaphone',
        'printer',
        'wifi',
        'book-open',
        'users',
        'folder-kanban',
    ];

    if ($title === '') {
        api_json(['ok' => false, 'error' => 'Title is required.'], 422);
    }
    if ($summary === '') {
        api_json(['ok' => false, 'error' => 'Summary is required.'], 422);
    }
    if ($image === '') {
        api_json(['ok' => false, 'error' => 'Image is required.'], 422);
    }
    if (!in_array($icon, $allowedIcons, true)) {
        api_json(['ok' => false, 'error' => 'Choose a valid project icon.'], 422);
    }

    if ($slug === '') {
        $slug = api_slugify($title);
    } else {
        $slug = api_slugify($slug);
    }

    $links = [];
    if (is_array($linksRaw)) {
        foreach ($linksRaw as $item) {
            if (!is_array($item)) {
                continue;
            }
            $label = trim((string) ($item['label'] ?? ''));
            if ($label === '') {
                continue;
            }
            $to = trim((string) ($item['to'] ?? ''));
            $href = trim((string) ($item['href'] ?? ''));
            $link = ['label' => $label];
            if ($to !== '') {
                $link['to'] = $to;
            }
            if ($href !== '') {
                $link['href'] = $href;
            }
            if (!isset($link['to']) && !isset($link['href'])) {
                continue;
            }
            $links[] = $link;
        }
    }

    return [
        'slug' => $slug,
        'title' => $title,
        'summary' => $summary,
        'body' => $content !== '' ? $content : null,
        'image_url' => $image,
        'icon' => $icon,
        'links_json' => json_encode($links, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        'sort_order' => $sortOrder,
        'is_published' => $published ? 1 : 0,
    ];
}

function projects_create(): never
{
    api_require_manager();
    $data = projects_payload();
    $pdo = api_pdo();

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO projects
              (slug, title, summary, body, image_url, icon, links_json, sort_order, is_published)
             VALUES
              (:slug, :title, :summary, :body, :image_url, :icon, :links_json, :sort_order, :is_published)'
        );
        $stmt->execute($data);
    } catch (PDOException $error) {
        if ((int) $error->getCode() === 23000) {
            api_json(['ok' => false, 'error' => 'A project with this slug already exists.'], 409);
        }
        throw $error;
    }

    $id = (int) $pdo->lastInsertId();
    $stmt = $pdo->prepare('SELECT * FROM projects WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => projects_row($stmt->fetch() ?: [])], 201);
}

function projects_update(): never
{
    api_require_manager();
    $pdo = api_pdo();
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Project id is required.'], 422);
    }

    $existing = $pdo->prepare('SELECT id FROM projects WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    if (!$existing->fetch()) {
        api_json(['ok' => false, 'error' => 'Project not found.'], 404);
    }

    $data = projects_payload();
    $data['id'] = $id;

    try {
        $stmt = $pdo->prepare(
            'UPDATE projects
             SET slug = :slug,
                 title = :title,
                 summary = :summary,
                 body = :body,
                 image_url = :image_url,
                 icon = :icon,
                 links_json = :links_json,
                 sort_order = :sort_order,
                 is_published = :is_published
             WHERE id = :id'
        );
        $stmt->execute($data);
    } catch (PDOException $error) {
        if ((int) $error->getCode() === 23000) {
            api_json(['ok' => false, 'error' => 'A project with this slug already exists.'], 409);
        }
        throw $error;
    }

    $stmt = $pdo->prepare('SELECT * FROM projects WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => projects_row($stmt->fetch() ?: [])]);
}

function projects_delete(): never
{
    api_require_manager();
    $pdo = api_pdo();
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Project id is required.'], 422);
    }

    $stmt = $pdo->prepare('DELETE FROM projects WHERE id = :id');
    $stmt->execute(['id' => $id]);
    if ($stmt->rowCount() < 1) {
        api_json(['ok' => false, 'error' => 'Project not found.'], 404);
    }

    api_json(['ok' => true]);
}
