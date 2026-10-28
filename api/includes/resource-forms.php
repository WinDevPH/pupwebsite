<?php

declare(strict_types=1);

function resource_forms_ensure(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS form_groups (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          slug VARCHAR(64) NOT NULL,
          title VARCHAR(255) NOT NULL,
          note TEXT NULL,
          sort_order INT NOT NULL DEFAULT 0,
          is_published TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_form_groups_slug (slug),
          KEY idx_form_groups_published (is_published, sort_order)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS form_files (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          group_id INT UNSIGNED NOT NULL,
          title VARCHAR(255) NOT NULL,
          url VARCHAR(800) NOT NULL,
          sort_order INT NOT NULL DEFAULT 0,
          is_published TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_form_files_group (group_id, is_published, sort_order),
          CONSTRAINT fk_form_files_group
            FOREIGN KEY (group_id) REFERENCES form_groups (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $count = (int) $pdo->query('SELECT COUNT(*) FROM form_groups')->fetchColumn();
    if ($count === 0) {
        resource_forms_seed($pdo);
    }

    $ready = true;
}

function resource_forms_seed(PDO $pdo): void
{
    $groups = [
        [
            'slug' => 'ace-forms',
            'title' => 'PUP ACE Forms',
            'note' => 'Adding, changing, or withdrawing a subject.',
            'sort' => 1,
            'files' => [
                ['PUP ACE Form — Adding of Subject', 'https://drive.google.com/file/d/1WFKLhj3TWoDFALvFvXzmJO8bSMMcwai-/view?usp=sharing', 1],
                ['PUP ACE Form — Change of Schedule/Subject', 'https://drive.google.com/file/d/1JdAriJUHTK-GnW0rYyfxu_hKSjYfB8Ko/view?usp=sharing', 2],
                ['PUP ACE Form — Withdrawal', 'https://drive.google.com/file/d/1lv4m80iNljzCpPJzol_7ojq-5jXBAnMF/view?usp=sharing', 3],
            ],
        ],
        [
            'slug' => 'enrollment-readmission',
            'title' => 'Enrollment & Readmission',
            'note' => 'Override enrollment, completion, and return to the college.',
            'sort' => 2,
            'files' => [
                ['R0-Form Enrollment Form for Override', 'https://docs.google.com/document/d/17wC0eEKKh9JIPH3-fsHSzNpU_3spSsYk/edit?usp=sharing&ouid=117853699207286348297&rtpof=true&sd=true', 1],
                ['Application for Re-Admission', 'https://drive.google.com/file/d/1iwkS1l2xkktuL3XIhK1FQWPqvlc2t0Nl/view?usp=sharing', 2],
                ['PUP Completion Form R-1', 'https://drive.google.com/file/d/1-U4Ah7EjhzV3Qp2zkIqx_8PUvKGkj8lH/view?usp=sharing', 3],
            ],
        ],
        [
            'slug' => 'appeals',
            'title' => 'Letters of Appeal',
            'note' => 'Sample letters for scholastic standing.',
            'sort' => 3,
            'files' => [
                ['Sample Letter of Appeal — Quality Point Average System', 'https://docs.google.com/document/d/1YGstMT4iQKyT-iRLYKEwPQPSAJ9EcrP5/edit?usp=sharing&ouid=117853699207286348297&rtpof=true&sd=true', 1],
                ['Sample Letter of Appeal — Scholastic Delinquency', 'https://docs.google.com/document/d/1btguPxZR6UWCuaP6VD8tTUPc9AKXhxNg/edit?usp=sharing&ouid=117853699207286348297&rtpof=true&sd=true', 2],
                ['Sample Letter of Appeal — Two-Strike Rule', 'https://docs.google.com/document/d/1vcPmHVQ5GpXkSbcokBTZYBq0RqzQT-DO/edit?usp=sharing&ouid=117853699207286348297&rtpof=true&sd=true', 3],
            ],
        ],
        [
            'slug' => 'other-academic-forms',
            'title' => 'Other Academic Forms',
            'note' => null,
            'sort' => 4,
            'files' => [
                ['Accreditation Form', 'https://drive.google.com/file/d/1QVsG7qF_f3GN1MVR19y6SuknU-ZJlsCQ/view?usp=sharing', 1],
                ['Affidavit of Change of Grade Format', 'https://docs.google.com/document/d/1t0JLxFS4ysLVFJpt5VmoxdQrN_m496xu/edit?usp=sharing&ouid=117853699207286348297&rtpof=true&sd=true', 2],
                ['Promissory Notes', 'https://drive.google.com/drive/folders/1ySxUEjMevUF2eqfMQz1caG2xJ4j1NCXW?usp=sharing', 3],
            ],
        ],
    ];

    $groupStmt = $pdo->prepare(
        'INSERT INTO form_groups (slug, title, note, sort_order, is_published)
         VALUES (:slug, :title, :note, :sort_order, 1)'
    );
    $fileStmt = $pdo->prepare(
        'INSERT INTO form_files (group_id, title, url, sort_order, is_published)
         VALUES (:group_id, :title, :url, :sort_order, 1)'
    );

    foreach ($groups as $group) {
        $groupStmt->execute([
            'slug' => $group['slug'],
            'title' => $group['title'],
            'note' => $group['note'],
            'sort_order' => $group['sort'],
        ]);
        $groupId = (int) $pdo->lastInsertId();
        foreach ($group['files'] as $file) {
            $fileStmt->execute([
                'group_id' => $groupId,
                'title' => $file[0],
                'url' => $file[1],
                'sort_order' => $file[2],
            ]);
        }
    }
}

function resource_form_group_row(array $row, int $fileCount = 0): array
{
    return [
        'id' => (int) $row['id'],
        'slug' => (string) $row['slug'],
        'title' => (string) $row['title'],
        'note' => $row['note'] !== null && $row['note'] !== '' ? (string) $row['note'] : null,
        'sortOrder' => (int) $row['sort_order'],
        'published' => (int) $row['is_published'] === 1,
        'fileCount' => $fileCount,
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}

function resource_form_file_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'groupId' => (int) $row['group_id'],
        'title' => (string) $row['title'],
        'url' => (string) $row['url'],
        'sortOrder' => (int) $row['sort_order'],
        'published' => (int) $row['is_published'] === 1,
        'createdAt' => api_iso((string) $row['created_at']),
        'updatedAt' => api_iso((string) $row['updated_at']),
    ];
}

/** @return list<array<string, mixed>> */
function resource_form_files_for_group(PDO $pdo, int $groupId, bool $publishedOnly): array
{
    $sql = 'SELECT * FROM form_files WHERE group_id = :group_id';
    if ($publishedOnly) {
        $sql .= ' AND is_published = 1';
    }
    $sql .= ' ORDER BY sort_order ASC, id ASC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['group_id' => $groupId]);
    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $items[] = resource_form_file_row($row);
    }
    return $items;
}
