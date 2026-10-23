import React, { useState, useRef, useEffect } from 'react';
import { Ticket, TicketStatus, Shortcut, Message } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { sendMessage, assignAgent, changeStatus as updateTicketStatus, escalate, unassignTicket } from '../../services/ticketService';
import { toggleTicketPin } from '../../services/storageService';
import { useToast } from '../../contexts/ToastContext';
import { useTickets } from '../../contexts/TicketContext';
import { Icons } from '../common/Icons';

interface QuickActionsProps {
    ticket: Ticket;
    disabled?: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ ticket, disabled = false }) => {
    const [replyText, setReplyText] = useState('');
    const [attachments, setAttachments] = useState<string[]>([]);
    const { user } = useAuth();
    const { showToast } = useToast();
    const { refreshTickets, shortcuts, updateLocalTicket } = useTickets();
    const [isSending, setIsSending] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Shortcut state
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [shortcutFilter, setShortcutFilter] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Handle shortcut detection
    useEffect(() => {
        const text = replyText;
        const lastSlashIndex = text.lastIndexOf('/');
        
        if (lastSlashIndex !== -1 && (lastSlashIndex === 0 || text[lastSlashIndex - 1] === ' ' || text[lastSlashIndex - 1] === '\n')) {
            const afterSlash = text.substring(lastSlashIndex + 1);
            if (!afterSlash.includes(' ')) {
                setShowShortcuts(true);
                setShortcutFilter(afterSlash.toLowerCase());
                setSelectedIndex(0);
                return;
            }
        }
        setShowShortcuts(false);
    }, [replyText]);

    const filteredShortcuts = shortcuts.filter(s => 
        s.trigger.toLowerCase().includes(shortcutFilter) || 
        s.text.toLowerCase().includes(shortcutFilter)
    );

    const applyShortcut = (shortcut: Shortcut) => {
        const lastSlashIndex = replyText.lastIndexOf('/');
        if (lastSlashIndex !== -1) {
            const newText = replyText.substring(0, lastSlashIndex) + shortcut.text + ' ';
            setReplyText(newText);
            setShowShortcuts(false);
            textareaRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showShortcuts && filteredShortcuts.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filteredShortcuts.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredShortcuts.length) % filteredShortcuts.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                applyShortcut(filteredShortcuts[selectedIndex]);
            } else if (e.key === 'Escape') {
                setShowShortcuts(false);
            }
            return;
        }

        // Enter to send, Alt+Enter or Shift+Enter for newline
        if (e.key === 'Enter') {
            if (!e.altKey && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            } else {
                e.preventDefault();
                const target = e.target as HTMLTextAreaElement;
                const start = target.selectionStart;
                const end = target.selectionEnd;
                setReplyText(prev => prev.substring(0, start) + '\n' + prev.substring(end));
                
                setTimeout(() => {
                    target.selectionStart = target.selectionEnd = start + 1;
                }, 0);
            }
        }
    };

    const handleSend = async () => {
        if (!replyText.trim()) return;
        setIsSending(true);

        const userRole = user?.role === 'team_lead' ? 'team_lead' : 'staff';
        const newStatus = ticket.status === 'Closed' ? 'Open' : (userRole === 'staff' && ticket.status === 'Open' ? 'In Progress' : ticket.status);

        // Optimistic message — appears instantly before server confirms
        const optimisticMessage: Message = {
            id: `optimistic-${Date.now()}`,
            senderId: user?.email || 'unknown',
            senderName: user?.name || 'Staff',
            role: userRole,
            content: replyText,
            attachments,
            timestamp: new Date()
        };

        const updates: any = {
            isReadByStaff: true,
            lastMessageRole: userRole,
            lastMessagePreview: replyText.substring(0, 100),
            lastAgentReplyAt: new Date(),
            updatedAt: new Date(),
            status: newStatus,
            // Inject message into thread immediately — prevents flash
            messages: [...(ticket.messages || []), optimisticMessage],
            detailsLoaded: true
        };
        if (userRole === 'staff' && !ticket.assignedToEmail && user?.email) {
            updates.assignedToEmail = user.email;
        }
        updateLocalTicket(ticket.id, updates);

        try {
            await sendMessage(ticket, {
                senderId: user?.email || 'unknown',
                senderName: user?.name || 'Staff',
                role: userRole,
                content: replyText,
                attachments
            });
            
            setReplyText('');
            setAttachments([]);
            setIsExpanded(false); 
            showToast('Reply sent', 'success');

        } catch (error) {
            // On failure, remove the optimistic message
            updateLocalTicket(ticket.id, {
                messages: ticket.messages || [],
                detailsLoaded: true
            });
            showToast('Failed to send reply', 'error');
        } finally {
            setIsSending(false);
        }
    };

    const handleAssign = async () => {
        if(!user?.email) return;
        updateLocalTicket(ticket.id, { assignedToEmail: user.email });
        await assignAgent(ticket.id, user.email);
        showToast('Ticket assigned to you', 'success');
        refreshTickets();
    };

    const handleUnassign = async () => {
        if (!confirm("Release this ticket?")) return;
        try {
            updateLocalTicket(ticket.id, { assignedToEmail: null });
            await unassignTicket(ticket.id);
            showToast('Ticket released', 'info');
            refreshTickets();
        } catch (e) {
            showToast('Failed to release ticket', 'error');
        }
    };

    const handleTogglePin = async () => {
        updateLocalTicket(ticket.id, { isPinned: !ticket.isPinned });
        await toggleTicketPin(ticket.id, !ticket.isPinned);
        showToast(ticket.isPinned ? 'Unpinned' : 'Pinned', 'info');
        refreshTickets();
    };

    const handleStatusChange = async (status: TicketStatus) => {
        updateLocalTicket(ticket.id, { status });
        await updateTicketStatus(ticket.id, status);
        showToast(`Status: ${status}`, 'info');
        refreshTickets();
    };

    const handleEscalate = async () => {
        if(!confirm("Escalate to IT Staff?")) return;
        try {
            await escalate(ticket);
            showToast('Escalated', 'success');
            refreshTickets();
        } catch(e) {
            showToast('Failed to escalate', 'error');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    setAttachments(prev => [...prev, ev.target!.result as string]);
                    setIsExpanded(true);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="p-3 md:p-4 space-y-2.5 relative font-sans">
            {/* Toolbar Row */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 md:gap-2 text-xs md:text-sm">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {!ticket.assignedToEmail ? (
                        <button disabled={disabled} onClick={handleAssign} className="flex items-center gap-1 px-2.5 md:px-3 py-1.5 bg-brand-50 dark:bg-brand-950/20 hover:bg-brand-100 dark:hover:bg-brand-900/30 text-brand-700 dark:text-brand-400 rounded-lg text-xs font-semibold border border-brand-200 dark:border-brand-800 transition-colors">
                            <Icons.User size={13} /> Take It
                        </button>
                    ) : (
                        ticket.assignedToEmail === user?.email && ticket.status !== 'Closed' && (
                             <button disabled={disabled} onClick={handleUnassign} className="flex items-center gap-1 px-2.5 md:px-3 py-1.5 bg-surface-50 hover:bg-surface-100 dark:bg-dark-card dark:hover:bg-dark-hover text-surface-600 dark:text-surface-300 rounded-lg text-xs font-semibold border border-surface-200 dark:border-dark-border transition-colors">
                                <Icons.Logout size={13} className="rotate-180" /> Release
                            </button>
                        )
                    )}

                    <div className="h-4 w-px bg-surface-200 dark:bg-dark-border mx-0.5"></div>

                    <button onClick={handleTogglePin} disabled={disabled} className={`p-1.5 rounded-lg transition-colors ${ticket.isPinned ? 'text-brand-600 bg-brand-50 dark:bg-brand-950/30' : 'text-surface-400 hover:bg-surface-100 dark:hover:bg-dark-hover'}`} title="Pin Ticket">
                        <Icons.Pin size={15} className={ticket.isPinned ? 'fill-current' : ''} />
                    </button>

                    <div className="flex items-center gap-1 ml-0.5 bg-surface-50 dark:bg-dark-card border border-surface-200 dark:border-dark-border rounded-lg px-2 py-0.5">
                        <span className="text-2xs text-surface-400 font-medium">Status:</span>
                        <select 
                            value={ticket.status} 
                            disabled={disabled}
                            onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                            className="bg-transparent text-2xs font-semibold text-surface-800 dark:text-white outline-none cursor-pointer py-1"
                        >
                            <option value="Open" className="bg-surface-0 dark:bg-dark-card">Open</option>
                            <option value="In Progress" className="bg-surface-0 dark:bg-dark-card">Working</option>
                            <option value="Closed" className="bg-surface-0 dark:bg-dark-card">Closed</option>
                        </select>
                    </div>
                </div>

                {user?.role === 'team_lead' && !ticket.isEscalated && (
                    <button 
                        onClick={handleEscalate}
                        disabled={disabled}
                        className="flex items-center gap-1 px-2.5 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg text-xs font-semibold border border-transparent hover:border-red-200 transition-colors"
                    >
                        <Icons.Alert size={13} /> Escalate
                    </button>
                )}
            </div>

            {/* Shortcut Popup */}
            {showShortcuts && filteredShortcuts.length > 0 && (
                <div className="absolute bottom-full left-4 mb-2 w-80 max-h-64 overflow-y-auto bg-surface-0 dark:bg-dark-card rounded-xl shadow-modal border border-surface-200 dark:border-dark-border z-50 animate-slide-up">
                    <div className="p-2.5 text-2xs font-semibold text-surface-400 uppercase tracking-wider border-b border-surface-100 dark:border-dark-border">
                        Shortcuts
                    </div>
                    <div className="p-1">
                        {filteredShortcuts.map((s, idx) => (
                            <button
                                key={s.trigger}
                                onClick={() => applyShortcut(s)}
                                className={`w-full text-left p-2 rounded-lg flex flex-col gap-0.5 transition-colors ${
                                    idx === selectedIndex ? 'bg-brand-50 dark:bg-brand-950/30' : 'hover:bg-surface-50 dark:hover:bg-dark-hover'
                                }`}
                                onMouseEnter={() => setSelectedIndex(idx)}
                            >
                                <span className="font-mono text-xs font-semibold text-brand-600 dark:text-brand-400">/{s.trigger}</span>
                                <span className="text-2xs text-surface-500 dark:text-surface-400 truncate">{s.text}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Macro Workspace */}
            <div className="flex flex-wrap gap-1.5 mb-1.5 text-xs items-center">
                <span className="font-semibold text-2xs uppercase text-surface-400">Macros:</span>
                {ticket.title.toLowerCase().includes('metadata') && (
                    <button 
                        onClick={async () => { 
                            setReplyText("Your details could not be verified on the metadata. Please fill out the Agent Upload Request form here: https://docs.google.com/forms/d/e/1FAIpQLSeT5Ou82Iha4zdHZ2ADwPHvcpS8NfNrlyAlSU1sYq6PyLAFHQ/viewform"); 
                            setIsExpanded(true); 
                            setIsSending(true);
                            try {
                                await sendMessage(ticket, {
                                    senderId: user?.email || 'unknown',
                                    senderName: user?.name || 'Staff',
                                    role: user?.role === 'team_lead' ? 'team_lead' : 'staff',
                                    content: "Your details could not be verified on the metadata. Please fill out the Agent Upload Request form here: https://docs.google.com/forms/d/e/1FAIpQLSeT5Ou82Iha4zdHZ2ADwPHvcpS8NfNrlyAlSU1sYq6PyLAFHQ/viewform",
                                    attachments: []
                                });
                                await updateTicketStatus(ticket.id, 'Closed');
                                showToast('Macro applied: Saved and Closed', 'success');
                                refreshTickets();
                            } catch (e) {
                                showToast('Failed to apply macro', 'error');
                            } finally {
                                setIsSending(false);
                                setReplyText('');
                            }
                        }} 
                        className="px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 rounded-md font-medium text-2xs transition-colors border border-red-200 dark:border-red-900 shadow-xs"
                    >
                        Not Found on Metadata (Auto-Close)
                    </button>
                )}
                {ticket.title.toLowerCase().includes('webmail') && (
                    <button 
                        onClick={() => { 
                            const pwd = prompt("Enter the new webmail password:");
                            if (pwd) {
                                setIsSending(true);
                                const msg = `Your webmail password has been reset. Your new password is ${pwd}. Please log in and change it immediately.`;
                                sendMessage(ticket, {
                                    senderId: user?.email || 'unknown',
                                    senderName: user?.name || 'Staff',
                                    role: user?.role === 'team_lead' ? 'team_lead' : 'staff',
                                    content: msg,
                                    attachments: []
                                }).then(() => {
                                    updateTicketStatus(ticket.id, 'Closed').then(() => {
                                        showToast('Webmail Reset sent and closed', 'success');
                                        refreshTickets();
                                        setIsSending(false);
                                    });
                                });
                            }
                        }} 
                        className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 rounded-md font-medium text-2xs transition-colors border border-blue-200 dark:border-blue-900 shadow-xs"
                    >
                        Webmail Reset (Auto-Close)
                    </button>
                )}
            </div>

            {/* Editor Box */}
            <div 
                className={`border border-surface-200 dark:border-dark-border rounded-xl bg-surface-50 dark:bg-dark-card focus-within:ring-2 focus-within:ring-brand-500/10 focus-within:border-brand-400 transition-all shadow-xs duration-200 ${
                    disabled ? 'opacity-60 bg-surface-100' : ''
                } ${isExpanded ? 'border-brand-400 ring-2 ring-brand-500/10' : ''}`}
            >
                <textarea
                    ref={textareaRef}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsExpanded(true)}
                    disabled={disabled}
                    placeholder="Reply... (Type / for shortcuts)"
                    className={`w-full p-3 bg-transparent border-none outline-none resize-none text-[13.5px] leading-relaxed text-surface-800 dark:text-surface-100 placeholder:text-surface-400 transition-all duration-200 ${
                        isExpanded ? 'h-28' : 'h-10 overflow-hidden'
                    }`}
                />
                
                {/* Attachments List */}
                {attachments.length > 0 && (
                    <div className="px-3 pb-2 flex gap-2 overflow-x-auto">
                        {attachments.map((att, idx) => (
                            <div key={idx} className="relative group shrink-0">
                                <img src={att} className="w-12 h-12 object-cover rounded-lg border border-surface-200 dark:border-dark-border" alt="attachment" />
                                <button onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-surface-800 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Bottom Bar */}
                {(isExpanded || replyText || attachments.length > 0) && (
                    <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-surface-200 dark:border-dark-border bg-surface-0 dark:bg-dark-surface rounded-b-xl animate-fade-in">
                        <div className="flex items-center gap-1">
                            <label className={`p-1.5 text-surface-400 hover:text-brand-600 hover:bg-surface-100 dark:hover:bg-dark-hover rounded-lg cursor-pointer transition-colors ${disabled ? 'pointer-events-none' : ''}`}>
                                <Icons.Attachment size={16} />
                                <input type="file" className="hidden" onChange={handleFileChange} accept="image/*" disabled={disabled} />
                            </label>
                             <button onClick={() => setIsExpanded(false)} className="p-1.5 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 rounded-lg" title="Collapse">
                                 <Icons.Close size={16} />
                             </button>
                        </div>

                        <button 
                            onClick={handleSend}
                            disabled={isSending || !replyText.trim() || disabled}
                            className="px-4 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-semibold hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50 shadow-xs transition-all"
                        >
                            {isSending ? 'Sending...' : 'Send'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
