<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => organizations_get(),
        'POST' => organizations_create(),
        'PUT', 'PATCH' => organizations_update(),
        'DELETE' => organizations_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json([
        'ok' => false,
        'error' => 'Database unavailable. Run scripts/run-012-public-cms.php and start MySQL.',
        'detail' => $error->getMessage(),
    ], 503);
}

function organizations_ensure_tables(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS organizations (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          slug VARCHAR(64) NOT NULL,
          short_name VARCHAR(120) NOT NULL,
          name VARCHAR(255) NOT NULL,
          facebook_url VARCHAR(500) NOT NULL DEFAULT '',
          logo_url VARCHAR(500) NOT NULL DEFAULT '',
          academic_year VARCHAR(32) NOT NULL DEFAULT '2026–2027',
          sort_order INT NOT NULL DEFAULT 0,
          is_published TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_organizations_slug (slug),
          KEY idx_organizations_published (is_published, sort_order, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $ready = true;
}

function organizations_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'slug' => (string) $row['slug'],
        'short' => (string) $row['short_name'],
        'shortName' => (string) $row['short_name'],
        'name' => (string) $row['name'],
        'facebook' => (string) ($row['facebook_url'] ?? ''),
        'facebookUrl' => (string) ($row['facebook_url'] ?? ''),
        'logo' => (string) ($row['logo_url'] ?? ''),
        'logoUrl' => (string) ($row['logo_url'] ?? ''),
        'academicYear' => (string) ($row['academic_year'] ?? '2026–2027'),
        'sortOrder' => (int) ($row['sort_order'] ?? 0),
        'published' => (int) ($row['is_published'] ?? 0) === 1,
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}

function organizations_payload(?array $body = null): array
{
    $body ??= api_read_json();
    $short = trim((string) ($body['short'] ?? $body['shortName'] ?? ''));
    $name = trim((string) ($body['name'] ?? ''));
    $slug = trim((string) ($body['slug'] ?? ''));
    $facebook = trim((string) ($body['facebook'] ?? $body['facebookUrl'] ?? ''));
    $logo = trim((string) ($body['logo'] ?? $body['logoUrl'] ?? ''));
    $year = trim((string) ($body['academicYear'] ?? $body['academic_year'] ?? '2026–2027'));
    $sortOrder = (int) ($body['sortOrder'] ?? $body['sort_order'] ?? 0);
    $published = array_key_exists('published', $body)
        ? (bool) $body['published']
        : (array_key_exists('isPublished', $body) ? (bool) $body['isPublished'] : true);

    if ($name === '') {
        api_json(['ok' => false, 'error' => 'Name is required.'], 422);
    }
    if ($short === '') {
        api_json(['ok' => false, 'error' => 'Short name is required.'], 422);
    }
    if ($slug === '') {
        $slug = api_slugify($short !== '' ? $short : $name);
    } else {
        $slug = api_slugify($slug);
    }
    if ($year === '') {
        $year = '2026–2027';
    }
    if ($logo !== '' && !preg_match('#^(/|https?://)#i', $logo)) {
        api_json(['ok' => false, 'error' => 'Logo must be a path or URL.'], 422);
    }
    if ($facebook !== '' && !preg_match('#^https?://#i', $facebook)) {
        api_json(['ok' => false, 'error' => 'Facebook URL must start with http(s).'], 422);
    }

    return [
        'slug' => $slug,
        'short_name' => mb_substr($short, 0, 120),
        'name' => mb_substr($name, 0, 255),
        'facebook_url' => mb_substr($facebook, 0, 500),
        'logo_url' => mb_substr($logo, 0, 500),
        'academic_year' => mb_substr($year, 0, 32),
        'sort_order' => $sortOrder,
        'is_published' => $published ? 1 : 0,
    ];
}

function organizations_get(): never
{
    $pdo = api_pdo();
    organizations_ensure_tables($pdo);

    $id = (int) ($_GET['id'] ?? 0);
    $slug = trim((string) ($_GET['slug'] ?? ''));
    $includeAll = (string) ($_GET['all'] ?? '') === '1';

    if ($id > 0 || $slug !== '') {
        if ($id > 0) {
            $stmt = $pdo->prepare('SELECT * FROM organizations WHERE id = :id LIMIT 1');
            $stmt->execute(['id' => $id]);
        } else {
            $stmt = $pdo->prepare('SELECT * FROM organizations WHERE slug = :slug LIMIT 1');
            $stmt->execute(['slug' => $slug]);
        }
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Organization not found.'], 404);
        }
        if ((int) $row['is_published'] !== 1) {
            api_require_manager();
        }
        api_json(['ok' => true, 'item' => organizations_row($row)]);
    }

    if ($includeAll) {
        api_require_manager();
        $stmt = $pdo->query('SELECT * FROM organizations ORDER BY sort_order ASC, id ASC');
    } else {
        $stmt = $pdo->query(
            'SELECT * FROM organizations
             WHERE is_published = 1
             ORDER BY sort_order ASC, id ASC'
        );
    }

    $items = [];
    if ($stmt) {
        foreach ($stmt->fetchAll() as $row) {
            $items[] = organizations_row($row);
        }
    }

    api_json(['ok' => true, 'items' => $items]);
}

