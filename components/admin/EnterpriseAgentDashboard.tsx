import React, { useMemo, useEffect } from 'react';
import { useTickets } from '../../contexts/TicketContext';
import { Icons } from '../common/Icons';
import { useAuth } from '../../contexts/AuthContext';
import { AgentTicketList } from './AgentTicketList';
import { AgentTicketView } from './AgentTicketView';
import { AdminSettings } from '../../pages/AdminSettings';
import { AnalyticsDashboard } from '../../pages/AnalyticsDashboard';
import { OutlookHeader } from '../layout/OutlookHeader';
import { AgentCreateTicketView } from './AgentCreateTicketView';
import { AgentManager } from './AgentManager';
import { FeedbackManager } from './FeedbackManager';
import { AgentPayView } from './AgentPayView';
import { isIndependenceDay } from '../../utils/independenceDay';

export const EnterpriseAgentDashboard: React.FC = () => {
    const { activeFolder, setActiveFolder, activeTicketId, tickets, categories, selectedCategory, setSelectedCategory, selectedRole, setSelectedRole } = useTickets();
    const { user } = useAuth();
    
    const isRoot = !!user?.isRoot || user?.email?.toLowerCase() === 'itstaff';
    const isNigeriaDay = isIndependenceDay();

    const dynamicRoles = useMemo(() => {
        const unique = new Set<string>();
        tickets.forEach(t => {
            if (t.agentRole && t.agentRole !== 'staff') {
                const formatted = t.agentRole === 'team_lead' ? 'Team Lead' : t.agentRole.charAt(0).toUpperCase() + t.agentRole.slice(1);
                unique.add(formatted);
            }
        });
        return ['All Roles', 'Agent', 'Referee', 'Moniepoint', 'Team Lead', ...Array.from(unique)].filter((v, i, a) => a.indexOf(v) === i);
    }, [tickets]);

    const calculatedCounts = useMemo(() => {
        let inbox = 0;
        let aiTriage = 0;
        let assigned = 0;
        let unread = 0;
        let read = 0;
        let closed = 0;

        let scopedTickets = tickets;
        if (selectedCategory && selectedCategory !== 'All Categories') {
            scopedTickets = scopedTickets.filter(t => t.category?.includes(selectedCategory));
        }
        if (selectedRole && selectedRole !== 'All Roles') {
            scopedTickets = scopedTickets.filter(t => {
                const role = t.agentRole || 'agent';
                return role.toLowerCase() === selectedRole.toLowerCase();
            });
        }

        scopedTickets.forEach(ticket => {
            if (ticket.status === 'AI Triage') {
                aiTriage++;
            } else if (ticket.status !== 'Closed') {
                inbox++;
                if (ticket.assignedToEmail === user?.email) {
                    assigned++;
                }

                const isStaffReply = ticket.lastMessageRole === 'staff' || ticket.lastMessageRole === 'team_lead';
                const isTickUnread = !ticket.isReadByStaff && !isStaffReply;
                if (isTickUnread) {
                    unread++;
                } else {
                    read++;
                }
            } else {
                closed++;
            }
        });
        return { inbox, aiTriage, assigned, unread, read, closed };
    }, [tickets, user, selectedCategory, selectedRole]);
    
    const counts = calculatedCounts;

    const folders = [
        { id: 'Inbox', name: 'Inbox', icon: Icons.Inbox, count: counts.inbox },
        { id: 'AI Inbox', name: 'AI Inbox', icon: Icons.Sparkles, count: counts.aiTriage },
        { id: 'Assigned to me', name: 'Assigned to You', icon: Icons.User, count: counts.assigned },
        { id: 'Unread', name: 'Unread', icon: Icons.Unread, count: counts.unread, isLive: true },
        { id: 'Read', name: 'Read', icon: Icons.Chat, count: counts.read },
        { id: 'Closed', name: 'Resolved', icon: Icons.Closed, count: counts.closed },
        { id: 'Pay', name: 'Pay Records', icon: Icons.Document, adminOnly: true },
        { id: 'Analytics', name: 'Analytics', icon: Icons.Dashboard, adminOnly: true, rootOnly: true },
        { id: 'Settings', name: 'Admin Settings', icon: Icons.Settings, adminOnly: true }
    ];

    // Global keyboard shortcuts for folder switching when not in inputs
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeEl = document.activeElement;
            const isInputActive = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement || (activeEl as HTMLElement)?.isContentEditable;
            if (isInputActive) return;

            // 'c' or 'n' to create ticket (if not staff)
            if ((e.key === 'c' || e.key === 'n') && user?.role !== 'staff') {
                e.preventDefault();
                setActiveFolder('NewTicket');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [user?.role, setActiveFolder]);

    return (
        <div className="flex flex-col h-[100dvh] min-h-[100dvh] overflow-hidden bg-surface-50 dark:bg-dark-bg font-sans">
            <OutlookHeader />
            <div className="flex-1 flex overflow-hidden bg-surface-50 dark:bg-dark-bg relative">
                {/* Left Column: Navigation sidebar (hidden on mobile) */}
                <aside 
                    aria-label="Sidebar navigation"
                    className={`hidden md:flex w-[240px] ${
                        isNigeriaDay 
                            ? 'bg-gradient-to-b from-emerald-950 via-emerald-900 to-dark-bg text-surface-200' 
                            : 'bg-dark-bg text-surface-300'
                    } flex-col shrink-0 z-20 transition-all duration-300 relative border-r border-dark-border`}
                >
                    <div className="px-4 flex items-center justify-start gap-3 border-b border-dark-border shrink-0 h-14">
                        <div className={`w-7 h-7 flex items-center justify-center shrink-0 rounded-lg ${
                            isNigeriaDay ? 'bg-emerald-500 text-emerald-950' : 'bg-brand-600 text-white shadow-glow'
                        }`}>
                            <Icons.Inbox size={16} />
                        </div>
                        <span className="font-semibold text-[15px] tracking-tight text-surface-100">Naiya Desk</span>
                    </div>

                    <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-1 px-3">
                        {user?.role !== 'staff' && (
                            <button
                                onClick={() => setActiveFolder('NewTicket')}
                                className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 mb-3 rounded-lg font-semibold text-sm transition-all duration-200 shadow-sm ${
                                    activeFolder === 'NewTicket' 
                                        ? 'bg-surface-0 text-brand-600 shadow-xs' 
                                        : 'bg-brand-600 hover:bg-brand-500 active:scale-[0.98] text-white shadow-xs'
                                }`}
                                id="guide-create-ticket-btn"
                            >
                                <Icons.Plus size={16} />
                                <span>Create Ticket</span>
                            </button>
                        )}
                        
                        <div className="text-2xs font-semibold text-surface-400 uppercase tracking-wider px-2 mb-1.5 mt-1">Filters</div>
                        <div className="px-1 mb-4 space-y-2">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="w-full py-1.5 px-2.5 bg-dark-card hover:bg-dark-hover text-xs text-surface-300 border border-dark-border rounded-lg outline-none focus:border-brand-500 transition-colors cursor-pointer appearance-none"
                            >
                                <option value="All Categories" className="bg-dark-card">All Categories</option>
                                {categories.sort().map(c => (
                                    <option key={c} value={c} className="bg-dark-card">{c}</option>
                                ))}
                            </select>
                            <select
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                                className="w-full py-1.5 px-2.5 bg-dark-card hover:bg-dark-hover text-xs text-surface-300 border border-dark-border rounded-lg outline-none focus:border-brand-500 transition-colors cursor-pointer appearance-none"
                            >
                                {dynamicRoles.map(r => (
                                    <option key={r} value={r.toLowerCase()} className="bg-dark-card">{r}</option>
                                ))}
                            </select>
                        </div>

                        <div className="text-2xs font-semibold text-surface-400 uppercase tracking-wider px-2 mb-1.5 mt-1">Views</div>
                        
                        {folders.map(f => {
                            if (f.adminOnly && user?.role !== 'team_lead' && user?.role !== 'staff' && !isRoot) return null;
                            if (f.rootOnly && !isRoot) return null;
                            
                            const isActive = activeFolder === f.id;
                            const hasUnreadChime = f.id === 'Unread' && (f.count ?? 0) > 0;

                            return (
                                <button
                                    key={f.id}
                                    onClick={() => setActiveFolder(f.id)}
                                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors duration-150 text-xs font-medium group ${
                                        isActive 
                                            ? 'bg-brand-600/15 text-brand-400 font-semibold' 
                                            : 'text-surface-400 hover:bg-dark-hover hover:text-surface-200'
                                    }`}
                                    title={f.name}
                                >
                                    <div className="flex items-center justify-start gap-2.5 min-w-0">
                                        <div className="relative shrink-0">
                                            <f.icon size={16} className={`transition-colors ${isActive ? 'text-brand-400' : 'text-surface-400 group-hover:text-surface-200'}`} />
                                            {hasUnreadChime && (
                                                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400" />
                                            )}
                                        </div>
                                        <span className="truncate tracking-normal">{f.name}</span>
                                    </div>
                                    {f.count !== undefined && (
                                        <span className={`text-2xs font-medium px-2 py-0.5 rounded-md tabular-nums transition-colors ${
                                            isActive 
                                                ? 'bg-brand-600 text-white font-semibold' 
                                                : hasUnreadChime 
                                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                                    : 'bg-dark-card text-surface-400 group-hover:bg-dark-hover group-hover:text-surface-300'
                                        }`}>
                                            {f.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="p-3 border-t border-dark-border mt-auto flex items-center justify-start gap-2.5 bg-dark-surface/40 shrink-0">
                        <div className="w-8 h-8 rounded-lg bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold text-xs shrink-0">
                            {user?.name?.charAt(0) || user?.email?.charAt(0) || 'A'}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-surface-200 truncate leading-tight">{user?.name || user?.email}</div>
                            <div className="text-2xs text-surface-400 truncate capitalize mt-0.5">
                                {user?.role === 'team_lead' ? 'Manager' : user?.role === 'staff' ? (isRoot ? 'Root Admin' : 'IT Staff') : user?.role?.replace('_', ' ') || 'Agent'}
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Middle & Right Columns */}
                <div className={`flex-1 flex overflow-hidden bg-surface-0 dark:bg-dark-bg h-full relative md:border-l border-surface-200 dark:border-dark-border ${!activeTicketId ? 'pb-14 md:pb-0' : ''}`}>
                    {activeFolder === 'NewTicket' ? (
                        <AgentCreateTicketView />
                    ) : activeFolder === 'Settings' ? (
                        <div className="flex-1 overflow-auto bg-surface-50 dark:bg-dark-bg">
                            <AdminSettings onSelectView={(view: string) => setActiveFolder(view)} />
                        </div>
                    ) : activeFolder === 'Agents' ? (
                        <div className="flex-1 overflow-hidden bg-surface-50 dark:bg-dark-bg flex flex-col relative z-10">
                            <AgentManager onClose={() => setActiveFolder('Settings')} />
                        </div>
                    ) : activeFolder === 'Requests' ? (
                        <div className="flex-1 overflow-hidden bg-surface-50 dark:bg-dark-bg flex flex-col relative z-10">
                            <FeedbackManager initialFilter="access" onClose={() => setActiveFolder('Settings')} />
                        </div>
                    ) : activeFolder === 'Feedback' ? (
                        <div className="flex-1 overflow-hidden bg-surface-50 dark:bg-dark-bg flex flex-col relative z-10">
                            <FeedbackManager initialFilter="feedback" onClose={() => setActiveFolder('Settings')} />
                        </div>
                    ) : activeFolder === 'Analytics' ? (
                        <div className="flex-1 overflow-auto bg-surface-50 dark:bg-dark-bg">
                            <AnalyticsDashboard />
                        </div>
                    ) : activeFolder === 'Pay' ? (
                        <div className="flex-1 overflow-hidden bg-surface-50 dark:bg-dark-bg flex flex-col relative z-10">
                            <AgentPayView />
                        </div>
                    ) : (
                        <>
                            <div className={`w-full lg:w-[320px] shrink-0 border-r border-surface-200 dark:border-dark-border flex flex-col ${activeTicketId ? 'hidden lg:flex' : 'flex'}`}>
                                <AgentTicketList />
                            </div>
                            {activeTicketId ? (
                                <div className="flex-1 flex overflow-hidden bg-surface-50 dark:bg-dark-surface relative z-auto">
                                    <AgentTicketView ticketId={activeTicketId} />
                                </div>
                            ) : (
                                <div className="hidden lg:flex flex-1 items-center justify-center bg-surface-50 dark:bg-dark-bg text-surface-400 dark:text-surface-500 flex-col gap-3">
                                    <div className="w-14 h-14 rounded-2xl bg-surface-100 dark:bg-dark-card flex items-center justify-center">
                                        <Icons.Inbox size={26} className="text-surface-400 dark:text-surface-500" />
                                    </div>
                                    <p className="font-medium text-sm text-surface-600 dark:text-surface-300">Select a ticket to view conversation</p>
                                    <p className="text-xs text-surface-400">Use arrow keys or click on a ticket from the list</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
                
                {/* Bottom Navigation for Mobile (Safe-area aware) */}
                {!activeTicketId && (
                    <nav 
                        aria-label="Mobile navigation"
                        className="md:hidden fixed bottom-0 left-0 right-0 bg-dark-bg border-t border-dark-border flex items-center justify-around z-30 shadow-2xl"
                        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 6px)', height: 'calc(54px + max(env(safe-area-inset-bottom), 6px))' }}
                    >
                        {folders.map(f => {
                            if (f.adminOnly && user?.role !== 'team_lead' && user?.role !== 'staff' && !isRoot) return null;
                            if (f.rootOnly && !isRoot) return null;
                            
                            const isActive = activeFolder === f.id;
                            return (
                                <button
                                    key={f.id}
                                    onClick={() => setActiveFolder(f.id)}
                                    className={`flex flex-col items-center justify-center w-full h-full relative transition-colors ${
                                        isActive ? 'text-brand-400 font-semibold' : 'text-surface-400 hover:text-surface-200'
                                    }`}
                                >
                                    <f.icon size={18} className={isActive ? 'text-brand-400' : ''} />
                                    <span className="text-2xs mt-1">
                                        {f.id === 'Assigned to me' ? 'Assigned' : f.name}
                                    </span>
                                    {f.count !== undefined && f.count > 0 && (
                                        <span className="absolute top-1 right-2 bg-brand-600 text-white text-2xs font-semibold px-1.5 py-0.2 rounded-full tabular-nums">
                                            {f.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                )}
            </div>
        </div>
    );
};
