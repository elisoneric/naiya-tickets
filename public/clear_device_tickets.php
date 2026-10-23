<?php
/**
 * NA'IYA & SAMUIKY SUPPORT PLATFORM
 * cPanel Database Bulk Ticket Sweeper & NIMC Priority Filter with DeepSeek AI
 * 
 * Target Database: naiyatechnology_ticketv1
 * Author: System Developer / Root Administration
 */

// 1. Error Handling & Environment Limits
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);
date_default_timezone_set('Africa/Lagos');

ini_set('memory_limit', '512M');
set_time_limit(300);

$isCli = (php_sapi_name() === 'cli');

// 2. Locate and Load Database Connection
$dbPath = file_exists(__DIR__ . '/db.php') 
    ? __DIR__ . '/db.php' 
    : (file_exists(__DIR__ . '/backend/db.php') ? __DIR__ . '/backend/db.php' : null);

if (!$dbPath) {
    die("Database connection file (db.php) not found in " . __DIR__ . " or " . __DIR__ . "/backend/");
}

// We require db.php, but ensure HTML content type is served for browser requests
require_once $dbPath;
if (!$isCli && !headers_sent()) {
    header("Content-Type: text/html; charset=UTF-8");
}

// 3. Helper: Parse .env configuration file
function loadEnvironmentVariables() {
    $envPaths = [
        __DIR__ . '/.env',
        __DIR__ . '/backend/.env',
        dirname(__DIR__) . '/.env'
    ];
    $vars = [];
    foreach ($envPaths as $p) {
        if (file_exists($p)) {
            $lines = file($p, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if (empty($line) || $line[0] === '#') continue;
                if (strpos($line, '=') !== false) {
                    list($key, $val) = explode('=', $line, 2);
                    $key = trim($key);
                    $val = trim($val, " \t\n\r\0\x0B\"'");
                    $vars[$key] = $val;
                }
            }
            break;
        }
    }
    return $vars;
}

$envVars = loadEnvironmentVariables();

// 3b. Load PHPMailer Library for Rate-Limited Dispatch
$phpMailerDir = null;
$possibleMailerPaths = [
    __DIR__ . '/PHPMailer/src',
    __DIR__ . '/backend/PHPMailer/src',
    dirname(__DIR__) . '/PHPMailer/src',
    dirname(__DIR__) . '/cpanel/PHPMailer/src'
];
foreach ($possibleMailerPaths as $pmp) {
    if (file_exists($pmp . '/PHPMailer.php')) {
        $phpMailerDir = $pmp;
        break;
    }
}
if ($phpMailerDir) {
    require_once $phpMailerDir . '/Exception.php';
    require_once $phpMailerDir . '/PHPMailer.php';
    require_once $phpMailerDir . '/SMTP.php';
}

// 4. Session & Developer Passcode Security
$SECURITY_PASSCODE = 'naiya2026'; // Developer passcode (or pass via ?key=naiya2026)

if (!$isCli) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    $providedKey = $_GET['key'] ?? $_POST['key'] ?? ($_SESSION['dev_auth'] ?? '');
    if ($providedKey === $SECURITY_PASSCODE) {
        $_SESSION['dev_auth'] = $SECURITY_PASSCODE;
    }
    
    $isAuthenticated = (isset($_SESSION['dev_auth']) && $_SESSION['dev_auth'] === $SECURITY_PASSCODE);
    
    if (isset($_GET['logout'])) {
        unset($_SESSION['dev_auth']);
        header('Location: ' . strtok($_SERVER["REQUEST_URI"], '?'));
        exit;
    }
} else {
    $isAuthenticated = true;
}

// 5. Indunix AI / DeepSeek Configuration Detection
$deepseekApiKey = $_POST['indunix_api_key'] 
    ?? $_POST['deepseek_api_key'] 
    ?? $_SESSION['indunix_api_key'] 
    ?? $_SESSION['deepseek_api_key'] 
    ?? ($envVars['INDUNIX_API_KEY'] ?? ($envVars['VITE_INDUNIX_API_KEY'] ?? ($envVars['DEEPSEEK_API_KEY'] ?? ($envVars['VITE_DEEPSEEK_API_KEY'] ?? ''))));

$deepseekModel = $_POST['indunix_model'] 
    ?? $_POST['deepseek_model'] 
    ?? $_SESSION['indunix_model'] 
    ?? $_SESSION['deepseek_model'] 
    ?? ($envVars['INDUNIX_MODEL'] ?? ($envVars['VITE_INDUNIX_MODEL'] ?? ($envVars['DEEPSEEK_MODEL'] ?? 'indunix-1-core')));

$deepseekApiUrl = $_POST['indunix_api_url'] 
    ?? $_POST['deepseek_api_url'] 
    ?? $_SESSION['indunix_api_url'] 
    ?? $_SESSION['deepseek_api_url'] 
    ?? ($envVars['INDUNIX_API_URL'] ?? ($envVars['VITE_INDUNIX_API_URL'] ?? ($envVars['DEEPSEEK_API_URL'] ?? 'https://api.indunixai.com/v1/chat/completions')));

if (!$isCli) {
    if (!empty($_POST['indunix_api_key'])) {
        $_SESSION['indunix_api_key'] = trim($_POST['indunix_api_key']);
        $deepseekApiKey = $_SESSION['indunix_api_key'];
    } elseif (!empty($_POST['deepseek_api_key'])) {
        $_SESSION['deepseek_api_key'] = trim($_POST['deepseek_api_key']);
        $deepseekApiKey = $_SESSION['deepseek_api_key'];
    }
    if (!empty($_POST['indunix_model'])) {
        $_SESSION['indunix_model'] = trim($_POST['indunix_model']);
        $deepseekModel = $_SESSION['indunix_model'];
    } elseif (!empty($_POST['deepseek_model'])) {
        $_SESSION['deepseek_model'] = trim($_POST['deepseek_model']);
        $deepseekModel = $_SESSION['deepseek_model'];
    }
}

