<?php
// CRITICAL: Disable error display to output, log to file instead.
// This prevents HTML warnings from breaking JSON responses.
ini_set('display_errors', 0);
ini_set('log_errors', 1);
// Optional: Define log file if you have access, otherwise relies on system default
// ini_set('error_log', __DIR__ . '/php-error.log'); 
error_reporting(E_ALL);

// Set timezone to match database +01:00
date_default_timezone_set('Africa/Lagos');

// CORS Headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
header("Content-Type: application/json"); // Always declare JSON

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Global Exception Handler to return JSON on crash
function jsonExceptionHandler($e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error', 
        'message' => 'Internal Server Error: ' . $e->getMessage(),
        'file' => basename($e->getFile()),
        'line' => $e->getLine()
    ]);
    exit;
}
set_exception_handler('jsonExceptionHandler');

// Database Config
$host = 'localhost';
$db   = 'naiyatechnology_ticketv1';
$user = 'naiyatechnology_naiya';
$pass = 'naiyatechnology_naiya';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
    $pdo->exec("SET time_zone = '+01:00'");
} catch (\PDOException $e) {
    // If DB fails, return 503 JSON
    http_response_code(503);
    echo json_encode([
        'status' => 'error', 
        'message' => 'Database connection failed. Please check credentials or server status.'
    ]);
    exit;
}
?>