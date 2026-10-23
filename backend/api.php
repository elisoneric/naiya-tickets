<?php
require 'db.php';

// 1. Set Headers (Important for API)
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
ini_set('memory_limit', '256M');

$action = $_GET['action'] ?? '';
$id = $_GET['id'] ?? null;

// Helper to get JSON POST data
function jsonInput() {
    $input = file_get_contents('php://input');
    return json_decode($input, true) ?? [];
}

// --- JWT Authentication Helpers ---
$JWT_SECRET = 'naiya_secure_jwt_secret_key_2026';

function generate_jwt($payload, $secret) {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $b64Header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $b64Payload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode(json_encode($payload)));
    $signature = hash_hmac('sha256', $b64Header . "." . $b64Payload, $secret, true);
    $b64Sig = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
    return $b64Header . "." . $b64Payload . "." . $b64Sig;
}

function verify_jwt($token, $secret) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return false;
    list($b64Header, $b64Payload, $b64Sig) = $parts;
    $signature = hash_hmac('sha256', $b64Header . "." . $b64Payload, $secret, true);
    $expectedSig = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
    if (hash_equals($expectedSig, $b64Sig)) {
        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $b64Payload)), true);
        if (isset($payload['exp']) && $payload['exp'] < time()) return false;
        return $payload;
    }
    return false;
}

function require_auth() {
    global $JWT_SECRET;
    $authHeader = '';
    
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $key => $value) {
            if (strtolower($key) === 'authorization') {
                $authHeader = $value;
                break;
            }
        }
    } elseif (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        foreach ($headers as $key => $value) {
            if (strtolower($key) === 'authorization') {
                $authHeader = $value;
                break;
            }
        }
    }
    
    if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        $payload = verify_jwt($matches[1], $JWT_SECRET);
        if ($payload) return $payload;
    }
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
    exit;
}
// ---------------------------------

// Helper to save base64 image to disk
function saveBase64Image($base64Data, $folder = 'uploads') {
    if (empty($base64Data)) return $base64Data;
    
    // Check if it's actually a base64 image
    if (!preg_match('/^data:image\/(\w+);base64,/', $base64Data, $type)) {
        return $base64Data; // Might already be a URL or invalid
    }
    
    $data = substr($base64Data, strpos($base64Data, ',') + 1);
    $ext = strtolower($type[1]);
    if ($ext === 'jpeg') $ext = 'jpg';
    
    if (!in_array($ext, ['jpg', 'png', 'gif', 'webp'])) {
        return $base64Data; // Unsupported type, keep as is
    }
    
    $decodedData = base64_decode($data);
    if ($decodedData === false) return $base64Data;
    
    $dir = __DIR__ . '/' . $folder;
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    
    $filename = uniqid('img_') . '_' . time() . '.' . $ext;
    $filepath = $dir . '/' . $filename;
    
    if (file_put_contents($filepath, $decodedData)) {
        return '/' . $folder . '/' . $filename;
    }
    
    return $base64Data; // Fallback
}

// Global token for external VPN hub
$VPN_HUB_TOKEN = getenv('VPN_HUB_TOKEN') ?: 'GCTj-kfp8-G@Ph';

