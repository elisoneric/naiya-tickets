<?php
/**
 * NA'IYA & SAMUIKY SUPPORT PLATFORM - PAY & WORK REPORT ROUTE
 * Pure API Gateway & Client connecting the Ticket System to the Pay Database
 * 
 * Single Source of Truth: All agent records, monthly volume statements,
 * and access tracking logs reside strictly on the Pay System (pay.naiyatechnology.org).
 * No local pay database is stored or maintained on the ticket platform.
 */

// Error logging without breaking JSON
ini_set('display_errors', 0);
ini_set('log_errors', 1);

$payApiBaseUrl = getenv('PAY_API_URL') ?: 'https://pay.naiyatechnology.org/api.php';
$payAdminPin   = getenv('PAY_ADMIN_PIN') ?: 'admin2026';

/**
 * Execute HTTP GET/POST request to the Pay System API
 */
function callPayPortalApi($endpointUrl, $params = [], $method = 'GET') {
    $fullUrl = $endpointUrl;
    if ($method === 'GET' && !empty($params)) {
        $fullUrl .= (strpos($endpointUrl, '?') === false ? '?' : '&') . http_build_query($params);
    }

    // Try cURL first
    if (function_exists('curl_init')) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $fullUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 6);
        curl_setopt($ch, CURLOPT_TIMEOUT, 12);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        curl_setopt($ch, CURLOPT_USERAGENT, 'NaiyaTicketPortal/2.0 (cPanel API Bridge)');
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Accept: application/json',
            'X-Requested-With: XMLHttpRequest',
            'X-API-Key: ' . (getenv('PAY_ADMIN_PIN') ?: 'admin2026')
        ]);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($response !== false) {
            return [
                'success' => ($httpCode >= 200 && $httpCode < 300),
                'httpCode' => $httpCode,
                'data' => $response
            ];
        }
    }

    // Fallback to file_get_contents with stream context
    $contextOptions = [
        'http' => [
            'method' => $method,
            'timeout' => 12,
            'header' => "Accept: application/json\r\n" .
                        "User-Agent: NaiyaTicketPortal/2.0 (cPanel Stream)\r\n" .
                        "X-API-Key: " . (getenv('PAY_ADMIN_PIN') ?: 'admin2026') . "\r\n"
        ]
    ];

    if ($method === 'POST') {
        $content = http_build_query($params);
        $contextOptions['http']['header'] .= "Content-Type: application/x-www-form-urlencoded\r\n" .
                                             "Content-Length: " . strlen($content) . "\r\n";
        $contextOptions['http']['content'] = $content;
    }

    $context = stream_context_create($contextOptions);
    $response = @file_get_contents($fullUrl, false, $context);

    if ($response !== false) {
        $httpCode = 200;
        if (isset($http_response_header) && preg_match('#HTTP/[0-9\.]+\s+([0-9]+)#', $http_response_header[0], $matches)) {
            $httpCode = intval($matches[1]);
        }
        return [
            'success' => ($httpCode >= 200 && $httpCode < 300),
            'httpCode' => $httpCode,
            'data' => $response
        ];
    }

    return [
        'success' => false,
        'httpCode' => 502,
        'data' => null,
        'error' => 'Unable to establish secure connection with Pay System API'
    ];
}

