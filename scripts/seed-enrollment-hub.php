<?php

declare(strict_types=1);

/**
 * Development sample data for Enrollment Hub.
 *
 * Usage:
 *   php scripts/seed-enrollment-hub.php
 *   php scripts/seed-enrollment-hub.php --reset
 *
 * Refuses production unless --force is passed.
 */

require_once dirname(__DIR__) . '/api/includes/bootstrap.php';
require_once dirname(__DIR__) . '/api/includes/enrollment.php';

$args = array_slice($argv, 1);
$reset = in_array('--reset', $args, true);
$force = in_array('--force', $args, true);

$env = api_detect_env();
if ($env === 'production' && !$force) {
    fwrite(STDERR, "Refusing to seed Enrollment Hub in production. Pass --force to override.\n");
    exit(1);
}

$pdo = api_pdo();

function seed_count(PDO $pdo, string $table): int
{
    return (int) $pdo->query("SELECT COUNT(*) FROM {$table}")->fetchColumn();
}

function seed_say(string $message): void
{
    echo $message . PHP_EOL;
}

// Ensure tables exist (same schema as API ensure helpers).
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

enrollment_ensure_column($pdo, 'enrollment_time_slots', 'capacity', 'capacity INT NOT NULL DEFAULT 40 AFTER description');
enrollment_ensure_column($pdo, 'enrollment_time_slots', 'batch_id', 'batch_id INT UNSIGNED NULL AFTER capacity');

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

enrollment_ensure_column($pdo, 'enrollment_offerings', 'capacity', 'capacity INT NOT NULL DEFAULT 40 AFTER availability');

if ($reset) {
    $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
    foreach ([
        'enrollment_schedule_days',
        'enrollment_batch_windows',
        'enrollment_appointment_batches',
        'enrollment_dates',
        'enrollment_time_slots',
        'enrollment_payment_channels',
        'enrollment_routing_steps',
        'enrollment_offerings',
    ] as $table) {
        $pdo->exec("TRUNCATE TABLE {$table}");
    }
    $pdo->exec(
        "UPDATE enrollment_routing_settings
         SET term_banner = '', sc_fee_label = '', year_levels_json = '[]'
         WHERE id = 1"
    );
    $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
    seed_say('Reset: truncated Enrollment Hub catalog tables.');
}

$ops = $pdo->query('SELECT id FROM enrollment_ops WHERE id = 1 LIMIT 1')->fetch();
if (!$ops) {
    $pdo->exec("INSERT INTO enrollment_ops (id, walk_in) VALUES (1, 'OPEN')");
}

$inserted = [];

if (seed_count($pdo, 'enrollment_schedule_days') === 0) {
    $stmt = $pdo->prepare(
        'INSERT INTO enrollment_schedule_days (date_label, group_label, day_label, muted, sort_order, is_published)
         VALUES (:date_label, :group_label, :day_label, :muted, :sort_order, 1)'
    );
    foreach ([
        ['Nov 25, 2026', '1st and 2nd Year Regular Enrollees', 'Day 1', 0, 10],
        ['Nov 26, 2026', '3rd and 4th Year Regular Enrollees', 'Day 2', 0, 20],
        ['Nov 27 & Dec 1–2', 'Irregular Enrollees (All Year Levels)', 'Days 3–5', 0, 30],
        ['Dec 3, 2026', 'Start of 2nd Semester Classes', 'Classes begin', 1, 40],
    ] as $row) {
        $stmt->execute([
            'date_label' => $row[0],
            'group_label' => $row[1],
            'day_label' => $row[2],
            'muted' => $row[3],
            'sort_order' => $row[4],
        ]);
    }
    $inserted[] = 'schedule_days';
}

if (seed_count($pdo, 'enrollment_batch_windows') === 0) {
    $stmt = $pdo->prepare(
        'INSERT INTO enrollment_batch_windows (label, time_label, detail, tone, sort_order, is_published)
         VALUES (:label, :time_label, :detail, :tone, :sort_order, 1)'
    );
    foreach ([
        ['Batch 1', '10:00 AM – 12:00 PM', 'Morning batch processing · Scheduled priority', 'active', 10],
        ['Lunch', '12:00 PM – 1:00 PM', 'Lunch break · Counters closed', 'pause', 20],
        ['Batch 2', '1:00 PM – 5:00 PM', 'Afternoon batch processing · Strict 5:00 PM cutoff', 'active', 30],
    ] as $row) {
        $stmt->execute([
            'label' => $row[0],
            'time_label' => $row[1],
            'detail' => $row[2],
            'tone' => $row[3],
            'sort_order' => $row[4],
        ]);
    }
    $inserted[] = 'batch_windows';
}

