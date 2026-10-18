<?php

declare(strict_types=1);

$src = dirname(__DIR__) . '/src/assets/pup-col-sc-logo.png';
$dir = dirname(__DIR__) . '/public/email';
$dest = $dir . '/logo.png';

if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
    fwrite(STDERR, "Could not create {$dir}\n");
    exit(1);
}

$img = @imagecreatefrompng($src);
if (!$img) {
    // Fallback: copy original if GD cannot decode
    if (!copy($src, $dest)) {
        fwrite(STDERR, "Could not load or copy logo\n");
        exit(1);
    }
    echo filesize($dest) . " (copied)\n";
    exit(0);
}

$w = imagesx($img);
$h = imagesy($img);
$tw = 160;
$th = (int) max(1, round($h * ($tw / max(1, $w))));
$out = imagecreatetruecolor($tw, $th);
imagealphablending($out, false);
imagesavealpha($out, true);
$transparent = imagecolorallocatealpha($out, 0, 0, 0, 127);
imagefilledrectangle($out, 0, 0, $tw, $th, $transparent);
imagealphablending($out, true);
imagecopyresampled($out, $img, 0, 0, 0, 0, $tw, $th, $w, $h);
imagepng($out, $dest, 8);
imagedestroy($img);
imagedestroy($out);

echo filesize($dest) . " bytes -> {$dest}\n";
