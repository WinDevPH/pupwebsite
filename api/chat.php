<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => chat_get(),
        'POST' => chat_post(),
        'DELETE' => chat_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json_db_error($error);
}

function chat_ensure_tables(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS chat_threads (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            token VARCHAR(64) NOT NULL,
            preview VARCHAR(255) NOT NULL DEFAULT '',
            last_role VARCHAR(16) NOT NULL DEFAULT 'bot',
            visitor_typing_at DATETIME NULL,
            staff_typing_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_chat_threads_token (token),
            KEY idx_chat_threads_updated (updated_at, id)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS chat_messages (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            thread_id INT UNSIGNED NOT NULL,
            role VARCHAR(16) NOT NULL,
            body TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_chat_messages_thread (thread_id, id)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    foreach (['visitor_typing_at', 'staff_typing_at'] as $column) {
        try {
            $exists = $pdo->query("SHOW COLUMNS FROM chat_threads LIKE '{$column}'")->fetch();
            if (!$exists) {
                $pdo->exec("ALTER TABLE chat_threads ADD COLUMN {$column} DATETIME NULL");
            }
        } catch (Throwable) {
            // Column may already exist on concurrent runs.
        }
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS chat_faqs (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            question VARCHAR(240) NOT NULL,
            answer TEXT NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            is_published TINYINT(1) NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_chat_faqs_pub (is_published, sort_order, id)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    chat_faq_seed($pdo);
    $ready = true;
}

function chat_faq_seed(PDO $pdo): void
{
    $locked = $pdo->query("SELECT GET_LOCK('pup_chat_faq_seed', 8)")->fetchColumn();
    if ((int) $locked !== 1) {
        return;
    }
    try {
        $pdo->exec(
            'DELETE a FROM chat_faqs a
             INNER JOIN chat_faqs b
               ON a.question = b.question AND a.answer = b.answer AND a.id > b.id'
        );
        $count = (int) $pdo->query('SELECT COUNT(*) FROM chat_faqs')->fetchColumn();
        if ($count > 0) {
            return;
        }
        $hours = chat_hours();
        $email = chat_email();
        $items = [
            [
                'How do I book a locker?',
                'Locker reservations are on the Locker Availability page. Tap an unassigned locker to reserve it. The Council confirms by email.',
            ],
            [
                'Where can I get merch?',
                'Official Student Council merchandise can be reserved on the merch page. No payment is taken online.',
            ],
            [
                'What are the office hours?',
                'The Council office is open ' . $hours . '. You can also write ' . $email . ' or use the Student Services Portal.',
            ],
        ];
        $stmt = $pdo->prepare(
            'INSERT INTO chat_faqs (question, answer, sort_order, is_published) VALUES (:question, :answer, :sort_order, 1)'
        );
        foreach ($items as $index => $item) {
            $stmt->execute([
                'question' => $item[0],
                'answer' => $item[1],
                'sort_order' => $index,
            ]);
        }
    } finally {
        $pdo->query("SELECT RELEASE_LOCK('pup_chat_faq_seed')");
    }
}

/** @return array{id:int,question:string,answer:string,sortOrder:int,published:bool,createdAt:?string,updatedAt:?string} */
function chat_faq_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'question' => (string) $row['question'],
        'answer' => (string) $row['answer'],
        'sortOrder' => (int) ($row['sort_order'] ?? 0),
        'published' => (int) ($row['is_published'] ?? 0) === 1,
        'createdAt' => api_iso((string) ($row['created_at'] ?? '')),
        'updatedAt' => api_iso((string) ($row['updated_at'] ?? '')),
    ];
}

/** @return list<array{id:int,question:string,answer:string,sortOrder:int,published:bool}> */
function chat_faqs(PDO $pdo, bool $all = false): array
{
    $sql = $all
        ? 'SELECT * FROM chat_faqs ORDER BY sort_order ASC, id ASC'
        : 'SELECT * FROM chat_faqs WHERE is_published = 1 ORDER BY sort_order ASC, id ASC';
    $stmt = $pdo->query($sql);
    $items = [];
    foreach ($stmt ? $stmt->fetchAll() : [] as $row) {
        $items[] = chat_faq_row($row);
    }
    return $items;
}

function chat_faq_find(PDO $pdo, int $id, bool $publishedOnly = false): ?array
{
    $sql = $publishedOnly
        ? 'SELECT * FROM chat_faqs WHERE id = :id AND is_published = 1 LIMIT 1'
        : 'SELECT * FROM chat_faqs WHERE id = :id LIMIT 1';
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function chat_faq_payload(array $body): array
{
    $question = trim((string) ($body['question'] ?? ''));
    $answer = trim((string) ($body['answer'] ?? ''));
    $sortOrder = (int) ($body['sortOrder'] ?? $body['sort_order'] ?? 0);
    $published = array_key_exists('published', $body)
        ? (bool) $body['published']
        : (array_key_exists('isPublished', $body) ? (bool) $body['isPublished'] : true);

    if ($question === '') {
        api_json(['ok' => false, 'error' => 'Question is required.'], 422);
    }
    if ($answer === '') {
        api_json(['ok' => false, 'error' => 'Answer is required.'], 422);
    }
    if (mb_strlen($question) > 240) {
        api_json(['ok' => false, 'error' => 'Keep the question under 240 characters.'], 422);
    }
    if (mb_strlen($answer) > 1500) {
        api_json(['ok' => false, 'error' => 'Keep the answer under 1,500 characters.'], 422);
    }

    return [
        'question' => $question,
        'answer' => $answer,
        'sort_order' => $sortOrder,
        'is_published' => $published ? 1 : 0,
    ];
}

function chat_is_recent_typing(mixed $at): bool
{
    if (!is_string($at) || trim($at) === '' || str_starts_with($at, '0000-00-00')) {
        return false;
    }
    $ts = strtotime($at);
    return $ts !== false && (time() - $ts) <= 6;
}

function chat_touch_typing(PDO $pdo, int $threadId, string $side, bool $active): void
{
    $col = $side === 'staff' ? 'staff_typing_at' : 'visitor_typing_at';
    if ($active) {
        $stmt = $pdo->prepare("UPDATE chat_threads SET {$col} = :at WHERE id = :id");
        $stmt->execute(['at' => api_now(), 'id' => $threadId]);
        return;
    }
    $stmt = $pdo->prepare("UPDATE chat_threads SET {$col} = NULL WHERE id = :id");
    $stmt->execute(['id' => $threadId]);
}

function chat_hours(): string
{
    return 'Mon–Sat, 9:00 AM–6:00 PM';
}

function chat_email(): string
{
    return 'studentcouncil@pupcolsc.com';
}

function chat_welcome(): string
{
    return 'Welcome. This is the PUP COL SC help desk. Tell us what you need and we will point you to the right page or officer. Office hours: '
        . chat_hours()
        . '.';
}

function chat_bot_reply(string $raw): string
{
    $q = mb_strtolower(trim($raw));
    $email = chat_email();
    $hours = chat_hours();

    if (preg_match('/locker/', $q)) {
        return 'Locker reservations are on the Locker Availability page. Tap an unassigned locker to reserve it. The Council confirms by email.';
    }
    if (preg_match('/merch|shirt|polo|lanyard|store|igp/', $q)) {
        return 'Official Student Council merchandise can be reserved on the merch page. No payment is taken online.';
    }
    if (preg_match('/grievance|complaint|harass/', $q)) {
        return 'Student grievances are filed through the official form on the Student Services Portal Grievance tab. Guidelines are posted beside it.';
    }
    if (preg_match('/hour|open|office|when/', $q)) {
        return 'The Council office is open ' . $hours . '. You can also write ' . $email . ' or use the Student Services Portal.';
    }
    if (preg_match('/email|contact|reach|talk/', $q)) {
        return 'Message the officers at ' . $email . ', or file a request in the Student Services Portal so you get a tracking ID.';
    }
    if (preg_match('/portal|request|track|document|inquiry/', $q)) {
        return 'Requests and tracking live in the Student Services Portal. Submit a concern there and keep the tracking ID from your email.';
    }
    if (preg_match('/form|handbook|enroll|curriculum/', $q)) {
        return 'Official forms, the student handbook, and enrollment files are in the Resources library.';
    }

    return chat_wait_reply();
}

function chat_wait_reply(): string
{
    return 'Thank you for your message. Please wait. An officer will reply here shortly.';
}

/** @return list<string> */
function chat_wait_replies(): array
{
    return [
        chat_wait_reply(),
        'Thank you for your message. Please wait — an officer will reply here shortly.',
    ];
}

function chat_is_wait_reply(string $body): bool
{
    return in_array($body, chat_wait_replies(), true);
}

function chat_wait_sent_today(PDO $pdo, int $threadId): bool
{
    $start = date('Y-m-d') . ' 00:00:00';
    $end = date('Y-m-d', strtotime('+1 day')) . ' 00:00:00';
    $bodies = chat_wait_replies();
    $placeholders = [];
    $params = [
        'id' => $threadId,
        'start' => $start,
        'end' => $end,
    ];
    foreach ($bodies as $index => $body) {
        $key = 'body' . $index;
        $placeholders[] = ':' . $key;
        $params[$key] = $body;
    }
    $stmt = $pdo->prepare(
        'SELECT 1
         FROM chat_messages
         WHERE thread_id = :id
           AND role = \'bot\'
           AND body IN (' . implode(', ', $placeholders) . ')
           AND created_at >= :start
           AND created_at < :end
         LIMIT 1'
    );
    $stmt->execute($params);
    return (bool) $stmt->fetchColumn();
}

/** @return list<array{id:int,role:string,body:string,createdAt:?string}> */
function chat_messages(PDO $pdo, int $threadId): array
{
    $stmt = $pdo->prepare(
        'SELECT id, role, body, created_at FROM chat_messages WHERE thread_id = :id ORDER BY id ASC'
    );
    $stmt->execute(['id' => $threadId]);
    $items = [];
    $seenDays = [];
    foreach ($stmt->fetchAll() as $row) {
        $role = (string) $row['role'];
        $body = (string) $row['body'];
        if ($role === 'bot' && chat_is_wait_reply($body)) {
            $day = substr((string) $row['created_at'], 0, 10);
            if ($day !== '' && isset($seenDays[$day])) {
                continue;
            }
            if ($day !== '') {
                $seenDays[$day] = true;
            }
        }
        $items[] = chat_message_row($row);
    }
    return $items;
}

function chat_message_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'role' => (string) $row['role'],
        'body' => (string) $row['body'],
        'createdAt' => api_iso((string) $row['created_at']),
    ];
}

function chat_waiting_id_set(PDO $pdo): array
{
    $stmt = $pdo->query(
        "SELECT t.id
         FROM chat_threads t
         WHERE (
            SELECT m.role
            FROM chat_messages m
            WHERE m.thread_id = t.id AND m.role IN ('visitor', 'staff')
            ORDER BY m.id DESC
            LIMIT 1
         ) = 'visitor'"
    );
    $ids = [];
    foreach ($stmt ? $stmt->fetchAll() : [] as $row) {
        $ids[(int) $row['id']] = true;
    }
    return $ids;
}

function chat_unread_from_messages(array $messages): bool
{
    for ($i = count($messages) - 1; $i >= 0; $i--) {
        $role = (string) ($messages[$i]['role'] ?? '');
        if ($role === 'staff') {
            return false;
        }
        if ($role === 'visitor') {
            return true;
        }
    }
    return false;
}

function chat_thread_row(array $row, ?array $messages = null, ?array $waitingIds = null): array
{
    $id = (int) $row['id'];
    $lastRole = (string) ($row['last_role'] ?? 'bot');
    $unread = $messages !== null
        ? chat_unread_from_messages($messages)
        : ($waitingIds !== null ? isset($waitingIds[$id]) : $lastRole === 'visitor');
    $payload = [
        'id' => $id,
        'token' => (string) $row['token'],
        'preview' => (string) ($row['preview'] ?? ''),
        'lastRole' => $lastRole,
        'unread' => $unread,
        'visitorTyping' => chat_is_recent_typing($row['visitor_typing_at'] ?? null),
        'staffTyping' => chat_is_recent_typing($row['staff_typing_at'] ?? null),
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
    if ($messages !== null) {
        $payload['messages'] = $messages;
    }
    return $payload;
}

function chat_add_message(PDO $pdo, int $threadId, string $role, string $body): void
{
    $preview = mb_substr(preg_replace('/\s+/', ' ', $body) ?? $body, 0, 160);
    $stmt = $pdo->prepare(
        'INSERT INTO chat_messages (thread_id, role, body) VALUES (:thread_id, :role, :body)'
    );
    $stmt->execute([
        'thread_id' => $threadId,
        'role' => $role,
        'body' => $body,
    ]);
    if ($role === 'bot') {
        $update = $pdo->prepare(
            'UPDATE chat_threads SET preview = :preview, updated_at = :updated_at WHERE id = :id'
        );
        $update->execute([
            'preview' => $preview,
            'updated_at' => api_now(),
            'id' => $threadId,
        ]);
        return;
    }
    $clearCol = $role === 'staff' ? 'staff_typing_at' : 'visitor_typing_at';
    $update = $pdo->prepare(
        "UPDATE chat_threads
         SET preview = :preview, last_role = :role, updated_at = :updated_at, {$clearCol} = NULL
         WHERE id = :id"
    );
    $update->execute([
        'preview' => $preview,
        'role' => $role,
        'updated_at' => api_now(),
        'id' => $threadId,
    ]);
}

function chat_find_by_token(PDO $pdo, string $token): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM chat_threads WHERE token = :token LIMIT 1');
    $stmt->execute(['token' => $token]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function chat_get(): never
{
    $pdo = api_pdo();
    chat_ensure_tables($pdo);

    $token = trim((string) ($_GET['token'] ?? ''));
    $id = (int) ($_GET['id'] ?? 0);
    $all = (string) ($_GET['all'] ?? '') === '1';

    if ((string) ($_GET['faqs'] ?? '') === '1') {
        if ($all) {
            api_require_manager();
        }
        api_json(['ok' => true, 'items' => chat_faqs($pdo, $all)]);
    }

    if ($token !== '') {
        if (!preg_match('/^[a-f0-9]{32}$/', $token)) {
            api_json(['ok' => false, 'error' => 'Invalid chat session.'], 422);
        }
        $row = chat_find_by_token($pdo, $token);
        if (!$row) {
            api_json(['ok' => true, 'item' => null, 'messages' => []]);
        }
        api_json([
            'ok' => true,
            'item' => chat_thread_row($row, chat_messages($pdo, (int) $row['id'])),
        ]);
    }

    api_require_manager();

    if ($id > 0) {
        $stmt = $pdo->prepare('SELECT * FROM chat_threads WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Conversation not found.'], 404);
        }
        api_json([
            'ok' => true,
            'item' => chat_thread_row($row, chat_messages($pdo, $id)),
        ]);
    }

    if ($all) {
        $stmt = $pdo->query(
            'SELECT * FROM chat_threads ORDER BY updated_at DESC, id DESC LIMIT 200'
        );
        $waitingIds = chat_waiting_id_set($pdo);
        $items = [];
        foreach ($stmt ? $stmt->fetchAll() : [] as $row) {
            $items[] = chat_thread_row($row, null, $waitingIds);
        }
        api_json(['ok' => true, 'items' => $items]);
    }

    api_json(['ok' => false, 'error' => 'Missing chat token.'], 422);
}

function chat_post_typing(PDO $pdo, array $body, int $threadId): never
{
    $active = filter_var($body['typing'] ?? false, FILTER_VALIDATE_BOOLEAN);
    $token = strtolower(trim((string) ($body['token'] ?? '')));

    if ($threadId > 0 && $token === '') {
        api_require_manager();
        $stmt = $pdo->prepare('SELECT id FROM chat_threads WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $threadId]);
        if (!$stmt->fetch()) {
            api_json(['ok' => false, 'error' => 'Conversation not found.'], 404);
        }
        chat_touch_typing($pdo, $threadId, 'staff', $active);
        api_json(['ok' => true, 'typing' => $active]);
    }

    if ($token === '' || !preg_match('/^[a-f0-9]{32}$/', $token)) {
        api_json(['ok' => true, 'typing' => false]);
    }
    $row = chat_find_by_token($pdo, $token);
    if (!$row) {
        api_json(['ok' => true, 'typing' => false]);
    }
    chat_touch_typing($pdo, (int) $row['id'], 'visitor', $active);
    api_json(['ok' => true, 'typing' => $active]);
}

function chat_post(): never
{
    $pdo = api_pdo();
    chat_ensure_tables($pdo);
    $body = api_read_json();
    $threadId = (int) ($body['threadId'] ?? $body['id'] ?? 0);
    $text = trim((string) ($body['body'] ?? $body['text'] ?? ''));

    if (array_key_exists('typing', $body) && $text === '') {
        chat_post_typing($pdo, $body, $threadId);
    }

    if (isset($body['faq']) && is_array($body['faq'])) {
        api_require_manager();
        $payload = chat_faq_payload($body['faq']);
        $faqId = (int) ($body['faq']['id'] ?? $body['faqId'] ?? 0);
        if ($faqId > 0) {
            $existing = chat_faq_find($pdo, $faqId);
            if (!$existing) {
                api_json(['ok' => false, 'error' => 'Suggested question not found.'], 404);
            }
            $stmt = $pdo->prepare(
                'UPDATE chat_faqs
                 SET question = :question, answer = :answer, sort_order = :sort_order, is_published = :is_published
                 WHERE id = :id'
            );
            $stmt->execute($payload + ['id' => $faqId]);
        } else {
            $max = (int) $pdo->query('SELECT COALESCE(MAX(sort_order), -1) FROM chat_faqs')->fetchColumn();
            if (!isset($body['faq']['sortOrder']) && !isset($body['faq']['sort_order'])) {
                $payload['sort_order'] = $max + 1;
            }
            $stmt = $pdo->prepare(
                'INSERT INTO chat_faqs (question, answer, sort_order, is_published)
                 VALUES (:question, :answer, :sort_order, :is_published)'
            );
            $stmt->execute($payload);
            $faqId = (int) $pdo->lastInsertId();
        }
        $row = chat_faq_find($pdo, $faqId);
        api_json(['ok' => true, 'item' => chat_faq_row($row ?? ['id' => $faqId] + $payload)]);
    }

    $faqId = (int) ($body['faqId'] ?? 0);
    if ($faqId > 0 && $threadId <= 0) {
        $faq = chat_faq_find($pdo, $faqId, true);
        if (!$faq) {
            api_json(['ok' => false, 'error' => 'Suggested question not found.'], 404);
        }
        $text = (string) $faq['question'];
        $token = strtolower(trim((string) ($body['token'] ?? '')));
        if ($token !== '' && !preg_match('/^[a-f0-9]{32}$/', $token)) {
            $token = '';
        }
        $row = $token !== '' ? chat_find_by_token($pdo, $token) : null;
        if (!$row) {
            $token = bin2hex(random_bytes(16));
            $insert = $pdo->prepare(
                'INSERT INTO chat_threads (token, preview, last_role) VALUES (:token, :preview, :last_role)'
            );
            $insert->execute([
                'token' => $token,
                'preview' => mb_substr($text, 0, 160),
                'last_role' => 'visitor',
            ]);
            $threadId = (int) $pdo->lastInsertId();
            chat_add_message($pdo, $threadId, 'bot', chat_welcome());
        } else {
            $threadId = (int) $row['id'];
            $token = (string) $row['token'];
        }
        chat_add_message($pdo, $threadId, 'visitor', $text);
        chat_add_message($pdo, $threadId, 'bot', (string) $faq['answer']);
        $fresh = $pdo->prepare('SELECT * FROM chat_threads WHERE id = :id LIMIT 1');
        $fresh->execute(['id' => $threadId]);
        $next = $fresh->fetch();
        api_json([
            'ok' => true,
            'item' => chat_thread_row($next ?: ['id' => $threadId, 'token' => $token], chat_messages($pdo, $threadId)),
        ], 201);
    }

    if ($threadId > 0 && !isset($body['token'])) {
        api_require_manager();
        if ($text === '') {
            api_json(['ok' => false, 'error' => 'Write a reply.'], 422);
        }
        if (mb_strlen($text) > 1500) {
            api_json(['ok' => false, 'error' => 'Keep the reply under 1,500 characters.'], 422);
        }
        $stmt = $pdo->prepare('SELECT * FROM chat_threads WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $threadId]);
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Conversation not found.'], 404);
        }
        chat_add_message($pdo, $threadId, 'staff', $text);
        $fresh = $pdo->prepare('SELECT * FROM chat_threads WHERE id = :id LIMIT 1');
        $fresh->execute(['id' => $threadId]);
        $next = $fresh->fetch();
        api_json([
            'ok' => true,
            'item' => chat_thread_row($next ?: $row, chat_messages($pdo, $threadId)),
        ]);
    }

    if ($text === '') {
        api_json(['ok' => false, 'error' => 'Type a message.'], 422);
    }
    if (mb_strlen($text) > 1500) {
        api_json(['ok' => false, 'error' => 'Keep the message under 1,500 characters.'], 422);
    }

    $token = strtolower(trim((string) ($body['token'] ?? '')));
    if ($token !== '' && !preg_match('/^[a-f0-9]{32}$/', $token)) {
        $token = '';
    }
    $row = $token !== '' ? chat_find_by_token($pdo, $token) : null;

    if (!$row) {
        $token = bin2hex(random_bytes(16));
        $insert = $pdo->prepare(
            'INSERT INTO chat_threads (token, preview, last_role) VALUES (:token, :preview, :last_role)'
        );
        $insert->execute([
            'token' => $token,
            'preview' => mb_substr($text, 0, 160),
            'last_role' => 'visitor',
        ]);
        $threadId = (int) $pdo->lastInsertId();
        chat_add_message($pdo, $threadId, 'bot', chat_welcome());
    } else {
        $threadId = (int) $row['id'];
        $token = (string) $row['token'];
    }

    chat_add_message($pdo, $threadId, 'visitor', $text);
    $reply = chat_bot_reply($text);
    if ($reply !== chat_wait_reply() || !chat_wait_sent_today($pdo, $threadId)) {
        chat_add_message($pdo, $threadId, 'bot', $reply);
    }

    $fresh = $pdo->prepare('SELECT * FROM chat_threads WHERE id = :id LIMIT 1');
    $fresh->execute(['id' => $threadId]);
    $next = $fresh->fetch();

    api_json([
        'ok' => true,
        'item' => chat_thread_row($next ?: ['id' => $threadId, 'token' => $token], chat_messages($pdo, $threadId)),
    ], 201);
}

function chat_delete(): never
{
    api_require_manager();
    $pdo = api_pdo();
    chat_ensure_tables($pdo);
    $body = api_read_json();
    $faqId = (int) ($body['faqId'] ?? $_GET['faqId'] ?? 0);
    if ($faqId > 0) {
        $existing = chat_faq_find($pdo, $faqId);
        if (!$existing) {
            api_json(['ok' => false, 'error' => 'Suggested question not found.'], 404);
        }
        $pdo->prepare('DELETE FROM chat_faqs WHERE id = :id')->execute(['id' => $faqId]);
        api_json(['ok' => true]);
    }

    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Conversation not found.'], 404);
    }
    $pdo->prepare('DELETE FROM chat_messages WHERE thread_id = :id')->execute(['id' => $id]);
    $pdo->prepare('DELETE FROM chat_threads WHERE id = :id')->execute(['id' => $id]);
    api_json(['ok' => true]);
}