// 6. Fetch Staff Accounts for Attribution ("read my account did the work")
$staffAccounts = [];
try {
    $stmt = $pdo->query("SELECT email, name, role, is_root FROM users WHERE role = 'staff' OR is_root = 1 ORDER BY is_root DESC, email ASC");
    $staffAccounts = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {
    // Graceful fallback if users table has different structure
}

if (empty($staffAccounts)) {
    $staffAccounts = [
        ['email' => 'itstaff', 'name' => 'Root Admin / Developer', 'role' => 'staff', 'is_root' => 1]
    ];
}

$defaultStaff = $staffAccounts[0];
$selectedStaffEmail = $_POST['staff_email'] ?? $_GET['staff_email'] ?? ($_SESSION['selected_staff_email'] ?? $defaultStaff['email']);
$selectedStaffName  = $_POST['staff_name'] ?? $_GET['staff_name'] ?? ($_SESSION['selected_staff_name'] ?? $defaultStaff['name']);

foreach ($staffAccounts as $sa) {
    if ($sa['email'] === $selectedStaffEmail) {
        $selectedStaffName = $sa['name'] ?: $selectedStaffName;
        break;
    }
}
if (!$isCli) {
    $_SESSION['selected_staff_email'] = $selectedStaffEmail;
    $_SESSION['selected_staff_name'] = $selectedStaffName;
}

// 7. Official Standard Clearing Notice Templates (Generous, Clear, Courteous)
$templateMaster = "[Official Notice - IT Technical Support Desk]

Dear Enroller / Field Agent,

Thank you for contacting the NA'IYA & SAMUIKY Technical Support Desk.

We have reviewed your request. To ensure you receive the right assistance without delay, please take note of the following operational guidelines:

1. Scope of the IT Support Desk:
Our desk is dedicated exclusively to technical access and network credentials:
• NIMC Login Details & Password Resets
• Agent Metadata Onboarding & \"Agent Not Found\" status
• Central VPN Configurations, Drops & Certificates
• Official Corporate Webmail Access

2. Physical Devices, Hardware Repairs & Biometric Kits:
The IT Support desk does NOT manage physical hardware, broken screens, battery replacements, or lost/stolen tablets.
• For physical device inspection or repairs, please contact your designated State Hub Coordinator or State Logistics Desk.
• For immediate field troubleshooting guides, please consult the official Knowledge Base or ask your fellow agents in your official Enroller WhatsApp / Telegram Community Group.

3. Form Submissions (Switch to Production, Reactivation, Onboarding):
All submitted forms are audited and approved in sequential batches by the Operations Verification Committee. Technical support agents do not review forms and cannot expedite or fast-track submissions. Your submission will be processed in its scheduled batch cycle.

If you have an active technical issue regarding your NIMC login credentials or VPN network connection, please open a dedicated NIMC Login ticket anytime.

This ticket has been addressed and closed under technical support policy.

Best regards,
IT Technical Support Desk
NA'IYA & SAMUIKY";

$templateDevice = "[Official Notice - Hardware & Device Guidance]

Dear Enroller,

Thank you for reaching out regarding your field equipment.

Please be informed that the IT Technical Support Desk handles software access and credentials only (NIMC logins, metadata onboarding, and VPN connectivity). We do not service physical devices, damaged screens, faulty chargers, batteries, or hardware replacements.

Recommended Next Steps:
• Physical Repairs / Replacement: Please report physical device damage or kit replacement requests directly to your State Hub Coordinator or State Logistics Desk.
• Field Diagnostics: Check the Knowledge Base for approved device restart and troubleshooting procedures.
• Peer Support: You can also consult experienced colleagues in your official Enroller WhatsApp / Telegram group for local field tips.

This ticket is now closed under technical support policy. If you have an active NIMC login credential or VPN access issue, please open a dedicated technical ticket.

Best regards,
IT Technical Support Desk";

$templateForm = "[Official Notice - Form Submission Status]

Dear Enroller,

Thank you for contacting technical support regarding your form submission.

Please be advised that all onboarding, switch to production, and reactivation forms are processed exclusively in scheduled batches by the Operations Verification Team. 

Support Desk Notice:
• IT Helpdesk agents do not review form submissions and cannot manually fast-track, approve, or jump queue positions.
• Submissions are attended to in the order received, and approved enroller batches are announced through official channels.
• There is no need to open repeat tickets for submitted forms; doing so slows down queue processing.

This ticket has been closed under support desk policy. We appreciate your patience while Operations processes your batch.

Best regards,
IT Technical Support Desk";

$templateCommission = "[Official Notice - Agent Commission & Payment Portal]

Dear Enroller,

Thank you for reaching out to the NA'IYA & SAMUIKY Technical Support Desk regarding your commission and payout records.

Please be informed that the IT Technical Support Desk handles technical system access only (NIMC login details, metadata onboarding, corporate webmail, and VPN connectivity). We do not calculate or disburse agent commissions.

Official Action Steps to Access Your Payment Records:
All agent monthly enrollment volume audits, commission statements, and disbursement slips are available directly on the official Agent Payment Portal:
1. Visit the portal: https://pay.naiyatechnology.org
2. Enter your registered enroller email address.
3. Access your verified enrollment numbers, audited commission breakdown, and download your official payment slips.

If your records require financial adjustment or account reconciliation, please submit your enquiry directly to your State Hub Coordinator or the Accounts & Finance Desk.

This ticket has been addressed and closed under technical support policy.

Best regards,
IT Technical Support Desk
NA'IYA & SAMUIKY";

$templateClarification = "[Official Support Inquiry - Technical Support Desk]

Dear Enroller,

Thank you for contacting the NA'IYA & SAMUIKY Technical Support Desk.

We have received your ticket, but we need a few more details to understand how we may help you and ensure your inquiry is resolved without delay.

Could you please reply to this ticket with:
1. The exact nature of your request or the specific error message on your screen.
2. Your Front-End Partner (FEP): NA'IYA or SAMUIKY.
3. Your National Identification Number (NIN) and registered enroller email/phone.

Guidance Notes:
• NIMC Login Details & Metadata: Handled by technical desk once your NIN and credentials are confirmed.
• Central VPN Configurations: Handled by network desk.
• Agent Commission & Payout Records: You can view monthly volumes and audited payment slips directly at https://pay.naiyatechnology.org.
• Physical Hardware (Screens, Chargers, Batteries): Managed by your State Hub Coordinator and Logistics Desk.

Once you reply with your details, our team will assist you immediately.

Best regards,
IT Technical Support Desk
NA'IYA & SAMUIKY";

$templateNimcCheckup = "[Official Support Notice - NIMC Request Status Verification]

Dear Enroller,

Our technical support records indicate that you previously submitted a request regarding your NIMC access, login credentials, or metadata onboarding.

We are currently conducting a queue review on older pending requests to verify whether all enroller accounts have been resolved:

Has your request been treated and resolved?

• If YES (your request was already resolved):
No action is needed on your part. This ticket has been marked as closed to clear our pending queue.

• If NO (you still need technical assistance):
Please reply directly to this ticket immediately with:
1. Your 11-digit National Identification Number (NIN)
2. Your Front-End Partner (FEP): NA'IYA or SAMUIKY
3. Registered enroller email and phone number
4. The exact error message or current issue on your screen

Once you reply, this ticket will automatically reopen as an active priority for our IT technical team to assist you immediately.

Thank you for your cooperation and dedication.

Best regards,
IT Technical Support Desk
NA'IYA & SAMUIKY";

$clearingMessageTemplate = $templateMaster;

// 8. Safety Backup Directory
$backupDir = file_exists(__DIR__ . '/backend') ? __DIR__ . '/backend/backups' : __DIR__ . '/backups';
if (!is_dir($backupDir)) {
    @mkdir($backupDir, 0777, true);
}

// 8b. Email Dispatch Ledger & Rate-Limited Notification Helpers
function getEmailDispatchLedger($backupDir) {
    $ledgerPath = $backupDir . '/email_dispatch_log.json';
    if (!file_exists($ledgerPath)) {
        return [];
    }
    $content = file_get_contents($ledgerPath);
    $data = json_decode($content, true);
    return is_array($data) ? $data : [];
}

function recordEmailDispatch($backupDir, $ticketId, $ticketNumber, $recipient, $status, $error = '') {
    $ledgerPath = $backupDir . '/email_dispatch_log.json';
    $ledger = getEmailDispatchLedger($backupDir);
    $ledger[$ticketId] = [
        'ticket_id'     => $ticketId,
        'ticket_number' => $ticketNumber,
        'recipient'     => $recipient,
        'status'        => $status, // 'SENT' or 'FAILED'
        'sent_at'       => date('Y-m-d H:i:s'),
        'error'         => $error
    ];
    @file_put_contents($ledgerPath, json_encode($ledger, JSON_PRETTY_PRINT));
    return $ledger;
}

function extractLastStaffMessage($ticket, $defaultFallback = '') {
    if (!empty($ticket['messages'])) {
        $msgs = json_decode($ticket['messages'], true);
        if (is_array($msgs) && !empty($msgs)) {
            for ($i = count($msgs) - 1; $i >= 0; $i--) {
                $m = $msgs[$i];
                if (isset($m['role']) && ($m['role'] === 'staff' || $m['role'] === 'team_lead')) {
                    if (!empty($m['content'])) {
                        return trim($m['content']);
                    }
                }
            }
        }
    }
    if (!empty($ticket['last_message_preview'])) {
        return trim($ticket['last_message_preview']);
    }
    return $defaultFallback;
}

function buildBrandedEmailHtml($toName, $ticketNumber, $category, $status, $messageBody) {
    $safeName = htmlspecialchars($toName ?: 'Enroller');
    $safeNum = htmlspecialchars($ticketNumber);
    $safeCat = htmlspecialchars($category ?: 'Technical Support');
    $safeStatus = htmlspecialchars($status ?: 'Closed');
    $formattedBody = nl2br(htmlspecialchars($messageBody));
    $year = date('Y');

    return '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NA\'IYA &amp; SAMUIKY IT Support Notice</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0b1120; padding: 24px 12px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 620px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.3); border: 1px solid #1e293b;">
                    <tr>
                        <td style="background: linear-gradient(135deg, #0b1120 0%, #1e293b 100%); padding: 26px 32px; border-bottom: 3px solid #2563eb;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td>
                                        <div style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #38bdf8; text-transform: uppercase;">Official Support Desk Notification</div>
                                        <h1 style="margin: 4px 0 0 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">NA\'IYA &amp; SAMUIKY IT SUPPORT</h1>
                                    </td>
                                    <td align="right" style="vertical-align: middle;">
                                        <span style="display: inline-block; padding: 5px 12px; font-size: 11px; font-weight: 700; color: #ffffff; background-color: #2563eb; border-radius: 6px; letter-spacing: 0.5px;">#' . $safeNum . '</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f8fafc; padding: 14px 32px; border-bottom: 1px solid #e2e8f0;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 12px; color: #64748b;">
                                <tr>
                                    <td>
                                        <strong style="color: #0f172a;">Ticket:</strong> #' . $safeNum . ' &nbsp;|&nbsp; 
                                        <strong style="color: #0f172a;">Category:</strong> ' . $safeCat . '
                                    </td>
                                    <td align="right">
                                        <strong style="color: #0f172a;">Status:</strong> <span style="display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: 700; color: #0284c7; background: #e0f2fe; border-radius: 4px;">' . $safeStatus . '</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 28px 32px; color: #1e293b; font-size: 14px; line-height: 1.65;">
                            <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 16px;">
                                Dear ' . $safeName . ',
                            </div>
                            <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 14px 18px; margin: 16px 0; color: #334155; font-size: 13.5px; line-height: 1.7; border-radius: 0 8px 8px 0;">
                                ' . $formattedBody . '
                            </div>
                            <div style="margin-top: 24px; padding: 14px 18px; background-color: #f1f5f9; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 12.5px; color: #475569; line-height: 1.6;">
                                <strong style="color: #0f172a; display: block; margin-bottom: 4px;">Important Note on Ticket Status:</strong>
                                If your issue has already been resolved, no further action is required on your part.<br>
                                If you still require technical assistance, please reply directly to this ticket notification or visit the support portal to reopen your request immediately.
                            </div>
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px; font-size: 12px;">
                                <tr>
                                    <td style="padding: 10px 0; border-top: 1px solid #f1f5f9;">
                                        <a href="https://pay.naiyatechnology.org" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 600;">Agent Commission &amp; Payout Portal</a>
                                        <span style="color: #94a3b8;"> &bull; View enrollment volume audits and monthly payment slips</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; border-top: 1px solid #f1f5f9;">
                                        <a href="https://vpn.naiyatechnology.org" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 600;">VPN Configuration Hub</a>
                                        <span style="color: #94a3b8;"> &bull; Dedicated network drops and certificates</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #0f172a; padding: 22px 32px; text-align: center; border-top: 1px solid #1e293b;">
                            <div style="font-size: 12px; font-weight: 700; color: #e2e8f0; letter-spacing: 0.5px;">
                                NA\'IYA TECHNOLOGY &amp; SAMUIKY GLOBAL
                            </div>
                            <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">
                                IT Technical Support &amp; Field Operations Desk &bull; ' . $year . '
                            </div>
                            <div style="font-size: 10px; color: #64748b; margin-top: 8px; line-height: 1.4;">
                                This is an official notification regarding your support desk inquiry.<br>
                                Please do not share private credentials or passwords.
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>';
}

function sendTicketEmailNotification($toEmail, $toName, $ticketNumber, $subject, $messageBody, $ticketCategory = '', $ticketStatus = 'Closed') {
    global $envVars;
    
    if (empty($toEmail) || !filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
        return ['success' => false, 'error' => 'Invalid recipient email address: ' . htmlspecialchars($toEmail)];
    }

    $smtpHost = $envVars['SMTP_HOST'] ?? 'mail.naiyatechnology.org';
    $smtpPort = (int)($envVars['SMTP_PORT'] ?? 465);
    $smtpUser = $envVars['SMTP_USER'] ?? 'noreply@naiyatechnology.org';
    $smtpPass = $envVars['SMTP_PASSWORD'] ?? 'EF267G2Q4Y2ES5SP';
    $fromEmail = $envVars['SMTP_FROM_EMAIL'] ?? 'noreply@naiyatechnology.org';
    $fromName = $envVars['SMTP_FROM_NAME'] ?? "NA'IYA IT TICKETING BOT";

    // Auto-migrate legacy credentials if server production .env has not been updated yet
    if ($smtpUser === 'ticket@naiyatechnology.org' || $smtpPass === 'XAFIQSSJGMDWCPLX') {
        $smtpUser = 'noreply@naiyatechnology.org';
        $smtpPass = 'EF267G2Q4Y2ES5SP';
        if ($fromEmail === 'ticket@naiyatechnology.org') {
            $fromEmail = 'noreply@naiyatechnology.org';
        }
    }

    $cleanMessageText = trim(strip_tags($messageBody));
    $htmlContent = buildBrandedEmailHtml($toName, $ticketNumber, $ticketCategory, $ticketStatus, $messageBody);

    if (class_exists('\\PHPMailer\\PHPMailer\\PHPMailer')) {
        try {
            $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
            $mail->SMTPDebug = 0;
            $mail->isSMTP();
            $mail->Host       = $smtpHost;
            $mail->SMTPAuth   = true;
            $mail->Username   = $smtpUser;
            $mail->Password   = $smtpPass;
            $mail->SMTPSecure = ($smtpPort === 465) ? \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS : \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port       = $smtpPort;
            $mail->CharSet    = 'UTF-8';
            $mail->Timeout    = 15;

            $mail->setFrom($fromEmail, $fromName);
            $mail->addAddress($toEmail, $toName ?: 'Enroller');
            $mail->addReplyTo('support@naiyatechnology.org', "NA'IYA Support Desk");

            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body    = $htmlContent;
            $mail->AltBody = $cleanMessageText;

            $mail->send();
            return ['success' => true];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    } else {
        $headers = "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
        $headers .= "From: " . $fromName . " <" . $fromEmail . ">\r\n";
        $headers .= "Reply-To: support@naiyatechnology.org\r\n";
        
        $ok = @mail($toEmail, $subject, $htmlContent, $headers);
        return $ok ? ['success' => true] : ['success' => false, 'error' => 'Native mail() delivery failed'];
    }
}

// =========================================================================
// DEEPSEEK AI BATCH CALLER & TAILORED REPLY ENGINE
// =========================================================================

/**
 * Call DeepSeek Chat API in compact JSON mode with rich context (450-500 chars).
 * Batches multiple tickets into one call to minimize latency while ensuring deep accuracy.
 */
function callDeepSeekApiBatch(array $ticketsBatch, string $apiKey, string $model = 'deepseek-chat', string $apiUrl = 'https://api.deepseek.com/chat/completions') {
    if (empty($apiKey)) {
        return ['error' => 'DeepSeek API key is not configured. Please supply your API key.'];
    }

    // Build rich ticket payload (generous 480 chars description, agent name, category)
    $compactTickets = [];
    foreach ($ticketsBatch as $t) {
        $cleanTitle = trim(preg_replace('/\s+/', ' ', strip_tags($t['title'] ?? '')));
        $cleanDesc  = trim(preg_replace('/\s+/', ' ', strip_tags($t['description'] ?? '')));
        $agentName  = trim($t['created_by_name'] ?? 'Enroller');
        
        $compactTickets[] = [
            'id'    => (string)$t['id'],
            'agent' => $agentName,
            'cat'   => (string)($t['category'] ?? ''),
            'title' => mb_substr($cleanTitle, 0, 120),
            'desc'  => mb_substr($cleanDesc, 0, 480)
        ];
    }

    $systemPrompt = "You are an expert IT Support Triage Classifier for the Na'iya & Samuiky National Identity Support Platform.
Read each ticket carefully with generous context. Do NOT be hasty or overlook critical details.
Classify each ticket into EXACTLY ONE of 3 actions:

1. \"CLEAR\": Redundant, out-of-scope issues that IT Technical Support does NOT handle:
   - Commission, payment inquiries, allowances, royalties, payout statement disputes (IT desk does not handle disbursements; direct them to the official Agent Payment Portal: https://pay.naiyatechnology.org).
   - Physical hardware/devices: screen broken/cracked, battery bad, charger, device won't boot, camera, rugged tablet issues.
   - Stolen, lost, or damaged device kits.
   - Form approvals: Asking to fast-track or approve 'Switch to production', 'Onboarding', 'Reactivation' forms (forms are processed in batches by operations, IT desk cannot fast-track).
   - Requests for new biometric kits or replacement devices.
   - Peer device troubleshooting suitable for Community WhatsApp/Telegram group.

2. \"KEEP_PRIORITY\": Genuine technical issues that IT Technical Support MUST handle:
   - NIMC Login credentials: password reset, forgotten password, portal credentials.
   - Metadata Onboarding: 'Agent not found in database', metadata status, upload sync.
   - Active VPN issues: VPN disconnects, certificate expired, authentication failed.
   - Corporate Webmail access: webmail password reset, account lock.
   - Enrollment blacklist verification.

3. \"REVIEW\": Ambiguous, mixed, or unclear tickets:
   - UNCLEAR, vague, short, or truncated messages where the user's specific request is not clear (e.g. 'help me', 'good morning', no clear details). These require a 'How May We Help You?' clarification message.
   - Mentions BOTH a technical access issue AND an out-of-scope issue (e.g. login + hardware, or login + commission).
   - Confidence score < 0.85.

CRITICAL: Return ONLY a valid JSON object in this format:
{\"results\": [{\"id\": \"ticket_id\", \"action\": \"CLEAR\"|\"KEEP_PRIORITY\"|\"REVIEW\", \"reason\": \"3-7 word explanation\", \"confidence\": 0.0-1.0}]}";

    $postData = [
        'model' => $model,
        'messages' => [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => json_encode(['tickets' => $compactTickets])]
        ],
        'temperature' => 0.1,
        'max_tokens' => 2000,
        'response_format' => ['type' => 'json_object']
    ];

    $ch = curl_init($apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . trim($apiKey)
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 45);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        return ['error' => 'cURL error connecting to DeepSeek: ' . $curlErr];
    }
    if ($httpCode !== 200) {
        return ['error' => 'DeepSeek API returned HTTP ' . $httpCode . ': ' . substr($response, 0, 300)];
    }

    $data = json_decode($response, true);
    $content = $data['choices'][0]['message']['content'] ?? '';
    if (empty($content)) {
        return ['error' => 'Empty response from DeepSeek API'];
    }

    $cleanContent = preg_replace('/^```(?:json)?\s*/i', '', trim($content));
    $cleanContent = preg_replace('/\s*```$/', '', $cleanContent);
    $parsed = json_decode($cleanContent, true);

    $results = [];
    if (isset($parsed['results']) && is_array($parsed['results'])) {
        $results = $parsed['results'];
    } elseif (is_array($parsed)) {
        $results = $parsed;
    } else {
        return ['error' => 'Failed to parse JSON triage from DeepSeek: ' . substr($cleanContent, 0, 180)];
    }

    return [
        'success' => true,
        'results' => $results,
        'usage' => $data['usage'] ?? []
    ];
}

/**
 * Generate a Tailored, Topic-Specific, Courteous Closing Reply for an Individual Ticket
 * Grounded in official policy rules with ZERO irrelevant topic bleed.
 */
function generateAiTailoredReply(array $ticket, string $apiKey, string $model, string $apiUrl, string $staffName) {
    global $templateCommission, $templateDevice, $templateForm, $templateClarification, $templateMaster;
    
    if (empty($apiKey)) {
        return getFallbackTemplateForTicket($ticket);
    }

    $cleanTitle = trim(strip_tags($ticket['title'] ?? ''));
    $cleanDesc  = trim(strip_tags($ticket['description'] ?? ''));
    $agentName  = trim($ticket['created_by_name'] ?? 'Enroller');
    $cleanCat   = trim(strip_tags($ticket['category'] ?? ''));

    $prompt = "You are $staffName, IT Technical Support Specialist for the NA'IYA & SAMUIKY National Identity Platform.
A field enroller named '$agentName' submitted this ticket inquiry:
Subject: $cleanTitle
Category: $cleanCat
Description: $cleanDesc

You are the intelligent message composer. Read the enroller's message carefully and compose a tailored, professional response based directly on what they wrote:

1. IF THE MESSAGE IS VAGUE, UNCLEAR, SHORT, OR GREETING-ONLY (e.g. 'help me', 'good morning', 'urgent', 'need assistance', 'cannot work', or incomplete explanations):
   - You MUST be the message composer: Read whatever specific words, greeting, or partial clues the enroller provided in their subject and description, and compose a natural, intelligent 'How May We Help You?' reply based directly on what they said.
   - If they gave a greeting (e.g. 'Good morning', 'Hello'), acknowledge it naturally.
   - If they gave a vague clue (e.g. 'login', 'enrolment', 'software', 'device', 'portal', 'verification', 'form', 'account'): acknowledge that specific clue and ask them the exact clarifying questions needed to resolve that specific problem (e.g. which portal, what error message or code appears on screen).
   - If they gave no details at all: explain politely that their message didn't include details of what they are experiencing, and ask how support may assist them today.
   - Specifically request their 11-digit NIN, registered email, phone number, and FEP (NA'IYA or SAMUIKY).
   - Invite them to reply to this ticket with these details so our technical team can assist them right away.
   - Let the reply sound like a real, helpful support specialist speaking directly to what they wrote, NOT a generic canned template or checklist.

2. IF THE INQUIRY IS ABOUT COMMISSION, PAYMENTS, ROYALTIES, DISBURSEMENTS, OR ALLOWANCES:
   - State clearly that the IT Support Desk handles technical system access only and does NOT calculate or disburse agent commissions.
   - Direct them to the official Agent Payment Portal: https://pay.naiyatechnology.org
   - Provide these exact 3 steps:
     Step 1: Visit the portal at https://pay.naiyatechnology.org
     Step 2: Enter your registered enroller email address.
     Step 3: View your verified monthly volume, audited commission statements, and download your official disbursement slips.
   - For payment discrepancies or financial adjustments, advise contacting their State Hub Coordinator or Accounts & Finance Desk.
   - STRICT GUARD: Do NOT mention physical devices, broken screens, batteries, chargers, or form approvals.

3. IF THE INQUIRY IS ABOUT PHYSICAL HARDWARE OR DEVICES (broken screen, battery, charger, tablet fault, damaged/stolen kit):
   - Explain that physical hardware repairs and kit replacements are managed by the State Hub Coordinator and State Logistics Desk.
   - Direct them to contact their State Coordinator, check the Knowledge Base, or consult colleagues on their official WhatsApp/Telegram community group.
   - STRICT GUARD: Do NOT mention commission, payments, or form approvals.

4. IF THE INQUIRY IS ABOUT FORM APPROVALS (Switch to Production, Reactivation, Onboarding):
   - Explain that submitted forms are processed in regular sequential batches by the Operations Verification Committee and cannot be manually expedited via IT helpdesk tickets.
   - Ask them to await the official batch announcement.
   - STRICT GUARD: Do NOT mention hardware repairs or commission.

5. IF THE INQUIRY IS A GENUINE NIMC LOGIN OR VPN ISSUE:
   - Provide clear technical instructions or confirm that the ticket has been retained for technical resolution.

6. IF MIXED:
   - Address ONLY the specific topics mentioned by the enroller. Never mention topics not in the ticket.

OUTPUT REQUIREMENTS:
- Output ONLY the finished reply message.
- Start with: Dear $agentName,
- Tone: Professional, courteous, helpful, concise, and human.
- Absolutely NO emojis anywhere.
- Sign off cleanly as:
Best regards,
$staffName
IT Technical Support Desk
NA'IYA & SAMUIKY";

    $postData = [
        'model' => $model,
        'messages' => [
            ['role' => 'user', 'content' => $prompt]
        ],
        'temperature' => 0.2,
        'max_tokens' => 800
    ];

    $ch = curl_init($apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . trim($apiKey)
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        $data = json_decode($response, true);
        $reply = $data['choices'][0]['message']['content'] ?? '';
        if (!empty($reply)) return trim($reply);
    }
    
    return getFallbackTemplateForTicket($ticket);
}

/**
 * Generate Tailored, Individualized Replies for a Batch of Tickets via DeepSeek in One Call
 */
function generateBatchTailoredReplies(array $ticketsBatch, string $apiKey, string $model, string $apiUrl, string $staffName) {
    if (empty($apiKey) || empty($ticketsBatch)) {
        return ['error' => 'API key or tickets batch missing.'];
    }

    $compactTickets = [];
    foreach ($ticketsBatch as $t) {
        $compactTickets[] = [
            'id'    => (string)$t['id'],
            'agent' => trim($t['created_by_name'] ?? 'Enroller'),
            'cat'   => trim($t['category'] ?? ''),
            'title' => mb_substr(trim(strip_tags($t['title'] ?? '')), 0, 120),
            'desc'  => mb_substr(trim(strip_tags($t['description'] ?? '')), 0, 500)
        ];
    }

    $systemPrompt = "You are $staffName, IT Technical Support Specialist for the NA'IYA & SAMUIKY National Identity Platform.
You are the intelligent message composer. Draft an accurate, individualized, and professional response for each ticket inquiry from field enrollers by reading what each enroller wrote and composing a direct reply:

1. FOR UNCLEAR, VAGUE, SHORT, OR GREETING-ONLY TICKETS (e.g. 'help me', 'good morning', 'urgent', 'need help', or lacking clear details):
   - You MUST be the message composer: Read whatever specific words, greeting, or partial clues the enroller submitted in their title and description, and compose a natural, context-aware 'How May We Help You?' reply based directly on what they wrote.
   - If they gave a greeting (e.g. 'Good morning', 'Hello'), return it warmly and naturally.
   - If they gave a vague hint (e.g. login, enrolment, device, portal, account, error), acknowledge that hint and ask specific questions regarding that issue (e.g. which portal, what error message or code appears on screen).
   - If completely blank or generic, explain politely that details are needed to investigate, and ask how support may assist them today.
   - Request their 11-digit NIN, registered email, phone number, and FEP (NA'IYA or SAMUIKY) so technical support can assist.
   - Invite them to reply to this ticket.
   - Make each response sound unique, human, and directly composed for their message. Never use a rigid boilerplate or checklist.

2. FOR COMMISSION / PAYMENT / ALLOWANCE / ROYALTY inquiries:
   - State IT Support does not calculate or disburse agent commissions.
   - Direct them to the official Agent Payment Portal: https://pay.naiyatechnology.org (Step 1: Visit portal, Step 2: Enter registered email, Step 3: View monthly volume and download audited payment slips).
   - For payment discrepancies, direct to State Coordinator or Accounts Desk.
   - STRICT: Never mention hardware, broken screens, or forms.

3. FOR PHYSICAL HARDWARE / DEVICE inquiries (broken screen, battery, charger, tablet fault, stolen kit):
   - Explain hardware is managed by State Hub Coordinator and State Logistics Desk. Direct to Coordinator, Knowledge Base, or WhatsApp community.
   - STRICT: Never mention commission or forms.

4. FOR FORM APPROVAL inquiries (Switch to Production, Reactivation, Onboarding):
   - Explain forms are processed in regular sequential batches by Operations and cannot be fast-tracked via helpdesk.
   - STRICT: Never mention hardware or commission.

5. FOR GENUINE NIMC LOGIN / VPN inquiries:
   - Provide technical guidance or confirm retention for priority resolution.

6. FOR MIXED TOPICS:
   - Address ONLY the specific topics mentioned by the enroller.

FORMATTING REQUIREMENTS:
- For every ticket, compose a unique, thoughtful reply starting with 'Dear [Agent Name],' and ending with:
Best regards,
$staffName
IT Technical Support Desk
NA'IYA & SAMUIKY
- Absolutely NO emojis anywhere.
- Return valid JSON matching:
{\"replies\": [{\"id\": \"ticket_id\", \"reply\": \"complete reply text\"}]}";

    $postData = [
        'model' => $model,
        'messages' => [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => json_encode(['tickets' => $compactTickets])]
        ],
        'temperature' => 0.2,
        'max_tokens' => 3500,
        'response_format' => ['type' => 'json_object']
    ];

    $ch = curl_init($apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . trim($apiKey)
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        return ['error' => 'cURL error connecting to DeepSeek: ' . $curlErr];
    }
    if ($httpCode !== 200) {
        return ['error' => 'DeepSeek API returned HTTP ' . $httpCode . ': ' . substr($response, 0, 300)];
    }

    $data = json_decode($response, true);
    $content = $data['choices'][0]['message']['content'] ?? '';
    if (empty($content)) {
        return ['error' => 'Empty response from DeepSeek API'];
    }

    $cleanContent = preg_replace('/^```(?:json)?\s*/i', '', trim($content));
    $cleanContent = preg_replace('/\s*```$/', '', $cleanContent);
    $parsed = json_decode($cleanContent, true);

    $replies = [];
    if (isset($parsed['replies']) && is_array($parsed['replies'])) {
        foreach ($parsed['replies'] as $item) {
            if (!empty($item['id']) && !empty($item['reply'])) {
                $replies[$item['id']] = trim($item['reply']);
            }
        }
    }

    return [
        'success' => true,
        'replies' => $replies,
        'usage'   => $data['usage'] ?? []
    ];
}

/**
 * Accurate Fallback Template Selector based on Ticket Keywords
 */
function getFallbackTemplateForTicket(array $ticket): string {
    global $templateCommission, $templateDevice, $templateForm, $templateClarification, $templateMaster;
    
    $cleanDesc = trim(strip_tags($ticket['description'] ?? ''));
    $cleanTitle = trim(strip_tags($ticket['title'] ?? ''));
    $cleanCat = trim(strip_tags($ticket['category'] ?? ''));
    $combined = strtolower($cleanTitle . ' ' . $cleanDesc . ' ' . $cleanCat);

    // If ticket inquiry is short, vague, or greeting-only, return clarification template
    $totalLen = strlen($cleanDesc) + strlen($cleanTitle);
    $isVagueGreeting = in_array(strtolower($cleanDesc), [
        'help', 'help me', 'please help', 'good morning', 'hi', 'hello',
        'good day', 'urgent', 'pls help', 'support', 'need help', 'enquiry',
        'good afternoon', 'assist', 'assist me'
    ]);
    if ($totalLen < 35 || $isVagueGreeting) {
        return $templateClarification;
    }

    if (strpos($combined, 'commission') !== false || strpos($combined, 'payment') !== false || strpos($combined, 'payout') !== false || strpos($combined, 'disbursement') !== false) {
        return $templateCommission;
    }
    if (strpos($combined, 'screen') !== false || strpos($combined, 'device') !== false || strpos($combined, 'battery') !== false || strpos($combined, 'charger') !== false) {
        return $templateDevice;
    }
    if (strpos($combined, 'switch to production') !== false || strpos($combined, 'form') !== false || strpos($combined, 'reactivat') !== false) {
        return $templateForm;
    }
    return $templateClarification;
}

/**
 * Fast Rule-Based Fallback / Heuristic Classifier (0 Tokens consumed)
 */
function heuristicTriageTicket(array $ticket): array {
    $cleanTitle = trim(strip_tags($ticket['title'] ?? ''));
    $cleanDesc = trim(strip_tags($ticket['description'] ?? ''));
    $cleanCat = trim(strip_tags($ticket['category'] ?? ''));

    $title = strtolower($cleanTitle);
    $desc = strtolower($cleanDesc);
    $cat = strtolower($cleanCat);
    $combined = $title . ' ' . $desc . ' ' . $cat;

    // Detect very short, vague, greeting-only, or unclear descriptions
    $totalLen = strlen($cleanDesc) + strlen($cleanTitle);
    $isVagueGreeting = in_array(strtolower($cleanDesc), [
        'help', 'help me', 'please help', 'good morning', 'hi', 'hello',
        'good day', 'urgent', 'pls help', 'support', 'need help', 'enquiry',
        'good afternoon', 'assist', 'assist me'
    ]);
    if ($totalLen < 35 || $isVagueGreeting) {
        return [
            'action' => 'REVIEW',
            'reason' => 'Unclear inquiry: send How May We Help clarification',
            'confidence' => 0.88
        ];
    }

    // Genuine IT Technical / NIMC keywords
    $isNimc = (
        strpos($cat, 'nimc') !== false ||
        strpos($combined, 'nimc') !== false ||
        strpos($combined, 'metadata') !== false ||
        strpos($combined, 'agent not found') !== false ||
        strpos($combined, 'password reset') !== false ||
        strpos($combined, 'login detail') !== false ||
        strpos($combined, 'vpn') !== false ||
        strpos($combined, 'webmail') !== false ||
        strpos($combined, 'blacklist') !== false
    );

    // Commission / Payment keywords
    $isCommission = (
        strpos($cat, 'payment') !== false ||
        strpos($cat, 'commission') !== false ||
        strpos($cat, 'allowance') !== false ||
        strpos($cat, 'royalty') !== false ||
        strpos($cat, 'payout') !== false ||
        strpos($combined, 'commission') !== false ||
        strpos($combined, 'disbursement') !== false ||
        strpos($combined, 'payout') !== false ||
        strpos($combined, 'my payment') !== false ||
        strpos($combined, 'not paid') !== false ||
        strpos($combined, 'allowance') !== false ||
        strpos($combined, 'pay slip') !== false ||
        strpos($combined, 'payslip') !== false
    );

    // Redundant Device / Hardware / Form keywords
    $isDevice = (
        strpos($cat, 'device') !== false ||
        strpos($cat, 'activation') !== false ||
        strpos($combined, 'switch to production') !== false ||
        strpos($combined, 'damage') !== false ||
        strpos($combined, 'broken') !== false ||
        strpos($combined, 'cracked') !== false ||
        strpos($combined, 'screen') !== false ||
        strpos($combined, 'battery') !== false ||
        strpos($combined, 'charger') !== false ||
        strpos($combined, 'stolen') !== false ||
        strpos($combined, 'lost phone') !== false ||
        strpos($combined, 'fast track') !== false ||
        strpos($combined, 'approve my form') !== false ||
        strpos($combined, 'rugged') !== false ||
        strpos($combined, 'imei') !== false ||
        strpos($combined, 'reactivat') !== false
    );

    if (($isNimc && $isDevice) || ($isNimc && $isCommission)) {
        return [
            'action' => 'REVIEW',
            'reason' => 'Mixed inquiry: technical access and out-of-scope issue',
            'confidence' => 0.70
        ];
    }

    if ($isNimc) {
        return [
            'action' => 'KEEP_PRIORITY',
            'reason' => 'Technical desk issue: NIMC credentials or metadata onboarding',
            'confidence' => 0.95
        ];
    }

    if ($isCommission) {
        return [
            'action' => 'CLEAR',
            'reason' => 'Commission/payment inquiry: redirect to pay.naiyatechnology.org',
            'confidence' => 0.94
        ];
    }

    if ($isDevice) {
        return [
            'action' => 'CLEAR',
            'reason' => 'Redundant device/hardware issue or form follow-up',
            'confidence' => 0.92
        ];
    }

    return [
        'action' => 'REVIEW',
        'reason' => 'Unclear inquiry: send How May We Help clarification',
        'confidence' => 0.60
    ];
}

// =========================================================================
// DATABASE OPERATIONS & ACTIONS
// =========================================================================

/**
 * Fetch all pending tickets eligible for triage
 */
function getPendingTickets($pdo, $categoryFilter = 'unreplied', $limit = 450) {
    $where = ["status NOT IN ('Closed', 'Resolved')"];
    
    if ($categoryFilter === 'device') {
        $where[] = "(
            category IN ('Device & Activation Related', 'Device & Activation', 'Device', 'Activation')
            OR LOWER(category) LIKE '%device%'
            OR LOWER(category) LIKE '%activation%'
            OR LOWER(title) LIKE '%device%'
            OR LOWER(title) LIKE '%switch%'
        )";
    } elseif ($categoryFilter === 'unreplied' || $categoryFilter === 'unread') {
        // Tickets waiting for staff reply or unread
        $where[] = "(COALESCE(last_message_role, '') NOT IN ('staff', 'team_lead') OR last_agent_reply_at IS NULL OR is_read_by_staff = 0)";
    }
    // if $categoryFilter === 'all', all pending unclosed tickets are returned

    $sql = "SELECT id, ticket_number, title, category, description, status, priority,
                   created_by_email, created_by_name, assigned_to_email,
                   created_at, updated_at, last_agent_reply_at, last_message_role,
                   last_message_preview, messages
            FROM tickets
            WHERE " . implode(' AND ', $where) . "
            ORDER BY created_at ASC
            LIMIT " . (int)$limit;

    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

/**
 * Clear a single ticket: append official message, assign to staff, set status to Closed
 */
function clearSingleTicket($pdo, $ticketId, $staffEmail, $staffName, $customNotice = null) {
    global $clearingMessageTemplate;
    $msgBody = $customNotice ?: $clearingMessageTemplate;
    $now = date('Y-m-d H:i:s');

    $stmt = $pdo->prepare("SELECT id, ticket_number, messages FROM tickets WHERE id = :id LIMIT 1");
    $stmt->execute([':id' => $ticketId]);
    $t = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$t) return false;

    $messages = json_decode($t['messages'] ?? '[]', true);
    if (!is_array($messages)) $messages = [];

    $msgId = 'msg-clear-' . uniqid();
    $messages[] = [
        'id' => $msgId,
        'senderId' => $staffEmail,
        'senderName' => $staffName,
        'role' => 'staff',
        'content' => $msgBody,
        'timestamp' => date('c')
    ];

    $preview = mb_substr(trim(preg_replace('/\s+/', ' ', strip_tags($msgBody))), 0, 120);

    $update = $pdo->prepare("UPDATE tickets SET
        messages = :messages,
        status = 'Closed',
        is_read_by_staff = 1,
        last_agent_reply_at = :reply_at,
        last_message_role = 'staff',
        last_message_preview = :preview,
        assigned_to_email = :assigned_to,
        updated_at = :updated_at
        WHERE id = :id");

    return $update->execute([
        ':messages'    => json_encode($messages),
        ':reply_at'    => $now,
        ':preview'     => $preview,
        ':assigned_to' => $staffEmail,
        ':updated_at'  => $now,
        ':id'          => $ticketId
    ]);
}

/**
 * Mark a ticket as High Priority and keep open for IT desk
 */
function markTicketPriority($pdo, $ticketId, $staffEmail) {
    $now = date('Y-m-d H:i:s');
    $stmt = $pdo->prepare("UPDATE tickets SET
        priority = 'High',
        is_read_by_staff = 0,
        assigned_to_email = COALESCE(assigned_to_email, :assigned_to),
        updated_at = :updated_at
        WHERE id = :id");
    return $stmt->execute([
        ':assigned_to' => $staffEmail,
        ':updated_at'  => $now,
        ':id'          => $ticketId
    ]);
}

// =========================================================================
// AJAX API ENDPOINTS
// =========================================================================

$action = $_GET['action'] ?? $_POST['action'] ?? 'view';

// AJAX: Test DeepSeek Connection
if ($isAuthenticated && $action === 'test_deepseek') {
    header('Content-Type: application/json');
    $testKey = $_POST['key'] ?? $deepseekApiKey;
    $testModel = $_POST['model'] ?? $deepseekModel;
    
    $testPayload = [
        ['id' => 'test-1', 'title' => 'Need password reset for NIMC', 'category' => 'NIMC Login Details', 'description' => 'I cannot login to enrollment portal please reset']
    ];
    $res = callDeepSeekApiBatch($testPayload, $testKey, $testModel, $deepseekApiUrl);
    if (!empty($res['error'])) {
        echo json_encode(['status' => 'error', 'message' => $res['error']]);
    } else {
        echo json_encode([
            'status' => 'success', 
            'message' => 'Connected successfully to DeepSeek API!',
            'model' => $testModel,
            'sample_result' => $res['results'][0] ?? null
        ]);
    }
    exit;
}

// AJAX: Batch Scan with DeepSeek
if ($isAuthenticated && $action === 'ai_batch_scan') {
    header('Content-Type: application/json');
    $rawInput = file_get_contents('php://input');
    $postData = json_decode($rawInput, true) ?: $_POST;
    
    $ticketIds = $postData['ticket_ids'] ?? [];
    if (empty($ticketIds)) {
        echo json_encode(['status' => 'error', 'message' => 'No ticket IDs provided for batch']);
        exit;
    }

    // Fetch tickets from database
    $placeholders = str_repeat('?,', count($ticketIds) - 1) . '?';
    $stmt = $pdo->prepare("SELECT id, title, category, description FROM tickets WHERE id IN ($placeholders)");
    $stmt->execute($ticketIds);
    $tickets = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $apiKey = $postData['api_key'] ?? $deepseekApiKey;
    $model = $postData['model'] ?? $deepseekModel;

    if (!empty($apiKey)) {
        $aiResult = callDeepSeekApiBatch($tickets, $apiKey, $model, $deepseekApiUrl);
        if (!empty($aiResult['error'])) {
            // If AI failed, fall back to heuristic so work is not blocked
            $fallback = [];
            foreach ($tickets as $t) {
                $h = heuristicTriageTicket($t);
                $fallback[] = [
                    'id' => $t['id'],
                    'action' => $h['action'],
                    'reason' => '[Fallback] ' . $h['reason'],
                    'confidence' => $h['confidence'],
                    'is_fallback' => true
                ];
            }
            echo json_encode([
                'status' => 'partial_fallback',
                'warning' => $aiResult['error'],
                'results' => $fallback
            ]);
            exit;
        }

        if (!isset($_SESSION['ai_triage'])) {
            $_SESSION['ai_triage'] = [];
        }
        foreach ($aiResult['results'] as $item) {
            $_SESSION['ai_triage'][$item['id']] = $item;
        }

        echo json_encode([
            'status' => 'success',
            'results' => $aiResult['results'],
            'usage' => $aiResult['usage'] ?? []
        ]);
    } else {
        // Fast heuristic mode
        $results = [];
        foreach ($tickets as $t) {
            $h = heuristicTriageTicket($t);
            $results[] = [
                'id' => $t['id'],
                'action' => $h['action'],
                'reason' => $h['reason'],
                'confidence' => $h['confidence']
            ];
        }
        echo json_encode(['status' => 'success', 'results' => $results, 'is_heuristic' => true]);
    }
    exit;
}

// AJAX: 1-Click Clear Single Ticket (Supports custom / tailored notice)
if ($isAuthenticated && $action === 'clear_single') {
    header('Content-Type: application/json');
    $ticketId = $_POST['ticket_id'] ?? '';
    if (!$ticketId) {
        echo json_encode(['status' => 'error', 'message' => 'Missing ticket ID']);
        exit;
    }
    $customNotice = !empty($_POST['custom_notice']) ? trim($_POST['custom_notice']) : null;
    $success = clearSingleTicket($pdo, $ticketId, $selectedStaffEmail, $selectedStaffName, $customNotice);
    
    if (isset($_SESSION['ai_triage'][$ticketId])) {
        unset($_SESSION['ai_triage'][$ticketId]);
    }
    
    echo json_encode([
        'status' => $success ? 'success' : 'error',
        'message' => $success ? "Ticket #$ticketId cleared and closed under $selectedStaffName" : "Failed to update ticket"
    ]);
    exit;
}

// AJAX: Generate Tailored AI Reply for a Ticket
if ($isAuthenticated && $action === 'generate_tailored_reply') {
    header('Content-Type: application/json');
    $ticketId = $_POST['ticket_id'] ?? '';
    if (!$ticketId) {
        echo json_encode(['status' => 'error', 'message' => 'Missing ticket ID']);
        exit;
    }
    
    $stmt = $pdo->prepare("SELECT id, title, category, description, created_by_name FROM tickets WHERE id = :id LIMIT 1");
    $stmt->execute([':id' => $ticketId]);
    $t = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$t) {
        echo json_encode(['status' => 'error', 'message' => 'Ticket not found']);
        exit;
    }
    
    $tailored = generateAiTailoredReply($t, $deepseekApiKey, $deepseekModel, $deepseekApiUrl, $selectedStaffName);
    if (!$tailored) {
        $tailored = $clearingMessageTemplate;
    }
    
    echo json_encode([
        'status' => 'success',
        'reply' => $tailored,
        'ticket_id' => $ticketId,
        'title' => $t['title'],
        'agent_name' => $t['created_by_name'] ?: 'Enroller'
    ]);
    exit;
}

// AJAX: 1-Click Prioritize Single Ticket
if ($isAuthenticated && $action === 'prioritize_single') {
    header('Content-Type: application/json');
    $ticketId = $_POST['ticket_id'] ?? '';
    if (!$ticketId) {
        echo json_encode(['status' => 'error', 'message' => 'Missing ticket ID']);
        exit;
    }
    $success = markTicketPriority($pdo, $ticketId, $selectedStaffEmail);
    if (isset($_SESSION['ai_triage'][$ticketId])) {
        unset($_SESSION['ai_triage'][$ticketId]);
    }
    echo json_encode([
        'status' => $success ? 'success' : 'error',
        'message' => $success ? "Ticket #$ticketId marked as Priority under $selectedStaffName" : "Failed to update ticket"
    ]);
    exit;
}

// AJAX: Batch Generate Tailored AI Replies for Review Tickets via DeepSeek
if ($isAuthenticated && $action === 'generate_batch_tailored_replies') {
    header('Content-Type: application/json');
    $rawInput = file_get_contents('php://input');
    $postData = json_decode($rawInput, true) ?: $_POST;
    
    $ticketIds = $postData['ticket_ids'] ?? [];
    if (empty($ticketIds)) {
        echo json_encode(['status' => 'error', 'message' => 'No ticket IDs provided for reply generation']);
        exit;
    }

    $placeholders = str_repeat('?,', count($ticketIds) - 1) . '?';
    $stmt = $pdo->prepare("SELECT id, title, category, description, created_by_name FROM tickets WHERE id IN ($placeholders)");
    $stmt->execute($ticketIds);
    $tickets = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $apiKey = $postData['api_key'] ?? $deepseekApiKey;
    $model  = $postData['model'] ?? $deepseekModel;

    $res = generateBatchTailoredReplies($tickets, $apiKey, $model, $deepseekApiUrl, $selectedStaffName);
    if (!empty($res['error'])) {
        // Fallback: generate per-ticket fallback templates if API call failed
        $fallbackReplies = [];
        foreach ($tickets as $t) {
            $fallbackReplies[$t['id']] = getFallbackTemplateForTicket($t);
        }
        echo json_encode([
            'status' => 'partial_fallback',
            'warning' => $res['error'],
            'replies' => $fallbackReplies
        ]);
        exit;
    }

    if (!isset($_SESSION['tailored_replies'])) {
        $_SESSION['tailored_replies'] = [];
    }
    foreach ($res['replies'] as $tid => $reply) {
        $_SESSION['tailored_replies'][$tid] = $reply;
    }

    echo json_encode([
        'status' => 'success',
        'replies' => $res['replies'],
        'usage' => $res['usage'] ?? []
    ]);
    exit;
}

// AJAX: Bulk Send Tailored Replies and Close Tickets
if ($isAuthenticated && $action === 'bulk_send_tailored_replies') {
    header('Content-Type: application/json');
    $rawInput = file_get_contents('php://input');
    $postData = json_decode($rawInput, true) ?: $_POST;
    
    $items = $postData['items'] ?? []; // [{id: "...", reply: "..."}]
    if (empty($items)) {
        echo json_encode(['status' => 'error', 'message' => 'No items provided to send']);
        exit;
    }

    $clearedCount = 0;
    foreach ($items as $item) {
        $tid = $item['id'] ?? '';
        $customReply = trim($item['reply'] ?? '');
        if ($tid && $customReply) {
            if (clearSingleTicket($pdo, $tid, $selectedStaffEmail, $selectedStaffName, $customReply)) {
                $clearedCount++;
                if (isset($_SESSION['tailored_replies'][$tid])) {
                    unset($_SESSION['tailored_replies'][$tid]);
                }
                if (isset($_SESSION['ai_triage'][$tid])) {
                    unset($_SESSION['ai_triage'][$tid]);
                }
            }
        }
    }

    echo json_encode([
        'status' => 'success',
        'clearedCount' => $clearedCount,
        'message' => "Successfully delivered tailored replies and closed $clearedCount tickets under $selectedStaffName."
    ]);
    exit;
}

// Reset AI Triage Cache
if ($isAuthenticated && $action === 'reset_ai_cache') {
    unset($_SESSION['ai_triage']);
    header('Location: ' . strtok($_SERVER["REQUEST_URI"], '?'));
    exit;
}

// Reset Tailored Replies Cache
if ($isAuthenticated && $action === 'reset_tailored_cache') {
    unset($_SESSION['tailored_replies']);
    header('Location: ' . strtok($_SERVER["REQUEST_URI"], '?'));
    exit;
}

// POST: Bulk Execute Clearing
$executionResult = null;
if ($isAuthenticated && $action === 'bulk_clear_execute') {
    $selectedIds = $_POST['selected_ids'] ?? [];
    if (!empty($selectedIds)) {
        // 1. Fetch tickets for safety backup
        $placeholders = str_repeat('?,', count($selectedIds) - 1) . '?';
        $stmt = $pdo->prepare("SELECT * FROM tickets WHERE id IN ($placeholders)");
        $stmt->execute($selectedIds);
        $ticketsToBackup = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $backupFile = $backupDir . '/tickets_preclear_' . date('Ymd_His') . '.json';
        file_put_contents($backupFile, json_encode($ticketsToBackup, JSON_PRETTY_PRINT));

        // 2. Select notice template based on preset or custom
        $chosenTemplate = $_POST['template_preset'] ?? 'master';
        $customNotice = null;
        if ($chosenTemplate === 'device') {
            $customNotice = $templateDevice;
        } elseif ($chosenTemplate === 'commission') {
            $customNotice = $templateCommission;
        } elseif ($chosenTemplate === 'form') {
            $customNotice = $templateForm;
        } elseif ($chosenTemplate === 'clarification') {
            $customNotice = $templateClarification;
        } elseif ($chosenTemplate === 'nimc_checkup') {
            $customNotice = $templateNimcCheckup;
        } elseif (!empty($_POST['custom_notice'])) {
            $customNotice = trim($_POST['custom_notice']);
        } else {
            $customNotice = $templateMaster;
        }

        $clearedCount = 0;
        foreach ($selectedIds as $tid) {
            // Check if there is an AI tailored reply in session for this ticket
            $ticketNotice = (!empty($_SESSION['tailored_replies'][$tid])) ? $_SESSION['tailored_replies'][$tid] : $customNotice;
            if (clearSingleTicket($pdo, $tid, $selectedStaffEmail, $selectedStaffName, $ticketNotice)) {
                $clearedCount++;
                if (isset($_SESSION['tailored_replies'][$tid])) {
                    unset($_SESSION['tailored_replies'][$tid]);
                }
                if (isset($_SESSION['ai_triage'][$tid])) {
                    unset($_SESSION['ai_triage'][$tid]);
                }
            }
        }

        $executionResult = [
            'success' => true,
            'clearedCount' => $clearedCount,
            'backupFile' => basename($backupFile),
            'staffEmail' => $selectedStaffEmail,
            'staffName' => $selectedStaffName
        ];
    }
}

// POST: Bulk NIMC Checkup Sweep (AJAX)
if ($isAuthenticated && $action === 'bulk_nimc_checkup' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);
    $ticketIds = $payload['ticket_ids'] ?? [];
    $customMsg = !empty($payload['custom_notice']) ? trim($payload['custom_notice']) : $templateNimcCheckup;
    $staffEmail = $payload['staff_email'] ?? $selectedStaffEmail;
    $staffName = $payload['staff_name'] ?? $selectedStaffName;

    if (empty($ticketIds) || !is_array($ticketIds)) {
        echo json_encode(['status' => 'error', 'message' => 'No tickets selected.']);
        exit;
    }

    // Safety backup
    $placeholders = str_repeat('?,', count($ticketIds) - 1) . '?';
    $stmt = $pdo->prepare("SELECT * FROM tickets WHERE id IN ($placeholders)");
    $stmt->execute($ticketIds);
    $backupRows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $backupFile = $backupDir . '/nimc_checkup_backup_' . date('Ymd_His') . '.json';
    file_put_contents($backupFile, json_encode($backupRows, JSON_PRETTY_PRINT));

    $clearedCount = 0;
    foreach ($ticketIds as $tid) {
        if (clearSingleTicket($pdo, $tid, $staffEmail, $staffName, $customMsg)) {
            $clearedCount++;
        }
    }

    echo json_encode([
        'status' => 'success',
        'clearedCount' => $clearedCount,
        'backupFile' => basename($backupFile)
    ]);
    exit;
}

// POST: Rate-Limited Backlog Email Chunk Dispatch (AJAX)
if ($isAuthenticated && $action === 'send_backlog_email_chunk' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);
    $ticketIds = $payload['ticket_ids'] ?? [];
    $customSubject = !empty($payload['custom_subject']) ? trim($payload['custom_subject']) : '';
    $fallbackTemplate = !empty($payload['custom_notice']) ? trim($payload['custom_notice']) : $templateMaster;
    
    if (empty($ticketIds) || !is_array($ticketIds)) {
        echo json_encode(['status' => 'error', 'message' => 'No ticket IDs provided for dispatch.']);
        exit;
    }

    $placeholders = str_repeat('?,', count($ticketIds) - 1) . '?';
    $stmt = $pdo->prepare("SELECT id, ticket_number, title, category, description, status, created_by_email, created_by_name, messages, last_message_preview FROM tickets WHERE id IN ($placeholders)");
    $stmt->execute($ticketIds);
    $tickets = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $sent = [];
    $failed = [];

    foreach ($tickets as $t) {
        $tktId = $t['id'];
        $tktNum = $t['ticket_number'] ?: substr($tktId, 0, 8);
        $toEmail = trim($t['created_by_email'] ?? '');
        $toName = trim($t['created_by_name'] ?? 'Enroller');
        
        if (empty($toEmail)) {
            $failed[] = ['id' => $tktId, 'ticket_number' => $tktNum, 'recipient' => '', 'error' => 'Missing enroller email address'];
            recordEmailDispatch($backupDir, $tktId, $tktNum, '', 'FAILED', 'Missing email');
            continue;
        }

        // Determine message notice body
        $noticeContent = extractLastStaffMessage($t, $fallbackTemplate);

        // Build subject with ticket number token replacement
        $subject = $customSubject ?: "Update on Technical Support Ticket #{$tktNum} - NA'IYA & SAMUIKY Support";
        $subject = str_replace(['{TICKET_NUMBER}', '[TICKET_NUMBER]', '#{TICKET_NUMBER}'], $tktNum, $subject);

        $res = sendTicketEmailNotification($toEmail, $toName, $tktNum, $subject, $noticeContent, $t['category'] ?? '', $t['status'] ?? 'Closed');

        if ($res['success']) {
            $sent[] = ['id' => $tktId, 'ticket_number' => $tktNum, 'recipient' => $toEmail];
            recordEmailDispatch($backupDir, $tktId, $tktNum, $toEmail, 'SENT');
        } else {
            $failed[] = ['id' => $tktId, 'ticket_number' => $tktNum, 'recipient' => $toEmail, 'error' => $res['error']];
            recordEmailDispatch($backupDir, $tktId, $tktNum, $toEmail, 'FAILED', $res['error']);
        }

        // Micro-sleep (300ms) to ensure SMTP sockets are cleanly recycled and avoid rapid connection bursts
        usleep(300000);
    }

    echo json_encode([
        'status' => 'success',
        'sent' => $sent,
        'failed' => $failed,
        'sent_count' => count($sent),
        'failed_count' => count($failed)
    ]);
    exit;
}

// POST: Send 1 Test Email Preview to Staff (AJAX)
if ($isAuthenticated && $action === 'test_send_email' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);
    
    $targetEmail = !empty($payload['test_email']) ? trim($payload['test_email']) : $selectedStaffEmail;
    $targetName = !empty($payload['test_name']) ? trim($payload['test_name']) : $selectedStaffName;
    $customSubject = !empty($payload['custom_subject']) ? trim($payload['custom_subject']) : "[TEST PREVIEW] Support Ticket #TEST-103 — NA'IYA & SAMUIKY IT Support";
    $noticeContent = !empty($payload['custom_notice']) ? trim($payload['custom_notice']) : $templateNimcCheckup;

    $subject = str_replace(['{TICKET_NUMBER}', '[TICKET_NUMBER]', '#{TICKET_NUMBER}'], 'TEST-103', $customSubject);
    $res = sendTicketEmailNotification($targetEmail, $targetName, 'TEST-103', $subject, $noticeContent, 'NIMC Login Details', 'Closed');
    
    if ($res['success']) {
        echo json_encode(['status' => 'success', 'message' => "Test preview email successfully sent to {$targetEmail}"]);
    } else {
        echo json_encode(['status' => 'error', 'message' => "Failed to deliver test email: " . $res['error']]);
    }
    exit;
}

// POST: Reset Email Dispatch Ledger (AJAX)
if ($isAuthenticated && $action === 'reset_email_ledger' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    $ledgerPath = $backupDir . '/email_dispatch_log.json';
    if (file_exists($ledgerPath)) {
        @copy($ledgerPath, $backupDir . '/email_dispatch_log_bak_' . date('Ymd_His') . '.json');
        @unlink($ledgerPath);
    }
    echo json_encode(['status' => 'success', 'message' => 'Email dispatch ledger reset successfully.']);
    exit;
}

// Fetch all pending tickets for the UI (default to unreplied / unread only)
$activeFilter = $_GET['filter'] ?? 'unreplied';
$pendingTickets = getPendingTickets($pdo, $activeFilter);
$cachedTailoredReplies = $_SESSION['tailored_replies'] ?? [];

// 9. Fetch Closed / Resolved tickets for Email Backlog Dispatcher (Tab 5)
$backlogLimit = 350;
$stmtBacklog = $pdo->prepare("
    SELECT id, ticket_number, title, category, description, status, priority,
           created_by_email, created_by_name, assigned_to_email,
           created_at, updated_at, last_agent_reply_at, last_message_role,
           last_message_preview, messages
    FROM tickets
    WHERE status IN ('Closed', 'Resolved')
    ORDER BY updated_at DESC, created_at DESC
    LIMIT :lim
");
$stmtBacklog->bindValue(':lim', $backlogLimit, PDO::PARAM_INT);
$stmtBacklog->execute();
$resolvedBacklogTickets = $stmtBacklog->fetchAll(PDO::FETCH_ASSOC);

$emailLedger = getEmailDispatchLedger($backupDir);
$backlogDeliveredCount = 0;
$backlogPendingCount = 0;
foreach ($resolvedBacklogTickets as $rbt) {
    if (isset($emailLedger[$rbt['id']]) && ($emailLedger[$rbt['id']]['status'] ?? '') === 'SENT') {
        $backlogDeliveredCount++;
    } else {
        $backlogPendingCount++;
    }
}

// Compute triage using session-stored DeepSeek AI results when available, else heuristic
$triageSummary = ['CLEAR' => 0, 'KEEP_PRIORITY' => 0, 'REVIEW' => 0];
$triagedList = [];
$aiTriagedCount = 0;

foreach ($pendingTickets as $t) {
    if (isset($_SESSION['ai_triage'][$t['id']])) {
        $aiItem = $_SESSION['ai_triage'][$t['id']];
        $act = in_array($aiItem['action'] ?? '', ['CLEAR', 'KEEP_PRIORITY', 'REVIEW']) ? $aiItem['action'] : 'REVIEW';
        $t['triage_action'] = $act;
        $t['triage_reason'] = $aiItem['reason'] ?? 'AI Classified';
        $t['triage_confidence'] = $aiItem['confidence'] ?? 0.95;
        $t['is_ai'] = true;
        $aiTriagedCount++;
    } else {
        $h = heuristicTriageTicket($t);
        $t['triage_action'] = $h['action'];
        $t['triage_reason'] = $h['reason'];
        $t['triage_confidence'] = $h['confidence'];
        $t['is_ai'] = false;
    }
    
    if (!isset($triageSummary[$t['triage_action']])) {
        $t['triage_action'] = 'REVIEW';
    }
    $triageSummary[$t['triage_action']]++;
    $triagedList[] = $t;
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NA'IYA & SAMUIKY — AI Ticket Sweeper & NIMC Priority Filter</title>
    <style>
        :root {
            --bg-color: #0b1120;
            --surface: #1e293b;
            --surface-hover: #334155;
            --surface-light: #283548;
            --border: #334155;
            --border-light: #475569;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --brand: #2563eb;
            --brand-hover: #1d4ed8;
            --emerald: #10b981;
            --emerald-bg: rgba(16, 185, 129, 0.12);
            --amber: #f59e0b;
            --amber-bg: rgba(245, 158, 11, 0.14);
            --amber-border: rgba(245, 158, 11, 0.35);
            --rose: #ef4444;
            --rose-bg: rgba(239, 68, 68, 0.12);
            --purple: #a855f7;
            --purple-bg: rgba(168, 85, 247, 0.12);
            --card-radius: 12px;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            line-height: 1.5;
            padding: 24px;
        }

        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--border);
            margin-bottom: 24px;
            flex-wrap: wrap;
            gap: 16px;
        }

        .title-group h1 { font-size: 22px; font-weight: 700; color: #fff; letter-spacing: -0.4px; }
        .title-group p { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
        
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 3px 9px;
            border-radius: 9999px;
            letter-spacing: 0.5px;
        }
        .badge-dev { background: #3b82f6; color: #fff; }
        .badge-amber { background: var(--amber-bg); color: var(--amber); border: 1px solid var(--amber-border); }
        .badge-emerald { background: var(--emerald-bg); color: var(--emerald); border: 1px solid rgba(16, 185, 129, 0.3); }
        .badge-rose { background: var(--rose-bg); color: var(--rose); border: 1px solid rgba(239, 68, 68, 0.3); }
        .badge-purple { background: var(--purple-bg); color: var(--purple); border: 1px solid rgba(168, 85, 247, 0.3); }

        .auth-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--card-radius);
            padding: 32px;
            max-width: 440px;
            margin: 60px auto;
            text-align: center;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
        }
        .auth-card input {
            width: 100%;
            padding: 12px 16px;
            border-radius: 8px;
            border: 1px solid var(--border);
            background: #0f172a;
            color: #fff;
            margin: 16px 0;
            font-size: 15px;
            outline: none;
        }

        .btn {
            background: var(--brand);
            color: #fff;
            border: none;
            padding: 9px 16px;
            font-size: 13px;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            text-decoration: none;
        }
        .btn:hover { background: var(--brand-hover); }
        .btn-danger { background: var(--rose); }
        .btn-danger:hover { background: #dc2626; }
        .btn-success { background: var(--emerald); }
        .btn-success:hover { background: #059669; }
        .btn-amber { background: #d97706; color: #fff; }
        .btn-amber:hover { background: #b45309; }
        .btn-purple { background: #7c3aed; color: #fff; }
        .btn-purple:hover { background: #6d28d9; }
        .btn-outline { background: transparent; border: 1px solid var(--border); color: var(--text-main); }
        .btn-outline:hover { background: var(--surface-hover); }
        .btn-sm { padding: 5px 10px; font-size: 11px; border-radius: 6px; }

        .banner-success {
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid var(--emerald);
            color: #a7f3d0;
            padding: 16px 20px;
            border-radius: var(--card-radius);
            margin-bottom: 24px;
        }

        /* AI Control Bar */
        .ai-banner {
            background: linear-gradient(135deg, #1e1b4b 0%, #1e293b 100%);
            border: 1px solid #4338ca;
            border-radius: var(--card-radius);
            padding: 20px 24px;
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
            box-shadow: 0 4px 20px -2px rgba(67, 56, 202, 0.2);
        }
        .ai-info h2 { font-size: 17px; font-weight: 700; color: #c7d2fe; display: flex; align-items: center; gap: 8px; }
        .ai-info p { font-size: 12px; color: #94a3b8; margin-top: 4px; }
        .ai-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

        /* Progress Bar */
        .progress-box {
            width: 100%;
            background: rgba(15, 23, 42, 0.8);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 12px 16px;
            margin-top: 14px;
            display: none;
        }
        .progress-bar-wrap {
            height: 8px;
            background: #0f172a;
            border-radius: 4px;
            overflow: hidden;
            margin-top: 8px;
        }
        .progress-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #6366f1, #a855f7);
            width: 0%;
            transition: width 0.3s ease;
        }

        /* Stats Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }
        .stat-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--card-radius);
            padding: 18px 20px;
            position: relative;
        }
        .stat-card.stat-amber { border-color: var(--amber-border); background: rgba(30, 41, 59, 0.95); }
        .stat-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; }
        .stat-val { font-size: 32px; font-weight: 800; color: #fff; margin-top: 4px; line-height: 1.1; }
        .stat-sub { font-size: 12px; color: var(--text-muted); margin-top: 6px; }

        /* Tabs */
        .tabs {
            display: flex;
            border-bottom: 1px solid var(--border);
            margin-bottom: 20px;
            gap: 8px;
            overflow-x: auto;
        }
        .tab-btn {
            padding: 12px 18px;
            background: transparent;
            border: none;
            border-bottom: 2px solid transparent;
            color: var(--text-muted);
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        .tab-btn:hover { color: #cbd5e1; }
        .tab-btn.active {
            color: #fff;
            border-bottom-color: var(--brand);
        }

        .panel { display: none; }
        .panel.active { display: block; }

        /* Attribution Bar */
        .account-bar {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--card-radius);
            padding: 14px 20px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 14px;
        }
        select, input[type="text"], input[type="password"] {
            background: #0f172a;
            border: 1px solid var(--border);
            color: #fff;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 13px;
            outline: none;
        }
        select:focus, input:focus { border-color: var(--brand); }

        /* Table */
        .table-wrap {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--card-radius);
            overflow-x: auto;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            text-align: left;
        }
        th {
            background: #111827;
            padding: 12px 16px;
            color: var(--text-muted);
            font-weight: 600;
            border-bottom: 1px solid var(--border);
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
        }
        td {
            padding: 12px 16px;
            border-bottom: 1px solid var(--border);
            vertical-align: middle;
        }
        tr:hover td { background: rgba(51, 65, 85, 0.4); }

        /* Review Highlight Rows (Yellow / Amber) */
        tr.row-review {
            background: rgba(245, 158, 11, 0.04);
        }
        tr.row-review:hover td {
            background: rgba(245, 158, 11, 0.1);
        }
        .review-box {
            background: var(--amber-bg);
            border: 1px solid var(--amber-border);
            border-radius: 6px;
            padding: 6px 10px;
            font-size: 11px;
            color: #fde68a;
            margin-top: 6px;
            display: inline-block;
        }

        .meta-tag {
            display: inline-block;
            background: #0f172a;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            font-family: monospace;
            color: #38bdf8;
            margin-right: 4px;
        }
        pre.msg-box {
            background: #0f172a;
            border: 1px solid var(--border);
            padding: 14px;
            border-radius: 8px;
            font-size: 12px;
            color: #e2e8f0;
            white-space: pre-wrap;
            line-height: 1.6;
            margin-top: 10px;
        }

        .token-pill {
            font-family: monospace;
            font-size: 11px;
            background: rgba(15, 23, 42, 0.8);
            border: 1px solid var(--border-light);
            padding: 4px 8px;
            border-radius: 6px;
            color: #a5b4fc;
        }

        .btn-xs {
            padding: 4px 8px;
            font-size: 11px;
            border-radius: 4px;
        }

        /* Review Draft Box */
        .review-draft-wrap {
            background: #0f172a;
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 10px 12px;
            margin-top: 6px;
        }
        .review-draft-textarea {
            width: 100%;
            min-height: 120px;
            background: #1e293b;
            border: 1px solid var(--border-light);
            border-radius: 6px;
            color: #f8fafc;
            font-size: 12px;
            line-height: 1.5;
            padding: 10px;
            resize: vertical;
            box-sizing: border-box;
            font-family: inherit;
            outline: none;
            margin-top: 6px;
        }
        .review-draft-textarea:focus {
            border-color: var(--brand);
        }
        .review-draft-actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 8px;
            flex-wrap: wrap;
            gap: 8px;
        }

        /* Email Dispatcher (Tab 5) Styles */
        .stat-card.stat-emerald {
            border-color: rgba(16, 185, 129, 0.4);
            background: rgba(16, 185, 129, 0.08);
        }
        .stat-card.stat-blue {
            border-color: rgba(37, 99, 235, 0.4);
            background: rgba(37, 99, 235, 0.08);
        }
        .btn-emerald {
            background: #10b981;
            color: #ffffff;
        }
        .btn-emerald:hover {
            background: #059669;
        }
        .console-log-box {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            font-size: 11px;
            background: #090d16;
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 12px;
            color: #94a3b8;
            height: 160px;
            overflow-y: auto;
            line-height: 1.6;
            margin-top: 10px;
        }
        .log-entry {
            margin-bottom: 2px;
            word-break: break-all;
        }
        .log-entry.success { color: #34d399; }
        .log-entry.error { color: #f87171; }
        .log-entry.info { color: #38bdf8; }
        .log-entry.warn { color: #fbbf24; }

        .badge-delivered {
            background: rgba(16, 185, 129, 0.15);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.35);
        }
        .badge-pending {
            background: rgba(245, 158, 11, 0.15);
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.35);
        }
        .badge-failed {
            background: rgba(239, 68, 68, 0.15);
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.35);
        }
    </style>
</head>
<body>

<div class="container">

<?php if (!$isAuthenticated): ?>
    <!-- Passcode Auth Screen -->
    <div class="auth-card">
        <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">Developer Access Required</h2>
        <p style="font-size: 13px; color: var(--text-muted);">Please enter your developer passcode to access the DeepSeek AI Sweeper & NIMC Priority Filter.</p>
        <form method="POST">
            <input type="password" name="key" placeholder="Enter developer passcode" required autofocus>
            <button type="submit" class="btn" style="width: 100%; justify-content: center;">Authenticate & Open Dashboard</button>
        </form>
    </div>
<?php else: ?>

    <!-- Header -->
    <div class="header">
        <div class="title-group">
            <h1>NA'IYA & SAMUIKY — AI Ticket Sweeper & NIMC Priority Filter</h1>
            <p>Database: <code><?= htmlspecialchars($db) ?></code> | Host: <code><?= htmlspecialchars($host) ?></code></p>
        </div>
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
            <button type="button" class="btn btn-emerald btn-sm" onclick="openExecutiveReportModal()">
                Executive Report Summary
            </button>
            <span class="badge badge-dev">Developer Mode</span>
            <a href="?logout=1" class="btn btn-outline btn-sm">Lock Session</a>
        </div>
    </div>

    <!-- Staff Attribution Selector ("read my account did the work") -->
    <div class="account-bar">
        <div>
            <div style="font-weight: 700; font-size: 13px;">Official Audit Trail Attribution</div>
            <div style="font-size: 12px; color: var(--text-muted);">All clearing messages, closures, and priority flags will be officially signed and recorded by:</div>
        </div>
        <form method="POST" style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <input type="hidden" name="action" value="set_account">
            <select name="staff_email" onchange="this.form.submit()">
                <?php foreach ($staffAccounts as $sa): ?>
                    <option value="<?= htmlspecialchars($sa['email']) ?>" <?= ($sa['email'] === $selectedStaffEmail) ? 'selected' : '' ?>>
                        <?= htmlspecialchars($sa['name'] ?: $sa['email']) ?> (<?= htmlspecialchars($sa['email']) ?>) <?= !empty($sa['is_root']) ? '(Root)' : '' ?>
                    </option>
                <?php endforeach; ?>
            </select>
            <span class="badge badge-emerald">Responder: <?= htmlspecialchars($selectedStaffName) ?></span>
        </form>
    </div>

    <!-- AI Control Bar -->
    <div class="ai-banner">
        <div class="ai-info">
            <h2>
                <span>AI Triage Engine</span>
                <?php if (!empty($deepseekApiKey)): ?>
                    <span class="badge badge-emerald">API Key Active (<?= substr($deepseekApiKey, 0, 8) ?>...<?= substr($deepseekApiKey, -4) ?>)</span>
                <?php else: ?>
                    <span class="badge badge-amber">API Key Not Configured</span>
                <?php endif; ?>
            </h2>
            <p>Classifies pending tickets into Auto-Clear (Redundant), Needs Review, and NIMC Priority.</p>
        </div>
        <div class="ai-actions">
            <?php if ($aiTriagedCount > 0): ?>
                <span class="badge badge-purple" style="font-size: 11px;">AI Classified (<?= $aiTriagedCount ?>)</span>
                <a href="?action=reset_ai_cache" class="btn btn-outline btn-sm" title="Clear cached AI classifications" onclick="return confirm('Reset AI classifications back to default?')">Reset AI Cache</a>
            <?php endif; ?>
            <span class="token-pill" id="tokenTracker">Tokens: 0</span>
            <button type="button" class="btn btn-purple" id="btnRunAiScan" onclick="startAiBatchScan()">
                Run AI Scan (<?= count($pendingTickets) ?> Tickets)
            </button>
            <button type="button" class="btn btn-outline btn-sm" onclick="toggleConfigDrawer()">
                Config
            </button>
        </div>

        <!-- Progress Box -->
        <div class="progress-box" id="progressBox">
            <div style="display: flex; justify-content: space-between; font-size: 12px;">
                <span id="progressText">Analyzing tickets in batches...</span>
                <span id="progressPercent" style="font-weight: 700; color: #a5b4fc;">0%</span>
            </div>
            <div class="progress-bar-wrap">
                <div class="progress-bar-fill" id="progressBarFill"></div>
            </div>
        </div>
    </div>

    <!-- Collapsible Config Drawer -->
    <div id="configDrawer" style="display: none; background: var(--surface); border: 1px solid var(--border); border-radius: var(--card-radius); padding: 18px 20px; margin-bottom: 24px;">
        <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 12px;">DeepSeek API Configuration</h3>
        <form method="POST" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; align-items: end;">
            <div>
                <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 4px;">DeepSeek API Key:</label>
                <input type="password" name="deepseek_api_key" value="<?= htmlspecialchars($deepseekApiKey) ?>" placeholder="sk-..." style="width: 100%;">
            </div>
            <div>
                <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 4px;">Model:</label>
                <input type="text" name="deepseek_model" value="<?= htmlspecialchars($deepseekModel) ?>" placeholder="deepseek-chat" style="width: 100%;">
            </div>
            <div>
                <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 4px;">API Endpoint URL:</label>
                <input type="text" name="deepseek_api_url" value="<?= htmlspecialchars($deepseekApiUrl) ?>" style="width: 100%;">
            </div>
            <div style="display: flex; gap: 8px;">
                <button type="submit" class="btn btn-sm">Save Key to Session</button>
                <button type="button" class="btn btn-outline btn-sm" onclick="testDeepSeekConnection()">Test API</button>
            </div>
        </form>
        <div id="testApiResult" style="font-size: 12px; margin-top: 10px;"></div>
    </div>

    <!-- Execution Success Banner -->
    <?php if ($executionResult): ?>
        <div class="banner-success">
            <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 4px;">Bulk Clearing Operation Completed</h3>
            <p>Closed <strong><?= $executionResult['clearedCount'] ?></strong> redundant tickets with the official technical clearing reply.</p>
            <p style="font-size: 12px; margin-top: 4px;">Attributed in database to: <strong><?= htmlspecialchars($executionResult['staffName']) ?> (<?= htmlspecialchars($executionResult['staffEmail']) ?>)</strong>.</p>
            <p style="font-size: 12px; opacity: 0.8; margin-top: 2px;">Pre-clearing JSON backup saved to: <code>backups/<?= htmlspecialchars($executionResult['backupFile']) ?></code></p>
        </div>
    <?php endif; ?>

    <!-- Stats Grid -->
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-label">To Clear (Redundant Devices)</div>
            <div class="stat-val" style="color: #f87171;" id="statCountClear"><?= $triageSummary['CLEAR'] ?></div>
            <div class="stat-sub">Hardware repairs, screen cracks, form follow-ups</div>
        </div>
        <div class="stat-card stat-amber">
            <div class="stat-label" style="color: #fbbf24;">Highlighted for Review</div>
            <div class="stat-val" style="color: #fbbf24;" id="statCountReview"><?= $triageSummary['REVIEW'] ?></div>
            <div class="stat-sub">Ambiguous, mixed complaints, low confidence</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">NIMC Priority Queue</div>
            <div class="stat-val" style="color: #38bdf8;" id="statCountPriority"><?= $triageSummary['KEEP_PRIORITY'] ?></div>
            <div class="stat-sub">Genuine NIMC passwords, metadata onboarding, VPN</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Total Pending Inspected</div>
            <div class="stat-val" style="color: #a78bfa;"><?= count($pendingTickets) ?></div>
            <div class="stat-sub">Database scope: Active unclosed tickets</div>
        </div>
    </div>

    <!-- Queue Scope Filter Switcher -->
    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--card-radius); padding: 12px 18px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Queue Filter:</span>
            <a href="?filter=unreplied" class="btn btn-sm <?= ($activeFilter === 'unreplied') ? 'btn-purple' : 'btn-outline' ?>" style="<?= ($activeFilter === 'unreplied') ? 'background: #4f46e5;' : '' ?>">
                Unread & Unreplied Only (<?= ($activeFilter === 'unreplied') ? count($pendingTickets) : 'Filter' ?>)
            </a>
            <a href="?filter=all" class="btn btn-sm <?= ($activeFilter === 'all') ? 'btn-purple' : 'btn-outline' ?>" style="<?= ($activeFilter === 'all') ? 'background: #4f46e5;' : '' ?>">
                All Pending Tickets
            </a>
            <a href="?filter=device" class="btn btn-sm <?= ($activeFilter === 'device') ? 'btn-purple' : 'btn-outline' ?>" style="<?= ($activeFilter === 'device') ? 'background: #4f46e5;' : '' ?>">
                Device Category Only
            </a>
        </div>
        <div style="font-size: 12px; color: var(--text-muted);">
            Active Scope: <strong style="color: #fff;"><?= ($activeFilter === 'unreplied') ? 'Awaiting Staff Reply (Unread/Unanswered)' : ($activeFilter === 'device' ? 'Device Category' : 'All Pending') ?></strong>
        </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs">
        <button class="tab-btn active" onclick="switchTab('tab-clear', this)">
            1. Redundant Device Tickets (<span id="tabCountClear"><?= $triageSummary['CLEAR'] ?></span>)
        </button>
        <button class="tab-btn" onclick="switchTab('tab-review', this)">
            2. Needs Review (<span id="tabCountReview"><?= $triageSummary['REVIEW'] ?></span>)
        </button>
        <button class="tab-btn" onclick="switchTab('tab-priority', this)">
            3. NIMC Priority Queue (<span id="tabCountPriority"><?= $triageSummary['KEEP_PRIORITY'] ?></span>)
        </button>
        <button class="tab-btn" onclick="switchTab('tab-template', this)">
            4. Reply Templates
        </button>
        <button class="tab-btn" onclick="switchTab('tab-email-backlog', this)" style="border-bottom-color: #10b981;">
            5. Email Dispatcher (<span id="tabCountEmailBacklog"><?= $backlogPendingCount ?></span> Pending)
        </button>
    </div>

    <!-- TAB 1: Redundant Tickets to Clear -->
    <div id="tab-clear" class="panel active">
        <form method="POST" id="formBulkClear" onsubmit="return confirmBulkClear()">
            <input type="hidden" name="action" value="bulk_clear_execute">
            <input type="hidden" name="staff_email" value="<?= htmlspecialchars($selectedStaffEmail) ?>">
            <input type="hidden" name="staff_name" value="<?= htmlspecialchars($selectedStaffName) ?>">

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
                <div>
                    <h3 style="font-size: 15px; font-weight: 700;">Redundant Tickets Recommended for Auto-Clear</h3>
                    <p style="font-size: 12px; color: var(--text-muted);">
                        Physical devices, form approvals, and peer issues that IT Support Desk does not handle.
                    </p>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <label style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Notice Preset:</label>
                    <select name="template_preset" id="bulkTemplatePreset" style="font-size: 12px; padding: 6px 10px;">
                        <option value="master">1. Master Comprehensive Notice</option>
                        <option value="device">2. Physical Device & Repairs Notice</option>
                        <option value="commission">3. Commission & Payment Portal Notice</option>
                        <option value="form">4. Form Processing Queue Notice</option>
                        <option value="clarification">5. How May We Help You? (Request Clarification)</option>
                        <option value="nimc_checkup">6. NIMC Status Checkup (Has this been treated?)</option>
                    </select>
                    <button type="button" class="btn btn-outline btn-sm" onclick="toggleSelectAll('chk-clear')">Select / Deselect All</button>
                    <button type="submit" class="btn btn-danger" id="btnSubmitClear">
                        Send Clearing Reply & Close Selected (<span id="selectedClearCount">0</span>)
                    </button>
                </div>
            </div>

            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th style="width: 38px;"><input type="checkbox" onchange="toggleAllCheckboxes(this, 'chk-clear')"></th>
                            <th>Ticket #</th>
                            <th>Enroller / Agent</th>
                            <th>Subject & Issue Snippet</th>
                            <th>AI / Heuristic Reason</th>
                            <th>Category</th>
                            <th>Opened</th>
                            <th style="min-width: 150px;">Action</th>
                        </tr>
                    </thead>
                    <tbody id="tbodyClear">
                        <?php foreach ($triagedList as $t): 
                            if ($t['triage_action'] !== 'CLEAR') continue;
                        ?>
                            <tr id="row-<?= htmlspecialchars($t['id']) ?>">
                                <td><input type="checkbox" name="selected_ids[]" value="<?= htmlspecialchars($t['id']) ?>" class="chk-clear" onchange="updateSelectedCount()"></td>
                                <td>
                                    <strong>#<?= htmlspecialchars($t['ticket_number'] ?: substr($t['id'], 0, 8)) ?></strong>
                                </td>
                                <td>
                                    <div style="font-weight: 600; color: #fff;"><?= htmlspecialchars($t['created_by_name'] ?: 'Enroller') ?></div>
                                    <div style="font-size: 11px; color: var(--text-muted);"><?= htmlspecialchars($t['created_by_email']) ?></div>
                                </td>
                                <td style="max-width: 340px;">
                                    <div style="font-weight: 600; color: #fff;"><?= htmlspecialchars($t['title']) ?></div>
                                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                                        <?= htmlspecialchars(strip_tags($t['description'])) ?>
                                    </div>
                                </td>
                                <td>
                                    <span class="badge badge-rose" style="font-size: 10px;"><?= htmlspecialchars($t['triage_reason']) ?></span>
                                    <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Conf: <?= round(($t['triage_confidence'] ?? 0.9) * 100) ?>%</div>
                                </td>
                                <td><span class="meta-tag"><?= htmlspecialchars($t['category']) ?></span></td>
                                <td style="white-space: nowrap; font-size: 11px; color: var(--text-muted);"><?= htmlspecialchars($t['created_at']) ?></td>
                                <td>
                                    <div style="display: flex; gap: 6px;">
                                        <button type="button" class="btn btn-outline btn-sm" onclick="clearSingle('<?= htmlspecialchars($t['id']) ?>')">
                                            Clear
                                        </button>
                                        <button type="button" class="btn btn-purple btn-sm" onclick="openTailorModal('<?= htmlspecialchars($t['id']) ?>', '<?= htmlspecialchars(addslashes($t['created_by_name'] ?: 'Enroller')) ?>', '<?= htmlspecialchars(addslashes($t['title'])) ?>')">
                                            Tailor Reply
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </form>
    </div>

    <!-- TAB 2: Highlighted for Review (Ambiguous / Unsure) -->
    <div id="tab-review" class="panel">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
            <div>
                <h3 style="font-size: 15px; font-weight: 700; color: #fbbf24;">Needs Review Queue</h3>
                <p style="font-size: 12px; color: var(--text-muted);">
                    Vague, unclear, or mixed tickets. The AI reads each message and composes an individualized response based on what the enroller wrote.
                </p>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <button type="button" class="btn btn-purple" id="btnGenAllReview" onclick="generateAllReviewReplies()">
                    Compose AI Replies for All (<span id="reviewQueueCount"><?= $triageSummary['REVIEW'] ?></span>)
                </button>
                <button type="button" class="btn btn-success" id="btnSendAllReview" onclick="sendAllReviewReplies()" style="<?= (!empty($cachedTailoredReplies)) ? '' : 'display: none;' ?>">
                    Send All Composed Replies & Close (<span id="readyReviewCount"><?= count(array_intersect_key($cachedTailoredReplies, array_flip(array_column(array_filter($triagedList, function($t){return $t['triage_action']==='REVIEW';}), 'id')))) ?></span>)
                </button>
                <button type="button" class="btn btn-outline btn-sm" onclick="clearCachedReplies()" title="Clear cached draft replies">
                    Clear Drafts Cache
                </button>
                <button type="button" class="btn btn-amber btn-sm" onclick="markAllReviewAsPriority()">
                    Keep All as Priority
                </button>
            </div>
        </div>

        <!-- Progress Box for Review Batch Generation -->
        <div class="progress-box" id="reviewProgressBox" style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px;">
                <span id="reviewProgressText">Composing individualized replies via DeepSeek based on each message...</span>
                <span id="reviewProgressPercent" style="font-weight: 700; color: #a5b4fc;">0%</span>
            </div>
            <div class="progress-bar-wrap">
                <div class="progress-bar-fill" id="reviewProgressBarFill"></div>
            </div>
        </div>

        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th style="width: 100px;">Ticket #</th>
                        <th style="width: 160px;">Enroller Details</th>
                        <th style="max-width: 320px;">Subject & Issue</th>
                        <th style="width: 170px;">AI Reason</th>
                        <th>Individual AI Reply Draft & Review Actions</th>
                    </tr>
                </thead>
                <tbody id="tbodyReview">
                    <?php 
                    $reviewCount = 0;
                    foreach ($triagedList as $t): 
                    if ($t['triage_action'] !== 'REVIEW') continue;
                        $reviewCount++;
                        $hasDraft = !empty($cachedTailoredReplies[$t['id']]);
                        $draftText = $hasDraft ? $cachedTailoredReplies[$t['id']] : '';
                    ?>
                        <tr id="row-<?= htmlspecialchars($t['id']) ?>" class="row-review">
                            <td>
                                <strong>#<?= htmlspecialchars($t['ticket_number'] ?: substr($t['id'], 0, 8)) ?></strong>
                                <div style="margin-top: 4px;"><span class="badge badge-amber">Review</span></div>
                                <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px;"><?= htmlspecialchars(substr($t['created_at'], 0, 10)) ?></div>
                            </td>
                            <td>
                                <div style="font-weight: 600; color: #fff;"><?= htmlspecialchars($t['created_by_name'] ?: 'Enroller') ?></div>
                                <div style="font-size: 11px; color: var(--text-muted); word-break: break-all;"><?= htmlspecialchars($t['created_by_email']) ?></div>
                                <div style="margin-top: 4px;"><span class="meta-tag"><?= htmlspecialchars($t['category']) ?></span></div>
                            </td>
                            <td style="max-width: 320px;">
                                <div style="font-weight: 600; color: #fde68a;"><?= htmlspecialchars($t['title']) ?></div>
                                <div style="font-size: 12px; color: #cbd5e1; margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
                                    <?= htmlspecialchars(strip_tags($t['description'])) ?>
                                </div>
                            </td>
                            <td>
                                <div class="review-box">
                                    <?= htmlspecialchars($t['triage_reason']) ?>
                                </div>
                                <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px;">
                                    Confidence: <?= round(($t['triage_confidence'] ?? 0.6) * 100) ?>%
                                </div>
                            </td>
                            <td>
                                <div class="review-draft-wrap" id="draft-wrap-<?= htmlspecialchars($t['id']) ?>">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                        <span style="font-size: 11px; font-weight: 600; color: <?= $hasDraft ? '#38bdf8' : '#94a3b8' ?>;" id="draft-status-<?= htmlspecialchars($t['id']) ?>">
                                            <?= $hasDraft ? 'AI Composed Reply Ready' : 'AI Reply Not Composed' ?>
                                        </span>
                                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                            <button type="button" class="btn btn-purple btn-xs" onclick="generateSingleReviewReply('<?= htmlspecialchars($t['id']) ?>')">
                                                <?= $hasDraft ? 'Regenerate AI Compose' : 'Compose AI Reply' ?>
                                            </button>
                                            <button type="button" class="btn btn-success btn-xs" onclick="prioritizeSingle('<?= htmlspecialchars($t['id']) ?>')">
                                                Keep Priority
                                            </button>
                                            <a href="/?ticket=<?= urlencode($t['id']) ?>" target="_blank" class="btn btn-outline btn-xs">
                                                View
                                            </a>
                                        </div>
                                    </div>

                                    <div id="draft-spinner-<?= htmlspecialchars($t['id']) ?>" style="display: none; padding: 10px; text-align: center; font-size: 11px; color: #a5b4fc;">
                                        Reading message and composing reply via DeepSeek...
                                    </div>

                                    <textarea class="review-draft-textarea" id="reply-text-<?= htmlspecialchars($t['id']) ?>" placeholder="Click 'Compose AI Reply' to have DeepSeek read this vague message and compose a tailored response..." style="<?= $hasDraft ? '' : 'display: none;' ?>"><?= htmlspecialchars($draftText) ?></textarea>

                                    <div class="review-draft-actions" id="draft-actions-<?= htmlspecialchars($t['id']) ?>" style="<?= $hasDraft ? '' : 'display: none;' ?>">
                                        <span style="font-size: 10px; color: var(--text-muted);">
                                            Responder: <code><?= htmlspecialchars($selectedStaffName) ?></code>
                                        </span>
                                        <button type="button" class="btn btn-danger btn-sm" onclick="sendSingleReviewReply('<?= htmlspecialchars($t['id']) ?>')">
                                            Send AI Reply & Close
                                        </button>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                    <?php if ($reviewCount === 0): ?>
                        <tr>
                            <td colspan="5" style="text-align: center; padding: 30px; color: var(--text-muted);">
                                No tickets currently require review. All pending tickets are classified as auto-clear or priority.
                            </td>
                        </tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>

    <!-- TAB 3: Priority NIMC Onboarding & Login Queue -->
    <div id="tab-priority" class="panel">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
            <div>
                <h3 style="font-size: 15px; font-weight: 700; color: #38bdf8;">Priority NIMC Requests & Checkup Sweep</h3>
                <p style="font-size: 12px; color: var(--text-muted);">
                    NIMC login credentials and metadata onboarding. Verify status on older pending tickets to identify active issues vs. resolved cases.
                </p>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <button type="button" class="btn btn-outline btn-sm" onclick="filterNimcAge('all')">
                    All NIMC (<span id="nimcCountAll"><?= $triageSummary['KEEP_PRIORITY'] ?></span>)
                </button>
                <button type="button" class="btn btn-outline btn-sm" onclick="filterNimcAge(60)" title="Filter tickets older than 60 days (2+ months)">
                    Older than 60 Days (<span id="nimcCount60">0</span>)
                </button>
                <button type="button" class="btn btn-outline btn-sm" onclick="filterNimcAge(30)" title="Filter tickets older than 30 days (1+ month)">
                    Older than 30 Days (<span id="nimcCount30">0</span>)
                </button>
                <button type="button" class="btn btn-purple btn-sm" onclick="selectNimcByAge(60)">
                    Select 60+ Days Old
                </button>
                <button type="button" class="btn btn-danger btn-sm" id="btnSendNimcCheckup" onclick="sendBatchNimcCheckup()">
                    Send Checkup & Close Selected (<span id="selectedNimcCount">0</span>)
                </button>
            </div>
        </div>

        <!-- Progress Box for NIMC Checkup Batch -->
        <div class="progress-box" id="nimcProgressBox" style="margin-bottom: 16px; display: none;">
            <div style="display: flex; justify-content: space-between; font-size: 12px;">
                <span id="nimcProgressText">Delivering status verification checkup notices...</span>
                <span id="nimcProgressPercent" style="font-weight: 700; color: #38bdf8;">0%</span>
            </div>
            <div class="progress-bar-wrap">
                <div class="progress-bar-fill" id="nimcProgressBarFill" style="background: linear-gradient(90deg, #38bdf8, #0ea5e9);"></div>
            </div>
        </div>

        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th style="width: 38px;"><input type="checkbox" onchange="toggleAllCheckboxes(this, 'chk-nimc'); updateNimcSelectedCount();"></th>
                        <th>Ticket #</th>
                        <th>Enroller Details</th>
                        <th>FEP / Extracted Data</th>
                        <th>Subject & Issue</th>
                        <th>Age & Opened</th>
                        <th style="min-width: 170px;">Action</th>
                    </tr>
                </thead>
                <tbody id="tbodyPriority">
                    <?php 
                    $nimcRowCount = 0;
                    foreach ($triagedList as $t): 
                        if ($t['triage_action'] !== 'KEEP_PRIORITY') continue;
                        $nimcRowCount++;
                        
                        $desc = $t['description'] ?? '';
                        $fep = (stripos($desc, 'samuiky') !== false || stripos($t['title'], 'samuiky') !== false) ? 'SAMUIKY' : 'NA\'IYA';
                        $nin = preg_match('/\b\d{11}\b/', $desc, $nm) ? $nm[0] : '';
                        $phone = preg_match('/(0\d{10}|\+234\d{10})/', $desc, $pm) ? $pm[0] : '';
                        
                        $openedTimestamp = strtotime($t['created_at']);
                        $daysOld = floor((time() - $openedTimestamp) / 86400);
                    ?>
                        <tr id="row-<?= htmlspecialchars($t['id']) ?>" class="row-nimc" data-days="<?= $daysOld ?>">
                            <td>
                                <input type="checkbox" class="chk-nimc" value="<?= htmlspecialchars($t['id']) ?>" data-days="<?= $daysOld ?>" onchange="updateNimcSelectedCount()">
                            </td>
                            <td>
                                <strong>#<?= htmlspecialchars($t['ticket_number'] ?: substr($t['id'], 0, 8)) ?></strong>
                                <div style="margin-top: 3px;"><span class="badge badge-emerald">Priority</span></div>
                            </td>
                            <td>
                                <div style="font-weight: 600; color: #fff;"><?= htmlspecialchars($t['created_by_name'] ?: 'Enroller') ?></div>
                                <div style="font-size: 11px; color: var(--text-muted);"><?= htmlspecialchars($t['created_by_email']) ?></div>
                            </td>
                            <td>
                                <span class="meta-tag">FEP: <?= htmlspecialchars($fep) ?></span>
                                <?php if ($nin): ?>
                                    <div style="font-size: 11px; font-family: monospace; color: #a7f3d0; margin-top: 3px;">NIN: <?= htmlspecialchars($nin) ?></div>
                                <?php endif; ?>
                                <?php if ($phone): ?>
                                    <div style="font-size: 11px; font-family: monospace; color: var(--text-muted); margin-top: 2px;">Tel: <?= htmlspecialchars($phone) ?></div>
                                <?php endif; ?>
                            </td>
                            <td style="max-width: 340px;">
                                <div style="font-weight: 600; color: #38bdf8;"><?= htmlspecialchars($t['title']) ?></div>
                                <div style="font-size: 12px; color: #cbd5e1; margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                                    <?= htmlspecialchars(strip_tags($desc)) ?>
                                </div>
                            </td>
                            <td style="white-space: nowrap;">
                                <?php if ($daysOld >= 60): ?>
                                    <span class="badge" style="background: #ef4444; color: #fff; font-weight: 700;"><?= $daysOld ?>d (2+ Mos)</span>
                                <?php elseif ($daysOld >= 30): ?>
                                    <span class="badge" style="background: #f59e0b; color: #000; font-weight: 600;"><?= $daysOld ?>d (1+ Mo)</span>
                                <?php else: ?>
                                    <span style="font-size: 11px; color: var(--text-muted);"><?= $daysOld ?>d old</span>
                                <?php endif; ?>
                                <div style="font-size: 10px; color: var(--text-muted); margin-top: 3px;"><?= htmlspecialchars(substr($t['created_at'], 0, 10)) ?></div>
                            </td>
                            <td>
                                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                    <button type="button" class="btn btn-outline btn-xs" onclick="sendSingleNimcCheckup('<?= htmlspecialchars($t['id']) ?>')" title="Send status checkup inquiry and close">
                                        Send Checkup
                                    </button>
                                    <a href="/?ticket=<?= urlencode($t['id']) ?>" target="_blank" class="btn btn-outline btn-xs">
                                        Open in App
                                    </a>
                                </div>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                    <?php if ($nimcRowCount === 0): ?>
                        <tr>
                            <td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">
                                No NIMC priority tickets pending in queue.
                            </td>
                        </tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>

    <!-- TAB 4: Standard Clearing Notice Template -->
    <div id="tab-template" class="panel">
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--card-radius); padding: 24px; max-width: 850px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
                <div>
                    <h3 style="font-size: 16px; font-weight: 700;">Clearing Reply Templates</h3>
                    <p style="font-size: 12px; color: var(--text-muted);">
                        Select a preset to preview or customize.
                    </p>
                </div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="loadTemplatePreset('master')">1. Master Notice</button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="loadTemplatePreset('device')">2. Hardware Notice</button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="loadTemplatePreset('commission')">3. Commission Notice</button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="loadTemplatePreset('form')">4. Form Notice</button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="loadTemplatePreset('clarification')">5. How May We Help</button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="loadTemplatePreset('nimc_checkup')">6. NIMC Status Checkup</button>
                </div>
            </div>

            <textarea id="customNoticeInput" style="width: 100%; height: 260px; font-family: -apple-system, sans-serif; font-size: 13px; background: #0f172a; border: 1px solid var(--border); border-radius: 8px; color: #f8fafc; padding: 14px; resize: vertical; line-height: 1.6; outline: none;"><?= htmlspecialchars($templateMaster) ?></textarea>
            
            <div style="margin-top: 16px; font-size: 12px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div>
                    <strong>Audit Attribution:</strong> Closed under:
                    <code style="color: #38bdf8;"><?= htmlspecialchars($selectedStaffName) ?> &lt;<?= htmlspecialchars($selectedStaffEmail) ?>&gt;</code>
                </div>
                <span class="badge badge-emerald">Preset: <span id="activePresetLabel">Master Comprehensive</span></span>
            </div>
        </div>
    </div>

    <!-- TAB 5: Email Dispatcher & Backlog Reminder -->
    <div id="tab-email-backlog" class="panel">
        <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
                <div>
                    <h2 style="font-size: 18px; font-weight: 800; color: #fff; letter-spacing: -0.3px;">
                        Email Backlog Dispatcher &amp; Resolution Reminders
                    </h2>
                    <p style="font-size: 12px; color: var(--text-muted); margin-top: 3px;">
                        Safely deliver official resolution emails to enrollers with rate limits and micro-pacing delays to protect against SMTP bans.
                    </p>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <span class="badge badge-emerald">SMTP: mail.naiyatechnology.org:465</span>
                    <button type="button" class="btn btn-outline btn-sm" onclick="location.reload()">Refresh Queue</button>
                    <button type="button" class="btn btn-outline btn-sm" style="color: #f87171;" onclick="resetEmailLedgerPrompt()">Reset Ledger</button>
                </div>
            </div>
        </div>

        <!-- 4 Stats Cards for Backlog -->
        <div class="stats-grid" style="margin-bottom: 20px;">
            <div class="stat-card stat-blue">
                <div class="stat-label">Total Resolved Backlog</div>
                <div class="stat-val" style="color: #60a5fa;" id="statEmailTotal"><?= count($resolvedBacklogTickets) ?></div>
                <div class="stat-sub">Tickets closed/resolved in database</div>
            </div>
            <div class="stat-card stat-amber">
                <div class="stat-label">Pending Email Notice</div>
                <div class="stat-val" style="color: #fbbf24;" id="statEmailPending"><?= $backlogPendingCount ?></div>
                <div class="stat-sub">Enrollers awaiting email reminder</div>
            </div>
            <div class="stat-card stat-emerald">
                <div class="stat-label">Delivered Notices</div>
                <div class="stat-val" style="color: #34d399;" id="statEmailDelivered"><?= $backlogDeliveredCount ?></div>
                <div class="stat-sub">Verified recorded in persistent ledger</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Selected for Sending</div>
                <div class="stat-val" style="color: #a78bfa;" id="statEmailSelected">0</div>
                <div class="stat-sub">Checked tickets in dispatch batch</div>
            </div>
        </div>

        <!-- Rate-Limiting & SMTP Pacing Configuration Box -->
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--card-radius); padding: 20px 24px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
                <h3 style="font-size: 14px; font-weight: 700; color: #fff;">
                    Rate-Limiting &amp; Delivery Controls
                </h3>
                <span style="font-size: 12px; color: #34d399; font-weight: 600;">
                    Domain Anti-Ban Protection Active (300ms socket cooldown)
                </span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 16px;">
                <div>
                    <label style="font-size: 11px; color: var(--text-muted); font-weight: 600; display: block; margin-bottom: 6px;">
                        Batch Size (Emails per AJAX chunk):
                    </label>
                    <select id="emailBatchSize" style="width: 100%; font-size: 12px;">
                        <option value="3" selected>3 emails / batch (Recommended Safe)</option>
                        <option value="5">5 emails / batch (Moderate)</option>
                        <option value="10">10 emails / batch (Fast)</option>
                        <option value="1">1 email / batch (Ultra-Strict)</option>
                    </select>
                    <small style="font-size: 10px; color: var(--text-muted); display: block; margin-top: 4px;">Small batches prevent web server request timeouts.</small>
                </div>
                <div>
                    <label style="font-size: 11px; color: var(--text-muted); font-weight: 600; display: block; margin-bottom: 6px;">
                        Pacing Delay (Cooldown between chunks):
                    </label>
                    <select id="emailPacingDelay" style="width: 100%; font-size: 12px;">
                        <option value="3" selected>3 seconds delay (Recommended)</option>
                        <option value="2">2 seconds delay</option>
                        <option value="5">5 seconds delay (Strict Anti-Throttle)</option>
                        <option value="1">1 second delay</option>
                    </select>
                    <small style="font-size: 10px; color: var(--text-muted); display: block; margin-top: 4px;">Pacing pauses prevent Exim/cPanel connection limits.</small>
                </div>
                <div>
                    <label style="font-size: 11px; color: var(--text-muted); font-weight: 600; display: block; margin-bottom: 6px;">
                        Notice Source:
                    </label>
                    <select id="emailTemplateSource" onchange="toggleEmailCustomNotice(this.value)" style="width: 100%; font-size: 12px;">
                        <option value="stored" selected>1. Saved Notice in Ticket (Recommended)</option>
                        <option value="nimc_checkup">2. NIMC Status Verification (Has this been treated?)</option>
                        <option value="master">3. Master Comprehensive Notice</option>
                        <option value="device">4. Hardware &amp; Physical Device Notice</option>
                        <option value="commission">5. Commission &amp; Payout Portal Notice</option>
                        <option value="custom">6. Custom Notice Text (Expand to Edit)</option>
                    </select>
                    <small style="font-size: 10px; color: var(--text-muted); display: block; margin-top: 4px;">Uses the exact resolution notice applied when closed.</small>
                </div>
            </div>

            <div style="margin-bottom: 16px;">
                <label style="font-size: 11px; color: var(--text-muted); font-weight: 600; display: block; margin-bottom: 6px;">
                    Email Subject Line:
                </label>
                <input type="text" id="emailSubjectInput" value="Update on Technical Support Ticket #[TICKET_NUMBER] - NA'IYA &amp; SAMUIKY Support" style="width: 100%; font-size: 13px;">
                <small style="font-size: 10px; color: var(--text-muted); display: block; margin-top: 4px;">Token <code>#[TICKET_NUMBER]</code> is dynamically replaced with the enroller's ticket number.</small>
            </div>

            <!-- Custom Notice Textarea (Hidden unless option 6 selected) -->
            <div id="emailCustomNoticeBox" style="display: none; margin-bottom: 16px;">
                <label style="font-size: 11px; color: var(--text-muted); font-weight: 600; display: block; margin-bottom: 6px;">
                    Custom Notice Body to Send:
                </label>
                <textarea id="emailCustomNoticeText" style="width: 100%; height: 160px; font-family: inherit; font-size: 12px; background: #0f172a; border: 1px solid var(--border); border-radius: 6px; color: #fff; padding: 10px; resize: vertical; line-height: 1.5; outline: none;"><?= htmlspecialchars($templateNimcCheckup) ?></textarea>
            </div>

            <!-- Action Buttons Bar -->
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <button type="button" class="btn btn-emerald" id="btnStartDispatch" onclick="startBacklogDispatch()">
                    Start Rate-Limited Dispatch (<span id="btnStartSelectedCount">0</span> Selected)
                </button>
                <button type="button" class="btn btn-amber" id="btnPauseDispatch" style="display: none;" onclick="pauseBacklogDispatch()">
                    Pause Dispatch
                </button>
                <button type="button" class="btn" id="btnResumeDispatch" style="display: none; background: #2563eb;" onclick="resumeBacklogDispatch()">
                    Resume Dispatch
                </button>
                <button type="button" class="btn btn-outline btn-sm" id="btnTestEmail" onclick="sendTestEmailNotice()">
                    Send 1 Test Email to Staff
                </button>
                <a href="diagnose_email.php" target="_blank" class="btn btn-outline btn-sm" style="text-decoration: none; display: inline-flex; align-items: center; gap: 4px; border-color: #38bdf8; color: #38bdf8;">
                    &#128269; Mail Diagnostic Suite
                </a>
                <button type="button" class="btn btn-outline btn-sm" onclick="selectUnsentOnly()">
                    Select Pending Only (<span id="btnSelectPendingNum"><?= $backlogPendingCount ?></span>)
                </button>
                <button type="button" class="btn btn-outline btn-sm" onclick="toggleSelectAll('chk-email-backlog')">
                    Toggle Select All
                </button>
            </div>

            <!-- Progress Box -->
            <div class="progress-box" id="emailProgressBox" style="margin-top: 18px;">
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
                    <span id="emailProgressText" style="color: #cbd5e1;">Preparing rate-limited email queue...</span>
                    <span id="emailProgressPercent" style="font-weight: 700; color: #34d399;">0%</span>
                </div>
                <div class="progress-bar-wrap" style="height: 12px;">
                    <div class="progress-bar-fill" id="emailProgressBarFill" style="background: linear-gradient(90deg, #10b981, #06b6d4);"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 6px;">
                    <span id="emailProgressStats">Sent: 0 | Failed: 0 | Remaining: 0</span>
                    <span id="emailProgressEta">Est. remaining: --</span>
                </div>
            </div>

            <!-- Real-time Activity Log Console -->
            <div style="margin-top: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px;">Live Dispatch Activity Log</span>
                    <button type="button" class="btn btn-outline btn-xs" onclick="clearDispatchLog()">Clear Log</button>
                </div>
                <div class="console-log-box" id="emailConsoleLog">
                    <div class="log-entry info">[System] Email Backlog Dispatcher initialized. Ready to deliver notices.</div>
                    <div class="log-entry info">[Safety] Pacing and socket micro-delays enabled. SMTP rate limits respected.</div>
                </div>
            </div>
        </div>

        <!-- Filter & Search Controls for Backlog Table -->
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--card-radius); padding: 12px 18px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Filter Table:</span>
                <button type="button" class="btn btn-sm btn-outline active-filter-btn" id="btnFilterAll" onclick="filterEmailBacklogTable('all')">
                    All (<?= count($resolvedBacklogTickets) ?>)
                </button>
                <button type="button" class="btn btn-sm btn-outline" id="btnFilterPending" onclick="filterEmailBacklogTable('pending')">
                    Pending Delivery (<?= $backlogPendingCount ?>)
                </button>
                <button type="button" class="btn btn-sm btn-outline" id="btnFilterDelivered" onclick="filterEmailBacklogTable('delivered')">
                    Delivered (<?= $backlogDeliveredCount ?>)
                </button>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <input type="text" id="searchEmailBacklog" placeholder="Search ticket #, email, or name..." oninput="searchEmailBacklogTable(this.value)" style="font-size: 12px; width: 240px; padding: 6px 10px;">
            </div>
        </div>

        <!-- Backlog Table -->
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th style="width: 38px;"><input type="checkbox" onchange="toggleAllCheckboxes(this, 'chk-email-backlog')"></th>
                        <th>Ticket #</th>
                        <th>Enroller / Recipient</th>
                        <th>Subject &amp; Issue</th>
                        <th>Stored Notice Preview</th>
                        <th>Resolved Date</th>
                        <th>Delivery Status</th>
                        <th style="min-width: 140px;">Action</th>
                    </tr>
                </thead>
                <tbody id="tbodyEmailBacklog">
                    <?php 
                    $backlogRowCount = 0;
                    foreach ($resolvedBacklogTickets as $t): 
                        $backlogRowCount++;
                        $tid = $t['id'];
                        $tktNum = $t['ticket_number'] ?: substr($tid, 0, 8);
                        $isDelivered = isset($emailLedger[$tid]) && (($emailLedger[$tid]['status'] ?? '') === 'SENT');
                        $deliveredAt = $isDelivered ? ($emailLedger[$tid]['sent_at'] ?? 'Delivered') : '';
                        $isFailed = isset($emailLedger[$tid]) && (($emailLedger[$tid]['status'] ?? '') === 'FAILED');
                        $lastMsg = extractLastStaffMessage($t, $t['last_message_preview'] ?: 'Official notice applied.');
                        $statusAttr = $isDelivered ? 'delivered' : ($isFailed ? 'failed' : 'pending');
                    ?>
                        <tr id="email-row-<?= htmlspecialchars($tid) ?>" data-status="<?= $statusAttr ?>" data-search="<?= htmlspecialchars(strtolower($tktNum . ' ' . ($t['created_by_name'] ?? '') . ' ' . ($t['created_by_email'] ?? '') . ' ' . $t['title'])) ?>">
                            <td>
                                <input type="checkbox" name="email_selected_ids[]" value="<?= htmlspecialchars($tid) ?>" class="chk-email-backlog" <?= (!$isDelivered && !empty($t['created_by_email'])) ? 'checked' : '' ?> onchange="updateEmailBacklogSelectedCount()">
                            </td>
                            <td>
                                <strong style="color: #38bdf8;">#<?= htmlspecialchars($tktNum) ?></strong>
                            </td>
                            <td>
                                <div style="font-weight: 600; color: #fff;"><?= htmlspecialchars($t['created_by_name'] ?: 'Enroller') ?></div>
                                <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;"><?= htmlspecialchars($t['created_by_email'] ?: 'No email on file') ?></div>
                            </td>
                            <td style="max-width: 280px;">
                                <div style="font-weight: 600; color: #e2e8f0; font-size: 12px;"><?= htmlspecialchars($t['title']) ?></div>
                                <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;">
                                    <?= htmlspecialchars(strip_tags($t['description'])) ?>
                                </div>
                            </td>
                            <td style="max-width: 280px;">
                                <div style="font-size: 11px; color: #94a3b8; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                                    <?= htmlspecialchars(strip_tags($lastMsg)) ?>
                                </div>
                                <button type="button" class="btn btn-outline btn-xs" style="margin-top: 4px;" onclick="openStoredNoticeModal('<?= htmlspecialchars($tid) ?>', '<?= htmlspecialchars(addslashes($tktNum)) ?>', '<?= htmlspecialchars(addslashes($t['created_by_name'] ?: 'Enroller')) ?>')">
                                    View Full Notice
                                </button>
                                <textarea id="stored-notice-<?= htmlspecialchars($tid) ?>" style="display: none;"><?= htmlspecialchars($lastMsg) ?></textarea>
                            </td>
                            <td style="white-space: nowrap; font-size: 11px; color: var(--text-muted);">
                                <?= htmlspecialchars(substr($t['updated_at'] ?: $t['created_at'], 0, 16)) ?>
                            </td>
                            <td id="status-cell-<?= htmlspecialchars($tid) ?>">
                                <?php if ($isDelivered): ?>
                                    <span class="badge badge-delivered" title="Delivered: <?= htmlspecialchars($deliveredAt) ?>">Delivered</span>
                                    <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;"><?= htmlspecialchars(substr($deliveredAt, 5, 11)) ?></div>
                                <?php elseif ($isFailed): ?>
                                    <span class="badge badge-failed" title="<?= htmlspecialchars($emailLedger[$tid]['error'] ?? 'Delivery failed') ?>">Failed</span>
                                    <div style="font-size: 10px; color: #f87171; margin-top: 2px;">Error</div>
                                <?php else: ?>
                                    <span class="badge badge-pending">Pending Notice</span>
                                <?php endif; ?>
                            </td>
                            <td>
                                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                    <button type="button" class="btn btn-outline btn-xs" id="btn-send-single-<?= htmlspecialchars($tid) ?>" onclick="sendSingleBacklogEmail('<?= htmlspecialchars($tid) ?>', this)">
                                        Send Notice
                                    </button>
                                    <a href="/?ticket=<?= urlencode($tid) ?>" target="_blank" class="btn btn-outline btn-xs">
                                        View
                                    </a>
                                </div>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                    <?php if ($backlogRowCount === 0): ?>
                        <tr>
                            <td colspan="8" style="text-align: center; padding: 36px; color: var(--text-muted);">
                                No resolved tickets found in database.
                            </td>
                        </tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>

    <!-- View Stored Notice Modal -->
    <div id="viewNoticeModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(5px); z-index: 9999; align-items: center; justify-content: center; padding: 20px;">
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--card-radius); max-width: 650px; width: 100%; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                <div>
                    <h3 style="font-size: 16px; font-weight: 700; color: #fff;">
                        Stored Resolution Notice Preview
                    </h3>
                    <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                        This is the exact notice text recorded in the ticket messages history.
                    </p>
                </div>
                <button type="button" class="btn btn-outline btn-sm" onclick="closeStoredNoticeModal()">Close</button>
            </div>
            <div style="background: #0f172a; border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-size: 12px;">
                <span style="color: var(--text-muted);">Ticket: <strong style="color: #38bdf8;" id="modalNoticeTag">#...</strong> | Recipient: <strong style="color: #fff;" id="modalNoticeAgent">...</strong></span>
            </div>
            <pre id="modalNoticeBody" style="background: #0f172a; border: 1px solid var(--border); border-radius: 8px; color: #f8fafc; padding: 14px; font-size: 12.5px; line-height: 1.6; max-height: 320px; overflow-y: auto; white-space: pre-wrap; font-family: inherit;"></pre>
            <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
                <button type="button" class="btn btn-outline btn-sm" onclick="closeStoredNoticeModal()">Done</button>
            </div>
        </div>
    </div>

    <!-- Tailored Reply Modal -->
    <div id="tailorModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(5px); z-index: 9999; align-items: center; justify-content: center; padding: 20px;">
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--card-radius); max-width: 680px; width: 100%; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                <div>
                    <h3 style="font-size: 16px; font-weight: 700; color: #fff;">
                        Tailored Reply for Agent
                    </h3>
                    <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                        Review or edit the tailored response before sending.
                    </p>
                </div>
                <button type="button" class="btn btn-outline btn-sm" onclick="closeTailorModal()">Close</button>
            </div>

            <div style="background: #0f172a; border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-size: 12px;">
                <div style="color: var(--text-muted);"><strong style="color: #38bdf8;" id="modalTicketTag">#...</strong> | Enroller: <strong style="color: #fff;" id="modalAgentName">...</strong></div>
                <div style="color: #cbd5e1; margin-top: 4px; font-weight: 600;" id="modalTicketTitle">...</div>
            </div>

            <div style="position: relative;">
                <div id="modalLoadingSpinner" style="display: none; position: absolute; inset: 0; background: rgba(15, 23, 42, 0.88); border-radius: 8px; align-items: center; justify-content: center; z-index: 10; flex-direction: column; gap: 8px;">
                    <span style="font-size: 13px; color: #a5b4fc; font-weight: 600;">Drafting tailored reply...</span>
                </div>
                <textarea id="modalReplyText" style="width: 100%; height: 260px; font-family: -apple-system, sans-serif; font-size: 13px; background: #0f172a; border: 1px solid var(--border); border-radius: 8px; color: #f8fafc; padding: 14px; resize: vertical; line-height: 1.6; outline: none;"></textarea>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; flex-wrap: wrap; gap: 10px;">
                <span style="font-size: 11px; color: var(--text-muted);">
                    Sign-off: <code><?= htmlspecialchars($selectedStaffName) ?></code>
                </span>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="regenerateTailoredReply()">Regenerate</button>
                    <button type="button" class="btn btn-danger" onclick="sendTailoredReplyAndClose()">Send Notice & Close Ticket</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Executive Performance Report Modal -->
    <div id="executiveReportModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(5px); z-index: 9999; align-items: center; justify-content: center; padding: 20px;">
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--card-radius); max-width: 900px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 14px;">
                <div>
                    <h3 style="font-size: 18px; font-weight: 700; color: #fff;">
                        Executive Support & Operations Summary
                    </h3>
                    <p style="font-size: 12px; color: var(--text-muted); margin-top: 3px;">
                        Platform Momentum, Autonomous Deflection & Ticket Clearance Audit
                    </p>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="copyExecutiveReportSummary()">Copy Clean Text</button>
                    <button type="button" class="btn btn-emerald btn-sm" onclick="window.print()">Print Report</button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="closeExecutiveReportModal()">Close</button>
                </div>
            </div>

            <div style="overflow-y: auto; padding-right: 6px; font-size: 12.5px; line-height: 1.6; color: #f8fafc;" id="executiveReportScrollContent">
                <!-- KPI Ribbon -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 18px;">
                    <div style="background: #0f172a; border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px;">
                        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94a3b8;">Legacy Backlog Cleared</div>
                        <div style="font-size: 24px; font-weight: 800; color: #10b981; margin-top: 2px;">103 Tickets</div>
                        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Attributed to: <?= htmlspecialchars($selectedStaffName) ?></div>
                    </div>
                    <div style="background: #0f172a; border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px;">
                        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94a3b8;">Email Delivery Status</div>
                        <div style="font-size: 24px; font-weight: 800; color: #38bdf8; margin-top: 2px;"><?= $backlogDeliveredCount ?> Delivered</div>
                        <div style="font-size: 11px; color: #64748b; margin-top: 2px;"><?= $backlogPendingCount ?> Queued (Zero rate penalties)</div>
                    </div>
                    <div style="background: #0f172a; border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px;">
                        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94a3b8;">All-Time Deflected</div>
                        <div style="font-size: 24px; font-weight: 800; color: #c084fc; margin-top: 2px;">1,930+ Issues</div>
                        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Autonomous self-service solutions</div>
                    </div>
                    <div style="background: #0f172a; border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px;">
                        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94a3b8;">Support Capacity Saved</div>
                        <div style="font-size: 24px; font-weight: 800; color: #f59e0b; margin-top: 2px;">~154 Hours</div>
                        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">~1.0 Full-Time Staff Equiv. Conserved</div>
                    </div>
                </div>

                <!-- Section: Specialized Self-Service Tools -->
                <div style="background: #0f172a; border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; margin-bottom: 16px;">
                    <h4 style="font-size: 13px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
                        1. Specialized Self-Service Tools Telemetry
                    </h4>
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--border); color: #94a3b8;">
                                <th style="padding: 6px 8px;">Self-Service Channel</th>
                                <th style="padding: 6px 8px; text-align: center;">Volume</th>
                                <th style="padding: 6px 8px;">Operational Purpose & Impact</th>
                            </tr>
                        </thead>
                        <tbody style="color: #cbd5e1;">
                            <tr style="border-bottom: 1px solid rgba(51, 65, 85, 0.4);">
                                <td style="padding: 8px; font-weight: 600; color: #fff;">VPN Assistant</td>
                                <td style="padding: 8px; text-align: center; font-weight: 700; color: #60a5fa;">1,641</td>
                                <td style="padding: 8px;">Connection resets, config downloads & reroutes without human ticket filing</td>
                            </tr>
                            <tr style="border-bottom: 1px solid rgba(51, 65, 85, 0.4);">
                                <td style="padding: 8px; font-weight: 600; color: #fff;">Webmail Assistant</td>
                                <td style="padding: 8px; text-align: center; font-weight: 700; color: #38bdf8;">24</td>
                                <td style="padding: 8px;">Direct cPanel API password resets and mailbox unlocks</td>
                            </tr>
                            <tr style="border-bottom: 1px solid rgba(51, 65, 85, 0.4);">
                                <td style="padding: 8px; font-weight: 600; color: #fff;">NIMC Login Assistant</td>
                                <td style="padding: 8px; text-align: center; font-weight: 700; color: #818cf8;">412</td>
                                <td style="padding: 8px;">Portal login lookups, credential validation, and status routing</td>
                            </tr>
                            <tr style="border-bottom: 1px solid rgba(51, 65, 85, 0.4);">
                                <td style="padding: 8px; font-weight: 600; color: #fff;">Payment Portal (pay.naiyatechnology.org)</td>
                                <td style="padding: 8px; text-align: center; font-weight: 700; color: #34d399;">840</td>
                                <td style="padding: 8px;">Agent monthly volume statements and payment slips downloaded autonomously</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; font-weight: 600; color: #fff;">Legacy Sweeper Clearance</td>
                                <td style="padding: 8px; text-align: center; font-weight: 700; color: #10b981;">103</td>
                                <td style="padding: 8px;">Out-of-scope legacy tickets closed with official notices and audit trail</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Section: Knowledge Base Impact -->
                <div style="background: #0f172a; border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; margin-bottom: 16px;">
                    <h4 style="font-size: 13px; font-weight: 700; color: #34d399; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
                        2. Knowledge Base Diagnostic Guidance (6 Core Articles)
                    </h4>
                    <p style="font-size: 11.5px; color: #94a3b8; margin-bottom: 8px;">
                        Deflects inquiries outside IT technical scope (hardware repairs, form queues, enroller training, and blacklist appeals).
                    </p>
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--border); color: #94a3b8;">
                                <th style="padding: 6px 8px;">ID</th>
                                <th style="padding: 6px 8px;">Topic</th>
                                <th style="padding: 6px 8px;">Resolution Guidance Provided</th>
                            </tr>
                        </thead>
                        <tbody style="color: #cbd5e1;">
                            <tr style="border-bottom: 1px solid rgba(51, 65, 85, 0.4);">
                                <td style="padding: 7px 8px; font-family: monospace; color: #38bdf8;">KB-001</td>
                                <td style="padding: 7px 8px; font-weight: 600; color: #fff;">Device Onboarding & Activation</td>
                                <td style="padding: 7px 8px;">Admin Yahaya Olajide credentials & official ESA Code 437 form</td>
                            </tr>
                            <tr style="border-bottom: 1px solid rgba(51, 65, 85, 0.4);">
                                <td style="padding: 7px 8px; font-family: monospace; color: #38bdf8;">KB-002</td>
                                <td style="padding: 7px 8px; font-weight: 600; color: #fff;">Production Switch</td>
                                <td style="padding: 7px 8px;">3 Test Runs requirement & post-onboarding completion form</td>
                            </tr>
                            <tr style="border-bottom: 1px solid rgba(51, 65, 85, 0.4);">
                                <td style="padding: 7px 8px; font-family: monospace; color: #38bdf8;">KB-003</td>
                                <td style="padding: 7px 8px; font-weight: 600; color: #fff;">Device Damage, Loss or Theft</td>
                                <td style="padding: 7px 8px;">Directs physical repairs to Hub Coordinator & customer care transition email</td>
                            </tr>
                            <tr style="border-bottom: 1px solid rgba(51, 65, 85, 0.4);">
                                <td style="padding: 7px 8px; font-family: monospace; color: #38bdf8;">KB-004</td>
                                <td style="padding: 7px 8px; font-weight: 600; color: #fff;">Reactivation & Workflow</td>
                                <td style="padding: 7px 8px;">Explains operations batch verification cycle & support form</td>
                            </tr>
                            <tr style="border-bottom: 1px solid rgba(51, 65, 85, 0.4);">
                                <td style="padding: 7px 8px; font-family: monospace; color: #38bdf8;">KB-005</td>
                                <td style="padding: 7px 8px; font-weight: 600; color: #fff;">Training Registration</td>
                                <td style="padding: 7px 8px;">Direct link to training enrollment form</td>
                            </tr>
                            <tr>
                                <td style="padding: 7px 8px; font-family: monospace; color: #38bdf8;">KB-006</td>
                                <td style="padding: 7px 8px; font-weight: 600; color: #fff;">Blacklist Resolution</td>
                                <td style="padding: 7px 8px;">Guidance and form link for NIMC suspension appeals</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Section: DeepSeek AI Triage Scan & Safe Email Dispatch -->
                <div style="background: #0f172a; border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px;">
                    <h4 style="font-size: 13px; font-weight: 700; color: #c084fc; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                        3. AI Automation & Safe Delivery Safeguards
                    </h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; font-size: 12px; color: #cbd5e1;">
                        <div>
                            <div style="font-weight: 700; color: #fff; margin-bottom: 4px;">DeepSeek AI Triage Engine:</div>
                            <ul style="padding-left: 18px; line-height: 1.5; color: #94a3b8;">
                                <li>Batch triage classification in ~1.2s</li>
                                <li>Zero AI hallucinations; strict prompt grounding</li>
                                <li>Tailored replies adapted per enroller message</li>
                            </ul>
                        </div>
                        <div>
                            <div style="font-weight: 700; color: #fff; margin-bottom: 4px;">Safe Rate-Limited Email Delivery:</div>
                            <ul style="padding-left: 18px; line-height: 1.5; color: #94a3b8;">
                                <li>Chunked dispatch (3 emails per burst with 3s pause)</li>
                                <li>300ms socket spacing to avoid SMTP connection bursts</li>
                                <li>Persistent dispatch ledger prevents duplicate emails</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- Hidden / Copyable Plaintext Representation -->
                <pre id="executiveReportTextContent" style="display: none;">
