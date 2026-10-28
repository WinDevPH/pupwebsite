<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => shop_get(),
        'POST' => shop_create(),
        'PUT', 'PATCH' => shop_update(),
        'DELETE' => shop_delete(),
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
function shop_ids(): array
{
    return ['locker', 'merch'];
}

function shop_ensure_tables(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS shop_items (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          shop VARCHAR(32) NOT NULL,
          item_key VARCHAR(64) NOT NULL,
          name VARCHAR(255) NOT NULL,
          price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
          unit VARCHAR(64) NOT NULL DEFAULT '',
          stock INT NOT NULL DEFAULT 0,
          image_url VARCHAR(500) NOT NULL DEFAULT '',
          alt_text VARCHAR(500) NOT NULL DEFAULT '',
          number_label VARCHAR(32) NULL,
          availability VARCHAR(32) NULL,
          sort_order INT NOT NULL DEFAULT 0,
          is_published TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_shop_items_shop_key (shop, item_key),
          KEY idx_shop_items_published (shop, is_published, sort_order, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $hasSize = $pdo->query("SHOW COLUMNS FROM shop_items LIKE 'size'")->fetch();
    if ($hasSize) {
        $pdo->exec('ALTER TABLE shop_items DROP COLUMN size');
    }
    $ready = true;
}

function shop_row(array $row): array
{
    $number = $row['number_label'] !== null && $row['number_label'] !== ''
        ? (string) $row['number_label']
        : null;
    $availability = $row['availability'] !== null && $row['availability'] !== ''
        ? (string) $row['availability']
        : null;

    return [
        'id' => (int) $row['id'],
        'shop' => (string) $row['shop'],
        'itemKey' => (string) $row['item_key'],
        'key' => (string) $row['item_key'],
        'name' => (string) $row['name'],
        'price' => (float) $row['price'],
        'unit' => (string) ($row['unit'] ?? ''),
        'stock' => (int) ($row['stock'] ?? 0),
        'image' => (string) ($row['image_url'] ?? ''),
        'imageUrl' => (string) ($row['image_url'] ?? ''),
        'alt' => (string) ($row['alt_text'] ?? ''),
        'altText' => (string) ($row['alt_text'] ?? ''),
        'number' => $number,
        'numberLabel' => $number,
        'availability' => $availability,
        'sortOrder' => (int) ($row['sort_order'] ?? 0),
        'published' => (int) ($row['is_published'] ?? 0) === 1,
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}

function shop_payload(?array $body = null): array
{
    $body ??= api_read_json();
    $shop = strtolower(trim((string) ($body['shop'] ?? '')));
    $itemKey = trim((string) ($body['itemKey'] ?? $body['key'] ?? $body['item_key'] ?? ''));
    $name = trim((string) ($body['name'] ?? ''));
    $price = $body['price'] ?? null;
    $unit = trim((string) ($body['unit'] ?? ''));
    $stock = $shop === 'locker' ? 1 : (int) ($body['stock'] ?? 0);
    $image = trim((string) ($body['image'] ?? $body['imageUrl'] ?? $body['image_url'] ?? ''));
    $alt = trim((string) ($body['alt'] ?? $body['altText'] ?? $body['alt_text'] ?? ''));
    $numberRaw = $body['number'] ?? $body['numberLabel'] ?? $body['number_label'] ?? null;
    $number = $numberRaw === null || $numberRaw === '' ? null : trim((string) $numberRaw);
    $availabilityRaw = $body['availability'] ?? null;
    $availability = $availabilityRaw === null || $availabilityRaw === ''
        ? null
        : strtolower(trim((string) $availabilityRaw));
    $sortOrder = (int) ($body['sortOrder'] ?? $body['sort_order'] ?? 0);
    $published = array_key_exists('published', $body)
        ? (bool) $body['published']
        : (array_key_exists('isPublished', $body) ? (bool) $body['isPublished'] : true);

    if (!in_array($shop, shop_ids(), true)) {
        api_json(['ok' => false, 'error' => 'Shop must be locker or merch.'], 422);
    }
    if ($name === '') {
        api_json(['ok' => false, 'error' => 'Name is required.'], 422);
    }
    if ($itemKey === '') {
        $itemKey = api_slugify($name);
    } else {
        $itemKey = api_slugify($itemKey);
    }
    if (!is_numeric($price) || (float) $price < 0) {
        api_json(['ok' => false, 'error' => 'Enter a valid price.'], 422);
    }
    if ($image === '' || !preg_match('#^(/|https?://)#i', $image)) {
        api_json(['ok' => false, 'error' => 'Image path or URL is required.'], 422);
    }
    if ($availability !== null && !in_array($availability, ['reserved', 'out'], true)) {
        api_json(['ok' => false, 'error' => 'Availability must be reserved or out.'], 422);
    }
    if ($alt === '') {
        $alt = $name;
    }

    return [
        'shop' => $shop,
        'item_key' => mb_substr($itemKey, 0, 64),
        'name' => mb_substr($name, 0, 255),
        'price' => round((float) $price, 2),
        'unit' => mb_substr($unit, 0, 64),
        'stock' => max(0, $stock),
        'image_url' => mb_substr($image, 0, 500),
        'alt_text' => mb_substr($alt, 0, 500),
        'number_label' => $number !== null ? mb_substr($number, 0, 32) : null,
        'availability' => $availability,
        'sort_order' => $sortOrder,
        'is_published' => $published ? 1 : 0,
    ];
}

function shop_get(): never
{
    $pdo = api_pdo();
    shop_ensure_tables($pdo);

    $id = (int) ($_GET['id'] ?? 0);
    $shop = strtolower(trim((string) ($_GET['shop'] ?? '')));
    $itemKey = trim((string) ($_GET['itemKey'] ?? $_GET['key'] ?? ''));
    $includeAll = (string) ($_GET['all'] ?? '') === '1';

    if ($id > 0) {
        $stmt = $pdo->prepare('SELECT * FROM shop_items WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Shop item not found.'], 404);
        }
        if ((int) $row['is_published'] !== 1) {
            api_require_manager();
        }
        api_json(['ok' => true, 'item' => shop_row($row)]);
    }

    if ($shop !== '' && $itemKey !== '') {
        if (!in_array($shop, shop_ids(), true)) {
            api_json(['ok' => false, 'error' => 'Unknown shop.'], 422);
        }
        $stmt = $pdo->prepare(
            'SELECT * FROM shop_items WHERE shop = :shop AND item_key = :item_key LIMIT 1'
        );
        $stmt->execute(['shop' => $shop, 'item_key' => api_slugify($itemKey)]);
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Shop item not found.'], 404);
        }
        if ((int) $row['is_published'] !== 1) {
            api_require_manager();
        }
        api_json(['ok' => true, 'item' => shop_row($row)]);
    }

    if ($shop !== '' && !in_array($shop, shop_ids(), true)) {
        api_json(['ok' => false, 'error' => 'Unknown shop.'], 422);
    }

    if ($includeAll) {
        api_require_manager();
        if ($shop !== '') {
            $stmt = $pdo->prepare(
                'SELECT * FROM shop_items WHERE shop = :shop ORDER BY sort_order ASC, id ASC'
            );
            $stmt->execute(['shop' => $shop]);
        } else {
            $stmt = $pdo->query('SELECT * FROM shop_items ORDER BY shop ASC, sort_order ASC, id ASC');
        }
    } elseif ($shop !== '') {
        $stmt = $pdo->prepare(
            'SELECT * FROM shop_items
             WHERE is_published = 1 AND shop = :shop
             ORDER BY sort_order ASC, id ASC'
        );
        $stmt->execute(['shop' => $shop]);
    } else {
        $stmt = $pdo->query(
            'SELECT * FROM shop_items
             WHERE is_published = 1
             ORDER BY shop ASC, sort_order ASC, id ASC'
        );
    }

    $items = [];
    if ($stmt) {
        foreach ($stmt->fetchAll() as $row) {
            $items[] = shop_row($row);
        }
    }

    api_json([
        'ok' => true,
        'items' => $items,
        'shop' => $shop !== '' ? $shop : null,
        'shops' => shop_ids(),
    ]);
}

