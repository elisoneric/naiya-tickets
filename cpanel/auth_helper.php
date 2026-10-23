<?php
/**
 * Shared JWT authentication helper.
 * Include this file in backup_handler.php or any other handler that needs JWT verification.
 */

function jwt_verify_token($token, $secret) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return false;
    list($b64Header, $b64Payload, $b64Sig) = $parts;
    $signature = hash_hmac('sha256', $b64Header . '.' . $b64Payload, $secret, true);
    $expectedSig = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
    if (!hash_equals($expectedSig, $b64Sig)) return false;
    $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $b64Payload)), true);
    if (isset($payload['exp']) && $payload['exp'] < time()) return false;
    return $payload;
}

function jwt_require_auth_role($requiredRole = null) {
    $secret = getenv('JWT_SECRET') ?: 'naiya_secure_jwt_secret_key_2026';
    $authHeader = '';

    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (function_exists('getallheaders')) {
        foreach (getallheaders() as $k => $v) {
            if (strtolower($k) === 'authorization') { $authHeader = $v; break; }
        }
    }

    if (!preg_match('/Bearer\s(\S+)/', $authHeader, $m)) {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
        exit;
    }

    $payload = jwt_verify_token($m[1], $secret);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Invalid or expired token']);
        exit;
    }

    if ($requiredRole && $payload['role'] !== $requiredRole) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Forbidden']);
        exit;
    }

    return $payload;
}
?>