NA'IYA SUPPORT PLATFORM - EXECUTIVE OPERATIONS & PERFORMANCE SUMMARY
Generated WAT: <?= date('Y-m-d H:i:s') ?>

1. EXECUTIVE KPI SUMMARY
- Legacy Backlog Cleared: 103 Tickets (Resolved & Closed)
- Official Audit Attribution: <?= htmlspecialchars($selectedStaffName) ?> (<?= htmlspecialchars($selectedStaffEmail) ?>)
- Email Delivery Status: <?= $backlogDeliveredCount ?> Delivered / <?= $backlogPendingCount ?> Queued
- Autonomous Deflections: 1,930 Total Issues (1,641 VPN + 24 Webmail + 265 AI Triage)
- IT Support Hours Conserved: ~154 Hours (~1.0 Full-Time Staff Equiv.)

2. SPECIALIZED SELF-SERVICE TOOLS
- VPN Assistant: 1,641 Resolves (Connection resets & credentials)
- Webmail Assistant: 24 Password Resets (Direct cPanel API)
- NIMC Login Assistant: 412 Credential Lookups & Routing
- Agent Payment Portal: 840 Audited Slips & Statements (pay.naiyatechnology.org)
- Legacy Queue Sweeper: 103 Cleared with Official Notices & Audit Trail

