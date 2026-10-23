<?php
// System Routes

switch ($action) {
        case 'upload_image':
            $data = jsonInput();
            if (isset($data['image'])) {
                $url = saveBase64Image($data['image']);
                echo json_encode(['status' => 'success', 'url' => $url]);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'No image provided']);
            }
            break;

        case 'send_email':
            $data = jsonInput();
            $to = $data['to'] ?? '';
            $subject = $data['subject'] ?? '';
            $message = $data['message'] ?? '';
            // For the applet preview, mock email success
            echo json_encode(['status' => 'success', 'message' => 'Email sent.']);
            break;

        // --- AUTHENTICATION ---
        case 'upgrade':
            try {
                $pdo->exec("CREATE INDEX idx_tickets_updated_at ON tickets(updated_at DESC)");
            } catch (Exception $e) {}
            try {
                $pdo->exec("CREATE INDEX idx_tickets_status ON tickets(status)");
            } catch (Exception $e) {}
            try {
                $pdo->exec("CREATE INDEX idx_tickets_assigned ON tickets(assigned_to_email)");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE tickets ADD COLUMN searchable_text LONGTEXT");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE tickets ADD COLUMN last_message_preview TEXT");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE tickets ADD COLUMN last_message_role VARCHAR(50)");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE tickets ADD COLUMN team_lead_email VARCHAR(255)");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE users ADD COLUMN specialized_categories JSON");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE users CHANGE password_hash password VARCHAR(255)");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE users ADD COLUMN password VARCHAR(255)");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE users ADD COLUMN managed_team_id VARCHAR(50)");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE users ADD COLUMN team_lead_id VARCHAR(50)");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE users ADD COLUMN is_root TINYINT(1) DEFAULT 0");
            } catch (Exception $e) {}
            try {
                $pdo->exec("UPDATE users SET is_root = 1 WHERE email = 'itstaff'");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE tickets ADD COLUMN project VARCHAR(255) DEFAULT 'Dont Know'");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE settings DROP PRIMARY KEY");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE settings CHANGE id id VARCHAR(50) PRIMARY KEY");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE settings ADD COLUMN value LONGTEXT");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE feedback CHANGE user_email email VARCHAR(191)");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE feedback CHANGE user_name name VARCHAR(255)");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE feedback CHANGE message content TEXT");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE feedback CHANGE image_url proof_image LONGTEXT");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE users ADD COLUMN alt_email VARCHAR(255)");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
            } catch (Exception $e) {}
            
            // Create feedback table if it doesn't exist
            try {
                $pdo->exec("CREATE TABLE IF NOT EXISTS feedback (
                    id VARCHAR(50) PRIMARY KEY,
                    type VARCHAR(50),
                    email VARCHAR(191),
                    name VARCHAR(255),
                    content TEXT,
                    proof_image LONGTEXT,
                    is_resolved BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )");
            } catch (Exception $e) {}

            // Create otps table
            try {
                $pdo->exec("CREATE TABLE IF NOT EXISTS otps (
                    email VARCHAR(191) PRIMARY KEY,
                    otp VARCHAR(10),
                    expires_at TIMESTAMP
                )");
            } catch (Exception $e) {}

            // Migrate agents from settings to users table
            try {
                $stmt = $pdo->prepare("SELECT value FROM settings WHERE id = 'agents'");
                $stmt->execute();
                $row = $stmt->fetch();
                if ($row) {
                    $json = json_decode($row['value'], true);
                    $agents = (isset($json['agents']) && is_array($json['agents'])) ? array_values($json['agents']) : (is_array($json) ? array_values($json) : []);
                    $insertStmt = $pdo->prepare("INSERT IGNORE INTO users (email, name, role, team_lead_id) VALUES (?, ?, 'agent', ?)");
                    foreach ($agents as $agent) {
                        $email = strtolower($agent['email'] ?? '');
                        if ($email) {
                            $name = explode('@', $email)[0];
                            $teamLeadId = $agent['teamLeadId'] ?? null;
                            $insertStmt->execute([$email, $name, $teamLeadId]);
                        }
                    }
                }
            } catch (Exception $e) {}

            $stmt = $pdo->query("SELECT id, description, messages FROM tickets");
            $tickets = $stmt->fetchAll();

            $updateStmt = $pdo->prepare("UPDATE tickets SET searchable_text = ?, last_message_preview = ?, last_message_role = ? WHERE id = ?");

            foreach ($tickets as $t) {
                $msgs = json_decode($t['messages'] ?? '[]', true);
                $lastMsg = !empty($msgs) ? end($msgs) : null;
                
                $lastMessagePreview = $lastMsg ? substr($lastMsg['content'], 0, 100) : substr($t['description'] ?? '', 0, 100);
                $lastMessageRole = $lastMsg ? $lastMsg['role'] : null;

                $searchableText = '';
                if (is_array($msgs)) {
                    foreach ($msgs as $msg) {
                        if (isset($msg['content'])) {
                            $searchableText .= ' ' . $msg['content'];
                        }
                        if (isset($msg['senderName'])) {
                            $searchableText .= ' ' . $msg['senderName'];
                        }
                        if (isset($msg['senderEmail'])) {
                            $searchableText .= ' ' . $msg['senderEmail'];
                        }
                    }
                }

                $updateStmt->execute([$searchableText, $lastMessagePreview, $lastMessageRole, $t['id']]);
            }
            echo json_encode(['status' => 'success']);
            break;

        case 'get_analytics_snapshot':
            // FIX: Replaced SELECT * with specific columns to avoid memory exhaustion from attachments
            $stmt = $pdo->query("SELECT id, ticket_number, title, category, description, status, priority, 
                created_by_email, created_by_name, assigned_to_email, team_lead_id, team_lead_email,
                is_escalated, is_pinned, is_read_by_staff, is_locked, locked_by, 
                project, created_at, updated_at, last_agent_reply_at, read_by, messages 
                FROM tickets ORDER BY updated_at DESC");
            
            $tickets = [];
            while ($t = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $t['isEscalated'] = (bool)$t['is_escalated'];
                
                // Parse messages to extract only role and senderId to save memory
                $messages = json_decode($t['messages'] ?? '[]', true);
                $lightMessages = [];
                if (is_array($messages)) {
                    foreach ($messages as $msg) {
                        $lightMessages[] = [
                            'role' => $msg['role'] ?? '',
                            'senderId' => $msg['senderId'] ?? '',
                            'senderName' => $msg['senderName'] ?? '',
                            'timestamp' => $msg['timestamp'] ?? ''
                        ];
                    }
                }
                $t['messages'] = $lightMessages;
                
                $t['ticketNumber'] = $t['ticket_number'];
                $t['assignedToEmail'] = $t['assigned_to_email'];
                $t['teamLeadId'] = $t['team_lead_id'];
                $t['teamLeadEmail'] = $t['team_lead_email'];
                $t['createdAt'] = $t['created_at'] ? str_replace(' ', 'T', $t['created_at']) . '+01:00' : null;
                $t['updatedAt'] = $t['updated_at'] ? str_replace(' ', 'T', $t['updated_at']) . '+01:00' : null;
                
                $tickets[] = $t;
            }
            echo json_encode(['status' => 'success', 'data' => $tickets]);
            break;

        case 'get_settings':
            $stmt = $pdo->prepare("SELECT value FROM settings WHERE id = ?");
            $stmt->execute(['general']);
            $res = $stmt->fetchColumn();
            echo json_encode($res ? json_decode($res, true) : ['categories' => []]);
            break;

        case 'update_settings':
            $auth = require_auth();
            if ($auth['role'] !== 'staff' && $auth['role'] !== 'team_lead') { http_response_code(403); exit; }
            $data = jsonInput();
            $stmt = $pdo->prepare("REPLACE INTO settings (id, value) VALUES ('general', ?)");
            $stmt->execute([json_encode($data)]);
            echo json_encode(['status' => 'success']);
            break;

        case 'track_action':
            $data = jsonInput();
            $actionName = $data['actionName'] ?? '';
            if ($actionName) {
                $today = date('Y-m-d');
                $stmt = $pdo->query("SELECT value FROM settings WHERE id = 'action_stats'");
                $val = $stmt->fetchColumn();
                $stats = $val ? json_decode($val, true) : [];
                if (!is_array($stats)) $stats = [];
                $stats[$actionName] = ($stats[$actionName] ?? 0) + 1;
                
                if (!isset($stats['daily']) || !is_array($stats['daily'])) {
                    $stats['daily'] = [];
                }
                if (!isset($stats['daily'][$today]) || !is_array($stats['daily'][$today])) {
                    $stats['daily'][$today] = ['vpn_resolves' => 0, 'webmail_resolves' => 0, 'triage_resolves' => 0];
                }
                $stats['daily'][$today][$actionName] = ($stats['daily'][$today][$actionName] ?? 0) + 1;

                $stmt2 = $pdo->prepare("REPLACE INTO settings (id, value) VALUES ('action_stats', ?)");
                $stmt2->execute([json_encode($stats)]);
            }
            echo json_encode(['status' => 'success']);
            break;

        case 'get_stats':
            $stmt = $pdo->query("SELECT value FROM settings WHERE id = 'action_stats'");
            $val = $stmt->fetchColumn();
            echo json_encode(['status' => 'success', 'data' => $val ? json_decode($val, true) : []]);
            break;
        case 'check_vpn_status':
            $email = $_GET['email'] ?? '';
            if (empty($email)) {
                echo json_encode(['status' => 'error', 'message' => 'Email missing']);
                break;
            }
            
            global $VPN_HUB_TOKEN;
            if (empty($VPN_HUB_TOKEN)) {
                $VPN_HUB_TOKEN = getenv('VPN_HUB_TOKEN') ?: 'GCTj-kfp8-G@Ph';
            }
            $rawEmail = strtolower(trim($email));
            $safeEmailParam = urlencode($rawEmail);
            $apiUrl = "https://vpn.naiyatechnology.org/api/vpn/status?email={$safeEmailParam}";
            
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $apiUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
            curl_setopt($ch, CURLOPT_TIMEOUT, 8);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                "Authorization: Bearer {$VPN_HUB_TOKEN}"
            ]);
            
            $result = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            if ($result === false) {
                error_log("cURL Error in check_vpn_status: " . curl_error($ch));
            }
            curl_close($ch);
            
            if ($httpCode === 404) {
                http_response_code(404);
                echo $result ? $result : json_encode(['status' => 'error', 'message' => 'VPN not found']);
                break;
            }
            
            if ($httpCode >= 200 && $httpCode < 300) {
                echo $result;
            } else {
                http_response_code($httpCode ?: 502);
                echo $result ?: json_encode(['status' => 'error', 'message' => 'VPN Hub connection failed']);
            }
            break;

        case 'vpn_admin_get_user':
            $email = $_GET['email'] ?? '';
            if (empty($email)) {
                echo json_encode(['status' => 'error', 'message' => 'Email missing']);
                break;
            }
            global $VPN_HUB_TOKEN;
            if (empty($VPN_HUB_TOKEN)) {
                $VPN_HUB_TOKEN = getenv('VPN_HUB_TOKEN') ?: 'GCTj-kfp8-G@Ph';
            }
            $rawEmail = strtolower(trim($email));
            $safeEmailParam = urlencode($rawEmail);
            $apiUrl = "https://vpn.naiyatechnology.org/api/vpn/admin/user-details?email={$safeEmailParam}";

            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $apiUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
            curl_setopt($ch, CURLOPT_TIMEOUT, 8);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                "Authorization: Bearer {$VPN_HUB_TOKEN}"
            ]);
            $result = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            if ($result === false) {
                error_log("cURL Error in vpn_admin_get_user: " . curl_error($ch));
            }
            curl_close($ch);

            http_response_code($httpCode >= 200 && $httpCode < 300 ? 200 : ($httpCode ?: 502));
            echo $result ?: json_encode(['status' => 'error', 'message' => 'VPN Hub connection failed']);
            break;

        case 'vpn_admin_swap':
        case 'vpn_admin_assign':
        case 'vpn_admin_revoke':
            global $VPN_HUB_TOKEN;
            if (empty($VPN_HUB_TOKEN)) {
                $VPN_HUB_TOKEN = getenv('VPN_HUB_TOKEN') ?: 'GCTj-kfp8-G@Ph';
            }
            $rawInput = file_get_contents('php://input');
            if ($action === 'vpn_admin_swap') {
                $swapData = json_decode($rawInput, true);
                $reason = $swapData['reason'] ?? '';
                if (stripos($reason, 'AI Triage') !== false || stripos($reason, 'auto-swap') !== false) {
                    http_response_code(403);
                    echo json_encode([
                        'status' => 'error',
                        'message' => 'AI auto-swapping is permanently disabled. Only human staff can swap VPN credentials.'
                    ]);
                    break;
                }
            }
            $subPath = ($action === 'vpn_admin_swap') ? 'swap' : (($action === 'vpn_admin_assign') ? 'assign' : 'revoke');
            $apiUrl = "https://vpn.naiyatechnology.org/api/vpn/admin/{$subPath}";

            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $apiUrl);
            curl_setopt($ch, CURLOPT_POST, 1);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $rawInput);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                "Content-Type: application/json",
                "Authorization: Bearer {$VPN_HUB_TOKEN}"
            ]);
            $result = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            if ($result === false) {
                error_log("cURL Error in {$action}: " . curl_error($ch));
            }
            curl_close($ch);

            http_response_code($httpCode >= 200 && $httpCode < 300 ? 200 : ($httpCode ?: 502));
            echo $result ?: json_encode(['status' => 'error', 'message' => 'VPN Hub operation failed']);
            break;

        case 'get_cpanel_domain_configs':
            $domains = ['naiyatechnology.org', 'naiyatech.com.ng', 'samuikyglobal.com.ng'];
            $result = [];
            foreach ($domains as $d) {
                $creds = resolveCpanelCredentialsForDomain($d, $pdo);
                $result[$d] = [
                    'host' => $creds['host'] ?? "https://{$d}:2083",
                    'user' => $creds['user'] ?? '',
                    'has_token' => !empty($creds['token']),
                    'source' => $creds['source'] ?? 'unconfigured'
                ];
            }
            echo json_encode(['status' => 'success', 'domains' => $result]);
            break;

        case 'update_cpanel_domain_configs':
            $input = jsonInput();
            $targetDomain = strtolower(trim($input['domain'] ?? ''));
            $user = trim($input['user'] ?? '');
            $token = trim($input['token'] ?? '');
            $host = trim($input['host'] ?? '');

            $validDomains = ['naiyatechnology.org', 'naiyatech.com.ng', 'samuikyglobal.com.ng'];
            if (!in_array($targetDomain, $validDomains)) {
                echo json_encode(['status' => 'error', 'message' => "Invalid domain '{$targetDomain}'. Allowed domains: " . implode(', ', $validDomains)]);
                break;
            }

            $existing = [];
            try {
                $stmt = $pdo->prepare("SELECT value FROM settings WHERE id = 'cpanel_domain_configs'");
                $stmt->execute();
                $val = $stmt->fetchColumn();
                if ($val) $existing = json_decode($val, true) ?: [];
            } catch (Exception $e) {}

            if (!isset($existing[$targetDomain])) {
                $existing[$targetDomain] = [];
            }
            if ($user !== '') $existing[$targetDomain]['user'] = $user;
            if ($host !== '') $existing[$targetDomain]['host'] = $host;
            if ($token !== '') $existing[$targetDomain]['token'] = $token;

            $saveStmt = $pdo->prepare("REPLACE INTO settings (id, value) VALUES ('cpanel_domain_configs', ?)");
            $saveStmt->execute([json_encode($existing)]);

            echo json_encode([
                'status' => 'success',
                'message' => "cPanel credentials for {$targetDomain} updated successfully.",
                'domain' => $targetDomain
            ]);
            break;

        case 'get_saved_webmail_credentials':
            try {
                $stmt = $pdo->prepare("SELECT value FROM settings WHERE id = 'saved_webmail_credentials'");
                $stmt->execute();
                $val = $stmt->fetchColumn();
                $list = $val ? json_decode($val, true) : [];
                if (!is_array($list)) $list = [];
                echo json_encode(['status' => 'success', 'credentials' => $list]);
            } catch (Exception $e) {
                echo json_encode(['status' => 'success', 'credentials' => []]);
            }
            break;

        case 'save_saved_webmail_credential':
            $input = jsonInput();
            $em = trim($input['email'] ?? '');
            $pw = trim($input['password'] ?? '');
            $dom = trim($input['domain'] ?? '');
            $by = trim($input['resetBy'] ?? ($user['email'] ?? 'User'));
            if (!empty($em) && !empty($pw)) {
                persistSavedWebmailCredential($pdo, $em, $pw, $dom, $by);
                echo json_encode(['status' => 'success', 'message' => 'Credential saved.']);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'Email and password required.']);
            }
            break;

        case 'cpanel_change_webmail_password':
            $input = jsonInput();
            $rawEmail = trim($input['email'] ?? ($_POST['email'] ?? ''));
            $domain = trim($input['domain'] ?? ($_POST['domain'] ?? ''));
            $password = trim($input['password'] ?? ($_POST['password'] ?? ''));

            if (empty($rawEmail) || empty($password)) {
                echo json_encode(['status' => 'error', 'message' => 'Email and password are required.']);
                break;
            }

            // If email contains @, split into username and domain
            if (strpos($rawEmail, '@') !== false) {
                $emailParts = explode('@', $rawEmail, 2);
                $emailUser = trim($emailParts[0]);
                if (empty($domain)) {
                    $domain = trim($emailParts[1]);
                }
            } else {
                $emailUser = $rawEmail;
            }

            // Strictly validate domain against authorized company domains
            $validDomains = ['naiyatechnology.org', 'naiyatech.com.ng', 'samuikyglobal.com.ng'];
            $cleanDomain = strtolower($domain);
            if (!in_array($cleanDomain, $validDomains)) {
                echo json_encode([
                    'status' => 'error',
                    'message' => "Invalid domain '{$cleanDomain}'. Only official company domains (naiyatechnology.org, naiyatech.com.ng, samuikyglobal.com.ng) are supported."
                ]);
                break;
            }
            $domain = $cleanDomain;
            $fullEmail = strtolower($emailUser . '@' . $domain);

            // ROUTER: Resolve credentials specific to this target domain
            $creds = resolveCpanelCredentialsForDomain($domain, $pdo);
            if (!$creds || empty($creds['user']) || empty($creds['token'])) {
                echo json_encode([
                    'status' => 'warning',
                    'cpanel_executed' => false,
                    'account_not_found' => false,
                    'message' => "cPanel API credentials not configured for '{$domain}'. Set CPANEL_USER and CPANEL_TOKEN for {$domain} in backend/.env or configure via Domain API Settings.",
                    'email' => $fullEmail,
                    'emailUser' => $emailUser,
                    'domain' => $domain,
                    'password' => $password
                ]);
                break;
            }

            $cpanelHost = $creds['host'];
            $cpanelUser = $creds['user'];
            $cpanelToken = $creds['token'];

            $execResult = executeCpanelPasswordReset($cpanelHost, $cpanelUser, $cpanelToken, $emailUser, $domain, $password);

            if ($execResult['success']) {
                // Auto-persist reset password ONLY on verified cPanel execution success
                persistSavedWebmailCredential($pdo, $fullEmail, $password, $domain, $user['email'] ?? ($user['name'] ?? 'cPanel Auto-Reset'));
                echo json_encode([
                    'status' => 'success',
                    'cpanel_executed' => true,
                    'account_not_found' => false,
                    'message' => "Password for {$fullEmail} successfully updated on cPanel server!",
                    'email' => $fullEmail,
                    'emailUser' => $emailUser,
                    'domain' => $domain,
                    'password' => $password,
                    'raw' => $execResult['raw'] ?? null
                ]);
            } else {
                $isNotFound = false;
                $errMsg = $execResult['message'] ?? "cPanel reported an issue updating {$fullEmail}.";
                if (
                    stripos($errMsg, 'does not exist') !== false || 
                    stripos($errMsg, 'not found') !== false ||
                    stripos($errMsg, 'no such user') !== false ||
                    stripos($errMsg, 'unknown user') !== false ||
                    stripos($errMsg, 'invalid user') !== false ||
                    stripos($errMsg, 'cannot find') !== false
                ) {
                    $isNotFound = true;
                    $errMsg = "Account '{$fullEmail}' does not exist on {$domain} mail server.";
                    // Purge any stale saved credentials for this non-existent account
                    removeSavedWebmailCredential($pdo, $fullEmail);
                }

                echo json_encode([
                    'status' => 'warning',
                    'cpanel_executed' => false,
                    'account_not_found' => $isNotFound,
                    'message' => $errMsg,
                    'email' => $fullEmail,
                    'emailUser' => $emailUser,
                    'domain' => $domain,
                    'password' => $password,
                    'host_called' => $cpanelHost,
                    'user_called' => $cpanelUser,
                    'credential_source' => $creds['source'] ?? 'unknown',
                    'raw' => $execResult['raw'] ?? null
                ]);
            }
            break;

}

