<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/mailer.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => requests_get(),
        'POST' => requests_post(),
        'PUT', 'PATCH' => requests_update(),
        'DELETE' => requests_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json([
        'ok' => false,
        'error' => 'Database unavailable. Import database/migrations/006_portal_requests.sql and start MySQL.',
        'detail' => $error->getMessage(),
    ], 503);
}

/** @return list<string> */
function requests_allowed_statuses(): array
{
    return ['Submitted', 'Received', 'In review', 'Replied', 'Closed'];
}

function requests_ensure_replies_table(): void
{
    static $done = false;
    if ($done) {
        return;
    }
    api_pdo()->exec(
        'CREATE TABLE IF NOT EXISTS portal_request_replies (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            request_id INT UNSIGNED NOT NULL,
            subject VARCHAR(255) NOT NULL,
            body_html MEDIUMTEXT NOT NULL,
            body_text TEXT NOT NULL,
            attachments_json JSON NULL,
            sent_by INT UNSIGNED NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_portal_request_replies_request (request_id),
            KEY idx_portal_request_replies_created (created_at)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $done = true;
}

/**
 * @return list<array{id:int,subject:string,bodyHtml:string,bodyText:string,attachments:list<array{name:string,path:string,mime:string}>,sentAt:string}>
 */
function requests_fetch_replies(int $requestId): array
{
    if ($requestId <= 0) {
        return [];
    }
    requests_ensure_replies_table();
    $stmt = api_pdo()->prepare(
        'SELECT id, subject, body_html, body_text, attachments_json, created_at
         FROM portal_request_replies
         WHERE request_id = :id
         ORDER BY created_at ASC, id ASC'
    );
    $stmt->execute(['id' => $requestId]);
    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $attachments = [];
        $raw = $row['attachments_json'] ?? null;
        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                foreach ($decoded as $file) {
                    if (!is_array($file)) {
                        continue;
                    }
                    $name = trim((string) ($file['name'] ?? ''));
                    $path = trim((string) ($file['path'] ?? ''));
                    if ($name === '' || $path === '') {
                        continue;
                    }
                    $attachments[] = [
                        'name' => $name,
                        'path' => $path,
                        'mime' => (string) ($file['mime'] ?? 'application/octet-stream'),
                    ];
                }
            }
        }
        $items[] = [
            'id' => (int) $row['id'],
            'subject' => (string) $row['subject'],
            'bodyHtml' => (string) $row['body_html'],
            'bodyText' => (string) $row['body_text'],
            'attachments' => $attachments,
            'sentAt' => api_iso((string) $row['created_at']) ?? date('c'),
        ];
    }
    return $items;
}

function requests_row(array $row, bool $admin = false, bool $withReplies = false): array
{
    $item = [
        'id' => (string) $row['tracking_id'],
        'name' => (string) $row['sender_name'],
        'email' => (string) $row['sender_email'],
        'subject' => (string) $row['subject'],
        'attachment' => (string) $row['attachment_name'],
        'submittedAt' => api_iso((string) $row['created_at']) ?? date('c'),
        'status' => (string) $row['status'],
        'mailSent' => (int) ($row['mail_sent'] ?? 0) === 1,
    ];

    if ($admin) {
        $item['dbId'] = (int) ($row['id'] ?? 0);
        $item['body'] = isset($row['body']) ? (string) $row['body'] : null;
        $item['mailError'] = $row['mail_error'] !== null && $row['mail_error'] !== ''
            ? (string) $row['mail_error']
            : null;
        $item['updatedAt'] = isset($row['updated_at'])
            ? api_iso((string) $row['updated_at'])
            : null;
        if ($withReplies) {
            $item['replies'] = requests_fetch_replies((int) ($row['id'] ?? 0));
        }
    }

    return $item;
}

