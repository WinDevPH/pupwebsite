<?php

declare(strict_types=1);

/**
 * Lightweight SMTP client (SSL/TLS) for Hostinger and similar providers.
 * Supports multipart HTML + plain text, CID logo, and file attachments.
 */

require_once __DIR__ . '/email-templates.php';

function api_mail_config(): array
{
    $mail = api_config()['mail'] ?? [];
    return is_array($mail) ? $mail : [];
}

/**
 * @param list<array{path:string,name:string,mime?:string}> $attachments
 * @return array{ok:bool,error?:string}
 */
function api_send_mail(
    string $to,
    string $subject,
    string $textBody,
    ?string $replyTo = null,
    array $attachments = [],
    ?string $htmlBody = null,
): array {
    $cfg = api_mail_config();
    $host = trim((string) ($cfg['host'] ?? ''));
    $port = (int) ($cfg['port'] ?? 465);
    $user = trim((string) ($cfg['user'] ?? ''));
    $pass = (string) ($cfg['pass'] ?? '');
    $from = trim((string) ($cfg['from'] ?? $user));
    $fromName = trim((string) ($cfg['from_name'] ?? 'PUP COL Student Council'));
    $encryption = strtolower(trim((string) ($cfg['encryption'] ?? 'ssl')));

    if ($host === '' || $user === '' || $from === '') {
        return ['ok' => false, 'error' => 'Mail is not configured. Set SMTP_* in the environment file.'];
    }

    $to = trim($to);
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'error' => 'Invalid recipient email.'];
    }

    $remote = ($encryption === 'ssl' || $encryption === 'smtps' ? 'ssl://' : '') . $host;
    $errno = 0;
    $errstr = '';
    $socket = @stream_socket_client(
        $remote . ':' . $port,
        $errno,
        $errstr,
        25,
        STREAM_CLIENT_CONNECT,
        stream_context_create([
            'ssl' => [
                'verify_peer' => true,
                'verify_peer_name' => true,
                'allow_self_signed' => false,
            ],
        ]),
    );

    if (!$socket) {
        return ['ok' => false, 'error' => 'Could not connect to mail server: ' . ($errstr !== '' ? $errstr : (string) $errno)];
    }

    stream_set_timeout($socket, 25);

    try {
        smtp_expect($socket, [220]);
        smtp_command($socket, 'EHLO pupcolsc.com', [250]);

        if ($encryption === 'tls' || $encryption === 'starttls') {
            smtp_command($socket, 'STARTTLS', [220]);
            $crypto = stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            if ($crypto !== true) {
                throw new RuntimeException('STARTTLS failed.');
            }
            smtp_command($socket, 'EHLO pupcolsc.com', [250]);
        }

        smtp_command($socket, 'AUTH LOGIN', [334]);
        smtp_command($socket, base64_encode($user), [334]);
        smtp_command($socket, base64_encode($pass), [235]);

        smtp_command($socket, 'MAIL FROM:<' . $from . '>', [250]);
        smtp_command($socket, 'RCPT TO:<' . $to . '>', [250, 251]);
        smtp_command($socket, 'DATA', [354]);

        $mime = smtp_build_mime(
            $from,
            $fromName,
            $to,
            $subject,
            $textBody,
            $htmlBody,
            $replyTo,
            $attachments,
        );
        fwrite($socket, $mime . "\r\n.\r\n");
        smtp_expect($socket, [250]);
        smtp_command($socket, 'QUIT', [221]);
    } catch (Throwable $error) {
        fclose($socket);
        return ['ok' => false, 'error' => $error->getMessage()];
    }

    fclose($socket);
    return ['ok' => true];
}

/**
 * @param resource $socket
 * @param list<int> $okCodes
 */
function smtp_expect($socket, array $okCodes): string
{
    $response = '';
    while (($line = fgets($socket, 515)) !== false) {
        $response .= $line;
        if (isset($line[3]) && $line[3] === ' ') {
            break;
        }
    }

    $code = (int) substr($response, 0, 3);
    if (!in_array($code, $okCodes, true)) {
        throw new RuntimeException(trim($response) !== '' ? trim($response) : 'Unexpected SMTP response.');
    }

    return $response;
}

/**
 * @param resource $socket
 * @param list<int> $okCodes
 */
function smtp_command($socket, string $command, array $okCodes): string
{
    fwrite($socket, $command . "\r\n");
    return smtp_expect($socket, $okCodes);
}

/**
 * @param list<array{path:string,name:string,mime?:string}> $attachments
 */
