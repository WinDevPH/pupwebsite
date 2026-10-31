<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/mailer.php';

api_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    match ($method) {
        'GET' => reservations_get(),
        'POST' => reservations_create(),
        'PUT', 'PATCH' => reservations_update(),
        'DELETE' => reservations_delete(),
        default => api_json(['ok' => false, 'error' => 'Method not allowed.'], 405),
    };
} catch (Throwable $error) {
    api_json_db_error($error);
}

/** @return list<string> */
function reservations_shops(): array
{
    return ['locker', 'merch'];
}

/** @return list<string> */
function reservations_statuses(): array
{
    return ['pending', 'submitted', 'confirmed', 'fulfilled', 'cancelled'];
}

function reservations_ensure_tables(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS shop_reservations (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          code VARCHAR(32) NOT NULL,
          shop VARCHAR(32) NOT NULL,
          shop_item_id INT UNSIGNED NULL,
          item_key VARCHAR(64) NOT NULL DEFAULT '',
          item_name VARCHAR(255) NOT NULL,
          rental_type VARCHAR(16) NOT NULL DEFAULT 'new',
          unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
          quantity INT UNSIGNED NOT NULL DEFAULT 1,
          total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
          customer_name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL DEFAULT '',
          mobile VARCHAR(64) NOT NULL DEFAULT '',
          student_id VARCHAR(64) NOT NULL DEFAULT '',
          year_level VARCHAR(64) NOT NULL DEFAULT '',
          remarks TEXT NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'submitted',
          submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_shop_reservations_code (code),
          KEY idx_shop_reservations_shop (shop, status, submitted_at),
          KEY idx_shop_reservations_status (status, submitted_at),
          KEY idx_shop_reservations_item (shop_item_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $column = $pdo->query("SHOW COLUMNS FROM shop_reservations LIKE 'rental_type'");
    if ($column && !$column->fetch()) {
        $pdo->exec(
            "ALTER TABLE shop_reservations
             ADD COLUMN rental_type VARCHAR(16) NOT NULL DEFAULT 'new' AFTER item_name"
        );
    }
    $ready = true;
}

/** @return list<string> */
function reservations_rental_types(): array
{
    return ['new', 'renewal'];
}

function reservations_rental_label(string $type): string
{
    return $type === 'renewal' ? 'Renewal' : 'New rental';
}

function reservations_locker_row(array $data): string
{
    $raw = strtoupper(trim((string) ($data['item_key'] ?? '') . ' ' . (string) ($data['item_name'] ?? '')));
    if (preg_match('/([A-E])/', $raw, $match)) {
        return $match[1];
    }
    return 'A';
}

function reservations_locker_fee(string $row, string $type): float
{
    $row = strtoupper($row);
    if ($type === 'renewal') {
        if ($row === 'D') {
            return 450.0;
        }
        if ($row === 'E') {
            return 350.0;
        }
        return 500.0;
    }
    if ($row === 'D') {
        return 450.0;
    }
    if ($row === 'E') {
        return 350.0;
    }
    return 600.0;
}

function reservations_row(array $row): array
{
    $status = strtolower((string) ($row['status'] ?? 'submitted'));
    if (!in_array($status, reservations_statuses(), true)) {
        $status = 'submitted';
    }

    return [
        'id' => (int) $row['id'],
        'code' => (string) $row['code'],
        'shop' => (string) $row['shop'],
        'shopItemId' => $row['shop_item_id'] !== null ? (int) $row['shop_item_id'] : null,
        'itemKey' => (string) ($row['item_key'] ?? ''),
        'itemName' => (string) $row['item_name'],
        'rentalType' => ($row['shop'] ?? '') === 'locker' && ($row['rental_type'] ?? '') === 'renewal'
            ? 'renewal'
            : 'new',
        'unitPrice' => (float) ($row['unit_price'] ?? 0),
        'quantity' => (int) ($row['quantity'] ?? 1),
        'totalAmount' => (float) ($row['total_amount'] ?? 0),
        'total' => '₱' . number_format((float) ($row['total_amount'] ?? 0), 2, '.', ','),
        'name' => (string) $row['customer_name'],
        'email' => (string) ($row['email'] ?? ''),
        'mobile' => (string) ($row['mobile'] ?? ''),
        'studentId' => (string) ($row['student_id'] ?? ''),
        'year' => (string) ($row['year_level'] ?? ''),
        'yearLevel' => (string) ($row['year_level'] ?? ''),
        'remarks' => $row['remarks'] !== null ? (string) $row['remarks'] : '',
        'status' => $status,
        'image' => trim((string) ($row['item_image_url'] ?? '')),
        'submittedAt' => api_iso((string) $row['submitted_at']) ?? date('c'),
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}

function reservations_from_sql(): string
{
    return 'SELECT r.*, si.image_url AS item_image_url
            FROM shop_reservations r
            LEFT JOIN shop_items si ON si.id = r.shop_item_id';
}

/**
 * @param array<string, mixed> $data
 * @return array<string, mixed>|null
 */
function reservations_locker_occupant(PDO $pdo, array $data, int $exceptId = 0): ?array
{
    if (($data['shop'] ?? '') !== 'locker') {
        return null;
    }
    if (strtolower((string) ($data['status'] ?? '')) === 'cancelled') {
        return null;
    }

    $parts = [];
    $params = [];
    $itemId = (int) ($data['shop_item_id'] ?? 0);
    $itemKey = strtolower(trim((string) ($data['item_key'] ?? '')));
    if ($itemId > 0) {
        $parts[] = 'shop_item_id = :sid';
        $params['sid'] = $itemId;
    }
    if ($itemKey !== '') {
        $parts[] = 'LOWER(item_key) = :key';
        $params['key'] = $itemKey;
    }
    if ($parts === []) {
        return null;
    }

    $sql = 'SELECT * FROM shop_reservations
            WHERE shop = \'locker\' AND LOWER(status) <> \'cancelled\'
              AND (' . implode(' OR ', $parts) . ')';
    if ($exceptId > 0) {
        $sql .= ' AND id <> :except';
        $params['except'] = $exceptId;
    }
    $sql .= ' ORDER BY id DESC LIMIT 1';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();
    return $row ?: null;
}

function reservations_locker_occupied(PDO $pdo, array $data, int $exceptId = 0): bool
{
    return reservations_locker_occupant($pdo, $data, $exceptId) !== null;
}

/** @param array<string, mixed> $row */
function reservations_identity_matches(array $row, array $data): bool
{
    $email = strtolower(trim((string) ($data['email'] ?? '')));
    $studentId = strtolower(trim((string) ($data['student_id'] ?? '')));
    $rowEmail = strtolower(trim((string) ($row['email'] ?? '')));
    $rowStudentId = strtolower(trim((string) ($row['student_id'] ?? '')));
    if ($email !== '' && $rowEmail !== '' && $email === $rowEmail) {
        return true;
    }
    if ($studentId !== '' && $rowStudentId !== '' && $studentId === $rowStudentId) {
        return true;
    }
    return false;
}

/** @param array<string, mixed> $existing */
function reservations_same_locker(array $existing, array $data): bool
{
    $idA = (int) ($existing['shop_item_id'] ?? 0);
    $idB = (int) ($data['shop_item_id'] ?? 0);
    if ($idA > 0 && $idB > 0 && $idA === $idB) {
        return true;
    }
    $keyA = strtolower(trim((string) ($existing['item_key'] ?? '')));
    $keyB = strtolower(trim((string) ($data['item_key'] ?? '')));
    return $keyA !== '' && $keyA === $keyB;
}

/**
 * Latest non-cancelled reservation for this locker by this student.
 *
 * @param array<string, mixed> $data
 * @return array<string, mixed>|null
 */
function reservations_prior_locker(PDO $pdo, array $data, int $exceptId = 0): ?array
{
    if (($data['shop'] ?? '') !== 'locker') {
        return null;
    }

    $email = strtolower(trim((string) ($data['email'] ?? '')));
    $studentId = strtolower(trim((string) ($data['student_id'] ?? '')));
    if ($email === '' && $studentId === '') {
        return null;
    }

    $identity = [];
    $params = [];
    if ($email !== '') {
        $identity[] = 'LOWER(email) = :email';
        $params['email'] = $email;
    }
    if ($studentId !== '') {
        $identity[] = 'LOWER(student_id) = :student_id';
        $params['student_id'] = $studentId;
    }

    $parts = [];
    $itemId = (int) ($data['shop_item_id'] ?? 0);
    $itemKey = strtolower(trim((string) ($data['item_key'] ?? '')));
    if ($itemId > 0) {
        $parts[] = 'shop_item_id = :sid';
        $params['sid'] = $itemId;
    }
    if ($itemKey !== '') {
        $parts[] = 'LOWER(item_key) = :key';
        $params['key'] = $itemKey;
    }
    if ($parts === []) {
        return null;
    }

    $sql = 'SELECT * FROM shop_reservations
            WHERE shop = \'locker\' AND LOWER(status) <> \'cancelled\'
              AND (' . implode(' OR ', $identity) . ')
              AND (' . implode(' OR ', $parts) . ')';
    if ($exceptId > 0) {
        $sql .= ' AND id <> :except';
        $params['except'] = $exceptId;
    }
    $sql .= ' ORDER BY id DESC LIMIT 1';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();
    return $row ?: null;
}

/**
 * @param array<string, mixed> $data
 * @return array{error:string,code:string}|null
 */
function reservations_create_conflict(PDO $pdo, array $data, bool $public): ?array
{
    $isRenewal = ($data['shop'] ?? '') === 'locker' && ($data['rental_type'] ?? 'new') === 'renewal';
    $occupant = reservations_locker_occupant($pdo, $data);
    $identity = reservations_identity_duplicate($pdo, $data);

    if ($isRenewal) {
        $prior = reservations_prior_locker($pdo, $data);
        if ($public && !$prior) {
            return [
                'error' => 'Renewal is only for students who already reserved this locker. Use the same email or student ID, or choose New rental.',
                'code' => '',
            ];
        }
        if ($occupant && !reservations_identity_matches($occupant, $data)) {
            return [
                'error' => 'That locker already has an active reservation.',
                'code' => (string) ($occupant['code'] ?? ''),
            ];
        }
        if ($identity && !reservations_same_locker($identity, $data)) {
            return [
                'error' => reservations_duplicate_message($identity, $data),
                'code' => (string) ($identity['code'] ?? ''),
            ];
        }
        return null;
    }

    if ($identity) {
        return [
            'error' => reservations_duplicate_message($identity, $data),
            'code' => (string) ($identity['code'] ?? ''),
        ];
    }
    if ($occupant) {
        return [
            'error' => 'That locker already has an active reservation.',
            'code' => (string) ($occupant['code'] ?? ''),
        ];
    }
    return null;
}

function reservations_fulfill_prior_locker(PDO $pdo, array $data, int $keepId): void
{
    if (($data['shop'] ?? '') !== 'locker' || ($data['rental_type'] ?? '') !== 'renewal') {
        return;
    }

    $prior = reservations_prior_locker($pdo, $data, $keepId);
    if (!$prior) {
        return;
    }

    $stmt = $pdo->prepare(
        "UPDATE shop_reservations
         SET status = 'fulfilled'
         WHERE id = :id AND LOWER(status) <> 'cancelled' AND LOWER(status) <> 'fulfilled'"
    );
    $stmt->execute(['id' => (int) $prior['id']]);
}

/**
 * Active reservation already filed by this student (email or student ID).
 * Lockers: one active reservation per student. Merch: one active reservation per item.
 *
 * @param array<string, mixed> $data
 * @return array<string, mixed>|null
 */
function reservations_identity_duplicate(PDO $pdo, array $data, int $exceptId = 0): ?array
{
    if (strtolower((string) ($data['status'] ?? '')) === 'cancelled') {
        return null;
    }

    $email = strtolower(trim((string) ($data['email'] ?? '')));
    $studentId = strtolower(trim((string) ($data['student_id'] ?? '')));
    if ($email === '' && $studentId === '') {
        return null;
    }

    $identity = [];
    $params = [];
    if ($email !== '') {
        $identity[] = 'LOWER(email) = :email';
        $params['email'] = $email;
    }
    if ($studentId !== '') {
        $identity[] = 'LOWER(student_id) = :student_id';
        $params['student_id'] = $studentId;
    }

    $shop = strtolower(trim((string) ($data['shop'] ?? '')));
    $sql = 'SELECT * FROM shop_reservations
            WHERE LOWER(status) <> \'cancelled\'
              AND (' . implode(' OR ', $identity) . ')';

    if ($shop === 'locker') {
        $sql .= ' AND shop = \'locker\'';
    } else {
        if ($shop === '') {
            return null;
        }
        $sql .= ' AND shop = :shop';
        $params['shop'] = $shop;
        $itemParts = [];
        $itemId = (int) ($data['shop_item_id'] ?? 0);
        $itemKey = strtolower(trim((string) ($data['item_key'] ?? '')));
        if ($itemId > 0) {
            $itemParts[] = 'shop_item_id = :item_id';
            $params['item_id'] = $itemId;
        }
        if ($itemKey !== '') {
            $itemParts[] = 'LOWER(item_key) = :item_key';
            $params['item_key'] = $itemKey;
        }
        if ($itemParts === []) {
            return null;
        }
        $sql .= ' AND (' . implode(' OR ', $itemParts) . ')';
    }

    if ($exceptId > 0) {
        $sql .= ' AND id <> :except';
        $params['except'] = $exceptId;
    }

    $sql .= ' ORDER BY id DESC LIMIT 1';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();
    return $row ?: null;
}

/** @param array<string, mixed> $existing */
function reservations_duplicate_message(array $existing, array $data): string
{
    $code = strtoupper(trim((string) ($existing['code'] ?? '')));
    $itemName = trim((string) ($existing['item_name'] ?? ''));
    $shop = strtolower((string) ($existing['shop'] ?? $data['shop'] ?? ''));
    $suffix = $code !== '' ? ' Track ' . $code . ' in the portal instead of submitting again.' : ' Track it in the portal instead of submitting again.';

    if ($shop === 'locker') {
        $label = $itemName !== '' ? $itemName : 'a locker';
        return 'You already have an active locker reservation for ' . $label . '.' . $suffix;
    }

    $label = $itemName !== '' ? $itemName : 'this item';
    return 'You already have an active reservation for ' . $label . '.' . $suffix;
}

function reservations_make_code(PDO $pdo): string
{
    for ($i = 0; $i < 8; $i += 1) {
        $code = 'RSV-' . strtoupper(bin2hex(random_bytes(3)));
        $stmt = $pdo->prepare('SELECT id FROM shop_reservations WHERE code = :code LIMIT 1');
        $stmt->execute(['code' => $code]);
        if (!$stmt->fetch()) {
            return $code;
        }
    }
    return 'RSV-' . strtoupper(dechex(time())) . strtoupper(bin2hex(random_bytes(1)));
}

function reservations_council_inbox(): string
{
    $mailCfg = api_mail_config();
    return trim((string) ($mailCfg['to'] ?? $mailCfg['from'] ?? $mailCfg['user'] ?? ''));
}

/**
 * @param array<string, mixed> $row
 * @return array{council:array{ok:bool,error?:string},confirm:array{ok:bool,error?:string}}
 */
function reservations_send_created_mail(array $row): array
{
    $email = trim((string) ($row['email'] ?? ''));
    $code = (string) ($row['code'] ?? '');
    $payload = [
        'code' => $code,
        'name' => (string) ($row['customer_name'] ?? ''),
        'email' => $email,
        'shop' => (string) ($row['shop'] ?? 'merch'),
        'itemName' => (string) ($row['item_name'] ?? ''),
        'rentalType' => (string) ($row['rental_type'] ?? 'new'),
        'quantity' => (int) ($row['quantity'] ?? 1),
        'unitPrice' => (float) ($row['unit_price'] ?? 0),
        'totalAmount' => (float) ($row['total_amount'] ?? 0),
        'mobile' => (string) ($row['mobile'] ?? ''),
        'studentId' => (string) ($row['student_id'] ?? ''),
        'year' => (string) ($row['year_level'] ?? ''),
        'remarks' => (string) ($row['remarks'] ?? ''),
        'status' => (string) ($row['status'] ?? 'submitted'),
    ];

    $councilTo = reservations_council_inbox();
    $councilResult = ['ok' => false, 'error' => 'Mail recipient is not configured.'];
    if ($councilTo !== '') {
        $councilTpl = api_mail_template_council_reservation($payload);
        $shopLabel = api_mail_reservation_shop_label($payload['shop']);
        $kind = ($payload['shop'] === 'locker' && ($payload['rentalType'] ?? '') === 'renewal')
            ? 'renewal'
            : 'reservation';
        $councilResult = api_send_mail(
            $councilTo,
            '[' . $code . '] ' . $shopLabel . ' ' . $kind . ': ' . $payload['itemName'],
            $councilTpl['text'],
            filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null,
            [],
            $councilTpl['html'],
        );
    }

    $confirmResult = ['ok' => false, 'error' => 'Customer email is missing.'];
    if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $confirmTpl = api_mail_template_reservation_confirmation($payload);
        $confirmResult = api_send_mail(
            $email,
            'Reservation received · ' . $code,
            $confirmTpl['text'],
            $councilTo !== '' ? $councilTo : null,
            [],
            $confirmTpl['html'],
        );
    }

    return ['council' => $councilResult, 'confirm' => $confirmResult];
}

/**
 * @param array<string, mixed> $row
 * @return array{ok:bool,error?:string}
 */
function reservations_send_status_mail(array $row, string $previousStatus): array
{
    $email = trim((string) ($row['email'] ?? ''));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'error' => 'Customer email is missing.'];
    }

    $code = (string) ($row['code'] ?? '');
    $status = (string) ($row['status'] ?? '');
    $tpl = api_mail_template_reservation_status([
        'code' => $code,
        'name' => (string) ($row['customer_name'] ?? ''),
        'shop' => (string) ($row['shop'] ?? 'merch'),
        'itemName' => (string) ($row['item_name'] ?? ''),
        'quantity' => (int) ($row['quantity'] ?? 1),
        'totalAmount' => (float) ($row['total_amount'] ?? 0),
        'status' => $status,
        'previousStatus' => $previousStatus,
    ]);

    $councilTo = reservations_council_inbox();
    $statusLabel = api_mail_reservation_status_label($status);

    return api_send_mail(
        $email,
        $statusLabel . ' · ' . $code,
        $tpl['text'],
        $councilTo !== '' ? $councilTo : null,
        [],
        $tpl['html'],
    );
}