function requests_get(): never
{
    $download = (string) ($_GET['download'] ?? '') === '1';
    $all = (string) ($_GET['all'] ?? '') === '1';
    $tracking = strtoupper(trim((string) ($_GET['id'] ?? $_GET['tracking'] ?? '')));
    $dbId = (int) ($_GET['dbId'] ?? 0);

    if ($download) {
        api_require_manager();
        $replyId = (int) ($_GET['replyId'] ?? 0);
        $replyFile = (string) ($_GET['replyFile'] ?? '');
        if ($replyId > 0) {
            requests_download_reply_attachment($replyId, $replyFile);
        }
        requests_download($tracking, $dbId);
    }

    if ($all) {
        api_require_manager();
        $stmt = api_pdo()->query(
            'SELECT id, tracking_id, sender_name, sender_email, subject, body, attachment_name,
                    status, mail_sent, mail_error, created_at, updated_at
             FROM portal_requests
             ORDER BY created_at DESC, id DESC'
        );
        $items = [];
        foreach ($stmt->fetchAll() as $row) {
            $items[] = requests_row($row, true);
        }
        api_json(['ok' => true, 'items' => $items]);
    }

    if ($tracking === '' && $dbId <= 0) {
        api_json(['ok' => false, 'error' => 'Enter a tracking ID.'], 422);
    }

    $manager = api_current_user();
    $isManager = false;
    if ($manager) {
        $role = strtolower((string) ($manager['role'] ?? ''));
        $isManager = in_array($role, ['admin', 'officer'], true);
    }

    if ($dbId > 0) {
        if (!$isManager) {
            api_json(['ok' => false, 'error' => 'No matching request was found.'], 404);
        }
        $stmt = api_pdo()->prepare(
            'SELECT id, tracking_id, sender_name, sender_email, subject, body, attachment_name,
                    status, mail_sent, mail_error, created_at, updated_at
             FROM portal_requests
             WHERE id = :id
             LIMIT 1'
        );
        $stmt->execute(['id' => $dbId]);
    } elseif ($isManager) {
        $stmt = api_pdo()->prepare(
            'SELECT id, tracking_id, sender_name, sender_email, subject, body, attachment_name,
                    status, mail_sent, mail_error, created_at, updated_at
             FROM portal_requests
             WHERE tracking_id = :id
             LIMIT 1'
        );
        $stmt->execute(['id' => $tracking]);
    } else {
        $stmt = api_pdo()->prepare(
            'SELECT tracking_id, sender_name, sender_email, subject, attachment_name, status, mail_sent, created_at
             FROM portal_requests
             WHERE tracking_id = :id
             LIMIT 1'
        );
        $stmt->execute(['id' => $tracking]);
    }

    $row = $stmt->fetch();
    if (!$row) {
        api_json(['ok' => false, 'error' => 'No matching request was found.'], 404);
    }

    api_json(['ok' => true, 'item' => requests_row($row, $isManager, $isManager)]);
}

