<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/enrollment.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => enrollment_schedules_get(),
        'POST' => enrollment_schedules_create(),
        'PUT', 'PATCH' => enrollment_schedules_update(),
        'DELETE' => enrollment_schedules_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json_db_error($error);
}

function enrollment_schedules_ensure(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS enrollment_schedules (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          tracking_code VARCHAR(32) NOT NULL,
          student_name VARCHAR(255) NOT NULL,
          student_number VARCHAR(64) NOT NULL,
          offerings_json LONGTEXT NOT NULL,
          total_units DECIMAL(6,1) NOT NULL DEFAULT 0,
          status VARCHAR(16) NOT NULL DEFAULT 'pending',
          admin_note TEXT NULL,
          reviewed_at DATETIME NULL,
          reviewed_by INT UNSIGNED NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_enroll_sched_tracking (tracking_code),
          KEY idx_enroll_sched_status (status, created_at),
          KEY idx_enroll_sched_student (student_number)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $ready = true;
}

function enrollment_schedules_make_tracking(): string
{
    $date = date('Ymd');
    $suffix = strtoupper(bin2hex(random_bytes(2)));
    return "CB-{$date}-{$suffix}";
}

function enrollment_schedules_normalize_status(string $status): string
{
    $status = strtolower(trim($status));
    return in_array($status, ['pending', 'approved', 'rejected'], true) ? $status : 'pending';
}

/**
 * @return list<array<string, mixed>>
 */
function enrollment_schedules_parse_offerings(mixed $raw): array
{
    if (is_string($raw)) {
        $decoded = json_decode($raw, true);
        $raw = is_array($decoded) ? $decoded : [];
    }
    if (!is_array($raw)) {
        return [];
    }

    $items = [];
    foreach ($raw as $row) {
        if (!is_array($row)) {
            continue;
        }
        $code = trim((string) ($row['code'] ?? ''));
        $title = trim((string) ($row['title'] ?? ''));
        $section = trim((string) ($row['section'] ?? ''));
        if ($code === '' || $title === '' || $section === '') {
            continue;
        }
        $days = $row['days'] ?? [];
        if (!is_array($days)) {
            $days = [];
        }
        $days = array_values(array_filter(array_map('strval', $days)));
        $items[] = [
            'id' => (string) ($row['id'] ?? ''),
            'code' => $code,
            'title' => $title,
            'section' => $section,
            'units' => (float) ($row['units'] ?? 0),
            'days' => $days,
            'startHour' => (float) ($row['startHour'] ?? $row['start_hour'] ?? 0),
            'endHour' => (float) ($row['endHour'] ?? $row['end_hour'] ?? 0),
            'timeLabel' => trim((string) ($row['timeLabel'] ?? $row['time_label'] ?? '')),
        ];
    }
    return $items;
}

function enrollment_schedule_row(array $row): array
{
    $offerings = enrollment_schedules_parse_offerings($row['offerings_json'] ?? '[]');
    return [
        'id' => (int) $row['id'],
        'trackingCode' => (string) $row['tracking_code'],
        'studentName' => (string) $row['student_name'],
        'studentNumber' => (string) $row['student_number'],
        'offerings' => $offerings,
        'totalUnits' => (float) $row['total_units'],
        'status' => enrollment_schedules_normalize_status((string) ($row['status'] ?? 'pending')),
        'adminNote' => isset($row['admin_note']) && $row['admin_note'] !== null && $row['admin_note'] !== ''
            ? (string) $row['admin_note']
            : null,
        'reviewedAt' => !empty($row['reviewed_at']) ? api_iso((string) $row['reviewed_at']) : null,
        'reviewedBy' => isset($row['reviewed_by']) && $row['reviewed_by'] !== null
            ? (int) $row['reviewed_by']
            : null,
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}

function enrollment_schedules_get(): never
{
    api_require_manager();
    $pdo = api_pdo();
    enrollment_schedules_ensure($pdo);

    $id = (int) ($_GET['id'] ?? 0);
    if ($id > 0) {
        $stmt = $pdo->prepare('SELECT * FROM enrollment_schedules WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Schedule submission not found.'], 404);
        }
        api_json(['ok' => true, 'item' => enrollment_schedule_row($row)]);
    }

    $status = strtolower(trim((string) ($_GET['status'] ?? '')));
    if ($status !== '' && in_array($status, ['pending', 'approved', 'rejected'], true)) {
        $stmt = $pdo->prepare(
            'SELECT * FROM enrollment_schedules WHERE status = :status ORDER BY created_at DESC, id DESC'
        );
        $stmt->execute(['status' => $status]);
    } else {
        $stmt = $pdo->query('SELECT * FROM enrollment_schedules ORDER BY created_at DESC, id DESC');
    }

    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $items[] = enrollment_schedule_row($row);
    }

    $counts = [
        'all' => (int) $pdo->query('SELECT COUNT(*) FROM enrollment_schedules')->fetchColumn(),
        'pending' => (int) $pdo->query("SELECT COUNT(*) FROM enrollment_schedules WHERE status = 'pending'")->fetchColumn(),
        'approved' => (int) $pdo->query("SELECT COUNT(*) FROM enrollment_schedules WHERE status = 'approved'")->fetchColumn(),
        'rejected' => (int) $pdo->query("SELECT COUNT(*) FROM enrollment_schedules WHERE status = 'rejected'")->fetchColumn(),
    ];

    api_json(['ok' => true, 'items' => $items, 'counts' => $counts]);
}

