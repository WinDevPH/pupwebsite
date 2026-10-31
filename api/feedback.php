<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => feedback_get(),
        'POST' => feedback_create(),
        'PUT', 'PATCH' => feedback_update(),
        'DELETE' => feedback_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json_db_error($error);
}

/** @return list<string> */
function feedback_kinds(): array
{
    return ['suggestion', 'concern', 'compliment', 'other'];
}

function feedback_ensure_tables(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS feedback_items (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          name VARCHAR(80) NOT NULL,
          email VARCHAR(255) NOT NULL,
          kind VARCHAR(32) NOT NULL,
          message TEXT NOT NULL,
          status VARCHAR(16) NOT NULL DEFAULT 'new',
          ip_address VARCHAR(64) NOT NULL DEFAULT '',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_feedback_status (status, created_at),
          KEY idx_feedback_kind (kind, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $ready = true;
}

function feedback_row(array $row): array
{
    $kind = (string) ($row['kind'] ?? 'other');
    if (!in_array($kind, feedback_kinds(), true)) {
        $kind = 'other';
    }
    $status = strtolower((string) ($row['status'] ?? 'new'));
    if ($status !== 'read') {
        $status = 'new';
    }

    return [
        'id' => (int) $row['id'],
        'name' => (string) $row['name'],
        'email' => (string) $row['email'],
        'kind' => $kind,
        'message' => (string) $row['message'],
        'status' => $status,
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}

function feedback_create(): never
{
    $body = api_read_json();
    if (trim((string) ($body['website'] ?? $body['company'] ?? '')) !== '') {
        api_json(['ok' => true, 'item' => null], 201);
    }

    $name = trim((string) ($body['name'] ?? ''));
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $kind = strtolower(trim((string) ($body['kind'] ?? $body['about'] ?? '')));
    $message = trim((string) ($body['message'] ?? ''));

    if (mb_strlen($name) < 2 || mb_strlen($name) > 80) {
        api_json(['ok' => false, 'error' => 'Enter your name.'], 422);
    }
    if (!preg_match("/^[\\p{L}][\\p{L} .'-]*$/u", $name)) {
        api_json(['ok' => false, 'error' => 'Use letters in your name.'], 422);
    }
    if (
        $email === '' ||
        mb_strlen($email) > 254 ||
        !filter_var($email, FILTER_VALIDATE_EMAIL)
    ) {
        api_json(['ok' => false, 'error' => 'Enter a valid email so the Council can reply.'], 422);
    }
    if (!in_array($kind, feedback_kinds(), true)) {
        api_json(['ok' => false, 'error' => 'Choose what this feedback is about.'], 422);
    }
    if (mb_strlen($message) < 10) {
        api_json(['ok' => false, 'error' => 'Write a little more so the Council can read your feedback.'], 422);
    }
    if (mb_strlen($message) > 1500) {
        api_json(['ok' => false, 'error' => 'Keep the feedback under 1,500 characters.'], 422);
    }

    $pdo = api_pdo();
    feedback_ensure_tables($pdo);
    $ip = api_client_ip();

    $recent = $pdo->prepare(
        'SELECT COUNT(*) FROM feedback_items
         WHERE ip_address = :ip AND created_at >= (NOW() - INTERVAL 1 HOUR)'
    );
    $recent->execute(['ip' => $ip]);
    if ((int) $recent->fetchColumn() >= 5) {
        api_json(['ok' => false, 'error' => 'You already sent several notes. Please try again later.'], 429);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO feedback_items (name, email, kind, message, status, ip_address)
         VALUES (:name, :email, :kind, :message, \'new\', :ip_address)'
    );
    $stmt->execute([
        'name' => mb_substr($name, 0, 80),
        'email' => mb_substr($email, 0, 255),
        'kind' => $kind,
        'message' => $message,
        'ip_address' => mb_substr($ip, 0, 64),
    ]);

    $id = (int) $pdo->lastInsertId();
    $fetch = $pdo->prepare('SELECT * FROM feedback_items WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => feedback_row($fetch->fetch() ?: [])], 201);
}

function feedback_get(): never
{
    api_require_manager();
    $pdo = api_pdo();
    feedback_ensure_tables($pdo);

    $id = (int) ($_GET['id'] ?? 0);
    if ($id > 0) {
        $stmt = $pdo->prepare('SELECT * FROM feedback_items WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Feedback not found.'], 404);
        }
        api_json(['ok' => true, 'item' => feedback_row($row)]);
    }

    $stmt = $pdo->query('SELECT * FROM feedback_items ORDER BY created_at DESC, id DESC');
    $items = [];
    if ($stmt) {
        foreach ($stmt->fetchAll() as $row) {
            $items[] = feedback_row($row);
        }
    }

    api_json(['ok' => true, 'items' => $items]);
}

function feedback_update(): never
{
    api_require_manager();
    $pdo = api_pdo();
    feedback_ensure_tables($pdo);
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Feedback id is required.'], 422);
    }

    $status = strtolower(trim((string) ($body['status'] ?? '')));
    if (!in_array($status, ['new', 'read'], true)) {
        api_json(['ok' => false, 'error' => 'Status must be new or read.'], 422);
    }

    $stmt = $pdo->prepare('UPDATE feedback_items SET status = :status WHERE id = :id');
    $stmt->execute(['status' => $status, 'id' => $id]);
    $fetch = $pdo->prepare('SELECT * FROM feedback_items WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    $row = $fetch->fetch();
    if (!$row) {
        api_json(['ok' => false, 'error' => 'Feedback not found.'], 404);
    }
    api_json(['ok' => true, 'item' => feedback_row($row)]);
}

function feedback_delete(): never
{
    api_require_manager();
    $pdo = api_pdo();
    feedback_ensure_tables($pdo);
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Feedback id is required.'], 422);
    }
    $stmt = $pdo->prepare('DELETE FROM feedback_items WHERE id = :id');
    $stmt->execute(['id' => $id]);
    api_json(['ok' => true]);
}
