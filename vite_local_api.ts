import fs from 'fs';
import path from 'path';
import type { Plugin, Connect } from 'vite';

const DB_PATH = path.resolve(process.cwd(), 'local_db.json');

interface LocalDB {
  settings: any;
  agents: any[];
  staff: any[];
  teamLeads: any[];
  tickets: any[];
  feedback: any[];
}

const DEFAULT_DB: LocalDB = {
  settings: {
    categories: [
      "Device & Activation Related",
      "Metadata Onboarding",
      "WEBMAIL",
      "NIMC Login Details",
      "VPN Related",
      "Others"
    ],
    shortcuts: [
      { trigger: "details", text: "Good day, please send your information: NIN, Phone Number, Email, and Full Name" },
      { trigger: "meta", text: "Good day, this agent is yet to be onboarded on Metadata" },
      { trigger: "vpn", text: "Please ensure your VPN client is updated to version 2.4.1 and re-authenticate." }
    ],
    macros: [],
    triageCategories: [
      {
        id: "vpn_triage",
        title: "VPN Related",
        presetCategory: "VPN Related",
        type: "options",
        options: []
      },
      {
        id: "nimc_triage",
        title: "NIMC Login Details",
        presetCategory: "NIMC Login Details",
        type: "options",
        options: []
      },
      {
        id: "webmail_triage",
        title: "WEBMAIL",
        presetCategory: "WEBMAIL",
        type: "options",
        options: []
      }
    ],
    incidentBanner: {
      enabled: true,
      title: "VPN & System Assistance Active",
      message: "First time signing in? Just enter your email below to start."
    }
  },
  agents: [
    { email: "agent@naiya.com", name: "Ibrahim Garba", role: "agent", teamLeadId: "TL001", password: "" },
    { email: "john@naiya.com", name: "John Doe", role: "agent", teamLeadId: "TL001", password: "" },
    { email: "mary@moniepoint.com", name: "Mary Moniepoint", role: "moniepoint", teamLeadId: "TL001", password: "" },
    { email: "referee@naiya.com", name: "Referee Agent", role: "referee", teamLeadId: "TL001", password: "" }
  ],
  staff: [
    { email: "itstaff", name: "Root Admin", role: "staff", isRoot: true, password: "admin" },
    { email: "admin@naiya.com", name: "IT Administrator", role: "staff", isRoot: true, password: "password123" },
    { email: "support@naiya.com", name: "Support Officer", role: "staff", isRoot: false, password: "password123" }
  ],
  teamLeads: [
    { id: "TL001", email: "manager@naiya.com", name: "Operations Manager", password: "password123" }
  ],
  tickets: [
    {
      id: "tkt_sample_1",
      ticket_number: "TKT-849201",
      title: "VPN Connection keeps timing out in Kano office",
      category: "VPN Related",
      description: "Good morning IT team, my VPN disconnects every 5 minutes when attempting enrollment sync. Error code 0x8007274C.",
      status: "Open",
      priority: "High",
      created_by_email: "john@naiya.com",
      created_by_name: "John Doe",
      assigned_to_email: null,
      team_lead_id: "TL001",
      team_lead_email: "manager@naiya.com",
      is_escalated: 0,
      is_pinned: 0,
      is_read_by_staff: 0,
      is_locked: 0,
      locked_by: null,
      project: "FEP : NAIYA",
      created_at: new Date(Date.now() - 3600000).toISOString().replace('T', ' ').substring(0, 19),
      updated_at: new Date(Date.now() - 3600000).toISOString().replace('T', ' ').substring(0, 19),
      last_agent_reply_at: new Date(Date.now() - 3600000).toISOString().replace('T', ' ').substring(0, 19),
      last_message_preview: "Good morning IT team, my VPN disconnects every 5 minutes when attempting enrollment sync.",
      last_message_role: "agent",
      messages: JSON.stringify([
        {
          id: "msg-101",
          senderId: "john@naiya.com",
          senderName: "John Doe",
          role: "agent",
          content: "Good morning IT team, my VPN disconnects every 5 minutes when attempting enrollment sync. Error code 0x8007274C.",
          timestamp: new Date(Date.now() - 3600000).toISOString()
        }
      ]),
      attachments: JSON.stringify([]),
      read_by: JSON.stringify(["john@naiya.com"]),
      agentRole: "agent"
    },
    {
      id: "tkt_sample_2",
      ticket_number: "TKT-910243",
      title: "NIMC Portal Login Invalid Credentials",
      category: "NIMC Login Details",
      description: "My NIMC portal password expired and the reset link is not arriving in my inbox.",
      status: "Open",
      priority: "Medium",
      created_by_email: "mary@moniepoint.com",
      created_by_name: "Mary Moniepoint",
      assigned_to_email: null,
      team_lead_id: "TL001",
      team_lead_email: "manager@naiya.com",
      is_escalated: 0,
      is_pinned: 0,
      is_read_by_staff: 0,
      is_locked: 0,
      locked_by: null,
      project: "SAMUIKY",
      created_at: new Date(Date.now() - 7200000).toISOString().replace('T', ' ').substring(0, 19),
      updated_at: new Date(Date.now() - 7200000).toISOString().replace('T', ' ').substring(0, 19),
      last_agent_reply_at: new Date(Date.now() - 7200000).toISOString().replace('T', ' ').substring(0, 19),
      last_message_preview: "My NIMC portal password expired and the reset link is not arriving in my inbox.",
      last_message_role: "agent",
      messages: JSON.stringify([
        {
          id: "msg-102",
          senderId: "mary@moniepoint.com",
          senderName: "Mary Moniepoint",
          role: "agent",
          content: "My NIMC portal password expired and the reset link is not arriving in my inbox.",
          timestamp: new Date(Date.now() - 7200000).toISOString()
        }
      ]),
      attachments: JSON.stringify([]),
      read_by: JSON.stringify(["mary@moniepoint.com"]),
      agentRole: "moniepoint"
    },
    {
      id: "tkt_sample_3",
      ticket_number: "TKT-304918",
      title: "Webmail Access Password Reset",
      category: "WEBMAIL",
      description: "Please reset password for my official email account.",
      status: "In Progress",
      priority: "Low",
      created_by_email: "agent@naiya.com",
      created_by_name: "Ibrahim Garba",
      assigned_to_email: "itstaff",
      team_lead_id: "TL001",
      team_lead_email: "manager@naiya.com",
      is_escalated: 0,
      is_pinned: 0,
      is_read_by_staff: 1,
      is_locked: 0,
      locked_by: null,
      project: "FEP : NAIYA",
      created_at: new Date(Date.now() - 86400000).toISOString().replace('T', ' ').substring(0, 19),
      updated_at: new Date(Date.now() - 14400000).toISOString().replace('T', ' ').substring(0, 19),
      last_agent_reply_at: new Date(Date.now() - 86400000).toISOString().replace('T', ' ').substring(0, 19),
      last_message_preview: "Hello Ibrahim, we have generated a temporary password for your mailbox.",
      last_message_role: "staff",
      messages: JSON.stringify([
        {
          id: "msg-103",
          senderId: "agent@naiya.com",
          senderName: "Ibrahim Garba",
          role: "agent",
          content: "Please reset password for my official email account.",
          timestamp: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: "msg-104",
          senderId: "itstaff",
          senderName: "Root Admin",
          role: "staff",
          content: "Hello Ibrahim, we have generated a temporary password for your mailbox. Please check your recovery email.",
          timestamp: new Date(Date.now() - 14400000).toISOString()
        }
      ]),
      attachments: JSON.stringify([]),
      read_by: JSON.stringify(["itstaff"]),
      agentRole: "agent"
    }
  ],
  feedback: []
};

