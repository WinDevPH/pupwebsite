<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/transparency-categories.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => transparency_categories_get(),
        'POST' => transparency_categories_create(),
        'PUT', 'PATCH' => transparency_categories_update(),
        'DELETE' => transparency_categories_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json_db_error($error);
}

function transparency_categories_payload(?array $body = null): array
{
    $body ??= api_read_json();
    $label = trim((string) ($body['label'] ?? ''));
    $title = trim((string) ($body['title'] ?? ''));
    $accent = trim((string) ($body['accent'] ?? ''));
    $kicker = trim((string) ($body['kicker'] ?? ''));
    $note = trim((string) ($body['note'] ?? ''));
    $folder = trim((string) ($body['folder'] ?? ''));
    $tabs = transparency_tabs_normalize($body['tabs'] ?? []);
    $series = trim((string) ($body['seriesLabel'] ?? $body['series_label'] ?? ''));
    $icon = trim((string) ($body['icon'] ?? 'file-text'));
    $slug = trim((string) ($body['slug'] ?? ''));
    $sortOrder = (int) ($body['sortOrder'] ?? $body['sort_order'] ?? 0);
    $published = array_key_exists('published', $body)
        ? (bool) $body['published']
        : (array_key_exists('isPublished', $body) ? (bool) $body['isPublished'] : true);

    if ($label === '') {
        api_json(['ok' => false, 'error' => 'Tab label is required.'], 422);
    }
    if ($title === '') {
        $title = $label;
    }
    if ($slug === '') {
        $slug = api_slugify($label);
    } else {
        $slug = api_slugify($slug);
    }
    $slug = substr($slug, 0, 64);
    if ($slug === '' || $slug === 'item') {
        api_json(['ok' => false, 'error' => 'A valid slug is required.'], 422);
    }
    if (mb_strlen($label) > 160) {
        api_json(['ok' => false, 'error' => 'Label is too long.'], 422);
    }
    if (mb_strlen($title) > 160) {
        api_json(['ok' => false, 'error' => 'Title is too long.'], 422);
    }
    if (mb_strlen($note) > 800) {
        api_json(['ok' => false, 'error' => 'Note is too long.'], 422);
    }
    if ($icon === '') {
        $icon = 'file-text';
    }

    return [
        'slug' => $slug,
        'label' => $label,
        'title' => $title,
        'accent' => mb_substr($accent, 0, 160),
        'kicker' => mb_substr($kicker, 0, 80),
        'note' => $note,
        'tabs_json' => json_encode($tabs, JSON_UNESCAPED_UNICODE),
        'folder' => mb_substr($folder, 0, 160),
        'series_label' => mb_substr($series, 0, 120),
        'icon' => mb_substr($icon, 0, 64),
        'sort_order' => $sortOrder,
        'is_published' => $published ? 1 : 0,
    ];
}

function transparency_categories_get(): never
{
    $pdo = api_pdo();
    transparency_categories_ensure($pdo);

    $id = (int) ($_GET['id'] ?? 0);
    $slug = trim((string) ($_GET['slug'] ?? ''));
    $includeAll = (string) ($_GET['all'] ?? '') === '1';

    if ($id > 0 || $slug !== '') {
        if ($id > 0) {
            $stmt = $pdo->prepare('SELECT * FROM transparency_categories WHERE id = :id LIMIT 1');
            $stmt->execute(['id' => $id]);
        } else {
            $stmt = $pdo->prepare('SELECT * FROM transparency_categories WHERE slug = :slug LIMIT 1');
            $stmt->execute(['slug' => api_slugify($slug)]);
        }
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Transparency tab not found.'], 404);
        }
        if ((int) $row['is_published'] !== 1) {
            api_require_manager();
        }
        api_json(['ok' => true, 'item' => transparency_categories_row($row)]);
    }

    if ($includeAll) {
        api_require_manager();
        $stmt = $pdo->query('SELECT * FROM transparency_categories ORDER BY sort_order ASC, id ASC');
    } else {
        $stmt = $pdo->query(
            'SELECT * FROM transparency_categories
             WHERE is_published = 1
             ORDER BY sort_order ASC, id ASC'
        );
    }

    $items = [];
    if ($stmt) {
        foreach ($stmt->fetchAll() as $row) {
            $items[] = transparency_categories_row($row);
        }
    }

    api_json(['ok' => true, 'items' => $items]);
}

function transparency_categories_create(): never
{
    api_require_manager();
    $pdo = api_pdo();
    transparency_categories_ensure($pdo);
    $data = transparency_categories_payload();

    if (transparency_categories_slug_exists($pdo, $data['slug'])) {
        api_json(['ok' => false, 'error' => 'A tab with this slug already exists.'], 409);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO transparency_categories
          (slug, label, title, accent, kicker, note, tabs_json, folder, series_label, icon, sort_order, is_published)
         VALUES
          (:slug, :label, :title, :accent, :kicker, :note, :tabs_json, :folder, :series_label, :icon, :sort_order, :is_published)'
    );
    $stmt->execute($data);

    $id = (int) $pdo->lastInsertId();
    $fetch = $pdo->prepare('SELECT * FROM transparency_categories WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => transparency_categories_row($fetch->fetch() ?: [])], 201);
}

function transparency_categories_update(): never
{
    api_require_manager();
    $pdo = api_pdo();
    transparency_categories_ensure($pdo);
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Tab id is required.'], 422);
    }

    $existing = $pdo->prepare('SELECT * FROM transparency_categories WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    $current = $existing->fetch();
    if (!$current) {
        api_json(['ok' => false, 'error' => 'Transparency tab not found.'], 404);
    }

    $data = transparency_categories_payload($body);
    if (transparency_categories_slug_exists($pdo, $data['slug'], $id)) {
        api_json(['ok' => false, 'error' => 'A tab with this slug already exists.'], 409);
    }

    $data['id'] = $id;
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'UPDATE transparency_categories
             SET slug = :slug,
                 label = :label,
                 title = :title,
                 accent = :accent,
                 kicker = :kicker,
                 note = :note,
                 tabs_json = :tabs_json,
                 series_label = :series_label,
                 icon = :icon,
                 sort_order = :sort_order,
                 is_published = :is_published
             WHERE id = :id'
        );
        $stmt->execute($data);

        $oldSlug = (string) $current['slug'];
        if ($oldSlug !== '' && $oldSlug !== $data['slug']) {
            $remap = $pdo->prepare('UPDATE documents SET category = :next WHERE category = :prev');
            $remap->execute(['next' => $data['slug'], 'prev' => $oldSlug]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }

    $fetch = $pdo->prepare('SELECT * FROM transparency_categories WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => transparency_categories_row($fetch->fetch() ?: [])]);
}

function transparency_categories_delete(): never
{
    api_require_manager();
    $pdo = api_pdo();
    transparency_categories_ensure($pdo);
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Tab id is required.'], 422);
    }

    $existing = $pdo->prepare('SELECT * FROM transparency_categories WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    $row = $existing->fetch();
    if (!$row) {
        api_json(['ok' => false, 'error' => 'Transparency tab not found.'], 404);
    }

    $used = transparency_categories_document_count($pdo, (string) $row['slug']);
    if ($used > 0) {
        api_json([
            'ok' => false,
            'error' => 'Move or delete the documents in this tab before removing it.',
        ], 409);
    }

    $stmt = $pdo->prepare('DELETE FROM transparency_categories WHERE id = :id');
    $stmt->execute(['id' => $id]);
    api_json(['ok' => true]);
}
