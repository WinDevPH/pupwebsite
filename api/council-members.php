<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => council_members_get(),
        'POST' => council_members_create(),
        'PUT', 'PATCH' => council_members_put(),
        'DELETE' => council_members_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json([
        'ok' => false,
        'error' => 'Database unavailable. Import database/migrations/008_council_members.sql and start MySQL.',
        'detail' => $error->getMessage(),
    ], 503);
}

function council_ensure_display_settings(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS council_display_settings (
          board ENUM('officers', 'commissioners', 'advisory') NOT NULL,
          pinned_academic_year VARCHAR(32) NULL,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (board)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function council_get_pinned_year(PDO $pdo, string $board): ?string
{
    council_ensure_display_settings($pdo);
    $stmt = $pdo->prepare(
        'SELECT pinned_academic_year FROM council_display_settings WHERE board = :board LIMIT 1'
    );
    $stmt->execute(['board' => $board]);
    $row = $stmt->fetch();
    if (!$row) {
        return null;
    }
    $year = council_normalize_year((string) ($row['pinned_academic_year'] ?? ''));
    return $year !== '' ? $year : null;
}

/**
 * Resolve which academic year the public page should show for a board.
 * Pinned year wins when it has at least one published seat; otherwise latest published.
 */
function council_resolve_public_year(PDO $pdo, string $board, string $requestedYear = ''): string
{
    if ($requestedYear !== '') {
        return $requestedYear;
    }

    $pinned = council_get_pinned_year($pdo, $board);
    if ($pinned !== null) {
        $check = $pdo->prepare(
            'SELECT 1 FROM council_members
             WHERE board = :board AND academic_year = :year AND is_published = 1
             LIMIT 1'
        );
        $check->execute(['board' => $board, 'year' => $pinned]);
        if ($check->fetch()) {
            return $pinned;
        }
    }

    $latest = $pdo->prepare(
        'SELECT academic_year FROM council_members
         WHERE board = :board AND is_published = 1
         ORDER BY academic_year DESC, id DESC
         LIMIT 1'
    );
    $latest->execute(['board' => $board]);
    $latestRow = $latest->fetch();
    return $latestRow ? (string) $latestRow['academic_year'] : '';
}

/** @return list<string> */
function council_boards(): array
{
    return ['officers', 'commissioners', 'advisory'];
}

/**
 * @return array<string, list<string>>
 */
function council_sections_by_board(): array
{
    return [
        'officers' => ['executive', 'year_reps', 'associates'],
        'commissioners' => ['commission'],
        'advisory' => ['advisory'],
    ];
}

function council_normalize_year(string $year): string
{
    $year = trim($year);
    $year = str_replace(['-', '—', '–'], '–', $year);
    $year = preg_replace('/\s+/', '', $year) ?? $year;
    return $year;
}

function council_members_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'academicYear' => (string) $row['academic_year'],
        'board' => (string) $row['board'],
        'section' => (string) $row['section'],
        'role' => (string) $row['role_title'],
        'name' => (string) $row['full_name'],
        'photo' => $row['photo_url'] !== null && $row['photo_url'] !== ''
            ? (string) $row['photo_url']
            : null,
        'vacant' => (int) ($row['is_vacant'] ?? 0) === 1,
        'sortOrder' => (int) ($row['sort_order'] ?? 0),
        'published' => (int) ($row['is_published'] ?? 0) === 1,
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}

function council_members_get(): never
{
    $pdo = api_pdo();
    $id = (int) ($_GET['id'] ?? 0);
    $board = strtolower(trim((string) ($_GET['board'] ?? '')));
    $year = council_normalize_year((string) ($_GET['year'] ?? $_GET['academicYear'] ?? ''));
    $includeAll = (string) ($_GET['all'] ?? '') === '1';
    $yearsOnly = (string) ($_GET['years'] ?? '') === '1';
    $displayOnly = (string) ($_GET['display'] ?? '') === '1';

    if ($displayOnly) {
        if (!in_array($board, council_boards(), true)) {
            api_json(['ok' => false, 'error' => 'Choose a valid board.'], 422);
        }
        $pinned = council_get_pinned_year($pdo, $board);
        $resolved = council_resolve_public_year($pdo, $board);
        api_json([
            'ok' => true,
            'board' => $board,
            'pinnedYear' => $pinned,
            'publicYear' => $resolved !== '' ? $resolved : null,
            'mode' => $pinned !== null ? 'pinned' : 'auto',
        ]);
    }

    if ($yearsOnly) {
        if ($includeAll) {
            api_require_manager();
            $sql = 'SELECT DISTINCT academic_year FROM council_members';
            $params = [];
            if (in_array($board, council_boards(), true)) {
                $sql .= ' WHERE board = :board';
                $params['board'] = $board;
            }
            $sql .= ' ORDER BY academic_year DESC';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        } else {
            $sql = 'SELECT DISTINCT academic_year FROM council_members WHERE is_published = 1';
            $params = [];
            if (in_array($board, council_boards(), true)) {
                $sql .= ' AND board = :board';
                $params['board'] = $board;
            }
            $sql .= ' ORDER BY academic_year DESC';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        }
        $years = [];
        foreach ($stmt->fetchAll() as $row) {
            $years[] = (string) $row['academic_year'];
        }
        api_json(['ok' => true, 'years' => $years]);
    }

    if ($id > 0) {
        $stmt = $pdo->prepare('SELECT * FROM council_members WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Member not found.'], 404);
        }
        if ((int) $row['is_published'] !== 1) {
            $user = api_current_user();
            $role = strtolower((string) ($user['role'] ?? ''));
            if (!in_array($role, ['admin', 'officer'], true)) {
                api_json(['ok' => false, 'error' => 'Member not found.'], 404);
            }
        }
        api_json(['ok' => true, 'item' => council_members_row($row)]);
    }

    if ($includeAll) {
        api_require_manager();
        $sql = 'SELECT * FROM council_members WHERE 1=1';
        $params = [];
        if (in_array($board, council_boards(), true)) {
            $sql .= ' AND board = :board';
            $params['board'] = $board;
        }
        if ($year !== '') {
            $sql .= ' AND academic_year = :year';
            $params['year'] = $year;
        }
        $sql .= ' ORDER BY academic_year DESC, board ASC, sort_order ASC, id ASC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    } else {
        if (!in_array($board, council_boards(), true)) {
            api_json(['ok' => false, 'error' => 'Choose a valid board.'], 422);
        }
        $year = council_resolve_public_year($pdo, $board, $year);
        if ($year === '') {
            $pinnedEmpty = council_get_pinned_year($pdo, $board);
            api_json([
                'ok' => true,
                'academicYear' => null,
                'pinnedYear' => $pinnedEmpty,
                'displayMode' => $pinnedEmpty !== null ? 'pinned' : 'auto',
                'items' => [],
            ]);
        }
        $stmt = $pdo->prepare(
            'SELECT * FROM council_members
             WHERE board = :board AND academic_year = :year AND is_published = 1
             ORDER BY sort_order ASC, id ASC'
        );
        $stmt->execute(['board' => $board, 'year' => $year]);
    }

    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $items[] = council_members_row($row);
    }

    $payload = ['ok' => true, 'items' => $items];
    if (!$includeAll) {
        $pinned = council_get_pinned_year($pdo, $board);
        $payload['academicYear'] = $year !== '' ? $year : null;
        $payload['pinnedYear'] = $pinned;
        $payload['displayMode'] = $pinned !== null ? 'pinned' : 'auto';
    }
    api_json($payload);
}