function organizations_create(): never
{
    api_require_manager();
    $pdo = api_pdo();
    organizations_ensure_tables($pdo);
    $data = organizations_payload();

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO organizations
              (slug, short_name, name, facebook_url, logo_url, academic_year, sort_order, is_published)
             VALUES
              (:slug, :short_name, :name, :facebook_url, :logo_url, :academic_year, :sort_order, :is_published)'
        );
        $stmt->execute($data);
    } catch (PDOException $error) {
        if ((int) $error->getCode() === 23000) {
            api_json(['ok' => false, 'error' => 'An organization with this slug already exists.'], 409);
        }
        throw $error;
    }

    $id = (int) $pdo->lastInsertId();
    $fetch = $pdo->prepare('SELECT * FROM organizations WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => organizations_row($fetch->fetch() ?: [])], 201);
}

function organizations_update(): never
{
    api_require_manager();
    $pdo = api_pdo();
    organizations_ensure_tables($pdo);
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Organization id is required.'], 422);
    }

    $existing = $pdo->prepare('SELECT id FROM organizations WHERE id = :id LIMIT 1');
    $existing->execute(['id' => $id]);
    if (!$existing->fetch()) {
        api_json(['ok' => false, 'error' => 'Organization not found.'], 404);
    }

    $data = organizations_payload($body);
    $data['id'] = $id;

    try {
        $stmt = $pdo->prepare(
            'UPDATE organizations
             SET slug = :slug,
                 short_name = :short_name,
                 name = :name,
                 facebook_url = :facebook_url,
                 logo_url = :logo_url,
                 academic_year = :academic_year,
                 sort_order = :sort_order,
                 is_published = :is_published
             WHERE id = :id'
        );
        $stmt->execute($data);
    } catch (PDOException $error) {
        if ((int) $error->getCode() === 23000) {
            api_json(['ok' => false, 'error' => 'An organization with this slug already exists.'], 409);
        }
        throw $error;
    }

    $fetch = $pdo->prepare('SELECT * FROM organizations WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    api_json(['ok' => true, 'item' => organizations_row($fetch->fetch() ?: [])]);
}

function organizations_delete(): never
{
    api_require_manager();
    $pdo = api_pdo();
    organizations_ensure_tables($pdo);
    $body = api_read_json();
    $ids = $body['ids'] ?? null;
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);

    if (is_array($ids) && $ids !== []) {
        $deleted = 0;
        $stmt = $pdo->prepare('DELETE FROM organizations WHERE id = :id');
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
        api_json(['ok' => false, 'error' => 'Organization id is required.'], 422);
    }

    $stmt = $pdo->prepare('DELETE FROM organizations WHERE id = :id');
    $stmt->execute(['id' => $id]);
    if ($stmt->rowCount() < 1) {
        api_json(['ok' => false, 'error' => 'Organization not found.'], 404);
    }
    api_json(['ok' => true]);
}
