<?php
/**
 * NA'IYA IT SUPPORT TICKET PLATFORM
 * Live Email Subsystem & Backlog Dispatch Diagnostic Utility
 * 
 * Access via Web Browser: https://ticket.naiyatechnology.org/diagnose_email.php
 * Or via Command Line: php diagnose_email.php
 */

ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);
date_default_timezone_set('Africa/Lagos');

$isCli = (php_sapi_name() === 'cli');

// 1. Load Environment Variables from .env
function loadEnvFile() {
    $paths = [
        __DIR__ . '/.env',
        __DIR__ . '/../.env',
        dirname(__DIR__) . '/.env'
    ];
    $env = [];
    foreach ($paths as $p) {
        if (file_exists($p)) {
            $lines = file($p, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if (empty($line) || $line[0] === '#') continue;
                if (strpos($line, '=') !== false) {
                    list($k, $v) = explode('=', $line, 2);
                    $env[trim($k)] = trim($v, " \t\n\r\0\x0B\"'");
                }
            }
            break;
        }
    }
    return $env;
}

$env = loadEnvFile();

$smtpHost = $env['SMTP_HOST'] ?? 'mail.naiyatechnology.org';
$smtpPort = (int)($env['SMTP_PORT'] ?? 465);
$smtpUser = $env['SMTP_USER'] ?? 'noreply@naiyatechnology.org';
$smtpPass = $env['SMTP_PASSWORD'] ?? 'EF267G2Q4Y2ES5SP';
$smtpFrom = $env['SMTP_FROM_EMAIL'] ?? 'noreply@naiyatechnology.org';
$smtpFromName = $env['SMTP_FROM_NAME'] ?? "NA'IYA TICKETING BOT";

// Locate PHPMailer
$phpMailerPaths = [
    __DIR__ . '/PHPMailer/src/',
    __DIR__ . '/public/PHPMailer/src/',
    dirname(__DIR__) . '/public/PHPMailer/src/',
    __DIR__ . '/../PHPMailer/src/'
];
$phpMailerFound = false;
$mailerDir = null;
foreach ($phpMailerPaths as $p) {
    if (file_exists($p . 'PHPMailer.php') && file_exists($p . 'SMTP.php') && file_exists($p . 'Exception.php')) {
        require_once $p . 'Exception.php';
        require_once $p . 'PHPMailer.php';
        require_once $p . 'SMTP.php';
        $phpMailerFound = true;
        $mailerDir = $p;
        break;
    }
}

// Diagnostics Tests
$checks = [];

// Test 1: PHP OpenSSL Extension
$checks['openssl'] = [
    'name' => 'PHP OpenSSL Extension',
    'status' => extension_loaded('openssl'),
    'detail' => extension_loaded('openssl') ? 'Loaded (' . OPENSSL_VERSION_TEXT . ')' : 'Missing! Required for Port 465 / 587 SSL encryption.'
];

// Test 2: DNS Resolution
$resolvedIp = @gethostbyname($smtpHost);
$dnsPass = ($resolvedIp && $resolvedIp !== $smtpHost);
$checks['dns'] = [
    'name' => 'SMTP Host DNS Resolution',
    'status' => $dnsPass,
    'detail' => $dnsPass ? "Resolved {$smtpHost} to IP: {$resolvedIp}" : "Failed to resolve hostname {$smtpHost}"
];

// Test 3: Port 465 SSL Socket Connection
$t0 = microtime(true);
$fp465 = @fsockopen("ssl://{$smtpHost}", 465, $errno, $errstr, 5);
$lat465 = round((microtime(true) - $t0) * 1000, 1);
if ($fp465) {
    $banner465 = trim(fgets($fp465, 512));
    fclose($fp465);
    $checks['port465'] = [
        'name' => 'Port 465 (SMTPS / SSL) Direct Socket',
        'status' => true,
        'detail' => "Connected in {$lat465}ms. Greeting: " . htmlspecialchars($banner465)
    ];
} else {
    $checks['port465'] = [
        'name' => 'Port 465 (SMTPS / SSL) Direct Socket',
        'status' => false,
        'detail' => "Failed to connect to {$smtpHost}:465 ({$errno}: {$errstr})"
    ];
}

