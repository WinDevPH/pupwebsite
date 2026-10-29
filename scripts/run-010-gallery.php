<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/api/includes/bootstrap.php';

$pdo = api_pdo();
$root = dirname(__DIR__);

$pdo->exec(
    "CREATE TABLE IF NOT EXISTS gallery_batches (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      academic_year VARCHAR(32) NOT NULL,
      title VARCHAR(255) NOT NULL DEFAULT 'Council Photographs',
      is_published TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_gallery_batches_year (academic_year),
      KEY idx_gallery_batches_published (is_published, academic_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
);

$pdo->exec(
    "CREATE TABLE IF NOT EXISTS gallery_images (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      batch_id INT UNSIGNED NOT NULL,
      image_url VARCHAR(500) NOT NULL,
      title VARCHAR(255) NOT NULL,
      caption VARCHAR(255) NOT NULL DEFAULT '',
      alt_text VARCHAR(500) NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_gallery_images_batch (batch_id, sort_order, id),
      CONSTRAINT fk_gallery_images_batch
        FOREIGN KEY (batch_id) REFERENCES gallery_batches (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
);

$pdo->exec(
    "CREATE TABLE IF NOT EXISTS gallery_display_settings (
      id TINYINT UNSIGNED NOT NULL DEFAULT 1,
      pinned_academic_year VARCHAR(32) NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
);

$pdo->exec(
    'INSERT INTO gallery_display_settings (id, pinned_academic_year)
     VALUES (1, NULL)
     ON DUPLICATE KEY UPDATE id = id'
);

$seedDir = $root . '/public/uploads/gallery';
if (!is_dir($seedDir) && !mkdir($seedDir, 0755, true) && !is_dir($seedDir)) {
    fwrite(STDERR, "Could not create {$seedDir}\n");
    exit(1);
}

$seedFiles = [
    'council-formal.jpg' => 'src/assets/council/groups/council-formal.jpg',
    'council-candid.jpg' => 'src/assets/council/groups/council-candid.jpg',
    'officers-formal.jpg' => 'src/assets/council/groups/officers-formal.jpg',
    'council-polo.jpg' => 'src/assets/council/groups/council-polo.jpg',
    'officers-polo.jpg' => 'src/assets/council/groups/officers-polo.jpg',
    'council-polo-circle.jpg' => 'src/assets/council/groups/council-polo-circle.jpg',
];

foreach ($seedFiles as $name => $relative) {
    $from = $root . '/' . $relative;
    $to = $seedDir . '/' . $name;
    if (is_file($from) && !is_file($to)) {
        if (!copy($from, $to)) {
            fwrite(STDERR, "Could not copy {$relative}\n");
        }
    }
}

$count = (int) $pdo->query('SELECT COUNT(*) FROM gallery_batches')->fetchColumn();
if ($count > 0) {
    echo "gallery_batches already seeded ({$count} batches)\n";
    exit(0);
}

$pdo->prepare(
    "INSERT INTO gallery_batches (academic_year, title, is_published, sort_order)
     VALUES ('2026–2027', 'Council Photographs', 1, 0)"
)->execute();
$batchId = (int) $pdo->lastInsertId();

$images = [
    ['/uploads/gallery/council-formal.jpg', 'The Student Council', 'Formal portrait', 'Members of the PUP College of Law Student Council', 10],
    ['/uploads/gallery/council-candid.jpg', 'The Student Council', 'Together', 'PUP College of Law Student Council in formal attire', 20],
    ['/uploads/gallery/officers-formal.jpg', 'Officers', 'Formal portrait', 'Officers of the PUP College of Law Student Council', 30],
    ['/uploads/gallery/council-polo.jpg', 'The Student Council', 'College shirts', 'PUP College of Law Student Council in college shirts', 40],
    ['/uploads/gallery/officers-polo.jpg', 'Officers', 'College shirts', 'Officers of the PUP College of Law Student Council in college shirts', 50],
    ['/uploads/gallery/council-polo-circle.jpg', 'The Student Council', 'Circle', 'PUP College of Law Student Council gathered together', 60],
];

$insert = $pdo->prepare(
    'INSERT INTO gallery_images
      (batch_id, image_url, title, caption, alt_text, sort_order)
     VALUES
      (:batch_id, :image_url, :title, :caption, :alt_text, :sort_order)'
);

foreach ($images as [$url, $title, $caption, $alt, $sort]) {
    $insert->execute([
        'batch_id' => $batchId,
        'image_url' => $url,
        'title' => $title,
        'caption' => $caption,
        'alt_text' => $alt,
        'sort_order' => $sort,
    ]);
}

echo "gallery seeded: batch {$batchId} with " . count($images) . " images\n";
