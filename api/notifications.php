<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method !== 'GET') {
    api_json(['ok' => false, 'error' => 'Method not allowed.'], 405);
}

try {
    notifications_get();
} catch (Throwable $error) {
    api_json([
        'ok' => false,
        'error' => 'Could not load notifications.',
        'detail' => $error->getMessage(),
    ], 503);
}

function notifications_get(): never
{
    api_require_manager();
    $pdo = api_pdo();
    $items = [];

    try {
        $stmt = $pdo->query(
            "SELECT id, tracking_id, sender_name, subject, status, created_at
             FROM portal_requests
             WHERE status IN ('Submitted', 'Received', 'In review')
             ORDER BY created_at DESC, id DESC
             LIMIT 30"
        );
        if ($stmt) {
            foreach ($stmt->fetchAll() as $row) {
                $dbId = (int) $row['id'];
                $status = (string) $row['status'];
                $name = trim((string) $row['sender_name']);
                $subject = trim((string) $row['subject']);
                $items[] = [
                    'id' => 'request:' . $dbId,
                    'kind' => 'request',
                    'title' => $subject !== '' ? $subject : 'Portal request',
                    'body' => ($name !== '' ? $name : 'Student') . ' · ' . $status,
                    'href' => '/admin/requests/' . $dbId,
                    'status' => $status,
                    'createdAt' => api_iso((string) $row['created_at']) ?? date('c'),
                ];
            }
        }
    } catch (Throwable) {
        // Table may not exist yet on fresh installs.
    }

    try {
        $stmt = $pdo->query(
            "SELECT id, code, shop, item_name, customer_name, status, submitted_at
             FROM shop_reservations
             WHERE status IN ('pending', 'submitted', 'confirmed')
             ORDER BY submitted_at DESC, id DESC
             LIMIT 30"
        );
        if ($stmt) {
            foreach ($stmt->fetchAll() as $row) {
                $id = (int) $row['id'];
                $shop = (string) $row['shop'];
                $code = (string) $row['code'];
                $itemName = trim((string) $row['item_name']);
                $customer = trim((string) $row['customer_name']);
                $status = (string) $row['status'];
                $shopLabel = $shop === 'locker' ? 'Locker' : 'Merch';
                $items[] = [
                    'id' => 'reservation:' . $id,
                    'kind' => 'reservation',
                    'title' => $itemName !== '' ? $itemName : ($shopLabel . ' reservation'),
                    'body' => trim(
                        ($code !== '' ? $code . ' · ' : '') .
                        ($customer !== '' ? $customer . ' · ' : '') .
                        $shopLabel . ' · ' . ucfirst($status)
                    ),
                    'href' => '/admin/reservations/' . $id . '/edit',
                    'status' => $status,
                    'createdAt' => api_iso((string) $row['submitted_at']) ?? date('c'),
                ];
            }
        }
    } catch (Throwable) {
        // Table may not exist yet.
    }

    usort($items, static function (array $a, array $b): int {
        return strcmp((string) $b['createdAt'], (string) $a['createdAt']);
    });

    $items = array_slice($items, 0, 40);

    api_json([
        'ok' => true,
        'items' => $items,
        'counts' => [
            'request' => count(array_filter($items, static fn ($i) => $i['kind'] === 'request')),
            'reservation' => count(array_filter($items, static fn ($i) => $i['kind'] === 'reservation')),
            'total' => count($items),
        ],
    ]);
}
