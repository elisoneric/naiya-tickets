import { 
  Ticket, Message, TicketPriority, TicketStatus, StaffAccount, AgentRecord, TeamLead, GeneralSettings, SystemFeedback 
} from '../types';
import { sendNewUserWelcomeEmail } from './emailService';

// API Configuration
const API_URL = import.meta.env?.VITE_API_URL || '/backend/api.php';

// Helper to upload base64 images to PHP and get URLs back
export const uploadImageToPHP = async (base64Data: string): Promise<string> => {
    if (!base64Data.startsWith('data:image')) return base64Data; // Already a URL or invalid

    try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        try {
            const stored = localStorage.getItem('app_user');
            if (stored) {
                const u = JSON.parse(stored);
                if (u?.token) headers['Authorization'] = `Bearer ${u.token}`;
            }
        } catch {}

        const res = await fetch(`${API_URL}?action=upload_image`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ image: base64Data })
        });
        const json = await res.json();
        if (json.status === 'success') return json.url;
        return base64Data; // Fallback
    } catch (e) {
        console.error("Image upload failed", e);
        return base64Data; // Fallback
    }
};

// Helper to handle API calls with robust debugging
async function apiCall(action: string, method: string = 'GET', body: any = null, params: Record<string, string> = {}) {
    const queryParams: any = { action, ...params };
    if (method === 'GET') {
        queryParams['_t'] = Date.now().toString();
    }
    const query = new URLSearchParams(queryParams).toString();
    const headers: any = { 'Content-Type': 'application/json' };
    
    try {
        const storedUser = localStorage.getItem('app_user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            if (user.token) {
                headers['Authorization'] = `Bearer ${user.token}`;
            }
        }
    } catch (e) {}

    try {
        const res = await fetch(`${API_URL}?${query}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null
        });

        const text = await res.text();
        
        if (!res.ok) {
            console.error(`[API Error ${res.status}]`, text);
            if (res.status === 503) {
                let errJson: any = null;
                try {
                    errJson = JSON.parse(text);
                } catch {}

                if (errJson?.code === 'SITE_MAINTENANCE') {
                    if (typeof window !== 'undefined') {
                        try {
                            localStorage.setItem('site_maintenance_mode', '1');
                            if (errJson.message) localStorage.setItem('site_maintenance_msg', errJson.message);
                        } catch {}
                        window.dispatchEvent(new CustomEvent('site-maintenance-updated', {
                            detail: { mode: true, message: errJson.message }
                        }));
                    }
                    throw new Error(errJson.message || "System Under Scheduled Maintenance");
                }

                if (errJson?.code === 'SERVICE_MAINTENANCE') {
                    throw new Error(errJson.message || "This service is currently under scheduled maintenance.");
                }

                throw new Error(errJson?.message || "Database Offline");
            }
            if (res.status === 401) {
                // Token invalid or expired — clear session and redirect to login
                localStorage.removeItem('app_user');
                window.location.reload();
                throw new Error("Session expired");
            }
            throw new Error(`API Error (${res.status}): ${text.substring(0, 200)}`);
        }

        try {
            const json = JSON.parse(text);
            if (json.status === 'error') {
                console.error(`[API Backend Error]`, json.message);
                throw new Error(json.message);
            }
            return json;
        } catch (e: any) {
            if (e.message && e.message !== 'Invalid JSON') throw e;
            console.error("[API Parse Error] Raw response:", text);
            if (text.trim().startsWith('<')) {
                throw new Error("Server returned HTML instead of JSON. Check PHP logs or public/debug.php");
            }
            throw new Error("Invalid Server Response");
        }
    } catch (e: any) {
        console.error("[API Execution Failed]", e);
        if (e instanceof TypeError && (e.message.includes('fetch') || e.message.includes('NetworkError') || e.message.includes('Failed to fetch'))) {
            throw new Error("Cannot reach the support server. Please check your internet connection or server domain status.");
        }
        throw e;
    }
}

// --- Tickets (PHP Backend) ---

// Module-level agent roles cache — avoids fetching on every delta poll
let agentRolesCache: Map<string, string> = new Map();

export const getTicketsRaw = async (
    since?: number, 
    limit?: number, 
    offset?: number,
    createdByEmail?: string,
    folder?: string,
    category?: string,
    role?: string
): Promise<{ tickets: Ticket[], serverTime: number, counts?: Record<string, number> }> => {
    try {
        const params: Record<string, string> = {};
        if (since) params.since = since.toString();
        if (limit !== undefined) params.limit = limit.toString();
        if (offset !== undefined) params.offset = offset.toString();
        if (createdByEmail) params.created_by_email = createdByEmail;
        if (folder) params.folder = folder;
        if (category) params.category = category;
        if (role) params.role = role;

        const [res, agents] = await Promise.all([
            apiCall('get_tickets', 'GET', null, params),
            // Skip agent fetch on delta syncs (since is set) — use cached roles
            since ? Promise.resolve([] as any[]) : getAgentListRaw().catch(() => [])
        ]);
        
        // Update cache on full loads; reuse cache on delta syncs
        if (!since && agents.length > 0) {
            agentRolesCache = new Map(agents.map((a: any) => [a.email, a.role]));
        }
        const agentRoles = agentRolesCache;

        const tickets = (res.data || []).map((data: any) => {
            return {
                id: data.id,
                ticketNumber: data.ticketNumber || '',
                title: data.title || '',
                category: data.category || '',
                description: '', // Transferred to getTicketDetails optimization
                status: data.status || 'Open',
                priority: data.priority || 'Low',
                createdByEmail: data.createdByEmail || '',
                createdByName: data.createdByName || '',
                assignedToEmail: data.assignedToEmail || null,
                teamLeadId: data.teamLeadId || null,
                isEscalated: data.isEscalated || false,
                isPinned: data.isPinned || false,
                isReadByStaff: data.isReadByStaff || false,
                isLocked: data.isLocked || false,
                lockedBy: data.lockedBy || null,
                project: data.project || 'Dont Know',
                readBy: data.readBy || [],
                agentRole: agentRoles.get(data.createdByEmail) || 'agent',
                createdAt: new Date(data.createdAt),
                updatedAt: new Date(data.updatedAt),
                lastAgentReplyAt: data.lastAgentReplyAt ? new Date(data.lastAgentReplyAt) : undefined,
                lastMessagePreview: data.lastMessagePreview,
                lastMessageRole: data.lastMessageRole,
                messages: [], // List view has NO messages
                attachments: [],
                detailsLoaded: false 
            } as Ticket;
        });
        
        return { tickets, serverTime: res.serverTime || Date.now(), counts: res.counts };
    } catch (e) {
        console.error("Fetch tickets failed", e);
        return { tickets: [], serverTime: Date.now() };
    }
};

export const searchTicketsRaw = async (query: string): Promise<{ tickets: Ticket[] }> => {
    if (!query) return { tickets: [] };
    try {
        const [res, agents] = await Promise.all([
            apiCall('search_tickets', 'GET', null, { q: query }),
            getAgentListRaw().catch(() => [])
        ]);
        
        const agentRoles = new Map(agents.map(a => [a.email, a.role]));

        const tickets = (res.data || []).map((data: any) => {
            return {
                id: data.id,
                ticketNumber: data.ticketNumber || '',
                title: data.title || '',
                category: data.category || '',
                description: '', 
                status: data.status || 'Open',
                priority: data.priority || 'Low',
                createdByEmail: data.createdByEmail || '',
                createdByName: data.createdByName || '',
                assignedToEmail: data.assignedToEmail || null,
                teamLeadId: data.teamLeadId || null,
                isEscalated: data.isEscalated || false,
                isPinned: data.isPinned || false,
                isReadByStaff: data.isReadByStaff || false,
                isLocked: data.isLocked || false,
                lockedBy: data.lockedBy || null,
                project: data.project || 'Dont Know',
                readBy: data.readBy || [],
                agentRole: agentRoles.get(data.createdByEmail) || 'agent',
                createdAt: new Date(data.createdAt),
                updatedAt: new Date(data.updatedAt),
                lastAgentReplyAt: data.lastAgentReplyAt ? new Date(data.lastAgentReplyAt) : undefined,
                lastMessagePreview: data.lastMessagePreview,
                lastMessageRole: data.lastMessageRole,
                messages: [],
                attachments: [],
                detailsLoaded: false 
            } as Ticket;
        });
        
        return { tickets };
    } catch (e) {
        console.error("Search tickets failed", e);
        return { tickets: [] };
    }
};

export const getTicketDetails = async (id: string, lightweight: boolean = false) => {
    try {
        const params: Record<string, string> = { id };
        if (lightweight) params.lightweight = '1';
        const res = await apiCall('get_ticket_details', 'GET', null, params);
        if (lightweight && res.data) {
            // Lightweight response: metadata for poll check
            return {
                updatedAt: res.data.updatedAt,
                lastMessagePreview: res.data.lastMessagePreview,
                lastMessageRole: res.data.lastMessageRole,
                messageCount: res.data.messageCount,
                lastMessageId: res.data.lastMessageId
            };
        }
        if (res.data) {
            return {
                messages: (res.data.messages || []).map((m: any, i: number) => ({
                    ...m,
                    id: m.id || `msg-${i}-${Date.now()}`,
                    timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
                })),
                attachments: res.data.attachments || [],
                description: res.data.description || '',
                detailsLoaded: true
            };
        }
        return null;
    } catch (e) {
        console.error("Fetch details failed", e);
        return null;
    }
};


export const createTicket = async (ticketData: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'messages' | 'ticketNumber' | 'status' | 'priority' | 'lastAgentReplyAt'>) => {
  const ticketNumber = `TKT-${Date.now().toString().slice(-6)}`;
  
  let teamLeadId: string | null = null;
  let teamLeadEmail: string | null = null;
  
  try {
    const agentRecord = await getAgentRecord(ticketData.createdByEmail);
    if (agentRecord && agentRecord.teamLeadId) {
      teamLeadId = agentRecord.teamLeadId;
      const tl = await getTeamLeadById(teamLeadId);
      if (tl) teamLeadEmail = tl.email;
    }
  } catch (e) {
    console.warn("TL lookup failed", e);
  }

  const priority = determinePriority(ticketData.category);
  const project = ticketData.project || 'Dont Know';

  let assignedToEmail: string | null = null;
  try {
      const settings = await getGeneralSettings();
      if (settings.autoRouteRules && settings.autoRouteRules.length > 0) {
          for (const rule of settings.autoRouteRules) {
              if (!rule.isActive) continue;
              const matchesPriority = rule.conditionPriority === 'Any' || rule.conditionPriority === priority;
              const matchesCategory = rule.conditionCategory === 'Any' || rule.conditionCategory === ticketData.category;
              const matchesProject = !rule.conditionProject || rule.conditionProject === 'Any' || rule.conditionProject === project;
              
              if (matchesPriority && matchesCategory && matchesProject) {
                  assignedToEmail = rule.assignToEmail;
                  break; // Stop at first match
              }
          }
      }
  } catch (e) {
      console.warn("Auto routing failed", e);
  }

  let finalAttachments = ticketData.attachments;
  if (finalAttachments && finalAttachments.length > 0) {
      finalAttachments = await Promise.all(
          finalAttachments.map(att => uploadImageToPHP(att))
      );
  }

  const now = new Date().toISOString();
  const newTicket: any = {
    ...ticketData,
    attachments: finalAttachments,
    ticketNumber,
    status: 'Open',
    priority,
    readBy: [ticketData.createdByEmail],
    teamLeadId,
    teamLeadEmail,
    project,
    assignedToEmail,
    createdAt: now,
    updatedAt: now,
    messages: []
  };

  const res = await apiCall('create_ticket', 'POST', newTicket);
  return { id: res.id, ...newTicket, createdAt: new Date(now), updatedAt: new Date(now) };
};

export const markTicketAsRead = async (ticketId: string, userEmail: string, _role: string) => {
    try {
        await apiCall('update_ticket', 'POST', { readBy: userEmail }, { id: ticketId });
    } catch (e) {
        console.error("Mark read failed", e);
    }
};

export const updateTicket = async (ticketId: string, updates: Partial<Ticket>) => {
    try {
        await apiCall('update_ticket', 'POST', updates, { id: ticketId });
    } catch (e) {
        console.error("Update ticket failed", e);
    }
};

export const addMessageToTicket = async (ticketId: string, messageData: Omit<Message, 'id' | 'timestamp'>) => {
  let finalAttachments = messageData.attachments;
  if (finalAttachments && finalAttachments.length > 0) {
      finalAttachments = await Promise.all(
          finalAttachments.map(att => uploadImageToPHP(att))
      );
  }

  const newMessage = {
      ...messageData,
      attachments: finalAttachments,
      id: 'msg-' + Date.now(),
      timestamp: new Date().toISOString()
  };
  
  await apiCall('add_message', 'POST', newMessage, { id: ticketId });
  return newMessage;
};

export const updateTicketStatus = async (ticketId: string, status: TicketStatus) => {
    await updateTicket(ticketId, { status });
};

export const assignTicket = async (ticketId: string, email: string | null) => {
    await updateTicket(ticketId, { assignedToEmail: email });
};

export const escalateTicket = async (ticketId: string) => {
    await updateTicket(ticketId, { isEscalated: true });
};

export const toggleTicketPin = async (ticketId: string, isPinned: boolean) => {
    await updateTicket(ticketId, { isPinned });
};

// --- Agents (PHP Backend) ---

export const getAgentListRaw = async (): Promise<AgentRecord[]> => {
    try {
        const agents = await apiCall('get_agents');
        return Array.isArray(agents) ? agents : [];
    } catch (e) {
        console.error("Failed to fetch agents", e);
        throw e;
    }
};

export const addAgentToAllowlist = async (email: string, teamLeadId?: string, role: 'agent' | 'team_lead' = 'agent', altEmail?: string) => {
    const targetEmail = email.toLowerCase().trim();
    const record: AgentRecord = { email: targetEmail, teamLeadId: teamLeadId || '', role, ...(altEmail ? { altEmail: altEmail.trim() } : {}) };
    
    // Post only target record for non-destructive UPSERT
    const res = await apiCall('update_agents', 'POST', [record]);
    return res;
};

export const bulkUpdateAgentAllowlist = async (updates: AgentRecord[], options?: { suppressWelcomeEmail?: boolean; onProgress?: (processed: number, total: number) => void }) => {
    if (!updates || updates.length === 0) return { status: 'success', created: [] };
    
    // Process in batches of 500 records to handle thousands of agents efficiently
    const BATCH_SIZE = 500;
    const allCreated: any[] = [];
    
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        const res = await apiCall('update_agents', 'POST', batch);
        
        if (res?.created && Array.isArray(res.created)) {
            allCreated.push(...res.created);
        }
        
        if (options?.onProgress) {
            options.onProgress(Math.min(i + BATCH_SIZE, updates.length), updates.length);
        }
    }
    
    return { status: 'success', created: allCreated, totalProcessed: updates.length };
};

export const removeAgentFromAllowlist = async (email: string) => {
    return await deleteAgents([email]);
};

export const deleteAgents = async (emails: string[]) => {
    const lowerEmails = emails.map(e => e.toLowerCase().trim()).filter(e => e.includes('@'));
    if (lowerEmails.length === 0) return { status: 'success', deletedCount: 0 };
    
    // Call explicit targeted delete endpoint
    return await apiCall('delete_agents', 'POST', { emails: lowerEmails });
};

export const bulkUploadAgentEmails = async (
    rawTextOrEmails: string | string[],
    options?: {
        teamLeadId?: string;
        role?: 'agent' | 'team_lead' | 'referee' | 'moniepoint';
        suppressWelcomeEmail?: boolean;
        onProgress?: (processed: number, total: number) => void;
    }
) => {
    let emailList: string[] = [];
    if (typeof rawTextOrEmails === 'string') {
        // Split by comma, newline, semicolon, or whitespace
        emailList = rawTextOrEmails
            .split(/[\r\n,;\s]+/)
            .map(e => e.trim().toLowerCase())
            .filter(e => e.includes('@') && e.length > 3);
    } else if (Array.isArray(rawTextOrEmails)) {
        emailList = rawTextOrEmails
            .map(e => e.trim().toLowerCase())
            .filter(e => e.includes('@') && e.length > 3);
    }

    // Deduplicate
    const uniqueEmails = Array.from(new Set(emailList));
    if (uniqueEmails.length === 0) {
        throw new Error("No valid email addresses found in input.");
    }

    const updates: AgentRecord[] = uniqueEmails.map(email => ({
        email,
        teamLeadId: options?.teamLeadId || '',
        role: options?.role || 'agent'
    }));

    return await bulkUpdateAgentAllowlist(updates, {
        suppressWelcomeEmail: options?.suppressWelcomeEmail ?? true, // Default to true for bulk uploads
        onProgress: options?.onProgress
    });
};

export const getAgentRecord = async (email: string): Promise<AgentRecord | null> => {
    try {
        const agents = await getAgentListRaw();
        const targetEmail = email.toLowerCase().trim();
        return agents.find(a => a.email.toLowerCase() === targetEmail) || null;
    } catch (e) {
        return null;
    }
};

// --- Other Services (PHP Backend) ---

export const getTeamLeads = async (): Promise<TeamLead[]> => {
    try {
        const leads = await apiCall('get_leads');
        return leads || [];
    } catch (e) {
        console.error("Failed to fetch leads", e);
        return [];
    }
};

export const getTeamLeadById = async (id: string): Promise<TeamLead | null> => {
    const leads = await getTeamLeads();
    return leads.find(l => l.id === id) || null;
};

export const getStaffAccounts = async (): Promise<StaffAccount[]> => {
    try {
        const staff = await apiCall('get_staff');
        return staff || [];
    } catch (e) {
        console.error("Failed to fetch staff", e);
        return [];
    }
};

export const addStaffAccount = async (staff: StaffAccount) => {
    await apiCall('upsert_staff', 'POST', staff);
};

export const updateStaffAccount = async (email: string, updates: Partial<StaffAccount>) => {
    const staff = await getStaffAccounts();
    const existing = staff.find(s => s.email === email);
    if (existing) {
        await apiCall('upsert_staff', 'POST', { ...existing, ...updates });
    }
};

export const deleteStaffAccount = async (email: string) => {
    await apiCall('delete_staff', 'POST', null, { id: email });
};

export const authenticateStaff = async (email: string, password: string): Promise<StaffAccount | null> => {
    try {
        const res = await apiCall('login_staff', 'POST', { email, password });
        return res.user || null;
    } catch (e) {
        return null;
    }
};

export const authenticateTeamLead = async (email: string, password: string): Promise<TeamLead | null> => {
    try {
        const res = await apiCall('login_lead', 'POST', { email, password });
        return res.user || null;
    } catch (e) {
        return null;
    }
};

export const addTeamLead = async (lead: TeamLead) => {
    await apiCall('upsert_lead', 'POST', lead);
};

export const deleteTeamLead = async (id: string) => {
    await apiCall('delete_lead', 'POST', null, { id });
};

export const handleTicketViewEntry = async (ticketId: string, userEmail: string) => {
    await apiCall('update_ticket', 'POST', { lockedBy: userEmail, isLocked: true }, { id: ticketId });
};

export const handleTicketViewExit = async (ticketId: string, _userEmail: string) => {
    await apiCall('update_ticket', 'POST', { lockedBy: null, isLocked: false }, { id: ticketId });
};

const DEFAULT_CATEGORIES = [
    "Device & Activation Related",
    "Metadata Onboarding",
    "NIMC Login Details",
    "VPN Related",
    "WEBMAIL",
    "Payment & Statement Portal",
    "Others"
];

export const getGeneralSettings = async (): Promise<GeneralSettings> => {
    try {
        const settings = await apiCall('get_settings');
        const finalSettings = settings || { categories: [] };
        if (!finalSettings.categories || finalSettings.categories.length === 0) {
            finalSettings.categories = [...DEFAULT_CATEGORIES];
        }
        if (!finalSettings.triageCategories || finalSettings.triageCategories.length === 0) {
            finalSettings.triageCategories = DEFAULT_CATEGORIES.map((c, i) => ({
                id: `tc_${i}`,
                title: c,
                description: `Issues related to ${c}`,
                type: 'manual',
                icon: i === 0 ? 'Monitor' : i === 1 ? 'Database' : i === 2 ? 'Key' : i === 3 ? 'Globe' : i === 4 ? 'Mail' : i === 5 ? 'CreditCard' : 'FileText',
                presetCategory: c,
                options: []
            }));
        }
        if (typeof finalSettings.siteMaintenanceMode === 'undefined') {
            finalSettings.siteMaintenanceMode = false;
        }
        if (finalSettings.aiProviderConfig) {
            if (typeof window !== 'undefined') {
                (window as any).__AI_PROVIDER_CONFIG__ = finalSettings.aiProviderConfig;
                try {
                    localStorage.setItem('ai_provider_config', JSON.stringify(finalSettings.aiProviderConfig));
                } catch {}
            }
        }
        return finalSettings as GeneralSettings;
    } catch (e) {
        console.error("Failed to fetch settings", e);
        return { 
            categories: [...DEFAULT_CATEGORIES],
            siteMaintenanceMode: false,
            siteMaintenanceMessage: '',
            triageCategories: DEFAULT_CATEGORIES.map((c, i) => ({
                id: `tc_${i}`,
                title: c,
                description: `Issues related to ${c}`,
                type: 'manual',
                icon: i === 0 ? 'Monitor' : i === 1 ? 'Database' : i === 2 ? 'Key' : i === 3 ? 'Globe' : i === 4 ? 'Mail' : i === 5 ? 'CreditCard' : 'FileText',
                presetCategory: c,
                options: []
            }))
        } as GeneralSettings;
    }
};

export const saveGeneralSettings = async (settings: GeneralSettings) => {
    if (settings.aiProviderConfig) {
        if (typeof window !== 'undefined') {
            (window as any).__AI_PROVIDER_CONFIG__ = settings.aiProviderConfig;
            try {
                localStorage.setItem('ai_provider_config', JSON.stringify(settings.aiProviderConfig));
            } catch {}
        }
    }
    await apiCall('update_settings', 'POST', settings);
};

export const updateGeneralSettings = saveGeneralSettings;

export const authenticateAgent = async (email: string, password?: string) => {
    try {
        const res = await apiCall('login_agent', 'POST', { email, password });
        return res; // Returning full response to handle 'setup_required'
    } catch (e: any) {
        return { status: 'error', message: e.message || 'Network error' };
    }
};

export const sendAgentOtp = async (email: string) => {
    return await apiCall('send_agent_otp', 'POST', { email });
};

export const verifyAgentOtpAndSetPassword = async (email: string, otp: string, password: string) => {
    return await apiCall('verify_agent_otp_and_set_password', 'POST', { email, otp, password });
};

export const approveAgentRecovery = async (currentEmail: string, altEmail: string, feedbackId?: string) => {
    return await apiCall('approve_agent_recovery', 'POST', { currentEmail, altEmail, feedbackId });
};

export const setAgentPassword = async (email: string, password: string) => {
    return await apiCall('set_agent_password', 'POST', { email, password });
};

export const updateAgentPassword = async (password: string, tokenOverride?: string) => {
    if (tokenOverride) {
        const res = await fetch(`${API_URL}?action=update_agent_password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOverride}` },
            body: JSON.stringify({ password }),
        });
        return res.json();
    }
    return await apiCall('update_agent_password', 'POST', { password });
};

export const getSystemFeedback = async (): Promise<SystemFeedback[]> => {
    try {
        const feedback = await apiCall('get_feedback');
        return feedback || [];
    } catch (e) {
        console.error("Failed to fetch feedback", e);
        return [];
    }
};

export const submitSystemFeedback = async (feedback: Omit<SystemFeedback, 'id' | 'timestamp' | 'isResolved'>) => {
    let proofImage = feedback.proofImage;
    if (proofImage) {
        proofImage = await uploadImageToPHP(proofImage);
    }
    
    await apiCall('save_feedback', 'POST', { ...feedback, proofImage });
};

export const saveSystemFeedback = submitSystemFeedback;

export const resolveFeedback = async (id: string) => {
    await apiCall('resolve_feedback', 'POST', null, { id });
};

export const getFeedbackImage = async (id: string): Promise<string | null> => {
    try {
        const res = await apiCall('get_feedback_image', 'GET', null, { id });
        return res.image || null;
    } catch (e) {
        console.error("Failed to fetch feedback image", e);
        return null;
    }
};

export const trackAction = async (actionName: string) => {
    try {
        await apiCall('track_action', 'POST', { actionName });
    } catch (e) {
        console.error("Failed to track action", e);
    }
}

export const getActionStats = async () => {
    try {
        const res = await apiCall('get_stats', 'GET');
        return res.data || {};
    } catch (e) {
        return {};
    }
}

export const getAnalyticsData = async () => {
    try {
        const res = await apiCall('get_analytics_snapshot');
        return res.data || [];
    } catch (e) {
        console.error("Failed to fetch analytics", e);
        return [];
    }
};

export const getAllSystemData = async () => {
    const [ticketsResult, settings, agents, feedback] = await Promise.all([
        getTicketsRaw(0, 100000),
        getGeneralSettings(),
        getAgentListRaw(),
        getSystemFeedback(),
    ]);
    return {
        tickets: ticketsResult.tickets,
        settings,
        agents,
        feedback,
        exportedAt: new Date().toISOString(),
    };
};

export const restoreSystemData = async (data: any) => {
    const ops: Promise<any>[] = [];
    if (data.settings) ops.push(saveGeneralSettings(data.settings));
    if (data.agents) ops.push(apiCall('update_agents', 'POST', data.agents));
    await Promise.all(ops);
    return { restored: ['settings', 'agents'].filter(k => data[k]) };
};

const determinePriority = (category: string): TicketPriority => {
    const highPriority = ['Urgent', 'System Outage', 'Security'];
    const mediumPriority = ['Bug', 'Access Issue'];
    
    if (highPriority.some(c => category.includes(c))) return 'High';
    if (mediumPriority.some(c => category.includes(c))) return 'Medium';
    return 'Low';
};

