<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';

api_cors();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    api_json(['ok' => false, 'error' => 'Method not allowed.'], 405);
}

api_start_session();
$token = $_SESSION['session_token'] ?? null;

if (is_string($token) && $token !== '') {
    try {
        $stmt = api_pdo()->prepare('DELETE FROM auth_sessions WHERE id = :id');
        $stmt->execute(['id' => $token]);
    } catch (Throwable) {
        // Session cookie still clears even if DB cleanup fails.
    }
}

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', [
        'expires' => time() - 42000,
        'path' => $params['path'] ?: '/',
        'domain' => $params['domain'] ?? '',
        'secure' => (bool) $params['secure'],
        'httponly' => (bool) $params['httponly'],
        'samesite' => $params['samesite'] ?? 'Lax',
    ]);
}
session_destroy();

api_json(['ok' => true]);