switch ($action) {
    /**
     * Action: pay_get_report
     * Fetches an enroller's verified volume and monthly breakdown from the Pay Database
     * Automatically tags the access event on the Pay System with source = 'ticket_site'
     */
    case 'pay_get_report': {
        $rawId  = trim($_GET['identifier'] ?? ($_POST['identifier'] ?? ''));
        $email  = trim($_GET['email'] ?? ($_POST['email'] ?? ''));
        $source = trim($_GET['source'] ?? ($_POST['source'] ?? 'ticket_site'));

        if (empty($rawId)) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'Identifier parameter is required (NIN or Device IMEI).'
            ]);
            exit;
        }

        if (empty($email)) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'Your official email address is required to access records.'
            ]);
            exit;
        }

        // Check if full site maintenance or pay service is blocked
        if (isset($pdo)) {
            try {
                $stmt = $pdo->prepare("SELECT value FROM settings WHERE id = ?");
                $stmt->execute(['general']);
                $rawSettings = $stmt->fetchColumn();
                if ($rawSettings) {
                    $genSettings = json_decode($rawSettings, true);
                    if (!empty($genSettings['siteMaintenanceMode'])) {
                        http_response_code(503);
                        echo json_encode([
                            'status' => 'error',
                            'code' => 'SITE_MAINTENANCE',
                            'message' => $genSettings['siteMaintenanceMessage'] ?: 'The platform is currently under scheduled maintenance. Please check back later.'
                        ]);
                        exit;
                    }
                    if (!empty($genSettings['triageCategories']) && is_array($genSettings['triageCategories'])) {
                        foreach ($genSettings['triageCategories'] as $cat) {
                            $preset = $cat['presetCategory'] ?? ($cat['title'] ?? '');
                            if (in_array($preset, ['Payment & Statement Portal', 'Payment & Work Report']) && !empty($cat['disabled'])) {
                                http_response_code(503);
                                echo json_encode([
                                    'status' => 'error',
                                    'code' => 'SERVICE_MAINTENANCE',
                                    'message' => $cat['disabledMessage'] ?: 'Payment & Work Report portal is currently under scheduled maintenance.'
                                ]);
                                exit;
                            }
                        }
                    }
                }
            } catch (Exception $e) {
                // Ignore settings lookup failure and proceed
            }
        }

        // Forward request via API to Pay System
        $apiParams = [
            'action'     => 'get_report',
            'identifier' => $rawId,
            'email'      => $email,
            'source'     => $source ?: 'ticket_site'
        ];

        $res = callPayPortalApi($payApiBaseUrl, $apiParams, 'GET');

        if ($res['data']) {
            http_response_code($res['httpCode']);
            header('Content-Type: application/json; charset=UTF-8');
            echo $res['data'];
        } else {
            http_response_code(502);
            echo json_encode([
                'status' => 'error',
                'message' => 'Unable to reach the Pay System at ' . parse_url($payApiBaseUrl, PHP_URL_HOST) . '. Please check back shortly.'
            ]);
        }
        exit;
    }

    /**
     * Action: pay_get_access_logs
     * Allows authenticated staff on the ticket site to inspect access logs from the Pay Database
     */
    case 'pay_get_access_logs': {
        $auth = require_auth();
        if ($auth['role'] !== 'staff' && $auth['role'] !== 'team_lead') {
            http_response_code(403);
            echo json_encode(['status' => 'error', 'message' => 'Forbidden']);
            exit;
        }

        $apiParams = [
            'action' => 'get_access_logs',
            'pin'    => $payAdminPin
        ];

        // Pass all filter and pagination parameters
        foreach (['page', 'limit', 'q', 'status', 'source', 'time_filter', 'start_date', 'end_date', 'sort_by'] as $key) {
            if (isset($_GET[$key]) && $_GET[$key] !== '') {
                $apiParams[$key] = trim($_GET[$key]);
            }
        }

        $res = callPayPortalApi($payApiBaseUrl, $apiParams, 'GET');

        if ($res['data']) {
            http_response_code($res['httpCode']);
            header('Content-Type: application/json; charset=UTF-8');
            echo $res['data'];
        } else {
            http_response_code(502);
            echo json_encode([
                'status' => 'error',
                'message' => 'Unable to retrieve access logs from Pay System.'
            ]);
        }
        exit;
    }

    /**
     * Action: pay_export_access_logs_csv
     * Allows authenticated staff to export filtered access logs as CSV matching active filters
     */
    case 'pay_export_access_logs_csv': {
        $auth = require_auth();
        if ($auth['role'] !== 'staff' && $auth['role'] !== 'team_lead') {
            http_response_code(403);
            echo 'Forbidden: Insufficient privileges';
            exit;
        }

        $apiParams = [
            'action' => 'export_access_logs_csv',
            'pin'    => $payAdminPin
        ];

        foreach (['q', 'status', 'source', 'time_filter', 'start_date', 'end_date', 'sort_by'] as $key) {
            if (isset($_GET[$key]) && $_GET[$key] !== '') {
                $apiParams[$key] = trim($_GET[$key]);
            }
        }

        $source = trim($_GET['source'] ?? 'ALL');
        $channelLabel = ($source === 'ticket_site') ? 'ticket_portal_' : (($source === 'direct') ? 'pay_portal_' : '');
        $filename = 'access_audit_logs_' . $channelLabel . date('Y-m-d_His') . '.csv';

        $res = callPayPortalApi($payApiBaseUrl, $apiParams, 'GET');

        if ($res['data']) {
            header('Content-Type: text/csv; charset=UTF-8');
            header('Content-Disposition: attachment; filename="' . $filename . '"');
            echo $res['data'];
        } else {
            http_response_code(502);
            echo 'Unable to download export from Pay System';
        }
        exit;
    }

    /**
     * Action: pay_health
     * Diagnostics endpoint to verify API connection to the Pay System
     */
    case 'pay_health': {
        $res = callPayPortalApi($payApiBaseUrl, ['action' => 'health'], 'GET');
        if ($res['data']) {
            http_response_code($res['httpCode']);
            header('Content-Type: application/json; charset=UTF-8');
            echo $res['data'];
        } else {
            http_response_code(502);
            echo json_encode([
                'status' => 'error',
                'message' => 'Pay API connection check failed'
            ]);
        }
        exit;
    }

    default:
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Unknown pay action']);
        exit;
}
