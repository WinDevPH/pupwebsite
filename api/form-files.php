<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/resource-forms.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => form_files_get(),
        'POST' => form_files_create(),
        'PUT', 'PATCH' => form_files_update(),
        'DELETE' => form_files_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json([
        'ok' => false,
        'error' => 'Database unavailable. Run scripts/run-017-resource-forms.php and start MySQL.',
        'detail' => $error->getMessage(),
    ], 503);
}

function form_files_payload(PDO $pdo, ?array $body = null): array
{
    $body ??= api_read_json();
    $groupId = (int) ($body['groupId'] ?? $body['group_id'] ?? 0);
    $title = trim((string) ($body['title'] ?? ''));
    $url = trim((string) ($body['url'] ?? $body['href'] ?? ''));
    $sortOrder = (int) ($body['sortOrder'] ?? $body['sort_order'] ?? 0);
    $published = array_key_exists('published', $body)
        ? (bool) $body['published']
        : (array_key_exists('isPublished', $body) ? (bool) $body['isPublished'] : true);

    if ($groupId <= 0) {
        api_json(['ok' => false, 'error' => 'Choose a form group.'], 422);
    }
    $group = $pdo->prepare('SELECT id FROM form_groups WHERE id = :id LIMIT 1');
    $group->execute(['id' => $groupId]);
    if (!$group->fetch()) {
        api_json(['ok' => false, 'error' => 'Form group not found.'], 404);
    }
    if ($title === '') {
        api_json(['ok' => false, 'error' => 'Title is required.'], 422);
    }
    if ($url === '') {
        api_json(['ok' => false, 'error' => 'Link is required.'], 422);
    }
    if (mb_strlen($url) > 800) {
        api_json(['ok' => false, 'error' => 'Link is too long.'], 422);
    }

    return [
        'group_id' => $groupId,
        'title' => $title,
        'url' => $url,
        'sort_order' => $sortOrder,
        'is_published' => $published ? 1 : 0,
    ];
}

function form_files_get(): never
{
    $pdo = api_pdo();
    resource_forms_ensure($pdo);
    $id = (int) ($_GET['id'] ?? 0);
    $groupId = (int) ($_GET['groupId'] ?? $_GET['group_id'] ?? 0);
    $includeAll = (string) ($_GET['all'] ?? '') === '1';

    if ($id > 0) {
        $stmt = $pdo->prepare('SELECT * FROM form_files WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Form file not found.'], 404);
        }
        if ((int) $row['is_published'] !== 1) {
            api_require_manager();
        }
        api_json(['ok' => true, 'item' => resource_form_file_row($row)]);
    }

    if ($includeAll) {
        api_require_manager();
    }

    $sql = 'SELECT * FROM form_files';
    $where = [];
    $params = [];
    if ($groupId > 0) {
        $where[] = 'group_id = :group_id';
        $params['group_id'] = $groupId;
    }
    if (!$includeAll) {
        $where[] = 'is_published = 1';
    }
    if ($where !== []) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY sort_order ASC, id ASC';

    $stmt = $params === [] ? $pdo->query($sql) : $pdo->prepare($sql);
    if ($params !== []) {
        $stmt->execute($params);
    }

    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $items[] = resource_form_file_row($row);
    }
    api_json(['ok' => true, 'items' => $items]);
}

function form_files_create(): never
{
    api_require_manager();
    $pdo = api_pdo();
    resource_forms_ensure($pdo);
    $data = form_files_payload($pdo);

    $stmt = $pdo->prepare(
        'INSERT INTO form_files (group_id, title, url, sort_order, is_published)
         VALUES (:group_id, :title, :url, :sort_order, :is_published)'
    );
    $stmt->execute($data);

    $id = (int) $pdo->lastInsertId();
    $stmt = $pdo->prepare('SELECT * FROM form_files WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => resource_form_file_row($stmt->fetch() ?: [])], 201);
}

function form_files_update(): never
{
    api_require_manager();
    $pdo = api_pdo();
    resource_forms_ensure($pdo);
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Form file id is required.'], 422);
    }

    $existing = $pdo->prepare('SELECT id FROM form_files WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    if (!$existing->fetch()) {
        api_json(['ok' => false, 'error' => 'Form file not found.'], 404);
    }

    $data = form_files_payload($pdo, $body);
    $data['id'] = $id;
    $stmt = $pdo->prepare(
        'UPDATE form_files
         SET group_id = :group_id,
             title = :title,
             url = :url,
             sort_order = :sort_order,
             is_published = :is_published
         WHERE id = :id'
    );
    $stmt->execute($data);

    $stmt = $pdo->prepare('SELECT * FROM form_files WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => resource_form_file_row($stmt->fetch() ?: [])]);
}

function form_files_delete(): never
{
    api_require_manager();
    $pdo = api_pdo();
    resource_forms_ensure($pdo);
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Form file id is required.'], 422);
    }

    $stmt = $pdo->prepare('DELETE FROM form_files WHERE id = :id');
    $stmt->execute(['id' => $id]);
    if ($stmt->rowCount() < 1) {
        api_json(['ok' => false, 'error' => 'Form file not found.'], 404);
    }

    api_json(['ok' => true]);
}