// Helper: System environment variable reader supporting getenv, $_ENV, and $_SERVER
if (!function_exists('getSysEnvVar')) {
function getSysEnvVar($key) {
    $val = getenv($key);
    if ($val !== false && $val !== null && trim($val) !== '') return trim($val);
    if (isset($_ENV[$key]) && trim($_ENV[$key]) !== '') return trim($_ENV[$key]);
    if (isset($_SERVER[$key]) && trim($_SERVER[$key]) !== '') return trim($_SERVER[$key]);
    return null;
}
}

// Helper: Resilient cPanel UAPI Password Reset Executor
if (!function_exists('executeCpanelPasswordReset')) {
function executeCpanelPasswordReset($host, $user, $token, $emailUser, $domain, $password) {
    $user = trim($user, " \t\n\r\0\x0B\"'");
    $token = trim($token, " \t\n\r\0\x0B\"'");
    $host = trim($host, " \t\n\r\0\x0B\"'");

    $hostsToTry = [];
    if (!empty($host)) {
        $hostsToTry[] = $host;
    }
    // Include local loopback fallbacks ONLY if target host is this local server
    $localHost = !empty($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : (!empty($_SERVER['SERVER_NAME']) ? $_SERVER['SERVER_NAME'] : '');
    $isLocalServer = !empty($localHost) && (strpos($host, $localHost) !== false || strpos($domain, $localHost) !== false);
    if ($isLocalServer && strpos($host, '127.0.0.1') === false && strpos($host, 'localhost') === false) {
        $hostsToTry[] = 'https://127.0.0.1:2083';
        $hostsToTry[] = 'https://localhost:2083';
    }

    $lastError = '';
    $lastRes = null;

    foreach ($hostsToTry as $currentHost) {
        if (strpos($currentHost, 'http://') !== 0 && strpos($currentHost, 'https://') !== 0) {
            $currentHost = 'https://' . $currentHost;
        }
        $parsed = parse_url($currentHost);
        if (empty($parsed['port'])) {
            $currentHost = rtrim($currentHost, '/') . ':2083';
        }
        $baseUapiUrl = rtrim($currentHost, '/') . '/execute/Email/passwd_pop';

        // Try standard cPanel UAPI formats:
        // 1. Modern UAPI: email as full address (user@domain.com) without domain param
        // 2. Separate email user and domain params
        // 3. Email username alone
        // 4. Both full email and domain params
        $paramVariations = [
            ['email' => $emailUser . '@' . $domain, 'password' => $password],
            ['email' => $emailUser, 'domain' => $domain, 'password' => $password],
            ['email' => $emailUser, 'password' => $password],
            ['email' => $emailUser . '@' . $domain, 'domain' => $domain, 'password' => $password]
        ];

        $headers = [
            "Authorization: cpanel {$user}:{$token}",
            "Accept: application/json",
            "Content-Type: application/x-www-form-urlencoded"
        ];

        foreach ($paramVariations as $postData) {
            // Try GET first (native UAPI query format), then POST
            $methods = ['GET', 'POST'];

            foreach ($methods as $method) {
                $ch = curl_init();

                if ($method === 'GET') {
                    $targetUrl = $baseUapiUrl . '?' . http_build_query($postData);
                    curl_setopt($ch, CURLOPT_URL, $targetUrl);
                    curl_setopt($ch, CURLOPT_HTTPGET, true);
                } else {
                    $targetUrl = $baseUapiUrl;
                    curl_setopt($ch, CURLOPT_URL, $baseUapiUrl);
                    curl_setopt($ch, CURLOPT_POST, 1);
                    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
                }

                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 10);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
                curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
                curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
                curl_setopt($ch, CURLOPT_UNRESTRICTED_AUTH, true);
                curl_setopt($ch, CURLOPT_POSTREDIR, 7); // Preserve POST through 301, 302, 303 redirects
                curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
                curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
                curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

                $response = curl_exec($ch);
                $curlErr = curl_error($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $effectiveUrl = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
                curl_close($ch);

                if ($curlErr) {
                    $lastError = "Connection error to {$currentHost}: " . $curlErr;
                    $lastRes = [
                        'http_code' => $httpCode,
                        'host_attempted' => $currentHost,
                        'curl_error' => $curlErr
                    ];
                    // If connection fails (e.g. port 2083 blocked externally), skip further attempts on this dead host
                    break 2;
                }

                $resJson = json_decode($response, true);

                if (is_array($resJson)) {
                    $lastRes = $resJson;

                    if (isset($resJson['status']) && $resJson['status'] == 1) {
                        return [
                            'success' => true,
                            'message' => "Password successfully updated on cPanel server!",
                            'raw' => $resJson
                        ];
                    }

                    $errText = '';
                    if (!empty($resJson['errors']) && is_array($resJson['errors'])) {
                        $errText = implode('; ', $resJson['errors']);
                    } elseif (!empty($resJson['message'])) {
                        $errText = $resJson['message'];
                    }
                    $lastError = $errText ?: "cPanel returned error status 0.";

                    // If account strictly does not exist, return right away
                    if (
                        stripos($errText, 'does not exist') !== false || 
                        stripos($errText, 'not found') !== false ||
                        stripos($errText, 'no such user') !== false ||
                        stripos($errText, 'unknown user') !== false ||
                        stripos($errText, 'invalid user') !== false ||
                        stripos($errText, 'cannot find') !== false
                    ) {
                        return [
                            'success' => false,
                            'message' => $errText,
                            'raw' => $resJson
                        ];
                    }
                } else {
                    // Non-JSON response received (e.g. HTML error 401, 403, 500 or redirect)
                    $cleanSnippet = trim(preg_replace('/\s+/', ' ', strip_tags($response)));
                    if (strlen($cleanSnippet) > 200) {
                        $cleanSnippet = substr($cleanSnippet, 0, 200) . '...';
                    }

                    $userIsEmail = (strpos($user, '@') !== false);
                    $userHint = $userIsEmail 
                        ? " Warning: '{$user}' looks like an email address, but cPanel username must be your hosting Linux account name (e.g. naiya or naiyatec)." 
                        : "";

                    if ($httpCode === 401) {
                        $lastError = "cPanel Authentication Failed (HTTP 401): Invalid cPanel username ('{$user}') or API token for '{$domain}'.{$userHint} " . ($cleanSnippet ?: 'Access denied.');
                    } elseif ($httpCode === 403) {
                        // 1. Attempt fallback to cPanel API 2 (Email::passwdpop)
                        $api2Result = tryCpanelApi2PasswordReset($currentHost, $user, $token, $emailUser, $domain, $password);
                        if ($api2Result && !empty($api2Result['success'])) {
                            return $api2Result;
                        }

                        // 2. Attempt fallback to WHM API 1 (uapi_cpanel on port 2087) in case token is a WHM/reseller token
                        $whmResult = tryWhmUapiPasswordReset($currentHost, $user, $token, $emailUser, $domain, $password);
                        if ($whmResult && !empty($whmResult['success'])) {
                            return $whmResult;
                        }

                        $cleanDetail = $cleanSnippet ? " Server response: \"{$cleanSnippet}\"." : "";
                        $lastError = "cPanel Forbidden (HTTP 403):{$cleanDetail} Token lacks 'Email Accounts' permissions. In cPanel > Security > Manage API Tokens, edit or create an API token with 'Full Access' or enable 'Email Accounts' ('passwd_pop'). Also verify that cPanel username '{$user}' is the exact Linux account owner for {$domain}.";
                    } elseif ($httpCode === 404) {
                        $lastError = "cPanel UAPI Endpoint Not Found (HTTP 404) at {$effectiveUrl}.";
                    } elseif ($httpCode >= 300 && $httpCode < 400) {
                        $lastError = "cPanel Redirect Loop (HTTP {$httpCode}) to {$effectiveUrl}.";
                    } else {
                        $lastError = "cPanel HTTP {$httpCode}: " . ($cleanSnippet ?: 'Empty or unexpected response from server.');
                    }

                    $lastRes = [
                        'http_code' => $httpCode,
                        'host_attempted' => $currentHost,
                        'effective_url' => $effectiveUrl,
                        'method' => $method,
                        'response_preview' => substr($response, 0, 500)
                    ];

                    // If authentication or permission failed, retrying other parameter variations won't help
                    if ($httpCode === 401 || $httpCode === 403) {
                        break 2;
                    }
                }
            }
        }
    }

    return [
        'success' => false,
        'message' => $lastError ?: 'cPanel rejected request.',
        'raw' => $lastRes
    ];
}
}


// Helper: Fallback to cPanel API2 (Email::passwdpop)
if (!function_exists('tryCpanelApi2PasswordReset')) {
function tryCpanelApi2PasswordReset($host, $user, $token, $emailUser, $domain, $password) {
    $parsed = parse_url($host);
    if (empty($parsed['port'])) {
        $host = rtrim($host, '/') . ':2083';
    }
    $api2Url = rtrim($host, '/') . '/json-api/cpanel?' . http_build_query([
        'cpanel_jsonapi_user' => $user,
        'cpanel_jsonapi_apiversion' => '2',
        'cpanel_jsonapi_module' => 'Email',
        'cpanel_jsonapi_func' => 'passwdpop',
        'email' => $emailUser,
        'domain' => $domain,
        'password' => $password
    ]);

    $ch = curl_init($api2Url);
    curl_setopt($ch, CURLOPT_HTTPGET, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 4);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_UNRESTRICTED_AUTH, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: cpanel {$user}:{$token}",
        "Accept: application/json"
    ]);

    $res = curl_exec($ch);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($curlErr || !$res) return null;

    $json = json_decode($res, true);
    if (is_array($json)) {
        if (!empty($json['cpanelresult']['data'][0]['result']) && $json['cpanelresult']['data'][0]['result'] == 1) {
            return [
                'success' => true,
                'message' => "Password successfully updated on cPanel server (via API2)!",
                'raw' => $json
            ];
        }
    }
    return null;
}
}


