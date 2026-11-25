<?php
declare(strict_types=1);

// Ordinary authenticated fixture reader. No shell, request-memory manipulation,
// or vulnerability triggering is implemented by this PHP program.
$request = json_decode(stream_get_contents(STDIN, 4096), true, 8, JSON_THROW_ON_ERROR);
if (($request['action'] ?? '') !== 'customers' || array_keys($request) !== ['action']) {
    echo json_encode(['status' => 400, 'error' => 'この処理は通常の顧客データ読み取り専用です。'], JSON_UNESCAPED_UNICODE);
    exit;
}
echo json_encode([
    'status' => 200,
    'runtime' => 'PHP ' . PHP_VERSION,
    'output' => file_get_contents(__DIR__ . '/data/customers.csv'),
], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
