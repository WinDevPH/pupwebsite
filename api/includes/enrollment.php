<?php

declare(strict_types=1);

function enrollment_bool_published(array $body, bool $default = true): int
{
    if (array_key_exists('published', $body)) {
        return $body['published'] ? 1 : 0;
    }
    if (array_key_exists('isPublished', $body)) {
        return $body['isPublished'] ? 1 : 0;
    }
    if (array_key_exists('is_published', $body)) {
        return ((int) $body['is_published']) === 1 ? 1 : 0;
    }
    return $default ? 1 : 0;
}

function enrollment_sort_order(array $body, int $default = 0): int
{
    return (int) ($body['sortOrder'] ?? $body['sort_order'] ?? $default);
}

function enrollment_require_id(array $body): int
{
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Record id is required.'], 422);
    }
    return $id;
}

/** Idempotent ALTER TABLE ADD COLUMN when missing. */
function enrollment_ensure_column(PDO $pdo, string $table, string $column, string $definition): void
{
    static $cache = [];
    $key = $table . '.' . $column;
    if (isset($cache[$key])) {
        return;
    }

    try {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column'
        );
        $stmt->execute(['table' => $table, 'column' => $column]);
        if ((int) $stmt->fetchColumn() === 0) {
            try {
                $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN {$definition}");
            } catch (Throwable) {
                // AFTER <col> can fail on drifted schemas — retry with bare definition.
                $bare = preg_replace('/\s+AFTER\s+`?[a-zA-Z0-9_]+`?/i', '', $definition) ?? $definition;
                $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN {$bare}");
            }
        }
    } catch (Throwable) {
        // Column may already exist (race) or host may restrict INFORMATION_SCHEMA.
    }
    $cache[$key] = true;
}

function enrollment_slot_booked_count(PDO $pdo, int $slotId, ?int $excludeAppointmentId = null): int
{
    if ($slotId <= 0) {
        return 0;
    }
    $sql = "SELECT COUNT(*) FROM enrollment_appointments
            WHERE slot_id = :slot_id AND status IN ('pending', 'approved')";
    $params = ['slot_id' => $slotId];
    if ($excludeAppointmentId !== null && $excludeAppointmentId > 0) {
        $sql .= ' AND id <> :exclude_id';
        $params['exclude_id'] = $excludeAppointmentId;
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return (int) $stmt->fetchColumn();
}

function enrollment_batch_scheduled_count(PDO $pdo, int $batchId): int
{
    if ($batchId <= 0) {
        return 0;
    }
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) FROM enrollment_appointments a
         INNER JOIN enrollment_time_slots s ON s.id = a.slot_id
         WHERE s.batch_id = :batch_id AND a.status IN ('pending', 'approved')"
    );
    $stmt->execute(['batch_id' => $batchId]);
    return (int) $stmt->fetchColumn();
}

function enrollment_refresh_batch_scheduled_count(PDO $pdo, ?int $batchId): void
{
    if ($batchId === null || $batchId <= 0) {
        return;
    }
    $count = enrollment_batch_scheduled_count($pdo, $batchId);
    $stmt = $pdo->prepare(
        'UPDATE enrollment_appointment_batches SET scheduled_count = :count WHERE id = :id'
    );
    $stmt->execute(['count' => $count, 'id' => $batchId]);
}

function enrollment_refresh_batches_for_slot_ids(PDO $pdo, array $slotIds): void
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $slotIds), static fn ($id) => $id > 0)));
    if ($ids === []) {
        return;
    }
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare(
        "SELECT DISTINCT batch_id FROM enrollment_time_slots
         WHERE id IN ({$placeholders}) AND batch_id IS NOT NULL AND batch_id > 0"
    );
    $stmt->execute($ids);
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $batchId) {
        enrollment_refresh_batch_scheduled_count($pdo, (int) $batchId);
    }
}

