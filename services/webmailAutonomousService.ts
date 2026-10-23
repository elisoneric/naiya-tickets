/**
 * webmailAutonomousService.ts
 *
 * Autonomous Webmail Reset pipeline.
 * Coordinates the name-matching engine with the cPanel UAPI password reset backend.
 * Handles downtime detection, name validation, and credential delivery.
 */

import { matchName, extractCorporateEmail, NameMatchResult } from './nameMatchingService';

const API_URL = import.meta.env?.VITE_API_URL || '/backend/api.php';

const VALID_DOMAINS = ['naiyatechnology.org', 'naiyatech.com.ng', 'samuikyglobal.com.ng'];

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

/**
 * Generate a compliant enterprise webmail password.
 * Format: NAIYA@######  or  SAMUIKY@######
 */
function generateWebmailPassword(domain: string): string {
    const digits = () => Math.floor(100000 + Math.random() * 900000).toString();
    if (domain.includes('samuiky')) return `SAMUIKY@${digits()}`;
    return `NAIYA@${digits()}`;
}

/**
 * Format the webmail credentials reply for chat/email delivery.
 */
function buildWebmailReply(email: string, password: string, domain: string): string {
    const webmailUrl = `https://${domain}/webmail`;
    return `Hello, here is your Webmail access:\n\n• Email: ${email}\n• Password: ${password}\n• Webmail URL: ${webmailUrl}\n\nAdvise:\n• Double-check password (use CAPITAL letters and @, no extra spaces).\n• If you experience issues, please reply on this ticket.`;
}

export interface WebmailResetResult {
    success: boolean;
    /**
     * 'auto_reset'         — cPanel reset completed, credentials delivered.
     * 'name_mismatch'      — Requester name/email doesn't match corporate handle.
     * 'account_not_found'  — Email doesn't exist on the mail server.
     * 'downtime'           — Mail server maintenance / incident active.
     * 'invalid_domain'     — Provided email domain is not authorized.
     * 'no_cpanel_creds'    — Backend cPanel credentials not configured for this domain.
     * 'error'              — Unexpected error.
     */
    outcome: 'auto_reset' | 'name_mismatch' | 'account_not_found' | 'downtime' | 'invalid_domain' | 'no_cpanel_creds' | 'error';
    corporateEmail?: string;
    newPassword?: string;
    /** Pre-formatted reply text for the user */
    replyText?: string;
    /** Short staff escalation brief */
    staffBrief?: string;
    /** Match details for audit log */
    matchResult?: NameMatchResult;
    errorMessage?: string;
}

/**
 * Check whether an incident/downtime banner is currently active for webmail.
 */
export function detectWebmailDowntime(incidentBanner?: { enabled: boolean; title: string; message: string }): boolean {
    if (!incidentBanner?.enabled) return false;
    const t = (incidentBanner.title || '').toLowerCase();
    const m = (incidentBanner.message || '').toLowerCase();
    return t.includes('mail') || t.includes('webmail') || t.includes('email') ||
           m.includes('mail') || m.includes('webmail') || m.includes('email') ||
           t.includes('maintenance') || t.includes('downtime');
}

/**
 * Execute a cPanel UAPI password reset for the given email.
 */
async function executeCpanelReset(username: string, domain: string, password: string): Promise<{
    ok: boolean;
    cpanelExecuted: boolean;
    accountNotFound: boolean;
    noCreds: boolean;
    message: string;
}> {
    try {
        const res = await fetch(`${API_URL}?action=cpanel_change_webmail_password`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ email: username, domain, password })
        });

        const data = await res.json();

        if (data.status === 'success' || data.cpanel_executed) {
            return { ok: true, cpanelExecuted: true, accountNotFound: false, noCreds: false, message: data.message || 'Reset successful.' };
        }

        if (data.account_not_found || (data.message && (
            data.message.toLowerCase().includes('not found') ||
            data.message.toLowerCase().includes('does not exist') ||
            data.message.toLowerCase().includes('no such user')
        ))) {
            return { ok: false, cpanelExecuted: false, accountNotFound: true, noCreds: false, message: data.message || 'Account not found.' };
        }

        // cPanel credentials not configured for this domain
        if (data.message && data.message.toLowerCase().includes('not configured')) {
            return { ok: false, cpanelExecuted: false, accountNotFound: false, noCreds: true, message: data.message };
        }

        return { ok: false, cpanelExecuted: false, accountNotFound: false, noCreds: false, message: data.message || 'cPanel returned an error.' };
    } catch (err: any) {
        return { ok: false, cpanelExecuted: false, accountNotFound: false, noCreds: false, message: err?.message || 'Network error reaching cPanel.' };
    }
}

