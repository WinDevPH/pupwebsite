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
    ['2026–2027', 'officers', 'executive', 'President', 'Toribio, Russel Angelo O.', '/council/people/toribio.jpg', 0, 10],
    ['2026–2027', 'officers', 'executive', 'Vice President Internal', 'de Leon, Kristoffer Red S.', '/council/people/de-leon.jpg', 0, 20],
    ['2026–2027', 'officers', 'executive', 'Vice President External', 'Salazar, Marvin L.', '/council/people/salazar.jpg', 0, 30],
    ['2026–2027', 'officers', 'executive', 'Secretary-General', 'Velasco, Jesca O.', '/council/people/velasco.jpg', 0, 40],
    ['2026–2027', 'officers', 'executive', 'Finance Officer', 'Biato, Yvonne', '/council/people/biato.jpg', 0, 50],
    ['2026–2027', 'officers', 'executive', 'Auditor', 'Orante, Amaziah Perseus G.', '/council/people/orante.jpg', 0, 60],
    ['2026–2027', 'officers', 'executive', 'Communications Officer', 'Tercero, Shein', '/council/people/tercero.jpg', 0, 70],
    // Year reps
    ['2026–2027', 'officers', 'year_reps', 'Year 1', 'Roxas, Jayson', '/council/people/ramos.jpg', 0, 110],
    ['2026–2027', 'officers', 'year_reps', 'Year 2', 'Rana, John Ivan H.', '/council/people/rana.jpg', 0, 120],
    ['2026–2027', 'officers', 'year_reps', 'Year 3', 'Guadaña, Almira P.', '/council/people/guadana.jpg', 0, 130],
    ['2026–2027', 'officers', 'year_reps', 'Year 4', 'Vacant', null, 1, 140],
    // Associates
    ['2026–2027', 'officers', 'associates', 'Presidential Affairs', 'Jessica Mae T. Asuncion', null, 0, 210],
    ['2026–2027', 'officers', 'associates', 'Internal Affairs', 'Aldrich R. Sanchez', '/council/people/sanchez.jpg', 0, 220],
    ['2026–2027', 'officers', 'associates', 'Secretariat', 'Cherie An M. Sarabia', '/council/people/sarabia.jpg', 0, 230],
    ['2026–2027', 'officers', 'associates', 'External Affairs', 'Gleanna Marie B. Cuyugan', '/council/people/cuyugan.jpg', 0, 240],
    ['2026–2027', 'officers', 'associates', 'Social Media Management', 'Jenina Denisse R. Cabrera', null, 0, 250],
    // Commissioners
    ['2026–2027', 'commissioners', 'commission', 'Chairperson', 'Russel Angelo O. Toribio', '/council/people/toribio.jpg', 0, 10],
    ['2026–2027', 'commissioners', 'commission', 'Commissioner', 'Kristoffer Red S. De Leon', '/council/people/de-leon.jpg', 0, 20],
    ['2026–2027', 'commissioners', 'commission', 'Commissioner', 'Marvin L. Salazar', '/council/people/salazar.jpg', 0, 30],
    ['2026–2027', 'commissioners', 'commission', 'Commissioner and Clerk to the Commission', 'Jesca O. Velasco', '/council/people/velasco.jpg', 0, 40],
    ['2026–2027', 'commissioners', 'commission', 'Commissioner', 'Ma. Yvonne B. Biato', '/council/people/biato.jpg', 0, 50],
    ['2026–2027', 'commissioners', 'commission', 'Commissioner', 'Amaziah Perseus G. Orante', '/council/people/orante.jpg', 0, 60],
    ['2026–2027', 'commissioners', 'commission', 'Commissioner', 'Shein Tercero', '/council/people/tercero.jpg', 0, 70],
    ['2026–2027', 'commissioners', 'commission', 'Commissioner', 'Jayson G. Ramos', '/council/people/ramos.jpg', 0, 80],
    ['2026–2027', 'commissioners', 'commission', 'Commissioner', 'John Ivan H. Rana', '/council/people/rana.jpg', 0, 90],
    ['2026–2027', 'commissioners', 'commission', 'Commissioner', 'Almira P. Guadaña', '/council/people/guadana.jpg', 0, 100],
    // Advisory
    ['2026–2027', 'advisory', 'advisory', 'Dean, PUP College of Law', 'Atty. Gemy Lito L. Festin, LL.M.', '/council/people/festin.jpg', 0, 10],
    ['2026–2027', 'advisory', 'advisory', 'Lead Faculty Adviser', 'Atty. Czarina C. Santos-Mahilum', '/council/people/santos.jpg', 0, 20],
    ['2026–2027', 'advisory', 'advisory', 'Lead Faculty Adviser', 'Atty. Rex Norman E. Briones, LL.M.', '/council/people/briones.jpg', 0, 30],
    ['2026–2027', 'advisory', 'advisory', 'Lead Faculty Adviser', 'Atty. Leslie Faye P. Pago', '/council/people/pago.jpg', 0, 40],
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
