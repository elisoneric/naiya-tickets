<?php
// Auth Routes

switch ($action) {
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
                    echo json_encode(['status' => 'success', 'no_password' => true, 'agent' => $user, 'token' => $token]);
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
                
                $mailSent = false;
                $mailError = '';

                try {
                    $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
                    $mail->isSMTP();
                    $mail->Host       = getenv('SMTP_HOST') ?: 'mail.naiyatechnology.org';
                    $mail->SMTPAuth   = true;
                    $mail->Username   = getenv('SMTP_USER') ?: 'noreply@naiyatechnology.org';
                    $mail->Password   = getenv('SMTP_PASSWORD') ?: 'EF267G2Q4Y2ES5SP';
                    $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
                    $mail->Port       = (int)(getenv('SMTP_PORT') ?: 465);

                    // cPanel SSL verification options
                    $mail->SMTPOptions = [
                        'ssl' => [
                            'verify_peer' => false,
                            'verify_peer_name' => false,
                            'allow_self_signed' => true
                        ]
                    ];

                    $mail->setFrom(getenv('SMTP_FROM_EMAIL') ?: 'noreply@naiyatechnology.org', 'NA\'IYA IT TICKETING BOT');
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
                    $mailSent = true;
                } catch (\Throwable $e) {
                    $mailError = $e->getMessage();
                    error_log("OTP Mailer Error: " . $mailError);
                }
                
                if ($mailSent) {
                    echo json_encode(['status' => 'success', 'message' => 'OTP sent to email', 'sentTo' => $targetEmail]);
                } else {
                    echo json_encode(['status' => 'error', 'message' => 'Failed to send OTP email: ' . $mailError]);
                }
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

}
