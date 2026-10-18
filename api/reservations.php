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
    api_json([
        'ok' => false,
        'error' => 'Database unavailable. Run scripts/run-013-shop-reservations.php and start MySQL.',
        'detail' => $error->getMessage(),
    ], 503);
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
    $ready = true;
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
        'submittedAt' => api_iso((string) $row['submitted_at']) ?? date('c'),
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
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
        $councilResult = api_send_mail(
            $councilTo,
            '[' . $code . '] ' . $shopLabel . ' reservation: ' . $payload['itemName'],
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
    $unitPrice = (float) ($body['unitPrice'] ?? $body['unit_price'] ?? $body['price'] ?? 0);
    if ($unitPrice < 0) {
        $unitPrice = 0.0;
    }
    $totalAmount = isset($body['totalAmount']) || isset($body['total_amount'])
        ? (float) ($body['totalAmount'] ?? $body['total_amount'])
        : round($unitPrice * $quantity, 2);
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
            $stmt = $pdo->prepare('SELECT * FROM shop_reservations WHERE id = :id LIMIT 1');
            $stmt->execute(['id' => $id]);
        } else {
            $stmt = $pdo->prepare('SELECT * FROM shop_reservations WHERE code = :code LIMIT 1');
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

    $sql = 'SELECT * FROM shop_reservations WHERE 1=1';
    $params = [];
    if ($shop !== '') {
        $sql .= ' AND shop = :shop';
        $params['shop'] = $shop;
    }
    if ($status !== '') {
        $sql .= ' AND status = :status';
        $params['status'] = $status;
    }
    $sql .= ' ORDER BY submitted_at DESC, id DESC';

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
              (code, shop, shop_item_id, item_key, item_name, unit_price, quantity, total_amount,
               customer_name, email, mobile, student_id, year_level, remarks, status, submitted_at)
             VALUES
              (:code, :shop, :shop_item_id, :item_key, :item_name, :unit_price, :quantity, :total_amount,
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
