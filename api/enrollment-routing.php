<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/enrollment.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => enrollment_routing_get(),
        'POST' => enrollment_routing_create(),
        'PUT', 'PATCH' => enrollment_routing_update(),
        'DELETE' => enrollment_routing_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json_db_error($error);
}

function enrollment_routing_ensure(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS enrollment_routing_settings (
          id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
          term_banner VARCHAR(255) NOT NULL DEFAULT '',
          sc_fee_label VARCHAR(120) NOT NULL DEFAULT 'P300.00',
          year_levels_json TEXT NOT NULL,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS enrollment_dates (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          value_date VARCHAR(32) NOT NULL,
          label VARCHAR(120) NOT NULL,
          description VARCHAR(255) NOT NULL DEFAULT '',
          sort_order INT NOT NULL DEFAULT 0,
          is_published TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS enrollment_time_slots (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          value_label VARCHAR(120) NOT NULL,
          description VARCHAR(255) NOT NULL DEFAULT '',
          capacity INT NOT NULL DEFAULT 40,
          batch_id INT UNSIGNED NULL,
          sort_order INT NOT NULL DEFAULT 0,
          is_published TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    enrollment_ensure_column(
        $pdo,
        'enrollment_time_slots',
        'capacity',
        'capacity INT NOT NULL DEFAULT 40 AFTER description'
    );
    enrollment_ensure_column(
        $pdo,
        'enrollment_time_slots',
        'batch_id',
        'batch_id INT UNSIGNED NULL AFTER capacity'
    );

    // One-time: if slots have no batch links and appointment batches exist, map by window keywords.
    $unlinked = (int) $pdo->query(
        'SELECT COUNT(*) FROM enrollment_time_slots WHERE batch_id IS NULL OR batch_id = 0'
    )->fetchColumn();
    $linked = (int) $pdo->query(
        'SELECT COUNT(*) FROM enrollment_time_slots WHERE batch_id IS NOT NULL AND batch_id > 0'
    )->fetchColumn();
    if ($unlinked > 0 && $linked === 0) {
        $batchRows = $pdo->query(
            'SELECT id, window_label, label FROM enrollment_appointment_batches ORDER BY sort_order ASC, id ASC'
        )->fetchAll();
        if (count($batchRows) >= 1) {
            $morningId = (int) $batchRows[0]['id'];
            $afternoonId = (int) ($batchRows[1]['id'] ?? $batchRows[0]['id']);
            foreach ($batchRows as $batch) {
                $hay = strtolower((string) ($batch['window_label'] ?? '') . ' ' . (string) ($batch['label'] ?? ''));
                if (str_contains($hay, 'morning') || str_contains($hay, '10:00') || str_contains($hay, 'am')) {
                    $morningId = (int) $batch['id'];
                }
                if (str_contains($hay, 'afternoon') || str_contains($hay, '1:00') || str_contains($hay, 'pm')) {
                    $afternoonId = (int) $batch['id'];
                }
            }
            $slots = $pdo->query('SELECT id, value_label FROM enrollment_time_slots')->fetchAll();
            $upd = $pdo->prepare('UPDATE enrollment_time_slots SET batch_id = :batch_id WHERE id = :id');
            foreach ($slots as $slot) {
                $label = strtolower((string) ($slot['value_label'] ?? ''));
                $isMorning = str_contains($label, '10') || str_contains($label, '11') || str_contains($label, '12:00')
                    || str_contains($label, 'am');
                $upd->execute([
                    'batch_id' => $isMorning ? $morningId : $afternoonId,
                    'id' => (int) $slot['id'],
                ]);
            }
            foreach ([$morningId, $afternoonId] as $batchId) {
                enrollment_refresh_batch_scheduled_count($pdo, $batchId);
            }
        }
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS enrollment_payment_channels (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          channel_key VARCHAR(64) NOT NULL,
          title VARCHAR(160) NOT NULL,
          lines_json TEXT NOT NULL,
          copy_value VARCHAR(160) NOT NULL DEFAULT '',
          sort_order INT NOT NULL DEFAULT 0,
          is_published TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS enrollment_routing_steps (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          step_label VARCHAR(255) NOT NULL,
          office_label VARCHAR(255) NOT NULL,
          signature_note TEXT NULL,
          sort_order INT NOT NULL DEFAULT 0,
          is_published TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    // Blank settings row only — no catalog seed. Officers publish dates/slots/steps via Admin.
    $settings = $pdo->query('SELECT id FROM enrollment_routing_settings WHERE id = 1 LIMIT 1')->fetch();
    if (!$settings) {
        $pdo->exec(
            "INSERT INTO enrollment_routing_settings (id, term_banner, sc_fee_label, year_levels_json)
             VALUES (1, '', '', '[]')"
        );
    }

    $ready = true;
}

function enrollment_routing_resource(array $body = []): string
{
    $resource = strtolower(trim((string) ($body['resource'] ?? $_GET['resource'] ?? 'bundle')));
    $allowed = ['bundle', 'settings', 'dates', 'slots', 'channels', 'steps'];
    return in_array($resource, $allowed, true) ? $resource : 'bundle';
}

function enrollment_date_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'value' => (string) $row['value_date'],
        'label' => (string) $row['label'],
        'description' => (string) $row['description'],
        'sortOrder' => (int) $row['sort_order'],
        'published' => (int) $row['is_published'] === 1,
    ];
}

function enrollment_slot_row(array $row, ?PDO $pdo = null): array
{
    $id = (int) $row['id'];
    $capacity = max(0, (int) ($row['capacity'] ?? 40));
    $batchId = isset($row['batch_id']) && $row['batch_id'] !== null && (int) $row['batch_id'] > 0
        ? (int) $row['batch_id']
        : null;
    $booked = 0;
    if ($pdo instanceof PDO) {
        $booked = enrollment_slot_booked_count($pdo, $id);
    } elseif (array_key_exists('booked_count', $row)) {
        $booked = (int) $row['booked_count'];
    }
    $remaining = max(0, $capacity - $booked);
    return [
        'id' => $id,
        'value' => (string) $row['value_label'],
        'label' => (string) $row['value_label'],
        'description' => (string) $row['description'],
        'capacity' => $capacity,
        'batchId' => $batchId,
        'bookedCount' => $booked,
        'remaining' => $remaining,
        'full' => $remaining <= 0,
        'sortOrder' => (int) $row['sort_order'],
        'published' => (int) $row['is_published'] === 1,
    ];
}

function enrollment_slot_rows(PDO $pdo, array $rows): array
{
    return array_map(static fn (array $row) => enrollment_slot_row($row, $pdo), $rows);
}

function enrollment_channel_row(array $row): array
{
    $lines = json_decode((string) $row['lines_json'], true);
    if (!is_array($lines)) {
        $lines = [];
    }
    return [
        'id' => (int) $row['id'],
        'key' => (string) $row['channel_key'],
        'title' => (string) $row['title'],
        'lines' => array_values($lines),
        'copyValue' => (string) $row['copy_value'],
        'sortOrder' => (int) $row['sort_order'],
        'published' => (int) $row['is_published'] === 1,
    ];
}

function enrollment_step_row(array $row): array
{
    $note = $row['signature_note'] ?? null;
    return [
        'id' => (int) $row['id'],
        'step' => (string) $row['step_label'],
        'office' => (string) $row['office_label'],
        'signatureNote' => $note !== null && $note !== '' ? (string) $note : null,
        'sortOrder' => (int) $row['sort_order'],
        'published' => (int) $row['is_published'] === 1,
    ];
}

function enrollment_settings_row(array $row): array
{
    $years = json_decode((string) ($row['year_levels_json'] ?? '[]'), true);
    if (!is_array($years)) {
        $years = [];
    }
    return [
        'termBanner' => (string) $row['term_banner'],
        'scFeeLabel' => (string) $row['sc_fee_label'],
        'yearLevels' => $years,
        'updatedAt' => isset($row['updated_at']) ? api_iso((string) $row['updated_at']) : null,
    ];
}

function enrollment_routing_list(PDO $pdo, string $table, bool $all): array
{
    if ($all) {
        $stmt = $pdo->query("SELECT * FROM {$table} ORDER BY sort_order ASC, id ASC");
    } else {
        $stmt = $pdo->query("SELECT * FROM {$table} WHERE is_published = 1 ORDER BY sort_order ASC, id ASC");
    }
    return $stmt ? $stmt->fetchAll() : [];
}

function enrollment_routing_get(): never
{
    $pdo = api_pdo();
    enrollment_routing_ensure($pdo);
    $resource = enrollment_routing_resource();
    $includeAll = (string) ($_GET['all'] ?? '') === '1';
    $id = (int) ($_GET['id'] ?? 0);

    if ($includeAll) {
        api_require_manager();
    }

    if ($resource === 'settings' || $resource === 'bundle') {
        $settings = $pdo->query('SELECT * FROM enrollment_routing_settings WHERE id = 1 LIMIT 1')->fetch() ?: [];
        if ($resource === 'settings') {
            api_json(['ok' => true, 'settings' => enrollment_settings_row($settings)]);
        }
        api_json([
            'ok' => true,
            'settings' => enrollment_settings_row($settings),
            'dates' => array_map('enrollment_date_row', enrollment_routing_list($pdo, 'enrollment_dates', $includeAll)),
            'slots' => enrollment_slot_rows($pdo, enrollment_routing_list($pdo, 'enrollment_time_slots', $includeAll)),
            'channels' => array_map('enrollment_channel_row', enrollment_routing_list($pdo, 'enrollment_payment_channels', $includeAll)),
            'steps' => array_map('enrollment_step_row', enrollment_routing_list($pdo, 'enrollment_routing_steps', $includeAll)),
        ]);
    }

    $map = [
        'dates' => ['enrollment_dates', 'date', 'Date'],
        'slots' => ['enrollment_time_slots', 'slot', 'Time slot'],
        'channels' => ['enrollment_payment_channels', 'channel', 'Payment channel'],
        'steps' => ['enrollment_routing_steps', 'step', 'Routing step'],
    ];
    [$table, $kind, $label] = $map[$resource];

    if ($id > 0) {
        $stmt = $pdo->prepare("SELECT * FROM {$table} WHERE id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => "{$label} not found."], 404);
        }
        if ((int) $row['is_published'] !== 1) {
            api_require_manager();
        }
        $item = match ($kind) {
            'date' => enrollment_date_row($row),
            'slot' => enrollment_slot_row($row, $pdo),
            'channel' => enrollment_channel_row($row),
            default => enrollment_step_row($row),
        };
        api_json(['ok' => true, 'item' => $item]);
    }

    $items = [];
    foreach (enrollment_routing_list($pdo, $table, $includeAll) as $row) {
        $items[] = match ($kind) {
            'date' => enrollment_date_row($row),
            'slot' => enrollment_slot_row($row, $pdo),
            'channel' => enrollment_channel_row($row),
            default => enrollment_step_row($row),
        };
    }
    api_json(['ok' => true, 'items' => $items]);
}

function enrollment_routing_create(): never
{
    api_require_manager();
    $pdo = api_pdo();
    enrollment_routing_ensure($pdo);
    $body = api_read_json();
    $resource = enrollment_routing_resource($body);

    if ($resource === 'settings') {
        enrollment_routing_save_settings($pdo, $body);
    }

    if ($resource === 'dates') {
        $value = trim((string) ($body['value'] ?? $body['value_date'] ?? ''));
        $label = trim((string) ($body['label'] ?? ''));
        $description = trim((string) ($body['description'] ?? ''));
        if ($value === '' || $label === '') {
            api_json(['ok' => false, 'error' => 'Value and label are required.'], 422);
        }
        $stmt = $pdo->prepare(
            'INSERT INTO enrollment_dates (value_date, label, description, sort_order, is_published)
             VALUES (:value_date, :label, :description, :sort_order, :is_published)'
        );
        $stmt->execute([
            'value_date' => $value,
            'label' => $label,
            'description' => $description,
            'sort_order' => enrollment_sort_order($body),
            'is_published' => enrollment_bool_published($body),
        ]);
        $id = (int) $pdo->lastInsertId();
        $fetch = $pdo->prepare('SELECT * FROM enrollment_dates WHERE id = :id LIMIT 1');
        $fetch->execute(['id' => $id]);
        api_json(['ok' => true, 'item' => enrollment_date_row($fetch->fetch() ?: [])], 201);
    }

    if ($resource === 'slots') {
        $value = trim((string) ($body['value'] ?? $body['label'] ?? $body['value_label'] ?? ''));
        $description = trim((string) ($body['description'] ?? ''));
        $capacity = max(0, (int) ($body['capacity'] ?? 40));
        $batchId = (int) ($body['batchId'] ?? $body['batch_id'] ?? 0);
        if ($value === '') {
            api_json(['ok' => false, 'error' => 'Slot label is required.'], 422);
        }
        $stmt = $pdo->prepare(
            'INSERT INTO enrollment_time_slots (value_label, description, capacity, batch_id, sort_order, is_published)
             VALUES (:value_label, :description, :capacity, :batch_id, :sort_order, :is_published)'
        );
        $stmt->execute([
            'value_label' => $value,
            'description' => $description,
            'capacity' => $capacity,
            'batch_id' => $batchId > 0 ? $batchId : null,
            'sort_order' => enrollment_sort_order($body),
            'is_published' => enrollment_bool_published($body),
        ]);
        $id = (int) $pdo->lastInsertId();
        $fetch = $pdo->prepare('SELECT * FROM enrollment_time_slots WHERE id = :id LIMIT 1');
        $fetch->execute(['id' => $id]);
        api_json(['ok' => true, 'item' => enrollment_slot_row($fetch->fetch() ?: [], $pdo)], 201);
    }

    if ($resource === 'channels') {
        $key = trim((string) ($body['key'] ?? $body['channel_key'] ?? ''));
        $title = trim((string) ($body['title'] ?? ''));
        $lines = $body['lines'] ?? [];
        if (!is_array($lines)) {
            $lines = [];
        }
        $copy = trim((string) ($body['copyValue'] ?? $body['copy_value'] ?? ''));
        if ($key === '' || $title === '') {
            api_json(['ok' => false, 'error' => 'Key and title are required.'], 422);
        }
        $stmt = $pdo->prepare(
            'INSERT INTO enrollment_payment_channels (channel_key, title, lines_json, copy_value, sort_order, is_published)
             VALUES (:channel_key, :title, :lines_json, :copy_value, :sort_order, :is_published)'
        );
        $stmt->execute([
            'channel_key' => $key,
            'title' => $title,
            'lines_json' => json_encode(array_values($lines), JSON_UNESCAPED_UNICODE),
            'copy_value' => $copy,
            'sort_order' => enrollment_sort_order($body),
            'is_published' => enrollment_bool_published($body),
        ]);
        $id = (int) $pdo->lastInsertId();
        $fetch = $pdo->prepare('SELECT * FROM enrollment_payment_channels WHERE id = :id LIMIT 1');
        $fetch->execute(['id' => $id]);
        api_json(['ok' => true, 'item' => enrollment_channel_row($fetch->fetch() ?: [])], 201);
    }

    if ($resource === 'steps') {
        $step = trim((string) ($body['step'] ?? $body['step_label'] ?? ''));
        $office = trim((string) ($body['office'] ?? $body['office_label'] ?? ''));
        $note = trim((string) ($body['signatureNote'] ?? $body['signature_note'] ?? ''));
        if ($step === '' || $office === '') {
            api_json(['ok' => false, 'error' => 'Step and office are required.'], 422);
        }
        $stmt = $pdo->prepare(
            'INSERT INTO enrollment_routing_steps (step_label, office_label, signature_note, sort_order, is_published)
             VALUES (:step_label, :office_label, :signature_note, :sort_order, :is_published)'
        );
        $stmt->execute([
            'step_label' => $step,
            'office_label' => $office,
            'signature_note' => $note !== '' ? $note : null,
            'sort_order' => enrollment_sort_order($body),
            'is_published' => enrollment_bool_published($body),
        ]);
        $id = (int) $pdo->lastInsertId();
        $fetch = $pdo->prepare('SELECT * FROM enrollment_routing_steps WHERE id = :id LIMIT 1');
        $fetch->execute(['id' => $id]);
        api_json(['ok' => true, 'item' => enrollment_step_row($fetch->fetch() ?: [])], 201);
    }

    api_json(['ok' => false, 'error' => 'Unknown resource.'], 422);
}

function enrollment_routing_save_settings(PDO $pdo, array $body): never
{
    $term = trim((string) ($body['termBanner'] ?? $body['term_banner'] ?? ''));
    $fee = trim((string) ($body['scFeeLabel'] ?? $body['sc_fee_label'] ?? ''));
    $years = $body['yearLevels'] ?? $body['year_levels'] ?? null;
    if (!is_array($years)) {
        $existing = $pdo->query('SELECT year_levels_json FROM enrollment_routing_settings WHERE id = 1 LIMIT 1')->fetch();
        $years = json_decode((string) ($existing['year_levels_json'] ?? '[]'), true);
        if (!is_array($years)) {
            $years = [];
        }
    }
    $yearsJson = json_encode($years, JSON_UNESCAPED_UNICODE);
    $exists = $pdo->query('SELECT id FROM enrollment_routing_settings WHERE id = 1 LIMIT 1')->fetch();
    if ($exists) {
        $stmt = $pdo->prepare(
            'UPDATE enrollment_routing_settings
             SET term_banner = :term_banner, sc_fee_label = :sc_fee_label, year_levels_json = :year_levels_json
             WHERE id = 1'
        );
    } else {
        $stmt = $pdo->prepare(
            'INSERT INTO enrollment_routing_settings (id, term_banner, sc_fee_label, year_levels_json)
             VALUES (1, :term_banner, :sc_fee_label, :year_levels_json)'
        );
    }
    $stmt->execute([
        'term_banner' => $term,
        'sc_fee_label' => $fee,
        'year_levels_json' => $yearsJson,
    ]);
    $fetch = $pdo->query('SELECT * FROM enrollment_routing_settings WHERE id = 1 LIMIT 1')->fetch() ?: [];
    api_json(['ok' => true, 'settings' => enrollment_settings_row($fetch)]);
}

function enrollment_routing_update(): never
{
    api_require_manager();
    $pdo = api_pdo();
    enrollment_routing_ensure($pdo);
    $body = api_read_json();
    $resource = enrollment_routing_resource($body);

    if ($resource === 'settings') {
        enrollment_routing_save_settings($pdo, $body);
    }

    $id = enrollment_require_id($body);

    if ($resource === 'dates') {
        $value = trim((string) ($body['value'] ?? $body['value_date'] ?? ''));
        $label = trim((string) ($body['label'] ?? ''));
        $description = trim((string) ($body['description'] ?? ''));
        if ($value === '' || $label === '') {
            api_json(['ok' => false, 'error' => 'Value and label are required.'], 422);
        }
        $stmt = $pdo->prepare(
            'UPDATE enrollment_dates
             SET value_date = :value_date, label = :label, description = :description,
                 sort_order = :sort_order, is_published = :is_published
             WHERE id = :id'
        );
        $stmt->execute([
            'id' => $id,
            'value_date' => $value,
            'label' => $label,
            'description' => $description,
            'sort_order' => enrollment_sort_order($body),
            'is_published' => enrollment_bool_published($body),
        ]);
        $fetch = $pdo->prepare('SELECT * FROM enrollment_dates WHERE id = :id LIMIT 1');
        $fetch->execute(['id' => $id]);
        api_json(['ok' => true, 'item' => enrollment_date_row($fetch->fetch() ?: [])]);
    }

    if ($resource === 'slots') {
        $value = trim((string) ($body['value'] ?? $body['label'] ?? $body['value_label'] ?? ''));
        $description = trim((string) ($body['description'] ?? ''));
        $capacity = max(0, (int) ($body['capacity'] ?? 40));
        $batchId = (int) ($body['batchId'] ?? $body['batch_id'] ?? 0);
        if ($value === '') {
            api_json(['ok' => false, 'error' => 'Slot label is required.'], 422);
        }
        $stmt = $pdo->prepare(
            'UPDATE enrollment_time_slots
             SET value_label = :value_label, description = :description,
                 capacity = :capacity, batch_id = :batch_id,
                 sort_order = :sort_order, is_published = :is_published
             WHERE id = :id'
        );
        $stmt->execute([
            'id' => $id,
            'value_label' => $value,
            'description' => $description,
            'capacity' => $capacity,
            'batch_id' => $batchId > 0 ? $batchId : null,
            'sort_order' => enrollment_sort_order($body),
            'is_published' => enrollment_bool_published($body),
        ]);
        if ($batchId > 0) {
            enrollment_refresh_batch_scheduled_count($pdo, $batchId);
        }
        $fetch = $pdo->prepare('SELECT * FROM enrollment_time_slots WHERE id = :id LIMIT 1');
        $fetch->execute(['id' => $id]);
        api_json(['ok' => true, 'item' => enrollment_slot_row($fetch->fetch() ?: [], $pdo)]);
    }

    if ($resource === 'channels') {
        $key = trim((string) ($body['key'] ?? $body['channel_key'] ?? ''));
        $title = trim((string) ($body['title'] ?? ''));
        $lines = $body['lines'] ?? [];
        if (!is_array($lines)) {
            $lines = [];
        }
        $copy = trim((string) ($body['copyValue'] ?? $body['copy_value'] ?? ''));
        if ($key === '' || $title === '') {
            api_json(['ok' => false, 'error' => 'Key and title are required.'], 422);
        }
        $stmt = $pdo->prepare(
            'UPDATE enrollment_payment_channels
             SET channel_key = :channel_key, title = :title, lines_json = :lines_json, copy_value = :copy_value,
                 sort_order = :sort_order, is_published = :is_published
             WHERE id = :id'
        );
        $stmt->execute([
            'id' => $id,
            'channel_key' => $key,
            'title' => $title,
            'lines_json' => json_encode(array_values($lines), JSON_UNESCAPED_UNICODE),
            'copy_value' => $copy,
            'sort_order' => enrollment_sort_order($body),
            'is_published' => enrollment_bool_published($body),
        ]);
        $fetch = $pdo->prepare('SELECT * FROM enrollment_payment_channels WHERE id = :id LIMIT 1');
        $fetch->execute(['id' => $id]);
        api_json(['ok' => true, 'item' => enrollment_channel_row($fetch->fetch() ?: [])]);
    }

    if ($resource === 'steps') {
        $step = trim((string) ($body['step'] ?? $body['step_label'] ?? ''));
        $office = trim((string) ($body['office'] ?? $body['office_label'] ?? ''));
        $note = trim((string) ($body['signatureNote'] ?? $body['signature_note'] ?? ''));
        if ($step === '' || $office === '') {
            api_json(['ok' => false, 'error' => 'Step and office are required.'], 422);
        }
        $stmt = $pdo->prepare(
            'UPDATE enrollment_routing_steps
             SET step_label = :step_label, office_label = :office_label, signature_note = :signature_note,
                 sort_order = :sort_order, is_published = :is_published
             WHERE id = :id'
        );
        $stmt->execute([
            'id' => $id,
            'step_label' => $step,
            'office_label' => $office,
            'signature_note' => $note !== '' ? $note : null,
            'sort_order' => enrollment_sort_order($body),
            'is_published' => enrollment_bool_published($body),
        ]);
        $fetch = $pdo->prepare('SELECT * FROM enrollment_routing_steps WHERE id = :id LIMIT 1');
        $fetch->execute(['id' => $id]);
        api_json(['ok' => true, 'item' => enrollment_step_row($fetch->fetch() ?: [])]);
    }

    api_json(['ok' => false, 'error' => 'Unknown resource.'], 422);
}

function enrollment_routing_delete(): never
{
    api_require_manager();
    $pdo = api_pdo();
    enrollment_routing_ensure($pdo);
    $body = api_read_json();
    $id = enrollment_require_id($body);
    $resource = enrollment_routing_resource($body);
    $tables = [
        'dates' => 'enrollment_dates',
        'slots' => 'enrollment_time_slots',
        'channels' => 'enrollment_payment_channels',
        'steps' => 'enrollment_routing_steps',
    ];
    if (!isset($tables[$resource])) {
        api_json(['ok' => false, 'error' => 'Unknown resource.'], 422);
    }
    $stmt = $pdo->prepare('DELETE FROM ' . $tables[$resource] . ' WHERE id = :id');
    $stmt->execute(['id' => $id]);
    if ($stmt->rowCount() < 1) {
        api_json(['ok' => false, 'error' => 'Record not found.'], 404);
    }
    api_json(['ok' => true]);
}
