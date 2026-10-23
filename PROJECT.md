# PROJECT.md - Source of Truth: Naiya Support System

## 1. Executive Overview

**Naiya Support System** (`naiya.v3`) is a multi-tier enterprise support ticketing, live chat triage, AI assistant, and agent management application built for high-throughput IT support operations.

The system provides unified access for **Agents**, **Referees**, **Moniepoint Partners**, **Team Leads (Managers)**, and **IT Staff**, featuring real-time folder views, automated GD image compression, JWT-based security, and single-click cPanel deployment packaging.

---

## 2. Technical Stack & Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript & Vite.
- **Styling**: Vanilla CSS + TailwindCSS utility tokens (custom dark mode support via HSL palette and glassmorphism).
- **Icons & UI**: Lucide React / Custom SVG icon registry (`Icons.tsx`).
- **Timezone Management**: `date-fns-tz` set to West Africa Time (`Africa/Lagos`).
- **State Management**: React Context (`TicketContext`, `AuthContext`, `ThemeContext`, `ToastContext`).

### Backend Architecture
- **Language / Server**: PHP 8.x running on Apache / cPanel.
- **Database**: MySQL / MariaDB via PDO with prepared statements.
- **Authentication**: Custom JWT (JSON Web Tokens) with HMAC-SHA256 signatures & bearer headers.
- **Image Processing**: Native GD library with automatic WebP conversion and max 1600px dimension resizing.
- **Email Service**: PHPMailer with UTF-8 SMTP encoding support.

---

## 3. Directory Structure

```
naiya.v3/
├── App.tsx                       # Primary Application Router & Context Wrapper
├── index.html                    # Single Page Application HTML Entry Point
├── build_cpanel.ps1              # Deployment packaging script (generates deploy_cpanel.zip)
├── components/
│   ├── admin/                    # Staff & Admin Views
│   │   ├── EnterpriseAgentDashboard.tsx  # Main Staff Workspace
│   │   ├── AgentTicketList.tsx          # Filterable Ticket List Pane
│   │   ├── AgentTicketView.tsx          # Ticket Detail & Reply Thread
│   │   ├── AgentManager.tsx             # Agent Directory & Bulk CSV Restore
│   │   ├── FeedbackManager.tsx          # User Feedback & Bug Report Tracker
│   │   ├── TriageManager.tsx            # AI Triage & Suggestion Rules
│   │   └── DatabaseManager.tsx          # Database Backup & Maintenance
│   ├── tickets/
│   │   ├── QuickActions.tsx             # Staff Quick Reply & Status Actions
│   │   └── MessageThread.tsx            # Threaded Conversation Display
│   ├── user/                            # User Assistants (VPN, NIMC, Webmail)
│   └── layout/
│       └── OutlookHeader.tsx            # Global Top Navigation Header
├── contexts/
│   ├── AuthContext.tsx                  # User Identity & Token Management
│   ├── TicketContext.tsx                # Ticket State, Polling & Optimistic Updates
│   ├── ThemeContext.tsx                 # Dark/Light Mode Preference
│   └── ToastContext.tsx                 # Pop-up Notifications
├── services/
│   ├── storageService.ts                # API Fetch Wrappers & Local Draft Storage
│   ├── ticketService.ts                 # High-level Ticket Workflow Helpers
│   └── emailService.ts                  # Email Notification Dispatcher
└── cpanel/                              # PHP Backend Scripts
    ├── api.php                          # Central API Gateway & Image Uploader
    ├── db.php                           # PDO Database Connection Singleton
    ├── .htaccess                        # Apache Rewrite Rules & SPA Routing
    └── routes/
        ├── tickets.php                  # Ticket CRUD, Search, Counts & Messages
        ├── auth.php                     # Authentication & Password Handlers
        ├── agents.php                   # Agent Allowlist & Role Assignment
        ├── staff.php                    # Staff & Team Lead Account Management
        ├── feedback.php                 # System Feedback Endpoints
        └── system.php                   # Settings, Stats & Migration Handlers
```

---

## 4. Source of Truth: Ticket State Lifecycle

### Ticket Statuses
- **Open**: New ticket submitted by an agent, or reopened upon new agent message.
- **In Progress**: Ticket claimed by staff or replied to by staff (`lastMessageRole = 'staff'`).
- **Closed**: Resolved ticket (marked manually or via auto-resolve for inactive read tickets > 24 hours).

### Folder Filter Definitions
- **Inbox**: All non-closed tickets (`status != 'Closed'`).
- **Unread**: Tickets requiring staff attention/reply (`status != 'Closed' AND is_read_by_staff = 0 AND last_message_role != 'staff' AND last_message_role != 'team_lead'`). Opening a ticket keeps it in Unread (with a "Viewed" tag) until staff actually replies.
- **Read**: Tickets already replied to by staff or team lead (`status != 'Closed' AND (is_read_by_staff = 1 OR last_message_role = 'staff' OR last_message_role = 'team_lead')`).
- **Assigned to me**: Open tickets assigned to the logged-in staff member (`status != 'Closed' AND assigned_to_email = :user_email`).
- **Closed**: Resolved tickets (`status = 'Closed'`).

### Real-Time Optimistic Updates
When staff actions occur (reply, assign, close, status change), `TicketContext.updateLocalTicket(ticketId, updates)` immediately mutates React memory before waiting for HTTP responses. This guarantees instant visual feedback (e.g. ticket transitions and drops from **Unread** to **Read** the moment staff sends a reply).

---

## 5. Security & Access Control

1. **Role Hierarchy**:
   - `agent` / `referee` / `moniepoint`: Can only view tickets created by their own email.
   - `team_lead`: Can view managed team tickets, analytics, team load metrics.
   - `staff`: Can view, claim, reply to, and resolve all tickets.
   - `isRoot` (`itstaff`): Unrestricted access to database management, system settings, feedback, and agent directory backups.
2. **JWT Authentication**:
   - Tokens stored in `localStorage.app_user`.
   - Included in HTTP `Authorization: Bearer <token>` headers on all API requests.

---

## 6. Build & Deployment Pipeline

To package the project for production deployment on cPanel:

```powershell
powershell -ExecutionPolicy Bypass -File .\build_cpanel.ps1
```

### Build Artifact Output
- `deploy_cpanel.zip`: Bundles compiled React assets (`dist/`), root `.htaccess`, root favicons, and `/backend/` PHP scripts.

### Deployment Instructions
1. Upload `deploy_cpanel.zip` to cPanel File Manager in domain root.
2. Extract zip directly in root directory.
3. Preserve existing `uploads/` and `backups/` directories.
4. Database upgrades run automatically via `/backend/api.php?action=upgrade`.

---

## 7. Operational Guidelines & Maintenance

- **Adding Staff/Leads**: Managed via Admin Settings -> Staff Manager / Team Lead Manager.
- **Bulk Agent Directory Import**: Managed via Agent Manager -> Upload .TXT / .CSV or paste comma-separated emails.
- **Database Backup**: Handled via `DatabaseManager.tsx` or `/backend/backup_handler.php`.