/**
 * @return array{
 *   shop: string,
 *   shop_item_id: ?int,
 *   item_key: string,
 *   item_name: string,
 *   unit_price: float,
 *   quantity: int,
 *   total_amount: float,
 *   customer_name: string,
 *   email: string,
 *   mobile: string,
 *   student_id: string,
 *   year_level: string,
 *   remarks: ?string,
 *   status: string,
 *   submitted_at: string
 * }
 */
function reservations_payload(?array $body = null, bool $public = false): array
{
    $body ??= api_read_json();
    $shop = strtolower(trim((string) ($body['shop'] ?? '')));
    if (!in_array($shop, reservations_shops(), true)) {
        api_json(['ok' => false, 'error' => 'Shop must be locker or merch.'], 422);
    }

    $name = trim((string) ($body['name'] ?? $body['customerName'] ?? ''));
    if (mb_strlen($name) < 2) {
        api_json(['ok' => false, 'error' => 'Name is required.'], 422);
    }

    $email = trim((string) ($body['email'] ?? ''));
    $mobile = trim((string) ($body['mobile'] ?? ''));
    $studentId = trim((string) ($body['studentId'] ?? $body['student_id'] ?? ''));
    $year = trim((string) ($body['year'] ?? $body['yearLevel'] ?? $body['year_level'] ?? ''));
    $remarks = trim((string) ($body['remarks'] ?? ''));

    if ($public) {
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            api_json(['ok' => false, 'error' => 'A valid email is required.'], 422);
        }
        $digits = preg_replace('/\D+/', '', $mobile) ?? '';
        if (strlen($digits) < 10 || strlen($digits) > 13) {
            api_json(['ok' => false, 'error' => 'A valid mobile number is required.'], 422);
        }
        if ($studentId === '' || !preg_match('/^[A-Za-z0-9-]{4,20}$/', $studentId)) {
            api_json(['ok' => false, 'error' => 'A valid student ID is required.'], 422);
        }
        if ($year === '') {
            api_json(['ok' => false, 'error' => 'Year level is required.'], 422);
        }
    }

    $quantity = max(1, (int) ($body['quantity'] ?? 1));
    if ($shop === 'locker') {
        $quantity = 1;
    }

    $rentalType = strtolower(trim((string) ($body['rentalType'] ?? $body['rental_type'] ?? 'new')));
    if ($shop !== 'locker' || !in_array($rentalType, reservations_rental_types(), true)) {
        $rentalType = 'new';
    }

    $unitPrice = (float) ($body['unitPrice'] ?? $body['unit_price'] ?? $body['price'] ?? 0);
    if ($unitPrice < 0) {
        $unitPrice = 0.0;
    }
    if ($shop === 'locker') {
        $official = reservations_locker_fee(reservations_locker_row([
            'item_key' => (string) ($body['itemKey'] ?? $body['item_key'] ?? ''),
            'item_name' => (string) ($body['itemName'] ?? $body['item_name'] ?? $body['item'] ?? ''),
        ]), $rentalType);
        if ($public || $unitPrice <= 0) {
            $unitPrice = $official;
        }
    }
    $totalAmount = isset($body['totalAmount']) || isset($body['total_amount'])
        ? (float) ($body['totalAmount'] ?? $body['total_amount'])
        : round($unitPrice * $quantity, 2);
    if ($shop === 'locker' && $public) {
        $totalAmount = round($unitPrice * $quantity, 2);
    }
    if ($totalAmount < 0) {
        $totalAmount = 0.0;
    }

    $itemName = trim((string) ($body['itemName'] ?? $body['item_name'] ?? $body['item'] ?? ''));
    if ($itemName === '') {
        api_json(['ok' => false, 'error' => 'Item name is required.'], 422);
    }

    $itemKey = trim((string) ($body['itemKey'] ?? $body['item_key'] ?? ''));
    $shopItemId = isset($body['shopItemId']) || isset($body['shop_item_id'])
        ? (int) ($body['shopItemId'] ?? $body['shop_item_id'])
        : 0;
    if ($shopItemId <= 0) {
        $shopItemId = null;
    }

    $status = strtolower(trim((string) ($body['status'] ?? ($public ? 'submitted' : 'pending'))));
    if (!in_array($status, reservations_statuses(), true)) {
        api_json(['ok' => false, 'error' => 'Invalid reservation status.'], 422);
    }
    if ($public) {
        $status = 'submitted';
    }

    $submittedRaw = trim((string) ($body['submittedAt'] ?? $body['submitted_at'] ?? ''));
    if ($submittedRaw !== '') {
        $ts = strtotime($submittedRaw);
        $submittedAt = $ts ? date('Y-m-d H:i:s', $ts) : api_now();
    } else {
        $submittedAt = api_now();
    }

    return [
        'shop' => $shop,
        'shop_item_id' => $shopItemId,
        'item_key' => mb_substr($itemKey !== '' ? api_slugify($itemKey) : '', 0, 64),
        'item_name' => mb_substr($itemName, 0, 255),
        'rental_type' => $rentalType,
        'unit_price' => round($unitPrice, 2),
        'quantity' => $quantity,
        'total_amount' => round($totalAmount, 2),
        'customer_name' => mb_substr($name, 0, 255),
        'email' => mb_substr($email, 0, 255),
        'mobile' => mb_substr($mobile, 0, 64),
        'student_id' => mb_substr($studentId, 0, 64),
        'year_level' => mb_substr($year, 0, 64),
        'remarks' => $remarks !== '' ? $remarks : null,
        'status' => $status,
        'submitted_at' => $submittedAt,
    ];
}

