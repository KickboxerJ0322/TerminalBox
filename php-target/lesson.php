<?php
declare(strict_types=1);

// A real PHP runtime with a deliberately limited teaching dispatcher.
// Never pass request text to a shell, eval(), include(), or an executable path.
$request = json_decode(stream_get_contents(STDIN, 4096), true, 8, JSON_THROW_ON_ERROR);
$mode = $request['mode'] ?? '';
$topic = $request['topic'] ?? '';
if (!is_string($topic) || strlen($topic) > 200 || !in_array($mode, ['vulnerable', 'secure'], true)) {
    echo json_encode(['status' => 400, 'error' => '入力が不正です。']);
    exit;
}

$result = ['status' => 200, 'runtime' => 'PHP ' . PHP_VERSION, 'output' => '', 'identityObserved' => false, 'dataRead' => false, 'blocked' => false];
$commands = [
    'whoami' => ['/usr/bin/whoami'],
    'id' => ['/usr/bin/id'],
    'ls data' => ['/bin/ls', '-l', __DIR__ . '/data'],
    'cat data/customers.csv' => ['/bin/cat', __DIR__ . '/data/customers.csv'],
];

if ($mode === 'secure') {
    // The protected implementation accepts a business value, not a command.
    if ($topic !== 'summary') {
        $result['status'] = 400;
        $result['blocked'] = true;
        $result['output'] = '入力を拒否しました。topic は summary のみ指定できます。OSコマンドは実行していません。';
    } else {
        $result['output'] = '研修レポート：公開サマリー（個別の顧客情報は含みません）。';
    }
} elseif ($topic === 'summary') {
    $result['output'] = '研修レポート：公開サマリー。';
} else {
    // Reproduce the input-to-operation mistake without exposing a general shell.
    $prefix = 'summary; ';
    $command = str_starts_with($topic, $prefix) ? substr($topic, strlen($prefix)) : '';
    if (!isset($commands[$command])) {
        $result['status'] = 400;
        $result['output'] = '教材では summary、または summary; に続く whoami / id / ls data / cat data/customers.csv のみ確認できます。任意シェルは提供しません。';
    } else {
        $process = proc_open($commands[$command], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, __DIR__, ['PATH' => '/usr/bin:/bin', 'LANG' => 'C.UTF-8']);
        if (!is_resource($process)) {
            throw new RuntimeException('教材コマンドを起動できません。');
        }
        fclose($pipes[0]);
        $output = stream_get_contents($pipes[1], 8192);
        $error = stream_get_contents($pipes[2], 2048);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $code = proc_close($process);
        if ($code !== 0) {
            $result['status'] = 500;
            $result['output'] = '教材コマンドに失敗しました。';
        } else {
            $result['output'] = $output;
            $result['identityObserved'] = in_array($command, ['whoami', 'id'], true);
            $result['dataRead'] = $command === 'cat data/customers.csv';
        }
    }
}

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