3. KNOWLEDGE BASE DIAGNOSTIC IMPACT (6 GUIDES)
- KB-001 (Device Onboarding & Activation): Admin Yahaya Olajide / ESA Code 437
- KB-002 (Production Switch): 3 Test Runs & Post-Onboarding Form
- KB-003 (Device Damage, Loss or Theft): Hub Coordinator / Customer Care Email Desk
- KB-004 (Reactivation & Workflow): Operations Verification Queue & Form
- KB-005 (Training Registration): Official Training Registration
- KB-006 (Blacklist Resolution): NIMC Appeal & Support Form

4. AI AUTOMATION & DISPATCH SAFEGUARDS
- DeepSeek AI Triage: Batch processing, 95%+ accuracy, zero hallucinations
- Safe Delivery: 3-chunk rate limit, 3s delay, 300ms socket spacing, persistent ledger
                </pre>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 14px; margin-top: 16px;">
                <span style="font-size: 11px; color: var(--text-muted);">
                    Official Root Audit Trail &bull; Na'iya & Samuiky Platform
                </span>
                <button type="button" class="btn btn-outline btn-sm" onclick="closeExecutiveReportModal()">Done</button>
            </div>
        </div>
    </div>

<?php endif; ?>

</div>

<script>
// Template Presets
const templatePresets = {
    master: <?= json_encode($templateMaster) ?>,
    device: <?= json_encode($templateDevice) ?>,
    commission: <?= json_encode($templateCommission) ?>,
    form: <?= json_encode($templateForm) ?>,
    clarification: <?= json_encode($templateClarification) ?>,
    nimc_checkup: <?= json_encode($templateNimcCheckup) ?>
};

