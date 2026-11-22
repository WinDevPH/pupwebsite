<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/enrollment.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => enrollment_appointments_get(),
        'POST' => enrollment_appointments_post(),
        'PUT', 'PATCH' => enrollment_appointments_update(),
        'DELETE' => enrollment_appointments_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json_db_error($error);
}

/** POST create, or multipart update when _method=PUT (PHP only populates $_FILES on POST). */
function enrollment_appointments_post(): never
{
    $methodOverride = strtoupper(trim((string) ($_POST['_method'] ?? '')));
    if ($methodOverride === 'PUT' || $methodOverride === 'PATCH') {
        enrollment_appointments_update();
    }
    enrollment_appointments_create();
}

function enrollment_appointments_ensure(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS enrollment_appointments (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          tracking_code VARCHAR(32) NOT NULL,
          full_name VARCHAR(255) NOT NULL,
          student_number VARCHAR(64) NOT NULL,
          year_level VARCHAR(16) NOT NULL,
          classification VARCHAR(16) NOT NULL DEFAULT 'regular',
          enrollment_date VARCHAR(32) NOT NULL,
          enrollment_date_label VARCHAR(120) NOT NULL DEFAULT '',
          time_slot VARCHAR(120) NOT NULL,
          time_slot_label VARCHAR(160) NOT NULL DEFAULT '',
          check_standing TINYINT(1) NOT NULL DEFAULT 0,
          check_schedule TINYINT(1) NOT NULL DEFAULT 0,
          check_petition TINYINT(1) NOT NULL DEFAULT 0,
          payment_mode VARCHAR(32) NOT NULL DEFAULT '',
          reference_no VARCHAR(120) NOT NULL DEFAULT '',
          proof_name VARCHAR(255) NOT NULL DEFAULT '',
          proof_path VARCHAR(500) NOT NULL DEFAULT '',
          status VARCHAR(16) NOT NULL DEFAULT 'pending',
          admin_note TEXT NULL,
          reviewed_at DATETIME NULL,
          reviewed_by INT UNSIGNED NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_enroll_appt_tracking (tracking_code),
          date_id INT UNSIGNED NULL,
          slot_id INT UNSIGNED NULL,
          KEY idx_enroll_appt_status (status, created_at),
          KEY idx_enroll_appt_student (student_number),
          KEY idx_enroll_appt_slot (slot_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    enrollment_ensure_column(
        $pdo,
        'enrollment_appointments',
        'date_id',
        'date_id INT UNSIGNED NULL AFTER time_slot_label'
    );
    enrollment_ensure_column(
        $pdo,
        'enrollment_appointments',
        'slot_id',
        'slot_id INT UNSIGNED NULL AFTER date_id'
    );
    enrollment_ensure_column(
        $pdo,
        'enrollment_appointments',
        'reviewed_at',
        'reviewed_at DATETIME NULL AFTER admin_note'
    );
    enrollment_ensure_column(
        $pdo,
        'enrollment_appointments',
        'reviewed_by',
        'reviewed_by INT UNSIGNED NULL AFTER reviewed_at'
    );

    $ready = true;
}

/**
 * Resolve published date + slot, lock slot, and enforce capacity for active statuses.
 *
 * @param array<string, mixed> $source
 * @return array{dateId: int, slotId: int, enrollmentDate: string, enrollmentDateLabel: string, timeSlot: string, timeSlotLabel: string, batchId: int|null}
 */
function enrollment_appointments_resolve_inventory(
    PDO $pdo,
    array $source,
    string $status,
    ?int $excludeAppointmentId = null,
): array {
    $dateId = (int) ($source['dateId'] ?? $source['date_id'] ?? 0);
    $slotId = (int) ($source['slotId'] ?? $source['slot_id'] ?? 0);
    $dateValue = trim((string) ($source['enrollmentDate'] ?? $source['enrollment_date'] ?? ''));
    $slotValue = trim((string) ($source['timeSlot'] ?? $source['time_slot'] ?? ''));

    if ($dateId <= 0 && $dateValue !== '') {
        $find = $pdo->prepare(
            'SELECT id FROM enrollment_dates WHERE value_date = :value ORDER BY is_published DESC, id ASC LIMIT 1'
        );
        $find->execute(['value' => $dateValue]);
        $dateId = (int) ($find->fetchColumn() ?: 0);
    }
    if ($slotId <= 0 && $slotValue !== '') {
        $find = $pdo->prepare(
            'SELECT id FROM enrollment_time_slots WHERE value_label = :value ORDER BY is_published DESC, id ASC LIMIT 1'
        );
        $find->execute(['value' => $slotValue]);
        $slotId = (int) ($find->fetchColumn() ?: 0);
    }

    if ($dateId <= 0 || $slotId <= 0) {
        api_json([
            'ok' => false,
            'error' => 'Select a valid enrollment date and time slot.',
            'errors' => [
                'enrollmentDate' => $dateId <= 0 ? 'Select an enrollment date.' : '',
                'timeSlot' => $slotId <= 0 ? 'Select a time slot.' : '',
            ],
        ], 422);
    }

    $dateStmt = $pdo->prepare('SELECT * FROM enrollment_dates WHERE id = :id LIMIT 1');
    $dateStmt->execute(['id' => $dateId]);
    $dateRow = $dateStmt->fetch();
    if (!$dateRow || (int) ($dateRow['is_published'] ?? 0) !== 1) {
        api_json(['ok' => false, 'error' => 'Enrollment date is not available.'], 422);
    }

    $slotStmt = $pdo->prepare('SELECT * FROM enrollment_time_slots WHERE id = :id LIMIT 1 FOR UPDATE');
    $slotStmt->execute(['id' => $slotId]);
    $slotRow = $slotStmt->fetch();
    if (!$slotRow || (int) ($slotRow['is_published'] ?? 0) !== 1) {
        api_json(['ok' => false, 'error' => 'Time slot is not available.'], 422);
    }

    $capacity = max(0, (int) ($slotRow['capacity'] ?? 40));
    $active = in_array($status, ['pending', 'approved'], true);
    if ($active) {
        $booked = enrollment_slot_booked_count($pdo, $slotId, $excludeAppointmentId);
        if ($booked >= $capacity) {
            api_json([
                'ok' => false,
                'error' => 'This time slot is full. Choose another slot.',
                'errors' => ['timeSlot' => 'This time slot is full.'],
            ], 422);
        }
    }

    $batchId = isset($slotRow['batch_id']) && $slotRow['batch_id'] !== null && (int) $slotRow['batch_id'] > 0
        ? (int) $slotRow['batch_id']
        : null;

    return [
        'dateId' => $dateId,
        'slotId' => $slotId,
        'enrollmentDate' => (string) $dateRow['value_date'],
        'enrollmentDateLabel' => (string) $dateRow['label'],
        'timeSlot' => (string) $slotRow['value_label'],
        'timeSlotLabel' => (string) $slotRow['value_label'],
        'batchId' => $batchId,
    ];
}

function enrollment_appointments_make_tracking(): string
{
    $date = date('Ymd');
    $suffix = strtoupper(bin2hex(random_bytes(2)));
    return "EH-{$date}-{$suffix}";
}

function enrollment_appointments_normalize_status(string $status): string
{
    $status = strtolower(trim($status));
    return in_array($status, ['pending', 'approved', 'rejected'], true) ? $status : 'pending';
}

function enrollment_appointment_row(array $row, bool $includeProofUrl = false): array
{
    $id = (int) $row['id'];
    $hasProof = trim((string) ($row['proof_path'] ?? '')) !== '';
    $item = [
        'id' => $id,
        'trackingCode' => (string) $row['tracking_code'],
        'fullName' => (string) $row['full_name'],
        'studentNumber' => (string) $row['student_number'],
        'yearLevel' => (string) $row['year_level'],
        'classification' => (string) $row['classification'],
        'enrollmentDate' => (string) $row['enrollment_date'],
        'enrollmentDateLabel' => (string) ($row['enrollment_date_label'] !== ''
            ? $row['enrollment_date_label']
            : $row['enrollment_date']),
        'dateId' => isset($row['date_id']) && $row['date_id'] !== null && (int) $row['date_id'] > 0
            ? (int) $row['date_id']
            : null,
        'timeSlot' => (string) $row['time_slot'],
        'timeSlotLabel' => (string) ($row['time_slot_label'] !== ''
            ? $row['time_slot_label']
            : $row['time_slot']),
        'slotId' => isset($row['slot_id']) && $row['slot_id'] !== null && (int) $row['slot_id'] > 0
            ? (int) $row['slot_id']
            : null,
        'checkStanding' => (int) ($row['check_standing'] ?? 0) === 1,
        'checkSchedule' => (int) ($row['check_schedule'] ?? 0) === 1,
        'checkPetition' => (int) ($row['check_petition'] ?? 0) === 1,
        'paymentMode' => (string) $row['payment_mode'],
        'referenceNo' => (string) $row['reference_no'],
        'proofName' => (string) ($row['proof_name'] ?? ''),
        'hasProof' => $hasProof,
        'status' => enrollment_appointments_normalize_status((string) ($row['status'] ?? 'pending')),
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

    if ($includeProofUrl && $hasProof) {
        $item['proofUrl'] = '/api/enrollment-appointments.php?download=1&id=' . $id . '&inline=1';
        $item['proofDownloadUrl'] = '/api/enrollment-appointments.php?download=1&id=' . $id;
    }

    return $item;
}

/**
 * Resolve on-disk payment proof path from a DB row.
 * Tries private storage bucket, relative project paths, and legacy locations.
 */
function enrollment_appointments_resolve_proof_path(array $row): ?string
{
    $relative = str_replace('\\', '/', trim((string) ($row['proof_path'] ?? '')));
    if ($relative === '') {
        return null;
    }

    $basename = basename($relative);
    if ($basename === '' || $basename === '.' || $basename === '..') {
        return null;
    }

    $root = rtrim(str_replace('\\', '/', api_project_root()), '/');
    $bucket = rtrim(str_replace('\\', '/', api_private_uploads_dir('appointments')), '/');
    $relativeTrim = ltrim($relative, '/');

    $candidates = [
        $bucket . '/' . $basename,
        $root . '/' . $relativeTrim,
        $root . '/storage/appointments/' . $basename,
        $root . '/api/storage/appointments/' . $basename,
        $root . '/uploads/appointments/' . $basename,
    ];

    // Absolute path already stored in DB (local→prod migration edge case).
    if (preg_match('#^([a-zA-Z]:/|/)#', $relative) === 1) {
        array_unshift($candidates, $relative);
    }

    foreach ($candidates as $candidate) {
        $normalized = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $candidate);
        if (is_file($normalized) && is_readable($normalized)) {
            $real = realpath($normalized);
            return $real !== false ? $real : $normalized;
        }
    }

    return null;
}

function enrollment_appointments_unlink_proof(array $row): void
{
    $path = enrollment_appointments_resolve_proof_path($row);
    if ($path !== null && is_file($path)) {
        @unlink($path);
    }
}

function enrollment_appointments_stream_proof(array $row): never
{
    $name = (string) ($row['proof_name'] ?? 'payment-proof');
    $path = enrollment_appointments_resolve_proof_path($row);

    if ($path === null) {
        api_json(['ok' => false, 'error' => 'Payment proof file is missing.'], 404);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $contentType = $finfo->file($path) ?: 'application/octet-stream';
    $safeName = str_replace(['"', "\r", "\n"], '', $name);
    $inline = (string) ($_GET['inline'] ?? '') === '1';
    $disposition = $inline ? 'inline' : 'attachment';

    api_security_headers();
    header('Content-Type: ' . $contentType);
    header('Content-Length: ' . (string) filesize($path));
    header('Content-Disposition: ' . $disposition . '; filename="' . $safeName . '"');
    header('Cache-Control: private, no-store');
    readfile($path);
    exit;
}

function enrollment_appointments_get(): never
{
    $pdo = api_pdo();
    enrollment_appointments_ensure($pdo);

    $download = (string) ($_GET['download'] ?? '') === '1';
    $id = (int) ($_GET['id'] ?? 0);

    if ($download) {
        api_require_manager();
        if ($id <= 0) {
            api_json(['ok' => false, 'error' => 'Appointment id is required.'], 422);
        }
        $stmt = $pdo->prepare('SELECT proof_name, proof_path FROM enrollment_appointments WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Appointment not found.'], 404);
        }
        enrollment_appointments_stream_proof($row);
    }

    api_require_manager();

    if ($id > 0) {
        $stmt = $pdo->prepare('SELECT * FROM enrollment_appointments WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Appointment not found.'], 404);
        }
        api_json(['ok' => true, 'item' => enrollment_appointment_row($row, true)]);
    }

    $status = strtolower(trim((string) ($_GET['status'] ?? '')));
    if ($status !== '' && in_array($status, ['pending', 'approved', 'rejected'], true)) {
        $stmt = $pdo->prepare(
            'SELECT * FROM enrollment_appointments WHERE status = :status ORDER BY created_at DESC, id DESC'
        );
        $stmt->execute(['status' => $status]);
    } else {
        $stmt = $pdo->query('SELECT * FROM enrollment_appointments ORDER BY created_at DESC, id DESC');
    }

    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $items[] = enrollment_appointment_row($row, true);
    }

    $counts = [
        'all' => (int) $pdo->query('SELECT COUNT(*) FROM enrollment_appointments')->fetchColumn(),
        'pending' => (int) $pdo->query("SELECT COUNT(*) FROM enrollment_appointments WHERE status = 'pending'")->fetchColumn(),
        'approved' => (int) $pdo->query("SELECT COUNT(*) FROM enrollment_appointments WHERE status = 'approved'")->fetchColumn(),
        'rejected' => (int) $pdo->query("SELECT COUNT(*) FROM enrollment_appointments WHERE status = 'rejected'")->fetchColumn(),
    ];

    api_json(['ok' => true, 'items' => $items, 'counts' => $counts]);
}

