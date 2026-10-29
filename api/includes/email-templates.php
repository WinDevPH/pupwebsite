<?php

declare(strict_types=1);

/**
 * Minimal HTML email layouts for the Student Services Portal.
 * Table-based, fluid ≤600px, consistent header / body / footer spacing.
 */

function api_mail_site_url(): string
{
    $cfg = api_mail_config();
    $url = trim((string) ($cfg['site_url'] ?? ''));
    if ($url !== '') {
        return rtrim($url, '/');
    }

    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || ((int) ($_SERVER['SERVER_PORT'] ?? 0) === 443);
    $host = (string) ($_SERVER['HTTP_HOST'] ?? 'pupcolsc.com');
    if ($host === 'localhost' || str_starts_with($host, '127.0.0.1')) {
        return 'http://localhost:5173';
    }

    return ($https ? 'https://' : 'http://') . $host;
}

function api_mail_logo_path(): ?string
{
    $candidates = [
        api_project_root() . '/public/email/logo.png',
        api_project_root() . '/email/logo.png',
        api_project_root() . '/src/assets/pup-col-sc-logo.png',
    ];
    foreach ($candidates as $path) {
        if (is_readable($path)) {
            return $path;
        }
    }
    return null;
}

function api_mail_escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function api_mail_font(): string
{
    return '-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif';
}