if (seed_count($pdo, 'enrollment_appointment_batches') === 0) {
    $stmt = $pdo->prepare(
        'INSERT INTO enrollment_appointment_batches
         (label, window_label, scheduled_count, status, sort_order, is_published)
         VALUES (:label, :window_label, 0, :status, :sort_order, 1)'
    );
    $stmt->execute([
        'label' => 'Morning Batch',
        'window_label' => '10:00 AM – 12:00 PM',
        'status' => 'Serving',
        'sort_order' => 10,
    ]);
    $stmt->execute([
        'label' => 'Afternoon Batch',
        'window_label' => '1:00 PM – 5:00 PM',
        'status' => 'Up next',
        'sort_order' => 20,
    ]);
    $inserted[] = 'appointment_batches';
}

$settings = $pdo->query('SELECT * FROM enrollment_routing_settings WHERE id = 1 LIMIT 1')->fetch() ?: null;
$yearsJson = json_encode([
    ['value' => '1L', 'label' => '1L (1st Year)', 'description' => 'First year Juris Doctor'],
    ['value' => '2L', 'label' => '2L (2nd Year)', 'description' => 'Second year Juris Doctor'],
    ['value' => '3L', 'label' => '3L (3rd Year)', 'description' => 'Third year Juris Doctor'],
    ['value' => '4L', 'label' => '4L (4th Year)', 'description' => 'Fourth year Juris Doctor'],
], JSON_UNESCAPED_UNICODE);

if (!$settings) {
    $stmt = $pdo->prepare(
        'INSERT INTO enrollment_routing_settings (id, term_banner, sc_fee_label, year_levels_json)
         VALUES (1, :term_banner, :sc_fee_label, :year_levels_json)'
    );
    $stmt->execute([
        'term_banner' => '2nd Semester, A.Y. 2026–2027 · Nov. 25 – Dec. 2, 2026',
        'sc_fee_label' => 'P300.00',
        'year_levels_json' => $yearsJson,
    ]);
    $inserted[] = 'routing_settings';
} elseif (
    trim((string) ($settings['term_banner'] ?? '')) === ''
    || trim((string) ($settings['sc_fee_label'] ?? '')) === ''
    || trim((string) ($settings['year_levels_json'] ?? '')) === ''
    || trim((string) ($settings['year_levels_json'] ?? '')) === '[]'
) {
    $stmt = $pdo->prepare(
        'UPDATE enrollment_routing_settings
         SET term_banner = :term_banner, sc_fee_label = :sc_fee_label, year_levels_json = :year_levels_json
         WHERE id = 1'
    );
    $stmt->execute([
        'term_banner' => '2nd Semester, A.Y. 2026–2027 · Nov. 25 – Dec. 2, 2026',
        'sc_fee_label' => 'P300.00',
        'year_levels_json' => $yearsJson,
    ]);
    $inserted[] = 'routing_settings';
}

if (seed_count($pdo, 'enrollment_dates') === 0) {
    $stmt = $pdo->prepare(
        'INSERT INTO enrollment_dates (value_date, label, description, sort_order, is_published)
         VALUES (:value_date, :label, :description, :sort_order, 1)'
    );
    foreach ([
        ['2026-11-25', 'Nov. 25, 2026', 'Regular 1L & 2L', 10],
        ['2026-11-26', 'Nov. 26, 2026', 'Regular 3L & 4L', 20],
        ['2026-11-27', 'Nov. 27, 2026', 'Irregular · all levels', 30],
        ['2026-12-01', 'Dec. 1, 2026', 'Irregular · all levels', 40],
        ['2026-12-02', 'Dec. 2, 2026', 'Irregular · all levels', 50],
    ] as $row) {
        $stmt->execute([
            'value_date' => $row[0],
            'label' => $row[1],
            'description' => $row[2],
            'sort_order' => $row[3],
        ]);
    }
    $inserted[] = 'dates';
}

$batchIds = $pdo->query(
    'SELECT id, label FROM enrollment_appointment_batches ORDER BY sort_order ASC, id ASC'
)->fetchAll();
$morningBatchId = isset($batchIds[0]['id']) ? (int) $batchIds[0]['id'] : null;
$afternoonBatchId = isset($batchIds[1]['id']) ? (int) $batchIds[1]['id'] : $morningBatchId;

if (seed_count($pdo, 'enrollment_time_slots') === 0) {
    $stmt = $pdo->prepare(
        'INSERT INTO enrollment_time_slots
         (value_label, description, capacity, batch_id, sort_order, is_published)
         VALUES (:value_label, :description, 40, :batch_id, :sort_order, 1)'
    );
    foreach ([
        ['10:00 AM – 11:00 AM', 'Morning window', $morningBatchId, 10],
        ['11:00 AM – 12:00 PM', 'Morning window', $morningBatchId, 20],
        ['1:00 PM – 2:00 PM', 'Afternoon window', $afternoonBatchId, 30],
        ['2:00 PM – 3:00 PM', 'Afternoon window', $afternoonBatchId, 40],
        ['3:00 PM – 4:00 PM', 'Afternoon window', $afternoonBatchId, 50],
        ['4:00 PM – 5:00 PM', 'Afternoon window', $afternoonBatchId, 60],
    ] as $row) {
        $stmt->execute([
            'value_label' => $row[0],
            'description' => $row[1],
            'batch_id' => $row[2],
            'sort_order' => $row[3],
        ]);
    }
    $inserted[] = 'time_slots';
}

