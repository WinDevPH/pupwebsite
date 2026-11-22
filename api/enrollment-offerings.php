<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/enrollment.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => enrollment_offerings_get(),
        'POST' => enrollment_offerings_create(),
        'PUT', 'PATCH' => enrollment_offerings_update(),
        'DELETE' => enrollment_offerings_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json_db_error($error);
}

/** Parse "1:00PM", "1:00 PM", "13:00" into 24h decimal hours. */
function enrollment_parse_clock_hour(string $token): ?float
{
    $cleaned = preg_replace('/\s+/', '', trim($token)) ?? '';
    if (!preg_match('/^(\d{1,2})(?::(\d{2}))?(AM|PM)?$/i', $cleaned, $match)) {
        return null;
    }
    $hour = (int) $match[1];
    if ($hour < 0 || $hour > 23) {
        return null;
    }
    $minutes = isset($match[2]) && $match[2] !== '' ? (int) $match[2] : 0;
    if ($minutes < 0 || $minutes > 59) {
        return null;
    }
    $meridiem = strtoupper((string) ($match[3] ?? ''));
    if ($meridiem === 'PM' && $hour < 12) {
        $hour += 12;
    }
    if ($meridiem === 'AM' && $hour === 12) {
        $hour = 0;
    }
    return $hour + ($minutes / 60);
}

function enrollment_offerings_ensure(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS enrollment_offerings (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          code VARCHAR(64) NOT NULL,
          title VARCHAR(255) NOT NULL,
          section VARCHAR(64) NOT NULL,
          year_level VARCHAR(8) NOT NULL DEFAULT '1',
          units DECIMAL(4,1) NOT NULL DEFAULT 0,
          days_json TEXT NOT NULL,
          start_hour DECIMAL(5,2) NOT NULL DEFAULT 0,
          end_hour DECIMAL(5,2) NOT NULL DEFAULT 0,
          time_label VARCHAR(160) NOT NULL DEFAULT '',
          schedule_label VARCHAR(160) NOT NULL DEFAULT '',
          availability VARCHAR(16) NOT NULL DEFAULT 'OPEN',
          capacity INT NOT NULL DEFAULT 40,
          sort_order INT NOT NULL DEFAULT 0,
          is_published TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_enroll_off_pub (is_published, sort_order, id),
          KEY idx_enroll_off_code (code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $hadCapacity = false;
    $capCheck = $pdo->prepare(
        'SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column'
    );
    $capCheck->execute(['table' => 'enrollment_offerings', 'column' => 'capacity']);
    $hadCapacity = (int) $capCheck->fetchColumn() > 0;

    enrollment_ensure_column(
        $pdo,
        'enrollment_offerings',
        'capacity',
        'capacity INT NOT NULL DEFAULT 40 AFTER availability'
    );

    if (!$hadCapacity) {
        // Preserve previously marked FULL offerings as capacity 0 after the column is added.
        $pdo->exec("UPDATE enrollment_offerings SET capacity = 0 WHERE UPPER(TRIM(availability)) = 'FULL'");
    }

    $ready = true;
}

function enrollment_offering_row(array $row, ?PDO $pdo = null): array
{
    $days = json_decode((string) ($row['days_json'] ?? '[]'), true);
    if (!is_array($days)) {
        $days = [];
    }
    $id = (int) $row['id'];
    $capacity = max(0, (int) ($row['capacity'] ?? 40));
    $taken = array_key_exists('taken_count', $row)
        ? (int) $row['taken_count']
        : ($pdo instanceof PDO ? enrollment_offering_taken_count($pdo, $id) : 0);
    $remaining = max(0, $capacity - $taken);
    $availability = $remaining <= 0 ? 'FULL' : 'OPEN';
    return [
        'id' => $id,
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
        'availability' => $availability,
        'capacity' => $capacity,
        'takenCount' => $taken,
        'remaining' => $remaining,
        'full' => $remaining <= 0,
        'sortOrder' => (int) ($row['sort_order'] ?? 0),
        'published' => (int) ($row['is_published'] ?? 0) === 1,
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}

function enrollment_offerings_payload(array $body): array
{
    $code = trim((string) ($body['code'] ?? ''));
    $title = trim((string) ($body['title'] ?? ''));
    $section = trim((string) ($body['section'] ?? ''));
    $year = trim((string) ($body['year'] ?? $body['year_level'] ?? '1'));
    $units = (float) ($body['units'] ?? 0);
    $days = $body['days'] ?? [];
    if (!is_array($days)) {
        $days = [];
    }
    $days = array_values(array_filter(array_map('strval', $days)));
    $start = (float) ($body['startHour'] ?? $body['start_hour'] ?? 0);
    $end = (float) ($body['endHour'] ?? $body['end_hour'] ?? 0);
    $timeLabel = trim((string) ($body['timeLabel'] ?? $body['time_label'] ?? ''));
    $scheduleLabel = trim((string) ($body['scheduleLabel'] ?? $body['schedule_label'] ?? $timeLabel));
    // Recover 24h hours from labels like "1:00PM-5:30PM" when start/end are missing or invalid.
    if (!($end > $start) && $timeLabel !== '') {
        $normalized = preg_replace('/[–—−]/u', '-', $timeLabel) ?? $timeLabel;
        $parts = preg_split('/\s*-\s*/', $normalized) ?: [];
        if (count($parts) >= 2) {
            $parsedStart = enrollment_parse_clock_hour($parts[0]);
            $parsedEnd = enrollment_parse_clock_hour($parts[1]);
            if ($parsedStart !== null && $parsedEnd !== null && $parsedEnd > $parsedStart) {
                $start = $parsedStart;
                $end = $parsedEnd;
            }
        }
    }
    $capacity = max(0, (int) ($body['capacity'] ?? 40));
    // Availability is derived from seats/capacity; keep column for compatibility.
    $availability = $capacity <= 0 ? 'FULL' : 'OPEN';

    if ($code === '' || $title === '' || $section === '') {
        api_json(['ok' => false, 'error' => 'Code, title, and section are required.'], 422);
    }
    if (!in_array($year, ['1', '2', '3', '4'], true)) {
        $year = '1';
    }

    return [
        'code' => $code,
        'title' => $title,
        'section' => $section,
        'year_level' => $year,
        'units' => $units,
        'days_json' => json_encode($days, JSON_UNESCAPED_UNICODE),
        'start_hour' => $start,
        'end_hour' => $end,
        'time_label' => $timeLabel,
        'schedule_label' => $scheduleLabel,
        'availability' => $availability,
        'capacity' => $capacity,
        'sort_order' => enrollment_sort_order($body),
        'is_published' => enrollment_bool_published($body),
    ];
}

function enrollment_offerings_get(): never
{
    $pdo = api_pdo();
    enrollment_offerings_ensure($pdo);
    $includeAll = (string) ($_GET['all'] ?? '') === '1';
    $id = (int) ($_GET['id'] ?? 0);

    if ($id > 0) {
        $stmt = $pdo->prepare('SELECT * FROM enrollment_offerings WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Offering not found.'], 404);
        }
        if ((int) $row['is_published'] !== 1) {
            api_require_manager();
        }
        api_json(['ok' => true, 'item' => enrollment_offering_row($row, $pdo)]);
    }

    if ($includeAll) {
        api_require_manager();
        $stmt = $pdo->query('SELECT * FROM enrollment_offerings ORDER BY sort_order ASC, id ASC');
    } else {
        $stmt = $pdo->query(
            'SELECT * FROM enrollment_offerings WHERE is_published = 1 ORDER BY sort_order ASC, id ASC'
        );
    }
    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $items[] = enrollment_offering_row($row, $pdo);
    }
    api_json(['ok' => true, 'items' => $items]);
}