function reservations_get(): never
{
    $pdo = api_pdo();
    reservations_ensure_tables($pdo);

    $id = (int) ($_GET['id'] ?? 0);
    $code = strtoupper(trim((string) ($_GET['code'] ?? '')));
    $shop = strtolower(trim((string) ($_GET['shop'] ?? '')));
    $status = strtolower(trim((string) ($_GET['status'] ?? '')));
    $includeAll = (string) ($_GET['all'] ?? '') === '1';

    if ($id > 0 || $code !== '') {
        if ($id > 0) {
            $stmt = $pdo->prepare(reservations_from_sql() . ' WHERE r.id = :id LIMIT 1');
            $stmt->execute(['id' => $id]);
        } else {
            $stmt = $pdo->prepare(reservations_from_sql() . ' WHERE r.code = :code LIMIT 1');
            $stmt->execute(['code' => $code]);
        }
        $row = $stmt->fetch();
        if (!$row) {
            api_json(['ok' => false, 'error' => 'Reservation not found.'], 404);
        }
        // Public may look up by code; managers may fetch any by id.
        if ($id > 0 && $code === '') {
            api_require_manager();
        }
        api_json(['ok' => true, 'item' => reservations_row($row)]);
    }

    api_require_manager();

    if ($shop !== '' && !in_array($shop, reservations_shops(), true)) {
        api_json(['ok' => false, 'error' => 'Unknown shop.'], 422);
    }
    if ($status !== '' && !in_array($status, reservations_statuses(), true)) {
        api_json(['ok' => false, 'error' => 'Unknown status.'], 422);
    }

    $sql = reservations_from_sql() . ' WHERE 1=1';
    $params = [];
    if ($shop !== '') {
        $sql .= ' AND r.shop = :shop';
        $params['shop'] = $shop;
    }
    if ($status !== '') {
        $sql .= ' AND r.status = :status';
        $params['status'] = $status;
    }
    $sql .= ' ORDER BY r.submitted_at DESC, r.id DESC';

    if ($params) {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    } else {
        $stmt = $pdo->query($sql);
    }

    $items = [];
    if ($stmt) {
        foreach ($stmt->fetchAll() as $row) {
            $items[] = reservations_row($row);
        }
    }

    api_json([
        'ok' => true,
        'items' => $items,
        'shop' => $shop !== '' ? $shop : null,
        'status' => $status !== '' ? $status : null,
        'shops' => reservations_shops(),
        'statuses' => reservations_statuses(),
        'all' => $includeAll,
    ]);
}

