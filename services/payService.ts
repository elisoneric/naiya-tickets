/**
 * payService.ts
 * 
 * Enroller Pay & Work Record verification service.
 * Fetches verified monthly enrollment volumes across FEPs (NAIYA TECHNOLOGIES LIMITED & SAMUIKY GLOBAL)
 * via the backend API proxy without exposing banking or contact details.
 */

const API_URL = import.meta.env?.VITE_API_URL || '/backend/api.php';

export interface PayAgent {
    identifier: string;
    identifier_type: 'NIN' | 'IMEI';
    full_name: string;
    fep_category: 'NAIYA TECHNOLOGIES LIMITED' | 'SAMUIKY GLOBAL' | string;
    license_type?: string;
    verification_status?: string;
}

export interface PayMonthlyReport {
    identifier: string;
    identifier_type: 'NIN' | 'IMEI';
    month: string;
    month_label: string;
    enrollment_count: number;
    status: string;
}

export interface PaySummary {
    total_volume: number;
    active_months: number;
    first_month?: string | null;
    latest_month?: string | null;
}

export interface PayRecordResponse {
    status: 'success' | 'error';
    message?: string;
    agent?: PayAgent;
    reports?: PayMonthlyReport[];
    summary?: PaySummary;
}

export interface PayAccessLog {
    id: number;
    email: string;
    identifier: string;
    identifier_type?: string;
    matched_agent_name?: string;
    fep_category?: string;
    total_volume: number;
    ip_address?: string;
    user_agent?: string;
    source: string;
    status: string;
    created_at: string;
}

export interface PayAccessLogsResponse {
    status: 'success' | 'error';
    page: number;
    limit: number;
    total_filtered: number;
    total_records: number;
    total_pages: number;
    count: number;
    logs: PayAccessLog[];
    message?: string;
}

export interface PayLogFilterOptions {
    page?: number;
    limit?: number;
    q?: string;
    status?: string;
    source?: string;
    timeFilter?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
}

export interface PaySearchOptions {
    query: string;
    fepFilter?: string;
    month?: string;
    sortBy?: 'volume_desc' | 'volume_asc' | 'name_asc';
    page?: number;
    limit?: number;
}

export interface PaySearchResponse {
    status: 'success' | 'error';
    count: number;
    total_filtered?: number;
    total_pages?: number;
    page?: number;
    limit?: number;
    agents: PayAgent[];
    message?: string;
}

function getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
        const stored = localStorage.getItem('app_user');
        if (stored) {
            const u = JSON.parse(stored);
            if (u?.token) {
                headers['Authorization'] = `Bearer ${u.token}`;
            }
        }
    } catch { /* ignore */ }
    return headers;
}

/**
 * Search pay directory by NIN, IMEI, or agent name with optional FEP filter, sorting, and pagination
 */
export async function searchPayRecords(
    query: string, 
    fepFilter?: string, 
    extra?: { month?: string; sortBy?: 'volume_desc' | 'volume_asc' | 'name_asc'; page?: number; limit?: number }
): Promise<PaySearchResponse> {
    try {
        const params = new URLSearchParams();
        if (query) params.set('q', query.trim());
        if (fepFilter && fepFilter !== 'All FEPs') params.set('fep', fepFilter.trim());
        if (extra?.month && extra.month !== 'all') params.set('month', extra.month.trim());
        if (extra?.sortBy) params.set('sort_by', extra.sortBy);
        if (extra?.page) params.set('page', String(extra.page));
        if (extra?.limit) params.set('limit', String(extra.limit));

        const res = await fetch(`${API_URL}?action=pay_admin_search&${params.toString()}`, {
            headers: getAuthHeaders()
        });

        if (!res.ok) {
            return {
                status: 'error',
                count: 0,
                agents: [],
                message: `Server returned HTTP ${res.status}`
            };
        }

        const data = await res.json();
        return {
            status: data.status === 'success' ? 'success' : 'error',
            count: data.count || (data.agents?.length ?? 0),
            total_filtered: data.total_filtered ?? (data.count || (data.agents?.length ?? 0)),
            total_pages: data.total_pages ?? 1,
            page: data.page ?? 1,
            limit: data.limit ?? 50,
            agents: data.agents || [],
            message: data.message
        };
    } catch (err: any) {
        return {
            status: 'error',
            count: 0,
            agents: [],
            message: err?.message || 'Failed to connect to pay records service'
        };
    }
}

/**
 * Query access and audit logs from the Pay System with server-side pagination, sorting, and filters
 */
export async function fetchPayAccessLogs(options: PayLogFilterOptions = {}): Promise<PayAccessLogsResponse> {
    try {
        const params = new URLSearchParams();
        if (options.page) params.set('page', String(options.page));
        if (options.limit) params.set('limit', String(options.limit));
        if (options.q) params.set('q', options.q.trim());
        if (options.status && options.status !== 'ALL') params.set('status', options.status);
        if (options.source && options.source !== 'ALL') params.set('source', options.source);
        if (options.timeFilter && options.timeFilter !== 'all') params.set('time_filter', options.timeFilter);
        if (options.startDate) params.set('start_date', options.startDate);
        if (options.endDate) params.set('end_date', options.endDate);
        if (options.sortBy) params.set('sort_by', options.sortBy);

        const res = await fetch(`${API_URL}?action=pay_get_access_logs&${params.toString()}`, {
            headers: getAuthHeaders()
        });

        if (!res.ok) {
            return {
                status: 'error',
                page: 1,
                limit: options.limit || 50,
                total_filtered: 0,
                total_records: 0,
                total_pages: 1,
                count: 0,
                logs: [],
                message: `Server returned HTTP ${res.status}`
            };
        }

        const data = await res.json();
        return {
            status: data.status === 'success' ? 'success' : 'error',
            page: data.page || 1,
            limit: data.limit || 50,
            total_filtered: data.total_filtered || 0,
            total_records: data.total_records || 0,
            total_pages: data.total_pages || 1,
            count: data.count || (data.logs?.length ?? 0),
            logs: data.logs || [],
            message: data.message
        };
    } catch (err: any) {
        return {
            status: 'error',
            page: 1,
            limit: options.limit || 50,
            total_filtered: 0,
            total_records: 0,
            total_pages: 1,
            count: 0,
            logs: [],
            message: err?.message || 'Failed to retrieve access audit logs'
        };
    }
}

