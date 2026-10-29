<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/resource-forms.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => form_groups_get(),
        'POST' => form_groups_create(),
        'PUT', 'PATCH' => form_groups_update(),
        'DELETE' => form_groups_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json_db_error($error);
}

function form_groups_payload(?array $body = null): array
{
    $body ??= api_read_json();
    $title = trim((string) ($body['title'] ?? ''));
    $note = trim((string) ($body['note'] ?? ''));
    $slug = trim((string) ($body['slug'] ?? ''));
    $sortOrder = (int) ($body['sortOrder'] ?? $body['sort_order'] ?? 0);
    $published = array_key_exists('published', $body)
        ? (bool) $body['published']
        : (array_key_exists('isPublished', $body) ? (bool) $body['isPublished'] : true);

    if ($title === '') {
        api_json(['ok' => false, 'error' => 'Title is required.'], 422);
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
        'note' => $note !== '' ? $note : null,
        'sort_order' => $sortOrder,
        'is_published' => $published ? 1 : 0,
    ];
}

function form_groups_get(): never
{
    $pdo = api_pdo();
    resource_forms_ensure($pdo);
    $id = (int) ($_GET['id'] ?? 0);
    $includeAll = (string) ($_GET['all'] ?? '') === '1';
    $withFiles = (string) ($_GET['withFiles'] ?? '') === '1';

    if ($id > 0) {
        $stmt = $pdo->prepare('SELECT * FROM form_groups WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Form group not found.'], 404);
        }
        if ((int) $row['is_published'] !== 1) {
            api_require_manager();
        }
        $item = resource_form_group_row($row);
        if ($withFiles) {
            $item['files'] = resource_form_files_for_group(
                $pdo,
                (int) $row['id'],
                (int) $row['is_published'] === 1 && !$includeAll
            );
        }
        api_json(['ok' => true, 'item' => $item]);
    }

    if ($includeAll) {
        api_require_manager();
        $stmt = $pdo->query('SELECT * FROM form_groups ORDER BY sort_order ASC, id ASC');
    } else {
        $stmt = $pdo->query(
            'SELECT * FROM form_groups WHERE is_published = 1 ORDER BY sort_order ASC, id ASC'
        );
    }

    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $files = resource_form_files_for_group($pdo, (int) $row['id'], !$includeAll);
        $item = resource_form_group_row($row, count($files));
        if ($withFiles) {
            $item['files'] = $files;
        }
        $items[] = $item;
    }

    api_json(['ok' => true, 'items' => $items]);
}

function form_groups_create(): never
{
    api_require_manager();
    $data = form_groups_payload();
    $pdo = api_pdo();
    resource_forms_ensure($pdo);

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO form_groups (slug, title, note, sort_order, is_published)
             VALUES (:slug, :title, :note, :sort_order, :is_published)'
        );
        $stmt->execute($data);
    } catch (PDOException $error) {
        if ((int) $error->getCode() === 23000) {
            api_json(['ok' => false, 'error' => 'A form group with this slug already exists.'], 409);
        }
        throw $error;
    }

    $id = (int) $pdo->lastInsertId();
    $stmt = $pdo->prepare('SELECT * FROM form_groups WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => resource_form_group_row($stmt->fetch() ?: [])], 201);
}

function form_groups_update(): never
{
    api_require_manager();
    $pdo = api_pdo();
    resource_forms_ensure($pdo);
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Form group id is required.'], 422);
    }

    $existing = $pdo->prepare('SELECT id FROM form_groups WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    if (!$existing->fetch()) {
        api_json(['ok' => false, 'error' => 'Form group not found.'], 404);
    }

    $data = form_groups_payload($body);
    $data['id'] = $id;

    try {
        $stmt = $pdo->prepare(
            'UPDATE form_groups
             SET slug = :slug,
                 title = :title,
                 note = :note,
                 sort_order = :sort_order,
                 is_published = :is_published
             WHERE id = :id'
        );
        $stmt->execute($data);
    } catch (PDOException $error) {
        if ((int) $error->getCode() === 23000) {
            api_json(['ok' => false, 'error' => 'A form group with this slug already exists.'], 409);
        }
        throw $error;
    }

    $stmt = $pdo->prepare('SELECT * FROM form_groups WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => resource_form_group_row($stmt->fetch() ?: [])]);
}

function form_groups_delete(): never
{
    api_require_manager();
    $pdo = api_pdo();
    resource_forms_ensure($pdo);
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Form group id is required.'], 422);
    }

    $stmt = $pdo->prepare('DELETE FROM form_groups WHERE id = :id');
    $stmt->execute(['id' => $id]);
    if ($stmt->rowCount() < 1) {
        api_json(['ok' => false, 'error' => 'Form group not found.'], 404);
    }

    api_json(['ok' => true]);
}
