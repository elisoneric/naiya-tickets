
export type UserRole = 'staff' | 'agent' | 'team_lead' | 'guest' | 'moniepoint';

export interface User {
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  isRoot?: boolean; // For the main 'itstaff' account
  teamLeadId?: string | null; // For agents
  managedTeamId?: string | null; // For Team Leads
  specializedCategories?: string[]; // New: For staff to filter their view
  token?: string; // New: JWT token
  hasPassword?: boolean; // Whether the agent has set up a password
}

export interface StaffAccount {
  email: string;
  name: string;
  password: string; 
  role: 'staff';
  avatar?: string;
  isRoot?: boolean;
  specializedCategories?: string[]; // New
  token?: string;
}

export interface TeamLead {
  id: string; // TL001
  email: string;
  name: string;
  password: string;
  avatar?: string;
}

export interface AgentRecord {
  email: string;
  name?: string;
  teamLeadId: string; // The ID of the TL managing this agent
  role?: 'agent' | 'team_lead' | 'referee' | 'moniepoint'; // Optional role for special tags
  altEmail?: string;
  createdAt?: string;
}

export type ReportPeriodMode = 'week' | 'month' | 'both';

export type TicketStatus = 'Open' | 'In Progress' | 'Closed' | 'AI Triage';
export type TicketPriority = 'Low' | 'Medium' | 'High';
export type ProjectType = 'FEP : NAIYA' | 'SAMUIKY' | 'Dont Know';

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  role: UserRole | 'system';
  content: string;
  attachments?: string[]; // Base64 strings
  timestamp: Date;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  category: string;
  project?: ProjectType; // New
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdByEmail: string;
  createdByName: string;
  agentRole?: 'agent' | 'team_lead' | 'referee' | 'moniepoint';
  
  // Routing / Escalation
  assignedToEmail?: string | null; // Specific person working on it
  teamLeadId?: string | null; // The TL responsible for this ticket initially
  teamLeadEmail?: string | null;
  isEscalated?: boolean; // If true, moves from TL scope to IT Staff scope
  
  // Content
  attachments?: string[]; // Files uploaded during creation

  createdAt: Date;
  updatedAt: Date;
  lastAgentReplyAt?: Date; // New: For sorting logic (stays put until agent replies)
  
  lastMessagePreview?: string;
  lastMessageRole?: string; // To quickly filter Read/Unread
  messages: Message[];
  searchableText?: string; // Added for robust searching
  
  isLocked?: boolean;
  lockedBy?: string | null;
  
  readBy?: string[];
  isReadByStaff?: boolean; // New: Shared read status for all IT staff
  isPinned?: boolean; // New: For Pinned folder

  // Lazy Loading Flag
  detailsLoaded?: boolean;
}

export interface Shortcut {
  trigger: string;
  text: string;
}

export interface TriageOption {
  id: string;
  title: string;
  description?: string;
  type: 'resolution' | 'manual';
  resolutionText?: string;
  resolutionLink?: string;
  presetCategory?: string;
}

export interface TriageCategory {
  id: string;
  title: string;
  description?: string;
  type: 'options' | 'resolution' | 'manual';
  options?: TriageOption[];
  resolutionText?: string;
  resolutionLink?: string;
  presetCategory?: string;
  disabled?: boolean;
  disabledMessage?: string;
}

export interface Macro {
  id: string;
  name: string;
  description: string;
  content: string; // The text to insert
  actionStatus?: TicketStatus; // Optional: Auto set status to Closed etc.
}

export interface AutoRouteRule {
  id: string;
  name: string;
  conditionPriority?: TicketPriority | 'Any';
  conditionCategory?: string | 'Any';
  conditionProject?: ProjectType | 'Any';
  assignToEmail: string; // The staff email to auto-assign to
  isActive: boolean;
}

export interface AiProviderConfig {
  activeProvider: 'indunix' | 'deepseek';
  indunix: {
    apiKey: string;
    apiUrl: string;
    model: string;
  };
  deepseek: {
    apiKey: string;
    apiUrl: string;
    model: string;
  };
}

export interface GeneralSettings {
  categories: string[];
  shortcuts?: Shortcut[];
  triageCategories?: TriageCategory[];
  macros?: Macro[];
  autoRouteRules?: AutoRouteRule[];
  incidentBanner?: {
    enabled: boolean;
    title: string;
    message: string;
  };
  aiProviderConfig?: AiProviderConfig;
  siteMaintenanceMode?: boolean;
  siteMaintenanceMessage?: string;
}

export interface SystemFeedback {
  id: string;
  type: 'suggestion' | 'complaint' | 'email_recovery';
  email: string; // Sender email
  name?: string;
  content: string;
  proofImage?: string; // For complaints
  hasProofImage?: boolean; // New: indicates if there's an image on the server
  timestamp: Date;
  isResolved: boolean;
}

