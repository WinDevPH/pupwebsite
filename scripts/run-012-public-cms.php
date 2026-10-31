<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/api/includes/bootstrap.php';

$pdo = api_pdo();
$root = dirname(__DIR__);

$pdo->exec(
    "CREATE TABLE IF NOT EXISTS organizations (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug VARCHAR(64) NOT NULL,
      short_name VARCHAR(120) NOT NULL,
      name VARCHAR(255) NOT NULL,
      facebook_url VARCHAR(500) NOT NULL DEFAULT '',
      logo_url VARCHAR(500) NOT NULL DEFAULT '',
      academic_year VARCHAR(32) NOT NULL DEFAULT '2026–2027',
      sort_order INT NOT NULL DEFAULT 0,
      is_published TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_organizations_slug (slug),
      KEY idx_organizations_published (is_published, sort_order, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
);

$pdo->exec(
    "CREATE TABLE IF NOT EXISTS faq_items (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug VARCHAR(64) NOT NULL,
      question VARCHAR(500) NOT NULL,
      answer_html LONGTEXT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_published TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_faq_items_slug (slug),
      KEY idx_faq_items_published (is_published, sort_order, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
);

$pdo->exec(
    "CREATE TABLE IF NOT EXISTS documents (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      category VARCHAR(64) NOT NULL,
      doc_number VARCHAR(64) NOT NULL DEFAULT '',
      title VARCHAR(500) NOT NULL,
      url VARCHAR(1000) NOT NULL,
      series_label VARCHAR(120) NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0,
      is_published TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_documents_category (category, is_published, sort_order, id),
      KEY idx_documents_published (is_published, sort_order, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
);

$pdo->exec(
    "CREATE TABLE IF NOT EXISTS site_settings (
      setting_key VARCHAR(64) NOT NULL,
      payload_json LONGTEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
);

$pdo->exec(
    "CREATE TABLE IF NOT EXISTS shop_items (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      shop VARCHAR(32) NOT NULL,
      item_key VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      unit VARCHAR(64) NOT NULL DEFAULT '',
      stock INT NOT NULL DEFAULT 0,
      image_url VARCHAR(500) NOT NULL DEFAULT '',
      alt_text VARCHAR(500) NOT NULL DEFAULT '',
      number_label VARCHAR(32) NULL,
      availability VARCHAR(32) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_published TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_shop_items_shop_key (shop, item_key),
      KEY idx_shop_items_published (shop, is_published, sort_order, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
);

function cms_ensure_dir(string $dir): void
{
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        fwrite(STDERR, "Could not create {$dir}\n");
        exit(1);
    }
}

function cms_copy_file(string $from, string $to): void
{
    if (!is_file($from)) {
        fwrite(STDERR, "Missing source: {$from}\n");
        return;
    }
    if (is_file($to)) {
        return;
    }
    if (!copy($from, $to)) {
        fwrite(STDERR, "Could not copy to {$to}\n");
    }
}

$orgLogoDir = $root . '/public/uploads/org-logos';
cms_ensure_dir($orgLogoDir);

$orgLogoCopies = [
    'codal.png' => 'codal.png',
    'lacp.png' => 'lacp.png',
    'comelec.png' => 'comelec.png',
    'research-corps.png' => 'research-corps.png',
    'student-council.png' => 'student-council.png',
    'barops.png' => 'bar-ops.png',
    'mcds.png' => 'mcds.png',
    'solicitor.png' => 'solicitor.png',
];

foreach ($orgLogoCopies as $source => $dest) {
    cms_copy_file(
        $root . '/src/assets/org-logos/' . $source,
        $orgLogoDir . '/' . $dest
    );
}

$shopDir = $root . '/public/uploads/shop';
cms_ensure_dir($shopDir);

$shopCopies = [
    'locker-bay.jpg',
    'college-shirt.jpg',
    'college-polo.jpg',
    'lanyard.jpg',
];

foreach ($shopCopies as $file) {
    cms_copy_file(
        $root . '/src/assets/shop/' . $file,
        $shopDir . '/' . $file
    );
}

$orgCount = (int) $pdo->query('SELECT COUNT(*) FROM organizations')->fetchColumn();
if ($orgCount === 0) {
    $orgs = [
        ['codal', 'CODAL', 'Christians On Demand At Law', 'https://www.facebook.com/ChristiansOnDemandAtLaw/', '/uploads/org-logos/codal.png', 10],
        ['lacp', 'LACP', 'Legal Aid Clinic of PUP College of Law', 'https://www.facebook.com/puplawlegalaidclinic/', '/uploads/org-logos/lacp.png', 20],
        ['comelec', 'COMELEC', 'PUP College of Law - COMELEC', 'https://www.facebook.com/PUPLawCOMELEC/', '/uploads/org-logos/comelec.png', 30],
        ['research-corps', 'Research Corps', 'PUP College of Law Research Corps', 'https://www.facebook.com/PUPRC2015/', '/uploads/org-logos/research-corps.png', 40],
        ['student-council', 'Student Council', 'PUP College of Law Student Council', 'https://www.facebook.com/pupcl.sc', '/uploads/org-logos/student-council.png', 50],
        ['bar-ops', 'Bar Operations', 'PUP Law Bar Operations', 'https://www.facebook.com/PUPBarOperations', '/uploads/org-logos/bar-ops.png', 60],
        ['mcds', 'MCDS', 'PUP Law Moot Court and Debate Society', 'https://www.facebook.com/PUPLawMCDS/', '/uploads/org-logos/mcds.png', 70],
        ['solicitor', 'The Solicitor', 'PUP College of Law - The Solicitor', 'https://www.facebook.com/solicitorpuplaw', '/uploads/org-logos/solicitor.png', 80],
    ];

    $insertOrg = $pdo->prepare(
        'INSERT INTO organizations
          (slug, short_name, name, facebook_url, logo_url, academic_year, sort_order, is_published)
         VALUES
          (:slug, :short_name, :name, :facebook_url, :logo_url, :academic_year, :sort_order, 1)'
    );

    foreach ($orgs as [$slug, $short, $name, $fb, $logo, $sort]) {
        $insertOrg->execute([
            'slug' => $slug,
            'short_name' => $short,
            'name' => $name,
            'facebook_url' => $fb,
            'logo_url' => $logo,
            'academic_year' => '2026–2027',
            'sort_order' => $sort,
        ]);
    }
    echo 'organizations seeded: ' . count($orgs) . "\n";
} else {
    echo "organizations already seeded ({$orgCount} rows)\n";
}

$faqCount = (int) $pdo->query('SELECT COUNT(*) FROM faq_items')->fetchColumn();
if ($faqCount === 0) {
    $fb = 'https://www.facebook.com/pupcl.sc';
    $email = 'studentcouncil@pupcolsc.com';
    $faqs = [
        [
            'contact',
            'How can I contact the Student Council?',
            'You may reach us through our <a href="' . $fb . '">official Facebook page</a> or email at <a href="mailto:' . $email . '">' . $email . '</a>.',
            10,
        ],
        [
            'follow-up',
            'How can I follow up on my request?',
            'Contact the Student Council through its <a href="/#contact">official channels</a> and provide your submission details.',
            20,
        ],
        [
            'academic-support',
            'How can I join academic support programs?',
            'Check the <a href="/announcements">announcements</a> and <a href="#calendar-title">events calendar</a> for upcoming workshops, masterclasses, and registration details.',
            30,
        ],
        [
            'printing',
            'How can I avail of the Free Printing Service?',
            'Check the <a href="/projects/free-printing">Free Printing Service</a> page for eligibility, guidelines, and operating hours.',
            40,
        ],
        [
            'locker',
            'How can I reserve a locker?',
            'Visit the <a href="/services/locker-reservations">Locker Reservations</a> page, check availability, and submit the reservation form.',
            50,
        ],
        [
            'market',
            'Where can I find merchandise and prices?',
            'Visit the <a href="/market">Market</a> section for available items, prices, and claiming instructions.',
            60,
        ],
        [
            'activities',
            'How can I participate in Council activities?',
            'Follow the <a href="/announcements">website announcements</a> and official social media pages for upcoming activities.',
            70,
        ],
        [
            'proposal',
            'How can an organization submit a proposal?',
            'Complete the Student Organization Proposal Form under <a href="/portal">Student Services &amp; Help Desk</a>.',
            80,
        ],
        [
            'privacy',
            'How is my personal information handled?',
            'Information submitted through website forms should be handled according to the applicable privacy policy and data protection requirements.',
            90,
        ],
        [
            'confidentiality',
            'Will my grievance remain confidential?',
            'Concerns will be handled discreetly and shared only with authorized persons as necessary. Absolute confidentiality cannot always be guaranteed.',
            100,
        ],
        [
            'website-issue',
            'How do I report a website issue?',
            'Contact the Student Council through its official email at <a href="mailto:' . $email . '">' . $email . '</a> or the <a href="/#contact">Feedback Form</a>.',
            110,
        ],
    ];

    $insertFaq = $pdo->prepare(
        'INSERT INTO faq_items (slug, question, answer_html, sort_order, is_published)
         VALUES (:slug, :question, :answer_html, :sort_order, 1)'
    );

    foreach ($faqs as [$slug, $question, $answer, $sort]) {
        $insertFaq->execute([
            'slug' => $slug,
            'question' => $question,
            'answer_html' => $answer,
            'sort_order' => $sort,
        ]);
    }
    echo 'faq_items seeded: ' . count($faqs) . "\n";
} else {
    echo "faq_items already seeded ({$faqCount} rows)\n";
}

$docCount = (int) $pdo->query('SELECT COUNT(*) FROM documents')->fetchColumn();
if ($docCount === 0) {
    $docs = [
        ['board_resolution', '001', 'Declaring Vacancies and Manner of Filling the Same', 'https://drive.google.com/file/d/1p1dQc5ck5CtFTHY07zKX5i46Mbv8V5nZ/view?usp=sharing', 'Board Resolution', 10],
        ['board_resolution', '002', 'Creation of Ad Hoc Committees and Providing for Manner of Filling the Same', 'https://drive.google.com/file/d/1HSqAIASpCO3oHxWp_msYhc4J34I9X7Ee/view?usp=sharing', 'Board Resolution', 20],
        ['board_resolution', '003', 'Creation of the SC Website, Ad Hoc Committee, and Matters Related Thereto', 'https://bit.ly/BoardResolution003s2026', 'Board Resolution', 30],
        ['board_resolution', '004', 'Policy Guidelines on Correspondence and Document Management', 'https://bit.ly/BoardResolution004s2026', 'Board Resolution', 40],
        ['board_resolution', '005', 'Policy Guidelines on the Conduct of Board Meetings and other Assemblies', 'https://bit.ly/BoardResolution005s2026', 'Board Resolution', 50],
        ['appointment_resolution', '001', 'PRESCRIBING THE PROCEDURE, QUALIFICATIONS, AND CALENDAR FOR THE APPOINTMENT OF ASSOCIATE OFFICERS AND OTHER APPOINTIVE POSITIONS FOR FIRST SEMESTER, ACADEMIC YEAR 2026-2027', 'https://drive.google.com/file/d/100RBzQvvdiWYRcVPfnWh0PfXHrjzUJf6/view?usp=sharing', 'Resolution', 60],
        ['appointment_resolution', '002', 'ADJUSTMENT OF CALENDAR', 'https://drive.google.com/file/d/1-YGowhE93PIYo2E8c6rZrnsYeV4egSG8/view?usp=sharing', 'Resolution', 70],
        ['appointment_resolution', '003', 'CONFIRMATION OF APPOINTMENTS', 'https://drive.google.com/file/d/1GBxqhnWrfu2dbo2CfjLo7E9-yXDM7X_a/view?usp=sharing', 'Resolution', 80],
        ['appointment_resolution', '004', 'SECOND CALL FOR APPLICATIONS', 'https://drive.google.com/file/d/1QpkZWwuFFgq48o84FUkSoF71hU6ZWLfA/view?usp=sharing', 'Resolution', 90],
    ];

    $insertDoc = $pdo->prepare(
        'INSERT INTO documents
          (category, doc_number, title, url, series_label, sort_order, is_published)
         VALUES
          (:category, :doc_number, :title, :url, :series_label, :sort_order, 1)'
    );

    foreach ($docs as [$category, $number, $title, $url, $series, $sort]) {
        $insertDoc->execute([
            'category' => $category,
            'doc_number' => $number,
            'title' => $title,
            'url' => $url,
            'series_label' => $series,
            'sort_order' => $sort,
        ]);
    }
    echo 'documents seeded: ' . count($docs) . "\n";
} else {
    echo "documents already seeded ({$docCount} rows)\n";
}

$settingsCount = (int) $pdo->query('SELECT COUNT(*) FROM site_settings')->fetchColumn();
if ($settingsCount === 0) {
    $contact = [
        'email' => 'studentcouncil@pupcolsc.com',
        'office' => 'PUP College of Law Student Council Office',
        'address' => 'PUP Main Campus, College of Law, Anonas St., Sta. Mesa, Manila 1016.',
        'secRegistration' => 'SEC Reg. No. 2022030045051-05',
        'hours' => 'Mon–Sat, 9:00 AM–6:00 PM',
        'socials' => [
            [
                'name' => 'Facebook',
                'handle' => '/pupcl.sc',
                'href' => 'https://www.facebook.com/pupcl.sc',
            ],
            ['name' => 'X', 'handle' => '@pupcolsc', 'href' => 'https://x.com/pupcolsc'],
            [
                'name' => 'Instagram',
                'handle' => '@pupcolsc_official',
                'href' => 'https://www.instagram.com/pupcolsc_official/',
            ],
        ],
        'footerSocials' => [
            [
                'name' => 'Instagram',
                'handle' => '@pupcolsc_official',
                'href' => 'https://www.instagram.com/pupcolsc_official/',
            ],
            [
                'name' => 'Facebook',
                'handle' => '/pupcl.sc',
                'href' => 'https://www.facebook.com/pupcl.sc',
            ],
            ['name' => 'X', 'handle' => '@pupcolsc', 'href' => 'https://x.com/pupcolsc'],
        ],
        'studentHandbookUrl' =>
            'https://drive.google.com/file/d/1neq3kippfsVWgFeWYepQWOx04X4TaUlE/view?usp=sharing',
    ];

    $pdo->prepare(
        'INSERT INTO site_settings (setting_key, payload_json)
         VALUES (:setting_key, :payload_json)'
    )->execute([
        'setting_key' => 'contact',
        'payload_json' => json_encode($contact, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
    echo "site_settings seeded: contact\n";
} else {
    echo "site_settings already seeded ({$settingsCount} rows)\n";
}

$shopCount = (int) $pdo->query('SELECT COUNT(*) FROM shop_items')->fetchColumn();
if ($shopCount === 0) {
    $insertShop = $pdo->prepare(
        'INSERT INTO shop_items
          (shop, item_key, name, price, unit, stock, image_url, alt_text, number_label, availability, sort_order, is_published)
         VALUES
          (:shop, :item_key, :name, :price, :unit, :stock, :image_url, :alt_text, :number_label, :availability, :sort_order, 1)'
    );

    $lockerCount = 0;
    foreach (['A', 'B', 'C', 'D', 'E'] as $rowIndex => $row) {
        $lockerPrice = $row === 'D' ? 450.00 : ($row === 'E' ? 350.00 : 600.00);
        for ($col = 1; $col <= 12; $col++) {
            $code = sprintf('%s-%02d', $row, $col);
            $insertShop->execute([
                'shop' => 'locker',
                'item_key' => strtolower($code),
                'name' => 'Locker ' . $code,
                'price' => $lockerPrice,
                'unit' => 'per rental period',
                'stock' => 1,
                'image_url' => '/uploads/shop/locker-bay.jpg',
                'alt_text' => 'Locker ' . $code,
                'number_label' => $code,
                'availability' => null,
                'sort_order' => ($rowIndex * 12) + $col,
            ]);
            $lockerCount++;
        }
    }
    echo "shop_items seeded: {$lockerCount} lockers\n";
} else {
    echo "shop_items already seeded ({$shopCount} rows)\n";
}

echo "public CMS migration 012 complete\n";