/**
 * @param array<string, mixed>|null $source
 */
function enrollment_appointments_bool_from(mixed $raw): int
{
    if (is_bool($raw)) {
        return $raw ? 1 : 0;
    }
    $value = strtolower(trim((string) ($raw ?? '0')));
    return in_array($value, ['1', 'true', 'yes', 'on'], true) ? 1 : 0;
}

function enrollment_appointments_bool_field(string $key): int
{
    return enrollment_appointments_bool_from($_POST[$key] ?? '0');
}

/**
 * @return array{0: array<string, mixed>, 1: bool}
 */
function enrollment_appointments_request_payload(): array
{
    $contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? ''));
    if (str_contains($contentType, 'application/json')) {
        return [api_read_json(), true];
    }
    return [$_POST, false];
}

/**
 * @param array<string, mixed> $source
 * @return array{fullName: string, studentNumber: string, yearLevel: string, classification: string, enrollmentDate: string, enrollmentDateLabel: string, timeSlot: string, timeSlotLabel: string, paymentMode: string, referenceNo: string, checkStanding: int, checkSchedule: int, checkPetition: int, status: string, adminNote: string}
 */
function enrollment_appointments_parse_fields(array $source): array
{
    $classification = strtolower(trim((string) ($source['classification'] ?? 'regular')));
    if (!in_array($classification, ['regular', 'irregular'], true)) {
        $classification = 'regular';
    }

    return [
        'fullName' => trim((string) ($source['fullName'] ?? $source['full_name'] ?? '')),
        'studentNumber' => trim((string) ($source['studentNumber'] ?? $source['student_number'] ?? '')),
        'yearLevel' => trim((string) ($source['yearLevel'] ?? $source['year_level'] ?? '')),
        'classification' => $classification,
        'enrollmentDate' => trim((string) ($source['enrollmentDate'] ?? $source['enrollment_date'] ?? '')),
        'enrollmentDateLabel' => trim((string) ($source['enrollmentDateLabel'] ?? $source['enrollment_date_label'] ?? '')),
        'timeSlot' => trim((string) ($source['timeSlot'] ?? $source['time_slot'] ?? '')),
        'timeSlotLabel' => trim((string) ($source['timeSlotLabel'] ?? $source['time_slot_label'] ?? '')),
        'paymentMode' => trim((string) ($source['paymentMode'] ?? $source['payment_mode'] ?? '')),
        'referenceNo' => trim((string) ($source['referenceNo'] ?? $source['reference_no'] ?? '')),
        'checkStanding' => enrollment_appointments_bool_from($source['checkStanding'] ?? $source['check_standing'] ?? 0),
        'checkSchedule' => enrollment_appointments_bool_from($source['checkSchedule'] ?? $source['check_schedule'] ?? 0),
        'checkPetition' => enrollment_appointments_bool_from($source['checkPetition'] ?? $source['check_petition'] ?? 0),
        'status' => enrollment_appointments_normalize_status((string) ($source['status'] ?? 'pending')),
        'adminNote' => trim((string) ($source['adminNote'] ?? $source['admin_note'] ?? '')),
    ];
}

