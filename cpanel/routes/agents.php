<?php
// Agent Routes (Relational DB Engine)

switch ($action) {
    case 'get_agents':
        // Auto-ensure created_at column exists in users table safely
        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
        } catch (Exception $e) {}

        // 1. Query users table for all non-staff accounts
        try {
            $stmt = $pdo->query("SELECT email, alt_email as altEmail, name, role, team_lead_id as teamLeadId, must_change_password as mustChangePassword, created_at as createdAt FROM users WHERE role IN ('agent', 'team_lead', 'referee', 'moniepoint')");
            $agents = $stmt->fetchAll();
        } catch (Exception $e) {
            // Fallback if created_at column does not exist yet on DB
            $stmt = $pdo->query("SELECT email, alt_email as altEmail, name, role, team_lead_id as teamLeadId, must_change_password as mustChangePassword FROM users WHERE role IN ('agent', 'team_lead', 'referee', 'moniepoint')");
            $agents = $stmt->fetchAll();
        }

        // 2. Fallback / Auto-Migration: If users table is empty, check legacy settings blob
        if (empty($agents)) {
            $settStmt = $pdo->prepare("SELECT value FROM settings WHERE id = 'agents'");
            $settStmt->execute();
            $res = $settStmt->fetchColumn();
            $json = $res ? json_decode($res, true) : [];
            $legacyAgents = isset($json['agents']) && is_array($json['agents']) ? array_values($json['agents']) : (is_array($json) ? array_values($json) : []);

            if (!empty($legacyAgents)) {
                $insertStmt = $pdo->prepare("INSERT INTO users (email, alt_email, role, team_lead_id, must_change_password, password) VALUES (?, ?, ?, ?, 1, '') ON DUPLICATE KEY UPDATE role = VALUES(role)");
                foreach ($legacyAgents as $a) {
                    $email = strtolower(trim($a['email'] ?? ''));
                    if (!empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                        $altEmail = strtolower(trim($a['altEmail'] ?? ''));
                        $role = !empty($a['role']) ? $a['role'] : 'agent';
                        $tlId = $a['teamLeadId'] ?? null;
                        $insertStmt->execute([$email, $altEmail, $role, $tlId]);
                    }
                }
                // Re-fetch after migration
                try {
                    $stmt = $pdo->query("SELECT email, alt_email as altEmail, name, role, team_lead_id as teamLeadId, must_change_password as mustChangePassword, created_at as createdAt FROM users WHERE role IN ('agent', 'team_lead', 'referee', 'moniepoint')");
                    $agents = $stmt->fetchAll();
                } catch (Exception $e) {
                    $stmt = $pdo->query("SELECT email, alt_email as altEmail, name, role, team_lead_id as teamLeadId, must_change_password as mustChangePassword FROM users WHERE role IN ('agent', 'team_lead', 'referee', 'moniepoint')");
                    $agents = $stmt->fetchAll();
                }
            }
        }

        // Clean output formatting
        foreach ($agents as &$a) {
            $a['altEmail'] = $a['altEmail'] ?? '';
            $a['teamLeadId'] = $a['teamLeadId'] ?? '';
            $a['role'] = $a['role'] ?? 'agent';
            $a['mustChangePassword'] = (bool)($a['mustChangePassword'] ?? false);
            $a['createdAt'] = !empty($a['createdAt']) ? str_replace(' ', 'T', $a['createdAt']) . '+01:00' : null;
        }

        echo json_encode($agents);
        break;

    case 'update_agents':
        $auth = require_auth();
        if ($auth['role'] !== 'staff' && $auth['role'] !== 'team_lead') { 
            http_response_code(403); 
            echo json_encode(['status' => 'error', 'message' => 'Forbidden']);
            exit; 
        }

        $data = jsonInput();
        $records = [];
        if (isset($data['agents']) && is_array($data['agents'])) {
            $records = $data['agents'];
        } elseif (is_array($data)) {
            $records = $data;
        }

        if (empty($records)) {
            echo json_encode(['status' => 'success', 'count' => 0]);
            break;
        }

        $stmt = $pdo->prepare("INSERT INTO users (email, alt_email, role, team_lead_id, must_change_password, password) 
                               VALUES (?, ?, ?, ?, 1, '') 
                               ON DUPLICATE KEY UPDATE 
                               alt_email = IF(VALUES(alt_email) != '', VALUES(alt_email), alt_email),
                               role = VALUES(role),
                               team_lead_id = IF(VALUES(team_lead_id) != '', VALUES(team_lead_id), team_lead_id)");

        $count = 0;
        $pdo->beginTransaction();
        try {
            foreach ($records as $a) {
                $email = strtolower(trim($a['email'] ?? ''));
                if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    continue;
                }
                $altEmail = strtolower(trim($a['altEmail'] ?? ''));
                $role = !empty($a['role']) ? $a['role'] : 'agent';
                $tlId = !empty($a['teamLeadId']) ? trim($a['teamLeadId']) : null;

                $stmt->execute([$email, $altEmail, $role, $tlId]);
                $count++;
            }
            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
            break;
        }

        echo json_encode(['status' => 'success', 'processed' => $count]);
        break;

    case 'delete_agents':
        $auth = require_auth();
        if ($auth['role'] !== 'staff') { 
            http_response_code(403); 
            echo json_encode(['status' => 'error', 'message' => 'Forbidden']);
            exit; 
        }

        $data = jsonInput();
        $emails = [];
        if (isset($data['emails']) && is_array($data['emails'])) {
            $emails = $data['emails'];
        } elseif (is_array($data)) {
            $emails = $data;
        }

        if (!empty($emails)) {
            $lowerEmails = array_map(function($e) { return strtolower(trim($e)); }, $emails);
            $placeholders = str_repeat('?,', count($lowerEmails) - 1) . '?';
            
            // Delete agents from users table, protecting staff accounts
            $stmt = $pdo->prepare("DELETE FROM users WHERE LOWER(email) IN ($placeholders) AND role != 'staff'");
            $stmt->execute($lowerEmails);
        }

        echo json_encode(['status' => 'success']);
        break;
}
