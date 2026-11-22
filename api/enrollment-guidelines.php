<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/enrollment.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => enrollment_guidelines_get(),
        'POST' => enrollment_guidelines_create(),
        'PUT', 'PATCH' => enrollment_guidelines_update(),
        'DELETE' => enrollment_guidelines_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json_db_error($error);
}

function enrollment_guidelines_ensure(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS enrollment_schedule_days (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          date_label VARCHAR(120) NOT NULL,
          group_label VARCHAR(255) NOT NULL,
          day_label VARCHAR(120) NOT NULL,
          muted TINYINT(1) NOT NULL DEFAULT 0,
          sort_order INT NOT NULL DEFAULT 0,
          is_published TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_enroll_sched_pub (is_published, sort_order, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS enrollment_batch_windows (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          label VARCHAR(120) NOT NULL,
          time_label VARCHAR(120) NOT NULL,
          detail VARCHAR(500) NOT NULL DEFAULT '',
          tone VARCHAR(32) NOT NULL DEFAULT 'active',
          sort_order INT NOT NULL DEFAULT 0,
          is_published TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_enroll_batch_win_pub (is_published, sort_order, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $ready = true;
}

function enrollment_guidelines_resource(): string
{
    $resource = strtolower(trim((string) ($_GET['resource'] ?? 'schedule')));
    return in_array($resource, ['schedule', 'windows'], true) ? $resource : 'schedule';
}

function enrollment_schedule_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'dateLabel' => (string) $row['date_label'],
        'groupLabel' => (string) $row['group_label'],
        'dayLabel' => (string) $row['day_label'],
        'muted' => (int) ($row['muted'] ?? 0) === 1,
        'sortOrder' => (int) ($row['sort_order'] ?? 0),
        'published' => (int) ($row['is_published'] ?? 0) === 1,
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}

function enrollment_window_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'label' => (string) $row['label'],
        'timeLabel' => (string) $row['time_label'],
        'detail' => (string) $row['detail'],
        'tone' => (string) $row['tone'],
        'sortOrder' => (int) ($row['sort_order'] ?? 0),
        'published' => (int) ($row['is_published'] ?? 0) === 1,
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}

function enrollment_guidelines_get(): never
{
    $pdo = api_pdo();
    enrollment_guidelines_ensure($pdo);
    $resource = enrollment_guidelines_resource();
    $includeAll = (string) ($_GET['all'] ?? '') === '1';
    $id = (int) ($_GET['id'] ?? 0);

    if ($resource === 'windows') {
        if ($id > 0) {
            $stmt = $pdo->prepare('SELECT * FROM enrollment_batch_windows WHERE id = :id LIMIT 1');
            $stmt->execute(['id' => $id]);
            $row = $stmt->fetch();
            if (!$row) {
                api_json(['ok' => false, 'error' => 'Batch window not found.'], 404);
            }
            if ((int) $row['is_published'] !== 1) {
                api_require_manager();
            }
            api_json(['ok' => true, 'item' => enrollment_window_row($row)]);
        }
        if ($includeAll) {
            api_require_manager();
            $stmt = $pdo->query('SELECT * FROM enrollment_batch_windows ORDER BY sort_order ASC, id ASC');
        } else {
            $stmt = $pdo->query(
                'SELECT * FROM enrollment_batch_windows WHERE is_published = 1 ORDER BY sort_order ASC, id ASC'
            );
        }
        $items = [];
        foreach ($stmt->fetchAll() as $row) {
            $items[] = enrollment_window_row($row);
        }
        api_json(['ok' => true, 'items' => $items]);
    }

    if ($id > 0) {
        $stmt = $pdo->prepare('SELECT * FROM enrollment_schedule_days WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Schedule day not found.'], 404);
        }
        if ((int) $row['is_published'] !== 1) {
            api_require_manager();
        }
        api_json(['ok' => true, 'item' => enrollment_schedule_row($row)]);
    }

    if ($includeAll) {
        api_require_manager();
        $stmt = $pdo->query('SELECT * FROM enrollment_schedule_days ORDER BY sort_order ASC, id ASC');
    } else {
        $stmt = $pdo->query(
            'SELECT * FROM enrollment_schedule_days WHERE is_published = 1 ORDER BY sort_order ASC, id ASC'
        );
    }
    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $items[] = enrollment_schedule_row($row);
    }
    api_json(['ok' => true, 'items' => $items]);
}