/**
 * @param array{fullName: string, studentNumber: string, yearLevel: string, classification: string, enrollmentDate: string, enrollmentDateLabel: string, timeSlot: string, timeSlotLabel: string, paymentMode: string, referenceNo: string} $fields
 * @return array<string, string>
 */
function enrollment_appointments_validate_fields(array $fields, bool $requireReference = true): array
{
    $errors = [];
    if (mb_strlen($fields['fullName']) < 3) {
        $errors['fullName'] = 'Enter the student full name.';
    }
    if (mb_strlen($fields['studentNumber']) < 5) {
        $errors['studentNumber'] = 'Enter a valid student number.';
    }
    if ($fields['yearLevel'] === '') {
        $errors['yearLevel'] = 'Select a year level.';
    }
    if ($fields['enrollmentDate'] === '') {
        $errors['enrollmentDate'] = 'Select an enrollment date.';
    }
    if ($fields['timeSlot'] === '') {
        $errors['timeSlot'] = 'Select a time slot.';
    }
    if ($fields['paymentMode'] === '') {
        $errors['paymentMode'] = 'Select a payment mode.';
    }
    if ($requireReference && mb_strlen($fields['referenceNo']) < 4) {
        $errors['referenceNo'] = 'Enter the receipt or reference number.';
    }
    return $errors;
}

