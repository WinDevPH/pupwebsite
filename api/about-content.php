<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/about-content-defaults.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => about_content_get(),
        'PUT', 'PATCH' => about_content_put(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json([
        'ok' => false,
        'error' => 'Database unavailable. Run scripts/run-011-about-content.php and start MySQL.',
        'detail' => $error->getMessage(),
    ], 503);
}

function about_content_ensure_tables(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS about_content (
          section_key VARCHAR(64) NOT NULL,
          payload_json LONGTEXT NOT NULL,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (section_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $ready = true;
}

function about_content_normalize_key(string $key): string
{
    $key = strtolower(trim($key));
    return in_array($key, about_content_section_keys(), true) ? $key : '';
}

function about_content_normalize_html(string $html): string
{
    return trim($html);
}

function about_content_html_empty(string $html): bool
{
    $plain = trim(html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    $plain = preg_replace('/\s+/u', ' ', $plain) ?? $plain;
    return $plain === '';
}

function about_content_decode_payload(string $json, string $section): array
{
    $decoded = json_decode($json, true);
    if (!is_array($decoded)) {
        $defaults = about_content_defaults();
        return $defaults[$section] ?? [];
    }
    return $decoded;
}

function about_content_validate_payload(string $section, array $payload): array
{
    if ($section === 'mission' || $section === 'vision') {
        $text = about_content_normalize_html((string) ($payload['text'] ?? ''));
        if (about_content_html_empty($text)) {
            api_json(['ok' => false, 'error' => ucfirst($section) . ' text is required.'], 422);
        }
        return ['text' => $text];
    }

    $rawItems = $payload['items'] ?? null;
    if (!is_array($rawItems)) {
        api_json(['ok' => false, 'error' => 'Items must be a list.'], 422);
    }

    $items = [];
    foreach ($rawItems as $index => $row) {
        if (!is_array($row)) {
            continue;
        }
        $title = trim((string) ($row['title'] ?? ''));
        $text = about_content_normalize_html((string) ($row['text'] ?? ''));
        if ($title === '' && about_content_html_empty($text)) {
            continue;
        }
        if ($title === '' || about_content_html_empty($text)) {
            api_json([
                'ok' => false,
                'error' => 'Each item needs a title and text (item ' . ((int) $index + 1) . ').',
            ], 422);
        }

        if ($section === 'history') {
            $when = trim((string) ($row['when'] ?? ''));
            if ($when === '') {
                api_json(['ok' => false, 'error' => 'Each history mark needs a date/when label.'], 422);
            }
            $items[] = [
                'when' => $when,
                'title' => $title,
                'text' => $text,
                'note' => trim((string) ($row['note'] ?? '')),
            ];
            continue;
        }

        $icon = trim((string) ($row['icon'] ?? 'scale'));
        if ($icon === '') {
            $icon = 'scale';
        }
        $items[] = [
            'icon' => $icon,
            'title' => $title,
            'text' => $text,
        ];
    }

    if ($items === []) {
        api_json(['ok' => false, 'error' => 'Add at least one item.'], 422);
    }

    return ['items' => $items];
}

function about_content_load_all(PDO $pdo): array
{
    about_content_ensure_tables($pdo);
    $defaults = about_content_defaults();
    $sections = [];
    foreach (about_content_section_keys() as $key) {
        $sections[$key] = $defaults[$key];
    }

    $stmt = $pdo->query('SELECT section_key, payload_json, updated_at FROM about_content');
    if ($stmt) {
        foreach ($stmt->fetchAll() as $row) {
            $key = about_content_normalize_key((string) ($row['section_key'] ?? ''));
            if ($key === '') {
                continue;
            }
            $sections[$key] = about_content_decode_payload((string) $row['payload_json'], $key);
            $sections[$key]['_updatedAt'] = api_iso((string) $row['updated_at']);
        }
    }

    return $sections;
}

function about_content_get(): never
{
    $pdo = api_pdo();
    $section = about_content_normalize_key((string) ($_GET['section'] ?? ''));
    $all = about_content_load_all($pdo);

    if ($section !== '') {
        api_json([
            'ok' => true,
            'section' => $section,
            'payload' => $all[$section] ?? about_content_defaults()[$section],
        ]);
    }

    $clean = [];
    foreach ($all as $key => $payload) {
        unset($payload['_updatedAt']);
        $clean[$key] = $payload;
    }

    api_json(['ok' => true, 'sections' => $clean]);
}

function about_content_put(): never
{
    api_require_manager();
    $pdo = api_pdo();
    about_content_ensure_tables($pdo);
    $body = api_read_json();

    $updates = [];
    if (isset($body['sections']) && is_array($body['sections'])) {
        foreach ($body['sections'] as $key => $payload) {
            $section = about_content_normalize_key((string) $key);
            if ($section === '' || !is_array($payload)) {
                continue;
            }
            $updates[$section] = about_content_validate_payload($section, $payload);
        }
    } else {
        $section = about_content_normalize_key((string) ($body['section'] ?? ''));
        if ($section === '') {
            api_json(['ok' => false, 'error' => 'Unknown about section.'], 422);
        }
        $payload = $body['payload'] ?? null;
        if (!is_array($payload)) {
            api_json(['ok' => false, 'error' => 'Payload is required.'], 422);
        }
        $updates[$section] = about_content_validate_payload($section, $payload);
    }

    if ($updates === []) {
        api_json(['ok' => false, 'error' => 'Nothing to save.'], 422);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO about_content (section_key, payload_json)
         VALUES (:section_key, :payload_json)
         ON DUPLICATE KEY UPDATE payload_json = VALUES(payload_json)'
    );

    foreach ($updates as $section => $payload) {
        $stmt->execute([
            'section_key' => $section,
            'payload_json' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);
    }

    $all = about_content_load_all($pdo);
    $clean = [];
    foreach ($all as $key => $payload) {
        unset($payload['_updatedAt']);
        $clean[$key] = $payload;
    }

    api_json(['ok' => true, 'sections' => $clean, 'saved' => array_keys($updates)]);
}
