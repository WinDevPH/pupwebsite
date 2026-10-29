<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';

api_cors();

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    api_json(['ok' => false, 'error' => 'Method not allowed.'], 405);
}

api_require_manager();

$files = [];
$multi = null;
if (isset($_FILES['images']) && is_array($_FILES['images'])) {
    $multi = $_FILES['images'];
} elseif (isset($_FILES['images_0']) || isset($_FILES['file'])) {
    // fall through to single handlers below
}

if (is_array($multi) && is_array($multi['name'] ?? null)) {
    $count = count($multi['name']);
    for ($i = 0; $i < $count; $i += 1) {
        $files[] = [
            'name' => (string) ($multi['name'][$i] ?? ''),
            'type' => (string) ($multi['type'][$i] ?? ''),
            'tmp_name' => (string) ($multi['tmp_name'][$i] ?? ''),
            'error' => (int) ($multi['error'][$i] ?? UPLOAD_ERR_NO_FILE),
            'size' => (int) ($multi['size'][$i] ?? 0),
        ];
    }
} elseif (isset($_FILES['image']) && is_array($_FILES['image'])) {
    $files[] = $_FILES['image'];
} elseif (isset($_FILES['file']) && is_array($_FILES['file'])) {
    $files[] = $_FILES['file'];
}

if ($files === []) {
    api_json(['ok' => false, 'error' => 'Choose one or more image files to upload.'], 422);
}

$allowed = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'image/gif' => 'gif',
];
$maxBytes = 20 * 1024 * 1024;
$publicDir = api_uploads_dir('gallery');
if (!is_dir($publicDir) && !mkdir($publicDir, 0755, true) && !is_dir($publicDir)) {
    api_json(['ok' => false, 'error' => 'Could not create upload folder.'], 500);
}

$uploaded = [];
$finfo = new finfo(FILEINFO_MIME_TYPE);

foreach ($files as $file) {
    $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error !== UPLOAD_ERR_OK) {
        $message = match ($error) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Image is too large. Max size is 20 MB.',
            UPLOAD_ERR_PARTIAL => 'Upload was interrupted. Try again.',
            UPLOAD_ERR_NO_FILE => 'Choose an image file to upload.',
            default => 'Could not upload the image.',
        };
        api_json(['ok' => false, 'error' => $message], 422);
    }

    $tmp = (string) ($file['tmp_name'] ?? '');
    $size = (int) ($file['size'] ?? 0);
    $original = (string) ($file['name'] ?? 'image');

    if ($tmp === '' || !is_uploaded_file($tmp)) {
        api_json(['ok' => false, 'error' => 'Invalid upload.'], 422);
    }
    if ($size <= 0 || $size > $maxBytes) {
        api_json(['ok' => false, 'error' => 'Image is too large. Max size is 20 MB.'], 422);
    }

    $mime = $finfo->file($tmp) ?: '';
    if (!isset($allowed[$mime])) {
        api_json(['ok' => false, 'error' => 'Use JPG, PNG, WEBP, or GIF images.'], 422);
    }

    $ext = $allowed[$mime];
    $base = api_slugify(pathinfo($original, PATHINFO_FILENAME));
    $filename = sprintf('%s-%s.%s', $base, bin2hex(random_bytes(4)), $ext);
    $dest = $publicDir . DIRECTORY_SEPARATOR . $filename;
    if (!move_uploaded_file($tmp, $dest)) {
        api_json(['ok' => false, 'error' => 'Could not save the uploaded image.'], 500);
    }

    $url = api_uploads_url('gallery', $filename);
    $uploaded[] = [
        'url' => $url,
        'image' => $url,
        'src' => $url,
        'filename' => $filename,
        'name' => $original,
    ];
}

api_json([
    'ok' => true,
    'items' => $uploaded,
    'url' => $uploaded[0]['url'] ?? null,
    'image' => $uploaded[0]['url'] ?? null,
], 201);