// Test 4: Port 587 STARTTLS Socket Connection
$t0 = microtime(true);
$fp587 = @fsockopen($smtpHost, 587, $errno, $errstr, 4);
$lat587 = round((microtime(true) - $t0) * 1000, 1);
if ($fp587) {
    $banner587 = trim(fgets($fp587, 512));
    fclose($fp587);
    $checks['port587'] = [
        'name' => 'Port 587 (STARTTLS) Direct Socket',
        'status' => true,
        'detail' => "Connected in {$lat587}ms. Greeting: " . htmlspecialchars($banner587)
    ];
} else {
    $checks['port587'] = [
        'name' => 'Port 587 (STARTTLS) Direct Socket',
        'status' => false,
        'detail' => "Failed to connect to {$smtpHost}:587 ({$errno}: {$errstr})"
    ];
}

// Test 5: PHPMailer Class Availability
$checks['phpmailer'] = [
    'name' => 'PHPMailer Class Library',
    'status' => $phpMailerFound,
    'detail' => $phpMailerFound ? "Loaded successfully from {$mailerDir}" : 'PHPMailer library not found in searched directories.'
];

// Test 6: SMTP Authentication Test
$authDebugLog = [];
$authPass = false;
$authError = '';

if ($phpMailerFound) {
    try {
        $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
        $mail->SMTPDebug = 2;
        $mail->Debugoutput = function($str, $level) use (&$authDebugLog) {
            $authDebugLog[] = trim($str);
        };
        $mail->isSMTP();
        $mail->Host       = $smtpHost;
        $mail->SMTPAuth   = true;
        $mail->Username   = $smtpUser;
        $mail->Password   = $smtpPass;
        $mail->SMTPSecure = ($smtpPort === 465) ? \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS : \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = $smtpPort;
        $mail->Timeout    = 8;
        $mail->SMTPOptions = [
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            ]
        ];

        // Perform connection & authentication test without sending body
        if ($mail->smtpConnect()) {
            $authPass = true;
            $mail->smtpClose();
        } else {
            $authError = 'smtpConnect() returned false';
        }
    } catch (\Exception $e) {
        $authError = $e->getMessage();
    }
} else {
    $authError = 'PHPMailer not installed; unable to perform deep authentication handshake.';
}

$checks['auth'] = [
    'name' => "SMTP Authentication ({$smtpUser})",
    'status' => $authPass,
    'detail' => $authPass ? "Credentials authenticated successfully on {$smtpHost}:{$smtpPort}" : "Auth Failed: " . htmlspecialchars($authError)
];