function requests_stream_file(string $path, string $name, ?string $mime = null): never
{
    if (!is_file($path)) {
        api_json(['ok' => false, 'error' => 'Attachment file is missing.'], 404);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $detected = $finfo->file($path) ?: 'application/octet-stream';
    $contentType = $mime !== null && $mime !== '' ? $mime : $detected;
    $safeName = str_replace(['"', "\r", "\n"], '', $name);

    $inline = (string) ($_GET['inline'] ?? '') === '1';
    $disposition = $inline ? 'inline' : 'attachment';

    api_security_headers();
    header('Content-Type: ' . $contentType);
    header('Content-Length: ' . (string) filesize($path));
    header('Content-Disposition: ' . $disposition . '; filename="' . $safeName . '"');
    header('Cache-Control: private, no-store');
    readfile($path);
    exit;
}

function requests_download(string $tracking, int $dbId): never
{
    if ($dbId > 0) {
        $stmt = api_pdo()->prepare(
            'SELECT attachment_name, attachment_path FROM portal_requests WHERE id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $dbId]);
    } elseif ($tracking !== '') {
        $stmt = api_pdo()->prepare(
            'SELECT attachment_name, attachment_path FROM portal_requests WHERE tracking_id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $tracking]);
    } else {
        api_json(['ok' => false, 'error' => 'Enter a tracking ID.'], 422);
    }

    $row = $stmt->fetch();
    if (!$row) {
        api_json(['ok' => false, 'error' => 'No matching request was found.'], 404);
    }

    $relative = (string) ($row['attachment_path'] ?? '');
    $name = (string) ($row['attachment_name'] ?? 'attachment');
    $basename = basename(str_replace('\\', '/', $relative));
    $path = api_private_uploads_dir('requests') . DIRECTORY_SEPARATOR . $basename;

    if ($basename === '' || !is_file($path)) {
        api_json(['ok' => false, 'error' => 'Attachment file is missing.'], 404);
    }

    requests_stream_file($path, $name);
}

function requests_download_reply_attachment(int $replyId, string $fileKey): never
{
    requests_ensure_replies_table();
    $stmt = api_pdo()->prepare(
        'SELECT attachments_json FROM portal_request_replies WHERE id = :id LIMIT 1'
    );
    $stmt->execute(['id' => $replyId]);
    $row = $stmt->fetch();
    if (!$row) {
        api_json(['ok' => false, 'error' => 'Reply attachment not found.'], 404);
    }

    $raw = $row['attachments_json'] ?? null;
    $decoded = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
    if (!is_array($decoded) || $decoded === []) {
        api_json(['ok' => false, 'error' => 'Reply attachment not found.'], 404);
    }

    $fileKey = trim($fileKey);
    $match = null;
    foreach ($decoded as $index => $file) {
        if (!is_array($file)) {
            continue;
        }
        $pathRel = (string) ($file['path'] ?? '');
        $basename = basename(str_replace('\\', '/', $pathRel));
        if (
            $fileKey === ''
            || $fileKey === (string) $index
            || $fileKey === $basename
            || $fileKey === (string) ($file['name'] ?? '')
        ) {
            $match = $file;
            break;
        }
    }

    if (!is_array($match)) {
        api_json(['ok' => false, 'error' => 'Reply attachment not found.'], 404);
    }

    $basename = basename(str_replace('\\', '/', (string) ($match['path'] ?? '')));
    if ($basename === '' || $basename === '.' || $basename === '..') {
        api_json(['ok' => false, 'error' => 'Reply attachment not found.'], 404);
    }
    $path = api_private_uploads_dir('requests') . DIRECTORY_SEPARATOR . $basename;
    $name = (string) ($match['name'] ?? $basename);
    $mime = (string) ($match['mime'] ?? '');

    requests_stream_file($path, $name, $mime !== '' ? $mime : null);
}

function requests_update(): never
{
    api_require_manager();
    $body = api_read_json();

    if (($body['action'] ?? '') === 'reply') {
        requests_reply($body);
    }

    $dbId = (int) ($body['dbId'] ?? $body['id'] ?? 0);
    $tracking = strtoupper(trim((string) ($body['trackingId'] ?? $body['tracking'] ?? '')));
    $status = trim((string) ($body['status'] ?? ''));

    if (!in_array($status, requests_allowed_statuses(), true)) {
        api_json(['ok' => false, 'error' => 'Choose a valid status.'], 422);
    }

    if ($dbId <= 0 && $tracking === '') {
        api_json(['ok' => false, 'error' => 'Request id is required.'], 422);
    }

    $pdo = api_pdo();
    if ($dbId > 0) {
        $stmt = $pdo->prepare(
            'UPDATE portal_requests SET status = :status WHERE id = :id'
        );
        $stmt->execute(['status' => $status, 'id' => $dbId]);
        if ($stmt->rowCount() === 0) {
            $check = $pdo->prepare('SELECT 1 FROM portal_requests WHERE id = :id LIMIT 1');
            $check->execute(['id' => $dbId]);
            if (!$check->fetchColumn()) {
                api_json(['ok' => false, 'error' => 'Request not found.'], 404);
            }
        }
        $fetch = $pdo->prepare(
            'SELECT id, tracking_id, sender_name, sender_email, subject, body, attachment_name,
                    status, mail_sent, mail_error, created_at, updated_at
             FROM portal_requests WHERE id = :id LIMIT 1'
        );
        $fetch->execute(['id' => $dbId]);
    } else {
        $stmt = $pdo->prepare(
            'UPDATE portal_requests SET status = :status WHERE tracking_id = :id'
        );
        $stmt->execute(['status' => $status, 'id' => $tracking]);
        $fetch = $pdo->prepare(
            'SELECT id, tracking_id, sender_name, sender_email, subject, body, attachment_name,
                    status, mail_sent, mail_error, created_at, updated_at
             FROM portal_requests WHERE tracking_id = :id LIMIT 1'
        );
        $fetch->execute(['id' => $tracking]);
    }

    $row = $fetch->fetch();
    if (!$row) {
        api_json(['ok' => false, 'error' => 'Request not found.'], 404);
    }

    api_json(['ok' => true, 'item' => requests_row($row, true)]);
}

function requests_post(): never
{
    if (($_POST['action'] ?? '') === 'reply') {
        api_require_manager();
        requests_reply([
            'dbId' => (int) ($_POST['dbId'] ?? $_POST['id'] ?? 0),
            'trackingId' => (string) ($_POST['trackingId'] ?? $_POST['tracking'] ?? ''),
            'message' => (string) ($_POST['message'] ?? $_POST['body'] ?? ''),
            'subject' => (string) ($_POST['subject'] ?? ''),
            '_files' => requests_collect_reply_uploads(),
        ]);
    }

    requests_create();
}

/**
 * @return list<array{path:string,name:string,mime:string}>
 */
function requests_collect_reply_uploads(): array
{
    $bag = $_FILES['files'] ?? $_FILES['files_0'] ?? $_FILES['file'] ?? null;
    if (!is_array($bag)) {
        // Some clients send files[0], files[1], …
        $indexed = [];
        foreach ($_FILES as $key => $value) {
            if (is_string($key) && preg_match('/^files(?:_|\b)/', $key) && is_array($value)) {
                $indexed[] = $value;
            }
        }
        if ($indexed === []) {
            return [];
        }
        $bag = [
            'name' => array_map(static fn($f) => $f['name'] ?? 'attachment', $indexed),
            'type' => array_map(static fn($f) => $f['type'] ?? '', $indexed),
            'tmp_name' => array_map(static fn($f) => $f['tmp_name'] ?? '', $indexed),
            'error' => array_map(static fn($f) => (int) ($f['error'] ?? UPLOAD_ERR_NO_FILE), $indexed),
            'size' => array_map(static fn($f) => (int) ($f['size'] ?? 0), $indexed),
        ];
    }

    $names = $bag['name'] ?? null;
    $entries = [];
    if (is_array($names)) {
        foreach (array_keys($names) as $index) {
            $entries[] = [
                'name' => (string) ($bag['name'][$index] ?? 'attachment'),
                'type' => (string) ($bag['type'][$index] ?? ''),
                'tmp_name' => (string) ($bag['tmp_name'][$index] ?? ''),
                'error' => (int) ($bag['error'][$index] ?? UPLOAD_ERR_NO_FILE),
                'size' => (int) ($bag['size'][$index] ?? 0),
            ];
        }
    } else {
        $entries[] = [
            'name' => (string) ($bag['name'] ?? 'attachment'),
            'type' => (string) ($bag['type'] ?? ''),
            'tmp_name' => (string) ($bag['tmp_name'] ?? ''),
            'error' => (int) ($bag['error'] ?? UPLOAD_ERR_NO_FILE),
            'size' => (int) ($bag['size'] ?? 0),
        ];
    }

    if (count($entries) > 5) {
        api_json(['ok' => false, 'error' => 'You can attach up to 5 files.'], 422);
    }

    $allowed = [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
        'text/plain' => 'txt',
        'application/msword' => 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
        'application/vnd.ms-excel' => 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
        'application/zip' => 'zip',
    ];
    $maxBytes = 10 * 1024 * 1024;
    $storageDir = api_private_uploads_dir('requests');
    if (!is_dir($storageDir) && !mkdir($storageDir, 0755, true) && !is_dir($storageDir)) {
        api_json(['ok' => false, 'error' => 'Could not create upload folder.'], 500);
    }

    $saved = [];
    $finfo = new finfo(FILEINFO_MIME_TYPE);

    foreach ($entries as $file) {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            continue;
        }
        if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
            api_json(['ok' => false, 'error' => 'One of the attachments failed to upload.'], 422);
        }
        $tmp = (string) ($file['tmp_name'] ?? '');
        $size = (int) ($file['size'] ?? 0);
        $original = (string) ($file['name'] ?? 'attachment');
        if ($tmp === '' || !is_uploaded_file($tmp)) {
            api_json(['ok' => false, 'error' => 'Invalid attachment upload.'], 422);
        }
        if ($size <= 0 || $size > $maxBytes) {
            api_json(['ok' => false, 'error' => 'Each attachment must be 10 MB or smaller.'], 422);
        }

        $mime = $finfo->file($tmp) ?: '';
        $ext = $allowed[$mime] ?? null;
        if ($ext === null && preg_match('/\.(pdf|png|jpe?g|webp|gif|docx?|xlsx?|txt|zip)$/i', $original, $m)) {
            $ext = strtolower($m[1] === 'jpeg' ? 'jpg' : $m[1]);
            $mime = $mime !== '' ? $mime : 'application/octet-stream';
        }
        if ($ext === null) {
            api_json(['ok' => false, 'error' => 'Unsupported attachment type: ' . $original], 422);
        }

        $base = api_slugify(pathinfo($original, PATHINFO_FILENAME));
        $filename = sprintf('reply-%s-%s.%s', $base, bin2hex(random_bytes(3)), $ext);
        $dest = $storageDir . DIRECTORY_SEPARATOR . $filename;
        if (!move_uploaded_file($tmp, $dest)) {
            api_json(['ok' => false, 'error' => 'Could not save attachment.'], 500);
        }
        $saved[] = [
            'path' => $dest,
            'name' => $original,
            'mime' => $mime,
        ];
    }

    return $saved;
}

/**
 * @param array<string, mixed> $body
 */
function requests_reply(array $body): never
{
    $dbId = (int) ($body['dbId'] ?? $body['id'] ?? 0);
    $tracking = strtoupper(trim((string) ($body['trackingId'] ?? $body['tracking'] ?? '')));
    $messageRaw = trim((string) ($body['message'] ?? $body['body'] ?? ''));
    $subjectOverride = trim((string) ($body['subject'] ?? ''));
    /** @var list<array{path:string,name:string,mime:string}> $attachments */
    $attachments = is_array($body['_files'] ?? null) ? $body['_files'] : [];

    $messageHtml = api_mail_sanitize_reply_html($messageRaw);
    $messageText = api_mail_html_to_text($messageHtml);

    if ($messageText === '') {
        api_json(['ok' => false, 'error' => 'Enter a reply message.'], 422);
    }
    if (mb_strlen($messageHtml) > 50000) {
        api_json(['ok' => false, 'error' => 'Reply is too long.'], 422);
    }

    $pdo = api_pdo();
    if ($dbId > 0) {
        $stmt = $pdo->prepare(
            'SELECT id, tracking_id, sender_name, sender_email, subject, body, attachment_name,
                    status, mail_sent, mail_error, created_at, updated_at
             FROM portal_requests WHERE id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $dbId]);
    } elseif ($tracking !== '') {
        $stmt = $pdo->prepare(
            'SELECT id, tracking_id, sender_name, sender_email, subject, body, attachment_name,
                    status, mail_sent, mail_error, created_at, updated_at
             FROM portal_requests WHERE tracking_id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $tracking]);
    } else {
        api_json(['ok' => false, 'error' => 'Request id is required.'], 422);
    }

    $row = $stmt->fetch();
    if (!$row) {
        api_json(['ok' => false, 'error' => 'Request not found.'], 404);
    }

    $to = (string) $row['sender_email'];
    $trackingId = (string) $row['tracking_id'];
    $originalSubject = (string) $row['subject'];
    $mailSubject = $subjectOverride !== ''
        ? $subjectOverride
        : 'Re: [' . $trackingId . '] ' . $originalSubject;

    $tpl = api_mail_template_request_reply([
        'tracking' => $trackingId,
        'name' => (string) $row['sender_name'],
        'subject' => $originalSubject,
        'message' => $messageText,
        'messageHtml' => $messageHtml,
        'originalBody' => (string) ($row['body'] ?? ''),
    ]);

    $mailCfg = api_mail_config();
    $council = trim((string) ($mailCfg['to'] ?? $mailCfg['from'] ?? $mailCfg['user'] ?? ''));

    $mailResult = api_send_mail(
        $to,
        $mailSubject,
        $tpl['text'],
        $council !== '' ? $council : null,
        $attachments,
        $tpl['html'],
    );

    if (($mailResult['ok'] ?? false) !== true) {
        api_json([
            'ok' => false,
            'error' => (string) ($mailResult['error'] ?? 'Could not send the reply.'),
        ], 502);
    }

    $storedAttachments = [];
    foreach ($attachments as $file) {
        $abs = (string) ($file['path'] ?? '');
        $basename = basename(str_replace('\\', '/', $abs));
        if ($basename === '' || $basename === '.' || $basename === '..') {
            continue;
        }
        $storedAttachments[] = [
            'name' => (string) ($file['name'] ?? $basename),
            'path' => 'storage/requests/' . $basename,
            'mime' => (string) ($file['mime'] ?? 'application/octet-stream'),
        ];
    }

    requests_ensure_replies_table();
    $actor = api_current_user();
    $insertReply = $pdo->prepare(
        'INSERT INTO portal_request_replies
            (request_id, subject, body_html, body_text, attachments_json, sent_by)
         VALUES
            (:request_id, :subject, :body_html, :body_text, :attachments_json, :sent_by)'
    );
    $insertReply->execute([
        'request_id' => (int) $row['id'],
        'subject' => $mailSubject,
        'body_html' => $messageHtml,
        'body_text' => $messageText,
        'attachments_json' => $storedAttachments === [] ? null : json_encode($storedAttachments, JSON_UNESCAPED_UNICODE),
        'sent_by' => isset($actor['id']) ? (int) $actor['id'] : null,
    ]);

    $update = $pdo->prepare(
        'UPDATE portal_requests SET status = :status WHERE id = :id'
    );
    $update->execute([
        'status' => 'Replied',
        'id' => (int) $row['id'],
    ]);

    $fetch = $pdo->prepare(
        'SELECT id, tracking_id, sender_name, sender_email, subject, body, attachment_name,
                status, mail_sent, mail_error, created_at, updated_at
         FROM portal_requests WHERE id = :id LIMIT 1'
    );
    $fetch->execute(['id' => (int) $row['id']]);
    $fresh = $fetch->fetch() ?: $row;
    $fresh['status'] = 'Replied';

    api_json([
        'ok' => true,
        'item' => requests_row($fresh, true, true),
        'message' => 'Reply sent to ' . $to . '.',
    ]);
}

