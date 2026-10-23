<?php
// upgrade_db.php
// Standalone script to trigger the DB migration and schema updates

header('Content-Type: text/plain');
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/db.php';

echo "Starting Database Upgrade...\n";

$queries = [
    "ALTER TABLE feedback CHANGE image_url proof_image LONGTEXT",
    "ALTER TABLE users ADD COLUMN alt_email VARCHAR(255)",
    "ALTER TABLE users ADD COLUMN is_root TINYINT(1) DEFAULT 0",
    "UPDATE users SET is_root = 1 WHERE email = 'itstaff'",
    "CREATE TABLE IF NOT EXISTS feedback (
        id VARCHAR(50) PRIMARY KEY,
        type VARCHAR(50),
        email VARCHAR(191),
        name VARCHAR(255),
        content TEXT,
        proof_image LONGTEXT,
        is_resolved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )",
    "CREATE TABLE IF NOT EXISTS otps (
        email VARCHAR(191) PRIMARY KEY,
        otp VARCHAR(10),
        expires_at TIMESTAMP
    )"
];

foreach ($queries as $query) {
    try {
        $pdo->exec($query);
        echo "[OK] " . explode(' ', trim($query))[0] . " executed successfully.\n";
    } catch (Exception $e) {
        // Ignore duplicate column/table errors
        echo "[IGNORED/ERROR] " . $e->getMessage() . "\n";
    }
}

echo "\nStarting Agent Migration from 'settings' table to 'users' table...\n";

try {
    $stmt = $pdo->prepare("SELECT value FROM settings WHERE id = 'agents'");
    $stmt->execute();
    $row = $stmt->fetch();
    
    if ($row) {
        $json = json_decode($row['value'], true);
        $agents = (isset($json['agents']) && is_array($json['agents'])) ? array_values($json['agents']) : (is_array($json) ? array_values($json) : []);
        
        $insertStmt = $pdo->prepare("INSERT IGNORE INTO users (email, name, role, team_lead_id) VALUES (?, ?, 'agent', ?)");
        
        $migratedCount = 0;
        foreach ($agents as $agent) {
            $email = strtolower($agent['email'] ?? '');
            if ($email) {
                $name = explode('@', $email)[0];
                $teamLeadId = $agent['teamLeadId'] ?? null;
                $insertStmt->execute([$email, $name, $teamLeadId]);
                $migratedCount++;
            }
        }
        echo "[OK] Migrated $migratedCount agents to the users table.\n";
    } else {
        echo "[INFO] No agents found in the settings table to migrate.\n";
    }
} catch (Exception $e) {
    echo "[ERROR] Agent migration failed: " . $e->getMessage() . "\n";
}

echo "\nDatabase Upgrade Complete!\n";
?>