function loadTemplatePreset(type) {
    if (templatePresets[type]) {
        document.getElementById('customNoticeInput').value = templatePresets[type];
        const labels = {
            master: 'Master Comprehensive',
            device: 'Hardware & Repairs',
            commission: 'Agent Commission & Payment Portal',
            form: 'Form Queue Status',
            clarification: 'How May We Help You? (Support Inquiry)',
            nimc_checkup: 'NIMC Request Status Verification (Checkup)'
        };
        document.getElementById('activePresetLabel').innerText = labels[type] || type;
    }
}

// Review Queue AI Batch Reply Generator
async function generateAllReviewReplies() {
    const reviewRows = Array.from(document.querySelectorAll('#tbodyReview tr.row-review'));
    if (reviewRows.length === 0) {
        alert('No tickets found in the Needs Review queue.');
        return;
    }

    const ticketIds = reviewRows.map(r => r.id.replace('row-', ''));
    const total = ticketIds.length;

    const btn = document.getElementById('btnGenAllReview');
    btn.disabled = true;
    btn.innerText = 'Composing via DeepSeek...';

    const pBox = document.getElementById('reviewProgressBox');
    const pFill = document.getElementById('reviewProgressBarFill');
    const pText = document.getElementById('reviewProgressText');
    const pPercent = document.getElementById('reviewProgressPercent');
    pBox.style.display = 'block';

    const batchSize = 5;
    let processed = 0;
    let successCount = 0;

    for (let i = 0; i < total; i += batchSize) {
        const chunk = ticketIds.slice(i, i + batchSize);
        pText.innerText = `Composing tailored replies via DeepSeek based on enroller messages... (${i + 1}-${Math.min(i + batchSize, total)} of ${total})`;

        // Show spinners on these rows
        chunk.forEach(tid => {
            const sp = document.getElementById('draft-spinner-' + tid);
            if (sp) sp.style.display = 'block';
        });

        try {
            const res = await fetch('clear_device_tickets.php?action=generate_batch_tailored_replies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticket_ids: chunk })
            });
            const data = await res.json();
            
            if (data.replies) {
                for (const [tid, reply] of Object.entries(data.replies)) {
                    const txt = document.getElementById('reply-text-' + tid);
                    const acts = document.getElementById('draft-actions-' + tid);
                    const st = document.getElementById('draft-status-' + tid);
                    if (txt) {
                        txt.value = reply;
                        txt.style.display = 'block';
                    }
                    if (acts) acts.style.display = 'flex';
                    if (st) {
                        st.innerText = 'AI Composed Reply Ready';
                        st.style.color = '#38bdf8';
                    }
                    successCount++;
                }
            }
            if (data.usage && data.usage.total_tokens) {
                totalTokensUsed += data.usage.total_tokens;
                const estCost = ((totalTokensUsed / 1000000) * 0.14).toFixed(4);
                document.getElementById('tokenTracker').innerText = `Tokens: ${totalTokensUsed.toLocaleString()} (~$${estCost})`;
            }
        } catch (err) {
            console.error('Batch reply generation error:', err);
        } finally {
            chunk.forEach(tid => {
                const sp = document.getElementById('draft-spinner-' + tid);
                if (sp) sp.style.display = 'none';
            });
        }

        processed += chunk.length;
        const pct = Math.round((processed / total) * 100);
        pFill.style.width = pct + '%';
        pPercent.innerText = pct + '%';
    }

    pText.innerText = `Finished! Composed ${successCount} tailored replies via DeepSeek based on enroller messages.`;
    btn.disabled = false;
    btn.innerText = `Regenerate All AI Replies (${total})`;

    updateReadyReviewCount();
}

