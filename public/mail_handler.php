<?php
/**
 * NA'IYA Ticket System Mail Handler
 * 
 * Instructions:
 * 1. Ensure PHPMailer is downloaded and placed in public/PHPMailer/
 * 2. Update credentials below
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    echo json_encode(['success' => false, 'error' => 'Invalid JSON input']);
    exit();
}

$to = isset($input['to']) ? $input['to'] : '';
$subject = isset($input['subject']) ? $input['subject'] : '';
$body = isset($input['body']) ? $input['body'] : '';

if (empty($to) || empty($subject) || empty($body)) {
    echo json_encode(['success' => false, 'error' => 'Missing fields (to, subject, or body)']);
    exit();
}

// Ensure you have uploaded PHPMailer to your server inside a 'PHPMailer' folder
require 'PHPMailer/src/Exception.php';
require 'PHPMailer/src/PHPMailer.php';
require 'PHPMailer/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$mail = new PHPMailer(true);

try {
    //Server settings
    $mail->SMTPDebug = 0;                      //Enable verbose debug output
    $mail->isSMTP();                           //Send using SMTP
    $mail->Host       = 'mail.naiyatechnology.org'; //Set the SMTP server to send through
    $mail->SMTPAuth   = true;                  //Enable SMTP authentication
    $mail->Username   = 'noreply@naiyatechnology.org'; //SMTP username
    $mail->Password   = 'EF267G2Q4Y2ES5SP';  //SMTP password
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS; //Enable implicit TLS encryption
    $mail->Port       = 465;                   //TCP port to connect to; use 587 if you have set `SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS`

    //Recipients
    $mail->setFrom('noreply@naiyatechnology.org', 'NA\'IYA IT TICKETING BOT');
    $mail->addAddress($to);

    //Content
    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body    = $body;

    $mail->send();
    echo json_encode(['success' => true]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => "Message could not be sent. Mailer Error: {$mail->ErrorInfo}"]);
}
?>
