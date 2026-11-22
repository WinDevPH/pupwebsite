<?php
require __DIR__ . '/api/includes/bootstrap.php';
$pdo = api_pdo();
$pub = (int) $pdo->query('SELECT COUNT(*) FROM announcements WHERE is_published = 1')->fetchColumn();
$all = (int) $pdo->query('SELECT COUNT(*) FROM announcements')->fetchColumn();
echo "published={$pub}\nall={$all}\n";
$rows = $pdo->query('SELECT id, slug, title, is_published FROM announcements ORDER BY published_at DESC, id DESC')->fetchAll(PDO::FETCH_ASSOC);
foreach ($rows as $r) {
    echo $r['id'] . ' | pub=' . $r['is_published'] . ' | ' . $r['slug'] . ' | ' . $r['title'] . "\n";
}