/**
 * @return array{proofName: string, proofPath: string}|null
 */
function enrollment_appointments_store_proof_upload(bool $required): ?array
{
    $file = $_FILES['proof'] ?? $_FILES['file'] ?? null;
    $uploadError = is_array($file) ? (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) : UPLOAD_ERR_NO_FILE;
    $hasUpload = is_array($file) && $uploadError !== UPLOAD_ERR_NO_FILE;
    if (!$hasUpload) {
        if ($required) {
            api_json(['ok' => false, 'error' => 'Attach a clear image of your payment proof.', 'errors' => ['proof' => 'Attach a clear image of your payment proof.']], 422);
        }
        return null;
    }

    /** @var array $file */
    if ($uploadError !== UPLOAD_ERR_OK) {
        $message = match ($uploadError) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Proof image must be 5 MB or smaller.',
            UPLOAD_ERR_PARTIAL => 'Upload was interrupted. Try again.',
            default => 'Could not upload the payment proof.',
        };
        api_json(['ok' => false, 'error' => $message], 422);
    }

    $tmp = (string) ($file['tmp_name'] ?? '');
    $size = (int) ($file['size'] ?? 0);
    $original = (string) ($file['name'] ?? 'payment-proof');
    if ($tmp === '' || !is_uploaded_file($tmp)) {
        api_json(['ok' => false, 'error' => 'Invalid payment proof upload.'], 422);
    }

    $maxBytes = 5 * 1024 * 1024;
    if ($size <= 0 || $size > $maxBytes) {
        api_json(['ok' => false, 'error' => 'Proof image must be 5 MB or smaller.'], 422);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($tmp) ?: '';
    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];
    $ext = $allowed[$mime] ?? null;
    if ($ext === null) {
        api_json(['ok' => false, 'error' => 'Use a JPG, PNG, or WebP image for payment proof.'], 422);
    }

    if (function_exists('api_slugify')) {
        $base = api_slugify(pathinfo($original, PATHINFO_FILENAME));
    } else {
        $slug = preg_replace('/[^a-z0-9]+/i', '-', pathinfo($original, PATHINFO_FILENAME));
        $base = is_string($slug) && $slug !== '' ? $slug : 'proof';
    }
    $filename = sprintf('%s-%s.%s', $base !== '' ? $base : 'proof', bin2hex(random_bytes(4)), $ext);
    $storageDir = api_private_uploads_dir('appointments');
    if (!is_dir($storageDir) && !mkdir($storageDir, 0755, true) && !is_dir($storageDir)) {
        api_json(['ok' => false, 'error' => 'Could not create upload folder.'], 500);
    }
    $dest = $storageDir . DIRECTORY_SEPARATOR . $filename;
    $moved = move_uploaded_file($tmp, $dest);
    if (!$moved) {
        // Some hosts disallow move_uploaded_file across open_basedir boundaries.
        $moved = @copy($tmp, $dest) && is_file($dest);
        if ($moved) {
            @unlink($tmp);
        }
    }
    if (!$moved || !is_file($dest)) {
        api_json(['ok' => false, 'error' => 'Could not save the payment proof.'], 500);
    }
    @chmod($dest, 0644);

    return [
        'proofName' => $original,
        'proofPath' => 'storage/appointments/' . $filename,
    ];
}

