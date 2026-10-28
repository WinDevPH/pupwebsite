<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/hero-slides.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => hero_slides_get(),
        'POST' => hero_slides_create(),
        'PUT', 'PATCH' => hero_slides_update(),
        'DELETE' => hero_slides_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json([
        'ok' => false,
        'error' => 'Database unavailable. Run scripts/run-023-hero-slides.php and start MySQL.',
        'detail' => $error->getMessage(),
    ], 503);
}

function hero_slides_get(): never
{
    $pdo = api_pdo();
    hero_slides_ensure($pdo);
    $id = (int) ($_GET['id'] ?? 0);
    $includeAll = (string) ($_GET['all'] ?? '') === '1';

    if ($id > 0) {
        $stmt = $pdo->prepare('SELECT * FROM hero_slides WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Hero slide not found.'], 404);
        }
        if ((int) $row['is_published'] !== 1) {
            api_require_manager();
        }
        api_json(['ok' => true, 'item' => hero_slide_row($row)]);
    }

    if ($includeAll) {
        api_require_manager();
        $stmt = $pdo->query('SELECT * FROM hero_slides ORDER BY sort_order ASC, id ASC');
    } else {
        $stmt = $pdo->query(
            'SELECT * FROM hero_slides WHERE is_published = 1 ORDER BY sort_order ASC, id ASC'
        );
    }

    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $items[] = hero_slide_row($row);
    }

    api_json(['ok' => true, 'items' => $items]);
}

function hero_slides_create(): never
{
    api_require_manager();
    $pdo = api_pdo();
    hero_slides_ensure($pdo);
    $data = hero_slide_payload(api_read_json());

    $stmt = $pdo->prepare(
        'INSERT INTO hero_slides (image_url, alt_text, sort_order, is_published)
         VALUES (:image_url, :alt_text, :sort_order, :is_published)'
    );
    $stmt->execute($data);
    $id = (int) $pdo->lastInsertId();

    $fetch = $pdo->prepare('SELECT * FROM hero_slides WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => hero_slide_row($fetch->fetch())], 201);
}

function hero_slides_update(): never
{
    api_require_manager();
    $pdo = api_pdo();
    hero_slides_ensure($pdo);
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Hero slide id is required.'], 422);
    }

    $existing = $pdo->prepare('SELECT id FROM hero_slides WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    if (!$existing->fetch()) {
        api_json(['ok' => false, 'error' => 'Hero slide not found.'], 404);
    }

    $data = hero_slide_payload($body);
    $stmt = $pdo->prepare(
        'UPDATE hero_slides
            SET image_url = :image_url,
                alt_text = :alt_text,
                sort_order = :sort_order,
                is_published = :is_published
          WHERE id = :id'
    );
    $stmt->execute([...$data, 'id' => $id]);

    $fetch = $pdo->prepare('SELECT * FROM hero_slides WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => hero_slide_row($fetch->fetch())]);
}

function hero_slides_delete(): never
{
    api_require_manager();
    $pdo = api_pdo();
    hero_slides_ensure($pdo);
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Hero slide id is required.'], 422);
    }

    $stmt = $pdo->prepare('DELETE FROM hero_slides WHERE id = :id');
    $stmt->execute(['id' => $id]);
    if ($stmt->rowCount() === 0) {
        api_json(['ok' => false, 'error' => 'Hero slide not found.'], 404);
    }

    api_json(['ok' => true]);
}
