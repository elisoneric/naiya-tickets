<?php
require 'db.php';

echo "Starting Image Migration...\n<br>";

function saveBase64ImageMigrate($base64Data, $folder = 'uploads') {
    if (strpos($base64Data, 'data:image/') !== 0) {
        return $base64Data;
    }

    if (!is_dir($folder)) {
        mkdir($folder, 0777, true);
    }

    list($type, $data) = explode(';', $base64Data);
    list(, $data)      = explode(',', $data);
    
    $decodedData = base64_decode($data);
    if ($decodedData === false) {
        return $base64Data;
    }

    $extension = 'png';
    if (strpos($type, 'jpeg') !== false || strpos($type, 'jpg') !== false) $extension = 'jpg';
    elseif (strpos($type, 'gif') !== false) $extension = 'gif';
    elseif (strpos($type, 'webp') !== false) $extension = 'webp';

    $filename = uniqid('img_') . '_' . time() . '.' . $extension;
    $filepath = $folder . '/' . $filename;

    if (file_put_contents($filepath, $decodedData)) {
        return '/' . $folder . '/' . $filename;
    }
    
    return $base64Data;
}

try {
    // 1. Migrate Users Avatars
    echo "Migrating User Avatars...\n<br>";
    $stmt = $pdo->query("SELECT email, avatar FROM users WHERE avatar LIKE 'data:image/%'");
    $users = $stmt->fetchAll();
    $updateUser = $pdo->prepare("UPDATE users SET avatar = ? WHERE email = ?");
    $userCount = 0;
    foreach ($users as $u) {
        $newUrl = saveBase64ImageMigrate($u['avatar'], 'uploads/avatars');
        if ($newUrl !== $u['avatar']) {
            $updateUser->execute([$newUrl, $u['email']]);
            $userCount++;
        }
    }
    echo "Migrated $userCount user avatars.\n<br>";

    // 2. Migrate Feedback Proof Images
    echo "Migrating Feedback Images...\n<br>";
    $stmt = $pdo->query("SELECT id, proof_image FROM feedback WHERE proof_image LIKE 'data:image/%'");
    $feedback = $stmt->fetchAll();
    $updateFeedback = $pdo->prepare("UPDATE feedback SET proof_image = ? WHERE id = ?");
    $feedbackCount = 0;
    foreach ($feedback as $f) {
        $newUrl = saveBase64ImageMigrate($f['proof_image'], 'uploads/feedback');
        if ($newUrl !== $f['proof_image']) {
            $updateFeedback->execute([$newUrl, $f['id']]);
            $feedbackCount++;
        }
    }
    echo "Migrated $feedbackCount feedback images.\n<br>";

    // 3. Migrate Tickets Attachments and Messages
    echo "Migrating Tickets Attachments and Messages...\n<br>";
    $stmt = $pdo->query("SELECT id, attachments, messages FROM tickets");
    $tickets = $stmt->fetchAll();
    $updateTicket = $pdo->prepare("UPDATE tickets SET attachments = ?, messages = ? WHERE id = ?");
    $ticketCount = 0;
    
    foreach ($tickets as $t) {
        $changed = false;
        
        // Attachments
        $attachments = json_decode($t['attachments'] ?? '[]', true);
        if (is_array($attachments)) {
            foreach ($attachments as $k => $att) {
                if (is_string($att) && strpos($att, 'data:image/') === 0) {
                    $attachments[$k] = saveBase64ImageMigrate($att, 'uploads/tickets');
                    $changed = true;
                }
            }
        }

        // Messages
        $messages = json_decode($t['messages'] ?? '[]', true);
        if (is_array($messages)) {
            foreach ($messages as $k => $msg) {
                if (isset($msg['attachments']) && is_array($msg['attachments'])) {
                    foreach ($msg['attachments'] as $ak => $att) {
                        if (is_string($att) && strpos($att, 'data:image/') === 0) {
                            $messages[$k]['attachments'][$ak] = saveBase64ImageMigrate($att, 'uploads/messages');
                            $changed = true;
                        }
                    }
                }
            }
        }

        if ($changed) {
            $updateTicket->execute([json_encode($attachments), json_encode($messages), $t['id']]);
            $ticketCount++;
        }
    }
    echo "Migrated images in $ticketCount tickets.\n<br>";

    echo "<b>Migration Complete!</b>\n<br>";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