/**
 * @param array<string, mixed>|null $body
 */
function council_members_payload(?array $body = null): array
{
    $body ??= api_read_json();
    $academicYear = council_normalize_year((string) ($body['academicYear'] ?? $body['year'] ?? ''));
    $board = strtolower(trim((string) ($body['board'] ?? '')));
    $section = strtolower(trim((string) ($body['section'] ?? '')));
    $role = trim((string) ($body['role'] ?? $body['roleTitle'] ?? ''));
    $name = trim((string) ($body['name'] ?? $body['fullName'] ?? ''));
    $photo = trim((string) ($body['photo'] ?? $body['photoUrl'] ?? ''));
    $vacant = (bool) ($body['vacant'] ?? $body['isVacant'] ?? false);
    $sortOrder = (int) ($body['sortOrder'] ?? 0);
    $published = array_key_exists('published', $body)
        ? (bool) $body['published']
        : (array_key_exists('isPublished', $body) ? (bool) $body['isPublished'] : true);

    if ($academicYear === '' || !preg_match('/^\d{4}–\d{4}$/u', $academicYear)) {
        api_json(['ok' => false, 'error' => 'Enter academic year as YYYY–YYYY (e.g. 2026–2027).'], 422);
    }
    if (!in_array($board, council_boards(), true)) {
        api_json(['ok' => false, 'error' => 'Choose a valid board.'], 422);
    }
    $allowedSections = council_sections_by_board()[$board] ?? [];
    if (!in_array($section, $allowedSections, true)) {
        api_json(['ok' => false, 'error' => 'Choose a valid section for this board.'], 422);
    }
    if ($role === '') {
        api_json(['ok' => false, 'error' => 'Enter the role or title.'], 422);
    }
    if (mb_strlen($role) > 255) {
        api_json(['ok' => false, 'error' => 'Role title is too long.'], 422);
    }
    if (!$vacant && $name === '') {
        api_json(['ok' => false, 'error' => 'Enter the full name, or mark the seat as vacant.'], 422);
    }
    if (mb_strlen($name) > 255) {
        api_json(['ok' => false, 'error' => 'Name is too long.'], 422);
    }
    if ($vacant && $name === '') {
        $name = 'Vacant';
    }
    if ($photo !== '' && !preg_match('#^(/|https?://)#i', $photo)) {
        api_json(['ok' => false, 'error' => 'Photo must be a site path or URL.'], 422);
    }
    if (mb_strlen($photo) > 500) {
        api_json(['ok' => false, 'error' => 'Photo path is too long.'], 422);
    }

    return [
        'academic_year' => $academicYear,
        'board' => $board,
        'section' => $section,
        'role_title' => $role,
        'full_name' => $name,
        'photo_url' => $photo !== '' ? $photo : null,
        'is_vacant' => $vacant ? 1 : 0,
        'sort_order' => $sortOrder,
        'is_published' => $published ? 1 : 0,
    ];
}

