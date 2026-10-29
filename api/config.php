<?php

declare(strict_types=1);

return [
    'db' => [
        'host' => getenv('DB_HOST') ?: '127.0.0.1',
        'port' => (int) (getenv('DB_PORT') ?: 3306),
        'name' => getenv('DB_NAME') ?: 'pup_col_sc',
        'user' => getenv('DB_USER') ?: 'root',
        'pass' => getenv('DB_PASS') !== false ? (string) getenv('DB_PASS') : '',
        'charset' => getenv('DB_CHARSET') ?: 'utf8mb4',
    ],
    'cors_origins' => [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost',
        'http://127.0.0.1',
        'https://pupcolsc.com',
        'https://www.pupcolsc.com',
    ],
    'session_name' => 'pup_col_sc_session',
    'session_lifetime_hours' => 12,
    'remember_lifetime_days' => 30,
    'rate_limit' => [
        'max_attempts' => 5,
        'window_minutes' => 15,
        'lockout_minutes' => 15,
        'max_ip_attempts' => 20,
    ],
    'mail' => [
        'host' => getenv('SMTP_HOST') ?: 'smtp.hostinger.com',
        'port' => (int) (getenv('SMTP_PORT') ?: 465),
        'encryption' => getenv('SMTP_ENCRYPTION') ?: 'ssl',
        'user' => getenv('SMTP_USER') ?: '',
        'pass' => getenv('SMTP_PASS') !== false ? (string) getenv('SMTP_PASS') : '',
        'from' => getenv('MAIL_FROM') ?: (getenv('SMTP_USER') ?: ''),
        'from_name' => getenv('MAIL_FROM_NAME') ?: 'PUP COL Student Council',
        'to' => getenv('MAIL_TO') ?: (getenv('SMTP_USER') ?: ''),
        'site_url' => getenv('MAIL_SITE_URL') ?: '',
    ],
];