function requests_delete(): never
{
    api_require_manager();
    $body = api_read_json();
    $dbId = (int) ($body['dbId'] ?? $body['id'] ?? 0);
    $tracking = strtoupper(trim((string) ($body['trackingId'] ?? $body['tracking'] ?? '')));
    $ids = $body['ids'] ?? null;

    $pdo = api_pdo();

    if (is_array($ids) && $ids !== []) {
        $deleted = 0;
        foreach ($ids as $raw) {
            $id = (int) $raw;
            if ($id <= 0) {
                continue;
            }
            $row = requests_fetch_for_delete($id, '');
            if (!$row) {
                continue;
            }
            requests_unlink_attachment((string) ($row['attachment_path'] ?? ''));
            requests_unlink_reply_attachments((int) $row['id']);
            $del = $pdo->prepare('DELETE FROM portal_requests WHERE id = :id');
            $del->execute(['id' => $id]);
            $deleted += $del->rowCount();
        }
        api_json(['ok' => true, 'deleted' => $deleted]);
    }

    $row = requests_fetch_for_delete($dbId, $tracking);
    if (!$row) {
        api_json(['ok' => false, 'error' => 'Request not found.'], 404);
    }

    requests_unlink_attachment((string) ($row['attachment_path'] ?? ''));
    requests_unlink_reply_attachments((int) $row['id']);
    $del = $pdo->prepare('DELETE FROM portal_requests WHERE id = :id');
    $del->execute(['id' => (int) $row['id']]);

    api_json(['ok' => true]);
}

