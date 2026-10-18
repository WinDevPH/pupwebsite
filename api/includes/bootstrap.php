<?php

declare(strict_types=1);

/** All portal timestamps are Philippine Time (no DST). */
const API_TIMEZONE = 'Asia/Manila';
const API_MYSQL_TIME_ZONE = '+08:00';

date_default_timezone_set(API_TIMEZONE);

/** Current wall-clock time in Asia/Manila as MySQL DATETIME. */
function api_now(): string
{
    return date('Y-m-d H:i:s');
}

/**
 * Convert a MySQL DATETIME / timestamp string to ISO-8601 with Asia/Manila offset.
 * Naive datetimes are interpreted as Philippine Time.
 */
function api_iso(?string $value): ?string
{
    if ($value === null) {
        return null;
    }
    $raw = trim($value);
    if ($raw === '' || str_starts_with($raw, '0000-00-00')) {
        return null;
    }
    $ts = strtotime($raw);
    if ($ts === false) {
        return null;
    }
    return date('c', $ts);
}

function api_detect_env(): string
{
    $forced = getenv('APP_ENV');
    if (is_string($forced) && $forced !== '') {
        return strtolower($forced) === 'production' ? 'production' : 'development';
    }

    $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    $host = explode(':', $host)[0];
    if ($host === '' || $host === 'localhost' || $host === '127.0.0.1') {
        return 'development';
    }

    return 'production';
}

function api_load_env(): void
{
    static $loaded = false;
    if ($loaded) {
        return;
    }
    $loaded = true;

    $root = api_project_root();
    $envName = api_detect_env();
    $candidates = [
        $root . '/.env.' . $envName,
        $root . '/.env',
    ];

    foreach ($candidates as $file) {
        if (!is_readable($file)) {
            continue;
        }

        $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            continue;
        }

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }
            if (!str_contains($line, '=')) {
                continue;
            }

            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            if ($key === '') {
                continue;
            }

            if (
                (str_starts_with($value, '"') && str_ends_with($value, '"'))
                || (str_starts_with($value, "'") && str_ends_with($value, "'"))
            ) {
                $value = substr($value, 1, -1);
            }

            // Do not override variables already set in the process environment.
            if (getenv($key) === false) {
                putenv($key . '=' . $value);
                $_ENV[$key] = $value;
            }
        }

        break;
    }

    if (getenv('APP_ENV') === false) {
        putenv('APP_ENV=' . $envName);
        $_ENV['APP_ENV'] = $envName;
    }
}

function api_project_root(): string
{
    return dirname(__DIR__, 2);
}

/**
 * Local Vite keeps uploads under /public/{bucket}/uploads;
 * production package serves them at /{bucket}/uploads.
 */
function api_uploads_dir(string $bucket = 'announcements'): string
{
    $safe = preg_replace('/[^a-z0-9_-]/i', '', $bucket) ?: 'announcements';
    $root = api_project_root();
    if (is_dir($root . DIRECTORY_SEPARATOR . 'public')) {
        return $root . '/public/' . $safe . '/uploads';
    }

    return $root . '/' . $safe . '/uploads';
}

/** Private uploads (not web-served), e.g. portal request attachments. */
function api_private_uploads_dir(string $bucket = 'requests'): string
{
    $safe = preg_replace('/[^a-z0-9_-]/i', '', $bucket) ?: 'requests';
    return api_project_root() . '/storage/' . $safe;
}

function api_config(): array
{
    static $config = null;
    if (is_array($config)) {
        return $config;
    }

    api_load_env();

    $file = dirname(__DIR__) . '/config.php';
    $config = is_readable($file) ? require $file : [];
    if (!is_array($config)) {
        $config = [];
    }

    $extraCors = getenv('CORS_ORIGINS');
    if (is_string($extraCors) && trim($extraCors) !== '') {
        $parsed = array_values(array_filter(array_map('trim', explode(',', $extraCors))));
        $existing = $config['cors_origins'] ?? [];
        $config['cors_origins'] = array_values(array_unique([
            ...(is_array($existing) ? $existing : []),
            ...$parsed,
        ]));
    }

    return $config;
}