function enrollment_guidelines_create(): never
{
    api_require_manager();
    $pdo = api_pdo();
    enrollment_guidelines_ensure($pdo);
    $body = api_read_json();
    $resource = strtolower(trim((string) ($body['resource'] ?? $_GET['resource'] ?? 'schedule')));

    if ($resource === 'windows') {
        $label = trim((string) ($body['label'] ?? ''));
        $time = trim((string) ($body['timeLabel'] ?? $body['time_label'] ?? ''));
        $detail = trim((string) ($body['detail'] ?? ''));
        $tone = trim((string) ($body['tone'] ?? 'active'));
        if ($label === '' || $time === '') {
            api_json(['ok' => false, 'error' => 'Label and time are required.'], 422);
        }
        if (!in_array($tone, ['active', 'pause'], true)) {
            $tone = 'active';
        }
        $stmt = $pdo->prepare(
            'INSERT INTO enrollment_batch_windows (label, time_label, detail, tone, sort_order, is_published)
             VALUES (:label, :time_label, :detail, :tone, :sort_order, :is_published)'
        );
        $stmt->execute([
            'label' => $label,
            'time_label' => $time,
            'detail' => $detail,
            'tone' => $tone,
            'sort_order' => enrollment_sort_order($body),
            'is_published' => enrollment_bool_published($body),
        ]);
        $id = (int) $pdo->lastInsertId();
        $fetch = $pdo->prepare('SELECT * FROM enrollment_batch_windows WHERE id = :id LIMIT 1');
        $fetch->execute(['id' => $id]);
        api_json(['ok' => true, 'item' => enrollment_window_row($fetch->fetch() ?: [])], 201);
    }

    $date = trim((string) ($body['dateLabel'] ?? $body['date_label'] ?? ''));
    $group = trim((string) ($body['groupLabel'] ?? $body['group_label'] ?? ''));
    $day = trim((string) ($body['dayLabel'] ?? $body['day_label'] ?? ''));
    if ($date === '' || $group === '' || $day === '') {
        api_json(['ok' => false, 'error' => 'Date, group, and day labels are required.'], 422);
    }
    $muted = !empty($body['muted']) ? 1 : 0;
    $stmt = $pdo->prepare(
        'INSERT INTO enrollment_schedule_days (date_label, group_label, day_label, muted, sort_order, is_published)
         VALUES (:date_label, :group_label, :day_label, :muted, :sort_order, :is_published)'
    );
    $stmt->execute([
        'date_label' => $date,
        'group_label' => $group,
        'day_label' => $day,
        'muted' => $muted,
        'sort_order' => enrollment_sort_order($body),
        'is_published' => enrollment_bool_published($body),
    ]);
    $id = (int) $pdo->lastInsertId();
    $fetch = $pdo->prepare('SELECT * FROM enrollment_schedule_days WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => enrollment_schedule_row($fetch->fetch() ?: [])], 201);
}

function enrollment_guidelines_update(): never
{
    api_require_manager();
    $pdo = api_pdo();
    enrollment_guidelines_ensure($pdo);
    $body = api_read_json();
    $id = enrollment_require_id($body);
    $resource = strtolower(trim((string) ($body['resource'] ?? $_GET['resource'] ?? 'schedule')));

    if ($resource === 'windows') {
        $existing = $pdo->prepare('SELECT id FROM enrollment_batch_windows WHERE id = :id LIMIT 1');
        $existing->execute(['id' => $id]);
        if (!$existing->fetch()) {
            api_json(['ok' => false, 'error' => 'Batch window not found.'], 404);
        }
        $label = trim((string) ($body['label'] ?? ''));
        $time = trim((string) ($body['timeLabel'] ?? $body['time_label'] ?? ''));
        $detail = trim((string) ($body['detail'] ?? ''));
        $tone = trim((string) ($body['tone'] ?? 'active'));
        if ($label === '' || $time === '') {
            api_json(['ok' => false, 'error' => 'Label and time are required.'], 422);
        }
        if (!in_array($tone, ['active', 'pause'], true)) {
            $tone = 'active';
        }
        $stmt = $pdo->prepare(
            'UPDATE enrollment_batch_windows
             SET label = :label, time_label = :time_label, detail = :detail, tone = :tone,
                 sort_order = :sort_order, is_published = :is_published
             WHERE id = :id'
        );
        $stmt->execute([
            'id' => $id,
            'label' => $label,
            'time_label' => $time,
            'detail' => $detail,
            'tone' => $tone,
            'sort_order' => enrollment_sort_order($body),
            'is_published' => enrollment_bool_published($body),
        ]);
        $fetch = $pdo->prepare('SELECT * FROM enrollment_batch_windows WHERE id = :id LIMIT 1');
        $fetch->execute(['id' => $id]);
        api_json(['ok' => true, 'item' => enrollment_window_row($fetch->fetch() ?: [])]);
    }

    $existing = $pdo->prepare('SELECT id FROM enrollment_schedule_days WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    if (!$existing->fetch()) {
        api_json(['ok' => false, 'error' => 'Schedule day not found.'], 404);
    }
    $date = trim((string) ($body['dateLabel'] ?? $body['date_label'] ?? ''));
    $group = trim((string) ($body['groupLabel'] ?? $body['group_label'] ?? ''));
    $day = trim((string) ($body['dayLabel'] ?? $body['day_label'] ?? ''));
    if ($date === '' || $group === '' || $day === '') {
        api_json(['ok' => false, 'error' => 'Date, group, and day labels are required.'], 422);
    }
    $stmt = $pdo->prepare(
        'UPDATE enrollment_schedule_days
         SET date_label = :date_label, group_label = :group_label, day_label = :day_label,
             muted = :muted, sort_order = :sort_order, is_published = :is_published
         WHERE id = :id'
    );
    $stmt->execute([
        'id' => $id,
        'date_label' => $date,
        'group_label' => $group,
        'day_label' => $day,
        'muted' => !empty($body['muted']) ? 1 : 0,
        'sort_order' => enrollment_sort_order($body),
        'is_published' => enrollment_bool_published($body),
    ]);
    $fetch = $pdo->prepare('SELECT * FROM enrollment_schedule_days WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => enrollment_schedule_row($fetch->fetch() ?: [])]);
}

function enrollment_guidelines_delete(): never
{
    api_require_manager();
    $pdo = api_pdo();
    enrollment_guidelines_ensure($pdo);
    $body = api_read_json();
    $id = enrollment_require_id($body);
    $resource = strtolower(trim((string) ($body['resource'] ?? $_GET['resource'] ?? 'schedule')));
    $table = $resource === 'windows' ? 'enrollment_batch_windows' : 'enrollment_schedule_days';
    $stmt = $pdo->prepare("DELETE FROM {$table} WHERE id = :id");
    $stmt->execute(['id' => $id]);
    if ($stmt->rowCount() < 1) {
        api_json(['ok' => false, 'error' => 'Record not found.'], 404);
    }
    api_json(['ok' => true]);
}