if (seed_count($pdo, 'enrollment_payment_channels') === 0) {
    $stmt = $pdo->prepare(
        'INSERT INTO enrollment_payment_channels
         (channel_key, title, lines_json, copy_value, sort_order, is_published)
         VALUES (:channel_key, :title, :lines_json, :copy_value, :sort_order, 1)'
    );
    $stmt->execute([
        'channel_key' => 'ewallet',
        'title' => 'GCash / Maya',
        'lines_json' => json_encode(['PUP COL SC', '09XX XXX XXXX'], JSON_UNESCAPED_UNICODE),
        'copy_value' => '09XXXXXXXXX',
        'sort_order' => 10,
    ]);
    $stmt->execute([
        'channel_key' => 'bank',
        'title' => 'LandBank',
        'lines_json' => json_encode(['PUP COL SC, Inc.', '0000-0000-00'], JSON_UNESCAPED_UNICODE),
        'copy_value' => '0000-0000-00',
        'sort_order' => 20,
    ]);
    $inserted[] = 'payment_channels';
}

if (seed_count($pdo, 'enrollment_routing_steps') === 0) {
    $stmt = $pdo->prepare(
        'INSERT INTO enrollment_routing_steps
         (step_label, office_label, signature_note, sort_order, is_published)
         VALUES (:step_label, :office_label, :signature_note, :sort_order, 1)'
    );
    foreach ([
        ['1. COL Registrar Clearance', 'Office of the Registrar', null, 10],
        ['2. SC Contribution (P300.00)', 'SC Verification Desk', null, 20],
        ['3. Office of the Dean', "Dean’s Office", null, 30],
        [
            '4. Assessment, Payment & ORF',
            'PUPSIS & PUP Cashier',
            'This part is for enrollment guidelines only; do not submit to Cashier.',
            40,
        ],
    ] as $row) {
        $stmt->execute([
            'step_label' => $row[0],
            'office_label' => $row[1],
            'signature_note' => $row[2],
            'sort_order' => $row[3],
        ]);
    }
    $inserted[] = 'routing_steps';
}