function api_pdo(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $db = api_config()['db'] ?? [];
    $host = (string) ($db['host'] ?? '127.0.0.1');
    $port = (int) ($db['port'] ?? 3306);
    $name = (string) ($db['name'] ?? 'pup_col_sc');
    $user = (string) ($db['user'] ?? 'root');
    $pass = (string) ($db['pass'] ?? '');
    $charset = (string) ($db['charset'] ?? 'utf8mb4');

    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $host, $port, $name, $charset);
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    // Keep MySQL NOW()/CURRENT_TIMESTAMP aligned with PHP Asia/Manila.
    $pdo->exec("SET time_zone = '" . API_MYSQL_TIME_ZONE . "'");

    return $pdo;
}

function api_cors(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed = api_config()['cors_origins'] ?? [];
    if ($origin !== '' && is_array($allowed) && in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Vary: Origin');
    }

    header('Access-Control-Allow-Headers: Content-Type, Accept');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function api_security_headers(): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header('Cache-Control: no-store, no-cache, must-revalidate');
}

function api_json(mixed $payload, int $status = 200, array $headers = []): never
{
    api_security_headers();
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    foreach ($headers as $name => $value) {
        header($name . ': ' . $value);
    }
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function api_client_ip(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    return is_string($ip) && $ip !== '' ? substr($ip, 0, 45) : '0.0.0.0';
}

/**
 * @return array{blocked: bool, retryAfter: int, remaining: int, attempts: int}
 */
function api_login_rate_status(string $ip, string $email): array
{
    $limits = api_config()['rate_limit'] ?? [];
    $maxAttempts = max(1, (int) ($limits['max_attempts'] ?? 5));
    $windowMinutes = max(1, (int) ($limits['window_minutes'] ?? 15));
    $lockoutMinutes = max(1, (int) ($limits['lockout_minutes'] ?? 15));
    $maxIpAttempts = max($maxAttempts, (int) ($limits['max_ip_attempts'] ?? 20));

    $pdo = api_pdo();

    $emailStmt = $pdo->prepare(
        'SELECT COUNT(*) AS fails,
                TIMESTAMPDIFF(
                  SECOND,
                  NOW(),
                  DATE_ADD(MAX(created_at), INTERVAL ' . $lockoutMinutes . ' MINUTE)
                ) AS retry_after
         FROM login_attempts
         WHERE succeeded = 0
           AND ip_address = :ip
           AND email = :email
           AND created_at >= (NOW() - INTERVAL ' . $windowMinutes . ' MINUTE)'
    );
    $emailStmt->execute(['ip' => $ip, 'email' => $email]);
    $emailRow = $emailStmt->fetch() ?: ['fails' => 0, 'retry_after' => 0];
    $emailFails = (int) ($emailRow['fails'] ?? 0);
    $emailRetry = max(0, (int) ($emailRow['retry_after'] ?? 0));

    $ipStmt = $pdo->prepare(
        'SELECT COUNT(*) AS fails,
                TIMESTAMPDIFF(
                  SECOND,
                  NOW(),
                  DATE_ADD(MAX(created_at), INTERVAL ' . $lockoutMinutes . ' MINUTE)
                ) AS retry_after
         FROM login_attempts
         WHERE succeeded = 0
           AND ip_address = :ip
           AND created_at >= (NOW() - INTERVAL ' . $windowMinutes . ' MINUTE)'
    );
    $ipStmt->execute(['ip' => $ip]);
    $ipRow = $ipStmt->fetch() ?: ['fails' => 0, 'retry_after' => 0];
    $ipFails = (int) ($ipRow['fails'] ?? 0);
    $ipRetry = max(0, (int) ($ipRow['retry_after'] ?? 0));

    $emailBlocked = $emailFails >= $maxAttempts && $emailRetry > 0;
    $ipBlocked = $ipFails >= $maxIpAttempts && $ipRetry > 0;
    $blocked = $emailBlocked || $ipBlocked;
    $retryAfter = $blocked ? max($emailBlocked ? $emailRetry : 0, $ipBlocked ? $ipRetry : 0) : 0;

    return [
        'blocked' => $blocked,
        'retryAfter' => $retryAfter,
        'remaining' => max(0, $maxAttempts - $emailFails),
        'attempts' => $emailFails,
    ];
}

function api_record_login_attempt(string $ip, string $email, bool $succeeded): void
{
    $stmt = api_pdo()->prepare(
        'INSERT INTO login_attempts (ip_address, email, succeeded)
         VALUES (:ip, :email, :succeeded)'
    );
    $stmt->execute([
        'ip' => $ip,
        'email' => $email !== '' ? $email : null,
        'succeeded' => $succeeded ? 1 : 0,
    ]);

    if ($succeeded) {
        $clear = api_pdo()->prepare(
            'DELETE FROM login_attempts
             WHERE succeeded = 0
               AND ip_address = :ip
               AND (email = :email OR email IS NULL)'
        );
        $clear->execute(['ip' => $ip, 'email' => $email]);
    }

    // Keep the table lean.
    api_pdo()->exec(
        'DELETE FROM login_attempts WHERE created_at < (NOW() - INTERVAL 7 DAY)'
    );
}

function api_read_json(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function api_start_session(bool $remember = false): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $config = api_config();
    $name = (string) ($config['session_name'] ?? 'pup_col_sc_session');
    $hours = (int) ($config['session_lifetime_hours'] ?? 12);
    $days = (int) ($config['remember_lifetime_days'] ?? 30);
    $lifetime = $remember ? $days * 86400 : $hours * 3600;

    session_name($name);
    session_set_cookie_params([
        'lifetime' => $lifetime,
        'path' => '/',
        'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function api_ensure_users_avatar_column(?PDO $pdo = null): void
{
    static $ready = false;
    if ($ready) {
        return;
    }
    try {
        $db = $pdo ?? api_pdo();
        $exists = $db->query("SHOW COLUMNS FROM users LIKE 'avatar_url'")->fetch();
        if (!$exists) {
            $db->exec('ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL AFTER year_level');
        }
    } catch (Throwable) {
        // Column may already exist on concurrent runs.
    }
    $ready = true;
}

function api_public_user(array $user): array
{
    $avatar = trim((string) ($user['avatar_url'] ?? ''));

    return [
        'id' => (int) $user['id'],
        'email' => (string) $user['email'],
        'fullName' => (string) $user['full_name'],
        'studentNumber' => $user['student_number'] !== null ? (string) $user['student_number'] : null,
        'yearLevel' => $user['year_level'] !== null ? (int) $user['year_level'] : null,
        'avatarUrl' => $avatar !== '' ? $avatar : null,
        'role' => (string) $user['role'],
    ];
}

function api_current_user(): ?array
{
    api_start_session();
    $userId = $_SESSION['user_id'] ?? null;
    if (!is_int($userId) && !is_numeric($userId)) {
        return null;
    }

    $pdo = api_pdo();
    api_ensure_users_avatar_column($pdo);

    $stmt = $pdo->prepare(
        'SELECT id, email, full_name, student_number, year_level, avatar_url, role, is_active
         FROM users
         WHERE id = :id
         LIMIT 1'
    );
    $stmt->execute(['id' => (int) $userId]);
    $user = $stmt->fetch();
    if (!$user || !(int) $user['is_active']) {
        return null;
    }

    return $user;
}

/** Require a signed-in officer or admin. */
function api_require_manager(): array
{
    $user = api_current_user();
    if (!$user) {
        api_json(['ok' => false, 'error' => 'Sign in to continue.'], 401);
    }

    $role = strtolower((string) ($user['role'] ?? ''));
    if (!in_array($role, ['admin', 'officer'], true)) {
        api_json(['ok' => false, 'error' => 'You do not have permission for this action.'], 403);
    }

    return $user;
}

/** Require a signed-in admin (not officer). */
function api_require_admin(): array
{
    $user = api_require_manager();
    $role = strtolower((string) ($user['role'] ?? ''));
    if ($role !== 'admin') {
        api_json(['ok' => false, 'error' => 'Only admins can manage users.'], 403);
    }
    return $user;
}

function api_slugify(string $value): string
{
    $slug = strtolower(trim($value));
    $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
    $slug = trim($slug, '-');
    return $slug !== '' ? substr($slug, 0, 180) : 'item';
}
