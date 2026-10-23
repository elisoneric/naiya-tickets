
import React, { useEffect } from 'react';
import { useTickets } from '../contexts/TicketContext';
import { Icons } from '../components/common/Icons';
import { stripMarkdown } from '../components/common/FormattedMessage';
import { UserChat } from '../components/user/UserChat';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { formatTicketDate } from '../utils/dateUtils';

interface ChatPageProps {
    onClose: () => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({ onClose }) => {
    const { tickets, activeTicketId, setActiveTicketId } = useTickets();
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();

    // Cleanup on unmount
    useEffect(() => {
        return () => setActiveTicketId(null);
    }, [setActiveTicketId]);

    const myTickets = tickets.filter(
        t => t.createdByEmail?.toLowerCase() === user?.email?.toLowerCase()
    );

    const activeTicket = activeTicketId
        ? myTickets.find(t => t.id === activeTicketId) || tickets.find(t => t.id === activeTicketId)
        : null;

    const formatRelativeTime = formatTicketDate;

    return (
        // Full page — not a modal overlay
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-100 dark:bg-[#0d1117] font-segoe">

            {/* ── Top App Bar ── */}
            <header className="flex items-center justify-between px-4 py-0 bg-brand-700 dark:bg-[#161b22] shrink-0 shadow-md h-12">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                        title="Back to Help Center"
                    >
                        <Icons.Back size={20} />
                    </button>
                    <span className="font-bold text-white text-[15px] tracking-tight hidden sm:block">
                        My Support Tickets
                    </span>
                    <span className="font-bold text-white text-[15px] tracking-tight sm:hidden">
                        Support
                    </span>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={toggleTheme}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white"
                        title="Toggle theme"
                    >
                        {theme === 'dark' ? <Icons.Sun size={17} /> : <Icons.Moon size={17} />}
                    </button>
                    <div className="relative group ml-1">
                        <button className="flex items-center gap-2 p-1 hover:bg-white/10 rounded-full transition-colors">
                            <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                                {user?.avatar
                                    ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                    : <span>{user?.name?.charAt(0)}</span>
                                }
                            </div>
                        </button>
                        {/* Dropdown */}
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-[#1e2430] rounded-xl shadow-xl border border-gray-100 dark:border-white/10 py-1.5 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-150 origin-top-right z-50">
                            <div className="px-3 py-2 border-b border-gray-100 dark:border-white/10 mb-1">
                                <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">{user?.name}</div>
                                <div className="text-[11px] text-gray-400 truncate">{user?.email}</div>
                            </div>
                            <button
                                onClick={logout}
                                className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-2 transition-colors"
                            >
                                <Icons.Logout size={14} /> Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Main Content ── */}
            <div className="flex flex-1 overflow-hidden">

                {/* ── Ticket List Sidebar ── */}
                <div className={`
                    w-full md:w-80 lg:w-96 shrink-0
                    border-r border-gray-200 dark:border-white/10
                    bg-white dark:bg-[#13181f]
                    flex flex-col overflow-hidden
                    ${activeTicketId ? 'hidden md:flex' : 'flex'}
                `}>
                    {/* Sidebar header */}
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-white/10 shrink-0 bg-gray-50 dark:bg-[#0d1117] flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {myTickets.length} {myTickets.length === 1 ? 'Ticket' : 'Tickets'}
                        </p>
                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent('open-pay-portal'))}
                            className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium cursor-pointer"
                        >
                            View more report
                        </button>
                    </div>

                    {/* Ticket list */}
                    <div className="flex-1 overflow-y-auto">
                        {myTickets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                                <div className="w-16 h-16 rounded-full bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mb-4">
                                    <Icons.Ticket size={28} className="text-brand-400" />
                                </div>
                                <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">No tickets yet</p>
                                <p className="text-sm text-gray-400 dark:text-gray-500">
                                    Your support requests will appear here once submitted.
                                </p>
                            </div>
                        ) : (
                            myTickets.map(t => {
                                const isActive = activeTicketId === t.id;
                                const lastMsg = t.messages?.[t.messages.length - 1];
                                const unread = t.lastMessageRole && t.lastMessageRole !== 'guest';

                                return (
                                    <button
                                        key={t.id}
                                        onClick={() => setActiveTicketId(t.id)}
                                        className={`
                                            w-full text-left flex items-start gap-3 px-4 py-3.5
                                            border-b border-gray-100 dark:border-white/5
                                            transition-colors relative
                                            ${isActive
                                                ? 'bg-brand-50 dark:bg-brand-900/20 border-l-2 border-l-brand-600'
                                                : 'hover:bg-gray-50 dark:hover:bg-white/5 border-l-2 border-l-transparent'
                                            }
                                        `}
                                    >
                                        {/* Status dot / avatar */}
                                        <div className={`
                                            w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold border
                                            ${t.status === 'Open'
                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-200 dark:border-emerald-800'
                                                : t.status === 'In Progress'
                                                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 border-amber-200 dark:border-amber-800'
                                                : 'bg-gray-100 dark:bg-white/5 text-gray-400 border-gray-200 dark:border-white/10'
                                            }
                                        `}>
                                            <Icons.Ticket size={18} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 mb-0.5">
                                                <p className={`text-sm font-semibold truncate leading-snug ${isActive ? 'text-brand-700 dark:text-brand-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                                    {t.title}
                                                </p>
                                                <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 mt-0.5">
                                                    {formatRelativeTime(t.updatedAt)}
                                                </span>
                                            </div>

                                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 leading-relaxed">
                                                {stripMarkdown(lastMsg?.content || t.description)}
                                            </p>

                                            <div className="flex items-center justify-between mt-1.5 gap-2">
                                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md leading-none ${
                                                    t.status === 'Open'
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                        : t.status === 'In Progress'
                                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                        : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400'
                                                }`}>
                                                    {t.status}
                                                </span>
                                                {unread && (
                                                    <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* ── Chat Pane ── */}
                <div className={`
                    flex-1 flex flex-col overflow-hidden
                    ${activeTicketId ? 'flex' : 'hidden md:flex'}
                `}>
                    {activeTicket ? (
                        <UserChat
                            ticket={activeTicket}
                            onBack={() => setActiveTicketId(null)}
                        />
                    ) : (
                        // Empty state for desktop
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50 dark:bg-[#0d1117]">
                            <div className="w-20 h-20 rounded-full bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mb-5 shadow-sm">
                                <Icons.Message size={36} className="text-brand-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">Select a ticket</h3>
                            <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs">
                                Choose a support ticket from the list to view the conversation.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
