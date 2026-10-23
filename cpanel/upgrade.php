<?php
require 'db.php';

try {
    // Add columns if they don't exist
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

    // Populate existing data
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

    echo "Upgrade successful!";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