// Helper: Fallback to WHM API 1 (uapi_cpanel / Email::passwd_pop on port 2087)
if (!function_exists('tryWhmUapiPasswordReset')) {
function tryWhmUapiPasswordReset($host, $user, $token, $emailUser, $domain, $password) {
    $parsed = parse_url($host);
    $hostOnly = !empty($parsed['host']) ? $parsed['host'] : preg_replace('/:[0-9]+$/', '', str_replace(['https://', 'http://'], '', $host));
    $scheme = !empty($parsed['scheme']) ? $parsed['scheme'] : 'https';
    $whmUrl = "{$scheme}://{$hostOnly}:2087/json-api/uapi_cpanel";

    // Detect target cPanel username for this domain
    $usersToTry = [$user];
    $cleanDomainUser = substr(preg_replace('/[^a-zA-Z0-9]/', '', explode('.', $domain)[0]), 0, 8);
    if (!empty($cleanDomainUser) && !in_array($cleanDomainUser, $usersToTry)) {
        $usersToTry[] = $cleanDomainUser;
    }

    foreach ($usersToTry as $targetUser) {
        $query = http_build_query([
            'api.version' => '1',
            'cpanel_jsonapi_user' => $targetUser,
            'cpanel_jsonapi_module' => 'Email',
            'cpanel_jsonapi_func' => 'passwd_pop',
            'email' => $emailUser . '@' . $domain,
            'password' => $password
        ]);

        $ch = curl_init($whmUrl . '?' . $query);
        curl_setopt($ch, CURLOPT_HTTPGET, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 8);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 4);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Authorization: whm {$user}:{$token}",
            "Accept: application/json"
        ]);

        $res = curl_exec($ch);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($curlErr || !$res) continue;

        $json = json_decode($res, true);
        if (is_array($json)) {
            if (
                (!empty($json['data']['result']['status']) && $json['data']['result']['status'] == 1) ||
                (!empty($json['result'][0]['status']) && $json['result'][0]['status'] == 1) ||
                (!empty($json['status']) && $json['status'] == 1)
            ) {
                return [
                    'success' => true,
                    'message' => "Password successfully updated on server (via WHM API)!",
                    'raw' => $json
                ];
            }
        }
    }
    return null;
}
}


