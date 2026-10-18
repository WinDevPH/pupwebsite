<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => calendar_get(),
        'POST' => calendar_create(),
        'PUT', 'PATCH' => calendar_update(),
        'DELETE' => calendar_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json([
        'ok' => false,
        'error' => 'Database unavailable. Import database/migrations/003_calendar_events.sql and start MySQL.',
        'detail' => $error->getMessage(),
    ], 503);
}

function calendar_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'slug' => (string) $row['slug'],
        'kind' => (string) $row['kind'],
        'title' => (string) $row['title'],
        'description' => $row['description'] !== null ? (string) $row['description'] : null,
        'image' => $row['image_url'] !== null && $row['image_url'] !== ''
            ? (string) $row['image_url']
            : null,
        'start' => (string) $row['start_date'],
        'end' => (string) $row['end_date'],
        'sortOrder' => (int) $row['sort_order'],
        'published' => (int) $row['is_published'] === 1,
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}

function calendar_get(): never
{
    $pdo = api_pdo();
    $slug = trim((string) ($_GET['slug'] ?? ''));
    $id = (int) ($_GET['id'] ?? 0);
    $includeAll = (string) ($_GET['all'] ?? '') === '1';

    if ($slug !== '' || $id > 0) {
        if ($id > 0) {
            $stmt = $pdo->prepare('SELECT * FROM calendar_events WHERE id = :id LIMIT 1');
            $stmt->execute(['id' => $id]);
        } else {
            $stmt = $pdo->prepare('SELECT * FROM calendar_events WHERE slug = :slug LIMIT 1');
            $stmt->execute(['slug' => $slug]);
        }
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Calendar event not found.'], 404);
        }
        if ((int) $row['is_published'] !== 1) {
            $user = api_current_user();
            $role = strtolower((string) ($user['role'] ?? ''));
            if (!in_array($role, ['admin', 'officer'], true)) {
                api_json(['ok' => false, 'error' => 'Calendar event not found.'], 404);
            }
        }
        api_json(['ok' => true, 'item' => calendar_row($row)]);
    }

    if ($includeAll) {
        api_require_manager();
        $stmt = $pdo->query(
            'SELECT * FROM calendar_events
             ORDER BY start_date ASC, sort_order ASC, id ASC'
        );
    } else {
        $stmt = $pdo->query(
            'SELECT * FROM calendar_events
             WHERE is_published = 1
             ORDER BY start_date ASC, sort_order ASC, id ASC'
        );
    }

    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $items[] = calendar_row($row);
    }

    api_json(['ok' => true, 'items' => $items]);
}

function calendar_payload(): array
{
    $body = api_read_json();
    $title = trim((string) ($body['title'] ?? ''));
    $kind = strtolower(trim((string) ($body['kind'] ?? 'academic')));
    $slug = trim((string) ($body['slug'] ?? ''));
    $description = trim((string) ($body['description'] ?? ''));
    $image = trim((string) ($body['image'] ?? $body['imageUrl'] ?? ''));
    $start = trim((string) ($body['start'] ?? $body['startDate'] ?? ''));
    $end = trim((string) ($body['end'] ?? $body['endDate'] ?? ''));
    $sortOrder = (int) ($body['sortOrder'] ?? $body['sort_order'] ?? 0);
    $published = array_key_exists('published', $body)
        ? (bool) $body['published']
        : (array_key_exists('isPublished', $body) ? (bool) $body['isPublished'] : true);

    if ($title === '') {
        api_json(['ok' => false, 'error' => 'Title is required.'], 422);
    }
    if (!in_array($kind, ['holiday', 'exam', 'enrollment', 'academic'], true)) {
        api_json(['ok' => false, 'error' => 'Kind must be holiday, exam, enrollment, or academic.'], 422);
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $start)) {
        api_json(['ok' => false, 'error' => 'Enter a valid start date (YYYY-MM-DD).'], 422);
    }
    if ($end === '') {
        $end = $start;
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $end)) {
        api_json(['ok' => false, 'error' => 'Enter a valid end date (YYYY-MM-DD).'], 422);
    }
    if ($end < $start) {
        api_json(['ok' => false, 'error' => 'End date must be on or after the start date.'], 422);
    }

    if ($slug === '') {
        $slug = api_slugify($title);
    } else {
        $slug = api_slugify($slug);
    }

    return [
        'slug' => $slug,
        'kind' => $kind,
        'title' => $title,
        'description' => $description !== '' ? $description : null,
        'image_url' => $image !== '' ? $image : null,
        'start_date' => $start,
        'end_date' => $end,
        'sort_order' => $sortOrder,
        'is_published' => $published ? 1 : 0,
    ];
}

function calendar_create(): never
{
    api_require_manager();
    $data = calendar_payload();
    $pdo = api_pdo();

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO calendar_events
              (slug, kind, title, description, image_url, start_date, end_date, sort_order, is_published)
             VALUES
              (:slug, :kind, :title, :description, :image_url, :start_date, :end_date, :sort_order, :is_published)'
        );
        $stmt->execute($data);
    } catch (PDOException $error) {
        if ((int) $error->getCode() === 23000) {
            api_json(['ok' => false, 'error' => 'A calendar event with this slug already exists.'], 409);
        }
        throw $error;
    }

    $id = (int) $pdo->lastInsertId();
    $stmt = $pdo->prepare('SELECT * FROM calendar_events WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();
    api_json([
        'ok' => true,
        'item' => calendar_row($row ?: $data + [
            'id' => $id,
            'created_at' => date('c'),
            'updated_at' => date('c'),
        ]),
    ], 201);
}

function calendar_update(): never
{
    api_require_manager();
    $pdo = api_pdo();
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Calendar event id is required.'], 422);
    }

    $existing = $pdo->prepare('SELECT id FROM calendar_events WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    if (!$existing->fetch()) {
        api_json(['ok' => false, 'error' => 'Calendar event not found.'], 404);
    }

    $data = calendar_payload();
    $data['id'] = $id;

    try {
        $stmt = $pdo->prepare(
            'UPDATE calendar_events
             SET slug = :slug,
                 kind = :kind,
                 title = :title,
                 description = :description,
                 image_url = :image_url,
                 start_date = :start_date,
                 end_date = :end_date,
                 sort_order = :sort_order,
                 is_published = :is_published
             WHERE id = :id'
        );
        $stmt->execute($data);
    } catch (PDOException $error) {
        if ((int) $error->getCode() === 23000) {
            api_json(['ok' => false, 'error' => 'A calendar event with this slug already exists.'], 409);
        }
        throw $error;
    }

    $stmt = $pdo->prepare('SELECT * FROM calendar_events WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => calendar_row($stmt->fetch() ?: [])]);
}

function calendar_delete(): never
{
    api_require_manager();
    $pdo = api_pdo();
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Calendar event id is required.'], 422);
    }

    $stmt = $pdo->prepare('DELETE FROM calendar_events WHERE id = :id');
    $stmt->execute(['id' => $id]);
    if ($stmt->rowCount() < 1) {
        api_json(['ok' => false, 'error' => 'Calendar event not found.'], 404);
    }

    api_json(['ok' => true]);
}