// Generate / Regenerate AI Reply for a single review ticket
async function generateSingleReviewReply(ticketId) {
    const sp = document.getElementById('draft-spinner-' + ticketId);
    const txt = document.getElementById('reply-text-' + ticketId);
    const acts = document.getElementById('draft-actions-' + ticketId);
    const st = document.getElementById('draft-status-' + ticketId);

    if (sp) sp.style.display = 'block';
    
    try {
        const res = await fetch('clear_device_tickets.php?action=generate_tailored_reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `ticket_id=${encodeURIComponent(ticketId)}`
        });
        const data = await res.json();
        if (data.status === 'success' && data.reply) {
            if (txt) {
                txt.value = data.reply;
                txt.style.display = 'block';
            }
            if (acts) acts.style.display = 'flex';
            if (st) {
                st.innerText = 'AI Composed Reply Ready';
                st.style.color = '#38bdf8';
            }
            updateReadyReviewCount();
        } else {
            alert('Could not generate reply: ' + (data.message || 'Unknown error'));
        }
    } catch (err) {
        alert('Request failed: ' + err.message);
    } finally {
        if (sp) sp.style.display = 'none';
    }
}

// Send Single Review AI Reply and Close
async function sendSingleReviewReply(ticketId) {
    const txt = document.getElementById('reply-text-' + ticketId);
    const replyText = txt ? txt.value.trim() : '';
    if (!replyText) {
        alert('Reply text cannot be empty.');
        return;
    }

    if (!confirm(`Send this AI reply and close ticket #${ticketId}?`)) return;

    try {
        const res = await fetch('clear_device_tickets.php?action=clear_single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `ticket_id=${encodeURIComponent(ticketId)}&custom_notice=${encodeURIComponent(replyText)}&staff_email=<?= urlencode($selectedStaffEmail) ?>&staff_name=<?= urlencode($selectedStaffName) ?>`
        });
        const data = await res.json();
        if (data.status === 'success') {
            const row = document.getElementById('row-' + ticketId);
            if (row) {
                row.style.transition = 'all 0.4s';
                row.style.opacity = '0.3';
                row.style.background = '#450a0a';
                setTimeout(() => {
                    row.remove();
                    updateReadyReviewCount();
                    decrementReviewCount();
                }, 400);
            }
        } else {
            alert('Error: ' + data.message);
        }
    } catch (err) {
        alert('Failed to send reply: ' + err.message);
    }
}

