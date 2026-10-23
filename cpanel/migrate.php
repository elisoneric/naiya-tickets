<?php
require 'db.php';

// Increase limits for large backups
ini_set('memory_limit', '1024M'); // Increased to 1GB for safety
set_time_limit(600); // 10 minutes

// 1. CHECK FOR LOCAL FILE FIRST (Bypasses Server Upload Limits)
$jsonFile = __DIR__ . '/backup.json';

if (file_exists($jsonFile)) {
    // Found the file on the server!
    $input = file_get_contents($jsonFile);
    $data = json_decode($input, true);
    $method = 'POST'; // Force script to act like it received a POST
    $source = "Loaded from local file: backup.json";
} else {
    // No local file, try reading standard upload
    $method = $_SERVER['REQUEST_METHOD'];
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    $source = "Loaded from browser upload";
}

// Support both export formats: { meta: ..., data: ... } OR direct object
$backupData = $data['data'] ?? $data ?? [];

// Check if this is a Firebase export file
if (isset($backupData['tickets']) && is_array($backupData['tickets']) && !isset(array_values($backupData['tickets'])[0]['id'])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'This is a Firebase export file. Please use the "Import to Firebase" button instead.']);
    exit;
}

try {
    // --- 1. Schema Creation (Run OUTSIDE transaction because DDL auto-commits) ---
    
    // Users Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        email VARCHAR(191) PRIMARY KEY,
        name VARCHAR(255),
        password VARCHAR(255),
        role VARCHAR(50),
        avatar TEXT,
        team_lead_id VARCHAR(50) NULL,
        managed_team_id VARCHAR(50) NULL,
        specialized_categories JSON NULL,
        is_root TINYINT(1) DEFAULT 0,
        alt_email VARCHAR(255) NULL
    )");

    // Tickets Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS tickets (
        id VARCHAR(50) PRIMARY KEY,
        ticket_number VARCHAR(50),
        title VARCHAR(255),
        category VARCHAR(255),
        description TEXT,
        status VARCHAR(50),
        priority VARCHAR(50),
        created_by_email VARCHAR(191),
        created_by_name VARCHAR(255),
        assigned_to_email VARCHAR(191) NULL,
        team_lead_id VARCHAR(50) NULL,
        is_escalated TINYINT(1) DEFAULT 0,
        is_pinned TINYINT(1) DEFAULT 0,
        is_read_by_staff TINYINT(1) DEFAULT 0,
        is_locked TINYINT(1) DEFAULT 0,
        locked_by VARCHAR(191) NULL,
        project VARCHAR(100) DEFAULT 'Dont Know',
        created_at DATETIME,
        updated_at DATETIME,
        last_agent_reply_at DATETIME,
        attachments LONGTEXT,
        read_by JSON,
        messages JSON
    )");

    // Feedback Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS feedback (
        id VARCHAR(50) PRIMARY KEY,
        type VARCHAR(50),
        email VARCHAR(191),
        name VARCHAR(255),
        content TEXT,
        proof_image LONGTEXT,
        is_resolved TINYINT(1) DEFAULT 0,
        created_at DATETIME
    )");

    // Settings Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS settings (
        id VARCHAR(50) PRIMARY KEY,
        value JSON
    )");

    // --- 2. Data Import ---
    $importedCount = 0;
    
    if ($method === 'POST' && !empty($backupData)) {
        
        // CLEAN SLATE: Run TRUNCATE *before* transaction
        $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
        $pdo->exec("TRUNCATE TABLE users");
        $pdo->exec("TRUNCATE TABLE tickets");
        $pdo->exec("TRUNCATE TABLE feedback");
        $pdo->exec("TRUNCATE TABLE settings");
        $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");

        // START TRANSACTION (Only for INSERTs now)
        $pdo->beginTransaction();

        function fmtDate($iso) {
            if (!$iso) return date('Y-m-d H:i:s');
            if (is_array($iso) && isset($iso['seconds'])) {
                return date('Y-m-d H:i:s', $iso['seconds']);
            }
            return date('Y-m-d H:i:s', strtotime($iso));
        }

        // Import Staff
        if (!empty($backupData['staff'])) {
            $stmtUser = $pdo->prepare("INSERT INTO users (email, name, password, role, avatar, specialized_categories, is_root) VALUES (?, ?, ?, ?, ?, ?, ?)");
            foreach ($backupData['staff'] as $u) {
                $isRoot = (
                    strtolower($u['email'] ?? '') === 'itstaff' ||
                    !empty($u['isRoot']) ||
                    (isset($u['is_root']) && ($u['is_root'] == 1 || $u['is_root'] === '1' || $u['is_root'] === true))
                ) ? 1 : 0;
                $stmtUser->execute([
                    $u['email'], $u['name'], $u['password'], 'staff', $u['avatar'] ?? '', 
                    json_encode($u['specializedCategories'] ?? []),
                    $isRoot
                ]);
            }
        }

        // Import Team Leads
        $leads = $backupData['team_leads'] ?? $backupData['leads'] ?? [];
        if (!empty($leads)) {
            $stmtTL = $pdo->prepare("REPLACE INTO users (email, name, password, role, avatar, managed_team_id) VALUES (?, ?, ?, ?, ?, ?)");
            foreach ($leads as $tl) {
                $stmtTL->execute([
                    $tl['email'], $tl['name'], $tl['password'], 'team_lead', $tl['avatar'] ?? '', $tl['id']
                ]);
            }
        }

        // Import Settings
        $agents = $backupData['agents'] ?? [];
        if (!empty($agents)) {
             $pdo->prepare("INSERT INTO settings (id, value) VALUES ('agents', ?)")->execute([json_encode(['agents' => $agents])]);
        }
        
        $genSettings = $backupData['settings'] ?? ['categories' => []];
        $pdo->prepare("INSERT INTO settings (id, value) VALUES ('general', ?)")->execute([json_encode($genSettings)]);

        // Import Tickets
        if (!empty($backupData['tickets'])) {
            $stmtTicket = $pdo->prepare("INSERT INTO tickets (
                id, ticket_number, title, category, description, status, priority, 
                created_by_email, created_by_name, assigned_to_email, team_lead_id, 
                is_escalated, is_pinned, is_read_by_staff, is_locked, locked_by, 
                project, created_at, updated_at, last_agent_reply_at, 
                attachments, read_by, messages
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

            foreach ($backupData['tickets'] as $t) {
                $stmtTicket->execute([
                    $t['id'], 
                    $t['ticketNumber'], 
                    $t['title'], 
                    $t['category'], 
                    $t['description'], 
                    $t['status'], 
                    $t['priority'], 
                    $t['createdByEmail'], 
                    $t['createdByName'], 
                    $t['assignedToEmail'] ?? null, 
                    $t['teamLeadId'] ?? null, 
                    !empty($t['isEscalated']) ? 1 : 0, 
                    !empty($t['isPinned']) ? 1 : 0, 
                    !empty($t['isReadByStaff']) ? 1 : 0, 
                    !empty($t['isLocked']) ? 1 : 0, 
                    $t['lockedBy'] ?? null, 
                    $t['project'] ?? 'Dont Know', 
                    fmtDate($t['createdAt']), 
                    fmtDate($t['updatedAt']), 
                    fmtDate($t['lastAgentReplyAt'] ?? $t['createdAt']), 
                    json_encode($t['attachments'] ?? []), 
                    json_encode($t['readBy'] ?? []), 
                    json_encode($t['messages'] ?? [])
                ]);
                $importedCount++;
            }
        }
        
        // Import Feedback
        $feedbacks = $backupData['system_feedback'] ?? $backupData['feedback'] ?? [];
        if (!empty($feedbacks)) {
            $stmtFeedback = $pdo->prepare("INSERT INTO feedback (id, type, email, name, content, proof_image, is_resolved, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            foreach ($feedbacks as $f) {
                $stmtFeedback->execute([
                    $f['id'],
                    $f['type'],
                    $f['email'],
                    $f['name'] ?? '',
                    $f['content'],
                    $f['proofImage'] ?? '',
                    !empty($f['isResolved']) ? 1 : 0,
                    fmtDate($f['timestamp'] ?? $f['created_at'])
                ]);
            }
        }
        
        $pdo->commit();
        $message = "Migration successful. ($source) Restored $importedCount tickets.";
        
        // Optional: Rename backup file to prevent accidental re-run
        if (file_exists($jsonFile)) {
            rename($jsonFile, $jsonFile . '.done');
        }

    } else {
        $message = "Database tables initialized. No data imported. (Upload a 'backup.json' file via FTP to restore data)";
    }

    echo json_encode(['status' => 'success', 'message' => $message]);

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Migration failed: ' . $e->getMessage()]);
}
?>