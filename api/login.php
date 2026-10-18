<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';

api_cors();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    api_json(['ok' => false, 'error' => 'Method not allowed.'], 405);
}

$body = api_read_json();
$email = strtolower(trim((string) ($body['email'] ?? '')));
$password = (string) ($body['password'] ?? '');
$remember = (bool) ($body['remember'] ?? false);
$ip = api_client_ip();

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    api_json(['ok' => false, 'error' => 'Enter a valid email address.'], 422);
}

if ($password === '') {
    api_json(['ok' => false, 'error' => 'Enter your password.'], 422);
}

if (strlen($password) > 128) {
    api_json(['ok' => false, 'error' => 'Password is too long.'], 422);
}

try {
    $rate = api_login_rate_status($ip, $email);
} catch (Throwable) {
    api_json([
        'ok' => false,
        'error' => 'Database unavailable. Import database/schema.sql and start MySQL in XAMPP.',
    ], 503);
}

if ($rate['blocked']) {
    $seconds = max(1, (int) $rate['retryAfter']);
    $minutes = (int) ceil($seconds / 60);
    api_json([
        'ok' => false,
        'error' => 'Too many login attempts. Try again in ' . $minutes . ' minute' . ($minutes === 1 ? '' : 's') . '.',
        'retryAfter' => $seconds,
        'locked' => true,
    ], 429, ['Retry-After' => (string) $seconds]);
}

try {
    $pdo = api_pdo();
    api_ensure_users_avatar_column($pdo);
    $stmt = $pdo->prepare(
        'SELECT id, email, password_hash, full_name, student_number, year_level, avatar_url, role, is_active
         FROM users
         WHERE email = :email
         LIMIT 1'
    );
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();
} catch (Throwable) {
    api_json([
        'ok' => false,
        'error' => 'Database unavailable. Import database/schema.sql and start MySQL in XAMPP.',
    ], 503);
}

// Constant-time style check even when the account is missing.
// Valid bcrypt hash used only to keep verification timing similar when the account is missing.
$dummyHash = '$2y$10$UkCVdkT9FFiGChJTs6M9juZMobMYgq8B.HY8mDHJxgQcpiH1AC6xa';
$hash = is_array($user) ? (string) $user['password_hash'] : $dummyHash;
$validPassword = password_verify($password, $hash);
$active = is_array($user) && (int) $user['is_active'] === 1;

if (!$user || !$active || !$validPassword) {
    try {
        api_record_login_attempt($ip, $email, false);
        $rate = api_login_rate_status($ip, $email);
    } catch (Throwable) {
        $rate = ['blocked' => false, 'retryAfter' => 0, 'remaining' => 0, 'attempts' => 0];
    }

    if ($rate['blocked']) {
        $seconds = max(1, (int) $rate['retryAfter']);
        $minutes = (int) ceil($seconds / 60);
        api_json([
            'ok' => false,
            'error' => 'Too many login attempts. Try again in ' . $minutes . ' minute' . ($minutes === 1 ? '' : 's') . '.',
            'retryAfter' => $seconds,
            'locked' => true,
        ], 429, ['Retry-After' => (string) $seconds]);
    }

    api_json([
        'ok' => false,
        'error' => 'Invalid email or password.',
        'remaining' => (int) $rate['remaining'],
        'locked' => false,
    ], 401);
}

try {
    api_record_login_attempt($ip, $email, true);
} catch (Throwable) {
    // Login can still proceed if attempt logging fails.
}

api_start_session($remember);
session_regenerate_id(true);
$_SESSION['user_id'] = (int) $user['id'];
$_SESSION['remember'] = $remember;

$update = api_pdo()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = :id');
$update->execute(['id' => (int) $user['id']]);

$token = bin2hex(random_bytes(32));
$hours = (int) (api_config()['session_lifetime_hours'] ?? 12);
$days = (int) (api_config()['remember_lifetime_days'] ?? 30);
$expiresSql = $remember
    ? sprintf('DATE_ADD(NOW(), INTERVAL %d DAY)', max(1, $days))
    : sprintf('DATE_ADD(NOW(), INTERVAL %d HOUR)', max(1, $hours));

$sessionInsert = api_pdo()->prepare(
    "INSERT INTO auth_sessions (id, user_id, remember, ip_address, user_agent, expires_at)
     VALUES (:id, :user_id, :remember, :ip, :ua, {$expiresSql})"
);
$sessionInsert->execute([
    'id' => $token,
    'user_id' => (int) $user['id'],
    'remember' => $remember ? 1 : 0,
    'ip' => $ip,
    'ua' => isset($_SERVER['HTTP_USER_AGENT']) ? substr((string) $_SERVER['HTTP_USER_AGENT'], 0, 255) : null,
]);

$_SESSION['session_token'] = $token;

api_json([
    'ok' => true,
    'user' => api_public_user($user),
]);
