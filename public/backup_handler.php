
<?php
/**
 * backup_handler.php
 * Handles server-side storage of JSON backups.
 * 
 * SECURITY NOTE: 
 * This script is designed to be placed in the public/ root of the React app.
 * It receives JSON data from the authenticated React frontend.
 * Credentials for Firebase are NOT needed here as the frontend handles fetching.
 * 
 * In a production cPanel environment, ensure the 'backups' directory 
 * is not publicly accessible via web browser (use .htaccess).
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// Define where backups are stored relative to this script
$BACKUP_DIR = __DIR__ . '/backups';

// Ensure directory exists with write permissions
if (!file_exists($BACKUP_DIR)) {
    mkdir($BACKUP_DIR, 0755, true);
}

// Handle preflight request for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    if ($method === 'POST' && $action === 'save') {
        // --- SAVE BACKUP ---
        // Reads raw POST data (JSON)
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);

        if (!$data) {
            throw new Exception("Invalid JSON data provided");
        }

        // Generate filename with timestamp
        $timestamp = date('Y-m-d_H-i-s');
        $filename = "backup_{$timestamp}.json";
        $filepath = "$BACKUP_DIR/$filename";

        if (file_put_contents($filepath, json_encode($data, JSON_PRETTY_PRINT))) {
            echo json_encode([
                'status' => 'success', 
                'message' => "Backup saved to server as $filename", 
                'file' => $filename
            ]);
        } else {
            throw new Exception("Failed to write file. Check server permissions for /backups folder.");
        }

    } elseif ($method === 'GET' && $action === 'list') {
        // --- LIST BACKUPS ---
        $files = glob("$BACKUP_DIR/*.json");
        $backups = [];

        foreach ($files as $file) {
            $backups[] = [
                'name' => basename($file),
                'size' => round(filesize($file) / 1024, 2) . ' KB',
                'date' => date("F d Y H:i:s", filemtime($file))
            ];
        }
        
        // Sort by newest first
        usort($backups, function($a, $b) {
            return strtotime($b['date']) - strtotime($a['date']);
        });

        echo json_encode(['status' => 'success', 'files' => $backups]);

    } elseif ($method === 'GET' && $action === 'get') {
        // --- GET SINGLE BACKUP CONTENT ---
        $file = $_GET['file'] ?? '';
        
        // Security: Prevent directory traversal
        if (strpos($file, '..') !== false || strpos($file, '/') !== false) {
            throw new Exception("Invalid filename");
        }

        $filepath = "$BACKUP_DIR/$file";
        if (file_exists($filepath)) {
            echo file_get_contents($filepath);
        } else {
            throw new Exception("File not found");
        }

    } else {
        throw new Exception("Invalid action or method");
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
