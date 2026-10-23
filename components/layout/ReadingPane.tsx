import React, { useEffect, useState } from 'react';
import { useTickets } from '../../contexts/TicketContext';
import { useAuth } from '../../contexts/AuthContext';
import { MessageThread } from '../tickets/MessageThread';
import { QuickActions } from '../tickets/QuickActions';
import { AnalyticsDashboard } from '../../pages/AnalyticsDashboard';
import { Icons } from '../common/Icons';
import { handleTicketViewEntry, handleTicketViewExit } from '../../services/storageService';
import { changeCategory } from '../../services/ticketService';
import { formatPatternWAT } from '../../utils/dateUtils';
import { useToast } from '../../contexts/ToastContext';

export const ReadingPane: React.FC = () => {
  const { activeTicketId, setActiveTicketId, tickets, activeFolder, refreshTickets, categories } = useTickets();
  const { user } = useAuth();
  const { showToast } = useToast();
  const ticket = tickets.find(t => t.id === activeTicketId);
  const [remoteLockedBy, setRemoteLockedBy] = useState<string | null>(null);
  const [remoteAssignedTo, setRemoteAssignedTo] = useState<string | null>(null);
  const [viewAnyway, setViewAnyway] = useState(false);
  const [isChangingCategory, setIsChangingCategory] = useState(false);

  // Handle Entry/Exit
  useEffect(() => {
      if (!user || user.role === 'agent' || !activeTicketId) return;

      setViewAnyway(false);
      handleTicketViewEntry(activeTicketId, user.email);

      return () => {
          if (!user.isRoot) handleTicketViewExit(activeTicketId, user.email);
      };
  }, [activeTicketId, user]);

  // Watch for changes in the ticket data
  useEffect(() => {
      if (!ticket || !user) return;

      if (ticket.lockedBy && ticket.lockedBy !== user.email) {
          setRemoteLockedBy(ticket.lockedBy);
      } else {
          setRemoteLockedBy(null);
      }

      if (ticket.assignedToEmail && ticket.assignedToEmail !== user.email) {
          setRemoteAssignedTo(ticket.assignedToEmail);
      } else {
          setRemoteAssignedTo(null);
          setViewAnyway(false);
      }
  }, [ticket, user]);

  // Handle Esc to dismiss conflict or deselect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (remoteAssignedTo && !viewAnyway) {
          setActiveTicketId(null);
          return;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [remoteAssignedTo, viewAnyway, setActiveTicketId]);

  const handleCategoryChange = async (newCategory: string) => {
      if (!ticket || newCategory === ticket.category) return;
      setIsChangingCategory(true);
      try {
          await changeCategory(ticket.id, newCategory);
          showToast('Category updated successfully', 'success');
          refreshTickets();
      } catch (error) {
          showToast('Failed to update category', 'error');
      } finally {
          setIsChangingCategory(false);
      }
  };

  if (activeFolder === 'Analytics') return <AnalyticsDashboard />;
  
  if (!ticket) return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-surface-50 dark:bg-dark-bg text-surface-400 select-none font-sans p-6 text-center">
        <div className="w-16 h-16 bg-surface-100 dark:bg-dark-card rounded-2xl flex items-center justify-center mb-3">
            <Icons.Inbox size={28} className="text-surface-400 dark:text-surface-500" />
        </div>
        <h3 className="font-semibold text-base text-surface-700 dark:text-surface-200">Select an item to read</h3>
        <p className="text-xs text-surface-400 mt-1">Click on a ticket from the list or use arrow keys.</p>
      </div>
  );

  return (
    <div className="w-full flex flex-col h-full bg-surface-0 dark:bg-dark-bg min-w-0 relative font-sans">
      
      {/* 1. Viewer Notification */}
      {remoteLockedBy && !remoteAssignedTo && (
          <div className="absolute top-16 right-4 z-50 animate-slide-down">
              <div className="bg-brand-600 text-white px-4 py-3 rounded-xl shadow-modal flex items-center gap-3 max-w-sm">
                  <div className="p-2 bg-white/20 rounded-lg">
                      <Icons.Read size={16} />
                  </div>
                  <div>
                      <p className="text-xs font-semibold">{remoteLockedBy} is viewing</p>
                      <p className="text-2xs opacity-90">You can continue, but they might reply first.</p>
                  </div>
                  <button onClick={() => setRemoteLockedBy(null)} className="ml-auto p-1 hover:bg-white/20 rounded-md transition-colors" aria-label="Close notification">
                      <Icons.Close size={14} />
                  </button>
              </div>
          </div>
      )}

      {/* 2. Assignment Conflict Notification */}
      {remoteAssignedTo && !viewAnyway && (
          <div className="absolute inset-0 z-50 bg-black/40 dark:bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4">
              <div className="bg-surface-0 dark:bg-dark-card p-6 rounded-2xl shadow-modal max-w-md w-full border border-surface-200 dark:border-dark-border animate-scale-in text-center">
                  <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center mb-3 mx-auto border border-amber-200 dark:border-amber-800">
                      <Icons.Lock size={22} />
                  </div>
                  <h3 className="text-base font-semibold text-surface-900 dark:text-white mb-2">Ticket Assigned</h3>
                  <p className="text-surface-600 dark:text-surface-300 text-xs leading-relaxed mb-5">
                      <span className="font-semibold text-brand-600 dark:text-brand-400">{remoteAssignedTo}</span> has replied to this ticket and it has been automatically assigned to them.
                  </p>
                  <div className="flex gap-2.5 justify-center">
                      <button 
                          onClick={() => setViewAnyway(true)} 
                          className="px-4 py-2 border border-surface-200 dark:border-dark-border rounded-lg text-xs font-semibold text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-dark-hover transition-colors"
                      >
                          View Anyway
                      </button>
                      <button 
                          onClick={() => setActiveTicketId(null)} 
                          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                      >
                          Back to List (Esc)
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Detail Header */}
      <div className="px-4 md:px-5 py-3 border-b border-surface-200 dark:border-dark-border bg-surface-0 dark:bg-dark-surface sticky top-0 z-10 flex justify-between items-center transition-colors">
          <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-2xs font-mono bg-surface-100 dark:bg-dark-card text-surface-400 px-1.5 py-0.5 rounded-md font-medium">
                      {ticket.ticketNumber || ticket.id}
                  </span>
                  <h1 className="text-sm md:text-base font-semibold text-surface-900 dark:text-white truncate">
                      {ticket.title}
                  </h1>
              </div>
              <div className="flex items-center gap-2 text-2xs text-surface-500 dark:text-surface-400 flex-wrap">
                  <span>From: <strong className="text-surface-800 dark:text-surface-200 font-semibold">{ticket.createdByEmail}</strong></span>
                  <span>•</span>
                  <span>{formatPatternWAT(ticket.createdAt, 'PP p')}</span>
              </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
              <select
                  value={ticket.category}
                  disabled={isChangingCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="text-xs bg-surface-50 dark:bg-dark-card border border-surface-200 dark:border-dark-border rounded-lg px-2.5 py-1 text-surface-700 dark:text-surface-300 outline-none focus:border-brand-400 transition-colors cursor-pointer"
              >
                  {categories.map((c) => (
                      <option key={c} value={c} className="bg-surface-0 dark:bg-dark-card">{c}</option>
                  ))}
              </select>
          </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto">
          <MessageThread ticket={ticket} />
      </div>

      {/* Quick Actions Composer */}
      <div className="border-t border-surface-200 dark:border-dark-border bg-surface-0 dark:bg-dark-surface shrink-0">
          <QuickActions ticket={ticket} />
      </div>
    </div>
  );
};