function enrollment_appointments_create(): never
{
    [$source, $isJson] = enrollment_appointments_request_payload();
    $sessionUser = api_current_user();
    $sessionRole = strtolower((string) ($sessionUser['role'] ?? ''));
    $managerCreate = $isJson || ($sessionUser !== null && in_array($sessionRole, ['admin', 'officer'], true));
    if ($managerCreate) {
        api_require_manager();
    }

    $pdo = api_pdo();
    enrollment_appointments_ensure($pdo);

    $fields = enrollment_appointments_parse_fields($source);
    $errors = enrollment_appointments_validate_fields($fields, !$managerCreate || $fields['referenceNo'] !== '');
    if ($managerCreate && $fields['referenceNo'] === '') {
        unset($errors['referenceNo']);
    }
    // Date/slot validated via inventory resolve (ids preferred).
    unset($errors['enrollmentDate'], $errors['timeSlot']);
    if ($errors !== []) {
        api_json(['ok' => false, 'error' => (string) reset($errors), 'errors' => $errors], 422);
    }

    $proof = enrollment_appointments_store_proof_upload(!$managerCreate);
    $status = $managerCreate ? $fields['status'] : 'pending';
    $adminNote = $managerCreate && $fields['adminNote'] !== '' ? $fields['adminNote'] : null;

    $pdo->beginTransaction();
    try {
        $inventory = enrollment_appointments_resolve_inventory($pdo, $source, $status, null);
        $tracking = enrollment_appointments_make_tracking();
        $stmt = $pdo->prepare(
            'INSERT INTO enrollment_appointments
              (tracking_code, full_name, student_number, year_level, classification,
               enrollment_date, enrollment_date_label, time_slot, time_slot_label,
               date_id, slot_id,
               check_standing, check_schedule, check_petition,
               payment_mode, reference_no, proof_name, proof_path, status, admin_note)
             VALUES
              (:tracking_code, :full_name, :student_number, :year_level, :classification,
               :enrollment_date, :enrollment_date_label, :time_slot, :time_slot_label,
               :date_id, :slot_id,
               :check_standing, :check_schedule, :check_petition,
               :payment_mode, :reference_no, :proof_name, :proof_path, :status, :admin_note)'
        );
        $stmt->execute([
            'tracking_code' => $tracking,
            'full_name' => $fields['fullName'],
            'student_number' => $fields['studentNumber'],
            'year_level' => $fields['yearLevel'],
            'classification' => $fields['classification'],
            'enrollment_date' => $inventory['enrollmentDate'],
            'enrollment_date_label' => $inventory['enrollmentDateLabel'],
            'time_slot' => $inventory['timeSlot'],
            'time_slot_label' => $inventory['timeSlotLabel'],
            'date_id' => $inventory['dateId'],
            'slot_id' => $inventory['slotId'],
            'check_standing' => $fields['checkStanding'],
            'check_schedule' => $fields['checkSchedule'],
            'check_petition' => $fields['checkPetition'],
            'payment_mode' => $fields['paymentMode'],
            'reference_no' => $fields['referenceNo'],
            'proof_name' => $proof['proofName'] ?? '',
            'proof_path' => $proof['proofPath'] ?? '',
            'status' => $status,
            'admin_note' => $adminNote,
        ]);

        $id = (int) $pdo->lastInsertId();
        enrollment_refresh_batch_scheduled_count($pdo, $inventory['batchId']);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }

    $fetch = $pdo->prepare('SELECT * FROM enrollment_appointments WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    $row = $fetch->fetch() ?: [];

    api_json([
        'ok' => true,
        'item' => $managerCreate
            ? enrollment_appointment_row($row, true)
            : [
                'id' => $id,
                'trackingCode' => $tracking,
                'status' => 'pending',
                'createdAt' => isset($row['created_at']) ? api_iso((string) $row['created_at']) : null,
            ],
    ], 201);
}

/**
 * @return array<string, mixed>
 */
function enrollment_appointments_update_body(): array
{
    $contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? ''));
    if (str_contains($contentType, 'application/json')) {
        return api_read_json();
    }
    return $_POST;
}