function requests_fetch_for_delete(int $dbId, string $tracking): ?array
{
    $pdo = api_pdo();
    if ($dbId > 0) {
        $stmt = $pdo->prepare(
            'SELECT id, attachment_path FROM portal_requests WHERE id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $dbId]);
    } elseif ($tracking !== '') {
        $stmt = $pdo->prepare(
            'SELECT id, attachment_path FROM portal_requests WHERE tracking_id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $tracking]);
    } else {
        return null;
    }
    $row = $stmt->fetch();
    return $row ?: null;
}

function requests_unlink_attachment(string $relative): void
{
    $basename = basename(str_replace('\\', '/', $relative));
    if ($basename === '' || $basename === '.' || $basename === '..') {
        return;
    }
    $path = api_private_uploads_dir('requests') . DIRECTORY_SEPARATOR . $basename;
    if (is_file($path)) {
        @unlink($path);
    }
}

function requests_unlink_reply_attachments(int $requestId): void
{
    if ($requestId <= 0) {
        return;
    }
    try {
        requests_ensure_replies_table();
    } catch (Throwable) {
        return;
    }
    $stmt = api_pdo()->prepare(
        'SELECT attachments_json FROM portal_request_replies WHERE request_id = :id'
    );
    $stmt->execute(['id' => $requestId]);
    foreach ($stmt->fetchAll() as $row) {
        $raw = $row['attachments_json'] ?? null;
        if (!is_string($raw) || $raw === '') {
            continue;
        }
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            continue;
        }
        foreach ($decoded as $file) {
            if (!is_array($file)) {
                continue;
            }
            requests_unlink_attachment((string) ($file['path'] ?? ''));
        }
    }
}

function requests_create(): never
{
    $name = trim((string) ($_POST['name'] ?? ''));
    $email = trim((string) ($_POST['email'] ?? ''));
    $subject = trim((string) ($_POST['subject'] ?? ''));
    $body = trim((string) ($_POST['body'] ?? ''));

    $allowedSubjects = [
        'General Inquiry',
        'Academic Grievances',
        'Document Request',
        'Academic Support',
        'Student Organization Proposal',
        'Feedback/Suggestion/Student concerns tracking',
    ];

    $errors = [];
    if (mb_strlen($name) < 2) {
        $errors['name'] = 'Enter the name of the sender.';
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'Enter a valid email address.';
    }
    if ($subject === '' || !in_array($subject, $allowedSubjects, true)) {
        $errors['subject'] = 'Select a subject.';
    }
    if ($body === '') {
        $errors['body'] = 'Enter the details of your request.';
    }

    $file = $_FILES['file'] ?? $_FILES['attachment'] ?? null;
    if (!is_array($file)) {
        $errors['file'] = 'Attach a PDF, image, or document.';
    }

    if ($errors !== []) {
        api_json(['ok' => false, 'error' => reset($errors), 'errors' => $errors], 422);
    }

    /** @var array $file */
    $uploadError = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($uploadError !== UPLOAD_ERR_OK) {
        $message = match ($uploadError) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'File must be 10 MB or smaller.',
            UPLOAD_ERR_PARTIAL => 'Upload was interrupted. Try again.',
            UPLOAD_ERR_NO_FILE => 'Attach a PDF, image, or document.',
            default => 'Could not upload the attachment.',
        };
        api_json(['ok' => false, 'error' => $message], 422);
    }

    $tmp = (string) ($file['tmp_name'] ?? '');
    $size = (int) ($file['size'] ?? 0);
    $original = (string) ($file['name'] ?? 'attachment');

    if ($tmp === '' || !is_uploaded_file($tmp)) {
        api_json(['ok' => false, 'error' => 'Invalid upload.'], 422);
    }

    $maxBytes = 10 * 1024 * 1024;
    if ($size <= 0 || $size > $maxBytes) {
        api_json(['ok' => false, 'error' => 'File must be 10 MB or smaller.'], 422);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($tmp) ?: '';
    $allowed = [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
        'text/plain' => 'txt',
        'application/msword' => 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
    ];

    $ext = $allowed[$mime] ?? null;
    if ($ext === null) {
        if (preg_match('/\.(pdf|png|jpe?g|webp|gif|docx?|txt)$/i', $original, $m)) {
            $ext = strtolower($m[1] === 'jpeg' ? 'jpg' : $m[1]);
            $mime = $mime !== '' ? $mime : 'application/octet-stream';
        }
    }

    if ($ext === null) {
        api_json(['ok' => false, 'error' => 'Use a PDF, image, or document.'], 422);
    }

    $tracking = requests_make_tracking_id();
    $base = api_slugify(pathinfo($original, PATHINFO_FILENAME));
    $filename = sprintf('%s-%s.%s', $base, bin2hex(random_bytes(4)), $ext);

    $storageDir = api_private_uploads_dir('requests');
    if (!is_dir($storageDir) && !mkdir($storageDir, 0755, true) && !is_dir($storageDir)) {
        api_json(['ok' => false, 'error' => 'Could not create upload folder.'], 500);
    }

    $dest = $storageDir . DIRECTORY_SEPARATOR . $filename;
    if (!move_uploaded_file($tmp, $dest)) {
        api_json(['ok' => false, 'error' => 'Could not save the attachment.'], 500);
    }

    $attachmentPath = 'storage/requests/' . $filename;
    $ip = api_client_ip();

    $pdo = api_pdo();
    $stmt = $pdo->prepare(
        'INSERT INTO portal_requests
          (tracking_id, sender_name, sender_email, subject, body, attachment_name, attachment_path, status, ip_address)
         VALUES
          (:tracking_id, :sender_name, :sender_email, :subject, :body, :attachment_name, :attachment_path, :status, :ip_address)'
    );
    $stmt->execute([
        'tracking_id' => $tracking,
        'sender_name' => $name,
        'sender_email' => $email,
        'subject' => $subject,
        'body' => $body,
        'attachment_name' => $original,
        'attachment_path' => $attachmentPath,
        'status' => 'Submitted',
        'ip_address' => $ip,
    ]);

    $mailCfg = api_mail_config();
    $councilTo = trim((string) ($mailCfg['to'] ?? $mailCfg['from'] ?? $mailCfg['user'] ?? ''));

    $councilTpl = api_mail_template_council_request([
        'tracking' => $tracking,
        'name' => $name,
        'email' => $email,
        'subject' => $subject,
        'body' => $body,
        'attachment' => $original,
    ]);

    $mailResult = ['ok' => false, 'error' => 'Mail recipient is not configured.'];
    if ($councilTo !== '') {
        $mailResult = api_send_mail(
            $councilTo,
            '[' . $tracking . '] ' . $subject,
            $councilTpl['text'],
            $email,
            [
                [
                    'path' => $dest,
                    'name' => $original,
                    'mime' => $mime,
                ],
            ],
            $councilTpl['html'],
        );
    }

    $confirmResult = ['ok' => false];
    if (($mailResult['ok'] ?? false) === true) {
        $confirmTpl = api_mail_template_request_confirmation([
            'tracking' => $tracking,
            'name' => $name,
            'subject' => $subject,
        ]);
        $confirmResult = api_send_mail(
            $email,
            'Request received · ' . $tracking,
            $confirmTpl['text'],
            $councilTo !== '' ? $councilTo : null,
            [],
            $confirmTpl['html'],
        );
    }

    $mailOk = ($mailResult['ok'] ?? false) === true;
    $mailError = $mailOk ? null : (string) ($mailResult['error'] ?? 'Mail could not be sent.');

    $update = $pdo->prepare(
        'UPDATE portal_requests
         SET mail_sent = :mail_sent, mail_error = :mail_error, status = :status
         WHERE tracking_id = :tracking_id'
    );
    $update->execute([
        'mail_sent' => $mailOk ? 1 : 0,
        'mail_error' => $mailError,
        'status' => $mailOk ? 'Submitted' : 'Received',
        'tracking_id' => $tracking,
    ]);

    $stmt = $pdo->prepare(
        'SELECT id, tracking_id, sender_name, sender_email, subject, body, attachment_name,
                status, mail_sent, mail_error, created_at, updated_at
         FROM portal_requests
         WHERE tracking_id = :id
         LIMIT 1'
    );
    $stmt->execute(['id' => $tracking]);
    $row = $stmt->fetch();

    $confirmOk = ($confirmResult['ok'] ?? false) === true;
    $message = !$mailOk
        ? 'Your request was saved. Email delivery is temporarily unavailable; keep your tracking ID.'
        : ($confirmOk
            ? 'Your request was submitted. A confirmation was sent to your email.'
            : 'Your request was submitted to the Student Council. Keep your tracking ID.');

    api_json([
        'ok' => true,
        'item' => requests_row($row ?: [
            'id' => 0,
            'tracking_id' => $tracking,
            'sender_name' => $name,
            'sender_email' => $email,
            'subject' => $subject,
            'body' => $body,
            'attachment_name' => $original,
            'status' => $mailOk ? 'Submitted' : 'Received',
            'mail_sent' => $mailOk ? 1 : 0,
            'mail_error' => $mailError,
            'created_at' => date('c'),
            'updated_at' => date('c'),
        ], false),
        'mailSent' => $mailOk,
        'confirmationSent' => $confirmOk,
        'message' => $message,
    ], 201);
}

function requests_make_tracking_id(): string
{
    $pdo = api_pdo();
    for ($i = 0; $i < 8; $i++) {
        $now = new DateTimeImmutable('now');
        $date = $now->format('Ymd');
        $code = strtoupper(bin2hex(random_bytes(2)));
        $id = 'COL-' . $date . '-' . $code;

        $check = $pdo->prepare('SELECT 1 FROM portal_requests WHERE tracking_id = :id LIMIT 1');
        $check->execute(['id' => $id]);
        if (!$check->fetchColumn()) {
            return $id;
        }
    }

    return 'COL-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
}