// Helper: Resolve cPanel Host, Username, and API Token for a specific domain
if (!function_exists('resolveCpanelCredentialsForDomain')) {
function resolveCpanelCredentialsForDomain($domain, $pdo) {
    $domain = strtolower(trim($domain));

    // 1. Check database settings table first
    try {
        $stmt = $pdo->prepare("SELECT value FROM settings WHERE id = 'cpanel_domain_configs'");
        $stmt->execute();
        $val = $stmt->fetchColumn();
        if ($val) {
            $configs = json_decode($val, true);
            if (isset($configs[$domain]) && !empty($configs[$domain]['user']) && !empty($configs[$domain]['token'])) {
                $h = !empty($configs[$domain]['host']) ? $configs[$domain]['host'] : "https://{$domain}:2083";
                return [
                    'host' => $h,
                    'user' => $configs[$domain]['user'],
                    'token' => $configs[$domain]['token'],
                    'source' => 'database'
                ];
            }
        }
    } catch (Exception $e) {}

    // 2. Check domain-specific environment variables in .env
    $envSuffix = strtoupper(preg_replace('/[^a-zA-Z0-9]/', '_', $domain));
    $envUser = getSysEnvVar("CPANEL_USER_{$envSuffix}") ?: getSysEnvVar("CPANEL_USERNAME_{$envSuffix}");
    $envToken = getSysEnvVar("CPANEL_TOKEN_{$envSuffix}") ?: getSysEnvVar("CPANEL_API_TOKEN_{$envSuffix}");
    $envHost = getSysEnvVar("CPANEL_HOST_{$envSuffix}") ?: getSysEnvVar("CPANEL_URL_{$envSuffix}");

    // Aliases
    if (!$envUser) {
        if (strpos($domain, 'samuiky') !== false) {
            $envUser = getSysEnvVar("CPANEL_USER_SAMUIKY") ?: getSysEnvVar("CPANEL_USER_SAMUIKYGLOBAL");
            $envToken = getSysEnvVar("CPANEL_TOKEN_SAMUIKY") ?: getSysEnvVar("CPANEL_API_TOKEN_SAMUIKY") ?: getSysEnvVar("CPANEL_TOKEN_SAMUIKYGLOBAL");
            $envHost = getSysEnvVar("CPANEL_HOST_SAMUIKY") ?: getSysEnvVar("CPANEL_HOST_SAMUIKYGLOBAL");
        } elseif (strpos($domain, 'naiyatech.com.ng') !== false) {
            $envUser = getSysEnvVar("CPANEL_USER_NAIYATECH") ?: getSysEnvVar("CPANEL_USER_NAIYATECH_COM_NG");
            $envToken = getSysEnvVar("CPANEL_TOKEN_NAIYATECH") ?: getSysEnvVar("CPANEL_API_TOKEN_NAIYATECH") ?: getSysEnvVar("CPANEL_TOKEN_NAIYATECH_COM_NG");
            $envHost = getSysEnvVar("CPANEL_HOST_NAIYATECH") ?: getSysEnvVar("CPANEL_HOST_NAIYATECH_COM_NG");
        } elseif (strpos($domain, 'naiyatechnology.org') !== false) {
            $envUser = getSysEnvVar("CPANEL_USER_NAIYATECHNOLOGY") ?: getSysEnvVar("CPANEL_USER_NAIYATECHNOLOGY_ORG") ?: getSysEnvVar("CPANEL_USER_NAIYA");
            $envToken = getSysEnvVar("CPANEL_TOKEN_NAIYATECHNOLOGY") ?: getSysEnvVar("CPANEL_API_TOKEN_NAIYATECHNOLOGY") ?: getSysEnvVar("CPANEL_TOKEN_NAIYATECHNOLOGY_ORG") ?: getSysEnvVar("CPANEL_TOKEN_NAIYA");
            $envHost = getSysEnvVar("CPANEL_HOST_NAIYATECHNOLOGY") ?: getSysEnvVar("CPANEL_HOST_NAIYATECHNOLOGY_ORG");
        }
    }

    if ($envUser && $envToken) {
        return [
            'host' => $envHost ?: "https://{$domain}:2083",
            'user' => $envUser,
            'token' => $envToken,
            'source' => 'env_domain'
        ];
    }

    // 3. Fallback to generic CPANEL_USER and CPANEL_API_TOKEN
    $genUser = getSysEnvVar('CPANEL_USER') ?: getSysEnvVar('CPANEL_USERNAME') ?: getSysEnvVar('CPANEL_ACCOUNT') ?: getSysEnvVar('CPANEL_ADMIN');
    $genToken = getSysEnvVar('CPANEL_API_TOKEN') ?: getSysEnvVar('CPANEL_TOKEN') ?: getSysEnvVar('CPANEL_API_KEY') ?: getSysEnvVar('CPANEL_KEY');
    $genHost = getSysEnvVar('CPANEL_HOST') ?: getSysEnvVar('CPANEL_URL') ?: "https://{$domain}:2083";

    if ($genUser && $genToken) {
        return [
            'host' => $genHost,
            'user' => $genUser,
            'token' => $genToken,
            'source' => 'env_global'
        ];
    }

    return null;
}
}