function enrollment_offerings_create(): never
{
    api_require_manager();
    $pdo = api_pdo();
    enrollment_offerings_ensure($pdo);
    $data = enrollment_offerings_payload(api_read_json());
    $stmt = $pdo->prepare(
        'INSERT INTO enrollment_offerings
         (code, title, section, year_level, units, days_json, start_hour, end_hour, time_label, schedule_label, availability, capacity, sort_order, is_published)
         VALUES
         (:code, :title, :section, :year_level, :units, :days_json, :start_hour, :end_hour, :time_label, :schedule_label, :availability, :capacity, :sort_order, :is_published)'
    );
    $stmt->execute($data);
    $id = (int) $pdo->lastInsertId();
    enrollment_recompute_offering_availability($pdo, $id);
    $fetch = $pdo->prepare('SELECT * FROM enrollment_offerings WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => enrollment_offering_row($fetch->fetch() ?: [], $pdo)], 201);
}

function enrollment_offerings_update(): never
{
    api_require_manager();
    $pdo = api_pdo();
    enrollment_offerings_ensure($pdo);
    $body = api_read_json();
    $id = enrollment_require_id($body);
    $existing = $pdo->prepare('SELECT id FROM enrollment_offerings WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    if (!$existing->fetch()) {
        api_json(['ok' => false, 'error' => 'Offering not found.'], 404);
    }
    $data = enrollment_offerings_payload($body);
    $data['id'] = $id;
    $stmt = $pdo->prepare(
        'UPDATE enrollment_offerings
         SET code = :code, title = :title, section = :section, year_level = :year_level, units = :units,
             days_json = :days_json, start_hour = :start_hour, end_hour = :end_hour,
             time_label = :time_label, schedule_label = :schedule_label, availability = :availability,
             capacity = :capacity, sort_order = :sort_order, is_published = :is_published
         WHERE id = :id'
    );
    $stmt->execute($data);
    enrollment_recompute_offering_availability($pdo, $id);
    $fetch = $pdo->prepare('SELECT * FROM enrollment_offerings WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => enrollment_offering_row($fetch->fetch() ?: [], $pdo)]);
}

function enrollment_offerings_delete(): never
{
    api_require_manager();
    $pdo = api_pdo();
    enrollment_offerings_ensure($pdo);
    $body = api_read_json();
    $id = enrollment_require_id($body);
    $stmt = $pdo->prepare('DELETE FROM enrollment_offerings WHERE id = :id');
    $stmt->execute(['id' => $id]);
    if ($stmt->rowCount() < 1) {
        api_json(['ok' => false, 'error' => 'Offering not found.'], 404);
    }
    api_json(['ok' => true]);
}