function api_mail_sanitize_reply_html(string $html): string
{
    $html = preg_replace('/<script\b[^>]*>.*?<\/script>/is', '', $html) ?? $html;
    $html = preg_replace('/<style\b[^>]*>.*?<\/style>/is', '', $html) ?? $html;
    $clean = strip_tags($html, '<p><br><strong><b><em><i><u><s><strike><ul><ol><li><a>');
    $clean = preg_replace_callback(
        '/<a\b([^>]*)>/i',
        static function (array $match): string {
            $attrs = $match[1] ?? '';
            if (!preg_match('/href\s*=\s*(["\'])(.*?)\1/i', $attrs, $hrefMatch)) {
                return '<a>';
            }
            $url = trim((string) $hrefMatch[2]);
            if (!preg_match('#^(https?://|mailto:)#i', $url)) {
                return '<a>';
            }
            return '<a href="' . htmlspecialchars($url, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
                . '" style="color:#18181b;text-decoration:underline;">';
        },
        $clean,
    ) ?? $clean;

    // Normalize spacing inside rich replies for email clients.
    $clean = preg_replace('/<p(\s[^>]*)?>/i', '<p style="margin:0 0 12px;padding:0;">', $clean) ?? $clean;
    $clean = preg_replace('/<ul(\s[^>]*)?>/i', '<ul style="margin:0 0 12px;padding:0 0 0 20px;">', $clean) ?? $clean;
    $clean = preg_replace('/<ol(\s[^>]*)?>/i', '<ol style="margin:0 0 12px;padding:0 0 0 20px;">', $clean) ?? $clean;
    $clean = preg_replace('/<li(\s[^>]*)?>/i', '<li style="margin:0 0 4px;padding:0;">', $clean) ?? $clean;

    return trim($clean);
}

function api_mail_html_to_text(string $html): string
{
    $text = preg_replace('/<\s*br\s*\/?\s*>/i', "\n", $html) ?? $html;
    $text = preg_replace('/<\/\s*p\s*>/i', "\n\n", $text) ?? $text;
    $text = preg_replace('/<\/\s*li\s*>/i', "\n", $text) ?? $text;
    $text = preg_replace('/<\s*li[^>]*>/i', '- ', $text) ?? $text;
    $text = strip_tags($text);
    $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = preg_replace("/[ \t]+\n/", "\n", $text) ?? $text;
    $text = preg_replace("/\n{3,}/", "\n\n", $text) ?? $text;
    return trim($text);
}

function api_mail_section_label(string $label): string
{
    $font = api_mail_font();
    return '<p style="margin:0 0 10px;padding:0;font-family:' . $font . ';font-size:11px;line-height:1.4;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#a1a1aa;">'
        . api_mail_escape($label)
        . '</p>';
}

/**
 * @param list<array{0:string,1:string}> $rows
 */
function api_mail_meta_table(array $rows): string
{
    $font = api_mail_font();
    $html = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;background:#fafafa;border:1px solid #e4e4e7;">';
    $last = count($rows) - 1;
    foreach ($rows as $i => [$label, $value]) {
        $border = $i === $last ? '0' : '1px solid #ececee';
        $html .= '
      <tr>
        <td class="email-meta-label" style="width:34%;padding:14px 16px;border-bottom:' . $border . ';vertical-align:top;font-family:' . $font . ';font-size:12px;line-height:1.45;color:#71717a;">'
            . api_mail_escape($label) . '</td>
        <td class="email-meta-value" style="padding:14px 16px;border-bottom:' . $border . ';vertical-align:top;font-family:' . $font . ';font-size:13px;line-height:1.55;font-weight:500;color:#18181b;word-break:break-word;">'
            . api_mail_escape($value) . '</td>
      </tr>';
    }
    $html .= '</table>';
    return $html;
}

function api_mail_message_block(string $htmlContent, bool $muted = false): string
{
    $font = api_mail_font();
    $bg = $muted ? '#fafafa' : '#ffffff';
    $border = $muted ? '#e4e4e7' : '#e4e4e7';
    $color = $muted ? '#52525b' : '#27272a';
    $size = $muted ? '13px' : '14px';

    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;background:' . $bg . ';border:1px solid ' . $border . ';">
      <tr>
        <td style="padding:16px 18px;font-family:' . $font . ';font-size:' . $size . ';line-height:1.65;color:' . $color . ';word-break:break-word;">'
        . $htmlContent .
        '</td>
      </tr>
    </table>';
}

/**
 * @param array{
 *   tracking:string,
 *   name:string,
 *   email:string,
 *   subject:string,
 *   body:string,
 *   attachment:string
 * } $data
 * @return array{text:string,html:string}
 */
function api_mail_template_council_request(array $data): array
{
    $tracking = (string) $data['tracking'];
    $name = (string) $data['name'];
    $email = (string) $data['email'];
    $subject = (string) $data['subject'];
    $body = (string) $data['body'];
    $attachment = (string) $data['attachment'];
    $site = api_mail_site_url();
    $adminUrl = $site . '/admin/requests';
    $filed = date('M j, Y · g:i A');

    $text = implode("\n", [
        'PUP College of Law Student Council',
        'New portal request',
        '',
        'Tracking ID: ' . $tracking,
        'Filed: ' . $filed,
        'Name: ' . $name,
        'Email: ' . $email,
        'Subject: ' . $subject,
        'Attachment: ' . $attachment,
        '',
        'Message:',
        $body,
        '',
        'Reply to this email to contact the sender.',
        'Admin: ' . $adminUrl,
        '',
        'studentcouncil@pupcolsc.com',
    ]);

    $html = api_mail_layout([
        'preheader' => 'New request ' . $tracking . ' — ' . $subject,
        'title' => 'New request',
        'intro' => $attachment !== '' && $attachment !== 'None'
            ? 'A submission was received through the Student Services Portal. Reply to this email to reach the sender. The attachment is included.'
            : 'A submission was received through the Student Services Portal. Reply to this email to reach the sender.',
        'bodyHtml' => api_mail_section_label('Request details')
            . api_mail_meta_table([
                ['Tracking ID', $tracking],
                ['Filed', $filed],
                ['Sender', $name],
                ['Email', $email],
                ['Subject', $subject],
                ['Attachment', $attachment],
            ])
            . '<div style="height:24px;line-height:24px;font-size:24px;">&nbsp;</div>'
            . api_mail_section_label('Message')
            . api_mail_message_block(nl2br(api_mail_escape($body))),
        'ctaLabel' => 'Open in admin',
        'ctaUrl' => $adminUrl,
        'footnote' => 'Reply directly to this email to contact ' . $name . '.',
    ]);

    return ['text' => $text, 'html' => $html];
}

/**
 * @param array{
 *   tracking:string,
 *   name:string,
 *   subject:string,
 *   message:string,
 *   messageHtml?:string,
 *   originalBody?:string
 * } $data
 * @return array{text:string,html:string}
 */
function api_mail_template_request_reply(array $data): array
{
    $tracking = (string) $data['tracking'];
    $name = (string) $data['name'];
    $subject = (string) $data['subject'];
    $message = (string) $data['message'];
    $messageHtml = trim((string) ($data['messageHtml'] ?? ''));
    if ($messageHtml === '') {
        $messageHtml = nl2br(api_mail_escape($message));
    }
    $original = trim((string) ($data['originalBody'] ?? ''));
    $site = api_mail_site_url();
    $trackUrl = $site . '/portal#tracking';

    $text = implode("\n", [
        'PUP College of Law Student Council',
        '',
        'Hello ' . $name . ',',
        '',
        'Please see the reply regarding your request.',
        '',
        'Tracking ID: ' . $tracking,
        'Subject: ' . $subject,
        '',
        $message,
        '',
        'Track your request: ' . $trackUrl,
        '',
        'PUP College of Law Student Council',
        'studentcouncil@pupcolsc.com',
    ]);

    $quoteHtml = '';
    if ($original !== '') {
        $clipped = mb_strlen($original) > 1200 ? mb_substr($original, 0, 1200) . '…' : $original;
        $quoteHtml = '<div style="height:24px;line-height:24px;font-size:24px;">&nbsp;</div>'
            . api_mail_section_label('Your original message')
            . api_mail_message_block(nl2br(api_mail_escape($clipped)), true);
    }

    $html = api_mail_layout([
        'preheader' => 'Reply to your request — ' . $tracking,
        'title' => 'Reply to your request',
        'intro' => 'Hello ' . $name . ', the Student Council has responded to your submission.',
        'bodyHtml' => api_mail_section_label('Request')
            . api_mail_meta_table([
                ['Tracking ID', $tracking],
                ['Subject', $subject],
            ])
            . '<div style="height:24px;line-height:24px;font-size:24px;">&nbsp;</div>'
            . api_mail_section_label('Message')
            . api_mail_message_block($messageHtml)
            . $quoteHtml,
        'ctaLabel' => 'Track request',
        'ctaUrl' => $trackUrl,
        'footnote' => 'You may reply to this email to continue the conversation.',
    ]);

    return ['text' => $text, 'html' => $html];
}

function api_mail_reservation_status_label(string $status): string
{
    return match (strtolower(trim($status))) {
        'pending' => 'Pending',
        'submitted' => 'Submitted',
        'confirmed' => 'Confirmed',
        'fulfilled' => 'Fulfilled',
        'cancelled' => 'Cancelled',
        default => ucfirst($status),
    };
}

function api_mail_reservation_shop_label(string $shop): string
{
    return strtolower(trim($shop)) === 'locker' ? 'Locker' : 'Merch';
}

function api_mail_format_pesos(float $amount): string
{
    return '₱' . number_format($amount, 2, '.', ',');
}

/**
 * @param array{
 *   code:string,
 *   name:string,
 *   email:string,
 *   shop:string,
 *   itemName:string,
 *   quantity:int,
 *   unitPrice:float,
 *   totalAmount:float,
 *   mobile?:string,
 *   studentId?:string,
 *   year?:string,
 *   remarks?:string
 * } $data
 * @return array{text:string,html:string}
 */
function api_mail_template_council_reservation(array $data): array
{
    $code = (string) $data['code'];
    $name = (string) $data['name'];
    $email = (string) $data['email'];
    $shop = api_mail_reservation_shop_label((string) $data['shop']);
    $itemName = (string) $data['itemName'];
    $quantity = max(1, (int) ($data['quantity'] ?? 1));
    $unitPrice = (float) ($data['unitPrice'] ?? 0);
    $totalAmount = (float) ($data['totalAmount'] ?? 0);
    $mobile = trim((string) ($data['mobile'] ?? ''));
    $studentId = trim((string) ($data['studentId'] ?? ''));
    $year = trim((string) ($data['year'] ?? ''));
    $remarks = trim((string) ($data['remarks'] ?? ''));
    $site = api_mail_site_url();
    $adminUrl = $site . '/admin/reservations';
    $filed = date('M j, Y · g:i A');

    $meta = [
        ['Reservation ID', $code],
        ['Filed', $filed],
        ['Shop', $shop],
        ['Item', $itemName],
        ['Quantity', (string) $quantity],
        ['Unit price', api_mail_format_pesos($unitPrice)],
        ['Total', api_mail_format_pesos($totalAmount)],
        ['Name', $name],
        ['Email', $email],
    ];
    if ($mobile !== '') {
        $meta[] = ['Mobile', $mobile];
    }
    if ($studentId !== '') {
        $meta[] = ['Student ID', $studentId];
    }
    if ($year !== '') {
        $meta[] = ['Year level', $year];
    }

    $textLines = [
        'PUP College of Law Student Council',
        'New shop reservation',
        '',
        'Reservation ID: ' . $code,
        'Filed: ' . $filed,
        'Shop: ' . $shop,
        'Item: ' . $itemName,
        'Quantity: ' . $quantity,
        'Total: ' . api_mail_format_pesos($totalAmount),
        'Name: ' . $name,
        'Email: ' . $email,
    ];
    if ($mobile !== '') {
        $textLines[] = 'Mobile: ' . $mobile;
    }
    if ($studentId !== '') {
        $textLines[] = 'Student ID: ' . $studentId;
    }
    if ($year !== '') {
        $textLines[] = 'Year level: ' . $year;
    }
    if ($remarks !== '') {
        $textLines[] = '';
        $textLines[] = 'Remarks:';
        $textLines[] = $remarks;
    }
    $textLines[] = '';
    $textLines[] = 'Reply to this email to contact the student.';
    $textLines[] = 'Admin: ' . $adminUrl;
    $textLines[] = '';
    $textLines[] = 'studentcouncil@pupcolsc.com';

    $bodyHtml = api_mail_section_label('Reservation details')
        . api_mail_meta_table($meta);
    if ($remarks !== '') {
        $bodyHtml .= '<div style="height:24px;line-height:24px;font-size:24px;">&nbsp;</div>'
            . api_mail_section_label('Remarks')
            . api_mail_message_block(nl2br(api_mail_escape($remarks)));
    }

    $html = api_mail_layout([
        'preheader' => 'New ' . strtolower($shop) . ' reservation ' . $code,
        'title' => 'New reservation',
        'intro' => 'A ' . strtolower($shop) . ' reservation was submitted through the Student Services Portal.',
        'bodyHtml' => $bodyHtml,
        'ctaLabel' => 'Open reservations',
        'ctaUrl' => $adminUrl,
        'footnote' => 'Reply directly to this email to contact ' . $name . '.',
    ]);

    return ['text' => implode("\n", $textLines), 'html' => $html];
}

/**
 * @param array{
 *   code:string,
 *   name:string,
 *   shop:string,
 *   itemName:string,
 *   quantity:int,
 *   totalAmount:float,
 *   status?:string
 * } $data
 * @return array{text:string,html:string}
 */
function api_mail_template_reservation_confirmation(array $data): array
{
    $code = (string) $data['code'];
    $name = (string) $data['name'];
    $shop = api_mail_reservation_shop_label((string) $data['shop']);
    $itemName = (string) $data['itemName'];
    $quantity = max(1, (int) ($data['quantity'] ?? 1));
    $totalAmount = (float) ($data['totalAmount'] ?? 0);
    $status = api_mail_reservation_status_label((string) ($data['status'] ?? 'submitted'));
    $site = api_mail_site_url();
    $portalUrl = $site . '/portal';
    $font = api_mail_font();

    $text = implode("\n", [
        'PUP College of Law Student Council',
        '',
        'Hello ' . $name . ',',
        '',
        'We received your ' . strtolower($shop) . ' reservation.',
        '',
        'Reservation ID: ' . $code,
        'Item: ' . $itemName,
        'Quantity: ' . $quantity,
        'Total: ' . api_mail_format_pesos($totalAmount),
        'Status: ' . $status,
        '',
        'This is a reservation only. No payment is collected on the website.',
        'Keep this reservation ID for follow-ups. Status updates will be sent to this email.',
        '',
        'Portal: ' . $portalUrl,
        '',
        'PUP College of Law Student Council',
        'studentcouncil@pupcolsc.com',
    ]);

    $html = api_mail_layout([
        'preheader' => 'Reservation received — ' . $code,
        'title' => 'Reservation received',
        'intro' => 'Hello ' . $name . ', your ' . strtolower($shop) . ' reservation is on file with the Student Council.',
        'bodyHtml' => api_mail_section_label('Reservation details')
            . api_mail_meta_table([
                ['Reservation ID', $code],
                ['Shop', $shop],
                ['Item', $itemName],
                ['Quantity', (string) $quantity],
                ['Total', api_mail_format_pesos($totalAmount)],
                ['Status', $status],
            ])
            . '<div style="height:24px;line-height:24px;font-size:24px;">&nbsp;</div>'
            . api_mail_section_label('What happens next')
            . api_mail_message_block(
                '<p style="margin:0;padding:0;font-family:' . $font . ';font-size:14px;line-height:1.65;color:#3f3f46;">'
                . 'Keep your reservation ID for follow-ups. This is a <strong style="font-weight:600;color:#18181b;">reservation only</strong> — '
                . 'no checkout or payment happens on the website. You will receive another email when the Council updates your status.'
                . '</p>'
            ),
        'ctaLabel' => 'Open portal',
        'ctaUrl' => $portalUrl,
        'footnote' => 'If you did not submit this reservation, contact studentcouncil@pupcolsc.com.',
    ]);

    return ['text' => $text, 'html' => $html];
}

/**
 * @param array{
 *   code:string,
 *   name:string,
 *   shop:string,
 *   itemName:string,
 *   quantity:int,
 *   totalAmount:float,
 *   status:string,
 *   previousStatus?:string
 * } $data
 * @return array{text:string,html:string}
 */
function api_mail_template_reservation_status(array $data): array
{
    $code = (string) $data['code'];
    $name = (string) $data['name'];
    $shop = api_mail_reservation_shop_label((string) $data['shop']);
    $itemName = (string) $data['itemName'];
    $quantity = max(1, (int) ($data['quantity'] ?? 1));
    $totalAmount = (float) ($data['totalAmount'] ?? 0);
    $status = strtolower(trim((string) $data['status']));
    $statusLabel = api_mail_reservation_status_label($status);
    $previous = trim((string) ($data['previousStatus'] ?? ''));
    $site = api_mail_site_url();
    $portalUrl = $site . '/portal';
    $font = api_mail_font();

    $headline = match ($status) {
        'confirmed' => 'Reservation confirmed',
        'fulfilled' => 'Reservation fulfilled',
        'cancelled' => 'Reservation cancelled',
        'pending' => 'Reservation pending',
        default => 'Reservation update',
    };

    $nextCopy = match ($status) {
        'confirmed' => 'Your reservation is confirmed. Please wait for further instructions from the Student Council regarding pickup or claim.',
        'fulfilled' => 'Your reservation is marked fulfilled. If you still need help, reply to this email.',
        'cancelled' => 'Your reservation was cancelled. If this looks wrong, reply to this email and include your reservation ID.',
        'pending' => 'Your reservation is pending review. We will email you again when there is an update.',
        'submitted' => 'Your reservation remains on file as submitted. We will email you when the Council takes the next step.',
        default => 'Your reservation status was updated. Keep this email for your records.',
    };

    $textLines = [
        'PUP College of Law Student Council',
        '',
        'Hello ' . $name . ',',
        '',
        $headline . '.',
        '',
        'Reservation ID: ' . $code,
        'Item: ' . $itemName,
        'Shop: ' . $shop,
        'Quantity: ' . $quantity,
        'Total: ' . api_mail_format_pesos($totalAmount),
        'Status: ' . $statusLabel,
    ];
    if ($previous !== '') {
        $textLines[] = 'Previous status: ' . api_mail_reservation_status_label($previous);
    }
    $textLines[] = '';
    $textLines[] = $nextCopy;
    $textLines[] = '';
    $textLines[] = 'Portal: ' . $portalUrl;
    $textLines[] = '';
    $textLines[] = 'PUP College of Law Student Council';
    $textLines[] = 'studentcouncil@pupcolsc.com';
    $text = implode("\n", $textLines);

    $meta = [
        ['Reservation ID', $code],
        ['Shop', $shop],
        ['Item', $itemName],
        ['Quantity', (string) $quantity],
        ['Total', api_mail_format_pesos($totalAmount)],
        ['Status', $statusLabel],
    ];
    if ($previous !== '') {
        $meta[] = ['Previous status', api_mail_reservation_status_label($previous)];
    }

    $html = api_mail_layout([
        'preheader' => $statusLabel . ' — ' . $code,
        'title' => $headline,
        'intro' => 'Hello ' . $name . ', here is an update on your ' . strtolower($shop) . ' reservation.',
        'bodyHtml' => api_mail_section_label('Reservation details')
            . api_mail_meta_table($meta)
            . '<div style="height:24px;line-height:24px;font-size:24px;">&nbsp;</div>'
            . api_mail_section_label('Update')
            . api_mail_message_block(
                '<p style="margin:0;padding:0;font-family:' . $font . ';font-size:14px;line-height:1.65;color:#3f3f46;">'
                . api_mail_escape($nextCopy)
                . '</p>'
            ),
        'ctaLabel' => 'Open portal',
        'ctaUrl' => $portalUrl,
        'footnote' => 'You may reply to this email to reach the Student Council.',
    ]);

    return ['text' => $text, 'html' => $html];
}

/**
 * @param array{
 *   tracking:string,
 *   name:string,
 *   subject:string
 * } $data
 * @return array{text:string,html:string}
 */
function api_mail_template_request_confirmation(array $data): array
{
    $tracking = (string) $data['tracking'];
    $name = (string) $data['name'];
    $subject = (string) $data['subject'];
    $site = api_mail_site_url();
    $trackUrl = $site . '/portal#tracking';
    $font = api_mail_font();

    $text = implode("\n", [
        'PUP College of Law Student Council',
        '',
        'Hello ' . $name . ',',
        '',
        'We received your request.',
        '',
        'Tracking ID: ' . $tracking,
        'Subject: ' . $subject,
        '',
        'Keep this tracking ID. Look it up on the portal Tracking tab:',
        $trackUrl,
        '',
        'Acknowledgement is typically within 24 to 48 hours. Updates are sent to this address.',
        '',
        'PUP College of Law Student Council',
        'studentcouncil@pupcolsc.com',
    ]);

    $html = api_mail_layout([
        'preheader' => 'Request received — ' . $tracking,
        'title' => 'Request received',
        'intro' => 'Hello ' . $name . ', your submission to the PUP College of Law Student Council is on file.',
        'bodyHtml' => api_mail_section_label('Request details')
            . api_mail_meta_table([
                ['Tracking ID', $tracking],
                ['Subject', $subject],
            ])
            . '<div style="height:24px;line-height:24px;font-size:24px;">&nbsp;</div>'
            . api_mail_section_label('What happens next')
            . api_mail_message_block(
                '<p style="margin:0;padding:0;font-family:' . $font . ';font-size:14px;line-height:1.65;color:#3f3f46;">'
                . 'Keep your tracking ID for follow-ups. The Council typically responds within '
                . '<strong style="font-weight:600;color:#18181b;">24 to 48 hours</strong>. '
                . 'Updates will be sent to this email address.'
                . '</p>'
            ),
        'ctaLabel' => 'Track request',
        'ctaUrl' => $trackUrl,
        'footnote' => 'If you did not submit this request, contact studentcouncil@pupcolsc.com.',
    ]);

    return ['text' => $text, 'html' => $html];
}

/**
 * @param array{
 *   preheader:string,
 *   title:string,
 *   intro:string,
 *   bodyHtml:string,
 *   ctaLabel?:string,
 *   ctaUrl?:string,
 *   footnote?:string
 * } $props
 */
function api_mail_layout(array $props): string
{
    $preheader = api_mail_escape((string) ($props['preheader'] ?? ''));
    $title = api_mail_escape((string) ($props['title'] ?? ''));
    $intro = api_mail_escape((string) ($props['intro'] ?? ''));
    $bodyHtml = (string) ($props['bodyHtml'] ?? '');
    $ctaLabel = trim((string) ($props['ctaLabel'] ?? ''));
    $ctaUrl = trim((string) ($props['ctaUrl'] ?? ''));
    $footnote = api_mail_escape((string) ($props['footnote'] ?? ''));
    $site = api_mail_site_url();
    $year = date('Y');
    $font = api_mail_font();

    $ctaHtml = '';
    if ($ctaLabel !== '' && $ctaUrl !== '') {
        $ctaHtml = '
          <table role="presentation" cellpadding="0" cellspacing="0" class="email-cta" style="border-collapse:collapse;margin:0;">
            <tr>
              <td align="left" style="border-radius:6px;background:#18181b;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="' . api_mail_escape($ctaUrl) . '" style="height:44px;v-text-anchor:middle;width:160px;" arcsize="10%" stroke="f" fillcolor="#18181b">
                  <w:anchorlock/>
                  <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:700;">' . api_mail_escape($ctaLabel) . '</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-- -->
                <a href="' . api_mail_escape($ctaUrl) . '" style="display:inline-block;padding:13px 22px;font-family:' . $font . ';font-size:14px;line-height:1.2;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">'
            . api_mail_escape($ctaLabel) . '</a>
                <!--<![endif]-->
              </td>
            </tr>
          </table>';
    }

    return '<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
  <title>' . $title . '</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style type="text/css">
    body, table, td, a { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    * { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse !important; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    a { text-decoration: none; }
    .email-wrapper { width: 100% !important; }
    .email-shell { width: 100% !important; max-width: 600px !important; }
    @media only screen and (max-width: 620px) {
      .email-outer { padding: 20px 12px 32px !important; }
      .email-shell { width: 100% !important; }
      .email-header { padding: 0 4px 18px !important; }
      .email-brand-name { font-size: 12px !important; }
      .email-hero { padding: 24px 20px 8px !important; }
      .email-hero-title { font-size: 20px !important; line-height: 1.3 !important; }
      .email-hero-intro { font-size: 14px !important; }
      .email-body { padding: 8px 20px 8px !important; }
      .email-cta-wrap { padding: 20px 20px 8px !important; }
      .email-note { padding: 16px 20px 24px !important; }
      .email-footer { padding: 20px 8px 0 !important; text-align: left !important; }
      .email-meta-label,
      .email-meta-value { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      .email-meta-label { padding-bottom: 4px !important; border-bottom: 0 !important; }
      .email-meta-value { padding-top: 0 !important; }
      .email-cta a { display: block !important; text-align: center !important; width: 100% !important; box-sizing: border-box !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;color:#18181b;width:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;font-size:1px;line-height:1px;">'
    . $preheader . '&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>

  <table role="presentation" class="email-wrapper" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f4f4f5;width:100%;">
    <tr>
      <td align="center" class="email-outer" style="padding:32px 16px 48px;">

        <!--[if mso]>
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td>
        <![endif]-->
        <table role="presentation" class="email-shell" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:600px;width:100%;margin:0 auto;">

          <!-- HEADER -->
          <tr>
            <td class="email-header" style="padding:0 8px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="vertical-align:middle;width:44px;">
                    <img src="cid:pupcolsc-logo" width="40" height="40" alt="PUP COL-SC" style="display:block;width:40px;height:40px;border:0;" />
                  </td>
                  <td class="email-brand-name" style="vertical-align:middle;padding-left:14px;font-family:' . $font . ';font-size:13px;line-height:1.4;font-weight:600;color:#18181b;">
                    PUP College of Law<br />
                    <span style="display:inline-block;margin-top:2px;font-weight:400;color:#71717a;">Student Council</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CARD -->
          <tr>
            <td style="background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">

                <!-- HERO / TITLE -->
                <tr>
                  <td class="email-hero" style="padding:32px 32px 12px;font-family:' . $font . ';">
                    <h1 class="email-hero-title" style="margin:0;padding:0;font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-0.02em;color:#18181b;">'
                      . $title . '</h1>
                    <p class="email-hero-intro" style="margin:12px 0 0;padding:0;font-size:15px;line-height:1.65;color:#52525b;">'
                      . $intro . '</p>
                  </td>
                </tr>

                <!-- DIVIDER -->
                <tr>
                  <td style="padding:8px 32px 0;">
                    <div style="height:1px;line-height:1px;background:#ececee;font-size:1px;">&nbsp;</div>
                  </td>
                </tr>

                <!-- BODY -->
                <tr>
                  <td class="email-body" style="padding:24px 32px 8px;font-family:' . $font . ';">
                    ' . $bodyHtml . '
                  </td>
                </tr>

                <!-- CTA -->
                ' . ($ctaHtml !== '' ? '
                <tr>
                  <td class="email-cta-wrap" style="padding:24px 32px 8px;font-family:' . $font . ';">
                    ' . $ctaHtml . '
                  </td>
                </tr>' : '') . '

                <!-- NOTE -->
                <tr>
                  <td class="email-note" style="padding:20px 32px 32px;font-family:' . $font . ';">
                    <p style="margin:0;padding:0;font-size:12px;line-height:1.6;color:#a1a1aa;">'
                      . $footnote . '</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td class="email-footer" style="padding:24px 12px 0;font-family:' . $font . ';font-size:12px;line-height:1.65;color:#a1a1aa;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="font-family:' . $font . ';font-size:12px;line-height:1.65;color:#a1a1aa;">
                    <a href="mailto:studentcouncil@pupcolsc.com" style="color:#52525b;text-decoration:none;">studentcouncil@pupcolsc.com</a>
                    <span style="color:#d4d4d8;">&nbsp;&nbsp;·&nbsp;&nbsp;</span>
                    <a href="' . api_mail_escape($site) . '" style="color:#52525b;text-decoration:none;">Website</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:10px;font-family:' . $font . ';font-size:12px;line-height:1.55;color:#a1a1aa;">
                    © ' . $year . ' PUP College of Law Student Council<br />
                    Student Services Portal · Official notice
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!--[if mso]>
        </td></tr></table>
        <![endif]-->

      </td>
    </tr>
  </table>
</body>
</html>';
}
