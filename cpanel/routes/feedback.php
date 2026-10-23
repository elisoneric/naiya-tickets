<?php
// Feedback Routes

switch ($action) {
        case 'get_feedback':
            // 1. Auto-cleanup: Delete approved/resolved requests older than 1 hour
            try {
                $pdo->exec("DELETE FROM feedback WHERE is_resolved = 1 AND created_at < NOW() - INTERVAL 1 HOUR");
            } catch (Exception $e) {}

            $stmt = $pdo->query("SELECT id, type, email, name, content, is_resolved, created_at, proof_image FROM feedback ORDER BY created_at DESC");
            $feed = $stmt->fetchAll();
            foreach($feed as &$f) {
                $f['isResolved'] = (bool)$f['is_resolved'];
                $hasImage = !empty($f['proof_image']);
                $f['hasProofImage'] = $hasImage;
                // If proof_image is a URL, pass it directly for scroll lazy loading
                if ($hasImage && strpos($f['proof_image'], '/') === 0) {
                    $f['imageUrl'] = $f['proof_image'];
                }
                unset($f['proof_image']);
                $f['timestamp'] = $f['created_at'];
            }
            echo json_encode($feed);
            break;

        case 'get_feedback_image':
            $stmt = $pdo->prepare("SELECT proof_image FROM feedback WHERE id = ?");
            $stmt->execute([$id]);
            $res = $stmt->fetch();
            if ($res && $res['proof_image']) {
                echo json_encode(['status' => 'success', 'image' => $res['proof_image']]);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'No image found']);
            }
            break;

        case 'save_feedback':
            $d = jsonInput();
            $email = trim($d['email'] ?? '');
            
            // 1. Check if email is already an agent in the system
            $userCheck = $pdo->prepare("SELECT COUNT(*) FROM users WHERE email = ? AND role = 'agent'");
            $userCheck->execute([$email]);
            if ($userCheck->fetchColumn() >= 1) {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => 'This email is already registered. Please login directly.']);
                break;
            }

            // 2. Check if they already have an unresolved request
            $duplicateCheck = $pdo->prepare("SELECT COUNT(*) FROM feedback WHERE email = ? AND is_resolved = 0");
            $duplicateCheck->execute([$email]);
            if ($duplicateCheck->fetchColumn() >= 1) {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => 'You already have a pending access request. Please wait for it to be reviewed.']);
                break;
            }

            $id = uniqid('fb_');
            
            $proofImage = '';
            if (!empty($d['proofImage'])) {
                $proofImage = saveBase64Image($d['proofImage'], 'uploads/feedback');
            }
            
            $stmt = $pdo->prepare("INSERT INTO feedback (id, type, email, name, content, proof_image, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");
            $stmt->execute([$id, $d['type'], $d['email'], $d['name']??'', $d['content'], $proofImage]);
            echo json_encode(['status' => 'success']);
            break;
            
        case 'resolve_feedback':
            $auth = require_auth();
            if ($auth['role'] !== 'staff') { http_response_code(403); exit; }
            $pdo->prepare("UPDATE feedback SET is_resolved = 1 WHERE id = ?")->execute([$id]);
            echo json_encode(['status' => 'success']);
            break;

        case 'bulk_resolve_feedback':
            $auth = require_auth();
            if ($auth['role'] !== 'staff') { http_response_code(403); exit; }
            $d = jsonInput();
            $ids = $d['ids'] ?? [];
            if (!empty($ids) && is_array($ids)) {
                $placeholders = str_repeat('?,', count($ids) - 1) . '?';
                $stmt = $pdo->prepare("UPDATE feedback SET is_resolved = 1 WHERE id IN ($placeholders)");
                $stmt->execute($ids);
            }
            echo json_encode(['status' => 'success']);
            break;


}
