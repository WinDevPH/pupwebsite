<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => site_settings_get(),
        'PUT', 'PATCH' => site_settings_put(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json_db_error($error);
}

function site_settings_ensure_tables(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS site_settings (
          setting_key VARCHAR(64) NOT NULL,
          payload_json LONGTEXT NOT NULL,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (setting_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $ready = true;
}

function site_settings_contact_defaults(): array
{
    return [
        'email' => 'studentcouncil@pupcolsc.com',
        'office' => 'PUP College of Law Student Council Office',
        'address' => 'PUP Main Campus, College of Law, Anonas St., Sta. Mesa, Manila 1016.',
        'secRegistration' => 'SEC Reg. No. 2022030045051-05',
        'hours' => 'Mon–Sat, 9:00 AM–6:00 PM',
        'socials' => [
            [
                'name' => 'Facebook',
                'handle' => '/pupcl.sc',
                'href' => 'https://www.facebook.com/pupcl.sc',
            ],
            ['name' => 'X', 'handle' => '@pupcolsc', 'href' => 'https://x.com/pupcolsc'],
            [
                'name' => 'Instagram',
                'handle' => '@pupcolsc_official',
                'href' => 'https://www.instagram.com/pupcolsc_official/',
            ],
        ],
        'footerSocials' => [
            [
                'name' => 'Instagram',
                'handle' => '@pupcolsc_official',
                'href' => 'https://www.instagram.com/pupcolsc_official/',
            ],
            [
                'name' => 'Facebook',
                'handle' => '/pupcl.sc',
                'href' => 'https://www.facebook.com/pupcl.sc',
            ],
            ['name' => 'X', 'handle' => '@pupcolsc', 'href' => 'https://x.com/pupcolsc'],
        ],
        'studentHandbookUrl' =>
            'https://drive.google.com/file/d/1neq3kippfsVWgFeWYepQWOx04X4TaUlE/view?usp=sharing',
        'grievanceFormUrl' =>
            'https://docs.google.com/forms/d/e/1FAIpQLSdRdEa0MJPgriEsmIOKDi9Q70B25wnR3Ll_sjUT0O2rPiRjQg/viewform',
        'grievanceGuidelinesUrl' =>
            'https://drive.google.com/drive/folders/1_A1TJ_jdZXQhWOd5qd4nJmVw8Jr5scMk?usp=sharing',
    ];
}

function site_settings_normalize_key(string $key): string
{
    $key = strtolower(trim($key));
    return $key === 'contact' ? 'contact' : '';
}

/**
 * @return list<array{name: string, handle: string, href: string}>
 */
function site_settings_parse_socials(mixed $raw): array
{
    if (!is_array($raw)) {
        return [];
    }
    $items = [];
    foreach ($raw as $row) {
        if (!is_array($row)) {
            continue;
        }
        $name = trim((string) ($row['name'] ?? ''));
        $handle = trim((string) ($row['handle'] ?? ''));
        $href = trim((string) ($row['href'] ?? ''));
        if ($name === '' || $href === '') {
            continue;
        }
        if (!preg_match('#^https?://#i', $href)) {
            api_json(['ok' => false, 'error' => 'Social links must be http(s) URLs.'], 422);
        }
        $items[] = [
            'name' => $name,
            'handle' => $handle,
            'href' => $href,
        ];
    }
    return $items;
}

function site_settings_validate_contact(array $payload): array
{
    $email = trim((string) ($payload['email'] ?? ''));
    $office = trim((string) ($payload['office'] ?? ''));
    $address = trim((string) ($payload['address'] ?? ''));
    $sec = trim((string) ($payload['secRegistration'] ?? $payload['sec_registration'] ?? ''));
    $hours = trim((string) ($payload['hours'] ?? ''));
    $handbook = trim((string) ($payload['studentHandbookUrl'] ?? $payload['student_handbook_url'] ?? ''));
    $grievanceForm = trim((string) ($payload['grievanceFormUrl'] ?? $payload['grievance_form_url'] ?? ''));
    $grievanceGuidelines = trim(
        (string) ($payload['grievanceGuidelinesUrl'] ?? $payload['grievance_guidelines_url'] ?? '')
    );

    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        api_json(['ok' => false, 'error' => 'A valid contact email is required.'], 422);
    }
    if ($office === '') {
        api_json(['ok' => false, 'error' => 'Office name is required.'], 422);
    }
    if ($address === '') {
        api_json(['ok' => false, 'error' => 'Address is required.'], 422);
    }
    if ($handbook !== '' && !preg_match('#^https?://#i', $handbook)) {
        api_json(['ok' => false, 'error' => 'Student handbook URL must be http(s).'], 422);
    }
    if ($grievanceForm === '' || !preg_match('#^https?://#i', $grievanceForm)) {
        api_json(['ok' => false, 'error' => 'Grievance form URL must be http(s).'], 422);
    }
    if ($grievanceGuidelines === '' || !preg_match('#^https?://#i', $grievanceGuidelines)) {
        api_json(['ok' => false, 'error' => 'Grievance guidelines URL must be http(s).'], 422);
    }

    return [
        'email' => $email,
        'office' => $office,
        'address' => $address,
        'secRegistration' => $sec,
        'hours' => $hours,
        'socials' => site_settings_parse_socials($payload['socials'] ?? []),
        'footerSocials' => site_settings_parse_socials($payload['footerSocials'] ?? $payload['footer_socials'] ?? []),
        'studentHandbookUrl' => $handbook,
        'grievanceFormUrl' => $grievanceForm,
        'grievanceGuidelinesUrl' => $grievanceGuidelines,
    ];
}

function site_settings_load(PDO $pdo, string $key): array
{
    site_settings_ensure_tables($pdo);
    $stmt = $pdo->prepare(
        'SELECT payload_json, updated_at FROM site_settings WHERE setting_key = :key LIMIT 1'
    );
    $stmt->execute(['key' => $key]);
    $row = $stmt->fetch();
    if (!$row) {
        $defaults = site_settings_contact_defaults();
        return [
            'payload' => $defaults,
            'updatedAt' => null,
        ];
    }

    $decoded = json_decode((string) $row['payload_json'], true);
    if (!is_array($decoded)) {
        $decoded = site_settings_contact_defaults();
    }

    return [
        'payload' => $decoded,
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}

function site_settings_get(): never
{
    $pdo = api_pdo();
    site_settings_ensure_tables($pdo);

    $key = site_settings_normalize_key((string) ($_GET['key'] ?? 'contact'));
    if ($key === '') {
        $key = 'contact';
    }

    $loaded = site_settings_load($pdo, $key);
    api_json([
        'ok' => true,
        'key' => $key,
        'payload' => $loaded['payload'],
        'contact' => $key === 'contact' ? $loaded['payload'] : null,
        'updatedAt' => $loaded['updatedAt'],
    ]);
}

function site_settings_put(): never
{
    api_require_manager();
    $pdo = api_pdo();
    site_settings_ensure_tables($pdo);
    $body = api_read_json();

    $key = site_settings_normalize_key((string) ($body['key'] ?? $_GET['key'] ?? 'contact'));
    if ($key === '') {
        api_json(['ok' => false, 'error' => 'Unknown site setting key.'], 422);
    }

    $payload = $body['payload'] ?? $body['contact'] ?? null;
    if (!is_array($payload)) {
        // Allow flat PUT body without nested payload.
        $payload = $body;
        unset($payload['key']);
    }

    if ($key === 'contact') {
        $payload = site_settings_validate_contact($payload);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO site_settings (setting_key, payload_json)
         VALUES (:setting_key, :payload_json)
         ON DUPLICATE KEY UPDATE payload_json = VALUES(payload_json)'
    );
    $stmt->execute([
        'setting_key' => $key,
        'payload_json' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    $loaded = site_settings_load($pdo, $key);
    api_json([
        'ok' => true,
        'key' => $key,
        'payload' => $loaded['payload'],
        'contact' => $key === 'contact' ? $loaded['payload'] : null,
        'updatedAt' => $loaded['updatedAt'],
    ]);
}
