import React, { useEffect } from 'react';
import { useTickets } from '../../contexts/TicketContext';
import { Icons } from '../common/Icons';
import { UserChat } from './UserChat';
import { useAuth } from '../../contexts/AuthContext';
export const TicketHistoryModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { tickets, activeTicketId, setActiveTicketId, getTicket } = useTickets();
    const { user } = useAuth();
    
    // Unset active ticket when closing the modal so it doesn't leak into other views
    useEffect(() => {
        return () => setActiveTicketId(null);
    }, [setActiveTicketId]);

    const myTickets = tickets.filter(t => t.createdByEmail?.toLowerCase() === user?.email?.toLowerCase());

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (activeTicketId) {
                    setActiveTicketId(null);
                } else {
                    onClose();
                }
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if (myTickets.length === 0) return;
                const currentIndex = myTickets.findIndex(t => t.id === activeTicketId);
                if (e.key === 'ArrowDown') {
                    const next = currentIndex < myTickets.length - 1 ? currentIndex + 1 : 0;
                    setActiveTicketId(myTickets[next].id);
                } else {
                    const prev = currentIndex > 0 ? currentIndex - 1 : myTickets.length - 1;
                    setActiveTicketId(myTickets[prev].id);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTicketId, myTickets, setActiveTicketId, onClose]);

    return (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center animate-fade-in font-sans">
            <div className="bg-surface-0 dark:bg-dark-card w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-5xl sm:rounded-2xl border border-surface-200 dark:border-dark-border shadow-modal flex flex-col overflow-hidden animate-scale-in">
                <div className="px-4 py-3 md:px-6 md:py-4 border-b border-surface-200 dark:border-dark-border flex justify-between items-center bg-surface-50/70 dark:bg-dark-card shrink-0">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Icons.Ticket className="text-brand-600" />
                        Helpdesk Support History
                    </h2>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 border border-gray-200 dark:border-white/10 dark:hover:text-white bg-white dark:bg-dark-bg hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors shadow-sm">
                            <Icons.Back size={18} />
                            <span className="hidden sm:inline">Back to Home</span>
                            <span className="sm:hidden">Back</span>
                        </button>
                    </div>
                </div>
                <div className="flex-1 flex overflow-hidden flex-col md:flex-row relative">
                    {/* List view (hidden on mobile if ticket is active) */}
                    <div className={`w-full md:w-1/3 border-r border-gray-100 dark:border-dark-border overflow-y-auto bg-gray-50 dark:bg-dark-bg p-4 flex flex-col gap-3 shrink-0 flex-1 md:flex-none ${activeTicketId ? 'hidden md:flex' : 'flex'}`}>
                        {myTickets.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center mt-10">No tickets found.</p>
                        ) : (
                            myTickets.map(t => (
                                <button 
                                    key={t.id} 
                                    onClick={() => setActiveTicketId(t.id)}
                                    className={`text-left p-4 rounded-xl border transition-all ${
                                        activeTicketId === t.id 
                                        ? 'bg-white border-brand-500 shadow-md dark:bg-dark-surface dark:border-brand-500' 
                                        : 'bg-white border-gray-200 hover:border-brand-300 dark:bg-dark-surface dark:border-dark-border dark:hover:border-brand-700 shadow-sm'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate pr-2">{t.title}</p>
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                            t.status === 'Open' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                            t.status === 'In Progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                            'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                        }`}>{t.status}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2 leading-relaxed">{t.lastMessagePreview || t.description}</p>
                                    <div className="flex justify-between items-center mt-2 border-t border-gray-50 dark:border-white/5 pt-2">
                                        <span className="text-[10px] font-medium text-gray-400">ID: {t.ticketNumber}</span>
                                        <span className="text-[10px] text-brand-500 font-bold flex items-center gap-1 group-hover:underline">View <Icons.Back className="rotate-180" size={10} /></span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    <div className={`flex-1 bg-white dark:bg-dark-bg h-full overflow-hidden absolute inset-0 md:relative z-10 md:z-0 ${activeTicketId ? 'flex' : 'hidden md:flex'}`}>
                        {(() => {
                            const ticketToView = activeTicketId 
                                ? (getTicket(activeTicketId) || myTickets.find(t => t.id === activeTicketId) || tickets.find(t => t.id === activeTicketId))
                                : null;
                                
                            if (activeTicketId && ticketToView) {
                                return (
                                    <UserChat 
                                        ticket={ticketToView} 
                                        onBack={() => setActiveTicketId(null)}
                                    />
                                );
                            }
                            return (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                                    <Icons.Ticket size={48} className="mb-4 opacity-50" />
                                    <p>Select a ticket to view details</p>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
};
