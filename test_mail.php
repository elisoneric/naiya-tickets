<?php
require 'public/PHPMailer/src/Exception.php';
require 'public/PHPMailer/src/PHPMailer.php';
require 'public/PHPMailer/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$mail = new PHPMailer(true);

try {
    $mail->SMTPDebug = 2;
    $mail->isSMTP();
    $mail->Host       = 'mail.naiyatechnology.org';
    $mail->SMTPAuth   = true;
    $mail->Username   = 'noreply@naiyatechnology.org';
    $mail->Password   = 'EF267G2Q4Y2ES5SP';
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port       = 465;

    $mail->setFrom('noreply@naiyatechnology.org', 'NA\'IYA IT TICKETING BOT');
    $mail->addAddress('test@example.com');

    $mail->isHTML(true);
    $mail->Subject = "Your NA'IYA Support OTP";
    $mail->Body    = "This is a test OTP: 123456";

    $mail->send();
    echo "Message has been sent";
} catch (Exception $e) {
    echo "Message could not be sent. Mailer Error: {$mail->ErrorInfo}";
}