function enrollment_schedules_create(): never
{
    $pdo = api_pdo();
    enrollment_schedules_ensure($pdo);
    $body = api_read_json();

    $managerCreate = !empty($body['adminCreate']) || !empty($body['status']) || array_key_exists('adminNote', $body) || array_key_exists('admin_note', $body);
    if ($managerCreate) {
        api_require_manager();
    }

    $studentName = trim((string) ($body['studentName'] ?? $body['student_name'] ?? ''));
    $studentNumber = trim((string) ($body['studentNumber'] ?? $body['student_number'] ?? ''));
    $offerings = enrollment_schedules_parse_offerings($body['offerings'] ?? []);
    $status = $managerCreate
        ? enrollment_schedules_normalize_status((string) ($body['status'] ?? 'pending'))
        : 'pending';
    $adminNote = $managerCreate
        ? trim((string) ($body['adminNote'] ?? $body['admin_note'] ?? ''))
        : '';

    $errors = [];
    if (mb_strlen($studentName) < 3) {
        $errors['studentName'] = 'Enter the student name.';
    }
    if (mb_strlen($studentNumber) < 5) {
        $errors['studentNumber'] = 'Enter a valid student number.';
    }
    if ($offerings === []) {
        $errors['offerings'] = 'Select at least one class offering.';
    }
    if ($errors !== []) {
        api_json(['ok' => false, 'error' => (string) reset($errors), 'errors' => $errors], 422);
    }

    $pdo->beginTransaction();
    try {
        $offerings = enrollment_validate_schedule_offerings($pdo, $offerings, $status, null);
        $totalUnits = 0.0;
        foreach ($offerings as $item) {
            $totalUnits += (float) $item['units'];
        }

        $tracking = enrollment_schedules_make_tracking();
        $stmt = $pdo->prepare(
            'INSERT INTO enrollment_schedules
              (tracking_code, student_name, student_number, offerings_json, total_units, status, admin_note)
             VALUES
              (:tracking_code, :student_name, :student_number, :offerings_json, :total_units, :status, :admin_note)'
        );
        $stmt->execute([
            'tracking_code' => $tracking,
            'student_name' => $studentName,
            'student_number' => $studentNumber,
            'offerings_json' => json_encode($offerings, JSON_UNESCAPED_UNICODE),
            'total_units' => $totalUnits,
            'status' => $status,
            'admin_note' => $adminNote !== '' ? $adminNote : null,
        ]);

        $id = (int) $pdo->lastInsertId();
        if ($status === 'approved') {
            enrollment_recompute_offerings_for_ids($pdo, enrollment_offering_ids_from_snapshot($offerings));
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }

    $fetch = $pdo->prepare('SELECT * FROM enrollment_schedules WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    $row = $fetch->fetch() ?: [];

    api_json([
        'ok' => true,
        'item' => $managerCreate
            ? enrollment_schedule_row($row)
            : [
                'id' => $id,
                'trackingCode' => $tracking,
                'status' => 'pending',
                'totalUnits' => $totalUnits,
            ],
    ], 201);
}

function enrollment_schedules_update(): never
{
    $user = api_require_manager();
    $pdo = api_pdo();
    enrollment_schedules_ensure($pdo);
    $body = api_read_json();
    $id = enrollment_require_id($body);

    $existing = $pdo->prepare('SELECT * FROM enrollment_schedules WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    $row = $existing->fetch();
    if (!$row) {
        api_json(['ok' => false, 'error' => 'Schedule submission not found.'], 404);
    }

    $resource = strtolower(trim((string) ($body['resource'] ?? 'status')));
    $oldOfferings = enrollment_schedules_parse_offerings($row['offerings_json'] ?? []);
    $oldIds = enrollment_offering_ids_from_snapshot($oldOfferings);
    $oldStatus = enrollment_schedules_normalize_status((string) ($row['status'] ?? 'pending'));

    $pdo->beginTransaction();
    try {
        if ($resource === 'details') {
            $studentName = trim((string) ($body['studentName'] ?? $body['student_name'] ?? $row['student_name']));
            $studentNumber = trim((string) ($body['studentNumber'] ?? $body['student_number'] ?? $row['student_number']));
            $offerings = array_key_exists('offerings', $body)
                ? enrollment_schedules_parse_offerings($body['offerings'])
                : $oldOfferings;

            if (mb_strlen($studentName) < 3 || mb_strlen($studentNumber) < 5 || $offerings === []) {
                api_json(['ok' => false, 'error' => 'Name, student number, and offerings are required.'], 422);
            }

            $status = array_key_exists('status', $body)
                ? enrollment_schedules_normalize_status((string) $body['status'])
                : $oldStatus;
            $note = array_key_exists('adminNote', $body) || array_key_exists('admin_note', $body)
                ? trim((string) ($body['adminNote'] ?? $body['admin_note'] ?? ''))
                : (string) ($row['admin_note'] ?? '');
            $reviewedBy = (int) ($user['id'] ?? 0);

            $offerings = enrollment_validate_schedule_offerings($pdo, $offerings, $status, $id);
            $totalUnits = 0.0;
            foreach ($offerings as $item) {
                $totalUnits += (float) $item['units'];
            }

            $stmt = $pdo->prepare(
                'UPDATE enrollment_schedules
                 SET student_name = :student_name,
                     student_number = :student_number,
                     offerings_json = :offerings_json,
                     total_units = :total_units,
                     status = :status,
                     admin_note = :admin_note,
                     reviewed_at = CASE WHEN :status2 = \'pending\' THEN NULL ELSE COALESCE(reviewed_at, NOW()) END,
                     reviewed_by = CASE WHEN :status3 = \'pending\' THEN NULL ELSE COALESCE(reviewed_by, :reviewed_by) END
                 WHERE id = :id'
            );
            $stmt->execute([
                'id' => $id,
                'student_name' => $studentName,
                'student_number' => $studentNumber,
                'offerings_json' => json_encode($offerings, JSON_UNESCAPED_UNICODE),
                'total_units' => $totalUnits,
                'status' => $status,
                'status2' => $status,
                'status3' => $status,
                'admin_note' => $note !== '' ? $note : null,
                'reviewed_by' => $reviewedBy > 0 ? $reviewedBy : null,
            ]);
            $newIds = enrollment_offering_ids_from_snapshot($offerings);
            enrollment_recompute_offerings_for_ids($pdo, array_merge($oldIds, $newIds));
        } else {
            $status = enrollment_schedules_normalize_status((string) ($body['status'] ?? $row['status']));
            $note = trim((string) ($body['adminNote'] ?? $body['admin_note'] ?? ''));
            $reviewedBy = (int) ($user['id'] ?? 0);

            if ($status === 'approved') {
                enrollment_validate_schedule_offerings($pdo, $oldOfferings, $status, $id);
            }

            if ($status === 'pending') {
                $stmt = $pdo->prepare(
                    'UPDATE enrollment_schedules
                     SET status = :status,
                         admin_note = :admin_note,
                         reviewed_at = NULL,
                         reviewed_by = NULL
                     WHERE id = :id'
                );
                $stmt->execute([
                    'id' => $id,
                    'status' => $status,
                    'admin_note' => $note !== '' ? $note : null,
                ]);
            } else {
                $stmt = $pdo->prepare(
                    'UPDATE enrollment_schedules
                     SET status = :status,
                         admin_note = :admin_note,
                         reviewed_at = NOW(),
                         reviewed_by = :reviewed_by
                     WHERE id = :id'
                );
                $stmt->execute([
                    'id' => $id,
                    'status' => $status,
                    'admin_note' => $note !== '' ? $note : null,
                    'reviewed_by' => $reviewedBy > 0 ? $reviewedBy : null,
                ]);
            }
            enrollment_recompute_offerings_for_ids($pdo, $oldIds);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }

    $fetch = $pdo->prepare('SELECT * FROM enrollment_schedules WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => enrollment_schedule_row($fetch->fetch() ?: [])]);
}

function enrollment_schedules_delete(): never
{
    api_require_manager();
    $pdo = api_pdo();
    enrollment_schedules_ensure($pdo);
    $body = api_read_json();
    $id = enrollment_require_id($body);

    $existing = $pdo->prepare('SELECT * FROM enrollment_schedules WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    $row = $existing->fetch();
    if (!$row) {
        api_json(['ok' => false, 'error' => 'Schedule submission not found.'], 404);
    }
    $offeringIds = enrollment_offering_ids_from_snapshot(
        enrollment_schedules_parse_offerings($row['offerings_json'] ?? [])
    );

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('DELETE FROM enrollment_schedules WHERE id = :id');
        $stmt->execute(['id' => $id]);
        enrollment_recompute_offerings_for_ids($pdo, $offeringIds);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
    api_json(['ok' => true]);
}
