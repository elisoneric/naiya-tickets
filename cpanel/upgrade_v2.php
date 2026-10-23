<?php
// upgrade_v2.php
// Standalone script to trigger the DB migration and schema updates for the v2 upgrade (Performance & Indexing)

header('Content-Type: text/plain');
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/db.php';

echo "Starting Database Upgrade v2...\n";

$queries = [
    // Standard Indexes for Performance & Search
    "ALTER TABLE tickets ADD INDEX idx_updated_at (updated_at)",
    "ALTER TABLE tickets ADD INDEX idx_ticket_num (ticket_number)",
    "ALTER TABLE tickets ADD INDEX idx_created_by (created_by_email)",
    "ALTER TABLE tickets ADD INDEX idx_status_priority (status, priority)",
    "ALTER TABLE tickets ADD INDEX idx_assigned_status (assigned_to_email, status)",
    "ALTER TABLE tickets ADD INDEX idx_staff_read (is_read_by_staff, last_message_role, status)",
    
    // FULLTEXT Index for Fast Search (if supported)
    "ALTER TABLE tickets ADD FULLTEXT INDEX idx_searchable (searchable_text, ticket_number, title)"
];

foreach ($queries as $query) {
    try {
        $pdo->exec($query);
        echo "[OK] Index creation executed successfully.\n";
    } catch (Exception $e) {
        // Ignore duplicate column/table errors
        echo "[IGNORED/ERROR] " . $e->getMessage() . "\n";
    }
}

echo "\nDatabase Upgrade v2 Complete!\n";
?>