function reservations_create(): never
{
    $pdo = api_pdo();
    reservations_ensure_tables($pdo);
    $body = api_read_json();
    $publicFlag = $body['public'] ?? false;
    $public = $publicFlag === true
        || $publicFlag === 1
        || (string) $publicFlag === '1'
        || (string) ($body['source'] ?? '') === 'portal';

    if (!$public) {
        api_require_manager();
    }

    $data = reservations_payload($body, $public);
    $checkOnly = $public && (
        ($body['check'] ?? false) === true
        || (string) ($body['check'] ?? '') === '1'
    );

    if ($checkOnly) {
        $conflict = reservations_create_conflict($pdo, $data, true);
        if ($conflict) {
            api_json([
                'ok' => true,
                'duplicate' => true,
                'code' => $conflict['code'],
                'itemName' => (string) ($data['item_name'] ?? ''),
                'shop' => (string) ($data['shop'] ?? ''),
                'message' => $conflict['error'],
            ]);
        }
        api_json(['ok' => true, 'duplicate' => false]);
    }

    $conflict = reservations_create_conflict($pdo, $data, $public);
    if ($conflict) {
        api_json([
            'ok' => false,
            'error' => $conflict['error'],
            'duplicate' => true,
            'code' => $conflict['code'],
        ], 409);
    }
    $code = trim((string) ($body['code'] ?? ''));
    if ($code === '' || $public) {
        $code = reservations_make_code($pdo);
    } else {
        $code = strtoupper(preg_replace('/[^A-Z0-9-]/i', '', $code) ?: '');
        if ($code === '') {
            $code = reservations_make_code($pdo);
        }
    }

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO shop_reservations
              (code, shop, shop_item_id, item_key, item_name, rental_type, unit_price, quantity, total_amount,
               customer_name, email, mobile, student_id, year_level, remarks, status, submitted_at)
             VALUES
              (:code, :shop, :shop_item_id, :item_key, :item_name, :rental_type, :unit_price, :quantity, :total_amount,
               :customer_name, :email, :mobile, :student_id, :year_level, :remarks, :status, :submitted_at)'
        );
        $stmt->execute([
            'code' => mb_substr($code, 0, 32),
            ...$data,
        ]);
    } catch (PDOException $error) {
        if ((int) $error->getCode() === 23000) {
            api_json(['ok' => false, 'error' => 'A reservation with this code already exists.'], 409);
        }
        throw $error;
    }

    $id = (int) $pdo->lastInsertId();
    reservations_fulfill_prior_locker($pdo, $data, $id);
    $fetch = $pdo->prepare('SELECT * FROM shop_reservations WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    $row = $fetch->fetch() ?: [];
    $item = reservations_row($row);

    $mail = [
        'councilSent' => false,
        'confirmSent' => false,
        'councilError' => null,
        'confirmError' => null,
    ];
    // Public portal submissions always email; admin creates email when an address is present.
    if ($public || filter_var((string) ($row['email'] ?? ''), FILTER_VALIDATE_EMAIL)) {
        $mailResult = reservations_send_created_mail($row);
        $mail['councilSent'] = ($mailResult['council']['ok'] ?? false) === true;
        $mail['confirmSent'] = ($mailResult['confirm']['ok'] ?? false) === true;
        $mail['councilError'] = $mail['councilSent']
            ? null
            : (string) ($mailResult['council']['error'] ?? 'Could not notify the Student Council.');
        $mail['confirmError'] = $mail['confirmSent']
            ? null
            : (string) ($mailResult['confirm']['error'] ?? 'Could not email the customer.');
    }

    $message = $mail['confirmSent']
        ? 'Reservation saved. A confirmation was sent to the customer email.'
        : (
            $public
                ? 'Reservation saved. Email delivery may be unavailable; keep your reservation ID.'
                : 'Reservation saved.'
        );

    api_json([
        'ok' => true,
        'item' => $item,
        'mail' => $mail,
        'message' => $message,
    ], 201);
}

