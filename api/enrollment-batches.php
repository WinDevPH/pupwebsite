<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/enrollment.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => enrollment_batches_get(),
        'POST' => enrollment_batches_create(),
        'PUT', 'PATCH' => enrollment_batches_update(),
        'DELETE' => enrollment_batches_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json_db_error($error);
}

function enrollment_batches_ensure(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS enrollment_ops (
          id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
          walk_in VARCHAR(16) NOT NULL DEFAULT 'OPEN',
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS enrollment_appointment_batches (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          label VARCHAR(160) NOT NULL,
          window_label VARCHAR(160) NOT NULL,
          scheduled_count INT NOT NULL DEFAULT 0,
          status VARCHAR(32) NOT NULL DEFAULT 'Up next',
          sort_order INT NOT NULL DEFAULT 0,
          is_published TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_enroll_appt_pub (is_published, sort_order, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $ops = $pdo->query('SELECT id FROM enrollment_ops WHERE id = 1 LIMIT 1')->fetch();
    if (!$ops) {
        $pdo->exec("INSERT INTO enrollment_ops (id, walk_in) VALUES (1, 'OPEN')");
    }

    $ready = true;
}

function enrollment_batch_row(array $row, ?PDO $pdo = null): array
{
    $id = (int) $row['id'];
    $scheduled = $pdo instanceof PDO
        ? enrollment_batch_scheduled_count($pdo, $id)
        : (int) $row['scheduled_count'];
    return [
        'id' => $id,
        'label' => (string) $row['label'],
        'windowLabel' => (string) $row['window_label'],
        'scheduledCount' => $scheduled,
        'status' => (string) $row['status'],
        'sortOrder' => (int) ($row['sort_order'] ?? 0),
        'published' => (int) ($row['is_published'] ?? 0) === 1,
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}

function enrollment_batches_get(): never
{
    $pdo = api_pdo();
    enrollment_batches_ensure($pdo);
    $includeAll = (string) ($_GET['all'] ?? '') === '1';
    $id = (int) ($_GET['id'] ?? 0);
    $resource = strtolower(trim((string) ($_GET['resource'] ?? 'batches')));

    if ($resource === 'ops') {
        $ops = $pdo->query('SELECT * FROM enrollment_ops WHERE id = 1 LIMIT 1')->fetch();
        api_json([
            'ok' => true,
            'ops' => [
                'walkIn' => (string) ($ops['walk_in'] ?? 'OPEN'),
                'updatedAt' => isset($ops['updated_at']) ? api_iso((string) $ops['updated_at']) : null,
            ],
        ]);
    }

    if ($id > 0) {
        $stmt = $pdo->prepare('SELECT * FROM enrollment_appointment_batches WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Batch not found.'], 404);
        }
        if ((int) $row['is_published'] !== 1 || $resource === 'roster') {
            api_require_manager();
        }
        $item = enrollment_batch_row($row, $pdo);
        if ($resource === 'roster') {
            api_json([
                'ok' => true,
                'item' => $item,
                'students' => enrollment_batch_roster_students($pdo, $id),
                'assignable' => enrollment_batch_assignable_students($pdo, $id),
                'slots' => enrollment_batch_slots($pdo, $id),
                'autoNote' => 'Students who book a Routing slot linked to this batch are assigned automatically. Approved (and pending) bookings appear in the roster.',
            ]);
        }
        api_json(['ok' => true, 'item' => $item]);
    }

    if ($includeAll) {
        api_require_manager();
        $stmt = $pdo->query('SELECT * FROM enrollment_appointment_batches ORDER BY sort_order ASC, id ASC');
    } else {
        $stmt = $pdo->query(
            'SELECT * FROM enrollment_appointment_batches WHERE is_published = 1 ORDER BY sort_order ASC, id ASC'
        );
    }
    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $items[] = enrollment_batch_row($row, $pdo);
    }
    $ops = $pdo->query('SELECT walk_in FROM enrollment_ops WHERE id = 1 LIMIT 1')->fetch();
    api_json([
        'ok' => true,
        'walkIn' => (string) ($ops['walk_in'] ?? 'OPEN'),
        'items' => $items,
    ]);
}

function enrollment_batches_create(): never
{
    api_require_manager();
    $pdo = api_pdo();
    enrollment_batches_ensure($pdo);
    $body = api_read_json();

    if (strtolower(trim((string) ($body['resource'] ?? ''))) === 'ops') {
        $walkIn = strtoupper(trim((string) ($body['walkIn'] ?? $body['walk_in'] ?? 'OPEN')));
        if (!in_array($walkIn, ['OPEN', 'CLOSED'], true)) {
            api_json(['ok' => false, 'error' => 'walkIn must be OPEN or CLOSED.'], 422);
        }
        $stmt = $pdo->prepare('UPDATE enrollment_ops SET walk_in = :walk_in WHERE id = 1');
        $stmt->execute(['walk_in' => $walkIn]);
        api_json(['ok' => true, 'ops' => ['walkIn' => $walkIn]]);
    }

    $label = trim((string) ($body['label'] ?? ''));
    $window = trim((string) ($body['windowLabel'] ?? $body['window_label'] ?? ''));
    $status = trim((string) ($body['status'] ?? 'Up next'));
    if ($label === '' || $window === '') {
        api_json(['ok' => false, 'error' => 'Label and window are required.'], 422);
    }
    if (!in_array($status, ['Serving', 'Up next', 'Closed'], true)) {
        $status = 'Up next';
    }
    $stmt = $pdo->prepare(
        'INSERT INTO enrollment_appointment_batches
         (label, window_label, scheduled_count, status, sort_order, is_published)
         VALUES (:label, :window_label, :scheduled_count, :status, :sort_order, :is_published)'
    );
    $stmt->execute([
        'label' => $label,
        'window_label' => $window,
        'scheduled_count' => 0,
        'status' => $status,
        'sort_order' => enrollment_sort_order($body),
        'is_published' => enrollment_bool_published($body),
    ]);
    $id = (int) $pdo->lastInsertId();
    enrollment_refresh_batch_scheduled_count($pdo, $id);
    $fetch = $pdo->prepare('SELECT * FROM enrollment_appointment_batches WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => enrollment_batch_row($fetch->fetch() ?: [], $pdo)], 201);
}

function enrollment_batches_update(): never
{
    api_require_manager();
    $pdo = api_pdo();
    enrollment_batches_ensure($pdo);
    $body = api_read_json();
    $resource = strtolower(trim((string) ($body['resource'] ?? '')));

    if ($resource === 'ops') {
        $walkIn = strtoupper(trim((string) ($body['walkIn'] ?? $body['walk_in'] ?? 'OPEN')));
        if (!in_array($walkIn, ['OPEN', 'CLOSED'], true)) {
            api_json(['ok' => false, 'error' => 'walkIn must be OPEN or CLOSED.'], 422);
        }
        $stmt = $pdo->prepare('UPDATE enrollment_ops SET walk_in = :walk_in WHERE id = 1');
        $stmt->execute(['walk_in' => $walkIn]);
        api_json(['ok' => true, 'ops' => ['walkIn' => $walkIn]]);
    }

    if ($resource === 'assign') {
        $batchId = (int) ($body['batchId'] ?? $body['id'] ?? 0);
        $appointmentId = (int) ($body['appointmentId'] ?? 0);
        $slotId = isset($body['slotId']) ? (int) $body['slotId'] : null;
        $result = enrollment_batch_assign_appointment(
            $pdo,
            $batchId,
            $appointmentId,
            $slotId !== null && $slotId > 0 ? $slotId : null
        );
        if (!$result['ok']) {
            api_json(['ok' => false, 'error' => $result['error']], (int) ($result['status'] ?? 422));
        }
        $fetch = $pdo->prepare('SELECT * FROM enrollment_appointment_batches WHERE id = :id LIMIT 1');
        $fetch->execute(['id' => $batchId]);
        $row = $fetch->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Batch not found.'], 404);
        }
        api_json([
            'ok' => true,
            'item' => enrollment_batch_row($row, $pdo),
            'student' => $result['student'],
            'students' => enrollment_batch_roster_students($pdo, $batchId),
            'assignable' => enrollment_batch_assignable_students($pdo, $batchId),
            'slots' => enrollment_batch_slots($pdo, $batchId),
        ]);
    }

    if ($resource === 'assign-all') {
        $batchId = (int) ($body['batchId'] ?? $body['id'] ?? 0);
        if ($batchId <= 0) {
            api_json(['ok' => false, 'error' => 'Batch id is required.'], 422);
        }
        $assignable = enrollment_batch_assignable_students($pdo, $batchId);
        $assigned = 0;
        $failed = 0;
        foreach ($assignable as $student) {
            if (($student['status'] ?? '') !== 'approved') {
                continue;
            }
            $result = enrollment_batch_assign_appointment($pdo, $batchId, (int) $student['id'], null);
            if ($result['ok']) {
                $assigned += 1;
            } else {
                $failed += 1;
            }
        }
        $fetch = $pdo->prepare('SELECT * FROM enrollment_appointment_batches WHERE id = :id LIMIT 1');
        $fetch->execute(['id' => $batchId]);
        $row = $fetch->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Batch not found.'], 404);
        }
        api_json([
            'ok' => true,
            'item' => enrollment_batch_row($row, $pdo),
            'assigned' => $assigned,
            'failed' => $failed,
            'students' => enrollment_batch_roster_students($pdo, $batchId),
            'assignable' => enrollment_batch_assignable_students($pdo, $batchId),
            'slots' => enrollment_batch_slots($pdo, $batchId),
        ]);
    }

    $id = enrollment_require_id($body);
    $existing = $pdo->prepare('SELECT id FROM enrollment_appointment_batches WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    if (!$existing->fetch()) {
        api_json(['ok' => false, 'error' => 'Batch not found.'], 404);
    }

    $label = trim((string) ($body['label'] ?? ''));
    $window = trim((string) ($body['windowLabel'] ?? $body['window_label'] ?? ''));
    $status = trim((string) ($body['status'] ?? 'Up next'));
    if ($label === '' || $window === '') {
        api_json(['ok' => false, 'error' => 'Label and window are required.'], 422);
    }
    if (!in_array($status, ['Serving', 'Up next', 'Closed'], true)) {
        $status = 'Up next';
    }
    $stmt = $pdo->prepare(
        'UPDATE enrollment_appointment_batches
         SET label = :label, window_label = :window_label,
             status = :status, sort_order = :sort_order, is_published = :is_published
         WHERE id = :id'
    );
    $stmt->execute([
        'id' => $id,
        'label' => $label,
        'window_label' => $window,
        'status' => $status,
        'sort_order' => enrollment_sort_order($body),
        'is_published' => enrollment_bool_published($body),
    ]);
    enrollment_refresh_batch_scheduled_count($pdo, $id);
    $fetch = $pdo->prepare('SELECT * FROM enrollment_appointment_batches WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => enrollment_batch_row($fetch->fetch() ?: [], $pdo)]);
}

function enrollment_batches_delete(): never
{
    api_require_manager();
    $pdo = api_pdo();
    enrollment_batches_ensure($pdo);
    $body = api_read_json();
    $id = enrollment_require_id($body);
    $stmt = $pdo->prepare('DELETE FROM enrollment_appointment_batches WHERE id = :id');
    $stmt->execute(['id' => $id]);
    if ($stmt->rowCount() < 1) {
        api_json(['ok' => false, 'error' => 'Batch not found.'], 404);
    }
    api_json(['ok' => true]);
}