/**
 * Full Webmail Auto-Reset Pipeline.
 *
 * @param requesterName     Display name of the requesting user (from Auth context).
 * @param requesterEmail    Login email of the requesting user (personal or corporate).
 * @param corporateEmail    The corporate email to reset (provided by user in chat or ticket).
 * @param incidentBanner    Current system incident banner (from GeneralSettings).
 */
export async function attemptWebmailReset(
    requesterName: string,
    requesterEmail: string,
    corporateEmail: string,
    incidentBanner?: { enabled: boolean; title: string; message: string }
): Promise<WebmailResetResult> {

    // 1. Validate corporate email domain
    const atIdx = (corporateEmail || '').lastIndexOf('@');
    if (atIdx === -1) {
        return { success: false, outcome: 'invalid_domain', errorMessage: 'No email provided or invalid format.' };
    }
    const domain = corporateEmail.slice(atIdx + 1).toLowerCase();
    const username = corporateEmail.slice(0, atIdx).toLowerCase();
    const fullEmail = `${username}@${domain}`;

    if (!VALID_DOMAINS.includes(domain)) {
        return {
            success: false,
            outcome: 'invalid_domain',
            corporateEmail: fullEmail,
            staffBrief: `Webmail request with unauthorized domain: ${fullEmail}`,
            errorMessage: `"${domain}" is not an authorized company domain.`
        };
    }

    // 2. Check downtime guard
    if (detectWebmailDowntime(incidentBanner)) {
        return {
            success: false,
            outcome: 'downtime',
            corporateEmail: fullEmail,
            replyText: `We are currently experiencing a maintenance window on our mail servers. Your webmail reset for ${fullEmail} has been logged and will be processed once services resume. We apologize for the inconvenience.`,
            staffBrief: `[DOWNTIME QUEUE] Webmail reset pending for ${fullEmail}. Process when maintenance window closes.`
        };
    }

    // 3. Name-matching check
    const matchResult = matchName(requesterName, requesterEmail, fullEmail);

    if (!matchResult.isMatch) {
        return {
            success: false,
            outcome: 'name_mismatch',
            corporateEmail: fullEmail,
            matchResult,
            staffBrief: `[SECURITY FLAG] Webmail reset for ${fullEmail} requested by ${requesterEmail} (${requesterName}). Name match confidence: ${(matchResult.score * 100).toFixed(0)}%. Manual identity verification required before reset.`,
            replyText: `Your reset request for ${fullEmail} has been received. For security, our team needs to verify your identity before processing this reset. A staff member will respond to you shortly.`
        };
    }

    // 4. Execute cPanel reset
    const password = generateWebmailPassword(domain);
    const cpanelResult = await executeCpanelReset(username, domain, password);

    if (cpanelResult.accountNotFound) {
        return {
            success: false,
            outcome: 'account_not_found',
            corporateEmail: fullEmail,
            matchResult,
            staffBrief: `[ACCOUNT NOT FOUND] ${fullEmail} does not exist on ${domain} mail server. Action: Create mailbox or verify email spelling.`,
            replyText: `The email address ${fullEmail} was not found on our mail server. Please verify the spelling of your corporate email address and reply again, or your account may need to be created.`
        };
    }

    if (cpanelResult.noCreds) {
        return {
            success: false,
            outcome: 'no_cpanel_creds',
            corporateEmail: fullEmail,
            matchResult,
            staffBrief: `[CPANEL UNCONFIGURED] Cannot auto-reset ${fullEmail} — cPanel API credentials not set for "${domain}". Action: Configure cPanel API token in Domain Settings, then manually reset password.`,
            replyText: `Your reset request for ${fullEmail} has been received. A staff member will process this manually and respond to you shortly.`
        };
    }

    if (cpanelResult.ok) {
        return {
            success: true,
            outcome: 'auto_reset',
            corporateEmail: fullEmail,
            newPassword: password,
            matchResult,
            replyText: buildWebmailReply(fullEmail, password, domain)
        };
    }

    // Fallback unexpected error — escalate
    return {
        success: false,
        outcome: 'error',
        corporateEmail: fullEmail,
        matchResult,
        errorMessage: cpanelResult.message,
        staffBrief: `[CPANEL ERROR] Reset attempt for ${fullEmail} failed: "${cpanelResult.message}". Manual intervention required.`,
        replyText: `Your reset request for ${fullEmail} has been received. Our system encountered a technical issue processing it automatically. A staff member will handle this and respond shortly.`
    };
}

export { extractCorporateEmail };