/** Slim appointment card for batch roster / assign UI. */
function enrollment_batch_student_card(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'trackingCode' => (string) ($row['tracking_code'] ?? ''),
        'fullName' => (string) ($row['full_name'] ?? ''),
        'studentNumber' => (string) ($row['student_number'] ?? ''),
        'yearLevel' => (string) ($row['year_level'] ?? ''),
        'enrollmentDate' => (string) ($row['enrollment_date'] ?? ''),
        'enrollmentDateLabel' => (string) ($row['enrollment_date_label'] ?? $row['enrollment_date'] ?? ''),
        'timeSlot' => (string) ($row['time_slot'] ?? ''),
        'timeSlotLabel' => (string) ($row['time_slot_label'] ?? $row['time_slot'] ?? ''),
        'slotId' => isset($row['slot_id']) && $row['slot_id'] !== null && (int) $row['slot_id'] > 0
            ? (int) $row['slot_id']
            : null,
        'status' => in_array(strtolower((string) ($row['status'] ?? '')), ['pending', 'approved', 'rejected'], true)
            ? strtolower((string) $row['status'])
            : 'pending',
        'createdAt' => !empty($row['created_at']) ? api_iso((string) $row['created_at']) : null,
    ];
}

/**
 * Appointments already on slots linked to this batch (pending + approved).
 *
 * @return list<array<string, mixed>>
 */
function enrollment_batch_roster_students(PDO $pdo, int $batchId): array
{
    if ($batchId <= 0) {
        return [];
    }
    try {
        $stmt = $pdo->prepare(
            "SELECT a.*
             FROM enrollment_appointments a
             INNER JOIN enrollment_time_slots s ON s.id = a.slot_id
             WHERE s.batch_id = :batch_id AND a.status IN ('pending', 'approved')
             ORDER BY
               CASE a.status WHEN 'approved' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
               a.enrollment_date ASC,
               a.time_slot ASC,
               a.full_name ASC,
               a.id ASC"
        );
        $stmt->execute(['batch_id' => $batchId]);
    } catch (Throwable) {
        return [];
    }
    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $items[] = enrollment_batch_student_card($row);
    }
    return $items;
}

/**
 * Approved appointments not currently on this batch (can be assigned).
 *
 * @return list<array<string, mixed>>
 */
function enrollment_batch_assignable_students(PDO $pdo, int $batchId): array
{
    if ($batchId <= 0) {
        return [];
    }
    try {
        $stmt = $pdo->prepare(
            "SELECT a.*
             FROM enrollment_appointments a
             LEFT JOIN enrollment_time_slots s ON s.id = a.slot_id
             WHERE a.status = 'approved'
               AND (
                 a.slot_id IS NULL OR a.slot_id = 0
                 OR s.batch_id IS NULL OR s.batch_id = 0
                 OR s.batch_id <> :batch_id
               )
             ORDER BY a.created_at DESC, a.id DESC
             LIMIT 100"
        );
        $stmt->execute(['batch_id' => $batchId]);
    } catch (Throwable) {
        return [];
    }
    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $items[] = enrollment_batch_student_card($row);
    }
    return $items;
}

/**
 * @return list<array{id:int,value:string,label:string,capacity:int,bookedCount:int,remaining:int,full:bool}>
 */
function enrollment_batch_slots(PDO $pdo, int $batchId): array
{
    if ($batchId <= 0) {
        return [];
    }
    try {
        $stmt = $pdo->prepare(
            'SELECT * FROM enrollment_time_slots
             WHERE batch_id = :batch_id
             ORDER BY sort_order ASC, id ASC'
        );
        $stmt->execute(['batch_id' => $batchId]);
    } catch (Throwable) {
        return [];
    }
    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $id = (int) $row['id'];
        $capacity = max(0, (int) ($row['capacity'] ?? 0));
        $booked = 0;
        try {
            $count = $pdo->prepare(
                "SELECT COUNT(*) FROM enrollment_appointments
                 WHERE slot_id = :slot_id AND status IN ('pending', 'approved')"
            );
            $count->execute(['slot_id' => $id]);
            $booked = (int) $count->fetchColumn();
        } catch (Throwable) {
            $booked = 0;
        }
        $remaining = max(0, $capacity - $booked);
        $items[] = [
            'id' => $id,
            'value' => (string) ($row['value_label'] ?? ''),
            'label' => (string) ($row['value_label'] ?? ''),
            'capacity' => $capacity,
            'bookedCount' => $booked,
            'remaining' => $remaining,
            'full' => $capacity > 0 ? $booked >= $capacity : false,
        ];
    }
    return $items;
}

/**
 * Assign an approved appointment onto a slot belonging to the batch.
 *
 * @return array{ok:true, student: array}|array{ok:false, error:string, status?:int}
 */