function shop_create(): never
{
    api_require_manager();
    $pdo = api_pdo();
    shop_ensure_tables($pdo);
    $data = shop_payload();

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO shop_items
              (shop, item_key, name, price, unit, stock, image_url, alt_text, number_label, availability, sort_order, is_published)
             VALUES
              (:shop, :item_key, :name, :price, :unit, :stock, :image_url, :alt_text, :number_label, :availability, :sort_order, :is_published)'
        );
        $stmt->execute($data);
    } catch (PDOException $error) {
        if ((int) $error->getCode() === 23000) {
            api_json(['ok' => false, 'error' => 'An item with this key already exists in that shop.'], 409);
        }
        throw $error;
    }

    $id = (int) $pdo->lastInsertId();
    $fetch = $pdo->prepare('SELECT * FROM shop_items WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => shop_row($fetch->fetch() ?: [])], 201);
}

function shop_update(): never
{
    api_require_manager();
    $pdo = api_pdo();
    shop_ensure_tables($pdo);
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Shop item id is required.'], 422);
    }

    $existing = $pdo->prepare('SELECT id FROM shop_items WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    if (!$existing->fetch()) {
        api_json(['ok' => false, 'error' => 'Shop item not found.'], 404);
    }

    $data = shop_payload($body);
    $data['id'] = $id;

    try {
        $stmt = $pdo->prepare(
            'UPDATE shop_items
             SET shop = :shop,
                 item_key = :item_key,
                 name = :name,
                 price = :price,
                 unit = :unit,
                 stock = :stock,
                 image_url = :image_url,
                 alt_text = :alt_text,
                 number_label = :number_label,
                 availability = :availability,
                 sort_order = :sort_order,
                 is_published = :is_published
             WHERE id = :id'
        );
        $stmt->execute($data);
    } catch (PDOException $error) {
        if ((int) $error->getCode() === 23000) {
            api_json(['ok' => false, 'error' => 'An item with this key already exists in that shop.'], 409);
        }
        throw $error;
    }

    $fetch = $pdo->prepare('SELECT * FROM shop_items WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => shop_row($fetch->fetch() ?: [])]);
}

function shop_delete(): never
{
    api_require_manager();
    $pdo = api_pdo();
    shop_ensure_tables($pdo);
    $body = api_read_json();
    $ids = $body['ids'] ?? null;
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);

    if (is_array($ids) && $ids !== []) {
        $deleted = 0;
        $stmt = $pdo->prepare('DELETE FROM shop_items WHERE id = :id');
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
        api_json(['ok' => false, 'error' => 'Shop item id is required.'], 422);
    }

    $stmt = $pdo->prepare('DELETE FROM shop_items WHERE id = :id');
    $stmt->execute(['id' => $id]);
    if ($stmt->rowCount() < 1) {
        api_json(['ok' => false, 'error' => 'Shop item not found.'], 404);
    }
    api_json(['ok' => true]);
}
