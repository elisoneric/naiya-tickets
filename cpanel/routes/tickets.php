<?php
// Ticket Routes

switch ($action) {
        case 'get_tickets':
            // Check auth to enforce agent boundaries
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
            if (function_exists('getallheaders')) {
                $headers = getallheaders();
                foreach ($headers as $key => $value) {
                    if (strtolower($key) === 'authorization') {
                        $authHeader = $value;
                        break;
                    }
                }
            }
            $userAuth = null;
            global $JWT_SECRET;
            if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
                $userAuth = verify_jwt($matches[1], $JWT_SECRET);
            }

            // Optimization: Do NOT select attachments or full messages history for the list view
            $since = isset($_GET['since']) ? $_GET['since'] : null;
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10000;
            $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
            $folder = isset($_GET['folder']) ? $_GET['folder'] : 'All';
            $category = isset($_GET['category']) ? $_GET['category'] : null;
            $role = isset($_GET['role']) ? $_GET['role'] : null;
            
            $createdByEmail = isset($_GET['created_by_email']) ? $_GET['created_by_email'] : null;
            
            // SECURITY ENFORCEMENT: Agents can only view their own tickets
            if ($userAuth && $userAuth['role'] === 'agent') {
                $createdByEmail = $userAuth['email'];
            }
            
            $query = "SELECT t.id, t.ticket_number, t.title, t.category, t.status, t.priority, 
                t.created_by_email, t.created_by_name, t.assigned_to_email, t.team_lead_id, t.team_lead_email,
                t.is_escalated, t.is_pinned, t.is_read_by_staff, t.is_locked, t.locked_by, 
                t.project, t.created_at, t.updated_at, t.last_agent_reply_at, t.read_by, 
                t.last_message_preview, t.last_message_role, COALESCE(u.role, 'agent') as agentRole
                FROM tickets t
                LEFT JOIN users u ON t.created_by_email = u.email";
            
            $baseWhereClauses = [];
            $folderWhereClauses = [];
            $params = [];
            $countParams = [];

            if ($since) {
                $folderWhereClauses[] = "t.updated_at >= :since";
                // Subtract 5 seconds to account for clock skew
                $params[':since'] = date('Y-m-d H:i:s', (int)(($since / 1000) - 5));
                // Do NOT add to countParams because we want absolute counts for the sidebar, not delta counts
            }
            if ($createdByEmail) {
                $baseWhereClauses[] = "t.created_by_email = :email";
                $params[':email'] = $createdByEmail;
                $countParams[':email'] = $params[':email'];
            }
            if ($category && $category !== 'All Categories') {
                $baseWhereClauses[] = "t.category = :category_filter";
                $params[':category_filter'] = $category;
                $countParams[':category_filter'] = $params[':category_filter'];
            }
            if ($role && $role !== 'All Roles') {
                $baseWhereClauses[] = "COALESCE(u.role, 'agent') = :role_filter";
                $params[':role_filter'] = strtolower($role);
                $countParams[':role_filter'] = $params[':role_filter'];
            }

            // FOLDER FILTERING (if requested specifically)
            if ($folder === 'Inbox') {
                $folderWhereClauses[] = "t.status != 'Closed' AND t.status != 'AI Triage'";
            } else if ($folder === 'AI Inbox') {
                $folderWhereClauses[] = "t.status = 'AI Triage'";
            } else if ($folder === 'Unread') {
                $folderWhereClauses[] = "t.status != 'Closed' AND COALESCE(t.is_read_by_staff, 0) = 0 AND COALESCE(t.last_message_role, '') NOT IN ('staff', 'team_lead')";
            } else if ($folder === 'Read') {
                $folderWhereClauses[] = "t.status != 'Closed' AND (COALESCE(t.is_read_by_staff, 0) = 1 OR COALESCE(t.last_message_role, '') IN ('staff', 'team_lead'))";
            } else if ($folder === 'Closed' || $folder === 'Resolved') {
                $folderWhereClauses[] = "t.status = 'Closed'";
            } else if ($folder === 'Assigned to me' && $userAuth) {
                $folderWhereClauses[] = "t.status != 'Closed' AND t.assigned_to_email = :assigned_filter";
                $params[':assigned_filter'] = $userAuth['email'];
            }

            $allWhereClauses = array_merge($baseWhereClauses, $folderWhereClauses);

            if (!empty($allWhereClauses)) {
                $query .= " WHERE " . implode(" AND ", $allWhereClauses);
            }
            
            if ($since) {
                // Delta sync: fetch all tickets modified since timestamp
                $query .= " ORDER BY t.updated_at DESC LIMIT 5000";
                $stmt = $pdo->prepare($query);
                $stmt->execute($params);
            } else {
                // Header load
                $query .= " ORDER BY t.updated_at DESC LIMIT :limit OFFSET :offset";
                $stmt = $pdo->prepare($query);
                
                foreach ($params as $key => $val) {
                    $stmt->bindValue($key, $val);
                }
                $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
                $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
                $stmt->execute();
            }
            $tickets = $stmt->fetchAll();
            
            // CALCULATE EXACT COUNTS FOR SIDEBAR
            $countQuery = "SELECT 
                SUM(CASE WHEN t.status != 'Closed' AND t.status != 'AI Triage' THEN 1 ELSE 0 END) as inbox,
                SUM(CASE WHEN t.status = 'AI Triage' THEN 1 ELSE 0 END) as ai_triage,
                SUM(CASE WHEN t.status != 'Closed' AND t.assigned_to_email = :assigned_email THEN 1 ELSE 0 END) as assigned,
                SUM(CASE WHEN t.status != 'Closed' AND COALESCE(t.is_read_by_staff, 0) = 0 AND COALESCE(t.last_message_role, '') NOT IN ('staff', 'team_lead') THEN 1 ELSE 0 END) as unread,
                SUM(CASE WHEN t.status != 'Closed' AND (COALESCE(t.is_read_by_staff, 0) = 1 OR COALESCE(t.last_message_role, '') IN ('staff', 'team_lead')) THEN 1 ELSE 0 END) as read_count,
                SUM(CASE WHEN t.status = 'Closed' THEN 1 ELSE 0 END) as closed
                FROM tickets t
                LEFT JOIN users u ON t.created_by_email = u.email";
                
            if (!empty($baseWhereClauses)) {
                $countQuery .= " WHERE " . implode(" AND ", $baseWhereClauses);
            }
            
            $countStmt = $pdo->prepare($countQuery);
            $countParams[':assigned_email'] = $userAuth ? $userAuth['email'] : '';
            
            $countStmt->execute($countParams);
            $dbCounts = $countStmt->fetch(PDO::FETCH_ASSOC);
            
            $counts = [
                'inbox' => (int)($dbCounts['inbox'] ?? 0),
                'ai_triage' => (int)($dbCounts['ai_triage'] ?? 0),
                'assigned' => (int)($dbCounts['assigned'] ?? 0),
                'unread' => (int)($dbCounts['unread'] ?? 0),
                'read' => (int)($dbCounts['read_count'] ?? 0),
                'closed' => (int)($dbCounts['closed'] ?? 0),
            ];
            
            foreach ($tickets as &$t) {
                $t['isEscalated'] = (bool)$t['is_escalated'];
                $t['isPinned'] = (bool)$t['is_pinned'];
                $t['isReadByStaff'] = (bool)$t['is_read_by_staff'];
                $t['isLocked'] = (bool)$t['is_locked'];
                
                $t['ticketNumber'] = $t['ticket_number'];
                $t['createdByEmail'] = $t['created_by_email'];
                $t['createdByName'] = $t['created_by_name'];
                $t['assignedToEmail'] = $t['assigned_to_email'];
                $t['teamLeadId'] = $t['team_lead_id'];
                $t['teamLeadEmail'] = $t['team_lead_email'];
                $t['lastAgentReplyAt'] = $t['last_agent_reply_at'];
                $t['createdAt'] = $t['created_at'];
                $t['updatedAt'] = $t['updated_at'];
                $t['lastMessagePreview'] = $t['last_message_preview'];
                $t['lastMessageRole'] = $t['last_message_role'];
                $t['readBy'] = !empty($t['read_by']) ? json_decode($t['read_by'], true) : [];
            }
            
            echo json_encode([
                'status' => 'success', 
                'data' => $tickets, 
                'serverTime' => (int)(microtime(true) * 1000),
                'counts' => $counts
            ]);
            break;

        // 2. SERVER-SIDE SEARCH (Universal Enterprise Search Engine)
        case 'search_tickets':
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
            if (function_exists('getallheaders')) {
                $headers = getallheaders();
                foreach ($headers as $key => $value) {
                    if (strtolower($key) === 'authorization') { $authHeader = $value; break; }
                }
            }
            $userAuth = null;
            global $JWT_SECRET;
            if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
                $userAuth = verify_jwt($matches[1], $JWT_SECRET);
            }

            $rawQuery = trim($_GET['q'] ?? '');
            if (empty($rawQuery)) {
                echo json_encode(['status' => 'success', 'data' => []]);
                break;
            }

            // Normalize search query (strip leading # or whitespace)
            $cleanQuery = ltrim($rawQuery, '#');
            $exactTerm = $cleanQuery;
            $likeTerm = '%' . $cleanQuery . '%';
            $prefixTerm = $cleanQuery . '%';
            
            // Agents can only search their own tickets
            $agentFilter = "";
            $params = [];

            if ($userAuth && $userAuth['role'] === 'agent') {
                $agentFilter = " AND t.created_by_email = :agent_email";
                $params[':agent_email'] = $userAuth['email'];
            }

            $sql = "SELECT t.id, t.ticket_number, t.title, t.category, t.status, t.priority, 
                t.created_by_email, t.created_by_name, t.assigned_to_email, t.team_lead_id, t.team_lead_email,
                t.is_escalated, t.is_pinned, t.is_read_by_staff, t.is_locked, t.locked_by, 
                t.project, t.created_at, t.updated_at, t.last_agent_reply_at, t.read_by, 
                t.last_message_preview, t.last_message_role, COALESCE(u.role, 'agent') as agentRole
                FROM tickets t
                LEFT JOIN users u ON t.created_by_email = u.email
                WHERE (
                    t.ticket_number = :exact_1
                    OR t.id = :exact_2
                    OR t.ticket_number LIKE :like_1
                    OR t.id LIKE :like_2
                    OR t.title LIKE :like_3
                    OR t.created_by_email LIKE :like_4
                    OR t.created_by_name LIKE :like_5
                    OR t.description LIKE :like_6
                    OR t.category LIKE :like_7
                    OR t.project LIKE :like_8
                    OR t.searchable_text LIKE :like_9
                    OR t.last_message_preview LIKE :like_10
                )" . $agentFilter . "
                ORDER BY (
                    CASE 
                        WHEN t.ticket_number = :exact_3 OR t.id = :exact_4 THEN 0
                        WHEN t.ticket_number LIKE :prefix_1 OR t.id LIKE :prefix_2 THEN 1
                        ELSE 2
                    END
                ), t.updated_at DESC LIMIT 200";

            $params[':exact_1'] = $exactTerm;
            $params[':exact_2'] = $exactTerm;
            $params[':exact_3'] = $exactTerm;
            $params[':exact_4'] = $exactTerm;
            $params[':prefix_1'] = $prefixTerm;
            $params[':prefix_2'] = $prefixTerm;
            for ($i = 1; $i <= 10; $i++) {
                $params[":like_$i"] = $likeTerm;
            }

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $tickets = $stmt->fetchAll();
            
            foreach ($tickets as &$t) {
                $t['isEscalated'] = (bool)$t['is_escalated'];
                $t['isPinned'] = (bool)$t['is_pinned'];
                $t['isReadByStaff'] = (bool)$t['is_read_by_staff'];
                $t['isLocked'] = (bool)$t['is_locked'];
                
                $t['ticketNumber'] = $t['ticket_number'];
                $t['createdByEmail'] = $t['created_by_email'];
                $t['createdByName'] = $t['created_by_name'];
                $t['assignedToEmail'] = $t['assigned_to_email'];
                $t['teamLeadId'] = $t['team_lead_id'];
                $t['teamLeadEmail'] = $t['team_lead_email'];
                $t['lockedBy'] = $t['locked_by'];
                $t['createdAt'] = $t['created_at'] ? str_replace(' ', 'T', $t['created_at']) . '+01:00' : null;
                $t['updatedAt'] = $t['updated_at'] ? str_replace(' ', 'T', $t['updated_at']) . '+01:00' : null;
                $t['lastAgentReplyAt'] = $t['last_agent_reply_at'] ? str_replace(' ', 'T', $t['last_agent_reply_at']) . '+01:00' : null;

                $t['lastMessagePreview'] = $t['last_message_preview'] ?? null;
                $t['lastMessageRole'] = $t['last_message_role'] ?? null;
                $t['searchableText'] = $t['searchable_text'] ?? '';

                unset($t['searchable_text']);
                unset($t['last_message_preview']);
                unset($t['last_message_role']);
                
                $t['readBy'] = json_decode($t['read_by'] ?? '[]', true);
            }
            echo json_encode(['status' => 'success', 'data' => $tickets]);
            break;

        // 3. HEAVY DETAILS (Single Ticket)
        case 'get_ticket_details':
            if (!$id) throw new Exception("ID Missing");

            // Lightweight mode: only return update metadata for polling checks (tiny payload)
            $lightweight = isset($_GET['lightweight']) && $_GET['lightweight'] === '1';
            if ($lightweight) {
                $stmt = $pdo->prepare("SELECT updated_at, last_message_preview, last_message_role, messages FROM tickets WHERE id = ?");
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                if ($row) {
                    $msgs = json_decode($row['messages'] ?? '[]', true);
                    $msgCount = is_array($msgs) ? count($msgs) : 0;
                    $lastMsg = ($msgCount > 0 && is_array($msgs)) ? end($msgs) : null;
                    $lastMsgId = is_array($lastMsg) ? ($lastMsg['id'] ?? '') : '';
                    echo json_encode(['status' => 'success', 'lightweight' => true, 'data' => [
                        'updatedAt' => $row['updated_at'],
                        'lastMessagePreview' => $row['last_message_preview'],
                        'lastMessageRole' => $row['last_message_role'],
                        'messageCount' => $msgCount,
                        'lastMessageId' => $lastMsgId
                    ]]);
                } else {
                    echo json_encode(['status' => 'error', 'message' => 'Ticket not found']);
                }
                break;
            }

            $stmt = $pdo->prepare("SELECT messages, attachments, description FROM tickets WHERE id = ?");
            $stmt->execute([$id]);
            $data = $stmt->fetch();
            
            if ($data) {
                $data['messages'] = json_decode($data['messages'] ?? '[]', true);
                $data['attachments'] = json_decode($data['attachments'] ?? '[]', true);
                // Description string is kept native
                echo json_encode(['status' => 'success', 'data' => $data]);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'Ticket not found']);
            }
            break;
            
        // 3. ANALYTICS SNAPSHOT (Full Data - NO ATTACHMENTS TO PREVENT 500 ERROR)
        case 'create_ticket':
            $data = jsonInput();
            
            $createdByEmail = $data['createdByEmail'] ?? '';
            $category = $data['category'] ?? '';
            
            if (!empty($createdByEmail) && !empty($category)) {
                $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM tickets WHERE created_by_email = ? AND category = ? AND status NOT IN ('Closed', 'Resolved')");
                $checkStmt->execute([$createdByEmail, $category]);
                if ($checkStmt->fetchColumn() >= 1) { 
                    http_response_code(400);
                    echo json_encode(['status' => 'error', 'message' => "You already have an active ticket open in the '$category' category."]);
                    exit;
                }
            }

            // Enforce official company domains when submitting webmail tickets
            if (strcasecmp($category, 'WEBMAIL') === 0 || strcasecmp($category, 'Webmail') === 0) {
                $desc = $data['description'] ?? '';
                if (preg_match('/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/', $desc, $matches)) {
                    $foundEmail = strtolower($matches[0]);
                    $validDomains = ['naiyatechnology.org', 'naiyatech.com.ng', 'samuikyglobal.com.ng'];
                    $hasValid = false;
                    foreach ($validDomains as $vd) {
                        if (substr($foundEmail, -strlen($vd)) === $vd) {
                            $hasValid = true;
                            break;
                        }
                    }
                    if (!$hasValid) {
                        http_response_code(400);
                        echo json_encode(['status' => 'error', 'message' => "Webmail requests must specify an authorized corporate domain (@naiyatechnology.org, @naiyatech.com.ng, or @samuikyglobal.com.ng)."]);
                        exit;
                    }
                }
            }

            $data['id'] = uniqid('tkt_'); 
            
            $utcNow = date('Y-m-d H:i:s');
            
            // Save attachments to disk
            $attachments = [];
            if (!empty($data['attachments']) && is_array($data['attachments'])) {
                foreach ($data['attachments'] as $att) {
                    $attachments[] = saveBase64Image($att, 'uploads/tickets');
                }
            }
            
            $stmt = $pdo->prepare("INSERT INTO tickets (
                id, ticket_number, title, category, description, status, priority, 
                created_by_email, created_by_name, team_lead_id, team_lead_email, project, 
                created_at, updated_at, last_agent_reply_at, attachments, read_by, messages,
                searchable_text, last_message_preview, last_message_role
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            
            $stmt->execute([
                $data['id'], $data['ticketNumber'], $data['title'], $data['category'], 
                $data['description'], $data['status'], $data['priority'], 
                $data['createdByEmail'], $data['createdByName'], $data['teamLeadId'], 
                $data['teamLeadEmail'] ?? null, $data['project'], 
                $utcNow, $utcNow, $utcNow, 
                json_encode($attachments), 
                json_encode($data['readBy']),
                json_encode([]),
                '', // searchable_text is empty initially
                substr($data['description'] ?? '', 0, 100), // last_message_preview
                null // last_message_role
            ]);
            
            echo json_encode(['status' => 'success', 'id' => $data['id']]);
            break;

        case 'update_ticket':
            $data = jsonInput();
            if (!$id) throw new Exception("ID required");

            $fields = [];
            $params = [];

            $map = [
                'status' => 'status',
                'category' => 'category',
                'project' => 'project',
                'assignedToEmail' => 'assigned_to_email',
                'teamLeadId' => 'team_lead_id',
                'teamLeadEmail' => 'team_lead_email',
                'isEscalated' => 'is_escalated',
                'isPinned' => 'is_pinned',
                'isReadByStaff' => 'is_read_by_staff',
                'isLocked' => 'is_locked',
                'lockedBy' => 'locked_by',
                'updatedAt' => 'updated_at',
                'lastAgentReplyAt' => 'last_agent_reply_at'
            ];

            $isOnlyReadUpdate = true;
            foreach ($data as $key => $val) {
                if ($key !== 'readBy' && $key !== 'isReadByStaff' && $key !== 'isLocked' && $key !== 'lockedBy') {
                    $isOnlyReadUpdate = false;
                }
                
                if (isset($map[$key])) {
                    $fields[] = "{$map[$key]} = ?";
                    $params[] = $val;
                } elseif ($key === 'readBy') {
                    $stmt = $pdo->prepare("SELECT read_by FROM tickets WHERE id = ?");
                    $stmt->execute([$id]);
                    $current = json_decode($stmt->fetchColumn() ?? '[]', true);
                    if (is_array($val)) {
                         $fields[] = "read_by = ?";
                         $params[] = json_encode($val);
                    } else {
                         if (!in_array($val, $current)) $current[] = $val;
                         $fields[] = "read_by = ?";
                         $params[] = json_encode($current);
                    }
                }
            }

            if (empty($fields)) {
                echo json_encode(['status' => 'success', 'message' => 'No changes']);
                exit;
            }

            if ($isOnlyReadUpdate) {
                $fields[] = "updated_at = updated_at";
            } elseif (!isset($data['updatedAt'])) {
                $fields[] = "updated_at = ?";
                $params[] = date('Y-m-d H:i:s');
            }

            $params[] = $id;
            $sql = "UPDATE tickets SET " . implode(', ', $fields) . " WHERE id = ?";
            $pdo->prepare($sql)->execute($params);
            
            echo json_encode(['status' => 'success']);
            break;

        case 'add_message':
            $data = jsonInput();
            if (!$id) throw new Exception("ID required");

            // Save attachments to disk
            if (!empty($data['attachments']) && is_array($data['attachments'])) {
                $savedAttachments = [];
                foreach ($data['attachments'] as $att) {
                    $savedAttachments[] = saveBase64Image($att, 'uploads/messages');
                }
                $data['attachments'] = $savedAttachments;
            }

            $stmt = $pdo->prepare("SELECT messages, status, assigned_to_email FROM tickets WHERE id = ?");
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            $messages = json_decode($row['messages'] ?? '[]', true);
            
            $messages[] = $data;

            $role = $data['role'];
            $isStaffSender = ($role === 'staff' || $role === 'team_lead');
            $isUserSender = ($role === 'agent' || $role === 'guest');

            $statusUpdate = "";
            if ($row['status'] === 'Closed') {
                $statusUpdate = ", status = 'Open'";
            } elseif ($isStaffSender && $row['status'] === 'Open') {
                $statusUpdate = ", status = 'In Progress'";
            }
            
            $utcNow = date('Y-m-d H:i:s');
            $lastReplyUpdate = ", last_agent_reply_at = '$utcNow'"; 

            $readStatusUpdate = "";
            if ($isUserSender) {
                $readStatusUpdate = ", is_read_by_staff = 0";
            } elseif ($isStaffSender) {
                $readStatusUpdate = ", is_read_by_staff = 1";
            }

            $senderEmail = $data['senderId'] ?? '';
            $newReadBy = $senderEmail ? [$senderEmail] : [];

            $assignUpdate = "";
            if ($isStaffSender && empty($row['assigned_to_email'])) {
                $assignUpdate = ", assigned_to_email = '$senderEmail'";
            }

            // Calculate searchable text and last message info
            $searchableText = '';
            foreach ($messages as $msg) {
                if (isset($msg['content'])) $searchableText .= ' ' . $msg['content'];
                if (isset($msg['senderName'])) $searchableText .= ' ' . $msg['senderName'];
                if (isset($msg['senderEmail'])) $searchableText .= ' ' . $msg['senderEmail'];
            }
            $lastMessagePreview = substr($data['content'] ?? '', 0, 100);
            $lastMessageRole = $role;
            
            $sql = "UPDATE tickets SET messages = ?, updated_at = '$utcNow' $statusUpdate $lastReplyUpdate $readStatusUpdate $assignUpdate, read_by = ?, searchable_text = ?, last_message_preview = ?, last_message_role = ? WHERE id = ?";
            $pdo->prepare($sql)->execute([json_encode($messages), json_encode($newReadBy), $searchableText, $lastMessagePreview, $lastMessageRole, $id]);
            
            echo json_encode(['status' => 'success']);
            break;

        case 'cleanup_tickets':
            $data = jsonInput();
            $type = $data['type'] ?? '';
            
            if ($type === 'closed') {
                $stmt = $pdo->query("SELECT * FROM tickets WHERE status = 'Closed'");
            } else if ($type === 'stale_unreplied') {
                // Tickets where last_agent_reply_at is older than 1 month, or null and created_at is older than 1 month
                $oneMonthAgo = date('Y-m-d H:i:s', strtotime('-1 month'));
                $stmt = $pdo->prepare("SELECT * FROM tickets WHERE (last_agent_reply_at < ? OR (last_agent_reply_at IS NULL AND created_at < ?)) AND status != 'Closed'");
                $stmt->execute([$oneMonthAgo, $oneMonthAgo]);
            } else {
                throw new Exception("Invalid cleanup type");
            }
            
            $tickets = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if (count($tickets) > 0) {
                // Backup
                $backupDir = 'backups';
                if (!is_dir($backupDir)) {
                    mkdir($backupDir, 0777, true);
                }
                $backupFile = $backupDir . '/tickets_backup_' . $type . '_' . date('Ymd_His') . '.json';
                file_put_contents($backupFile, json_encode($tickets, JSON_PRETTY_PRINT));
                
                // Delete
                $ids = array_column($tickets, 'id');
                $placeholders = str_repeat('?,', count($ids) - 1) . '?';
                $deleteStmt = $pdo->prepare("DELETE FROM tickets WHERE id IN ($placeholders)");
                $deleteStmt->execute($ids);
            }
            
            echo json_encode(['status' => 'success', 'deletedCount' => count($tickets)]);
            break;

        case 'get_priority_nimc_tickets':
            $auth = require_auth();
            $stmt = $pdo->prepare("SELECT t.*, COALESCE(u.name, t.created_by_name) as agent_full_name
                FROM tickets t
                LEFT JOIN users u ON t.created_by_email = u.email
                WHERE t.status NOT IN ('Closed', 'Resolved')
                AND (
                    t.category IN ('NIMC Login Details', 'Metadata Onboarding')
                    OR LOWER(t.title) LIKE '%nimc%'
                    OR LOWER(t.title) LIKE '%metadata%'
                    OR LOWER(t.title) LIKE '%agent not found%'
                    OR LOWER(t.title) LIKE '%nimc login%'
                    OR LOWER(t.description) LIKE '%nimc%'
                    OR LOWER(t.description) LIKE '%metadata%'
                    OR LOWER(t.description) LIKE '%agent not found%'
                )
                AND (
                    COALESCE(t.last_message_role, '') NOT IN ('staff', 'team_lead')
                    OR t.last_agent_reply_at IS NULL
                    OR COALESCE(t.is_read_by_staff, 0) = 0
                )
                ORDER BY t.created_at ASC");
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['status' => 'success', 'count' => count($rows), 'data' => $rows]);
            break;

        case 'bulk_clear_device_tickets':
            $auth = require_auth();
            if ($auth['role'] !== 'staff') {
                http_response_code(403);
                echo json_encode(['status' => 'error', 'message' => 'Forbidden']);
                exit;
            }

            $input = jsonInput();
            $mode = $input['mode'] ?? 'preview'; // 'preview' or 'execute'
            $staffEmail = $input['staffEmail'] ?? $auth['email'] ?? 'itstaff';
            $staffName = $input['staffName'] ?? $auth['name'] ?? 'System IT Admin';

            $clearingTemplate = "[Official Notice - IT Technical Support Desk]\n\nHello,\n\nPlease note that the IT Technical Support desk handles technical system access only (NIMC login credentials, metadata onboarding status, corporate webmail, and VPN access). We do NOT handle physical devices, hardware repairs, damage/theft, or form approvals, and we CANNOT fast-track any submissions.\n\n• Form Submissions: If you submitted an onboarding, production switch, reactivation, or damage form, it will be considered in normal batch processing by operations handlers.\n• Device Troubleshooting & Setup: For physical device troubleshooting, error messages, and peer assistance, please refer to the Knowledge Base or ask your fellow agents in your official Enroller WhatsApp/Telegram Community Group.\n\nThis ticket has been addressed and closed under technical support policy.";

            $sql = "SELECT id, ticket_number, title, category, description, status, priority,
                           created_by_email, created_by_name, assigned_to_email,
                           created_at, updated_at, last_agent_reply_at, last_message_role,
                           last_message_preview, messages
                    FROM tickets
                    WHERE status NOT IN ('Closed', 'Resolved')
                    AND (
                        category IN ('Device & Activation Related', 'Device & Activation', 'Device', 'Activation')
                        OR LOWER(category) LIKE '%device%'
                        OR LOWER(category) LIKE '%activation%'
                        OR LOWER(title) LIKE '%device%'
                        OR LOWER(title) LIKE '%activation%'
                        OR LOWER(title) LIKE '%switch to production%'
                        OR LOWER(title) LIKE '%test run%'
                        OR LOWER(title) LIKE '%reactivat%'
                        OR LOWER(title) LIKE '%stolen%'
                        OR LOWER(title) LIKE '%damage%'
                        OR LOWER(title) LIKE '%broken%'
                        OR LOWER(title) LIKE '%imei%'
                        OR LOWER(title) LIKE '%hena id%'
                        OR LOWER(description) LIKE '%switch to production%'
                        OR LOWER(description) LIKE '%reactivat%'
                        OR LOWER(description) LIKE '%esa code%'
                    )
                    AND (
                        category NOT IN ('NIMC Login Details', 'Metadata Onboarding')
                        AND LOWER(title) NOT LIKE '%nimc%'
                        AND LOWER(title) NOT LIKE '%metadata%'
                        AND LOWER(title) NOT LIKE '%agent not found%'
                    )
                    AND (
                        COALESCE(last_message_role, '') NOT IN ('staff', 'team_lead')
                        OR last_agent_reply_at IS NULL
                    )
                    ORDER BY created_at ASC";

            $stmt = $pdo->prepare($sql);
            $stmt->execute();
            $tickets = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if ($mode === 'preview') {
                echo json_encode([
                    'status' => 'success',
                    'mode' => 'preview',
                    'count' => count($tickets),
                    'tickets' => $tickets
                ]);
                break;
            }

            // Mode == 'execute'
            if (count($tickets) > 0) {
                // Safety Backup
                $backupDir = 'backups';
                if (!is_dir($backupDir)) {
                    @mkdir($backupDir, 0777, true);
                }
                $backupFile = $backupDir . '/device_tickets_preclear_' . date('Ymd_His') . '.json';
                file_put_contents($backupFile, json_encode($tickets, JSON_PRETTY_PRINT));

                $now = date('Y-m-d H:i:s');
                $updateStmt = $pdo->prepare("UPDATE tickets SET 
                    messages = :messages,
                    status = 'Closed',
                    is_read_by_staff = 1,
                    last_agent_reply_at = :reply_at,
                    last_message_role = 'staff',
                    last_message_preview = :preview,
                    assigned_to_email = :assigned_to,
                    updated_at = :updated_at,
                    searchable_text = CONCAT(COALESCE(searchable_text, ''), ' ', :added_text)
                    WHERE id = :id");

                $clearedCount = 0;
                foreach ($tickets as $t) {
                    $msgs = json_decode($t['messages'] ?? '[]', true);
                    if (!is_array($msgs)) $msgs = [];

                    $msgs[] = [
                        'id' => 'msg-clear-' . uniqid(),
                        'senderId' => $staffEmail,
                        'senderName' => $staffName,
                        'role' => 'staff',
                        'content' => $clearingTemplate,
                        'timestamp' => date('c')
                    ];

                    $preview = "Notice: IT Technical Support handles technical system access only. Device forms are processed in batches...";

                    $updateStmt->execute([
                        ':messages'    => json_encode($msgs),
                        ':reply_at'    => $now,
                        ':preview'     => $preview,
                        ':assigned_to' => $staffEmail,
                        ':updated_at'  => $now,
                        ':added_text'  => 'Official Notice Closed Device Knowledge Base Group',
                        ':id'          => $t['id']
                    ]);
                    $clearedCount++;
                }

                echo json_encode([
                    'status' => 'success',
                    'mode' => 'executed',
                    'clearedCount' => $clearedCount,
                    'backupFile' => basename($backupFile),
                    'staffEmail' => $staffEmail,
                    'staffName' => $staffName
                ]);
            } else {
                echo json_encode([
                    'status' => 'success',
                    'mode' => 'executed',
                    'clearedCount' => 0,
                    'message' => 'No pending redundant device tickets found'
                ]);
            }
            break;

        // --- SETTINGS & USERS ---


}
