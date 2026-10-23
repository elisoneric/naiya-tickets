<?php
// Staff Routes

switch ($action) {
        case 'get_staff':
            $stmt = $pdo->query("SELECT email, name, avatar, role, specialized_categories, is_root FROM users WHERE role = 'staff'");
            $staff = $stmt->fetchAll();
            foreach($staff as &$s) {
                $s['specializedCategories'] = json_decode($s['specialized_categories'] ?? '[]');
                $isRoot = (
                    (isset($s['is_root']) && ($s['is_root'] == 1 || $s['is_root'] === '1' || $s['is_root'] === true)) ||
                    (strtolower($s['email'] ?? '') === 'itstaff') ||
                    !empty($s['isRoot'])
                );
                $s['isRoot'] = $isRoot ? true : false;
                $s['is_root'] = $isRoot ? 1 : 0;
            }
            echo json_encode($staff);
            break;

        case 'upsert_staff':
            $auth = require_auth();
            if ($auth['role'] !== 'staff') { http_response_code(403); exit; }
            $d = jsonInput();
            
            $stmt = $pdo->prepare("SELECT password, is_root FROM users WHERE email = ?");
            $stmt->execute([$d['email']]);
            $existingUser = $stmt->fetch();
            $existingPass = $existingUser ? $existingUser['password'] : '';
            
            $passwordToSave = $existingPass ?: '';
            if (!empty($d['password'])) {
                // Determine if password needs hashing
                // Typically bcrypt hashes start with $2y$ and are 60 chars long
                if (strlen($d['password']) === 60 && strpos($d['password'], '$2') === 0) {
                    $passwordToSave = $d['password']; // Client passed an already hashed password? (Unlikely, but safety check)
                } else {
                    $passwordToSave = password_hash($d['password'], PASSWORD_DEFAULT);
                }
            }
            $specializedCategories = json_encode($d['specializedCategories'] ?? []);
            
            $avatar = '';
            if (!empty($d['avatar'])) {
                if (strpos($d['avatar'], 'data:image') === 0) {
                    $avatar = saveBase64Image($d['avatar'], 'uploads/avatars');
                } else {
                    $avatar = $d['avatar']; // Already a URL
                }
            }

            $isRoot = (
                (strtolower($d['email'] ?? '') === 'itstaff') ||
                !empty($d['isRoot']) ||
                (isset($d['is_root']) && ($d['is_root'] == 1 || $d['is_root'] === '1' || $d['is_root'] === true))
            ) ? 1 : 0;
            
            $stmt = $pdo->prepare("INSERT INTO users (email, name, password, role, avatar, specialized_categories, is_root) 
                                   VALUES (?, ?, ?, 'staff', ?, ?, ?) 
                                   ON DUPLICATE KEY UPDATE 
                                   name = VALUES(name), 
                                   password = VALUES(password), 
                                   avatar = VALUES(avatar), 
                                   specialized_categories = VALUES(specialized_categories),
                                   is_root = VALUES(is_root)");
            $stmt->execute([$d['email'], $d['name'], $passwordToSave, $avatar, $specializedCategories, $isRoot]);
            echo json_encode(['status' => 'success']);
            break;

        case 'delete_staff':
            $auth = require_auth();
            if ($auth['role'] !== 'staff') { http_response_code(403); exit; }
            $pdo->prepare("DELETE FROM users WHERE email = ?")->execute([$id]);
            echo json_encode(['status' => 'success']);
            break;

        case 'get_leads':
            $stmt = $pdo->query("SELECT email, name, avatar, managed_team_id as id, password FROM users WHERE role = 'team_lead'");
            echo json_encode($stmt->fetchAll());
            break;
            
        case 'upsert_lead':
            $auth = require_auth();
            if ($auth['role'] !== 'staff') { http_response_code(403); exit; }
            $d = jsonInput();
            
            $stmt = $pdo->prepare("SELECT password FROM users WHERE email = ?");
            $stmt->execute([$d['email']]);
            $existingPass = $stmt->fetchColumn();
            
            $passwordToSave = $existingPass ?: '';
            if (!empty($d['password'])) {
                if (strlen($d['password']) === 60 && strpos($d['password'], '$2') === 0) {
                    $passwordToSave = $d['password'];
                } else {
                    $passwordToSave = password_hash($d['password'], PASSWORD_DEFAULT);
                }
            }
            
            $avatar = '';
            if (!empty($d['avatar'])) {
                if (strpos($d['avatar'], 'data:image') === 0) {
                    $avatar = saveBase64Image($d['avatar'], 'uploads/avatars');
                } else {
                    $avatar = $d['avatar']; // Already a URL
                }
            }
            
            $stmt = $pdo->prepare("INSERT INTO users (email, name, password, role, managed_team_id, avatar) 
                                   VALUES (?, ?, ?, 'team_lead', ?, ?) 
                                   ON DUPLICATE KEY UPDATE 
                                   name = VALUES(name), 
                                   password = VALUES(password), 
                                   managed_team_id = VALUES(managed_team_id), 
                                   avatar = VALUES(avatar)");
            $stmt->execute([$d['email'], $d['name'], $passwordToSave, $d['id'], $avatar]);
            echo json_encode(['status' => 'success']);
            break;

        case 'delete_lead':
            $auth = require_auth();
            if ($auth['role'] !== 'staff') { http_response_code(403); exit; }
            $pdo->prepare("DELETE FROM users WHERE email = ?")->execute([$id]);
            echo json_encode(['status' => 'success']);
            break;


}