// Helper: Persist saved webmail credentials to settings table
if (!function_exists('persistSavedWebmailCredential')) {
function persistSavedWebmailCredential($pdo, $email, $password, $domain, $resetBy = 'User') {
    try {
        $stmt = $pdo->prepare("SELECT value FROM settings WHERE id = 'saved_webmail_credentials'");
        $stmt->execute();
        $val = $stmt->fetchColumn();
        $list = $val ? json_decode($val, true) : [];
        if (!is_array($list)) $list = [];

        $cleanEmail = strtolower(trim($email));
        $list = array_values(array_filter($list, function($item) use ($cleanEmail) {
            return strtolower(trim($item['email'] ?? '')) !== $cleanEmail;
        }));

        array_unshift($list, [
            'id' => uniqid('wm_'),
            'email' => $cleanEmail,
            'password' => $password,
            'domain' => strtolower(trim($domain)),
            'resetAt' => date('c'),
            'resetBy' => $resetBy
        ]);

        $list = array_slice($list, 0, 250);

        $saveStmt = $pdo->prepare("REPLACE INTO settings (id, value) VALUES ('saved_webmail_credentials', ?)");
        $saveStmt->execute([json_encode($list)]);

        try {
            $today = date('Y-m-d');
            $statStmt = $pdo->query("SELECT value FROM settings WHERE id = 'action_stats'");
            $sVal = $statStmt->fetchColumn();
            $sData = $sVal ? json_decode($sVal, true) : [];
            if (!is_array($sData)) $sData = [];
            $sData['webmail_resolves'] = ($sData['webmail_resolves'] ?? 0) + 1;
            if (!isset($sData['daily']) || !is_array($sData['daily'])) {
                $sData['daily'] = [];
            }
            if (!isset($sData['daily'][$today]) || !is_array($sData['daily'][$today])) {
                $sData['daily'][$today] = ['vpn_resolves' => 0, 'webmail_resolves' => 0, 'triage_resolves' => 0];
            }
            $sData['daily'][$today]['webmail_resolves'] = ($sData['daily'][$today]['webmail_resolves'] ?? 0) + 1;

            $saveStat = $pdo->prepare("REPLACE INTO settings (id, value) VALUES ('action_stats', ?)");
            $saveStat->execute([json_encode($sData)]);
        } catch (Exception $e2) {}

        return true;
    } catch (Exception $e) {
        return false;
    }
}
}


// Helper: Remove saved webmail credential if an account was found not to exist on server
if (!function_exists('removeSavedWebmailCredential')) {
function removeSavedWebmailCredential($pdo, $email) {
    try {
        $stmt = $pdo->prepare("SELECT value FROM settings WHERE id = 'saved_webmail_credentials'");
        $stmt->execute();
        $val = $stmt->fetchColumn();
        $list = $val ? json_decode($val, true) : [];
        if (!is_array($list)) return false;

        $cleanEmail = strtolower(trim($email));
        $newList = array_values(array_filter($list, function($item) use ($cleanEmail) {
            return strtolower(trim($item['email'] ?? '')) !== $cleanEmail;
        }));

        $saveStmt = $pdo->prepare("REPLACE INTO settings (id, value) VALUES ('saved_webmail_credentials', ?)");
        $saveStmt->execute([json_encode($newList)]);
        return true;
    } catch (Exception $e) {
        return false;
    }
}
}