try {
    // --- GLOBAL SERVICE & FULL SITE MAINTENANCE GATEKEEPER ---
    $isStaffOrLead = false;
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (empty($authHeader) && function_exists('getallheaders')) {
        $hdrs = getallheaders();
        foreach ($hdrs as $k => $v) {
            if (strtolower($k) === 'authorization') {
                $authHeader = $v;
                break;
            }
        }
    }
    if (preg_match('/Bearer\s(\S+)/', $authHeader, $mAuth)) {
        $jwtPayload = verify_jwt($mAuth[1], $JWT_SECRET);
        if ($jwtPayload && in_array($jwtPayload['role'] ?? '', ['staff', 'team_lead'])) {
            $isStaffOrLead = true;
        }
    }

    // Load general settings from database
    $maintStmt = $pdo->prepare("SELECT value FROM settings WHERE id = 'general'");
    $maintStmt->execute();
    $rawGeneralSettings = $maintStmt->fetchColumn();
    $genSettings = $rawGeneralSettings ? json_decode($rawGeneralSettings, true) : [];

    // 1. FULL SITE MAINTENANCE ENFORCEMENT
    // Blocks every single action for non-staff immediately with HTTP 503
    if (!empty($genSettings['siteMaintenanceMode']) && !$isStaffOrLead) {
        $allowedDuringMaintenance = ['login_staff', 'login_lead', 'get_settings'];
        if (!in_array($action, $allowedDuringMaintenance)) {
            http_response_code(503);
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode([
                'status' => 'error',
                'code' => 'SITE_MAINTENANCE',
                'message' => $genSettings['siteMaintenanceMessage'] ?: 'Platform is currently under scheduled maintenance. Access is restricted to IT Technical Staff.'
            ]);
            exit;
        }
    }

    // 2. PER-SERVICE / PER-SECTION MAINTENANCE ENFORCEMENT
    // Blocks individual services (Pay, VPN, NIMC, Webmail) if their category is disabled
    if (!$isStaffOrLead && !empty($genSettings['triageCategories']) && is_array($genSettings['triageCategories'])) {
        $disabledCatMap = [];
        foreach ($genSettings['triageCategories'] as $tc) {
            if (!empty($tc['disabled'])) {
                $p = $tc['presetCategory'] ?? ($tc['title'] ?? '');
                $disabledCatMap[$p] = $tc['disabledMessage'] ?: 'This service is currently undergoing scheduled technical maintenance.';
            }
        }

        // Check Pay Portal service
        $payBlocked = $disabledCatMap['Payment & Statement Portal'] ?? ($disabledCatMap['Payment & Work Report'] ?? null);
        if ($payBlocked && in_array($action, ['pay_get_report', 'pay_get_access_logs', 'pay_export_access_logs_csv'])) {
            http_response_code(503);
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode([
                'status' => 'error',
                'code' => 'SERVICE_MAINTENANCE',
                'service' => 'pay',
                'message' => $payBlocked
            ]);
            exit;
        }

        // Check VPN service
        $vpnBlocked = $disabledCatMap['VPN Related'] ?? null;
        if ($vpnBlocked && in_array($action, ['check_vpn_status'])) {
            http_response_code(503);
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode([
                'status' => 'error',
                'code' => 'SERVICE_MAINTENANCE',
                'service' => 'vpn',
                'message' => $vpnBlocked
            ]);
            exit;
        }

        // Check Webmail service
        $webmailBlocked = $disabledCatMap['WEBMAIL'] ?? null;
        if ($webmailBlocked && in_array($action, ['cpanel_change_webmail_password', 'get_saved_webmail_credentials', 'save_saved_webmail_credential'])) {
            http_response_code(503);
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode([
                'status' => 'error',
                'code' => 'SERVICE_MAINTENANCE',
                'service' => 'webmail',
                'message' => $webmailBlocked
            ]);
            exit;
        }

        // Check ticket creation under disabled category
        if ($action === 'create_ticket') {
            $ticketInput = jsonInput();
            $ticketCat = $ticketInput['category'] ?? '';
            if (!empty($disabledCatMap[$ticketCat])) {
                http_response_code(503);
                header('Content-Type: application/json; charset=UTF-8');
                echo json_encode([
                    'status' => 'error',
                    'code' => 'SERVICE_MAINTENANCE',
                    'service' => $ticketCat,
                    'message' => $disabledCatMap[$ticketCat]
                ]);
                exit;
            }
        }
    }

    // 1. Modular Route Dispatcher (loads from /routes/)
    $routeMap = [
        // Auth Routes
        'login_staff'                       => 'auth.php',
        'login_lead'                        => 'auth.php',
        'login_agent'                       => 'auth.php',
        'send_agent_otp'                    => 'auth.php',
        'verify_agent_otp_and_set_password' => 'auth.php',
        'approve_agent_recovery'            => 'auth.php',
        'set_agent_password'                => 'auth.php',
        'update_agent_password'             => 'auth.php',

        // Ticket Routes
        'get_tickets'                       => 'tickets.php',
        'search_tickets'                    => 'tickets.php',
        'get_ticket_details'                => 'tickets.php',
        'create_ticket'                     => 'tickets.php',
        'update_ticket'                     => 'tickets.php',
        'add_message'                       => 'tickets.php',
        'cleanup_tickets'                   => 'tickets.php',
        'bulk_clear_device_tickets'         => 'tickets.php',
        'get_priority_nimc_tickets'         => 'tickets.php',

        // Pay & Work Report Routes
        'pay_get_report'                    => 'pay.php',
        'pay_get_access_logs'               => 'pay.php',
        'pay_export_access_logs_csv'        => 'pay.php',

        // Agent Routes
        'get_agents'                        => 'agents.php',
        'update_agents'                     => 'agents.php',
        'delete_agents'                     => 'agents.php',

        // Staff Routes
        'get_staff'                         => 'staff.php',
        'upsert_staff'                      => 'staff.php',
        'delete_staff'                      => 'staff.php',
        'get_leads'                         => 'staff.php',
        'upsert_lead'                       => 'staff.php',
        'delete_lead'                       => 'staff.php',

        // Feedback Routes
        'get_feedback'                      => 'feedback.php',
        'get_feedback_image'                => 'feedback.php',
        'save_feedback'                     => 'feedback.php',
        'resolve_feedback'                  => 'feedback.php',
        'bulk_resolve_feedback'             => 'feedback.php',

        // System, Stats, VPN & Webmail Routes
        'upload_image'                      => 'system.php',
        'send_email'                        => 'system.php',
        'upgrade'                           => 'system.php',
        'get_analytics_snapshot'            => 'system.php',
        'get_settings'                      => 'system.php',
        'update_settings'                   => 'system.php',
        'track_action'                      => 'system.php',
        'get_stats'                         => 'system.php',
        'check_vpn_status'                  => 'system.php',
        'vpn_admin_get_user'                => 'system.php',
        'vpn_admin_swap'                    => 'system.php',
        'vpn_admin_assign'                  => 'system.php',
        'vpn_admin_revoke'                  => 'system.php',
        'get_cpanel_domain_configs'         => 'system.php',
        'update_cpanel_domain_configs'      => 'system.php',
        'get_saved_webmail_credentials'     => 'system.php',
        'save_saved_webmail_credential'     => 'system.php',
        'cpanel_change_webmail_password'    => 'system.php',
    ];

    if (!empty($action) && isset($routeMap[$action])) {
        $targetRouteFile = __DIR__ . '/routes/' . $routeMap[$action];
        if (file_exists($targetRouteFile)) {
            require $targetRouteFile;
            exit;
        }
    }

    // Fallback: If /routes/ directory is missing, dispatch via inline handlers
    switch ($action) {
        // --- IMAGE UPLOAD ---
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
        case 'login_staff':
            $data = jsonInput();
            $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? AND role = 'staff'");
            $stmt->execute([$data['email']]);
            $user = $stmt->fetch();
            
            // Backdoor for Initial Setup
            if (!$user && strtolower($data['email']) === 'itstaff' && $data['password'] === 'admin123') {
                $token = generate_jwt(['email' => 'itstaff', 'role' => 'staff', 'isRoot' => true, 'exp' => time() + 86400 * 7], $JWT_SECRET);
                echo json_encode(['status' => 'success', 'user' => [
                    'email' => 'itstaff', 'name' => 'System Admin', 'role' => 'staff', 'isRoot' => true, 'token' => $token
                ]]);
                exit;
            }

            if ($user) {
                $isValid = false;
                if (password_verify($data['password'], $user['password'])) {
                    $isValid = true;
                } elseif ($user['password'] === $data['password']) {
                    // Seamless migration: Plain text matches, so hash it and update DB
                    $hashed = password_hash($data['password'], PASSWORD_DEFAULT);
                    $updateStmt = $pdo->prepare("UPDATE users SET password = ? WHERE email = ?");
                    $updateStmt->execute([$hashed, $data['email']]);
                    $isValid = true;
                }

                if ($isValid) {
                    $user['specializedCategories'] = json_decode($user['specialized_categories'] ?? '[]');
                    unset($user['password']); 
                    $isRoot = (strtolower($user['email']) === 'itstaff' || !empty($user['is_root']) || !empty($user['isRoot']));
                    $user['isRoot'] = $isRoot;
                    $user['token'] = generate_jwt(['email' => $user['email'], 'role' => $user['role'], 'isRoot' => $isRoot, 'exp' => time() + 86400 * 7], $JWT_SECRET);
                    echo json_encode(['status' => 'success', 'user' => $user]);
                } else {
                    echo json_encode(['status' => 'error', 'message' => 'Invalid credentials']);
                }
            } else {
                echo json_encode(['status' => 'error', 'message' => 'Invalid credentials']);
            }
            break;

        case 'login_lead':
            $data = jsonInput();
            $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? AND role = 'team_lead'");
            $stmt->execute([$data['email']]);
            $user = $stmt->fetch();
            
            if ($user) {
                $isValid = false;
                if (password_verify($data['password'], $user['password'])) {
                    $isValid = true;
                } elseif ($user['password'] === $data['password']) {
                    // Seamless migration: Plain text matches, so hash it and update DB
                    $hashed = password_hash($data['password'], PASSWORD_DEFAULT);
                    $updateStmt = $pdo->prepare("UPDATE users SET password = ? WHERE email = ?");
                    $updateStmt->execute([$hashed, $data['email']]);
                    $isValid = true;
                }

                if ($isValid) {
                    unset($user['password']);
                    $user['managedTeamId'] = $user['managed_team_id'];
                    $user['token'] = generate_jwt(['email' => $user['email'], 'role' => $user['role'], 'exp' => time() + 86400 * 7], $JWT_SECRET);
                    echo json_encode(['status' => 'success', 'user' => $user]);
                } else {
                    echo json_encode(['status' => 'error', 'message' => 'Invalid credentials']);
                }
            } else {
                echo json_encode(['status' => 'error', 'message' => 'Invalid credentials']);
            }
            break;
            
        case 'login_agent':
            $data = jsonInput();
            $email = strtolower($data['email'] ?? '');
            $password = $data['password'] ?? '';
            
            $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? AND role = 'agent'");
            $stmt->execute([$email]);
            $user = $stmt->fetch();
            
            if ($user) {
                if (empty($user['password'])) {
                    $token = generate_jwt(['email' => $user['email'], 'role' => 'agent', 'exp' => time() + 86400], $JWT_SECRET);
                    echo json_encode(['status' => 'success', 'no_password' => true, 'has_password' => false, 'agent' => $user, 'token' => $token]);
                } else {
                    if (password_verify($password, $user['password'])) {
                        // Success
                        unset($user['password']);
                        $token = generate_jwt(['email' => $user['email'], 'role' => 'agent', 'exp' => time() + 86400], $JWT_SECRET);
                        echo json_encode(['status' => 'success', 'has_password' => true, 'agent' => $user, 'token' => $token]);
                    } else {
                        echo json_encode(['status' => 'error', 'message' => 'Invalid credentials']);
                    }
                }
            } else {
                echo json_encode(['status' => 'error', 'message' => 'Not found in allowlist']);
            }
            break;

        case 'send_agent_otp':
            $data = jsonInput();
            $email = strtolower($data['email'] ?? '');
            
            $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? AND role = 'agent'");
            $stmt->execute([$email]);
            $user = $stmt->fetch();
            
            if ($user) {
                // Generate 6 digit OTP
                $otp = sprintf("%06d", mt_rand(1, 999999));
                $expires = date('Y-m-d H:i:s', time() + 600); // 10 minutes
                
                $targetEmail = !empty($user['alt_email']) ? $user['alt_email'] : $email;
                
                $stmt = $pdo->prepare("REPLACE INTO otps (email, otp, expires_at) VALUES (?, ?, ?)");
                $stmt->execute([$email, $otp, $expires]); // Keyed by main email, but sent to target
                
                // Send email using PHPMailer
                require_once 'PHPMailer/src/Exception.php';
                require_once 'PHPMailer/src/PHPMailer.php';
                require_once 'PHPMailer/src/SMTP.php';
                
                try {
                    $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
                    $mail->isSMTP();
                    $mail->Host       = 'mail.naiyatechnology.org';
                    $mail->SMTPAuth   = true;
                    $mail->Username   = 'noreply@naiyatechnology.org';
                    $mail->Password   = 'EF267G2Q4Y2ES5SP';
                    $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
                    $mail->Port       = 465;

                    $mail->setFrom('noreply@naiyatechnology.org', 'NA\'IYA IT TICKETING BOT');
                    $mail->addAddress($targetEmail);

                    $mail->isHTML(true);
                    $mail->Subject = "Your NA'IYA Support OTP";
                    $mail->Body    = "
                    <div style='font-family: sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; max-width: 500px;'>
                        <h2 style='color: #0284c7; margin-top: 0;'>Login Verification</h2>
                        <p>You requested a one-time password to access the support portal.</p>
                        <div style='background: #f0f9ff; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0;'>
                            <span style='font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #0369a1;'>{$otp}</span>
                        </div>
                        <p style='color: #6b7280; font-size: 13px;'>This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
                    </div>";

                    $mail->send();
                } catch (Exception $e) {
                    error_log("OTP Mailer Error: " . $mail->ErrorInfo);
                }
                
                echo json_encode(['status' => 'success', 'message' => 'OTP sent to email', 'sentTo' => $targetEmail]);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'User not found']);
            }
            break;
            
        case 'verify_agent_otp_and_set_password':
            $data = jsonInput();
            $email = strtolower($data['email'] ?? '');
            $otp = $data['otp'] ?? '';
            $password = $data['password'] ?? '';
            
            // Password validation (Strict)
            if (strlen($password) < 8 || !preg_match('/[0-9]/', $password) || !preg_match('/[^a-zA-Z0-9]/', $password)) {
                echo json_encode(['status' => 'error', 'message' => 'Password does not meet strict requirements (min 8 chars, 1 number, 1 special char).']);
                exit;
            }
            
            $stmt = $pdo->prepare("SELECT * FROM otps WHERE email = ?");
            $stmt->execute([$email]);
            $otpRecord = $stmt->fetch();
            
            if ($otpRecord && $otpRecord['otp'] === $otp && strtotime($otpRecord['expires_at']) > time()) {
                // OTP Valid
                $hashed = password_hash($password, PASSWORD_DEFAULT);
                $updateStmt = $pdo->prepare("UPDATE users SET password = ?, must_change_password = 0 WHERE email = ? AND role = 'agent'");
                $updateStmt->execute([$hashed, $email]);
                
                // Delete used OTP
                $pdo->prepare("DELETE FROM otps WHERE email = ?")->execute([$email]);
                
                $userStmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
                $userStmt->execute([$email]);
                $user = $userStmt->fetch();
                unset($user['password']);
                
                $token = generate_jwt(['email' => $user['email'], 'role' => 'agent', 'exp' => time() + 86400], $JWT_SECRET);
                echo json_encode(['status' => 'success', 'agent' => $user, 'token' => $token]);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'Invalid or expired OTP']);
            }
            break;

        case 'approve_agent_recovery':
            $auth = require_auth();
            if ($auth['role'] !== 'staff') { http_response_code(403); exit; }
            
            $data = jsonInput();
            $currentEmail = strtolower($data['currentEmail'] ?? '');
            $altEmail = strtolower($data['altEmail'] ?? '');
            
            if ($currentEmail && $altEmail) {
                $stmt = $pdo->prepare("UPDATE users SET alt_email = ? WHERE email = ? AND role = 'agent'");
                $stmt->execute([$altEmail, $currentEmail]);
                
                // Also mark the feedback as resolved
                if (!empty($data['feedbackId'])) {
                    $pdo->prepare("UPDATE feedback SET is_resolved = 1 WHERE id = ?")->execute([$data['feedbackId']]);
                }
                
                echo json_encode(['status' => 'success']);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'Missing emails']);
            }
            break;

        case 'set_agent_password':
            $auth = require_auth();
            if ($auth['role'] !== 'staff') { http_response_code(403); exit; }
            
            $data = jsonInput();
            $email = strtolower($data['email'] ?? '');
            $password = $data['password'] ?? '';
            
            if ($email && $password) {
                $hashed = password_hash($password, PASSWORD_DEFAULT);
                $stmt = $pdo->prepare("UPDATE users SET password = ?, must_change_password = 1 WHERE email = ? AND role = 'agent'");
                $stmt->execute([$hashed, $email]);
                echo json_encode(['status' => 'success']);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'Missing parameters']);
            }
            break;

        case 'update_agent_password':
            $auth = require_auth();
            if ($auth['role'] !== 'agent') { http_response_code(403); exit; }
            
            $data = jsonInput();
            $newPassword = $data['password'] ?? '';
            
            if (strlen($newPassword) < 8 || !preg_match('/[0-9]/', $newPassword) || !preg_match('/[^a-zA-Z0-9]/', $newPassword)) {
                echo json_encode(['status' => 'error', 'message' => 'Password does not meet strict requirements.']);
                exit;
            }
            
            $hashed = password_hash($newPassword, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("UPDATE users SET password = ?, must_change_password = 0 WHERE email = ?");
            $stmt->execute([$hashed, $auth['email']]);
            
            echo json_encode(['status' => 'success', 'message' => 'Password updated successfully']);
            break;

        // --- TICKET MANAGEMENT ---
        
        // 1. LIGHTWEIGHT LIST (No messages/attachments)
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

        case 'get_tickets':
            // Optimization: Do NOT select attachments or full messages history for the list view
            $since = isset($_GET['since']) ? $_GET['since'] : null;
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10000;
            $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
            $createdByEmail = isset($_GET['created_by_email']) ? $_GET['created_by_email'] : null;
            
            $query = "SELECT id, ticket_number, title, category, status, priority, 
                created_by_email, created_by_name, assigned_to_email, team_lead_id, team_lead_email,
                is_escalated, is_pinned, is_read_by_staff, is_locked, locked_by, 
                project, created_at, updated_at, last_agent_reply_at, read_by, 
                last_message_preview, last_message_role
                FROM tickets";
            
            $whereClauses = [];
            $params = [];

            if ($since) {
                $whereClauses[] = "updated_at >= :since";
                // Subtract 5 seconds to account for clock skew
                $params[':since'] = date('Y-m-d H:i:s', (int)(($since / 1000) - 5));
            }
            if ($createdByEmail) {
                $whereClauses[] = "created_by_email = :email";
                $params[':email'] = $createdByEmail;
            }

            if (!empty($whereClauses)) {
                $query .= " WHERE " . implode(" AND ", $whereClauses);
            }
            
            if ($since) {
                // Delta sync: fetch all tickets modified since timestamp
                $query .= " ORDER BY updated_at DESC LIMIT 5000";
                $stmt = $pdo->prepare($query);
                $stmt->execute($params);
            } else {
                // Header load
                $query .= " ORDER BY updated_at DESC LIMIT :limit OFFSET :offset";
                $stmt = $pdo->prepare($query);
                
                if ($createdByEmail) {
                    $stmt->bindValue(':email', $params[':email']);
                }
                $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
                $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
                $stmt->execute();
            }
            $tickets = $stmt->fetchAll();
            
            foreach ($tickets as &$t) {
                $t['isEscalated'] = (bool)$t['is_escalated'];
                $t['isPinned'] = (bool)$t['is_pinned'];
                $t['isReadByStaff'] = (bool)$t['is_read_by_staff'];
                $t['isLocked'] = (bool)$t['is_locked'];
                
                $t['ticketNumber'] = $t['ticket_number'];
                $t['createdByEmail'] = $t['created_by_email'];
                $t['createdByName'] = $t['created_by_name'];
                $t['assignedToEmail'] = $t['assigned_to_email'];
                $t['teamLeadId'] = $t['team_lead_id'];
                $t['teamLeadEmail'] = $t['team_lead_email'];
                $t['lockedBy'] = $t['locked_by'];
                $t['createdAt'] = $t['created_at'] ? str_replace(' ', 'T', $t['created_at']) . '+01:00' : null;
                $t['updatedAt'] = $t['updated_at'] ? str_replace(' ', 'T', $t['updated_at']) . '+01:00' : null;
                $t['lastAgentReplyAt'] = $t['last_agent_reply_at'] ? str_replace(' ', 'T', $t['last_agent_reply_at']) . '+01:00' : null;

                $t['lastMessagePreview'] = $t['last_message_preview'] ?? null;
                $t['lastMessageRole'] = $t['last_message_role'] ?? null;
                $t['searchableText'] = $t['searchable_text'] ?? '';

                unset($t['searchable_text']);
                unset($t['last_message_preview']);
                unset($t['last_message_role']);
                
                $t['readBy'] = json_decode($t['read_by'] ?? '[]', true);
            }
            echo json_encode(['status' => 'success', 'data' => $tickets, 'serverTime' => time() * 1000]);
            break;

        // 2. SERVER-SIDE SEARCH
        case 'search_tickets':
            $rawQuery = trim($_GET['q'] ?? '');
            if (empty($rawQuery)) {
                echo json_encode(['status' => 'success', 'data' => []]);
                break;
            }

            $cleanQuery = ltrim($rawQuery, '#');
            $exactTerm = $cleanQuery;
            $likeTerm = '%' . $cleanQuery . '%';
            $prefixTerm = $cleanQuery . '%';

            $sql = "SELECT id, ticket_number, title, category, status, priority, 
                created_by_email, created_by_name, assigned_to_email, team_lead_id, team_lead_email,
                is_escalated, is_pinned, is_read_by_staff, is_locked, locked_by, 
                project, created_at, updated_at, last_agent_reply_at, read_by, 
                last_message_preview, last_message_role
                FROM tickets 
                WHERE (
                    ticket_number = :exact_1
                    OR id = :exact_2
                    OR ticket_number LIKE :like_1
                    OR id LIKE :like_2
                    OR title LIKE :like_3
                    OR created_by_email LIKE :like_4
                    OR created_by_name LIKE :like_5
                    OR description LIKE :like_6
                    OR category LIKE :like_7
                    OR project LIKE :like_8
                    OR searchable_text LIKE :like_9
                    OR last_message_preview LIKE :like_10
                )
                ORDER BY (
                    CASE 
                        WHEN ticket_number = :exact_3 OR id = :exact_4 THEN 0
                        WHEN ticket_number LIKE :prefix_1 OR id LIKE :prefix_2 THEN 1
                        ELSE 2
                    END
                ), updated_at DESC LIMIT 200";

            $params = [
                ':exact_1' => $exactTerm,
                ':exact_2' => $exactTerm,
                ':exact_3' => $exactTerm,
                ':exact_4' => $exactTerm,
                ':prefix_1' => $prefixTerm,
                ':prefix_2' => $prefixTerm,
            ];
            for ($i = 1; $i <= 10; $i++) {
                $params[":like_$i"] = $likeTerm;
            }

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $tickets = $stmt->fetchAll();
            
            foreach ($tickets as &$t) {
                $t['isEscalated'] = (bool)$t['is_escalated'];
                $t['isPinned'] = (bool)$t['is_pinned'];
                $t['isReadByStaff'] = (bool)$t['is_read_by_staff'];
                $t['isLocked'] = (bool)$t['is_locked'];
                
                $t['ticketNumber'] = $t['ticket_number'];
                $t['createdByEmail'] = $t['created_by_email'];
                $t['createdByName'] = $t['created_by_name'];
                $t['assignedToEmail'] = $t['assigned_to_email'];
                $t['teamLeadId'] = $t['team_lead_id'];
                $t['teamLeadEmail'] = $t['team_lead_email'];
                $t['lockedBy'] = $t['locked_by'];
                $t['createdAt'] = $t['created_at'] ? str_replace(' ', 'T', $t['created_at']) . '+01:00' : null;
                $t['updatedAt'] = $t['updated_at'] ? str_replace(' ', 'T', $t['updated_at']) . '+01:00' : null;
                $t['lastAgentReplyAt'] = $t['last_agent_reply_at'] ? str_replace(' ', 'T', $t['last_agent_reply_at']) . '+01:00' : null;

                $t['lastMessagePreview'] = $t['last_message_preview'] ?? null;
                $t['lastMessageRole'] = $t['last_message_role'] ?? null;
                $t['searchableText'] = $t['searchable_text'] ?? '';

                unset($t['searchable_text']);
                unset($t['last_message_preview']);
                unset($t['last_message_role']);
                
                $t['readBy'] = json_decode($t['read_by'] ?? '[]', true);
            }
            echo json_encode(['status' => 'success', 'data' => $tickets]);
            break;

        // 3. HEAVY DETAILS (Single Ticket)
        case 'get_ticket_details':
            if (!$id) throw new Exception("ID Missing");
            $lightweight = isset($_GET['lightweight']) && $_GET['lightweight'] === '1';
            if ($lightweight) {
                $stmt = $pdo->prepare("SELECT updated_at, last_message_preview, last_message_role, messages FROM tickets WHERE id = ?");
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                if ($row) {
                    $msgs = json_decode($row['messages'] ?? '[]', true);
                    $msgCount = is_array($msgs) ? count($msgs) : 0;
                    $lastMsg = ($msgCount > 0 && is_array($msgs)) ? end($msgs) : null;
                    $lastMsgId = is_array($lastMsg) ? ($lastMsg['id'] ?? '') : '';
                    echo json_encode(['status' => 'success', 'lightweight' => true, 'data' => [
                        'updatedAt' => $row['updated_at'],
                        'lastMessagePreview' => $row['last_message_preview'],
                        'lastMessageRole' => $row['last_message_role'],
                        'messageCount' => $msgCount,
                        'lastMessageId' => $lastMsgId
                    ]]);
                } else {
                    echo json_encode(['status' => 'error', 'message' => 'Ticket not found']);
                }
                break;
            }

            $stmt = $pdo->prepare("SELECT messages, attachments, description FROM tickets WHERE id = ?");
            $stmt->execute([$id]);
            $data = $stmt->fetch();
            
            if ($data) {
                $data['messages'] = json_decode($data['messages'] ?? '[]', true);
                $data['attachments'] = json_decode($data['attachments'] ?? '[]', true);
                // Description string is kept native
                echo json_encode(['status' => 'success', 'data' => $data]);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'Ticket not found']);
            }
            break;
            
        // 3. ANALYTICS SNAPSHOT (Full Data - NO ATTACHMENTS TO PREVENT 500 ERROR)
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
                            'senderId' => $msg['senderId'] ?? ''
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

        case 'create_ticket':
            $data = jsonInput();
            
            $createdByEmail = $data['createdByEmail'] ?? '';
            $category = $data['category'] ?? '';
            
            if (!empty($createdByEmail) && !empty($category)) {
                $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM tickets WHERE created_by_email = ? AND category = ? AND status NOT IN ('Closed', 'Resolved')");
                $checkStmt->execute([$createdByEmail, $category]);
                if ($checkStmt->fetchColumn() >= 1) { // Wait, "some will be creating 3 ticket... limit one user from creating multiple ticket... find a balance for this to avoid flooding but still serve".
                    // Let's limit to 1.
                    http_response_code(400);
                    echo json_encode(['status' => 'error', 'message' => "You already have an active ticket open in the '$category' category."]);
                    exit;
                }
            }

            $data['id'] = uniqid('tkt_'); 
            
            $utcNow = date('Y-m-d H:i:s');
            
            // Save attachments to disk
            $attachments = [];
            if (!empty($data['attachments']) && is_array($data['attachments'])) {
                foreach ($data['attachments'] as $att) {
                    $attachments[] = saveBase64Image($att, 'uploads/tickets');
                }
            }
            
            $stmt = $pdo->prepare("INSERT INTO tickets (
                id, ticket_number, title, category, description, status, priority, 
                created_by_email, created_by_name, team_lead_id, team_lead_email, project, 
                created_at, updated_at, last_agent_reply_at, attachments, read_by, messages,
                searchable_text, last_message_preview, last_message_role
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            
            $stmt->execute([
                $data['id'], $data['ticketNumber'], $data['title'], $data['category'], 
                $data['description'], $data['status'], $data['priority'], 
                $data['createdByEmail'], $data['createdByName'], $data['teamLeadId'], 
                $data['teamLeadEmail'] ?? null, $data['project'], 
                $utcNow, $utcNow, $utcNow, 
                json_encode($attachments), 
                json_encode($data['readBy']),
                json_encode([]),
                '', // searchable_text is empty initially
                substr($data['description'] ?? '', 0, 100), // last_message_preview
                null // last_message_role
            ]);
            
            echo json_encode(['status' => 'success', 'id' => $data['id']]);
            break;

        case 'update_ticket':
            $data = jsonInput();
            if (!$id) throw new Exception("ID required");

            $fields = [];
            $params = [];

            $map = [
                'status' => 'status',
                'category' => 'category',
                'project' => 'project',
                'assignedToEmail' => 'assigned_to_email',
                'teamLeadId' => 'team_lead_id',
                'teamLeadEmail' => 'team_lead_email',
                'isEscalated' => 'is_escalated',
                'isPinned' => 'is_pinned',
                'isReadByStaff' => 'is_read_by_staff',
                'isLocked' => 'is_locked',
                'lockedBy' => 'locked_by',
                'updatedAt' => 'updated_at',
                'lastAgentReplyAt' => 'last_agent_reply_at'
            ];

            $isOnlyReadUpdate = true;
            foreach ($data as $key => $val) {
                if ($key !== 'readBy' && $key !== 'isReadByStaff' && $key !== 'isLocked' && $key !== 'lockedBy') {
                    $isOnlyReadUpdate = false;
                }
                
                if (isset($map[$key])) {
                    $fields[] = "{$map[$key]} = ?";
                    $params[] = $val;
                } elseif ($key === 'readBy') {
                    $stmt = $pdo->prepare("SELECT read_by FROM tickets WHERE id = ?");
                    $stmt->execute([$id]);
                    $current = json_decode($stmt->fetchColumn() ?? '[]', true);
                    if (is_array($val)) {
                         $fields[] = "read_by = ?";
                         $params[] = json_encode($val);
                    } else {
                         if (!in_array($val, $current)) $current[] = $val;
                         $fields[] = "read_by = ?";
                         $params[] = json_encode($current);
                    }
                }
            }

            if (empty($fields)) {
                echo json_encode(['status' => 'success', 'message' => 'No changes']);
                exit;
            }

            if ($isOnlyReadUpdate) {
                $fields[] = "updated_at = updated_at";
            } elseif (!isset($data['updatedAt'])) {
                $fields[] = "updated_at = ?";
                $params[] = date('Y-m-d H:i:s');
            }

            $params[] = $id;
            $sql = "UPDATE tickets SET " . implode(', ', $fields) . " WHERE id = ?";
            $pdo->prepare($sql)->execute($params);
            
            echo json_encode(['status' => 'success']);
            break;

        case 'add_message':
            $data = jsonInput();
            if (!$id) throw new Exception("ID required");

            // Save attachments to disk
            if (!empty($data['attachments']) && is_array($data['attachments'])) {
                $savedAttachments = [];
                foreach ($data['attachments'] as $att) {
                    $savedAttachments[] = saveBase64Image($att, 'uploads/messages');
                }
                $data['attachments'] = $savedAttachments;
            }

            $stmt = $pdo->prepare("SELECT messages, status, assigned_to_email FROM tickets WHERE id = ?");
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            $messages = json_decode($row['messages'] ?? '[]', true);
            
            $messages[] = $data;

            $role = $data['role'];
            $isStaffSender = ($role === 'staff');
            $isUserSender = ($role === 'agent' || $role === 'guest' || $role === 'team_lead');

            $statusUpdate = "";
            if ($row['status'] === 'Closed') {
                $statusUpdate = ", status = 'Open'";
            } elseif ($isStaffSender && $row['status'] === 'Open') {
                $statusUpdate = ", status = 'In Progress'";
            }
            
            $utcNow = date('Y-m-d H:i:s');
            $lastReplyUpdate = ", last_agent_reply_at = '$utcNow'"; 

            $readStatusUpdate = "";
            if ($isUserSender) {
                $readStatusUpdate = ", is_read_by_staff = 0";
            } elseif ($isStaffSender) {
                $readStatusUpdate = ", is_read_by_staff = 1";
            }

            $senderEmail = $data['senderId'] ?? '';
            $newReadBy = $senderEmail ? [$senderEmail] : [];

            $assignUpdate = "";
            if ($isStaffSender && empty($row['assigned_to_email'])) {
                $assignUpdate = ", assigned_to_email = '$senderEmail'";
            }

            // Calculate searchable text and last message info
            $searchableText = '';
            foreach ($messages as $msg) {
                if (isset($msg['content'])) $searchableText .= ' ' . $msg['content'];
                if (isset($msg['senderName'])) $searchableText .= ' ' . $msg['senderName'];
                if (isset($msg['senderEmail'])) $searchableText .= ' ' . $msg['senderEmail'];
            }
            $lastMessagePreview = substr($data['content'] ?? '', 0, 100);
            $lastMessageRole = $role;
            
            $sql = "UPDATE tickets SET messages = ?, updated_at = '$utcNow' $statusUpdate $lastReplyUpdate $readStatusUpdate $assignUpdate, read_by = ?, searchable_text = ?, last_message_preview = ?, last_message_role = ? WHERE id = ?";
            $pdo->prepare($sql)->execute([json_encode($messages), json_encode($newReadBy), $searchableText, $lastMessagePreview, $lastMessageRole, $id]);
            
            echo json_encode(['status' => 'success']);
            break;

        case 'cleanup_tickets':
            $data = jsonInput();
            $type = $data['type'] ?? '';
            
            if ($type === 'closed') {
                $stmt = $pdo->query("SELECT * FROM tickets WHERE status = 'Closed'");
            } else if ($type === 'stale_unreplied') {
                // Tickets where last_agent_reply_at is older than 1 month, or null and created_at is older than 1 month
                $oneMonthAgo = date('Y-m-d H:i:s', strtotime('-1 month'));
                $stmt = $pdo->prepare("SELECT * FROM tickets WHERE (last_agent_reply_at < ? OR (last_agent_reply_at IS NULL AND created_at < ?)) AND status != 'Closed'");
                $stmt->execute([$oneMonthAgo, $oneMonthAgo]);
            } else {
                throw new Exception("Invalid cleanup type");
            }
            
            $tickets = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if (count($tickets) > 0) {
                // Backup
                $backupDir = 'backups';
                if (!is_dir($backupDir)) {
                    mkdir($backupDir, 0777, true);
                }
                $backupFile = $backupDir . '/tickets_backup_' . $type . '_' . date('Ymd_His') . '.json';
                file_put_contents($backupFile, json_encode($tickets, JSON_PRETTY_PRINT));
                
                // Delete
                $ids = array_column($tickets, 'id');
                $placeholders = str_repeat('?,', count($ids) - 1) . '?';
                $deleteStmt = $pdo->prepare("DELETE FROM tickets WHERE id IN ($placeholders)");
                $deleteStmt->execute($ids);
            }
            
            echo json_encode(['status' => 'success', 'deletedCount' => count($tickets)]);
            break;

        // --- SETTINGS & USERS ---

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
            
        case 'get_agents':
            $stmt = $pdo->prepare("SELECT value FROM settings WHERE id = 'agents'");
            $stmt->execute();
            $res = $stmt->fetchColumn();
            $json = $res ? json_decode($res, true) : [];
            
            if (isset($json['agents']) && is_array($json['agents'])) {
                $agents = array_values($json['agents']);
            } elseif (is_array($json)) {
                $agents = array_values($json);
            } else {
                $agents = [];
            }
            
            echo json_encode($agents);
            break;
            
        case 'update_agents':
            $auth = require_auth();
            if ($auth['role'] !== 'staff') { http_response_code(403); exit; }
            $data = jsonInput();
            $stmt = $pdo->prepare("REPLACE INTO settings (id, value) VALUES ('agents', ?)");
            $stmt->execute([json_encode(['agents' => $data])]);
            echo json_encode(['status' => 'success']);
            break;

        case 'get_staff':
            $stmt = $pdo->query("SELECT email, name, avatar, role, specialized_categories, is_root FROM users WHERE role = 'staff'");
            $staff = $stmt->fetchAll();
            foreach($staff as &$s) {
                $s['specializedCategories'] = json_decode($s['specialized_categories'] ?? '[]');
                $isRoot = (
                    (isset($s['is_root']) && ($s['is_root'] == 1 || $s['is_root'] === '1' || $s['is_root'] === true)) ||
                    (strtolower($s['email'] ?? '') === 'itstaff') ||
                    !empty($s['isRoot'])
                );
                $s['isRoot'] = $isRoot ? true : false;
                $s['is_root'] = $isRoot ? 1 : 0;
            }
            echo json_encode($staff);
            break;

        case 'upsert_staff':
            $auth = require_auth();
            if ($auth['role'] !== 'staff') { http_response_code(403); exit; }
            $d = jsonInput();
            
            $stmt = $pdo->prepare("SELECT password, is_root FROM users WHERE email = ?");
            $stmt->execute([$d['email']]);
            $existingUser = $stmt->fetch();
            $existingPass = $existingUser ? $existingUser['password'] : '';
            
            $passwordToSave = $existingPass ?: '';
            if (!empty($d['password'])) {
                // Determine if password needs hashing
                // Typically bcrypt hashes start with $2y$ and are 60 chars long
                if (strlen($d['password']) === 60 && strpos($d['password'], '$2') === 0) {
                    $passwordToSave = $d['password']; // Client passed an already hashed password? (Unlikely, but safety check)
                } else {
                    $passwordToSave = password_hash($d['password'], PASSWORD_DEFAULT);
                }
            }
            $specializedCategories = json_encode($d['specializedCategories'] ?? []);
            
            $avatar = '';
            if (!empty($d['avatar'])) {
                if (strpos($d['avatar'], 'data:image') === 0) {
                    $avatar = saveBase64Image($d['avatar'], 'uploads/avatars');
                } else {
                    $avatar = $d['avatar']; // Already a URL
                }
            }

            $isRoot = (
                (strtolower($d['email'] ?? '') === 'itstaff') ||
                !empty($d['isRoot']) ||
                (isset($d['is_root']) && ($d['is_root'] == 1 || $d['is_root'] === '1' || $d['is_root'] === true))
            ) ? 1 : 0;
            
            $stmt = $pdo->prepare("INSERT INTO users (email, name, password, role, avatar, specialized_categories, is_root) 
                                   VALUES (?, ?, ?, 'staff', ?, ?, ?) 
                                   ON DUPLICATE KEY UPDATE 
                                   name = VALUES(name), 
                                   password = VALUES(password), 
                                   avatar = VALUES(avatar), 
                                   specialized_categories = VALUES(specialized_categories),
                                   is_root = VALUES(is_root)");
            $stmt->execute([$d['email'], $d['name'], $passwordToSave, $avatar, $specializedCategories, $isRoot]);
            echo json_encode(['status' => 'success']);
            break;

        case 'delete_staff':
            $auth = require_auth();
            if ($auth['role'] !== 'staff') { http_response_code(403); exit; }
            $pdo->prepare("DELETE FROM users WHERE email = ?")->execute([$id]);
            echo json_encode(['status' => 'success']);
            break;

        case 'get_leads':
            $stmt = $pdo->query("SELECT email, name, avatar, managed_team_id as id, password FROM users WHERE role = 'team_lead'");
            echo json_encode($stmt->fetchAll());
            break;
            
        case 'upsert_lead':
            $auth = require_auth();
            if ($auth['role'] !== 'staff') { http_response_code(403); exit; }
            $d = jsonInput();
            
            $stmt = $pdo->prepare("SELECT password FROM users WHERE email = ?");
            $stmt->execute([$d['email']]);
            $existingPass = $stmt->fetchColumn();
            
            $passwordToSave = $existingPass ?: '';
            if (!empty($d['password'])) {
                if (strlen($d['password']) === 60 && strpos($d['password'], '$2') === 0) {
                    $passwordToSave = $d['password'];
                } else {
                    $passwordToSave = password_hash($d['password'], PASSWORD_DEFAULT);
                }
            }
            
            $avatar = '';
            if (!empty($d['avatar'])) {
                if (strpos($d['avatar'], 'data:image') === 0) {
                    $avatar = saveBase64Image($d['avatar'], 'uploads/avatars');
                } else {
                    $avatar = $d['avatar']; // Already a URL
                }
            }
            
            $stmt = $pdo->prepare("INSERT INTO users (email, name, password, role, managed_team_id, avatar) 
                                   VALUES (?, ?, ?, 'team_lead', ?, ?) 
                                   ON DUPLICATE KEY UPDATE 
                                   name = VALUES(name), 
                                   password = VALUES(password), 
                                   managed_team_id = VALUES(managed_team_id), 
                                   avatar = VALUES(avatar)");
            $stmt->execute([$d['email'], $d['name'], $passwordToSave, $d['id'], $avatar]);
            echo json_encode(['status' => 'success']);
            break;

        case 'delete_lead':
            $auth = require_auth();
            if ($auth['role'] !== 'staff') { http_response_code(403); exit; }
            $pdo->prepare("DELETE FROM users WHERE email = ?")->execute([$id]);
            echo json_encode(['status' => 'success']);
            break;

        case 'get_feedback':
            $stmt = $pdo->query("SELECT id, type, email, name, content, is_resolved, created_at, CASE WHEN proof_image IS NOT NULL AND proof_image != '' THEN 1 ELSE 0 END as has_proof FROM feedback ORDER BY created_at DESC");
            $feed = $stmt->fetchAll();
            foreach($feed as &$f) {
                $f['isResolved'] = (bool)$f['is_resolved'];
                $f['hasProofImage'] = (bool)$f['has_proof'];
                $f['timestamp'] = $f['created_at'];
            }
            echo json_encode($feed);
            break;

        case 'get_feedback_image':
            $stmt = $pdo->prepare("SELECT proof_image FROM feedback WHERE id = ?");
            $stmt->execute([$id]);
            $res = $stmt->fetch();
            if ($res && $res['proof_image']) {
                echo json_encode(['status' => 'success', 'image' => $res['proof_image']]);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'No image found']);
            }
            break;

        case 'save_feedback':
            $d = jsonInput();
            $id = uniqid('fb_');
            
            $proofImage = '';
            if (!empty($d['proofImage'])) {
                $proofImage = saveBase64Image($d['proofImage'], 'uploads/feedback');
            }
            
            $stmt = $pdo->prepare("INSERT INTO feedback (id, type, email, name, content, proof_image, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");
            $stmt->execute([$id, $d['type'], $d['email'], $d['name']??'', $d['content'], $proofImage]);
            echo json_encode(['status' => 'success']);
            break;
            
        case 'resolve_feedback':
            $auth = require_auth();
            if ($auth['role'] !== 'staff') { http_response_code(403); exit; }
            $pdo->prepare("UPDATE feedback SET is_resolved = 1 WHERE id = ?")->execute([$id]);
            echo json_encode(['status' => 'success']);
            break;

        // --- VPN PROXY HANDLERS (FALLBACK) ---
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

        case 'pay_admin_search':
        case 'pay_admin_get_record':
            $localPayDb = null;
            $candidates = [
                __DIR__ . '/pay.db',
                __DIR__ . '/../pay.db',
                __DIR__ . '/../../naiya_works/cpanel_pay/pay.db',
                __DIR__ . '/../../naiya_works/pay.db'
            ];
            foreach ($candidates as $c) {
                if (file_exists($c)) {
                    $localPayDb = $c;
                    break;
                }
            }

            if ($localPayDb && class_exists('PDO')) {
                try {
                    $payPdo = new PDO('sqlite:' . $localPayDb);
                    $payPdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

                    if ($action === 'pay_admin_search') {
                        $q = trim($_GET['q'] ?? '');
                        $fep = trim($_GET['fep'] ?? '');
                        $month = trim($_GET['month'] ?? '');
                        $sortBy = trim($_GET['sort_by'] ?? 'volume_desc');
                        $page = max(1, intval($_GET['page'] ?? 1));
                        $limit = min(200, max(10, intval($_GET['limit'] ?? 50)));
                        $offset = ($page - 1) * $limit;

                        $where = ["1=1"];
                        $params = [];

                        if (!empty($q)) {
                            $clean = preg_replace('/\s+/', '', $q);
                            $where[] = "(REPLACE(a.identifier, ' ', '') LIKE :clean OR a.identifier LIKE :raw OR a.full_name LIKE :raw OR a.fep_category LIKE :raw)";
                            $params[':clean'] = '%' . $clean . '%';
                            $params[':raw'] = '%' . $q . '%';
                        }

                        if (!empty($fep) && $fep !== 'All FEPs') {
                            $where[] = "a.fep_category = :fep";
                            $params[':fep'] = $fep;
                        }

                        $joinReports = "LEFT JOIN reports r ON a.identifier = r.identifier";
                        if (!empty($month) && $month !== 'all') {
                            $joinReports = "INNER JOIN reports r ON a.identifier = r.identifier AND r.month = :month";
                            $params[':month'] = $month;
                        }

                        $whereClause = implode(" AND ", $where);

                        // Count total distinct agents
                        $countSql = "SELECT COUNT(DISTINCT a.identifier) FROM agents a $joinReports WHERE $whereClause";
                        $countStmt = $payPdo->prepare($countSql);
                        $countStmt->execute($params);
                        $totalFiltered = (int)$countStmt->fetchColumn();

                        // Order clause
                        $orderClause = "ORDER BY total_volume DESC, a.full_name ASC";
                        if ($sortBy === 'volume_asc') {
                            $orderClause = "ORDER BY total_volume ASC, a.full_name ASC";
                        } elseif ($sortBy === 'name_asc') {
                            $orderClause = "ORDER BY a.full_name ASC, total_volume DESC";
                        }

                        $sql = "
                            SELECT a.identifier, a.identifier_type, a.full_name, a.fep_category, a.license_type, a.verification_status,
                                   COALESCE(SUM(r.enrollment_count), 0) AS total_volume
                            FROM agents a
                            $joinReports
                            WHERE $whereClause
                            GROUP BY a.identifier
                            $orderClause
                            LIMIT :limit OFFSET :offset
                        ";

                        $stmt = $payPdo->prepare($sql);
                        foreach ($params as $k => $v) {
                            $stmt->bindValue($k, $v);
                        }
                        $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
                        $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
                        $stmt->execute();
                        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                        $totalPages = $totalFiltered > 0 ? (int)ceil($totalFiltered / $limit) : 1;

                        echo json_encode([
                            'status' => 'success',
                            'page' => $page,
                            'limit' => $limit,
                            'total_filtered' => $totalFiltered,
                            'total_pages' => $totalPages,
                            'count' => count($rows),
                            'agents' => $rows
                        ]);
                        break;
                    } else {
                        $identifier = trim($_GET['identifier'] ?? '');
                        if (empty($identifier)) {
                            echo json_encode(['status' => 'error', 'message' => 'Identifier parameter is required']);
                            break;
                        }
                        $clean = preg_replace('/\s+/', '', $identifier);
                        $cList = [
                            $clean,
                            strtoupper($clean),
                            'EACRUGGED-' . $clean,
                            'OUKITEL-' . $clean,
                            'QUALCOMM-' . $clean,
                            'WHEATEK-' . $clean,
                            'HENA-' . $clean
                        ];
                        if (preg_match('/^[A-Z0-9]+-(.+)$/i', $clean, $m)) {
                            $cList[] = $m[1];
                        }

                        $placeholders = implode(',', array_fill(0, count($cList), '?'));
                        $stmt = $payPdo->prepare("
                            SELECT identifier, identifier_type, full_name, fep_category, license_type, verification_status
                            FROM agents
                            WHERE REPLACE(identifier, ' ', '') IN ($placeholders)
                            LIMIT 1
                        ");
                        $stmt->execute($cList);
                        $agent = $stmt->fetch(PDO::FETCH_ASSOC);

                        if (!$agent) {
                            $stmt = $payPdo->prepare("
                                SELECT identifier, identifier_type, full_name, fep_category, license_type, verification_status
                                FROM agents
                                WHERE REPLACE(identifier, ' ', '') LIKE ? OR full_name LIKE ?
                                LIMIT 1
                            ");
                            $stmt->execute(['%' . $clean . '%', '%' . $identifier . '%']);
                            $agent = $stmt->fetch(PDO::FETCH_ASSOC);
                        }

                        if (!$agent) {
                            echo json_encode(['status' => 'error', 'message' => 'Agent record not found']);
                            break;
                        }

                        $repStmt = $payPdo->prepare("
                            SELECT identifier, identifier_type, month, month_label, enrollment_count, status
                            FROM reports
                            WHERE identifier = :id
                        ");
                        $repStmt->execute([':id' => $agent['identifier']]);
                        $reports = $repStmt->fetchAll(PDO::FETCH_ASSOC);

                        $monthOrder = [
                            'sep_2026' => 1, 'aug_2026' => 2, 'jul_2026' => 3, 'jun_2026' => 4,
                            'may_2026' => 5, 'apr_2026' => 6, 'mar_2026' => 7, 'feb_2026' => 8, 'jan_2026' => 9,
                            'dec_2025' => 10, 'nov_2025' => 11, 'oct_2025' => 12, 'sep_2025' => 13,
                            'jul_2025' => 14, 'jun_2025' => 15
                        ];

                        usort($reports, function($a, $b) use ($monthOrder) {
                            $mA = $monthOrder[$a['month'] ?? ''] ?? 99;
                            $mB = $monthOrder[$b['month'] ?? ''] ?? 99;
                            return $mA <=> $mB;
                        });

                        $totalVol = 0;
                        foreach ($reports as $r) {
                            $totalVol += intval($r['enrollment_count']);
                        }

                        echo json_encode([
                            'status' => 'success',
                            'agent' => $agent,
                            'reports' => $reports,
                            'summary' => [
                                'total_volume' => $totalVol,
                                'active_months' => count($reports),
                                'first_month' => !empty($reports) ? end($reports)['month_label'] : null,
                                'latest_month' => !empty($reports) ? reset($reports)['month_label'] : null
                            ]
                        ]);
                        break;
                    }
                } catch (Exception $e) {
                    // Fall back to cURL proxy
                }
            }

            // Fallback to Pay Hub API via cURL
            $payHubUrl = getenv('PAY_HUB_URL') ?: 'https://pay.naiyatechnology.org/api.php';
            $subAction = ($action === 'pay_admin_search') ? 'search' : 'get_report';
            $params = [];
            if ($action === 'pay_admin_search') {
                $params['q'] = $_GET['q'] ?? '';
                if (!empty($_GET['fep'])) $params['fep'] = $_GET['fep'];
            } else {
                $params['identifier'] = $_GET['identifier'] ?? '';
            }
            $targetUrl = $payHubUrl . '?action=' . $subAction . '&' . http_build_query($params);

            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $targetUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
            $result = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            if ($result === false) {
                error_log("cURL Error in {$action}: " . curl_error($ch));
            }
            curl_close($ch);

            http_response_code($httpCode >= 200 && $httpCode < 300 ? 200 : ($httpCode ?: 502));
            echo $result ?: json_encode(['status' => 'error', 'message' => 'Pay Hub connection failed']);
            break;

        default:
            echo json_encode(['status' => 'error', 'message' => 'Invalid action']);
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error', 
        'message' => $e->getMessage()
    ]);
}
?>