/**
 * Returns formatted export URL for downloading filtered access audit CSV
 */
export function getPayAccessLogsExportUrl(options: PayLogFilterOptions = {}): string {
    const params = new URLSearchParams();
    if (options.q) params.set('q', options.q.trim());
    if (options.status && options.status !== 'ALL') params.set('status', options.status);
    if (options.source && options.source !== 'ALL') params.set('source', options.source);
    if (options.timeFilter && options.timeFilter !== 'all') params.set('time_filter', options.timeFilter);
    if (options.startDate) params.set('start_date', options.startDate);
    if (options.endDate) params.set('end_date', options.endDate);
    if (options.sortBy) params.set('sort_by', options.sortBy);

    return `${API_URL}?action=pay_export_access_logs_csv&${params.toString()}`;
}

/**
 * Fetch detailed monthly volume breakdown for a specific agent identifier
 */
export async function getPayRecord(identifier: string): Promise<PayRecordResponse> {
    try {
        const clean = encodeURIComponent(identifier.trim());
        const res = await fetch(`${API_URL}?action=pay_admin_get_record&identifier=${clean}`, {
            headers: getAuthHeaders()
        });

        if (!res.ok) {
            return {
                status: 'error',
                message: `Server returned HTTP ${res.status}`
            };
        }

        const data = await res.json();
        if (data.status === 'success' && data.agent) {
            return {
                status: 'success',
                agent: data.agent,
                reports: data.reports || [],
                summary: data.summary || {
                    total_volume: (data.reports || []).reduce((acc: number, r: PayMonthlyReport) => acc + (Number(r.enrollment_count) || 0), 0),
                    active_months: (data.reports || []).length
                }
            };
        }

        return {
            status: 'error',
            message: data.message || 'Record not found'
        };
    } catch (err: any) {
        return {
            status: 'error',
            message: err?.message || 'Failed to retrieve agent pay record'
        };
    }
}

/**
 * Extract likely NIN or IMEI candidate from a ticket's subject, description, and message history
 */
export function extractPayIdentifierFromTicket(ticket: any): string {
    if (!ticket) return '';

    // Collect text from ticket title, description, and agent messages
    const texts: string[] = [ticket.title || '', ticket.description || ''];
    if (Array.isArray(ticket.messages)) {
        for (const m of ticket.messages) {
            if (m && m.content) texts.push(m.content);
        }
    }

    const fullBlob = texts.join(' ');

    // 1. Check for explicit Device ID patterns (e.g. EACRUGGED-116489034574240, OUKITEL-..., etc.)
    const deviceMatch = fullBlob.match(/(?:EACRUGGED|OUKITEL|QUALCOMM|WHEATEK|HENA)-[A-Z0-9]+/i);
    if (deviceMatch) return deviceMatch[0].trim();

    // 2. Check for 11-digit NIN pattern
    const ninMatch = fullBlob.match(/\b\d{11}\b/);
    if (ninMatch) return ninMatch[0].trim();

    // 3. Check for 14-16 digit bare IMEI
    const imeiMatch = fullBlob.match(/\b\d{14,16}\b/);
    if (imeiMatch) return imeiMatch[0].trim();

    // 4. Fallback to ticket creator's name if distinct from generic names
    if (ticket.createdByName && ticket.createdByName.trim() && !ticket.createdByName.toLowerCase().includes('user') && !ticket.createdByName.toLowerCase().includes('agent')) {
        return ticket.createdByName.trim();
    }

    // 5. Fallback to username portion of email
    if (ticket.createdByEmail) {
        const userPart = ticket.createdByEmail.split('@')[0];
        if (userPart && userPart.length > 3) return userPart;
    }

    return '';
}

/**
 * Build a clean, anti-leak plain-text summary suitable for pasting into ticket conversation
 */
export function formatPayTicketSummary(
    agent: PayAgent,
    reports: PayMonthlyReport[],
    summary?: PaySummary
): string {
    const totalVolume = summary?.total_volume ?? reports.reduce((acc, r) => acc + (Number(r.enrollment_count) || 0), 0);
    const activeMonths = summary?.active_months ?? reports.length;

    let text = `=== ENROLLER WORK & PERFORMANCE RECORD ===\n`;
    text += `Agent Name: ${agent.full_name || 'Enroller'}\n`;
    text += `Identifier: ${agent.identifier} (${agent.identifier_type})\n`;
    text += `FEP Partner: ${agent.fep_category}\n`;
    text += `Total Verified Volume: ${totalVolume.toLocaleString()} enrolments\n`;
    text += `Active Periods: ${activeMonths} reporting period(s)\n\n`;

    if (reports.length > 0) {
        text += `Verified Monthly Breakdown:\n`;
        reports.forEach(r => {
            text += `• ${r.month_label}: ${Number(r.enrollment_count).toLocaleString()} enrolments [${r.status || 'VERIFIED'}]\n`;
        });
    } else {
        text += `No historical monthly enrollment data on file.\n`;
    }

    text += `\n[Official statement generated from verified FEP records]`;
    return text;
}