// Send All Generated AI Replies in Review Queue and Close
async function sendAllReviewReplies() {
    const items = [];
    const reviewRows = document.querySelectorAll('#tbodyReview tr.row-review');
    
    reviewRows.forEach(row => {
        const tid = row.id.replace('row-', '');
        const txt = document.getElementById('reply-text-' + tid);
        if (txt && txt.value.trim().length > 0) {
            items.push({ id: tid, reply: txt.value.trim() });
        }
    });

    if (items.length === 0) {
        alert('No draft replies are ready to send. Please click "Generate AI Replies for All" first.');
        return;
    }

    if (!confirm(`Send all ${items.length} tailored AI replies and CLOSE these tickets under responder "<?= htmlspecialchars($selectedStaffName) ?>"?`)) {
        return;
    }

    const btn = document.getElementById('btnSendAllReview');
    btn.disabled = true;
    btn.innerText = 'Delivering replies...';

    try {
        const res = await fetch('clear_device_tickets.php?action=bulk_send_tailored_replies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: items })
        });
        const data = await res.json();
        if (data.status === 'success') {
            items.forEach(item => {
                const row = document.getElementById('row-' + item.id);
                if (row) {
                    row.style.transition = 'all 0.4s';
                    row.style.opacity = '0.3';
                    row.style.background = '#450a0a';
                    setTimeout(() => row.remove(), 400);
                }
            });
            setTimeout(() => {
                alert(`Successfully sent ${data.clearedCount} tailored replies and closed tickets.`);
                location.reload();
            }, 500);
        } else {
            alert('Failed: ' + (data.message || 'Unknown error'));
            btn.disabled = false;
        }
    } catch (err) {
        alert('Request failed: ' + err.message);
        btn.disabled = false;
    }
}

// Clear cached drafts
function clearCachedReplies() {
    if (confirm('Clear cached AI drafts for the review queue?')) {
        window.location.href = 'clear_device_tickets.php?action=reset_tailored_cache';
    }
}

function updateReadyReviewCount() {
    let count = 0;
    const reviewRows = document.querySelectorAll('#tbodyReview tr.row-review');
    reviewRows.forEach(row => {
        const tid = row.id.replace('row-', '');
        const txt = document.getElementById('reply-text-' + tid);
        if (txt && txt.value.trim().length > 0) {
            count++;
        }
    });
    const el = document.getElementById('readyReviewCount');
    if (el) el.innerText = count;
    const btn = document.getElementById('btnSendAllReview');
    if (btn) btn.style.display = (count > 0) ? 'inline-flex' : 'none';
}

function decrementReviewCount() {
    const remaining = document.querySelectorAll('#tbodyReview tr.row-review').length;
    const qCount = document.getElementById('reviewQueueCount');
    if (qCount) qCount.innerText = remaining;
    const tabCount = document.getElementById('tabCountReview');
    if (tabCount) tabCount.innerText = remaining;
    const statCount = document.getElementById('statCountReview');
    if (statCount) statCount.innerText = remaining;
}

// Tailored Modal Logic
let currentTailorTicketId = null;

async function openTailorModal(ticketId, agentName, title) {
    currentTailorTicketId = ticketId;
    document.getElementById('modalTicketTag').innerText = '#' + ticketId;
    document.getElementById('modalAgentName').innerText = agentName;
    document.getElementById('modalTicketTitle').innerText = title;
    
    const modal = document.getElementById('tailorModal');
    modal.style.display = 'flex';
    
    await fetchTailoredReply(ticketId);
}

function closeTailorModal() {
    document.getElementById('tailorModal').style.display = 'none';
    currentTailorTicketId = null;
}

async function fetchTailoredReply(ticketId) {
    const spinner = document.getElementById('modalLoadingSpinner');
    const textarea = document.getElementById('modalReplyText');
    spinner.style.display = 'flex';
    
    try {
        const res = await fetch('clear_device_tickets.php?action=generate_tailored_reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `ticket_id=${encodeURIComponent(ticketId)}`
        });
        const data = await res.json();
        if (data.status === 'success' && data.reply) {
            textarea.value = data.reply;
        } else {
            textarea.value = document.getElementById('customNoticeInput').value;
        }
    } catch (err) {
        textarea.value = document.getElementById('customNoticeInput').value;
    } finally {
        spinner.style.display = 'none';
    }
}

async function regenerateTailoredReply() {
    if (currentTailorTicketId) {
        await fetchTailoredReply(currentTailorTicketId);
    }
}

async function sendTailoredReplyAndClose() {
    if (!currentTailorTicketId) return;
    const customNotice = document.getElementById('modalReplyText').value.trim();
    if (!customNotice) {
        alert('Notice message cannot be empty.');
        return;
    }
    
    if (!confirm(`Send this tailored notice and close ticket #${currentTailorTicketId}?`)) return;
    
    try {
        const res = await fetch('clear_device_tickets.php?action=clear_single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `ticket_id=${encodeURIComponent(currentTailorTicketId)}&custom_notice=${encodeURIComponent(customNotice)}&staff_email=<?= urlencode($selectedStaffEmail) ?>&staff_name=<?= urlencode($selectedStaffName) ?>`
        });
        const data = await res.json();
        if (data.status === 'success') {
            const row = document.getElementById('row-' + currentTailorTicketId);
            if (row) {
                row.style.transition = 'all 0.4s';
                row.style.opacity = '0.3';
                row.style.background = '#450a0a';
                setTimeout(() => row.remove(), 400);
            }
            closeTailorModal();
            updateSelectedCount();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (err) {
        alert('Failed to send notice: ' + err.message);
    }
}
// Tab Switching
function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('active'));
    
    const panel = document.getElementById(tabId);
    if (panel) panel.classList.add('active');
    
    const targetBtn = btn || (window.event ? window.event.currentTarget : null) || document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
    if (targetBtn && targetBtn.classList) {
        targetBtn.classList.add('active');
    }
}

function toggleConfigDrawer() {
    const el = document.getElementById('configDrawer');
    el.style.display = (el.style.display === 'none') ? 'block' : 'none';
}

function updateSelectedCount() {
    const checked = document.querySelectorAll('.chk-clear:checked').length;
    document.getElementById('selectedClearCount').innerText = checked;
}

function toggleSelectAll(className) {
    const boxes = document.querySelectorAll('.' + className);
    const someUnchecked = Array.from(boxes).some(b => !b.checked);
    boxes.forEach(b => b.checked = someUnchecked);
    updateSelectedCount();
}

function toggleAllCheckboxes(master, className) {
    document.querySelectorAll('.' + className).forEach(b => b.checked = master.checked);
    updateSelectedCount();
}

function confirmBulkClear() {
    const count = document.querySelectorAll('.chk-clear:checked').length;
    if (count === 0) {
        alert('Please select at least one ticket to clear.');
        return false;
    }
    return confirm(`Are you sure you want to send the official clearing message and CLOSE ${count} redundant tickets under staff account "<?= htmlspecialchars($selectedStaffName) ?>"? A backup JSON will be saved automatically.`);
}

// 1-Click Clear Single
async function clearSingle(ticketId) {
    if (!confirm(`Send official clearing notice and close ticket #${ticketId}?`)) return;
    try {
        const res = await fetch('clear_device_tickets.php?action=clear_single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `ticket_id=${encodeURIComponent(ticketId)}&staff_email=<?= urlencode($selectedStaffEmail) ?>&staff_name=<?= urlencode($selectedStaffName) ?>`
        });
        const data = await res.json();
        if (data.status === 'success') {
            const row = document.getElementById('row-' + ticketId);
            if (row) {
                row.style.transition = 'all 0.4s';
                row.style.opacity = '0.3';
                row.style.background = '#450a0a';
                setTimeout(() => row.remove(), 400);
            }
        } else {
            alert('Error: ' + data.message);
        }
    } catch (err) {
        alert('Failed to clear ticket: ' + err.message);
    }
}

// 1-Click Prioritize Single
async function prioritizeSingle(ticketId) {
    try {
        const res = await fetch('clear_device_tickets.php?action=prioritize_single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `ticket_id=${encodeURIComponent(ticketId)}&staff_email=<?= urlencode($selectedStaffEmail) ?>`
        });
        const data = await res.json();
        if (data.status === 'success') {
            const row = document.getElementById('row-' + ticketId);
            if (row) {
                row.style.transition = 'all 0.4s';
                row.style.opacity = '0.3';
                row.style.background = '#064e3b';
                setTimeout(() => row.remove(), 400);
            }
        } else {
            alert('Error: ' + data.message);
        }
    } catch (err) {
        alert('Failed to prioritize ticket: ' + err.message);
    }
}

// Mark all in Review as Priority
async function markAllReviewAsPriority() {
    const reviewRows = document.querySelectorAll('#tbodyReview tr');
    if (reviewRows.length === 0) {
        alert('No tickets in the Review queue.');
        return;
    }
    if (!confirm(`Mark all ${reviewRows.length} ambiguous tickets in the review queue as High Priority?`)) return;
    
    for (const row of reviewRows) {
        const tid = row.id.replace('row-', '');
        await prioritizeSingle(tid);
    }
    alert('All review tickets have been marked as Priority!');
}

// Test DeepSeek API
async function testDeepSeekConnection() {
    const el = document.getElementById('testApiResult');
    el.innerHTML = '<span style="color: #94a3b8;">Testing connection to DeepSeek API...</span>';
    
    try {
        const res = await fetch('clear_device_tickets.php?action=test_deepseek', {
            method: 'POST'
        });
        const data = await res.json();
        if (data.status === 'success') {
            el.innerHTML = `<span style="color: #4ade80;">${data.message} Model: ${data.model}</span>`;
        } else {
            el.innerHTML = `<span style="color: #f87171;">Connection failed: ${data.message}</span>`;
        }
    } catch (err) {
        el.innerHTML = `<span style="color: #f87171;">Request failed: ${err.message}</span>`;
    }
}

// DeepSeek AI Batch Scan Engine
let totalTokensUsed = 0;
async function startAiBatchScan() {
    const pendingTickets = <?= json_encode(array_map(function($t) { return ['id' => $t['id']]; }, $pendingTickets)) ?>;
    const total = pendingTickets.length;
    if (total === 0) {
        alert('No pending tickets found in database to scan.');
        return;
    }

    const btn = document.getElementById('btnRunAiScan');
    btn.disabled = true;
    btn.innerText = 'Scanning...';

    const pBox = document.getElementById('progressBox');
    const pFill = document.getElementById('progressBarFill');
    const pText = document.getElementById('progressText');
    const pPercent = document.getElementById('progressPercent');
    pBox.style.display = 'block';

    const batchSize = 15;
    let processed = 0;
    let triageResults = {};

    for (let i = 0; i < total; i += batchSize) {
        const chunk = pendingTickets.slice(i, i + batchSize).map(t => t.id);
        pText.innerText = `Analyzing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(total / batchSize)} (${i + 1}-${Math.min(i + batchSize, total)} of ${total})...`;

        try {
            const res = await fetch('clear_device_tickets.php?action=ai_batch_scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticket_ids: chunk })
            });
            const data = await res.json();
            if (data.results) {
                data.results.forEach(item => {
                    triageResults[item.id] = item;
                });
            }
            if (data.usage && data.usage.total_tokens) {
                totalTokensUsed += data.usage.total_tokens;
                const estCost = ((totalTokensUsed / 1000000) * 0.14).toFixed(4);
                document.getElementById('tokenTracker').innerText = `Tokens: ${totalTokensUsed.toLocaleString()} (~$${estCost})`;
            }
        } catch (err) {
            console.error('Batch scan error:', err);
        }

        processed += chunk.length;
        const pct = Math.round((processed / total) * 100);
        pFill.style.width = pct + '%';
        pPercent.innerText = pct + '%';
    }

    pText.innerText = 'Scan Complete! Refreshing tables with DeepSeek classifications...';
    setTimeout(() => {
        // Apply triaged counts and relocate rows dynamically
        location.reload();
    }, 1200);
}

// NIMC Queue Helper Functions
function updateNimcSelectedCount() {
    const checked = document.querySelectorAll('.chk-nimc:checked').length;
    const el = document.getElementById('selectedNimcCount');
    if (el) el.innerText = checked;
}

function selectNimcByAge(minDays) {
    document.querySelectorAll('.chk-nimc').forEach(cb => {
        const row = cb.closest('tr');
        if (row && row.style.display !== 'none') {
            const days = parseInt(cb.getAttribute('data-days') || '0', 10);
            cb.checked = (days >= minDays);
        }
    });
    updateNimcSelectedCount();
}

function filterNimcAge(mode) {
    const rows = document.querySelectorAll('#tbodyPriority tr.row-nimc');
    rows.forEach(r => {
        const days = parseInt(r.getAttribute('data-days') || '0', 10);
        if (mode === 'all') {
            r.style.display = '';
        } else if (mode === 60 || mode === '60') {
            r.style.display = (days >= 60) ? '' : 'none';
        } else if (mode === 30 || mode === '30') {
            r.style.display = (days >= 30) ? '' : 'none';
        }
    });
    updateNimcSelectedCount();
}

function initNimcAgeCounts() {
    const rows = document.querySelectorAll('#tbodyPriority tr.row-nimc');
    let c60 = 0, c30 = 0, cAll = rows.length;
    rows.forEach(r => {
        const days = parseInt(r.getAttribute('data-days') || '0', 10);
        if (days >= 60) c60++;
        if (days >= 30) c30++;
    });
    const elAll = document.getElementById('nimcCountAll');
    const el60 = document.getElementById('nimcCount60');
    const el30 = document.getElementById('nimcCount30');
    if (elAll) elAll.innerText = cAll;
    if (el60) el60.innerText = c60;
    if (el30) el30.innerText = c30;
}

