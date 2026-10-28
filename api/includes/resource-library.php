<?php

declare(strict_types=1);

/** @return list<array{slug: string, title: string, url: string, sort: int}> */
function resource_library_link_defaults(): array
{
    return [
        [
            'slug' => 'student-handbook',
            'title' => 'Student Handbook',
            'url' => 'https://drive.google.com/file/d/1neq3kippfsVWgFeWYepQWOx04X4TaUlE/view?usp=sharing',
            'sort' => 1,
        ],
        [
            'slug' => 'enrollment-guidelines',
            'title' => 'Enrollment Guidelines',
            'url' => 'https://drive.google.com/drive/folders/133QcxmFnf5taCTjdLKPDUO4fAD8HGR-J?usp=sharing',
            'sort' => 2,
        ],
        [
            'slug' => 'jd-curriculum',
            'title' => 'Juris Doctor Curriculum',
            'url' => 'https://drive.google.com/drive/folders/1wX2DUTuWIhfmhpQC9J0kwX22oMz59iqf?usp=sharing',
            'sort' => 3,
        ],
        [
            'slug' => 'miscellaneous',
            'title' => 'Miscellaneous',
            'url' => 'https://drive.google.com/drive/folders/1y2apA30VR-cbCyZc01yPxJNVy7KeDa0f?usp=sharing',
            'sort' => 4,
        ],
    ];
}

function resource_library_ensure(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS resource_links (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          slug VARCHAR(64) NOT NULL,
          title VARCHAR(255) NOT NULL,
          url VARCHAR(800) NOT NULL,
          sort_order INT NOT NULL DEFAULT 0,
          is_published TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_resource_links_slug (slug),
          KEY idx_resource_links_published (is_published, sort_order)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $hasSettings = $pdo->query("SHOW TABLES LIKE 'site_settings'")->fetch();
    if ($hasSettings) {
        $pdo->exec("DELETE FROM site_settings WHERE setting_key = 'forms'");
    }

    $count = (int) $pdo->query('SELECT COUNT(*) FROM resource_links')->fetchColumn();
    if ($count === 0) {
        $stmt = $pdo->prepare(
            'INSERT INTO resource_links (slug, title, url, sort_order, is_published)
             VALUES (:slug, :title, :url, :sort_order, 1)'
        );
        foreach (resource_library_link_defaults() as $item) {
            $stmt->execute([
                'slug' => $item['slug'],
                'title' => $item['title'],
                'url' => $item['url'],
                'sort_order' => $item['sort'],
            ]);
        }
    }

    $ready = true;
}

function resource_link_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'slug' => (string) $row['slug'],
        'title' => (string) $row['title'],
        'url' => (string) $row['url'],
        'sortOrder' => (int) $row['sort_order'],
        'published' => (int) $row['is_published'] === 1,
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}
