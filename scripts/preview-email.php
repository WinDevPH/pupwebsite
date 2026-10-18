<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/api/includes/bootstrap.php';
require_once dirname(__DIR__) . '/api/includes/mailer.php';

$council = api_mail_template_council_request([
    'tracking' => 'COL-20261018-DEMO',
    'name' => 'Juan Dela Cruz',
    'email' => 'juan.delacruz@example.com',
    'subject' => 'Document Request',
    'body' => "Good day.\n\nI would like to request a certified true copy of my enrollment certification for scholarship renewal.\n\nThank you.",
    'attachment' => 'enrollment-form.pdf',
]);

$confirm = api_mail_template_request_confirmation([
    'tracking' => 'COL-20261018-DEMO',
    'name' => 'Juan Dela Cruz',
    'subject' => 'Document Request',
]);

$reservationCouncil = api_mail_template_council_reservation([
    'code' => 'RSV-DEMO01',
    'name' => 'Juan Dela Cruz',
    'email' => 'juan.delacruz@example.com',
    'shop' => 'merch',
    'itemName' => 'College shirt',
    'quantity' => 2,
    'unitPrice' => 350,
    'totalAmount' => 700,
    'mobile' => '09171234567',
    'studentId' => '2024-00123',
    'year' => 'Year 2',
    'remarks' => 'Medium size, please.',
]);

$reservationConfirm = api_mail_template_reservation_confirmation([
    'code' => 'RSV-DEMO01',
    'name' => 'Juan Dela Cruz',
    'shop' => 'merch',
    'itemName' => 'College shirt',
    'quantity' => 2,
    'totalAmount' => 700,
    'status' => 'submitted',
]);

$reservationStatus = api_mail_template_reservation_status([
    'code' => 'RSV-DEMO01',
    'name' => 'Juan Dela Cruz',
    'shop' => 'merch',
    'itemName' => 'College shirt',
    'quantity' => 2,
    'totalAmount' => 700,
    'status' => 'confirmed',
    'previousStatus' => 'submitted',
]);

$dir = dirname(__DIR__) . '/public/email';
if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
}

$logoData = '';
$logoPath = api_mail_logo_path();
if ($logoPath) {
    $logoData = 'data:image/png;base64,' . base64_encode((string) file_get_contents($logoPath));
}

$withLogo = static function (string $html) use ($logoData): string {
    return str_replace('cid:pupcolsc-logo', $logoData !== '' ? $logoData : '', $html);
};

file_put_contents($dir . '/preview-council.html', $withLogo($council['html']));
file_put_contents($dir . '/preview-confirmation.html', $withLogo($confirm['html']));
file_put_contents($dir . '/preview-reservation-council.html', $withLogo($reservationCouncil['html']));
file_put_contents($dir . '/preview-reservation-confirmation.html', $withLogo($reservationConfirm['html']));
file_put_contents($dir . '/preview-reservation-status.html', $withLogo($reservationStatus['html']));

echo "Wrote request + reservation email previews in public/email/\n";

$send = ($argv[1] ?? '') === '--send';
if (!$send) {
    exit(0);
}

$to = (string) (api_mail_config()['to'] ?? '');
if ($to === '') {
    fwrite(STDERR, "MAIL_TO not set\n");
    exit(1);
}

$result = api_send_mail(
    $to,
    '[COL-20261018-DEMO] Document Request · design preview',
    $council['text'],
    'juan.delacruz@example.com',
    [],
    $council['html'],
);

echo ($result['ok'] ?? false) ? "Council preview mailed to {$to}\n" : ('Mail failed: ' . ($result['error'] ?? 'unknown') . "\n");

$confirmResult = api_send_mail(
    $to,
    'Request received · COL-20261018-DEMO · design preview',
    $confirm['text'],
    $to,
    [],
    $confirm['html'],
);

echo ($confirmResult['ok'] ?? false) ? "Confirmation preview mailed to {$to}\n" : ('Confirm failed: ' . ($confirmResult['error'] ?? 'unknown') . "\n");
