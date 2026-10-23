import React, { useEffect, useCallback } from 'react';
import { useTickets } from '../../contexts/TicketContext';
import { Icons } from '../common/Icons';
import { stripMarkdown } from '../common/FormattedMessage';
import { formatTicketDate } from '../../utils/dateUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import * as storage from '../../services/storageService';

export const AgentTicketList: React.FC = () => {
    const { 
        tickets, 
        searchResults, 
        isSearching, 
        activeFolder, 
        setActiveFolder, 
        activeTicketId, 
        setActiveTicketId, 
        searchQuery, 
        selectedCategory, 
        selectedRole, 
        loading, 
        refreshTickets, 
        updateLocalTicket, 
        loadMoreTickets, 
        hasMore,
        soundMuted,
        toggleSound,
        viewedTickets
    } = useTickets();
    const { user } = useAuth();
    const { showToast } = useToast();

    const handleBulkResolve = async () => {
        const isStaff = user?.role === 'staff' || user?.role === 'team_lead';
        if (!isStaff) return;

        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        const now = Date.now();

        const ticketsToResolve = tickets.filter(t => {
            if (t.status === 'Closed' as any || t.status === 'Resolved' as any) return false;
            if (!t.isReadByStaff) return false;

            const lastUpdated = new Date(t.updatedAt || t.createdAt).getTime();
            return (now - lastUpdated > TWENTY_FOUR_HOURS);
        });

        if (ticketsToResolve.length === 0) {
            showToast('No inactive read tickets to auto-resolve (>24h).', 'info');
            return;
        }

        if (window.confirm(`Found ${ticketsToResolve.length} read ticket(s) with no replies in the last 24h. Mark them as Closed?`)) {
            try {
                ticketsToResolve.forEach(t => updateLocalTicket(t.id, { status: 'Closed' }));
                await Promise.all(ticketsToResolve.map(t => storage.updateTicketStatus(t.id, 'Closed')));
                showToast(`Resolved ${ticketsToResolve.length} tickets.`, 'success');
                refreshTickets();
            } catch(e) {
                console.error(e);
                showToast('Error during bulk resolve', 'error');
            }
        }
    };

    let filteredTickets = tickets;

    if (searchQuery.trim()) {
        filteredTickets = searchResults || [];
    } else {
        if (activeFolder === 'Inbox') {
            filteredTickets = tickets.filter(t => t.status !== 'Closed' && t.status !== 'AI Triage');
        } else if (activeFolder === 'AI Inbox') {
            filteredTickets = tickets.filter(t => t.status === 'AI Triage');
        } else if (activeFolder === 'Closed') {
            filteredTickets = tickets.filter(t => t.status === 'Closed');
        } else if (activeFolder === 'Unread') {
            filteredTickets = tickets.filter(t => {
                if (t.status === 'Closed') return false;
                const isStaffReply = t.lastMessageRole === 'staff' || t.lastMessageRole === 'team_lead';
                const isUnreplied = !t.isReadByStaff && !isStaffReply;
                return isUnreplied;
            });
        } else if (activeFolder === 'Read') {
            filteredTickets = tickets.filter(t => {
                if (t.status === 'Closed') return false;
                const isStaffReply = t.lastMessageRole === 'staff' || t.lastMessageRole === 'team_lead';
                const isUnreplied = !t.isReadByStaff && !isStaffReply;
                return !isUnreplied;
            });
        } else if (activeFolder === 'Assigned to me') {
            filteredTickets = tickets.filter(t => t.assignedToEmail === user?.email && t.status !== 'Closed');
        }

        if (selectedCategory !== 'All Categories') {
            filteredTickets = filteredTickets.filter(t => t.category?.includes(selectedCategory));
        }

        if (selectedRole !== 'All Roles') {
            filteredTickets = filteredTickets.filter(t => {
                const role = t.agentRole || 'agent';
                return role.toLowerCase() === selectedRole.toLowerCase();
            });
        }
    }

    // Keyboard navigation: ArrowDown / ArrowUp to move selection, Enter to open, Esc to close
    const handleKeyDownNavigation = useCallback((e: KeyboardEvent) => {
        const activeEl = document.activeElement;
        const isInputActive = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement || (activeEl as HTMLElement)?.isContentEditable;
        if (isInputActive) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (filteredTickets.length === 0) return;
            const currentIndex = filteredTickets.findIndex(t => t.id === activeTicketId);
            const nextIndex = currentIndex < filteredTickets.length - 1 ? currentIndex + 1 : 0;
            setActiveTicketId(filteredTickets[nextIndex].id);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (filteredTickets.length === 0) return;
            const currentIndex = filteredTickets.findIndex(t => t.id === activeTicketId);
            const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredTickets.length - 1;
            setActiveTicketId(filteredTickets[prevIndex].id);
        } else if (e.key === 'Escape') {
            if (activeTicketId) {
                e.preventDefault();
                setActiveTicketId(null);
            }
        }
    }, [filteredTickets, activeTicketId, setActiveTicketId]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDownNavigation);
        return () => window.removeEventListener('keydown', handleKeyDownNavigation);
    }, [handleKeyDownNavigation]);

    return (
        <section aria-label="Ticket List" className={`w-full h-full flex flex-col bg-surface-0 dark:bg-dark-surface border-r border-surface-200 dark:border-dark-border ${activeTicketId ? 'hidden lg:flex' : 'flex'}`}>
            <div className="px-4 py-3 border-b border-surface-200 dark:border-dark-border bg-surface-0 dark:bg-dark-surface flex flex-col gap-2 shrink-0 transition-colors">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100 capitalize">
                            {searchQuery.trim() ? 'Search Results' : activeFolder}
                        </h2>
                        {!loading ? (
                            <span className="text-2xs bg-surface-100 dark:bg-dark-card text-surface-500 dark:text-surface-400 px-2 py-0.5 rounded-md font-medium tabular-nums">
                                {filteredTickets.length}
                            </span>
                        ) : null}
                        {isSearching && (
                            <Icons.Refresh size={12} className="animate-spin text-brand-500" title="Searching server..." />
                        )}
                    </div>
                    
                    <div className="flex gap-1 items-center">
                        {(user?.role === 'staff' || user?.role === 'team_lead') && (
                            <>
                                <button 
                                    onClick={handleBulkResolve}
                                    className="flex items-center gap-1 text-2xs font-semibold px-2 py-1 rounded-lg bg-surface-50 hover:bg-surface-100 dark:bg-dark-card dark:hover:bg-dark-hover text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-dark-border transition-colors"
                                    title="Auto-Resolve inactive read tickets (>24h)"
                                >
                                    <Icons.Check size={11} />
                                    <span>Auto-Resolve</span>
                                </button>
                                <button
                                    onClick={() => {
                                        const next = toggleSound();
                                        showToast(next ? 'Sound notifications muted' : 'Sound notifications enabled', 'info');
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-dark-hover text-surface-500 dark:text-surface-400 transition-colors"
                                    title={soundMuted ? 'Unmute notification chime' : 'Mute notification chime'}
                                    aria-label={soundMuted ? 'Unmute' : 'Mute'}
                                >
                                    {soundMuted ? <Icons.VolumeOff size={14} className="text-surface-400" /> : <Icons.VolumeOn size={14} className="text-brand-600 dark:text-brand-400" />}
                                </button>
                            </>
                        )}
                        <button 
                            onClick={refreshTickets} 
                            disabled={loading}
                            className={`p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-dark-hover text-surface-500 dark:text-surface-400 transition-colors ${loading ? 'animate-spin' : ''}`}
                            title="Sync"
                            aria-label="Sync tickets"
                        >
                            <Icons.Refresh size={14} />
                        </button>
                        <button 
                            onClick={() => { setActiveTicketId(null); setActiveFolder('Settings'); }}
                            className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-dark-hover text-surface-500 dark:text-surface-400 transition-colors"
                            title="Settings"
                            aria-label="Settings"
                        >
                            <Icons.Settings size={14} />
                        </button>
                    </div>
                </div>
            </div>

            <div 
                className="flex-1 overflow-y-auto w-full dark:bg-dark-bg"
                onScroll={(e) => {
                    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                    if (scrollHeight - scrollTop - clientHeight < 50) {
                        if (!loading && hasMore) {
                            loadMoreTickets();
                        }
                    }
                }}
            >
                {loading && tickets.length === 0 ? (
                    <div className="p-4 space-y-4 flex-1">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <div className="h-3.5 bg-surface-200 dark:bg-dark-card rounded-md w-1/3 animate-shimmer bg-gradient-to-r from-surface-200 via-surface-100 to-surface-200 bg-[length:200%_100%]"></div>
                                    <div className="h-3 bg-surface-100 dark:bg-dark-card/50 rounded-md w-12 animate-pulse"></div>
                                </div>
                                <div className="h-4 bg-surface-200 dark:bg-dark-card rounded-md w-3/4 mb-1 animate-pulse"></div>
                                <div className="h-3 bg-surface-100 dark:bg-dark-card/50 rounded-md w-full animate-pulse"></div>
                                <div className="h-3 bg-surface-100 dark:bg-dark-card/50 rounded-md w-5/6 animate-pulse"></div>
                                <div className="h-px bg-surface-100 dark:bg-dark-border mt-2 w-full"></div>
                            </div>
                        ))}
                    </div>
                ) : filteredTickets.length > 0 ? (
                    <div className="divide-y divide-surface-100 dark:divide-dark-border">
                        {filteredTickets.map(ticket => {
                            const isStaffReply = ticket.lastMessageRole === 'staff' || ticket.lastMessageRole === 'team_lead';
                            const isUnreplied = !ticket.isReadByStaff && !isStaffReply;
                            const isViewed = (viewedTickets?.has(ticket.id) || activeTicketId === ticket.id);
                            const isActive = activeTicketId === ticket.id;

                            return (
                                <button
                                    key={ticket.id}
                                    onClick={() => setActiveTicketId(ticket.id)}
                                    title={isUnreplied ? (isViewed ? "Viewed • Awaiting Staff Reply (moves to Read upon reply)" : "New Unread • Awaiting Staff Reply") : "Replied / Read"}
                                    className={`w-full text-left px-4 py-3 hover:bg-surface-50 dark:hover:bg-dark-hover border-l-[3px] transition-colors duration-150 outline-none focus:bg-surface-50 dark:focus:bg-dark-hover ${
                                        isActive 
                                            ? 'bg-brand-50/50 dark:bg-brand-950/20 border-brand-500' 
                                            : 'border-transparent'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {isUnreplied && !isViewed && (
                                                <div 
                                                    className="w-2 h-2 rounded-full bg-brand-500 shrink-0" 
                                                    title="New Unread • Awaiting Staff Reply" 
                                                />
                                            )}
                                            {isUnreplied && isViewed && (
                                                <span 
                                                    className="text-2xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md px-1.5 py-0.2 flex items-center gap-0.5 shrink-0 select-none"
                                                    title="Viewed • Awaiting Staff Reply"
                                                >
                                                    <Icons.Read size={10} className="stroke-[2.5]" />
                                                    <span>Viewed</span>
                                                </span>
                                            )}
                                            <span className={`text-sm truncate transition-colors ${
                                                isUnreplied 
                                                    ? (!isViewed ? 'font-semibold text-surface-900 dark:text-white' : 'font-medium text-surface-800 dark:text-surface-200')
                                                    : 'font-normal text-surface-500 dark:text-surface-400'
                                            }`}>
                                                {ticket.createdByName || ticket.createdByEmail}
                                            </span>
                                        </div>
                                        <span className={`text-2xs whitespace-nowrap ml-2 tabular-nums font-medium ${isUnreplied && !isViewed ? 'text-brand-600 dark:text-brand-400 font-semibold' : 'text-surface-400'}`}>
                                            {formatTicketDate(ticket.lastAgentReplyAt || ticket.createdAt)}
                                        </span>
                                    </div>
                                    <h3 className={`text-sm mb-1 truncate leading-tight ${
                                        isUnreplied 
                                            ? (!isViewed ? 'font-medium text-surface-900 dark:text-surface-100' : 'font-medium text-surface-800 dark:text-surface-200')
                                            : 'font-normal text-surface-600 dark:text-surface-400'
                                    }`}>
                                        {ticket.title}
                                    </h3>
                                    <p className="text-[13px] text-surface-400 dark:text-surface-500 line-clamp-2 leading-relaxed">
                                        {stripMarkdown(ticket.lastMessagePreview || ticket.description)}
                                    </p>
                                    <div className="mt-2 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-2xs font-mono bg-surface-100 dark:bg-dark-card text-surface-400 px-1.5 py-0.5 rounded-md truncate font-medium">
                                                {ticket.ticketNumber}
                                            </span>
                                            {ticket.agentRole && (
                                                <span className={`text-2xs font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                                                    ticket.agentRole === 'team_lead' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200 dark:border-blue-900' :
                                                    ticket.agentRole === 'moniepoint' ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400 border border-teal-200 dark:border-teal-900' :
                                                    ticket.agentRole === 'referee' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-900' : 
                                                    'bg-surface-100 text-surface-600 dark:bg-dark-card dark:text-surface-400 border border-surface-200 dark:border-dark-border'
                                                }`}>
                                                    {ticket.agentRole === 'team_lead' ? 'TL' : ticket.agentRole === 'moniepoint' ? 'MP' : ticket.agentRole === 'referee' ? 'REF' : 'AGENT'}
                                                </span>
                                            )}
                                        </div>
                                        {ticket.assignedToEmail === user?.email && (
                                            <div className="flex items-center gap-1 text-2xs text-brand-600 dark:text-brand-400 font-semibold" title="Assigned to you">
                                                <Icons.User size={12} />
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-12 text-center text-surface-400 flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-surface-100 dark:bg-dark-card flex items-center justify-center">
                            <Icons.Inbox size={28} className="text-surface-400 dark:text-surface-500" />
                        </div>
                        <p className="text-sm font-medium text-surface-600 dark:text-surface-300">No tickets in this view</p>
                        <p className="text-xs text-surface-400">Tickets will appear here when they match your filters.</p>
                    </div>
                )}
            </div>
        </section>
    );
};
