<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/api/includes/bootstrap.php';

$pdo = api_pdo();

$pdo->exec(
    "CREATE TABLE IF NOT EXISTS council_members (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      academic_year VARCHAR(32) NOT NULL,
      board ENUM('officers', 'commissioners', 'advisory') NOT NULL,
      section VARCHAR(64) NOT NULL,
      role_title VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      photo_url VARCHAR(500) NULL,
      is_vacant TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      is_published TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_council_members_board_year (board, academic_year, sort_order, id),
      KEY idx_council_members_published (is_published, board, academic_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
);

$count = (int) $pdo->query('SELECT COUNT(*) FROM council_members')->fetchColumn();
if ($count > 0) {
    echo "council_members already seeded ({$count} rows)\n";
    exit(0);
}

$seed = [
    // Officers · Executive
    ['2026–2027', 'officers', 'executive', 'President', 'Toribio, Russel Angelo O.', '/uploads/council/toribio.jpg', 0, 10],
    ['2026–2027', 'officers', 'executive', 'Vice President Internal', 'de Leon, Kristoffer Red S.', '/uploads/council/de-leon.jpg', 0, 20],
    ['2026–2027', 'officers', 'executive', 'Vice President External', 'Salazar, Marvin L.', '/uploads/council/salazar.jpg', 0, 30],
    ['2026–2027', 'officers', 'executive', 'Secretary-General', 'Velasco, Jesca O.', '/uploads/council/velasco.jpg', 0, 40],
    ['2026–2027', 'officers', 'executive', 'Finance Officer', 'Biato, Yvonne', '/uploads/council/biato.jpg', 0, 50],
    ['2026–2027', 'officers', 'executive', 'Auditor', 'Orante, Amaziah Perseus G.', '/uploads/council/orante.jpg', 0, 60],
    ['2026–2027', 'officers', 'executive', 'Communications Officer', 'Tercero, Shein', '/uploads/council/tercero.jpg', 0, 70],
    // Year reps
    ['2026–2027', 'officers', 'year_reps', 'Year 1', 'Roxas, Jayson', '/uploads/council/ramos.jpg', 0, 110],
    ['2026–2027', 'officers', 'year_reps', 'Year 2', 'Rana, John Ivan H.', '/uploads/council/rana.jpg', 0, 120],
    ['2026–2027', 'officers', 'year_reps', 'Year 3', 'Guadaña, Almira P.', '/uploads/council/guadana.jpg', 0, 130],
    ['2026–2027', 'officers', 'year_reps', 'Year 4', 'Vacant', null, 1, 140],
    // Associates
    ['2026–2027', 'officers', 'associates', 'Presidential Affairs', 'Jessica Mae T. Asuncion', null, 0, 210],
    ['2026–2027', 'officers', 'associates', 'Internal Affairs', 'Aldrich R. Sanchez', '/uploads/council/sanchez.jpg', 0, 220],
    ['2026–2027', 'officers', 'associates', 'Secretariat', 'Cherie An M. Sarabia', '/uploads/council/sarabia.jpg', 0, 230],
    ['2026–2027', 'officers', 'associates', 'Academic Affairs', 'Cassandra Kristine DL. Francisco', '/uploads/org-logos/student-council.png', 0, 235],
    ['2026–2027', 'officers', 'associates', 'External Affairs', 'Gleanna Marie B. Cuyugan', '/uploads/council/cuyugan.jpg', 0, 240],
    ['2026–2027', 'officers', 'associates', 'External Affairs', 'Anna Katrina C. Tena', '/uploads/org-logos/student-council.png', 0, 245],
    ['2026–2027', 'officers', 'associates', 'Social Media Management', 'Jenina Denisse R. Cabrera', null, 0, 250],
    ['2026–2027', 'officers', 'associates', 'Social Media Management', 'Irish B. Peneira', '/uploads/org-logos/student-council.png', 0, 255],
    // Commissioners
    ['2026–2027', 'commissioners', 'commission', 'Chairperson', 'Russel Angelo O. Toribio', '/uploads/council/toribio.jpg', 0, 10],
    ['2026–2027', 'commissioners', 'commission', 'Commissioner', 'Kristoffer Red S. De Leon', '/uploads/council/de-leon.jpg', 0, 20],
    ['2026–2027', 'commissioners', 'commission', 'Commissioner', 'Marvin L. Salazar', '/uploads/council/salazar.jpg', 0, 30],
    ['2026–2027', 'commissioners', 'commission', 'Commissioner and Clerk to the Commission', 'Jesca O. Velasco', '/uploads/council/velasco.jpg', 0, 40],
    ['2026–2027', 'commissioners', 'commission', 'Commissioner', 'Ma. Yvonne B. Biato', '/uploads/council/biato.jpg', 0, 50],
    ['2026–2027', 'commissioners', 'commission', 'Commissioner', 'Amaziah Perseus G. Orante', '/uploads/council/orante.jpg', 0, 60],
    ['2026–2027', 'commissioners', 'commission', 'Commissioner', 'Shein Tercero', '/uploads/council/tercero.jpg', 0, 70],
    ['2026–2027', 'commissioners', 'commission', 'Commissioner', 'Jayson G. Ramos', '/uploads/council/ramos.jpg', 0, 80],
    ['2026–2027', 'commissioners', 'commission', 'Commissioner', 'John Ivan H. Rana', '/uploads/council/rana.jpg', 0, 90],
    ['2026–2027', 'commissioners', 'commission', 'Commissioner', 'Almira P. Guadaña', '/uploads/council/guadana.jpg', 0, 100],
    // Advisory
    ['2026–2027', 'advisory', 'advisory', 'Dean, PUP College of Law', 'Atty. Gemy Lito L. Festin, LL.M.', '/uploads/council/festin.jpg', 0, 10],
    ['2026–2027', 'advisory', 'advisory', 'Lead Faculty Adviser', 'Atty. Czarina C. Santos-Mahilum', '/uploads/council/santos.jpg', 0, 20],
    ['2026–2027', 'advisory', 'advisory', 'Lead Faculty Adviser', 'Atty. Rex Norman E. Briones, LL.M.', '/uploads/council/briones.jpg', 0, 30],
    ['2026–2027', 'advisory', 'advisory', 'Lead Faculty Adviser', 'Atty. Leslie Faye P. Pago', '/uploads/council/pago.jpg', 0, 40],
    ['2026–2027', 'advisory', 'advisory', 'Lead Faculty Adviser', 'Atty. Kim Ranielle E. Abis', null, 0, 50],
];

$insert = $pdo->prepare(
    'INSERT INTO council_members
      (academic_year, board, section, role_title, full_name, photo_url, is_vacant, sort_order, is_published)
     VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, 1)'
);

foreach ($seed as $row) {
    $insert->execute($row);
}

$final = (int) $pdo->query('SELECT COUNT(*) FROM council_members')->fetchColumn();
echo "council_members seeded: {$final} rows\n";