// Handle AJAX or POST Test Send
$sendResult = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'send_test_email') {
    $testTo = trim($_POST['test_to'] ?? '');
    if (!filter_var($testTo, FILTER_VALIDATE_EMAIL)) {
        $sendResult = ['success' => false, 'error' => 'Please provide a valid recipient email address.'];
    } elseif (!$phpMailerFound) {
        $sendResult = ['success' => false, 'error' => 'PHPMailer library missing.'];
    } else {
        try {
            $testMail = new \PHPMailer\PHPMailer\PHPMailer(true);
            $testMail->isSMTP();
            $testMail->Host       = $smtpHost;
            $testMail->SMTPAuth   = true;
            $testMail->Username   = $smtpUser;
            $testMail->Password   = $smtpPass;
            $testMail->SMTPSecure = ($smtpPort === 465) ? \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS : \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
            $testMail->Port       = $smtpPort;
            $testMail->Timeout    = 10;
            $testMail->SMTPOptions = [
                'ssl' => [
                    'verify_peer' => false,
                    'verify_peer_name' => false,
                    'allow_self_signed' => true
                ]
            ];

            $testMail->setFrom($smtpFrom, $smtpFromName);
            $testMail->addAddress($testTo);
            $testMail->isHTML(true);
            $testMail->Subject = "[TEST OK] NA'IYA Support Mail Diagnostic - " . date('H:i:s');
            
            $currentTime = date('Y-m-d H:i:s T');
            $testMail->Body = "
                <div style='font-family: Arial, sans-serif; background: #0f172a; color: #fff; padding: 24px; border-radius: 12px; max-width: 600px;'>
                    <h2 style='color: #10b981; margin-top: 0;'>&#10004; NA'IYA Diagnostic Test Passed</h2>
                    <p style='color: #cbd5e1; font-size: 14px;'>This test verifies that the mail system is active and able to deliver technical ticket notices and backlog notifications.</p>
                    <div style='background: #1e293b; padding: 14px; border-radius: 8px; font-family: monospace; font-size: 13px; color: #94a3b8;'>
                        <strong>Sender:</strong> {$smtpFrom}<br>
                        <strong>Host:</strong> {$smtpHost}:{$smtpPort}<br>
                        <strong>Recipient:</strong> {$testTo}<br>
                        <strong>Timestamp:</strong> {$currentTime}
                    </div>
                </div>
            ";
            $testMail->AltBody = "NA'IYA Diagnostic Test Passed. Delivered at {$currentTime}";

            $testMail->send();
            $sendResult = ['success' => true, 'message' => "Diagnostic test email delivered to {$testTo} successfully!"];
        } catch (\Exception $e) {
            $sendResult = ['success' => false, 'error' => "Delivery failed: " . $e->getMessage()];
        }
    }

    if (isset($_POST['ajax'])) {
        header('Content-Type: application/json');
        echo json_encode($sendResult);
        exit;
    }
}

// Read recent dispatch log if available
$dispatchLogFile = __DIR__ . '/backups/email_dispatch_log.json';
if (!file_exists($dispatchLogFile)) {
    $dispatchLogFile = __DIR__ . '/logs/email_dispatch_log.json';
}
$dispatchStats = ['total' => 0, 'sent' => 0, 'failed' => 0, 'recent' => []];
if (file_exists($dispatchLogFile)) {
    $rawLog = @file_get_contents($dispatchLogFile);
    $parsedLog = json_decode($rawLog, true);
    if (is_array($parsedLog)) {
        $dispatchStats['total'] = count($parsedLog);
        foreach ($parsedLog as $entry) {
            if (($entry['status'] ?? '') === 'SENT') $dispatchStats['sent']++;
            if (($entry['status'] ?? '') === 'FAILED') $dispatchStats['failed']++;
        }
        $dispatchStats['recent'] = array_slice(array_reverse($parsedLog), 0, 8);
    }
}

