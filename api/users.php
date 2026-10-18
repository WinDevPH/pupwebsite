<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => users_get(),
        'POST' => users_create(),
        'PUT', 'PATCH' => users_update(),
        'DELETE' => users_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json([
        'ok' => false,
        'error' => 'Database unavailable. Import database/schema.sql and start MySQL.',
        'detail' => $error->getMessage(),
    ], 503);
}

/** @return list<string> */
function users_roles(): array
{
    return ['admin', 'officer', 'student'];
}

function users_ensure_avatar_column(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }
    try {
        $exists = $pdo->query("SHOW COLUMNS FROM users LIKE 'avatar_url'")->fetch();
        if (!$exists) {
            $pdo->exec('ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL AFTER year_level');
        }
    } catch (Throwable) {
        // Column may already exist on concurrent runs.
    }
    $ready = true;
}

function users_row(array $row): array
{
    $role = strtolower((string) ($row['role'] ?? 'student'));
    if (!in_array($role, users_roles(), true)) {
        $role = 'student';
    }
    $avatar = trim((string) ($row['avatar_url'] ?? ''));

    return [
        'id' => (int) $row['id'],
        'email' => (string) $row['email'],
        'fullName' => (string) $row['full_name'],
        'studentNumber' => $row['student_number'] !== null && $row['student_number'] !== ''
            ? (string) $row['student_number']
            : null,
        'yearLevel' => $row['year_level'] !== null ? (int) $row['year_level'] : null,
        'avatarUrl' => $avatar !== '' ? $avatar : null,
        'role' => $role,
        'active' => (int) ($row['is_active'] ?? 0) === 1,
        'lastLoginAt' => !empty($row['last_login_at'])
            ? api_iso((string) $row['last_login_at'])
            : null,
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}

function users_fetch(PDO $pdo, int $id): ?array
{
    users_ensure_avatar_column($pdo);
    $stmt = $pdo->prepare(
        'SELECT id, email, full_name, student_number, year_level, avatar_url, role, is_active,
                last_login_at, created_at, updated_at
         FROM users
         WHERE id = :id
         LIMIT 1'
    );
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function users_admin_count(PDO $pdo, ?int $excludeId = null): int
{
    $sql = "SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1";
    $params = [];
    if ($excludeId !== null && $excludeId > 0) {
        $sql .= ' AND id <> :id';
        $params['id'] = $excludeId;
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return (int) $stmt->fetchColumn();
}

function users_payload(array $body, bool $creating): array
{
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $fullName = trim((string) ($body['fullName'] ?? $body['full_name'] ?? ''));
    $studentNumber = trim((string) ($body['studentNumber'] ?? $body['student_number'] ?? ''));
    $yearRaw = $body['yearLevel'] ?? $body['year_level'] ?? null;
    $yearLevel = $yearRaw === null || $yearRaw === '' ? null : (int) $yearRaw;
    $role = strtolower(trim((string) ($body['role'] ?? 'student')));
    $active = array_key_exists('active', $body)
        ? (bool) $body['active']
        : (array_key_exists('isActive', $body) ? (bool) $body['isActive'] : true);
    $password = (string) ($body['password'] ?? '');
    $avatarUrl = trim((string) ($body['avatarUrl'] ?? $body['avatar_url'] ?? ''));
    if ($avatarUrl !== '' && !preg_match('#^(/|https?://)#i', $avatarUrl)) {
        api_json(['ok' => false, 'error' => 'Invalid profile photo URL.'], 422);
    }
    if (mb_strlen($avatarUrl) > 500) {
        api_json(['ok' => false, 'error' => 'Profile photo URL is too long.'], 422);
    }

    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        api_json(['ok' => false, 'error' => 'Enter a valid email address.'], 422);
    }
    if (mb_strlen($email) > 191) {
        api_json(['ok' => false, 'error' => 'Email is too long.'], 422);
    }
    if ($fullName === '') {
        api_json(['ok' => false, 'error' => 'Full name is required.'], 422);
    }
    if (mb_strlen($fullName) > 191) {
        api_json(['ok' => false, 'error' => 'Full name is too long.'], 422);
    }
    if (!in_array($role, users_roles(), true)) {
        api_json(['ok' => false, 'error' => 'Invalid role.'], 422);
    }
    if ($yearLevel !== null && ($yearLevel < 1 || $yearLevel > 6)) {
        api_json(['ok' => false, 'error' => 'Year level must be between 1 and 6.'], 422);
    }
    if (mb_strlen($studentNumber) > 64) {
        api_json(['ok' => false, 'error' => 'Student number is too long.'], 422);
    }

    if ($creating) {
        if (strlen($password) < 8) {
            api_json(['ok' => false, 'error' => 'Password must be at least 8 characters.'], 422);
        }
    } elseif ($password !== '' && strlen($password) < 8) {
        api_json(['ok' => false, 'error' => 'Password must be at least 8 characters.'], 422);
    }
    if (strlen($password) > 128) {
        api_json(['ok' => false, 'error' => 'Password is too long.'], 422);
    }

    $data = [
        'email' => $email,
        'full_name' => mb_substr($fullName, 0, 191),
        'student_number' => $studentNumber !== '' ? mb_substr($studentNumber, 0, 64) : null,
        'year_level' => $yearLevel,
        'avatar_url' => $avatarUrl !== '' ? $avatarUrl : null,
        'role' => $role,
        'is_active' => $active ? 1 : 0,
    ];

    if ($creating || $password !== '') {
        $data['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
    }

    return $data;
}

function users_get(): never
{
    $actor = api_require_admin();
    $pdo = api_pdo();
    users_ensure_avatar_column($pdo);

    $id = (int) ($_GET['id'] ?? 0);
    $role = strtolower(trim((string) ($_GET['role'] ?? '')));
    $activeFilter = trim((string) ($_GET['active'] ?? ''));

    if ($id > 0) {
        $row = users_fetch($pdo, $id);
        if (!$row) {
            api_json(['ok' => false, 'error' => 'User not found.'], 404);
        }
        api_json(['ok' => true, 'item' => users_row($row), 'meId' => (int) $actor['id']]);
    }

    if ($role !== '' && !in_array($role, users_roles(), true)) {
        api_json(['ok' => false, 'error' => 'Unknown role.'], 422);
    }

    $sql = 'SELECT id, email, full_name, student_number, year_level, avatar_url, role, is_active,
                   last_login_at, created_at, updated_at
            FROM users WHERE 1=1';
    $params = [];
    if ($role !== '') {
        $sql .= ' AND role = :role';
        $params['role'] = $role;
    }
    if ($activeFilter === '1' || strtolower($activeFilter) === 'true') {
        $sql .= ' AND is_active = 1';
    } elseif ($activeFilter === '0' || strtolower($activeFilter) === 'false') {
        $sql .= ' AND is_active = 0';
    }
    $sql .= ' ORDER BY full_name ASC, id ASC';

    if ($params) {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    } else {
        $stmt = $pdo->query($sql);
    }

    $items = [];
    if ($stmt) {
        foreach ($stmt->fetchAll() as $row) {
            $items[] = users_row($row);
        }
    }

    api_json([
        'ok' => true,
        'items' => $items,
        'roles' => users_roles(),
        'meId' => (int) $actor['id'],
    ]);
}

function users_create(): never
{
    api_require_admin();
    $pdo = api_pdo();
    users_ensure_avatar_column($pdo);
    $body = api_read_json();
    $data = users_payload($body, true);

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO users
              (email, password_hash, full_name, student_number, year_level, avatar_url, role, is_active)
             VALUES
              (:email, :password_hash, :full_name, :student_number, :year_level, :avatar_url, :role, :is_active)'
        );
        $stmt->execute($data);
    } catch (PDOException $error) {
        if ((int) $error->getCode() === 23000) {
            api_json(['ok' => false, 'error' => 'An account with this email already exists.'], 409);
        }
        throw $error;
    }

    $id = (int) $pdo->lastInsertId();
    $row = users_fetch($pdo, $id);
    if (!$row) {
        api_json(['ok' => false, 'error' => 'User was created but could not be loaded.'], 500);
    }
    api_json(['ok' => true, 'item' => users_row($row)], 201);
}

function users_update(): never
{
    $actor = api_require_admin();
    $pdo = api_pdo();
    users_ensure_avatar_column($pdo);
    $body = api_read_json();
    $id = (int) ($body['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'User id is required.'], 422);
    }

    $existing = users_fetch($pdo, $id);
    if (!$existing) {
        api_json(['ok' => false, 'error' => 'User not found.'], 404);
    }

    $data = users_payload($body, false);
    $actorId = (int) $actor['id'];
    $wasAdmin = strtolower((string) $existing['role']) === 'admin' && (int) $existing['is_active'] === 1;
    $willBeAdmin = $data['role'] === 'admin' && (int) $data['is_active'] === 1;

    if ($id === $actorId) {
        if ((int) $data['is_active'] !== 1) {
            api_json(['ok' => false, 'error' => 'You cannot deactivate your own account.'], 422);
        }
        if ($data['role'] !== 'admin') {
            api_json(['ok' => false, 'error' => 'You cannot remove your own admin role.'], 422);
        }
    }

    if ($wasAdmin && !$willBeAdmin && users_admin_count($pdo, $id) < 1) {
        api_json(['ok' => false, 'error' => 'At least one active admin is required.'], 422);
    }

    $sets = [
        'email = :email',
        'full_name = :full_name',
        'student_number = :student_number',
        'year_level = :year_level',
        'avatar_url = :avatar_url',
        'role = :role',
        'is_active = :is_active',
    ];
    $params = [
        'id' => $id,
        'email' => $data['email'],
        'full_name' => $data['full_name'],
        'student_number' => $data['student_number'],
        'year_level' => $data['year_level'],
        'avatar_url' => $data['avatar_url'],
        'role' => $data['role'],
        'is_active' => $data['is_active'],
    ];
    if (isset($data['password_hash'])) {
        $sets[] = 'password_hash = :password_hash';
        $params['password_hash'] = $data['password_hash'];
    }

    try {
        $stmt = $pdo->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = :id');
        $stmt->execute($params);
    } catch (PDOException $error) {
        if ((int) $error->getCode() === 23000) {
            api_json(['ok' => false, 'error' => 'An account with this email already exists.'], 409);
        }
        throw $error;
    }

    $row = users_fetch($pdo, $id);
    api_json(['ok' => true, 'item' => users_row($row)]);
}

function users_delete(): never
{
    $actor = api_require_admin();
    $pdo = api_pdo();
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'User id is required.'], 422);
    }

    $existing = users_fetch($pdo, $id);
    if (!$existing) {
        api_json(['ok' => false, 'error' => 'User not found.'], 404);
    }

    if ($id === (int) $actor['id']) {
        api_json(['ok' => false, 'error' => 'You cannot delete your own account.'], 422);
    }

    $isActiveAdmin = strtolower((string) $existing['role']) === 'admin' && (int) $existing['is_active'] === 1;
    if ($isActiveAdmin && users_admin_count($pdo, $id) < 1) {
        api_json(['ok' => false, 'error' => 'At least one active admin is required.'], 422);
    }

    $stmt = $pdo->prepare('DELETE FROM users WHERE id = :id');
    $stmt->execute(['id' => $id]);
    api_json(['ok' => true]);
}