function council_members_create(): never
{
    api_require_manager();
    $data = council_members_payload();
    $pdo = api_pdo();

    $stmt = $pdo->prepare(
        'INSERT INTO council_members
          (academic_year, board, section, role_title, full_name, photo_url, is_vacant, sort_order, is_published)
         VALUES
          (:academic_year, :board, :section, :role_title, :full_name, :photo_url, :is_vacant, :sort_order, :is_published)'
    );
    $stmt->execute($data);

    $id = (int) $pdo->lastInsertId();
    $fetch = $pdo->prepare('SELECT * FROM council_members WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => council_members_row($fetch->fetch() ?: [])], 201);
}

function council_members_put(): never
{
    api_require_manager();
    $body = api_read_json();
    $action = strtolower(trim((string) ($body['action'] ?? '')));

    if ($action === 'pin_display_year') {
        council_members_pin_display($body);
    }

    council_members_update($body);
}

/**
 * @param array<string, mixed> $body
 */
function council_members_pin_display(array $body): never
{
    $pdo = api_pdo();
    council_ensure_display_settings($pdo);

    $board = strtolower(trim((string) ($body['board'] ?? '')));
    if (!in_array($board, council_boards(), true)) {
        api_json(['ok' => false, 'error' => 'Choose a valid board.'], 422);
    }

    $rawPin = $body['pinnedYear'] ?? null;
    $pinned = null;
    if ($rawPin !== null && $rawPin !== '' && strtolower((string) $rawPin) !== 'auto') {
        $pinned = council_normalize_year((string) $rawPin);
        if ($pinned === '' || !preg_match('/^\d{4}–\d{4}$/u', $pinned)) {
            api_json(['ok' => false, 'error' => 'Enter academic year as YYYY–YYYY, or choose Auto.'], 422);
        }
    }

    $stmt = $pdo->prepare(
        'INSERT INTO council_display_settings (board, pinned_academic_year)
         VALUES (:board, :year)
         ON DUPLICATE KEY UPDATE pinned_academic_year = VALUES(pinned_academic_year)'
    );
    $stmt->execute(['board' => $board, 'year' => $pinned]);

    $resolved = council_resolve_public_year($pdo, $board);
    api_json([
        'ok' => true,
        'board' => $board,
        'pinnedYear' => $pinned,
        'publicYear' => $resolved !== '' ? $resolved : null,
        'mode' => $pinned !== null ? 'pinned' : 'auto',
    ]);
}

/**
 * @param array<string, mixed> $body
 */
function council_members_update(array $body): never
{
    $pdo = api_pdo();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Member id is required.'], 422);
    }

    $existing = $pdo->prepare('SELECT id FROM council_members WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    if (!$existing->fetch()) {
        api_json(['ok' => false, 'error' => 'Member not found.'], 404);
    }

    $data = council_members_payload($body);
    $data['id'] = $id;

    $stmt = $pdo->prepare(
        'UPDATE council_members
         SET academic_year = :academic_year,
             board = :board,
             section = :section,
             role_title = :role_title,
             full_name = :full_name,
             photo_url = :photo_url,
             is_vacant = :is_vacant,
             sort_order = :sort_order,
             is_published = :is_published
         WHERE id = :id'
    );
    $stmt->execute($data);

    $fetch = $pdo->prepare('SELECT * FROM council_members WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => council_members_row($fetch->fetch() ?: [])]);
}

function council_members_delete(): never
{
    api_require_manager();
    $pdo = api_pdo();
    $body = api_read_json();
    $ids = $body['ids'] ?? null;
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);

    if (is_array($ids) && $ids !== []) {
        $deleted = 0;
        $stmt = $pdo->prepare('DELETE FROM council_members WHERE id = :id');
        foreach ($ids as $raw) {
            $rowId = (int) $raw;
            if ($rowId <= 0) {
                continue;
            }
            $stmt->execute(['id' => $rowId]);
            $deleted += $stmt->rowCount();
        }
        api_json(['ok' => true, 'deleted' => $deleted]);
    }

    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Member id is required.'], 422);
    }

    $stmt = $pdo->prepare('DELETE FROM council_members WHERE id = :id');
    $stmt->execute(['id' => $id]);
    if ($stmt->rowCount() < 1) {
        api_json(['ok' => false, 'error' => 'Member not found.'], 404);
    }
    api_json(['ok' => true]);
}
