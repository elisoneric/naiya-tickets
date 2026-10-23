<?php
require_once 'db.php';

header('Content-Type: text/plain');

echo "Starting Database Migration...\n\n";

try {
    // 1. Create Users Table
    echo "Creating users table...\n";
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(50) PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL,
            avatar VARCHAR(255),
            password VARCHAR(255),
            team_lead_id VARCHAR(50),
            managed_team_id VARCHAR(50),
            specialized_categories JSON,
            is_root TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ");
    echo "Users table created.\n\n";

    // 2. Create Tickets Table
    echo "Creating tickets table...\n";
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS tickets (
            id VARCHAR(50) PRIMARY KEY,
            ticket_number VARCHAR(50) UNIQUE NOT NULL,
            title VARCHAR(255) NOT NULL,
            category VARCHAR(100) NOT NULL,
            description TEXT,
            status VARCHAR(50) DEFAULT 'Open',
            priority VARCHAR(50) DEFAULT 'Low',
            created_by_email VARCHAR(255) NOT NULL,
            created_by_name VARCHAR(255) NOT NULL,
            assigned_to_email VARCHAR(255),
            team_lead_id VARCHAR(50),
            team_lead_email VARCHAR(255),
            is_escalated BOOLEAN DEFAULT FALSE,
            is_pinned BOOLEAN DEFAULT FALSE,
            is_read_by_staff BOOLEAN DEFAULT FALSE,
            is_locked BOOLEAN DEFAULT FALSE,
            locked_by VARCHAR(255),
            project VARCHAR(255) DEFAULT 'Dont Know',
            read_by JSON,
            messages JSON,
            attachments JSON,
            searchable_text TEXT,
            last_message_preview TEXT,
            last_message_role VARCHAR(50),
            last_agent_reply_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ");
    echo "Tickets table created.\n\n";

    // 3. Create Settings Table
    echo "Creating settings table...\n";
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS settings (
            id VARCHAR(50) PRIMARY KEY,
            value LONGTEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ");
    
    // Insert default settings if empty
    $stmt = $pdo->query("SELECT COUNT(*) FROM settings");
    if ($stmt->fetchColumn() == 0) {
        $pdo->exec("INSERT INTO settings (id, value) VALUES ('general', '{\"categories\": [\"General Inquiry\", \"Technical Support\", \"Billing\"], \"shortcuts\": []}')");
        echo "Default settings inserted.\n";
    }
    echo "Settings table created.\n\n";

    // 4. Create Feedback Table
    echo "Creating feedback table...\n";
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS feedback (
            id VARCHAR(50) PRIMARY KEY,
            type VARCHAR(50),
            email VARCHAR(191),
            name VARCHAR(255),
            content TEXT,
            proof_image LONGTEXT,
            is_resolved BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ");
    echo "Feedback table created.\n\n";

    // 5. Add default IT Staff user if not exists
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE email = 'itstaff'");
    $stmt->execute();
    if ($stmt->fetchColumn() == 0) {
        $pdo->exec("INSERT INTO users (id, email, name, role, password, is_root) VALUES ('admin-1', 'itstaff', 'IT Admin', 'staff', 'admin123', 1)");
        echo "Default IT Staff user created (email: itstaff, password: admin123, is_root: 1).\n";
    }

    echo "\nMigration completed successfully!\n";

} catch (PDOException $e) {
    echo "Error during migration: " . $e->getMessage() . "\n";
}
?>