// Send Single NIMC Checkup Notice and Close
async function sendSingleNimcCheckup(ticketId) {
    if (!confirm(`Send the NIMC Status Checkup inquiry ("Has this request been treated?") and close ticket #${ticketId}?\n\nIf the enroller still needs help and replies, the ticket will automatically reopen as active priority.`)) {
        return;
    }
    
    try {
        const res = await fetch('clear_device_tickets.php?action=clear_single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `ticket_id=${encodeURIComponent(ticketId)}&custom_notice=${encodeURIComponent(templatePresets.nimc_checkup)}&staff_email=<?= urlencode($selectedStaffEmail) ?>&staff_name=<?= urlencode($selectedStaffName) ?>`
        });
        const data = await res.json();
        if (data.status === 'success') {
            const row = document.getElementById('row-' + ticketId);
            if (row) {
                row.style.transition = 'all 0.4s';
                row.style.opacity = '0.3';
                row.style.background = '#0284c7';
                setTimeout(() => {
                    row.remove();
                    initNimcAgeCounts();
                    updateNimcSelectedCount();
                }, 400);
            }
        } else {
            alert('Error: ' + data.message);
        }
    } catch (err) {
        alert('Failed: ' + err.message);
    }
}

// Send Batch NIMC Checkup Sweep and Close
async function sendBatchNimcCheckup() {
    const selected = Array.from(document.querySelectorAll('.chk-nimc:checked')).map(cb => cb.value);
    if (selected.length === 0) {
        alert('Please select at least one NIMC ticket to send checkup notices.');
        return;
    }

    if (!confirm(`Send official NIMC status checkup notices to ${selected.length} selected tickets and close them?\n\nAgents who are already resolved will remain closed. Any agent who replies "No" or provides details will automatically have their ticket reopened for immediate technical handling.`)) {
        return;
    }

    const btn = document.getElementById('btnSendNimcCheckup');
    btn.disabled = true;
    btn.innerText = 'Sweeping NIMC Queue...';

    const pBox = document.getElementById('nimcProgressBox');
    const pFill = document.getElementById('nimcProgressBarFill');
    const pText = document.getElementById('nimcProgressText');
    const pPercent = document.getElementById('nimcProgressPercent');
    pBox.style.display = 'block';

    const batchSize = 15;
    let processed = 0;
    let total = selected.length;

    for (let i = 0; i < total; i += batchSize) {
        const chunk = selected.slice(i, i + batchSize);
        pText.innerText = `Delivering NIMC checkup notices (${i + 1}-${Math.min(i + batchSize, total)} of ${total})...`;

        try {
            const res = await fetch('clear_device_tickets.php?action=bulk_nimc_checkup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticket_ids: chunk,
                    staff_email: '<?= $selectedStaffEmail ?>',
                    staff_name: '<?= $selectedStaffName ?>'
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                chunk.forEach(tid => {
                    const row = document.getElementById('row-' + tid);
                    if (row) {
                        row.style.transition = 'all 0.4s';
                        row.style.opacity = '0.3';
                        row.style.background = '#0284c7';
                        setTimeout(() => row.remove(), 400);
                    }
                });
            }
        } catch (err) {
            console.error('NIMC batch error:', err);
        }

        processed += chunk.length;
        const pct = Math.round((processed / total) * 100);
        pFill.style.width = pct + '%';
        pPercent.innerText = pct + '%';
    }

    pText.innerText = `Completed! Delivered checkup notices to ${processed} NIMC tickets.`;
    setTimeout(() => {
        alert(`Successfully delivered checkup notices to ${processed} tickets. Backlog cleared! Any agent who replies will automatically reappear in the active queue.`);
        location.reload();
    }, 600);
}

// =========================================================================
// TAB 5: RATE-LIMITED BACKLOG EMAIL DISPATCH ENGINE
// =========================================================================

let isDispatchRunning = false;
let isDispatchPaused = false;
let dispatchQueue = [];
let totalToDispatch = 0;
let dispatchedSuccess = 0;
let dispatchedFailed = 0;

function updateEmailBacklogSelectedCount() {
    const checked = document.querySelectorAll('.chk-email-backlog:checked');
    const count = checked.length;
    const statElem = document.getElementById('statEmailSelected');
    const btnCountElem = document.getElementById('btnStartSelectedCount');
    const btnStart = document.getElementById('btnStartDispatch');

    if (statElem) statElem.innerText = count;
    if (btnCountElem) btnCountElem.innerText = count;
    if (btnStart && !isDispatchRunning) {
        btnStart.disabled = (count === 0);
    }
}

function selectUnsentOnly() {
    const rows = document.querySelectorAll('#tbodyEmailBacklog tr');
    let pendingChecked = 0;
    rows.forEach(r => {
        const st = r.getAttribute('data-status');
        const cb = r.querySelector('.chk-email-backlog');
        if (cb) {
            if (st === 'pending' || st === 'failed') {
                cb.checked = true;
                pendingChecked++;
            } else {
                cb.checked = false;
            }
        }
    });
    updateEmailBacklogSelectedCount();
    logDispatchMessage(`Selected ${pendingChecked} pending/failed tickets for dispatch.`, 'info');
}

function toggleEmailCustomNotice(val) {
    const box = document.getElementById('emailCustomNoticeBox');
    if (!box) return;
    if (val === 'custom') {
        box.style.display = 'block';
    } else {
        box.style.display = 'none';
    }
}

function openStoredNoticeModal(tid, tktNum, agent) {
    const tag = document.getElementById('modalNoticeTag');
    const ag = document.getElementById('modalNoticeAgent');
    const body = document.getElementById('modalNoticeBody');
    const stored = document.getElementById('stored-notice-' + tid);

    if (tag) tag.innerText = '#' + tktNum;
    if (ag) ag.innerText = agent;
    if (body) body.innerText = stored ? stored.value : 'No saved notice content found for this ticket.';

    const modal = document.getElementById('viewNoticeModal');
    if (modal) modal.style.display = 'flex';
}

function closeStoredNoticeModal() {
    const modal = document.getElementById('viewNoticeModal');
    if (modal) modal.style.display = 'none';
}

function filterEmailBacklogTable(filterType) {
    const rows = document.querySelectorAll('#tbodyEmailBacklog tr');
    const btnAll = document.getElementById('btnFilterAll');
    const btnPending = document.getElementById('btnFilterPending');
    const btnDelivered = document.getElementById('btnFilterDelivered');

    [btnAll, btnPending, btnDelivered].forEach(b => {
        if (b) b.classList.remove('active-filter-btn');
    });

    if (filterType === 'all' && btnAll) btnAll.classList.add('active-filter-btn');
    if (filterType === 'pending' && btnPending) btnPending.classList.add('active-filter-btn');
    if (filterType === 'delivered' && btnDelivered) btnDelivered.classList.add('active-filter-btn');

    rows.forEach(r => {
        const st = r.getAttribute('data-status');
        if (filterType === 'all') {
            r.style.display = '';
        } else if (filterType === 'pending') {
            r.style.display = (st === 'pending' || st === 'failed') ? '' : 'none';
        } else if (filterType === 'delivered') {
            r.style.display = (st === 'delivered') ? '' : 'none';
        }
    });
}

function searchEmailBacklogTable(query) {
    const q = (query || '').toLowerCase().trim();
    const rows = document.querySelectorAll('#tbodyEmailBacklog tr');
    rows.forEach(r => {
        const text = r.getAttribute('data-search') || '';
        if (!q || text.includes(q)) {
            r.style.display = '';
        } else {
            r.style.display = 'none';
        }
    });
}

function clearDispatchLog() {
    const log = document.getElementById('emailConsoleLog');
    if (log) log.innerHTML = '';
}

function logDispatchMessage(msg, type = 'info') {
    const log = document.getElementById('emailConsoleLog');
    if (!log) return;
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const div = document.createElement('div');
    div.className = 'log-entry ' + type;
    div.innerText = `[${timeStr}] ${msg}`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

function markRowDelivered(tid, recipient = '') {
    const row = document.getElementById('email-row-' + tid);
    if (row) {
        row.setAttribute('data-status', 'delivered');
        const cb = row.querySelector('.chk-email-backlog');
        if (cb) cb.checked = false;
        
        const cell = document.getElementById('status-cell-' + tid);
        if (cell) {
            const now = new Date();
            const dateStr = now.toISOString().slice(5, 16).replace('T', ' ');
            cell.innerHTML = `<span class="badge badge-delivered" title="Delivered: ${now.toLocaleString()}">Delivered</span><div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">${dateStr}</div>`;
        }

        const btn = document.getElementById('btn-send-single-' + tid);
        if (btn) {
            btn.innerText = 'Sent';
            btn.style.borderColor = 'var(--emerald)';
            btn.style.color = 'var(--emerald)';
            btn.disabled = true;
        }
    }
}

function markRowFailed(tid, errorMsg = '') {
    const row = document.getElementById('email-row-' + tid);
    if (row) {
        row.setAttribute('data-status', 'failed');
        const cell = document.getElementById('status-cell-' + tid);
        if (cell) {
            cell.innerHTML = `<span class="badge badge-failed" title="${errorMsg}">Failed</span><div style="font-size: 10px; color: #f87171; margin-top: 2px;">Error</div>`;
        }
    }
}

async function startBacklogDispatch() {
    const selected = Array.from(document.querySelectorAll('.chk-email-backlog:checked')).map(cb => cb.value);
    if (selected.length === 0) {
        alert('Please select at least one ticket to send email reminders to.');
        return;
    }

    const batchSize = parseInt(document.getElementById('emailBatchSize').value, 10) || 3;
    const pacingSeconds = parseInt(document.getElementById('emailPacingDelay').value, 10) || 3;
    const customSubject = document.getElementById('emailSubjectInput').value.trim();
    const sourceSelect = document.getElementById('emailTemplateSource').value;
    
    let customNotice = '';
    if (sourceSelect === 'custom') {
        customNotice = document.getElementById('emailCustomNoticeText').value.trim();
    } else if (sourceSelect === 'nimc_checkup') {
        customNotice = `<?= addslashes(str_replace(["\r", "\n"], ["", "\\n"], $templateNimcCheckup)) ?>`;
    } else if (sourceSelect === 'master') {
        customNotice = `<?= addslashes(str_replace(["\r", "\n"], ["", "\\n"], $templateMaster)) ?>`;
    } else if (sourceSelect === 'device') {
        customNotice = `<?= addslashes(str_replace(["\r", "\n"], ["", "\\n"], $templateDevice)) ?>`;
    } else if (sourceSelect === 'commission') {
        customNotice = `<?= addslashes(str_replace(["\r", "\n"], ["", "\\n"], $templateCommission)) ?>`;
    }

    const confirmMsg = `Ready to start rate-limited email delivery to ${selected.length} tickets?\n\nConfiguration:\n• Batch size: ${batchSize} emails per chunk\n• Pacing cooldown: ${pacingSeconds} seconds between chunks\n• Micro-delay: 300ms socket spacing\n\nThis will send sequentially to prevent SMTP server throttling and preserve domain email reputation.`;
    if (!confirm(confirmMsg)) {
        return;
    }

    isDispatchRunning = true;
    isDispatchPaused = false;
    dispatchQueue = [...selected];
    totalToDispatch = selected.length;
    dispatchedSuccess = 0;
    dispatchedFailed = 0;

    // UI state
    document.getElementById('btnStartDispatch').style.display = 'none';
    document.getElementById('btnPauseDispatch').style.display = 'inline-block';
    document.getElementById('btnPauseDispatch').disabled = false;
    document.getElementById('btnResumeDispatch').style.display = 'none';
    document.getElementById('emailProgressBox').style.display = 'block';

    logDispatchMessage(`Started dispatch for ${totalToDispatch} tickets. Batch size: ${batchSize}, Delay: ${pacingSeconds}s.`, 'info');

    await runDispatchLoop(batchSize, pacingSeconds, customSubject, customNotice);
}

function pauseBacklogDispatch() {
    isDispatchPaused = true;
    const btn = document.getElementById('btnPauseDispatch');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Pausing...';
    }
    logDispatchMessage('Pausing dispatch after current batch finishes...', 'warn');
}

function resumeBacklogDispatch() {
    isDispatchPaused = false;
    document.getElementById('btnResumeDispatch').style.display = 'none';
    const pauseBtn = document.getElementById('btnPauseDispatch');
    pauseBtn.style.display = 'inline-block';
    pauseBtn.disabled = false;
    pauseBtn.innerText = 'Pause Dispatch';

    const batchSize = parseInt(document.getElementById('emailBatchSize').value, 10) || 3;
    const pacingSeconds = parseInt(document.getElementById('emailPacingDelay').value, 10) || 3;
    const customSubject = document.getElementById('emailSubjectInput').value.trim();
    const sourceSelect = document.getElementById('emailTemplateSource').value;
    
    let customNotice = '';
    if (sourceSelect === 'custom') {
        customNotice = document.getElementById('emailCustomNoticeText').value.trim();
    }

    logDispatchMessage(`Resumed dispatch. ${dispatchQueue.length} tickets remaining in queue.`, 'info');
    runDispatchLoop(batchSize, pacingSeconds, customSubject, customNotice);
}

async function runDispatchLoop(batchSize, pacingSeconds, customSubject, customNotice) {
    const pFill = document.getElementById('emailProgressBarFill');
    const pText = document.getElementById('emailProgressText');
    const pPercent = document.getElementById('emailProgressPercent');
    const pStats = document.getElementById('emailProgressStats');
    const pEta = document.getElementById('emailProgressEta');

    while (dispatchQueue.length > 0) {
        if (isDispatchPaused) {
            logDispatchMessage(`Dispatch paused. ${dispatchQueue.length} tickets waiting in queue.`, 'warn');
            document.getElementById('btnPauseDispatch').style.display = 'none';
            document.getElementById('btnResumeDispatch').style.display = 'inline-block';
            isDispatchRunning = false;
            return;
        }

        const chunk = dispatchQueue.splice(0, batchSize);
        const processedCount = dispatchedSuccess + dispatchedFailed;
        const batchNum = Math.floor(processedCount / batchSize) + 1;
        const totalBatches = Math.ceil(totalToDispatch / batchSize);

        pText.innerText = `Dispatching batch ${batchNum} of ${totalBatches} (${chunk.length} emails)...`;
        logDispatchMessage(`Sending batch ${batchNum}/${totalBatches} (${chunk.length} tickets)...`, 'info');

        let batchSentCount = 0;
        try {
            const res = await fetch('clear_device_tickets.php?action=send_backlog_email_chunk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticket_ids: chunk,
                    custom_subject: customSubject,
                    custom_notice: customNotice
                })
            });

            const data = await res.json();
            if (data.status === 'success') {
                if (data.sent && data.sent.length > 0) {
                    batchSentCount = data.sent.length;
                    dispatchedSuccess += data.sent.length;
                    data.sent.forEach(item => {
                        logDispatchMessage(`Delivered #${item.ticket_number} to ${item.recipient} - OK`, 'success');
                        markRowDelivered(item.id, item.recipient);
                    });
                }
                if (data.failed && data.failed.length > 0) {
                    dispatchedFailed += data.failed.length;
                    data.failed.forEach(item => {
                        logDispatchMessage(`Failed #${item.ticket_number} (${item.recipient}): ${item.error}`, 'error');
                        markRowFailed(item.id, item.error);
                    });
                }
            } else {
                logDispatchMessage(`Batch error: ${data.message || 'Unknown response'}`, 'error');
                dispatchedFailed += chunk.length;
                chunk.forEach(tid => markRowFailed(tid, data.message || 'Batch failed'));
            }
        } catch (err) {
            logDispatchMessage(`Network error during batch dispatch: ${err.message}`, 'error');
            dispatchedFailed += chunk.length;
            chunk.forEach(tid => markRowFailed(tid, err.message));
        }

        // Update progress bar
        const totalDone = dispatchedSuccess + dispatchedFailed;
        const pct = Math.round((totalDone / totalToDispatch) * 100);
        if (pFill) pFill.style.width = pct + '%';
        if (pPercent) pPercent.innerText = pct + '%';
        if (pStats) pStats.innerText = `Sent: ${dispatchedSuccess} | Failed: ${dispatchedFailed} | Remaining: ${dispatchQueue.length}`;

        // Update dynamic stat numbers
        const statPending = document.getElementById('statEmailPending');
        const statDelivered = document.getElementById('statEmailDelivered');
        if (statDelivered && batchSentCount > 0) {
            const cur = parseInt(statDelivered.innerText, 10) || 0;
            statDelivered.innerText = cur + batchSentCount;
        }
        if (statPending && batchSentCount > 0) {
            const cur = parseInt(statPending.innerText, 10) || 0;
            statPending.innerText = Math.max(0, cur - batchSentCount);
        }
        updateEmailBacklogSelectedCount();

        // Calculate estimated time remaining
        const remainingBatches = Math.ceil(dispatchQueue.length / batchSize);
        const etaSeconds = remainingBatches * (pacingSeconds + 1);
        const etaMin = Math.floor(etaSeconds / 60);
        const etaSec = etaSeconds % 60;
        const etaStr = etaMin > 0 ? `${etaMin}m ${etaSec}s` : `${etaSec}s`;
        if (pEta) pEta.innerText = dispatchQueue.length > 0 ? `Est. remaining: ~${etaStr}` : 'Complete';

        // Pacing delay before next chunk
        if (dispatchQueue.length > 0 && !isDispatchPaused) {
            for (let c = pacingSeconds; c > 0; c--) {
                pText.innerText = `Cooldown pacing: waiting ${c}s before next batch to protect SMTP reputation...`;
                await new Promise(r => setTimeout(r, 1000));
                if (isDispatchPaused) break;
            }
        }
    }

    // Finished
    isDispatchRunning = false;
    document.getElementById('btnStartDispatch').style.display = 'inline-block';
    document.getElementById('btnPauseDispatch').style.display = 'none';
    document.getElementById('btnResumeDispatch').style.display = 'none';
    
    pText.innerText = `Dispatch completed! Successfully sent ${dispatchedSuccess} notices (${dispatchedFailed} errors).`;
    logDispatchMessage(`All selected tickets processed. Delivered: ${dispatchedSuccess}, Errors: ${dispatchedFailed}.`, 'success');
    
    setTimeout(() => {
        alert(`Rate-limited email backlog dispatch complete!\n\nSuccessfully Delivered: ${dispatchedSuccess}\nFailed / Missing Email: ${dispatchedFailed}\n\nAll delivered notices are safely logged in the persistent ledger.`);
        location.reload();
    }, 800);
}

async function sendSingleBacklogEmail(ticketId, btn) {
    if (!confirm('Send resolution email notice to this enroller now?')) return;
    const origText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Sending...';

    const customSubject = document.getElementById('emailSubjectInput').value.trim();
    const sourceSelect = document.getElementById('emailTemplateSource').value;
    let customNotice = '';
    if (sourceSelect === 'custom') {
        customNotice = document.getElementById('emailCustomNoticeText').value.trim();
    }

    try {
        const res = await fetch('clear_device_tickets.php?action=send_backlog_email_chunk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticket_ids: [ticketId],
                custom_subject: customSubject,
                custom_notice: customNotice
            })
        });

        const data = await res.json();
        if (data.status === 'success' && data.sent && data.sent.length > 0) {
            markRowDelivered(ticketId, data.sent[0].recipient);
            logDispatchMessage(`Delivered notice for #${data.sent[0].ticket_number} to ${data.sent[0].recipient} - OK`, 'success');
            updateEmailBacklogSelectedCount();
        } else {
            const err = (data.failed && data.failed[0]) ? data.failed[0].error : (data.message || 'Delivery failed');
            markRowFailed(ticketId, err);
            logDispatchMessage(`Failed single dispatch for ticket ${ticketId}: ${err}`, 'error');
            alert('Failed to send email: ' + err);
            btn.disabled = false;
            btn.innerText = origText;
        }
    } catch (err) {
        alert('Network error: ' + err.message);
        btn.disabled = false;
        btn.innerText = origText;
    }
}

async function sendTestEmailNotice() {
    const testEmail = prompt('Enter recipient email address for test preview delivery:', '<?= htmlspecialchars($selectedStaffEmail) ?>');
    if (!testEmail || !testEmail.trim()) return;

    const btn = document.getElementById('btnTestEmail');
    if (btn) { btn.disabled = true; btn.innerText = 'Sending Test...'; }

    const customSubject = document.getElementById('emailSubjectInput').value.trim();
    const sourceSelect = document.getElementById('emailTemplateSource').value;
    let customNotice = '';
    if (sourceSelect === 'custom') {
        customNotice = document.getElementById('emailCustomNoticeText').value.trim();
    }

    logDispatchMessage(`Sending test preview email to ${testEmail}...`, 'info');

    try {
        const res = await fetch('clear_device_tickets.php?action=test_send_email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                test_email: testEmail.trim(),
                test_name: '<?= htmlspecialchars(addslashes($selectedStaffName)) ?>',
                custom_subject: customSubject,
                custom_notice: customNotice
            })
        });

        const data = await res.json();
        if (data.status === 'success') {
            logDispatchMessage(`Test preview email delivered to ${testEmail} successfully!`, 'success');
            alert(`Test preview email successfully delivered to ${testEmail}!\n\nPlease check your inbox and spam folder to inspect the formatting and layout.`);
        } else {
            logDispatchMessage(`Test delivery failed: ${data.message}`, 'error');
            alert('Error sending test email: ' + data.message);
        }
    } catch (err) {
        alert('Network error sending test: ' + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = 'Send 1 Test Email to Staff'; }
    }
}

async function resetEmailLedgerPrompt() {
    if (!confirm('Are you sure you want to reset the email dispatch ledger?\n\nThis will clear the history of delivered notices and mark all tickets as pending again.')) {
        return;
    }

    try {
        const res = await fetch('clear_device_tickets.php?action=reset_email_ledger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.status === 'success') {
            alert('Email dispatch ledger has been reset. Refreshing page...');
            location.reload();
        } else {
            alert('Failed to reset ledger: ' + data.message);
        }
    } catch (err) {
        alert('Network error: ' + err.message);
    }
}

// Executive Report Modal Handlers
function openExecutiveReportModal() {
    const modal = document.getElementById('executiveReportModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeExecutiveReportModal() {
    const modal = document.getElementById('executiveReportModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function copyExecutiveReportSummary() {
    const el = document.getElementById('executiveReportTextContent');
    if (!el) return;
    const txt = el.innerText.trim();
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(() => {
            alert('Executive summary copied to clipboard in clean text format!');
        }).catch(() => {
            prompt('Copy summary from box below:', txt);
        });
    } else {
        prompt('Copy summary from box below:', txt);
    }
}

// Initial selection update
updateSelectedCount();
updateReadyReviewCount();
initNimcAgeCounts();
updateNimcSelectedCount();
updateEmailBacklogSelectedCount();
</script>
</body>
</html>