// Output CLI mode if called via command line
if ($isCli) {
    echo "===========================================================================\n";
    echo "   NA'IYA SUPPORT TICKET SYSTEM - PHP SMTP SUBSYSTEM DIAGNOSTIC   \n";
    echo "===========================================================================\n";
    echo "Timestamp: " . date('Y-m-d H:i:s') . "\n";
    echo "Sender:    {$smtpUser}\n";
    echo "Host:      {$smtpHost}:{$smtpPort}\n";
    echo "---------------------------------------------------------------------------\n";
    foreach ($checks as $k => $c) {
        $statusStr = $c['status'] ? "[PASS]" : "[FAIL]";
        echo sprintf(" %-7s %-36s : %s\n", $statusStr, $c['name'], $c['detail']);
    }
    echo "---------------------------------------------------------------------------\n";
    if ($authPass) {
        echo ">>> SUMMARY: Email subsystem is OPERATIONAL and ready for backlog delivery.\n";
    } else {
        echo ">>> SUMMARY: Email delivery BLOCKED due to: {$authError}\n";
    }
    echo "===========================================================================\n";
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NA'IYA IT Ticket Mailer Diagnostic Suite</title>
    <style>
        :root {
            --bg: #090d16;
            --surface: #111827;
            --surface-hover: #1f2937;
            --border: #1e293b;
            --emerald: #10b981;
            --emerald-bg: rgba(16, 185, 129, 0.12);
            --red: #ef4444;
            --red-bg: rgba(239, 68, 68, 0.12);
            --amber: #f59e0b;
            --blue: #3b82f6;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background: var(--bg);
            color: var(--text-main);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            padding: 30px 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
        }
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 24px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--border);
        }
        .title h1 {
            font-size: 20px;
            font-weight: 700;
            color: #fff;
            letter-spacing: -0.5px;
        }
        .title p {
            font-size: 13px;
            color: var(--text-muted);
            margin-top: 4px;
        }
        .badge-live {
            background: <?= $authPass ? 'var(--emerald-bg)' : 'var(--red-bg)' ?>;
            color: <?= $authPass ? 'var(--emerald)' : 'var(--red)' ?>;
            border: 1px solid <?= $authPass ? 'var(--emerald)' : 'var(--red)' ?>;
            padding: 6px 14px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }
        .card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 18px;
        }
        .card-label {
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 700;
            color: var(--text-muted);
            letter-spacing: 0.5px;
            margin-bottom: 6px;
        }
        .card-val {
            font-size: 14px;
            font-weight: 600;
            color: #fff;
            word-break: break-all;
        }
        .table-wrap {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 24px;
        }
        .table-title {
            padding: 16px 20px;
            border-bottom: 1px solid var(--border);
            font-size: 14px;
            font-weight: 700;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        th {
            text-align: left;
            padding: 12px 20px;
            background: rgba(255, 255, 255, 0.02);
            color: var(--text-muted);
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            border-bottom: 1px solid var(--border);
        }
        td {
            padding: 14px 20px;
            border-bottom: 1px solid var(--border);
            color: #cbd5e1;
        }
        tr:last-child td { border-bottom: none; }
        .tag-pass {
            background: var(--emerald-bg);
            color: var(--emerald);
            padding: 4px 10px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 11px;
            display: inline-block;
        }
        .tag-fail {
            background: var(--red-bg);
            color: var(--red);
            padding: 4px 10px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 11px;
            display: inline-block;
        }
        .btn {
            background: var(--emerald);
            color: #0f172a;
            border: none;
            padding: 10px 18px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .input {
            background: #0f172a;
            border: 1px solid var(--border);
            color: #fff;
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 13px;
            width: 100%;
            max-width: 300px;
            outline: none;
        }
        .input:focus { border-color: var(--blue); }
        .log-box {
            background: #0b0f19;
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 14px;
            font-family: monospace;
            font-size: 11px;
            max-height: 200px;
            overflow-y: auto;
            color: #94a3b8;
            line-height: 1.5;
        }
        .alert {
            padding: 14px 18px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 20px;
        }
        .alert-success { background: var(--emerald-bg); color: var(--emerald); border: 1px solid var(--emerald); }
        .alert-error { background: var(--red-bg); color: var(--red); border: 1px solid var(--red); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">
                <h1>NA'IYA IT Support &mdash; Email Health Diagnostic</h1>
                <p>Real-time audit of SMTP sockets, credentials, TLS certificates, and backlog queue</p>
            </div>
            <div class="badge-live">
                <span><?= $authPass ? '&#9679; SMTP ONLINE' : '&#9679; ACTION REQUIRED' ?></span>
            </div>
        </div>

        <?php if ($sendResult): ?>
            <div class="alert <?= $sendResult['success'] ? 'alert-success' : 'alert-error' ?>">
                <?= htmlspecialchars($sendResult['message'] ?? $sendResult['error']) ?>
            </div>
        <?php endif; ?>

        <!-- Active SMTP Configurations -->
        <div class="grid">
            <div class="card">
                <div class="card-label">Configured Sender Account</div>
                <div class="card-val" style="color: #60a5fa;"><?= htmlspecialchars($smtpUser) ?></div>
            </div>
            <div class="card">
                <div class="card-label">SMTP Host & Port</div>
                <div class="card-val"><?= htmlspecialchars($smtpHost) ?>:<?= htmlspecialchars($smtpPort) ?> (SSL)</div>
            </div>
            <div class="card">
                <div class="card-label">Authentication Status</div>
                <div class="card-val" style="color: <?= $authPass ? 'var(--emerald)' : 'var(--red)' ?>;">
                    <?= $authPass ? '&#10004; Verified & Active' : '&#10006; Rejected (Check Auth)' ?>
                </div>
            </div>
        </div>

        <!-- 6 Diagnostic Verification Checks Table -->
        <div class="table-wrap">
            <div class="table-title">
                <span>Core Subsystem Checks</span>
                <span style="font-size: 12px; font-weight: 400; color: var(--text-muted);"><?= date('H:i:s') ?> Lagos Time</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 100px;">Status</th>
                        <th style="width: 250px;">Component</th>
                        <th>Diagnostic Details & Latency</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($checks as $k => $c): ?>
                    <tr>
                        <td>
                            <span class="<?= $c['status'] ? 'tag-pass' : 'tag-fail' ?>">
                                <?= $c['status'] ? 'PASSED' : 'FAILED' ?>
                            </span>
                        </td>
                        <td style="font-weight: 600; color: #fff;"><?= htmlspecialchars($c['name']) ?></td>
                        <td><?= htmlspecialchars($c['detail']) ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>

        <!-- Interactive Test Email Form -->
        <div class="card" style="margin-bottom: 24px;">
            <div class="card-label" style="font-size: 12px; margin-bottom: 10px;">Send Live Verification Email</div>
            <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 14px;">
                Dispatch an end-to-end test email to verify mailbox routing and mailbox provider acceptance (Gmail, Yahoo, Outlook, custom).
            </p>
            <form method="POST" style="display: flex; gap: 10px; flex-wrap: wrap;">
                <input type="hidden" name="action" value="send_test_email">
                <input type="email" name="test_to" class="input" placeholder="recipient@example.com" value="<?= htmlspecialchars($smtpUser) ?>" required>
                <button type="submit" class="btn">Send Test Email Now</button>
                <a href="clear_device_tickets.php" style="display: inline-flex; align-items: center; padding: 10px 16px; color: #94a3b8; text-decoration: none; font-size: 13px; font-weight: 600;">
                    &larr; Back to Ticket Sweeper
                </a>
            </form>
        </div>

        <!-- Debug Protocol Logs -->
        <?php if (!empty($authDebugLog)): ?>
        <div class="table-wrap">
            <div class="table-title">SMTP Protocol Handshake Log</div>
            <div style="padding: 14px;">
                <div class="log-box">
                    <?php foreach ($authDebugLog as $line): ?>
                        <div><?= htmlspecialchars($line) ?></div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
        <?php endif; ?>

        <!-- Backlog Queue Activity Summary -->
        <?php if ($dispatchStats['total'] > 0): ?>
        <div class="table-wrap">
            <div class="table-title">
                <span>Recent Backlog Dispatch Activity (Ledger)</span>
                <span style="font-size: 12px; color: var(--text-muted);">
                    Sent: <strong style="color: var(--emerald);"><?= $dispatchStats['sent'] ?></strong> | 
                    Failed: <strong style="color: var(--red);"><?= $dispatchStats['failed'] ?></strong> of <?= $dispatchStats['total'] ?>
                </span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Ticket #</th>
                        <th>Recipient</th>
                        <th>Time</th>
                        <th>Error / Note</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($dispatchStats['recent'] as $log): ?>
                    <tr>
                        <td>
                            <span class="<?= ($log['status'] === 'SENT') ? 'tag-pass' : 'tag-fail' ?>">
                                <?= htmlspecialchars($log['status'] ?? 'UNKNOWN') ?>
                            </span>
                        </td>
                        <td style="font-family: monospace; font-weight: 700;">#<?= htmlspecialchars($log['ticket_number'] ?? '') ?></td>
                        <td><?= htmlspecialchars($log['recipient'] ?? '') ?></td>
                        <td style="font-size: 11px; color: var(--text-muted);"><?= htmlspecialchars($log['timestamp'] ?? '') ?></td>
                        <td style="font-size: 11px; color: #f87171;"><?= htmlspecialchars($log['error'] ?? 'OK') ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php endif; ?>
    </div>
</body>
</html>
