import React, { useMemo } from 'react';
import { useTickets } from '../../contexts/TicketContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import * as storage from '../../services/storageService';
import { StatusBadge } from '../common/StatusBadge';
import { formatTicketDate } from '../../utils/dateUtils';
import { Icons } from '../common/Icons';
import { Virtuoso } from 'react-virtuoso';

export const TicketListPane: React.FC = () => {
  const { tickets, searchResults, activeTicketId, setActiveTicketId, activeFolder, searchQuery, refreshTickets, loadMoreTickets, hasMore, loading, viewedTickets } = useTickets();
  const { user } = useAuth();
  const { showToast } = useToast();

  const handleBulkResolve = async () => {
      const isStaff = user?.role === 'staff' || user?.role === 'team_lead';
      if (!isStaff) return;

      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      const now = Date.now();

      const ticketsToResolve = tickets.filter(t => {
          if (t.status === 'Closed' || t.status === 'Resolved' as any) return false;
          
          if (!t.isReadByStaff) return false;

          const lastUpdated = new Date(t.updatedAt || t.createdAt).getTime();
          if (now - lastUpdated > TWENTY_FOUR_HOURS) {
               return true;
          }
          return false;
      });

      if (ticketsToResolve.length === 0) {
          showToast('No inactive read tickets to auto-resolve (>24h).', 'info');
          return;
      }

      if (window.confirm(`Found ${ticketsToResolve.length} read ticket(s) with no replies in the last 24h. Mark them as Closed?`)) {
          try {
              await Promise.all(ticketsToResolve.map(t => storage.updateTicketStatus(t.id, 'Closed')));
              showToast(`Resolved ${ticketsToResolve.length} tickets.`, 'success');
              refreshTickets();
          } catch(e) {
              console.error(e);
              showToast('Error during bulk resolve', 'error');
          }
      }
  };

  const sortedTickets = useMemo(() => {
    if (searchQuery.trim()) {
        return searchResults || [];
    }

    const filteredTickets = tickets.filter(ticket => {
      // --- 1. Role-Based Visibility Scope ---
      if (user?.role === 'team_lead') {
          if (ticket.teamLeadId !== user.managedTeamId) return false;
          if (ticket.isEscalated) return false; 
      }

      // --- 2. Specialized Categories Filtering ---
      const isStaffPortal = user?.role === 'staff' || user?.role === 'team_lead';
      if (isStaffPortal && user?.specializedCategories && user.specializedCategories.length > 0) {
          const ticketCats = ticket.category.split(', ');
          const hasMatch = ticketCats.some(cat => user.specializedCategories!.includes(cat));
          if (!hasMatch) return false;
      }

      // --- 3. Folder Logic ---
      const isStaff = user?.role === 'staff' || user?.role === 'team_lead';
      const isStaffReply = ticket.lastMessageRole === 'staff' || ticket.lastMessageRole === 'team_lead';
      const isUnreadForFilter = isStaff ? (!ticket.isReadByStaff && !isStaffReply) : !ticket.readBy?.includes(user?.email || '');

      if (activeFolder === 'Inbox') return ticket.status !== 'Closed';
      if (activeFolder === 'Closed') return ticket.status === 'Closed';
      if (activeFolder === 'Assigned to me') return ticket.assignedToEmail === user?.email && ticket.status !== 'Closed';
      if (activeFolder === 'Pinned') return ticket.isPinned;
      if (activeFolder === 'Unread') return ticket.status !== 'Closed' && isUnreadForFilter;
      if (activeFolder === 'Read') return ticket.status !== 'Closed' && !isUnreadForFilter;
      
      return false;
    });

    return filteredTickets.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        
        if (timeB !== timeA) {
            return timeB - timeA;
        }
        
        const createdA = new Date(a.createdAt).getTime();
        const createdB = new Date(b.createdAt).getTime();
        return createdB - createdA;
    });
  }, [tickets, user, activeFolder, searchQuery, viewedTickets, searchResults]);

  if (activeFolder === 'Analytics') return null;

  return (
    <div className="w-full flex flex-col border-r border-surface-200 dark:border-dark-border bg-surface-0 dark:bg-dark-bg h-full">
      {/* List Header */}
      <div className="px-4 py-3 border-b border-surface-200 dark:border-dark-border flex justify-between items-center bg-surface-0 dark:bg-dark-surface sticky top-0 z-10">
        <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm text-surface-900 dark:text-surface-100">
                {searchQuery ? 'Search Results' : activeFolder}
            </h2>
            {sortedTickets.length > 0 && (
                <span className="text-2xs text-brand-600 dark:text-brand-400 font-semibold bg-brand-50 dark:bg-brand-950/30 px-2 py-0.5 rounded-md tabular-nums">{sortedTickets.length}</span>
            )}
        </div>
        <div className="flex gap-1.5 items-center">
            {(user?.role === 'staff' || user?.role === 'team_lead') && (
                <button 
                    onClick={handleBulkResolve}
                    className="flex items-center gap-1 text-2xs font-semibold px-2 py-1 rounded-lg bg-surface-50 hover:bg-surface-100 dark:bg-dark-card dark:hover:bg-dark-hover text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-dark-border transition-colors"
                    title="Auto-Resolve inactive read tickets (>24h)"
                >
                    <Icons.Check size={12} />
                    <span>Auto-Resolve</span>
                </button>
            )}
            <button 
                onClick={refreshTickets} 
                disabled={loading}
                className={`p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-dark-hover text-surface-500 dark:text-surface-400 transition-colors ${loading ? 'animate-spin' : ''}`}
                title="Sync"
                aria-label="Sync"
            >
                <Icons.Refresh size={15} />
            </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {sortedTickets.length > 0 ? (
          <Virtuoso
            style={{ height: '100%', width: '100%' }}
            totalCount={sortedTickets.length}
            endReached={loadMoreTickets}
            itemContent={(index) => {
              const ticket = sortedTickets[index];
              const isStaff = user?.role === 'staff' || user?.role === 'team_lead';
              const isStaffReply = ticket.lastMessageRole === 'staff' || ticket.lastMessageRole === 'team_lead';
              const isUnreplied = isStaff ? (!ticket.isReadByStaff && !isStaffReply) : !ticket.readBy?.includes(user?.email || '');
              const isViewed = (viewedTickets?.has(ticket.id) || activeTicketId === ticket.id);
              const isUnread = isUnreplied && !isViewed;
              const isActive = activeTicketId === ticket.id;

              return (
                <div 
                  onClick={() => setActiveTicketId(ticket.id)}
                  title={isUnreplied ? (isViewed ? "Viewed • Awaiting Staff Reply (moves to Read upon reply)" : "New Unread • Awaiting Staff Reply") : "Replied / Read"}
                  className={`px-4 py-3 border-b border-surface-100 dark:border-dark-border cursor-pointer relative group transition-colors duration-150 ${
                    isActive 
                      ? 'bg-brand-50/50 dark:bg-brand-950/20' 
                      : 'bg-surface-0 dark:bg-dark-bg hover:bg-surface-50 dark:hover:bg-dark-hover'
                  }`}
                >
                  {/* Active / Unread Indicator Line */}
                  {(isActive || isUnreplied) && (
                    <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${isUnread ? 'bg-brand-600' : isUnreplied ? 'bg-blue-400 dark:bg-blue-600' : 'bg-transparent'}`}></div>
                  )}

                  <div className="flex justify-between items-baseline mb-1">
                    <div className="flex items-center gap-2 overflow-hidden">
                        {/* Avatar Initials */}
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center text-2xs font-bold shrink-0 ${
                            isActive ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'bg-surface-100 text-surface-600 dark:bg-dark-card dark:text-surface-300'
                        }`}>
                            {ticket.createdByEmail.charAt(0).toUpperCase()}
                        </div>
                        <span className={`text-sm truncate ${isUnreplied && !isViewed ? 'font-semibold text-surface-900 dark:text-white' : 'font-medium text-surface-700 dark:text-surface-300'}`}>
                          {ticket.createdByEmail} 
                        </span>
                        {isUnreplied && isViewed && (
                            <span 
                                className="text-2xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded px-1.5 py-0.2 flex items-center gap-0.5 shrink-0 select-none"
                                title="Viewed • Awaiting Staff Reply"
                            >
                                <Icons.Read size={10} className="stroke-[2.5]" />
                                <span>Viewed</span>
                            </span>
                        )}
                        {ticket.agentRole && ticket.agentRole !== 'agent' && (
                            <span className={`text-2xs font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                                ticket.agentRole === 'team_lead' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 border border-blue-200' :
                                ticket.agentRole === 'moniepoint' ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300 border border-teal-200' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border border-amber-200'
                            }`}>
                                {ticket.agentRole === 'team_lead' ? 'TL' : ticket.agentRole === 'moniepoint' ? 'MP' : 'REF'}
                            </span>
                        )}
                    </div>
                    <span className={`text-2xs tabular-nums whitespace-nowrap font-medium ${isUnread ? 'text-brand-600 dark:text-brand-400 font-semibold' : 'text-surface-400'}`}>
                      {formatTicketDate(ticket.updatedAt || ticket.createdAt)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-start gap-2">
                     <div className="flex-1 min-w-0">
                        <div className={`text-sm truncate mb-0.5 ${isUnread ? 'font-medium text-brand-700 dark:text-brand-300' : 'text-surface-700 dark:text-surface-300'}`}>
                             {ticket.title}
                        </div>
                        <p className="text-[13px] text-surface-400 dark:text-surface-500 line-clamp-1 leading-relaxed">
                            {ticket.lastMessagePreview || ticket.description}
                        </p>
                     </div>
                     
                     <div className="flex flex-col items-end gap-1">
                        {ticket.isPinned && <Icons.Pin size={12} className="text-surface-400 fill-current" />}
                        {ticket.isEscalated && <Icons.Alert size={12} className="text-red-500" />}
                     </div>
                  </div>

                  {/* Badges Row */}
                  <div className="flex items-center flex-wrap gap-1.5 mt-2">
                     <StatusBadge status={ticket.status} />
                     <span className="text-2xs px-2 py-0.5 rounded-md bg-surface-100 dark:bg-dark-card text-surface-500 border border-surface-200 dark:border-dark-border truncate max-w-[100px]">
                        {ticket.category}
                     </span>
                     
                     {/* Assigned To Badge (Me vs Others) */}
                     {ticket.assignedToEmail && (
                        ticket.assignedToEmail === user?.email ? (
                            <span className="text-2xs font-semibold text-surface-400 flex items-center gap-0.5">
                                <Icons.User size={10} /> Me
                            </span>
                        ) : (
                            <span className="text-2xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 truncate max-w-[120px]">
                                <Icons.Briefcase size={10} /> {ticket.assignedToEmail}
                            </span>
                        )
                     )}
                  </div>
                </div>
              );
            }}
            components={{
              Footer: () => {
                if (!hasMore) return <div className="p-4 text-center text-2xs text-surface-400">End of history</div>;
                return (
                   <div className="p-4 text-center">
                     <Icons.Refresh className="animate-spin inline text-brand-600" size={16} />
                   </div>
                );
              }
            }}
          />
        ) : (
            <div className="p-12 text-center text-surface-400 flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-surface-100 dark:bg-dark-card flex items-center justify-center">
                    <Icons.Inbox size={28} className="text-surface-400 dark:text-surface-500" />
                </div>
                <p className="text-sm font-medium text-surface-600 dark:text-surface-300">No tickets in this view</p>
            </div>
        )}
      </div>
    </div>
  );
};
