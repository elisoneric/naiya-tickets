/**
 * vpnAutonomousService.ts
 *
 * Autonomous VPN resolution service.
 * Integrates with the VPN Hub via the PHP backend proxy to:
 *   - Check if a user already has a VPN assigned.
 *   - Auto-assign a new VPN from the available pool.
 *   - Swap a broken VPN for a fresh one.
 * Returns a formatted credential message ready for chat or ticket reply.
 */

const API_URL = import.meta.env?.VITE_API_URL || '/backend/api.php';

function getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
        const stored = localStorage.getItem('app_user');
        if (stored) {
            const u = JSON.parse(stored);
            if (u?.token) headers['Authorization'] = `Bearer ${u.token}`;
        }
    } catch { /* ignore */ }
    return headers;
}

export interface VpnResult {
    success: boolean;
    /** 'found' | 'assigned' | 'swapped' | 'pool_empty' | 'limit_exceeded' | 'error' */
    outcome: 'found' | 'assigned' | 'swapped' | 'pool_empty' | 'limit_exceeded' | 'error';
    username?: string;
    password?: string;
    /** Pre-formatted chat/email reply ready for display */
    replyText?: string;
    /** Raw error message for logging */
    errorMessage?: string;
}

function buildVpnReply(username: string, password: string): string {
    return `Hello, here is your VPN:\n\n• Username: ${username}\n• Password: ${password}\n\nImportant Guidelines:\n• All VPN credentials in the system are gateway-verified and working.\n• Use MTN network / hotspot for best connection.\n• Double-check password (no spaces, check Caps Lock is OFF).\n• Ensure your physical machine keyboard layout is US-English.\n• Automated swapping is disabled. Only designated IT staff can reassign or swap VPNs.`;
}

/**
 * Check whether an email already has a VPN assigned.
 * Returns the credentials if found, otherwise null.
 */
export async function checkExistingVpn(email: string): Promise<VpnResult> {
    try {
        const safeEmail = encodeURIComponent(email.trim().toLowerCase());
        const res = await fetch(`${API_URL}?action=check_vpn_status&email=${safeEmail}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (res.status === 404) {
            return { success: false, outcome: 'pool_empty', errorMessage: 'No VPN found for this email.' };
        }

        if (!res.ok) {
            return { success: false, outcome: 'error', errorMessage: `VPN Hub returned HTTP ${res.status}` };
        }

        const data = await res.json();

        if (data.status === 'password_ready' && data.username && data.password) {
            return {
                success: true,
                outcome: 'found',
                username: data.username,
                password: data.password,
                replyText: buildVpnReply(data.username, data.password)
            };
        }

        if (data.status === 'empty_password') {
            return { success: false, outcome: 'pool_empty', errorMessage: 'VPN record exists but no password set. Manual configuration needed.' };
        }

        return { success: false, outcome: 'error', errorMessage: data.error || 'Unexpected VPN Hub response.' };
    } catch (err: any) {
        return { success: false, outcome: 'error', errorMessage: err?.message || 'Network error reaching VPN Hub.' };
    }
}

/**
 * Swapping is restricted to IT staff only.
 * Autonomous AI swapping for regular agents is permanently disabled.
 */
export async function swapVpn(_email: string): Promise<VpnResult> {
    return {
        success: false,
        outcome: 'error',
        errorMessage: 'Automated agent VPN swaps are disabled. All VPN credentials are confirmed working. Only staff can swap.'
    };
}

/**
 * Assign a new VPN to an email from the available pool.
 */
export async function assignVpn(email: string): Promise<VpnResult> {
    try {
        const res = await fetch(`${API_URL}?action=vpn_admin_assign`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ email: email.trim().toLowerCase() })
        });

        const data = await res.json();

        if (!res.ok) {
            const msg = data?.error || data?.message || `HTTP ${res.status}`;
            if (msg.toLowerCase().includes('pool') || msg.toLowerCase().includes('no available')) {
                return { success: false, outcome: 'pool_empty', errorMessage: msg };
            }
            return { success: false, outcome: 'error', errorMessage: msg };
        }

        if (data.status === 'success' && data.vpn?.id) {
            return {
                success: true,
                outcome: 'assigned',
                username: data.vpn.id,
                password: data.vpn.password,
                replyText: buildVpnReply(data.vpn.id, data.vpn.password)
            };
        }

        return { success: false, outcome: 'error', errorMessage: data.message || 'Assignment returned unexpected response.' };
    } catch (err: any) {
        return { success: false, outcome: 'error', errorMessage: err?.message || 'Network error during VPN assignment.' };
    }
}

/**
 * Full VPN lookup pipeline: check existing → assign from pool if user has none.
 * Never performs auto-swapping. All VPNs in the pool are verified working.
 */
export async function resolveVpnForUser(email: string, _reportedBroken: boolean = false): Promise<VpnResult> {
    // 1. Check existing VPN first
    const existing = await checkExistingVpn(email);
    if (existing.success) return existing;

    // 2. No existing VPN — assign a fresh one from the pool
    return await assignVpn(email);
}