function smtp_build_mime(
    string $from,
    string $fromName,
    string $to,
    string $subject,
    string $textBody,
    ?string $htmlBody,
    ?string $replyTo,
    array $attachments,
): string {
    $mixedBoundary = 'm_' . bin2hex(random_bytes(10));
    $relatedBoundary = 'r_' . bin2hex(random_bytes(10));
    $altBoundary = 'a_' . bin2hex(random_bytes(10));
    $encodedSubject = smtp_encode_header($subject);
    $encodedFrom = smtp_encode_header($fromName) . ' <' . $from . '>';

    $headers = [
        'Date: ' . date('r'),
        'From: ' . $encodedFrom,
        'To: <' . $to . '>',
        'Subject: ' . $encodedSubject,
        'MIME-Version: 1.0',
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@pupcolsc.com>',
        'X-Mailer: PUP-COL-SC-Portal',
    ];

    if ($replyTo !== null && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
        $headers[] = 'Reply-To: <' . $replyTo . '>';
    }

    $headers[] = 'Content-Type: multipart/mixed; boundary="' . $mixedBoundary . '"';

    $plain = str_replace(["\r\n", "\r"], "\n", $textBody);
    $hasHtml = is_string($htmlBody) && trim($htmlBody) !== '';
    $logoPath = $hasHtml ? api_mail_logo_path() : null;
    $hasLogo = is_string($logoPath) && is_readable($logoPath);

    $parts = '';

    // Message body (related = HTML + CID logo; otherwise alternative or plain)
    $parts .= '--' . $mixedBoundary . "\r\n";

    if ($hasHtml) {
        $parts .= 'Content-Type: multipart/related; boundary="' . $relatedBoundary . "\"\r\n\r\n";

        $parts .= '--' . $relatedBoundary . "\r\n";
        $parts .= 'Content-Type: multipart/alternative; boundary="' . $altBoundary . "\"\r\n\r\n";

        $parts .= '--' . $altBoundary . "\r\n";
        $parts .= "Content-Type: text/plain; charset=UTF-8\r\n";
        $parts .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
        $parts .= quoted_printable_encode($plain) . "\r\n";

        $parts .= '--' . $altBoundary . "\r\n";
        $parts .= "Content-Type: text/html; charset=UTF-8\r\n";
        $parts .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
        $parts .= quoted_printable_encode(str_replace(["\r\n", "\r"], "\n", $htmlBody)) . "\r\n";

        $parts .= '--' . $altBoundary . "--\r\n";

        if ($hasLogo) {
            $logoData = base64_encode((string) file_get_contents($logoPath));
            $parts .= '--' . $relatedBoundary . "\r\n";
            $parts .= "Content-Type: image/png; name=\"logo.png\"\r\n";
            $parts .= "Content-Transfer-Encoding: base64\r\n";
            $parts .= "Content-ID: <pupcolsc-logo>\r\n";
            $parts .= "Content-Disposition: inline; filename=\"logo.png\"\r\n\r\n";
            $parts .= chunk_split($logoData) . "\r\n";
        }

        $parts .= '--' . $relatedBoundary . "--\r\n";
    } else {
        $parts .= "Content-Type: text/plain; charset=UTF-8\r\n";
        $parts .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
        $parts .= quoted_printable_encode($plain) . "\r\n";
    }

    foreach ($attachments as $file) {
        $path = (string) ($file['path'] ?? '');
        $name = (string) ($file['name'] ?? 'attachment');
        $mime = (string) ($file['mime'] ?? 'application/octet-stream');
        if ($path === '' || !is_readable($path)) {
            continue;
        }
        $data = base64_encode((string) file_get_contents($path));
        $safeName = str_replace(['"', "\r", "\n"], '', $name);
        $parts .= '--' . $mixedBoundary . "\r\n";
        $parts .= 'Content-Type: ' . $mime . '; name="' . $safeName . "\"\r\n";
        $parts .= "Content-Transfer-Encoding: base64\r\n";
        $parts .= 'Content-Disposition: attachment; filename="' . $safeName . "\"\r\n\r\n";
        $parts .= chunk_split($data) . "\r\n";
    }

    $parts .= '--' . $mixedBoundary . "--\r\n";

    // Dot-stuff lines that start with '.'
    $parts = preg_replace('/^\./m', '..', $parts) ?? $parts;

    return implode("\r\n", $headers) . "\r\n\r\n" . $parts;
}

function smtp_encode_header(string $value): string
{
    if (preg_match('/^[\x20-\x7E]*$/', $value) === 1) {
        return $value;
    }

    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}