function reservations_update(): never
{
    api_require_manager();
    $pdo = api_pdo();
    reservations_ensure_tables($pdo);
    $body = api_read_json();
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        api_json(['ok' => false, 'error' => 'Reservation id is required.'], 422);
    }

    $stmt = $pdo->prepare('SELECT * FROM shop_reservations WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    $existing = $stmt->fetch();
    if (!$existing) {
        api_json(['ok' => false, 'error' => 'Reservation not found.'], 404);
    }

    $previousStatus = strtolower((string) ($existing['status'] ?? 'submitted'));
    $data = reservations_payload($body, false);
    if (reservations_locker_occupied($pdo, $data, $id)) {
        api_json(['ok' => false, 'error' => 'That locker already has an active reservation.'], 409);
    }
    $code = trim((string) ($body['code'] ?? $existing['code']));
    $code = strtoupper(preg_replace('/[^A-Z0-9-]/i', '', $code) ?: (string) $existing['code']);
    $notifyStatus = array_key_exists('notifyStatus', $body)
        ? (bool) $body['notifyStatus']
        : true;

    try {
        $update = $pdo->prepare(
            'UPDATE shop_reservations SET
                code = :code,
                shop = :shop,
                shop_item_id = :shop_item_id,
                item_key = :item_key,
                item_name = :item_name,
                rental_type = :rental_type,
                unit_price = :unit_price,
                quantity = :quantity,
                total_amount = :total_amount,
                customer_name = :customer_name,
                email = :email,
                mobile = :mobile,
                student_id = :student_id,
                year_level = :year_level,
                remarks = :remarks,
                status = :status,
                submitted_at = :submitted_at
             WHERE id = :id'
        );
        $update->execute([
            'id' => $id,
            'code' => mb_substr($code, 0, 32),
            ...$data,
        ]);
    } catch (PDOException $error) {
        if ((int) $error->getCode() === 23000) {
            api_json(['ok' => false, 'error' => 'A reservation with this code already exists.'], 409);
        }
        throw $error;
    }

    $fetch = $pdo->prepare('SELECT * FROM shop_reservations WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $id]);
    $row = $fetch->fetch() ?: [];
    $item = reservations_row($row);

    $statusChanged = $previousStatus !== strtolower((string) ($row['status'] ?? ''));
    $mail = [
        'statusSent' => false,
        'statusError' => null,
        'statusChanged' => $statusChanged,
    ];

    if ($notifyStatus && $statusChanged) {
        $statusMail = reservations_send_status_mail($row, $previousStatus);
        $mail['statusSent'] = ($statusMail['ok'] ?? false) === true;
        $mail['statusError'] = $mail['statusSent']
            ? null
            : (string) ($statusMail['error'] ?? 'Could not email the customer.');
    }

    $message = !$statusChanged
        ? 'Reservation updated.'
        : (
            $mail['statusSent']
                ? 'Reservation updated. A status email was sent to the customer.'
                : 'Reservation updated. Status email could not be sent.'
        );

    api_json([
        'ok' => true,
        'item' => $item,
        'mail' => $mail,
        'message' => $message,
    ]);
}

function reservations_delete(): never
{
    api_require_manager();
    $pdo = api_pdo();
    reservations_ensure_tables($pdo);
    $body = api_read_json();

    $ids = [];
    if (isset($body['ids']) && is_array($body['ids'])) {
        foreach ($body['ids'] as $raw) {
            $n = (int) $raw;
            if ($n > 0) {
                $ids[] = $n;
            }
        }
    }
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id > 0) {
        $ids[] = $id;
    }
    $ids = array_values(array_unique($ids));
    if ($ids === []) {
        api_json(['ok' => false, 'error' => 'Reservation id is required.'], 422);
    }

    if (count($ids) === 1) {
        $stmt = $pdo->prepare('DELETE FROM shop_reservations WHERE id = :id');
        $stmt->execute(['id' => $ids[0]]);
        api_json(['ok' => true]);
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare("DELETE FROM shop_reservations WHERE id IN ($placeholders)");
    $stmt->execute($ids);
    api_json(['ok' => true, 'deleted' => $stmt->rowCount()]);
}
