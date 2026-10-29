<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';

api_cors();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    api_json(['ok' => false, 'error' => 'Method not allowed.'], 405);
}

try {
    $user = api_current_user();
} catch (Throwable $error) {
    api_json_db_error($error);
}

if (!$user) {
    api_json(['ok' => false, 'error' => 'Not authenticated.'], 401);
}

api_json([
    'ok' => true,
    'user' => api_public_user($user),
]);