function loadDB(): LocalDB {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Failed to read local DB, resetting to defaults", e);
  }
  saveDB(DEFAULT_DB);
  return DEFAULT_DB;
}

function saveDB(db: LocalDB) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error("Failed to write local DB", e);
  }
}

let payDataCache: { agents: any[]; reports: any[] } | null = null;

function loadPayData(): { agents: any[]; reports: any[] } {
  if (payDataCache) return payDataCache;
  const candidatePaths = [
    path.resolve(process.cwd(), '../naiya_works/pay_data.json'),
    path.resolve(process.cwd(), '../naiya_works/cpanel_pay/pay_data.json'),
    path.resolve(process.cwd(), 'pay_data.json')
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        payDataCache = JSON.parse(raw);
        console.log(`[Vite Local API] Loaded pay data from ${p} (${payDataCache?.agents?.length} agents, ${payDataCache?.reports?.length} reports)`);
        return payDataCache!;
      } catch (err) {
        console.error(`Failed to parse pay data from ${p}:`, err);
      }
    }
  }

  return { agents: [], reports: [] };
}

export function localApiPlugin(): Plugin {
  return {
    name: 'vite-plugin-local-backend-api',
    configureServer(server) {
      server.middlewares.use((req: Connect.IncomingMessage, res, next) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        
        if (!url.pathname.startsWith('/backend/api.php') && !url.pathname.startsWith('/backend/mail_handler.php')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end();
          return;
        }

        if (url.pathname.includes('mail_handler.php')) {
          res.end(JSON.stringify({ success: true, message: 'Local dev mail simulated' }));
          return;
        }

        const action = url.searchParams.get('action') || '';
        const id = url.searchParams.get('id') || '';
        const db = loadDB();

        const handleRequest = (body: any) => {
          const authHeader = req.headers.authorization || '';
          let currentUser: any = null;
          if (authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            try {
              const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
              currentUser = decoded;
            } catch {}
          }

          switch (action) {
            case 'get_settings': {
              res.end(JSON.stringify({ status: 'success', ...db.settings }));
              break;
            }

            case 'get_tickets': {
              const folder = url.searchParams.get('folder') || 'Inbox';
              const category = url.searchParams.get('category');
              const role = url.searchParams.get('role');
              const createdByEmail = url.searchParams.get('created_by_email');

              let list = [...db.tickets];

              // If agent, only show their tickets
              if (currentUser && currentUser.role === 'agent') {
                list = list.filter(t => t.created_by_email?.toLowerCase() === currentUser.email?.toLowerCase());
              } else if (createdByEmail) {
                list = list.filter(t => t.created_by_email?.toLowerCase() === createdByEmail.toLowerCase());
              }

              if (category && category !== 'All Categories') {
                list = list.filter(t => t.category === category);
              }
              if (role && role !== 'All Roles') {
                list = list.filter(t => (t.agentRole || 'agent').toLowerCase() === role.toLowerCase());
              }

              // Calculate sidebar counts
              let inbox = 0, assigned = 0, unread = 0, read = 0, closed = 0;
              db.tickets.forEach(t => {
                if (t.status !== 'Closed') {
                  inbox++;
                  if (currentUser && t.assigned_to_email === currentUser.email) assigned++;
                  const isStaffReply = t.last_message_role === 'staff' || t.last_message_role === 'team_lead';
                  const isTickUnread = !t.is_read_by_staff && !isStaffReply;
                  if (isTickUnread) unread++;
                  else read++;
                } else {
                  closed++;
                }
              });

              // Apply folder filter
              if (folder === 'Inbox') {
                list = list.filter(t => t.status !== 'Closed');
              } else if (folder === 'Unread') {
                list = list.filter(t => {
                  if (t.status === 'Closed') return false;
                  const isStaffReply = t.last_message_role === 'staff' || t.last_message_role === 'team_lead';
                  return !t.is_read_by_staff && !isStaffReply;
                });
              } else if (folder === 'Read') {
                list = list.filter(t => {
                  if (t.status === 'Closed') return false;
                  const isStaffReply = t.last_message_role === 'staff' || t.last_message_role === 'team_lead';
                  return t.is_read_by_staff || isStaffReply;
                });
              } else if (folder === 'Closed' || folder === 'Resolved') {
                list = list.filter(t => t.status === 'Closed');
              } else if (folder === 'Assigned to me') {
                list = list.filter(t => t.status !== 'Closed' && currentUser && t.assigned_to_email === currentUser.email);
              }

              const formatted = list.map(t => ({
                id: t.id,
                ticketNumber: t.ticket_number,
                title: t.title,
                category: t.category,
                description: '',
                status: t.status,
                priority: t.priority,
                createdByEmail: t.created_by_email,
                createdByName: t.created_by_name,
                assignedToEmail: t.assigned_to_email,
                teamLeadId: t.team_lead_id,
                teamLeadEmail: t.team_lead_email,
                isEscalated: !!t.is_escalated,
                isPinned: !!t.is_pinned,
                isReadByStaff: !!t.is_read_by_staff,
                isLocked: !!t.is_locked,
                lockedBy: t.locked_by,
                project: t.project || 'Dont Know',
                readBy: typeof t.read_by === 'string' ? JSON.parse(t.read_by) : t.read_by || [],
                agentRole: t.agentRole || 'agent',
                createdAt: t.created_at,
                updatedAt: t.updated_at,
                lastAgentReplyAt: t.last_agent_reply_at,
                lastMessagePreview: t.last_message_preview,
                lastMessageRole: t.last_message_role
              }));

              res.end(JSON.stringify({
                status: 'success',
                data: formatted,
                counts: { inbox, assigned, unread, read, closed },
                serverTime: Date.now()
              }));
              break;
            }

            case 'search_tickets': {
              const rawQuery = (url.searchParams.get('q') || '').trim();
              if (!rawQuery) {
                res.end(JSON.stringify({ status: 'success', data: [] }));
                break;
              }
              const cleanQuery = rawQuery.replace(/^#/, '').toLowerCase();
              
              let list = [...db.tickets];
              if (currentUser && currentUser.role === 'agent') {
                list = list.filter(t => t.created_by_email?.toLowerCase() === currentUser.email?.toLowerCase());
              }

              const matched = list.filter(t => {
                const idMatch = t.id?.toLowerCase().includes(cleanQuery);
                const numMatch = t.ticket_number?.toLowerCase().includes(cleanQuery);
                const titleMatch = t.title?.toLowerCase().includes(cleanQuery);
                const emailMatch = t.created_by_email?.toLowerCase().includes(cleanQuery);
                const nameMatch = t.created_by_name?.toLowerCase().includes(cleanQuery);
                const descMatch = t.description?.toLowerCase().includes(cleanQuery);
                const catMatch = t.category?.toLowerCase().includes(cleanQuery);
                const projMatch = t.project?.toLowerCase().includes(cleanQuery);
                const previewMatch = t.last_message_preview?.toLowerCase().includes(cleanQuery);
                return idMatch || numMatch || titleMatch || emailMatch || nameMatch || descMatch || catMatch || projMatch || previewMatch;
              });

              // Rank exact matches first
              matched.sort((a, b) => {
                const aNum = (a.ticket_number || '').toLowerCase();
                const bNum = (b.ticket_number || '').toLowerCase();
                const aId = (a.id || '').toLowerCase();
                const bId = (b.id || '').toLowerCase();
                
                const aExact = aNum === cleanQuery || aId === cleanQuery;
                const bExact = bNum === cleanQuery || bId === cleanQuery;
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;

                const aPrefix = aNum.startsWith(cleanQuery) || aId.startsWith(cleanQuery);
                const bPrefix = bNum.startsWith(cleanQuery) || bId.startsWith(cleanQuery);
                if (aPrefix && !bPrefix) return -1;
                if (!aPrefix && bPrefix) return 1;

                const timeA = new Date(a.updated_at || a.created_at).getTime();
                const timeB = new Date(b.updated_at || b.created_at).getTime();
                return timeB - timeA;
              });

              const formatted = matched.slice(0, 200).map(t => ({
                id: t.id,
                ticketNumber: t.ticket_number || '',
                title: t.title || '',
                category: t.category || '',
                description: '',
                status: t.status || 'Open',
                priority: t.priority || 'Low',
                createdByEmail: t.created_by_email || '',
                createdByName: t.created_by_name || '',
                assignedToEmail: t.assigned_to_email || null,
                teamLeadId: t.team_lead_id || null,
                teamLeadEmail: t.team_lead_email || null,
                isEscalated: !!t.is_escalated,
                isPinned: !!t.is_pinned,
                isReadByStaff: !!t.is_read_by_staff,
                isLocked: !!t.is_locked,
                lockedBy: t.locked_by,
                project: t.project || 'Dont Know',
                readBy: typeof t.read_by === 'string' ? JSON.parse(t.read_by) : t.read_by || [],
                agentRole: t.agentRole || 'agent',
                createdAt: t.created_at,
                updatedAt: t.updated_at,
                lastAgentReplyAt: t.last_agent_reply_at,
                lastMessagePreview: t.last_message_preview,
                lastMessageRole: t.last_message_role
              }));

              res.end(JSON.stringify({
                status: 'success',
                data: formatted
              }));
              break;
            }

            case 'get_ticket_details': {
              const ticket = db.tickets.find(t => t.id === id);
              if (ticket) {
                if (url.searchParams.get('lightweight') === '1') {
                  const msgs = typeof ticket.messages === 'string' ? JSON.parse(ticket.messages) : ticket.messages || [];
                  const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
                  res.end(JSON.stringify({
                    status: 'success',
                    lightweight: true,
                    data: {
                      updatedAt: ticket.updatedAt || ticket.updated_at,
                      lastMessagePreview: ticket.lastMessagePreview || ticket.last_message_preview,
                      lastMessageRole: ticket.lastMessageRole || ticket.last_message_role,
                      messageCount: msgs.length,
                      lastMessageId: lastMsg?.id || ''
                    }
                  }));
                  break;
                }
                res.end(JSON.stringify({
                  status: 'success',
                  data: {
                    messages: typeof ticket.messages === 'string' ? JSON.parse(ticket.messages) : ticket.messages || [],
                    attachments: typeof ticket.attachments === 'string' ? JSON.parse(ticket.attachments) : ticket.attachments || [],
                    description: ticket.description || ''
                  }
                }));
              } else {
                res.statusCode = 404;
                res.end(JSON.stringify({ status: 'error', message: 'Ticket not found' }));
              }
              break;
            }

            case 'login_agent': {
              const emailInput = (body?.email || url.searchParams.get('email') || '').trim().toLowerCase();
              const passwordInput = body?.password || '';
              
              const agent = db.agents.find(a => a.email.toLowerCase() === emailInput);
              if (!agent) {
                res.end(JSON.stringify({ status: 'error', message: 'Not found in allowlist' }));
                return;
              }

              const token = Buffer.from(JSON.stringify(agent)).toString('base64');
              if (!agent.password) {
                res.end(JSON.stringify({ status: 'success', no_password: true, has_password: false, token, agent }));
              } else if (passwordInput && agent.password === passwordInput) {
                res.end(JSON.stringify({ status: 'success', has_password: true, token, agent }));
              } else if (passwordInput && agent.password !== passwordInput) {
                res.end(JSON.stringify({ status: 'error', message: 'Invalid credentials' }));
              } else {
                res.end(JSON.stringify({ status: 'error', message: 'Invalid credentials' }));
              }
              break;
            }

            case 'send_agent_otp': {
              const emailInput = (body?.email || url.searchParams.get('email') || '').trim().toLowerCase();
              const agent = db.agents.find(a => a.email.toLowerCase() === emailInput);
              if (!agent) {
                res.end(JSON.stringify({ status: 'error', message: 'Not found in allowlist' }));
              } else {
                res.end(JSON.stringify({ status: 'success', message: 'OTP sent', sentTo: agent.email }));
              }
              break;
            }

            case 'verify_agent_otp_and_set_password':
            case 'verify_agent_otp': {
              const email = (body?.email || '').toLowerCase();
              const password = body?.password || '';
              const agent = db.agents.find(a => a.email.toLowerCase() === email);
              if (agent) {
                agent.password = password;
                delete (agent as any).must_change_password;
                delete (agent as any).mustChangePassword;
                saveDB(db);
                const token = Buffer.from(JSON.stringify(agent)).toString('base64');
                res.end(JSON.stringify({ status: 'success', token, agent }));
              } else {
                const newAgent = { email, name: email.split('@')[0], role: 'agent', teamLeadId: 'TL001', password };
                db.agents.push(newAgent);
                saveDB(db);
                const token = Buffer.from(JSON.stringify(newAgent)).toString('base64');
                res.end(JSON.stringify({ status: 'success', token, agent: newAgent }));
              }
              break;
            }

            case 'update_agent_password': {
              const password = body?.password || '';
              let authEmail = '';
              const authHeader = req.headers['authorization'];
              if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
                try {
                  const decoded = JSON.parse(Buffer.from(authHeader.substring(7), 'base64').toString('utf8'));
                  authEmail = decoded.email || '';
                } catch {}
              }
              if (authEmail) {
                const agent = db.agents.find(a => a.email.toLowerCase() === authEmail.toLowerCase());
                if (agent) {
                  agent.password = password;
                  delete (agent as any).must_change_password;
                  delete (agent as any).mustChangePassword;
                  saveDB(db);
                }
              }
              res.end(JSON.stringify({ status: 'success', message: 'Password updated successfully' }));
              break;
            }

            case 'login_staff':
            case 'staff_login': {
              const emailInput = (body?.email || '').trim().toLowerCase();
              const passwordInput = body?.password || '';

              const staffMember = db.staff.find(s => 
                (s.email.toLowerCase() === emailInput || s.name.toLowerCase() === emailInput) && 
                (!s.password || s.password === passwordInput || passwordInput === 'admin' || passwordInput === 'password123' || passwordInput === 'admin123')
              );

              if (staffMember) {
                const token = Buffer.from(JSON.stringify(staffMember)).toString('base64');
                res.end(JSON.stringify({ status: 'success', token, staff: staffMember }));
              } else {
                // Allow itstaff / admin default
                if (emailInput === 'itstaff' || emailInput === 'admin@naiya.com') {
                  const rootStaff = { email: emailInput, name: 'Root Admin', role: 'staff', isRoot: true };
                  const token = Buffer.from(JSON.stringify(rootStaff)).toString('base64');
                  res.end(JSON.stringify({ status: 'success', token, staff: rootStaff }));
                } else {
                  res.end(JSON.stringify({ status: 'error', message: 'Invalid staff credentials' }));
                }
              }
              break;
            }

            case 'login_team_lead': {
              const emailInput = (body?.email || '').trim().toLowerCase();
              const tl = db.teamLeads.find(t => t.email.toLowerCase() === emailInput || t.id.toLowerCase() === emailInput);
              if (tl) {
                const token = Buffer.from(JSON.stringify({ ...tl, role: 'team_lead' })).toString('base64');
                res.end(JSON.stringify({ status: 'success', token, teamLead: tl }));
              } else {
                res.end(JSON.stringify({ status: 'error', message: 'Invalid team lead credentials' }));
              }
              break;
            }

            case 'add_message': {
              const ticket = db.tickets.find(t => t.id === id);
              if (!ticket) {
                res.statusCode = 404;
                res.end(JSON.stringify({ status: 'error', message: 'Ticket not found' }));
                return;
              }

              const msgs = typeof ticket.messages === 'string' ? JSON.parse(ticket.messages) : ticket.messages || [];
              const newMsg = {
                id: 'msg-' + Date.now(),
                senderId: body?.senderId || 'user',
                senderName: body?.senderName || 'User',
                role: body?.role || 'guest',
                content: body?.content || '',
                attachments: body?.attachments || [],
                timestamp: new Date().toISOString()
              };
              msgs.push(newMsg);

              const role = body?.role;
              const isStaff = role === 'staff' || role === 'team_lead';

              ticket.messages = JSON.stringify(msgs);
              ticket.updated_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
              ticket.last_message_preview = (body?.content || '').substring(0, 100);
              ticket.last_message_role = role;

              if (isStaff) {
                ticket.is_read_by_staff = 1;
                if (ticket.status === 'Open') ticket.status = 'In Progress';
                if (!ticket.assigned_to_email) ticket.assigned_to_email = body?.senderId;
              } else {
                ticket.is_read_by_staff = 0;
                ticket.last_agent_reply_at = ticket.updated_at;
                if (ticket.status === 'Closed') ticket.status = 'Open';
              }

              saveDB(db);
              res.end(JSON.stringify({ status: 'success' }));
              break;
            }

            case 'update_ticket': {
              const ticket = db.tickets.find(t => t.id === id);
              if (!ticket) {
                res.statusCode = 404;
                res.end(JSON.stringify({ status: 'error', message: 'Ticket not found' }));
                return;
              }

              if (body?.status) ticket.status = body.status;
              if (body?.assignedToEmail !== undefined) ticket.assigned_to_email = body.assignedToEmail;
              if (body?.isReadByStaff !== undefined) ticket.is_read_by_staff = body.isReadByStaff ? 1 : 0;
              if (body?.isPinned !== undefined) ticket.is_pinned = body.isPinned ? 1 : 0;
              if (body?.isEscalated !== undefined) ticket.is_escalated = body.isEscalated ? 1 : 0;
              
              ticket.updated_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
              saveDB(db);
              res.end(JSON.stringify({ status: 'success' }));
              break;
            }

            case 'create_ticket': {
              const newTicket = {
                id: 'tkt_' + Date.now(),
                ticket_number: 'TKT-' + Math.floor(100000 + Math.random() * 900000),
                title: body?.title || 'Support Request',
                category: body?.category || 'Others',
                description: body?.description || '',
                status: 'Open',
                priority: body?.priority || 'Low',
                created_by_email: body?.createdByEmail || 'user@naiya.com',
                created_by_name: body?.createdByName || 'User',
                assigned_to_email: null,
                team_lead_id: body?.teamLeadId || 'TL001',
                team_lead_email: body?.teamLeadEmail || null,
                project: body?.project || 'Dont Know',
                is_escalated: 0,
                is_pinned: 0,
                is_read_by_staff: 0,
                is_locked: 0,
                locked_by: null,
                created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
                updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
                last_agent_reply_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
                last_message_preview: (body?.description || '').substring(0, 100),
                last_message_role: 'agent',
                messages: JSON.stringify([]),
                attachments: JSON.stringify(body?.attachments || []),
                read_by: JSON.stringify([body?.createdByEmail]),
                agentRole: 'agent'
              };

              db.tickets.unshift(newTicket);
              saveDB(db);
              res.end(JSON.stringify({ status: 'success', id: newTicket.id }));
              break;
            }

            case 'get_analytics_snapshot': {
              const tickets = db.tickets.map(t => {
                const rawMsgs = typeof t.messages === 'string' ? JSON.parse(t.messages || '[]') : (t.messages || []);
                const lightMessages = (rawMsgs || []).map((m: any) => ({
                  role: m.role || '',
                  senderId: m.senderId || m.senderEmail || '',
                  senderName: m.senderName || '',
                  timestamp: m.timestamp || ''
                }));
                return {
                  id: t.id,
                  ticketNumber: t.ticket_number,
                  title: t.title,
                  category: t.category,
                  status: t.status,
                  priority: t.priority,
                  createdByEmail: t.created_by_email,
                  createdByName: t.created_by_name,
                  assignedToEmail: t.assigned_to_email,
                  teamLeadId: t.team_lead_id,
                  teamLeadEmail: t.team_lead_email,
                  isEscalated: !!t.is_escalated,
                  project: t.project || 'Dont Know',
                  createdAt: t.created_at ? (t.created_at.includes('T') ? t.created_at : t.created_at.replace(' ', 'T') + '+01:00') : null,
                  updatedAt: t.updated_at ? (t.updated_at.includes('T') ? t.updated_at : t.updated_at.replace(' ', 'T') + '+01:00') : null,
                  messages: lightMessages
                };
              });
              res.end(JSON.stringify({ status: 'success', data: tickets }));
              break;
            }

            case 'get_agents': {
              const agents = db.agents.map(a => ({
                ...a,
                createdAt: a.createdAt || a.created_at || new Date().toISOString()
              }));
              res.end(JSON.stringify({ status: 'success', data: agents }));
              break;
            }

            case 'get_staff': {
              res.end(JSON.stringify({ status: 'success', data: db.staff }));
              break;
            }

            case 'get_stats': {
              const stats = db.settings?.action_stats || {
                vpn_resolves: 984,
                webmail_resolves: 142,
                triage_resolves: 265
              };
              res.end(JSON.stringify({ status: 'success', data: stats }));
              break;
            }

            case 'track_action': {
              if (!db.settings) db.settings = {};
              if (!db.settings.action_stats) {
                db.settings.action_stats = { vpn_resolves: 1641, webmail_resolves: 24, triage_resolves: 265 };
              }
              const actionName = body?.actionName;
              if (actionName) {
                db.settings.action_stats[actionName] = (db.settings.action_stats[actionName] || 0) + 1;
                const today = new Date().toISOString().split('T')[0];
                if (!db.settings.action_stats.daily) {
                  db.settings.action_stats.daily = {};
                }
                if (!db.settings.action_stats.daily[today]) {
                  db.settings.action_stats.daily[today] = { vpn_resolves: 0, webmail_resolves: 0, triage_resolves: 0 };
                }
                db.settings.action_stats.daily[today][actionName] = (db.settings.action_stats.daily[today][actionName] || 0) + 1;
                saveDB(db);
              }
              res.end(JSON.stringify({ status: 'success' }));
              break;
            }

            case 'check_vpn_status': {
              const email = url.searchParams.get('email') || '';
              res.end(JSON.stringify({
                status: 'password_ready',
                username: 'AG-' + (email.split('@')[0] || 'DEMO') + '.Naiya',
                password: 'Auth3ntic@tor' + Math.floor(100 + Math.random() * 900),
                swap_count: 0
              }));
              break;
            }

            case 'vpn_admin_get_user': {
              const email = url.searchParams.get('email') || '';
              res.end(JSON.stringify({
                status: 'success',
                user: { email, role: 'agent', swap_count: 0, referee_email: null, vpn_quota: 1 },
                vpns: [
                  {
                    id: 'AG-' + (email.split('@')[0] || 'DEMO') + '.Naiya',
                    name: 'AG-' + (email.split('@')[0] || 'DEMO') + '.Naiya',
                    password: 'Auth3ntic@tor243',
                    status: 'assigned',
                    assignedTo: email
                  }
                ],
                pool_available_count: 48
              }));
              break;
            }

            case 'vpn_admin_swap': {
              const reason = body?.reason || '';
              if (reason.toLowerCase().includes('ai triage') || reason.toLowerCase().includes('auto-swap')) {
                res.statusCode = 403;
                res.end(JSON.stringify({
                  status: 'error',
                  message: 'AI auto-swapping is permanently disabled. Only human staff can swap VPN credentials.'
                }));
                break;
              }
              const email = body?.email || '';
              const newId = 'AG-SWAP' + Math.floor(1000 + Math.random() * 9000) + '.Naiya';
              res.end(JSON.stringify({
                status: 'success',
                message: `Successfully swapped VPN to ${newId}`,
                oldVpnId: body?.vpnId || 'old_vpn',
                newVpn: {
                  id: newId,
                  password: 'Auth3ntic@tor' + Math.floor(100 + Math.random() * 900),
                  status: 'assigned'
                }
              }));
              break;
            }

            case 'vpn_admin_assign': {
              const newId = body?.specificVpnId || ('AG-ADD' + Math.floor(1000 + Math.random() * 9000) + '.Naiya');
              res.end(JSON.stringify({
                status: 'success',
                message: `Successfully assigned VPN ${newId}`,
                vpn: {
                  id: newId,
                  password: 'Auth3ntic@tor' + Math.floor(100 + Math.random() * 900),
                  status: 'assigned'
                }
              }));
              break;
            }

            case 'vpn_admin_revoke': {
              res.end(JSON.stringify({
                status: 'success',
                message: `Successfully revoked VPN from user`
              }));
              break;
            }

            case 'cpanel_change_webmail_password': {
              const email = body?.email || 'user';
              const domain = body?.domain || 'naiyatechnology.org';
              const fullEmail = email.includes('@') ? email : `${email}@${domain}`;
              res.end(JSON.stringify({
                status: 'success',
                cpanel_executed: true,
                message: `Password for ${fullEmail} successfully updated in cPanel for ${domain}! (Dev Mock)`,
                email: fullEmail,
                domain: domain,
                password: body?.password
              }));
              break;
            }

            case 'get_saved_webmail_credentials': {
              res.end(JSON.stringify({
                status: 'success',
                credentials: [
                  {
                    id: 'wm_1',
                    email: 'elison@naiyatechnology.org',
                    password: 'NAIYA@849201',
                    domain: 'naiyatechnology.org',
                    resetAt: new Date().toISOString(),
                    resetBy: 'elison@naiyatechnology.org'
                  }
                ]
              }));
              break;
            }

            case 'save_saved_webmail_credential': {
              res.end(JSON.stringify({ status: 'success', message: 'Credential saved (mock)' }));
              break;
            }

            case 'get_cpanel_domain_configs': {
              res.end(JSON.stringify({
                status: 'success',
                domains: {
                  'naiyatechnology.org': { host: 'https://naiyatechnology.org:2083', user: 'naiyatec', has_token: true, source: 'env' },
                  'naiyatech.com.ng': { host: 'https://naiyatech.com.ng:2083', user: 'naiyatech', has_token: true, source: 'env' },
                  'samuikyglobal.com.ng': { host: 'https://samuikyglobal.com.ng:2083', user: 'samuiky', has_token: true, source: 'env' }
                }
              }));
              break;
            }

            case 'update_cpanel_domain_configs': {
              const domain = body?.domain || 'naiyatechnology.org';
              res.end(JSON.stringify({
                status: 'success',
                message: `cPanel credentials for ${domain} updated successfully. (Dev Mock)`
              }));
              break;
            }

            case 'pay_admin_search': {
              const q = (url.searchParams.get('q') || '').trim();
              const fep = (url.searchParams.get('fep') || '').trim();
              const payData = loadPayData();
              const cleanQ = q.replace(/\s+/g, '').toLowerCase();

              let matched = payData.agents.filter((a: any) => {
                const identClean = (a.identifier || '').replace(/\s+/g, '').toLowerCase();
                const nameClean = (a.full_name || '').toLowerCase();
                const fepClean = (a.fep_category || '').toLowerCase();

                const matchesQ = !cleanQ || identClean.includes(cleanQ) || nameClean.includes(cleanQ) || fepClean.includes(cleanQ);
                const matchesFep = !fep || fep === 'All FEPs' || a.fep_category === fep;

                return matchesQ && matchesFep;
              });

              res.end(JSON.stringify({
                status: 'success',
                count: matched.length,
                agents: matched.slice(0, 50)
              }));
              break;
            }

            case 'pay_admin_get_record': {
              const identifier = (url.searchParams.get('identifier') || '').trim();
              if (!identifier) {
                res.end(JSON.stringify({ status: 'error', message: 'Identifier parameter is required' }));
                break;
              }

              const payData = loadPayData();
              const clean = identifier.replace(/\s+/g, '').toUpperCase();
              const candidates = [
                clean,
                `EACRUGGED-${clean}`,
                `OUKITEL-${clean}`,
                `QUALCOMM-${clean}`,
                `WHEATEK-${clean}`,
                `HENA-${clean}`
              ];
              if (clean.includes('-')) {
                const parts = clean.split('-');
                if (parts[1]) candidates.push(parts[1]);
              }

              let agent = payData.agents.find((a: any) => {
                const aId = (a.identifier || '').replace(/\s+/g, '').toUpperCase();
                return candidates.includes(aId);
              });

              if (!agent) {
                agent = payData.agents.find((a: any) => {
                  const aId = (a.identifier || '').replace(/\s+/g, '').toUpperCase();
                  const aName = (a.full_name || '').toUpperCase();
                  return aId.includes(clean) || (clean.length > 3 && aName.includes(clean));
                });
              }

              if (!agent) {
                res.end(JSON.stringify({ status: 'error', message: 'Agent record not found' }));
                break;
              }

              const reports = payData.reports.filter((r: any) => r.identifier === agent.identifier);

              const MONTH_ORDER: Record<string, number> = {
                'sep_2026': 1, 'aug_2026': 2, 'jul_2026': 3, 'jun_2026': 4,
                'may_2026': 5, 'apr_2026': 6, 'mar_2026': 7, 'feb_2026': 8, 'jan_2026': 9,
                'dec_2025': 10, 'nov_2025': 11, 'oct_2025': 12, 'sep_2025': 13,
                'jul_2025': 14, 'jun_2025': 15
              };

              reports.sort((a: any, b: any) => {
                const pA = MONTH_ORDER[a.month] || 99;
                const pB = MONTH_ORDER[b.month] || 99;
                return pA - pB;
              });

              let totalVol = 0;
              for (const r of reports) {
                totalVol += Number(r.enrollment_count) || 0;
              }

              res.end(JSON.stringify({
                status: 'success',
                agent,
                reports,
                summary: {
                  total_volume: totalVol,
                  active_months: reports.length,
                  first_month: reports.length > 0 ? reports[reports.length - 1].month_label : null,
                  latest_month: reports.length > 0 ? reports[0].month_label : null
                }
              }));
              break;
            }

            default: {
              res.end(JSON.stringify({ status: 'success', data: [] }));
              break;
            }
          }
        };

        if (req.method === 'POST') {
          let raw = '';
          req.on('data', chunk => { raw += chunk; });
          req.on('end', () => {
            try {
              const parsed = raw ? JSON.parse(raw) : {};
              handleRequest(parsed);
            } catch {
              handleRequest({});
            }
          });
        } else {
          handleRequest(null);
        }
      });
    }
  };
}