function enrollment_batch_assign_appointment(PDO $pdo, int $batchId, int $appointmentId, ?int $slotId = null): array
{
    if ($batchId <= 0 || $appointmentId <= 0) {
        return ['ok' => false, 'error' => 'Batch and appointment are required.', 'status' => 422];
    }

    $apptStmt = $pdo->prepare('SELECT * FROM enrollment_appointments WHERE id = :id LIMIT 1');
    $apptStmt->execute(['id' => $appointmentId]);
    $appt = $apptStmt->fetch();
    if (!$appt) {
        return ['ok' => false, 'error' => 'Appointment not found.', 'status' => 404];
    }
    $status = strtolower((string) ($appt['status'] ?? ''));
    if ($status !== 'approved' && $status !== 'pending') {
        return ['ok' => false, 'error' => 'Only pending or approved appointments can be assigned.', 'status' => 422];
    }

    $slots = enrollment_batch_slots($pdo, $batchId);
    if ($slots === []) {
        return [
            'ok' => false,
            'error' => 'Link at least one Routing time slot to this batch before assigning students.',
            'status' => 422,
        ];
    }

    $target = null;
    if ($slotId !== null && $slotId > 0) {
        foreach ($slots as $slot) {
            if ((int) $slot['id'] === $slotId) {
                $target = $slot;
                break;
            }
        }
        if ($target === null) {
            return ['ok' => false, 'error' => 'Selected slot is not linked to this batch.', 'status' => 422];
        }
    } else {
        foreach ($slots as $slot) {
            $isCurrent = (int) ($appt['slot_id'] ?? 0) === (int) $slot['id'];
            if ($isCurrent || !$slot['full']) {
                $target = $slot;
                if (!$slot['full'] || $isCurrent) {
                    break;
                }
            }
        }
        if ($target === null) {
            return ['ok' => false, 'error' => 'All slots for this batch are full.', 'status' => 422];
        }
    }

    $oldSlotId = isset($appt['slot_id']) && $appt['slot_id'] !== null ? (int) $appt['slot_id'] : 0;
    $newSlotId = (int) $target['id'];
    $isCurrent = $oldSlotId === $newSlotId;
    if (!$isCurrent && !empty($target['full'])) {
        return ['ok' => false, 'error' => 'Selected slot is full.', 'status' => 422];
    }

    $pdo->beginTransaction();
    try {
        $upd = $pdo->prepare(
            'UPDATE enrollment_appointments
             SET slot_id = :slot_id,
                 time_slot = :time_slot,
                 time_slot_label = :time_slot_label
             WHERE id = :id'
        );
        $upd->execute([
            'id' => $appointmentId,
            'slot_id' => $newSlotId,
            'time_slot' => (string) $target['value'],
            'time_slot_label' => (string) $target['label'],
        ]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        return ['ok' => false, 'error' => 'Could not assign appointment.', 'status' => 500];
    }

    enrollment_refresh_batches_for_slot_ids($pdo, array_filter([$oldSlotId, $newSlotId]));
    enrollment_refresh_batch_scheduled_count($pdo, $batchId);

    $fresh = $pdo->prepare('SELECT * FROM enrollment_appointments WHERE id = :id LIMIT 1');
    $fresh->execute(['id' => $appointmentId]);
    $row = $fresh->fetch() ?: $appt;

    return ['ok' => true, 'student' => enrollment_batch_student_card($row)];
}

/**
 * Count approved schedule snapshots that include an offering id.
 * Snapshots store id as number or string inside offerings_json.
 */
function enrollment_offering_taken_count(PDO $pdo, int $offeringId, ?int $excludeScheduleId = null): int
{
    if ($offeringId <= 0) {
        return 0;
    }
    $sql = "SELECT offerings_json FROM enrollment_schedules WHERE status = 'approved'";
    $params = [];
    if ($excludeScheduleId !== null && $excludeScheduleId > 0) {
        $sql .= ' AND id <> :exclude_id';
        $params['exclude_id'] = $excludeScheduleId;
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $taken = 0;
    while ($raw = $stmt->fetchColumn()) {
        $items = json_decode((string) $raw, true);
        if (!is_array($items)) {
            continue;
        }
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            if ((int) ($item['id'] ?? 0) === $offeringId) {
                $taken += 1;
                break;
            }
        }
    }
    return $taken;
}

function enrollment_recompute_offering_availability(PDO $pdo, int $offeringId, ?int $excludeScheduleId = null): void
{
    if ($offeringId <= 0) {
        return;
    }
    $stmt = $pdo->prepare('SELECT id, capacity FROM enrollment_offerings WHERE id = :id LIMIT 1 FOR UPDATE');
    $stmt->execute(['id' => $offeringId]);
    $row = $stmt->fetch();
    if (!$row) {
        return;
    }
    $capacity = max(0, (int) ($row['capacity'] ?? 40));
    $taken = enrollment_offering_taken_count($pdo, $offeringId, $excludeScheduleId);
    $availability = $taken >= $capacity ? 'FULL' : 'OPEN';
    $update = $pdo->prepare(
        'UPDATE enrollment_offerings SET availability = :availability WHERE id = :id'
    );
    $update->execute(['availability' => $availability, 'id' => $offeringId]);
}

/**
 * @param list<array<string, mixed>> $offerings
 * @return list<int>
 */
function enrollment_offering_ids_from_snapshot(array $offerings): array
{
    $ids = [];
    foreach ($offerings as $item) {
        $id = (int) ($item['id'] ?? 0);
        if ($id > 0) {
            $ids[] = $id;
        }
    }
    return array_values(array_unique($ids));
}

/**
 * Validate offerings exist/published and have seat room when status will be approved.
 *
 * @param list<array<string, mixed>> $offerings
 * @return list<array<string, mixed>> hydrated snapshots from DB rows
 */
function enrollment_validate_schedule_offerings(
    PDO $pdo,
    array $offerings,
    string $status,
    ?int $excludeScheduleId = null,
): array {
    $ids = enrollment_offering_ids_from_snapshot($offerings);
    if ($ids === []) {
        api_json(['ok' => false, 'error' => 'Select at least one class offering.'], 422);
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare(
        "SELECT * FROM enrollment_offerings WHERE id IN ({$placeholders}) FOR UPDATE"
    );
    $stmt->execute($ids);
    $byId = [];
    foreach ($stmt->fetchAll() as $row) {
        $byId[(int) $row['id']] = $row;
    }

    $hydrated = [];
    $willApprove = $status === 'approved';
    foreach ($ids as $id) {
        if (!isset($byId[$id])) {
            api_json(['ok' => false, 'error' => "Offering #{$id} was not found."], 422);
        }
        $row = $byId[$id];
        if ((int) ($row['is_published'] ?? 0) !== 1) {
            api_json(['ok' => false, 'error' => "Offering {$row['code']} is not published."], 422);
        }
        if ($willApprove) {
            $capacity = max(0, (int) ($row['capacity'] ?? 40));
            $taken = enrollment_offering_taken_count($pdo, $id, $excludeScheduleId);
            if ($taken >= $capacity) {
                api_json([
                    'ok' => false,
                    'error' => "{$row['code']} ({$row['section']}) is full.",
                    'errors' => ['offerings' => "{$row['code']} is full."],
                ], 422);
            }
        }
        $days = json_decode((string) ($row['days_json'] ?? '[]'), true);
        if (!is_array($days)) {
            $days = [];
        }
        $hydrated[] = [
            'id' => (int) $row['id'],
            'code' => (string) $row['code'],
            'title' => (string) $row['title'],
            'section' => (string) $row['section'],
            'year' => (string) $row['year_level'],
            'units' => (float) $row['units'],
            'days' => array_values($days),
            'startHour' => (float) $row['start_hour'],
            'endHour' => (float) $row['end_hour'],
            'timeLabel' => (string) $row['time_label'],
            'scheduleLabel' => (string) ($row['schedule_label'] !== '' ? $row['schedule_label'] : $row['time_label']),
            'availability' => (string) $row['availability'],
        ];
    }
    return $hydrated;
}

function enrollment_recompute_offerings_for_ids(PDO $pdo, array $offeringIds, ?int $excludeScheduleId = null): void
{
    foreach (array_values(array_unique(array_filter(array_map('intval', $offeringIds)))) as $id) {
        if ($id > 0) {
            enrollment_recompute_offering_availability($pdo, $id, $excludeScheduleId);
        }
    }
}