function enrollment_appointments_update(): never
{
    $user = api_require_manager();
    $pdo = api_pdo();
    enrollment_appointments_ensure($pdo);
    $body = enrollment_appointments_update_body();
    $id = enrollment_require_id($body);

    $existing = $pdo->prepare('SELECT * FROM enrollment_appointments WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    $row = $existing->fetch();
    if (!$row) {
        api_json(['ok' => false, 'error' => 'Appointment not found.'], 404);
    }

    $resource = strtolower(trim((string) ($body['resource'] ?? 'status')));

    $oldSlotId = isset($row['slot_id']) ? (int) $row['slot_id'] : 0;
    $oldStatus = enrollment_appointments_normalize_status((string) ($row['status'] ?? 'pending'));
    $reviewedBy = (int) ($user['id'] ?? 0);

    if ($resource === 'details') {
        $fields = enrollment_appointments_parse_fields([
            'fullName' => $body['fullName'] ?? $body['full_name'] ?? $row['full_name'] ?? '',
            'studentNumber' => $body['studentNumber'] ?? $body['student_number'] ?? $row['student_number'] ?? '',
            'yearLevel' => $body['yearLevel'] ?? $body['year_level'] ?? $row['year_level'] ?? '',
            'classification' => $body['classification'] ?? $row['classification'] ?? 'regular',
            'enrollmentDate' => $body['enrollmentDate'] ?? $body['enrollment_date'] ?? $row['enrollment_date'] ?? '',
            'enrollmentDateLabel' => $body['enrollmentDateLabel'] ?? $body['enrollment_date_label'] ?? $row['enrollment_date_label'] ?? '',
            'timeSlot' => $body['timeSlot'] ?? $body['time_slot'] ?? $row['time_slot'] ?? '',
            'timeSlotLabel' => $body['timeSlotLabel'] ?? $body['time_slot_label'] ?? $row['time_slot_label'] ?? '',
            'paymentMode' => $body['paymentMode'] ?? $body['payment_mode'] ?? $row['payment_mode'] ?? '',
            'referenceNo' => $body['referenceNo'] ?? $body['reference_no'] ?? $row['reference_no'] ?? '',
            'checkStanding' => $body['checkStanding'] ?? $body['check_standing'] ?? $row['check_standing'] ?? 0,
            'checkSchedule' => $body['checkSchedule'] ?? $body['check_schedule'] ?? $row['check_schedule'] ?? 0,
            'checkPetition' => $body['checkPetition'] ?? $body['check_petition'] ?? $row['check_petition'] ?? 0,
            'dateId' => $body['dateId'] ?? $body['date_id'] ?? $row['date_id'] ?? 0,
            'slotId' => $body['slotId'] ?? $body['slot_id'] ?? $row['slot_id'] ?? 0,
        ]);
        $errors = enrollment_appointments_validate_fields($fields, false);
        unset($errors['enrollmentDate'], $errors['timeSlot']);
        if ($errors !== []) {
            api_json(['ok' => false, 'error' => (string) reset($errors), 'errors' => $errors], 422);
        }

        $status = array_key_exists('status', $body)
            ? enrollment_appointments_normalize_status((string) $body['status'])
            : $oldStatus;
        $note = array_key_exists('adminNote', $body) || array_key_exists('admin_note', $body)
            ? trim((string) ($body['adminNote'] ?? $body['admin_note'] ?? ''))
            : (string) ($row['admin_note'] ?? '');

        $pdo->beginTransaction();
        try {
            $inventory = enrollment_appointments_resolve_inventory(
                $pdo,
                array_merge($body, [
                    'dateId' => $body['dateId'] ?? $body['date_id'] ?? $row['date_id'] ?? 0,
                    'slotId' => $body['slotId'] ?? $body['slot_id'] ?? $row['slot_id'] ?? 0,
                    'enrollmentDate' => $fields['enrollmentDate'],
                    'timeSlot' => $fields['timeSlot'],
                ]),
                $status,
                $id,
            );

            $proof = enrollment_appointments_store_proof_upload(false);
            $proofName = (string) ($row['proof_name'] ?? '');
            $proofPath = (string) ($row['proof_path'] ?? '');
            if ($proof !== null) {
                enrollment_appointments_unlink_proof($row);
                $proofName = $proof['proofName'];
                $proofPath = $proof['proofPath'];
            }

            $pending = $status === 'pending';
            $stmt = $pdo->prepare(
                'UPDATE enrollment_appointments
                 SET full_name = :full_name,
                     student_number = :student_number,
                     year_level = :year_level,
                     classification = :classification,
                     enrollment_date = :enrollment_date,
                     enrollment_date_label = :enrollment_date_label,
                     time_slot = :time_slot,
                     time_slot_label = :time_slot_label,
                     date_id = :date_id,
                     slot_id = :slot_id,
                     check_standing = :check_standing,
                     check_schedule = :check_schedule,
                     check_petition = :check_petition,
                     payment_mode = :payment_mode,
                     reference_no = :reference_no,
                     proof_name = :proof_name,
                     proof_path = :proof_path,
                     status = :status,
                     admin_note = :admin_note,
                     reviewed_at = ' . ($pending ? 'NULL' : 'COALESCE(reviewed_at, NOW())') . ',
                     reviewed_by = ' . ($pending ? 'NULL' : 'COALESCE(reviewed_by, :reviewed_by)') . '
                 WHERE id = :id'
            );
            $params = [
                'id' => $id,
                'full_name' => $fields['fullName'],
                'student_number' => $fields['studentNumber'],
                'year_level' => $fields['yearLevel'],
                'classification' => $fields['classification'],
                'enrollment_date' => $inventory['enrollmentDate'],
                'enrollment_date_label' => $inventory['enrollmentDateLabel'],
                'time_slot' => $inventory['timeSlot'],
                'time_slot_label' => $inventory['timeSlotLabel'],
                'date_id' => $inventory['dateId'],
                'slot_id' => $inventory['slotId'],
                'check_standing' => $fields['checkStanding'],
                'check_schedule' => $fields['checkSchedule'],
                'check_petition' => $fields['checkPetition'],
                'payment_mode' => $fields['paymentMode'],
                'reference_no' => $fields['referenceNo'],
                'proof_name' => $proofName,
                'proof_path' => $proofPath,
                'status' => $status,
                'admin_note' => $note !== '' ? $note : null,
            ];
            if (!$pending) {
                $params['reviewed_by'] = $reviewedBy > 0 ? $reviewedBy : null;
            }
            $stmt->execute($params);
            try {
                enrollment_refresh_batches_for_slot_ids($pdo, [$oldSlotId, $inventory['slotId']]);
            } catch (Throwable) {
                // Details save must still succeed even if batch counters fail.
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $error;
        }
    } else {
        $status = enrollment_appointments_normalize_status((string) ($body['status'] ?? $row['status'] ?? ''));
        if (!in_array($status, ['pending', 'approved', 'rejected'], true)) {
            api_json(['ok' => false, 'error' => 'Status must be pending, approved, or rejected.'], 422);
        }

        $note = trim((string) ($body['adminNote'] ?? $body['admin_note'] ?? ''));
        $pending = $status === 'pending';

        $pdo->beginTransaction();
        try {
            // Only re-check capacity when (re)opening a booking that is not already holding a seat.
            // Approve/reject of an existing pending appointment must not fail if the slot was later unpublished.
            if (
                $status === 'pending'
                && $oldStatus !== 'pending'
                && $oldSlotId > 0
            ) {
                enrollment_appointments_resolve_inventory(
                    $pdo,
                    [
                        'dateId' => $row['date_id'] ?? 0,
                        'slotId' => $oldSlotId,
                        'enrollmentDate' => $row['enrollment_date'] ?? '',
                        'timeSlot' => $row['time_slot'] ?? '',
                    ],
                    $status,
                    $id,
                );
            }

            if ($pending) {
                $stmt = $pdo->prepare(
                    'UPDATE enrollment_appointments
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
                    'UPDATE enrollment_appointments
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
            try {
                enrollment_refresh_batches_for_slot_ids($pdo, [$oldSlotId]);
            } catch (Throwable) {
                // Status change must still succeed even if batch counters fail.
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $error;
        }
    }

    $fetch = $pdo->prepare('SELECT * FROM enrollment_appointments WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => enrollment_appointment_row($fetch->fetch() ?: [], true)]);
}

function enrollment_appointments_delete(): never
{
    api_require_manager();
    $pdo = api_pdo();
    enrollment_appointments_ensure($pdo);
    $body = api_read_json();
    $id = enrollment_require_id($body);

    $stmt = $pdo->prepare('SELECT proof_path, slot_id FROM enrollment_appointments WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();
    if (!$row) {
        api_json(['ok' => false, 'error' => 'Appointment not found.'], 404);
    }

    $slotId = (int) ($row['slot_id'] ?? 0);
    $delete = $pdo->prepare('DELETE FROM enrollment_appointments WHERE id = :id');
    $delete->execute(['id' => $id]);
    enrollment_refresh_batches_for_slot_ids($pdo, [$slotId]);

    enrollment_appointments_unlink_proof($row);

    api_json(['ok' => true]);
}
