<?php
require 'db.php';

// Increase memory and time limits for processing large base64 strings
ini_set('memory_limit', '1024M');
set_time_limit(0);

header('Content-Type: text/html; charset=utf-8');

echo "<h2>Starting Migration to Firebase...</h2>";

function saveBase64Image($base64Data, $folder = 'uploads') {
    if (empty($base64Data)) return $base64Data;
    
    // Check if it's a data URI
    if (!preg_match('/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/', $base64Data, $type)) {
        return $base64Data; // Might already be a URL or invalid
    }
    
    $data = substr($base64Data, strpos($base64Data, ',') + 1);
    $mimeType = strtolower($type[1]);
    
    // Map mime types to extensions
    $mimeMap = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
        'application/pdf' => 'pdf',
        'text/plain' => 'txt',
        'application/msword' => 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx'
    ];
    
    $ext = $mimeMap[$mimeType] ?? 'bin';
    
    $decodedData = base64_decode($data);
    if ($decodedData === false) return $base64Data;
    
    $dir = __DIR__ . '/' . $folder;
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    
    $filename = uniqid('file_') . '_' . time() . '.' . $ext;
    $filepath = $dir . '/' . $filename;
    
    if (file_put_contents($filepath, $decodedData)) {
        return '/' . $folder . '/' . $filename;
    }
    
    return $base64Data; // Fallback
}

function processHtmlContent($html, $folder = 'uploads') {
    if (empty($html)) return $html;
    
    // Find all src tags with data URIs
    return preg_replace_callback('/src="(data:[^;]+;base64,[^"]+)"/i', function($matches) use ($folder) {
        $base64Data = $matches[1];
        $url = saveBase64Image($base64Data, $folder);
        return 'src="' . $url . '"';
    }, $html);
}

$exportData = [
    'tickets' => [],
    'agents' => []
];

try {
    // 1. Process Tickets
    echo "Fetching tickets from MySQL...<br>";
    $stmt = $pdo->query("SELECT * FROM tickets");
    $tickets = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Found " . count($tickets) . " tickets. Processing images...<br>";
    
    foreach ($tickets as $t) {
        // Process ticket attachments
        $attachments = json_decode($t['attachments'] ?? '[]', true) ?: [];
        $newAttachments = [];
        foreach ($attachments as $att) {
            $newAttachments[] = saveBase64Image($att);
        }
        
        // Process ticket description for inline base64 images
        $description = processHtmlContent($t['description']);
        
        // Process messages
        $messages = json_decode($t['messages'] ?? '[]', true) ?: [];
        foreach ($messages as &$msg) {
            $msgAtts = $msg['attachments'] ?? [];
            $newMsgAtts = [];
            foreach ($msgAtts as $att) {
                $newMsgAtts[] = saveBase64Image($att);
            }
            $msg['attachments'] = $newMsgAtts;
            
            // Process message content for inline base64 images
            if (isset($msg['content'])) {
                $msg['content'] = processHtmlContent($msg['content']);
            }
        }
        
        // Format for Firestore
        $exportData['tickets'][$t['id']] = [
            'ticketNumber' => $t['ticket_number'],
            'title' => $t['title'],
            'category' => $t['category'],
            'description' => $description,
            'status' => $t['status'],
            'priority' => $t['priority'],
            'createdByEmail' => $t['created_by_email'],
            'createdByName' => $t['created_by_name'],
            'assignedToEmail' => $t['assigned_to_email'],
            'teamLeadId' => $t['team_lead_id'],
            'isEscalated' => (bool)$t['is_escalated'],
            'isPinned' => (bool)$t['is_pinned'],
            'isReadByStaff' => (bool)$t['is_read_by_staff'],
            'isLocked' => (bool)$t['is_locked'],
            'lockedBy' => $t['locked_by'],
            'project' => $t['project'],
            'createdAt' => $t['created_at'],
            'updatedAt' => $t['updated_at'],
            'lastAgentReplyAt' => $t['last_agent_reply_at'],
            'attachments' => $newAttachments,
            'readBy' => json_decode($t['read_by'] ?? '[]', true) ?: [],
            'messages' => $messages,
            'lastMessagePreview' => $t['last_message_preview'],
            'lastMessageRole' => $t['last_message_role']
        ];
    }
    
    // 2. Process Agents
    echo "Fetching agents from MySQL...<br>";
    $stmt = $pdo->query("SELECT value FROM settings WHERE id = 'agents'");
    $res = $stmt->fetchColumn();
    $json = $res ? json_decode($res, true) : [];
    
    $agents = [];
    if (isset($json['agents']) && is_array($json['agents'])) {
        $agents = array_values($json['agents']);
    } elseif (is_array($json)) {
        $agents = array_values($json);
    }
    
    foreach ($agents as $agent) {
        if (isset($agent['email'])) {
            $exportData['agents'][$agent['email']] = $agent;
        }
    }
    
    // 3. Save to JSON file
    $jsonOutput = json_encode($exportData, JSON_PRETTY_PRINT);
    if ($jsonOutput === false) {
        throw new Exception("Failed to encode JSON: " . json_last_error_msg());
    }
    
    $exportPath = __DIR__ . '/firebase_export.json';
    file_put_contents($exportPath, $jsonOutput);
    
    echo "<h3 style='color: green;'>Migration Extraction Complete!</h3>";
    echo "<p>All base64 images have been extracted to the <code>/uploads</code> folder.</p>";
    echo "<p>A clean JSON file has been generated for Firebase.</p>";
    echo "<a href='/firebase_export.json' download style='display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;'>Download firebase_export.json</a>";
    
} catch (Exception $e) {
    echo "<h3 style='color: red;'>Error during migration:</h3>";
    echo "<pre>" . $e->getMessage() . "</pre>";
}
?>
