<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';

api_cors();

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    api_json(['ok' => false, 'error' => 'Method not allowed.'], 405);
}

api_require_manager();

$file = $_FILES['image'] ?? $_FILES['file'] ?? null;
if (!is_array($file)) {
    api_json(['ok' => false, 'error' => 'Choose an image file to upload.'], 422);
}

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

$maxBytes = 20 * 1024 * 1024;
if ($size <= 0 || $size > $maxBytes) {
    api_json(['ok' => false, 'error' => 'Image is too large. Max size is 20 MB.'], 422);
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($tmp) ?: '';
$allowed = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'image/gif' => 'gif',
];

if (!isset($allowed[$mime])) {
    api_json(['ok' => false, 'error' => 'Use a JPG, PNG, WEBP, or GIF image.'], 422);
}

$ext = $allowed[$mime];
$base = api_slugify(pathinfo($original, PATHINFO_FILENAME));
$filename = sprintf('%s-%s.%s', $base, bin2hex(random_bytes(4)), $ext);

$publicDir = api_uploads_dir('projects');
if (!is_dir($publicDir) && !mkdir($publicDir, 0755, true) && !is_dir($publicDir)) {
    api_json(['ok' => false, 'error' => 'Could not create upload folder.'], 500);
}

$dest = $publicDir . DIRECTORY_SEPARATOR . $filename;
if (!move_uploaded_file($tmp, $dest)) {
    api_json(['ok' => false, 'error' => 'Could not save the uploaded image.'], 500);
}

$url = '/projects/uploads/' . $filename;

api_json([
    'ok' => true,
    'url' => $url,
    'image' => $url,
    'filename' => $filename,
], 201);