if (seed_count($pdo, 'enrollment_offerings') === 0) {
    $stmt = $pdo->prepare(
        'INSERT INTO enrollment_offerings
         (code, title, section, year_level, units, days_json, start_hour, end_hour, time_label, schedule_label, availability, capacity, sort_order, is_published)
         VALUES
         (:code, :title, :section, :year_level, :units, :days_json, :start_hour, :end_hour, :time_label, :schedule_label, :availability, :capacity, :sort_order, 1)'
    );
    foreach ([
        ['LAW 102', 'Persons and Family Relations', 'JD 1-1D', '1', 3, '["Mon","Wed"]', 13, 15, 'Mon / Wed · 1:00–3:00 PM', 'Mon / Wed 1:00 PM – 3:00 PM', 'OPEN', 40, 10],
        ['LAW 104', 'Constitutional Law II', 'JD 1-1N', '1', 3, '["Tue","Thu"]', 18, 20, 'Tue / Thu · 6:00–8:00 PM', 'Tue / Thu 6:00 PM – 8:00 PM', 'OPEN', 40, 20],
        ['LAW 101', 'Introduction to Law', 'JD 1-2D', '1', 2, '["Mon","Wed"]', 9, 11, 'Mon / Wed · 9:00–11:00 AM', 'Mon / Wed 9:00 AM – 11:00 AM', 'OPEN', 40, 30],
        ['LAW 105', 'Criminal Law I', 'JD 1-2N', '1', 3, '["Fri"]', 18, 21, 'Fri · 6:00–9:00 PM', 'Fri 6:00 PM – 9:00 PM', 'OPEN', 40, 40],
        ['LAW 106', 'Legal Writing', 'JD 1-3N', '1', 2, '["Sat"]', 9, 12, 'Sat · 9:00 AM–12:00 NN', 'Sat 9:00 AM – 12:00 PM', 'OPEN', 40, 50],
        ['LAW 107', 'Statutory Construction', 'JD 1-4N', '1', 2, '["Sat"]', 13, 16, 'Sat · 1:00–4:00 PM', 'Sat 1:00 PM – 4:00 PM', 'OPEN', 40, 60],
        ['LAW 108', 'Philosophy of Law', 'JD 1-5N', '1', 2, '["Wed"]', 18, 20, 'Wed · 6:00–8:00 PM', 'Wed 6:00 PM – 8:00 PM', 'OPEN', 40, 70],
        ['LAW 109', 'Legal Research', 'JD 1-6N', '1', 2, '["Thu"]', 18, 20, 'Thu · 6:00–8:00 PM', 'Thu 6:00 PM – 8:00 PM', 'OPEN', 40, 80],
        ['LAW 201', 'Obligations and Contracts', 'JD 2-1', '2', 4, '["Mon","Wed"]', 15, 17.5, 'Mon / Wed · 3:00–5:30 PM', 'Mon / Wed 3:00 PM – 5:30 PM', 'FULL', 0, 90],
        ['LAW 204', 'Criminal Law II', 'JD 2-2', '2', 3, '["Fri"]', 18, 21, 'Fri · 6:00–9:00 PM', 'Fri 6:00 PM – 9:00 PM', 'OPEN', 40, 100],
        ['LAW 206', 'Labor Law II & Social Legislation', 'JD 2-3', '2', 3, '["Sat"]', 13, 16, 'Sat · 1:00–4:00 PM', 'Sat 1:00 PM – 4:00 PM', 'OPEN', 40, 110],
        ['LAW 208', 'Sales', 'JD 2-4', '2', 2, '["Tue","Thu"]', 15, 17, 'Tue / Thu · 3:00–5:00 PM', 'Tue / Thu 3:00 PM – 5:00 PM', 'OPEN', 40, 120],
        ['LAW 302', 'Civil Procedure', 'JD 3-1', '3', 3, '["Tue","Thu"]', 13, 15, 'Tue / Thu · 1:00–3:00 PM', 'Tue / Thu 1:00 PM – 3:00 PM', 'FULL', 0, 130],
        ['LAW 305', 'Corporation & Basic Securities Law', 'JD 3-2', '3', 3, '["Wed"]', 18, 21, 'Wed · 6:00–9:00 PM', 'Wed 6:00 PM – 9:00 PM', 'OPEN', 40, 140],
        ['LAW 308', 'Evidence', 'JD 3-3', '3', 3, '["Sat"]', 9, 12, 'Sat · 9:00 AM–12:00 NN', 'Sat 9:00 AM – 12:00 PM', 'FULL', 0, 150],
        ['LAW 401', 'Taxation Law Review II', 'JD 4-1', '4', 3, '["Mon","Thu"]', 18, 20, 'Mon / Thu · 6:00–8:00 PM', 'Mon / Thu 6:00 PM – 8:00 PM', 'OPEN', 40, 160],
        ['LAW 406', 'Legal Ethics & Practical Exercises', 'JD 4-2', '4', 3, '["Sat"]', 13, 17, 'Sat · 1:00–5:00 PM', 'Sat 1:00 PM – 5:00 PM', 'FULL', 0, 170],
        ['LAW 408', 'Practice Court II', 'JD 4-3', '4', 2, '["Sat"]', 8, 12, 'Sat · 8:00 AM–12:00 NN', 'Sat 8:00 AM – 12:00 PM', 'OPEN', 40, 180],
    ] as $row) {
        $stmt->execute([
            'code' => $row[0],
            'title' => $row[1],
            'section' => $row[2],
            'year_level' => $row[3],
            'units' => $row[4],
            'days_json' => $row[5],
            'start_hour' => $row[6],
            'end_hour' => $row[7],
            'time_label' => $row[8],
            'schedule_label' => $row[9],
            'availability' => $row[10],
            'capacity' => $row[11],
            'sort_order' => $row[12],
        ]);
    }
    $inserted[] = 'offerings';
}

foreach (array_filter([$morningBatchId, $afternoonBatchId]) as $batchId) {
    enrollment_refresh_batch_scheduled_count($pdo, (int) $batchId);
}

$summary = [
    'schedule_days' => seed_count($pdo, 'enrollment_schedule_days'),
    'batch_windows' => seed_count($pdo, 'enrollment_batch_windows'),
    'appointment_batches' => seed_count($pdo, 'enrollment_appointment_batches'),
    'dates' => seed_count($pdo, 'enrollment_dates'),
    'time_slots' => seed_count($pdo, 'enrollment_time_slots'),
    'payment_channels' => seed_count($pdo, 'enrollment_payment_channels'),
    'routing_steps' => seed_count($pdo, 'enrollment_routing_steps'),
    'offerings' => seed_count($pdo, 'enrollment_offerings'),
];

if ($inserted === []) {
    seed_say('Enrollment Hub already has data. Nothing inserted. Use --reset to wipe and reseed.');
} else {
    seed_say('Seeded: ' . implode(', ', $inserted));
}

seed_say('Counts: ' . json_encode($summary, JSON_UNESCAPED_UNICODE));
seed_say("Done ({$env}).");
