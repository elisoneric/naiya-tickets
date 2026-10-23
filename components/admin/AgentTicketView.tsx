import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTickets } from '../../contexts/TicketContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { updateTicket } from '../../services/storageService';
import { sendMessage } from '../../services/ticketService';
import { Icons } from '../common/Icons';
import { FormattedMessage, stripMarkdown } from '../common/FormattedMessage';
import { formatFullDateTimeWAT } from '../../utils/dateUtils';
import { VpnToolModal } from './VpnToolModal';
import { WebmailToolModal } from './WebmailToolModal';
import { cleanStaffReply } from '../../services/deepseekService';
import { extractPayIdentifierFromTicket } from '../../services/payService';
import { TicketFormMetadataCard } from '../tickets/TicketFormMetadataCard';

interface AgentTicketViewProps {
    ticketId: string;
}

export const AgentTicketView: React.FC<AgentTicketViewProps> = ({ ticketId }) => {
    const { 
        tickets, 
        getTicket, 
        activeTicket, 
        setActiveTicketId, 
        shortcuts, 
        updateLocalTicket,
        setActiveFolder,
        setPayTargetQuery 
    } = useTickets();
    const { user } = useAuth();
    const { showToast } = useToast();
    
    // Resilient ticket resolution (finds ticket in active list, master cache, or activeTicket)
    const ticket = getTicket(ticketId) || (activeTicket?.id === ticketId ? activeTicket : undefined) || tickets.find(t => t.id === ticketId);
    
    const draftKey = `draft_agent_${ticketId}`;
    const [replyText, setReplyText] = useState(() => localStorage.getItem(draftKey) || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [localMessages, setLocalMessages] = useState<any[]>([]);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [shortcutFilter, setShortcutFilter] = useState('');
    const [selectedShortcutIndex, setSelectedShortcutIndex] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const filteredShortcuts = useMemo(() => {
        return (shortcuts || []).filter(s => s.trigger.toLowerCase().includes(shortcutFilter.toLowerCase()));
    }, [shortcuts, shortcutFilter]);

    useEffect(() => {
        setSelectedShortcutIndex(0);
    }, [shortcutFilter]);

    const insertShortcut = (s: { trigger: string; text: string }) => {
        const newText = replyText.replace(/(?:^|\s)\/[a-zA-Z0-9_-]*$/, (prefix) => {
            const leadingWhitespace = prefix.startsWith(' ') || prefix.startsWith('\n') ? prefix[0] : '';
            return leadingWhitespace + s.text + ' ';
        });
        setReplyText(newText);
        setShowShortcuts(false);
        setSelectedShortcutIndex(0);
        setTimeout(() => textareaRef.current?.focus(), 0);
    };
    const [showVpnTool, setShowVpnTool] = useState(false);
    const [showWebmailTool, setShowWebmailTool] = useState(false);
    const [showToolsDropdown, setShowToolsDropdown] = useState(false);
    const toolsDropdownRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [isQuickResetting, setIsQuickResetting] = useState(false);
    const [isPolishing, setIsPolishing] = useState(false);

    // Save draft to local storage
    useEffect(() => {
        localStorage.setItem(draftKey, replyText);
    }, [replyText, draftKey]);

    // Reset local messages whenever active ticket changes
    useEffect(() => {
        setLocalMessages([]);
        setReplyText(localStorage.getItem(draftKey) || '');
    }, [ticketId, draftKey]);

    const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Lightbox state for images
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const allMessages = useMemo(() => {
        const raw = [...(ticket?.messages || []), ...localMessages];
        const seenIds = new Set<string>();
        const result: any[] = [];

        for (const m of raw) {
            if (!m || !m.id) continue;
            if (seenIds.has(m.id)) continue;

            const mTime = m.timestamp ? new Date(m.timestamp).getTime() : 0;
            const isDuplicate = result.some(existing => {
                if (existing.id === m.id) return true;
                if (
                    existing.senderId === m.senderId &&
                    (existing.content || '').trim() === (m.content || '').trim()
                ) {
                    const exTime = existing.timestamp ? new Date(existing.timestamp).getTime() : 0;
                    return Math.abs(exTime - mTime) < 180000;
                }
                return false;
            });

            if (!isDuplicate) {
                seenIds.add(m.id);
                result.push(m);
            }
        }

        result.sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeA - timeB;
        });

        return result;
    }, [ticket?.messages, localMessages]);

    // Auto-scroll to bottom on message updates
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [allMessages.length, ticket?.id]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(e.target as Node)) {
                setShowToolsDropdown(false);
            }
        };
        if (showToolsDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showToolsDropdown]);

    // Keyboard navigation: Escape closes modals/dropdowns or goes back to ticket list
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (previewImage) {
                    setPreviewImage(null);
                    return;
                }
                if (showToolsDropdown) {
                    setShowToolsDropdown(false);
                    return;
                }
                if (showShortcuts) {
                    setShowShortcuts(false);
                    return;
                }
                // If not typing in input or textarea, go back to ticket list
                const activeEl = document.activeElement;
                const isInputActive = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement || (activeEl as HTMLElement)?.isContentEditable;
                if (!isInputActive) {
                    setActiveTicketId(null);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [previewImage, showToolsDropdown, showShortcuts, setActiveTicketId]);

    // Detect corporate email associated with this ticket
    const detectedCorporateEmail = useMemo(() => {
        const COMPANY_DOMAINS = ['naiyatechnology.org', 'naiyatech.com.ng', 'samuikyglobal.com.ng'];
        const isCorp = (em: string) => COMPANY_DOMAINS.some(d => (em || '').toLowerCase().endsWith(`@${d}`));
        
        if (ticket?.createdByEmail && isCorp(ticket.createdByEmail)) {
            return ticket.createdByEmail.trim().toLowerCase();
        }
        const text = `${ticket?.title || ''} ${ticket?.description || ''}`;
        const match = text.match(/[a-zA-Z0-9._%+-]+@(naiyatechnology\.org|naiyatech\.com\.ng|samuikyglobal\.com\.ng)/i);
        return match ? match[0].trim().toLowerCase() : null;
    }, [ticket]);

    const handleQuickWebmailReset = async () => {
        if (!detectedCorporateEmail) return;
        setIsQuickResetting(true);
        setShowToolsDropdown(false);

        const [userPart, domainPart] = detectedCorporateEmail.split('@');
        
        const DIGITS = '0123456789';
        const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const getRandomDigits = (len: number) => {
            let res = '';
            for (let i = 0; i < len; i++) res += DIGITS.charAt(Math.floor(Math.random() * DIGITS.length));
            return res;
        };
        const getRandomUpper = (len: number) => {
            let res = '';
            for (let i = 0; i < len; i++) res += UPPER.charAt(Math.floor(Math.random() * UPPER.length));
            return res;
        };

        const prefix = domainPart.includes('samuiky') ? 'SAMUIKY' : (domainPart.includes('naiya') ? 'NAIYA' : getRandomUpper(6));
        const newPassword = `${prefix}@${getRandomDigits(6)}`;

        try {
            showToast(`Resetting cPanel password for ${detectedCorporateEmail}...`, 'info');
            const API_URL = (import.meta as any).env?.VITE_API_URL || '/backend/api.php';
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            const storedUser = localStorage.getItem('app_user');
            if (storedUser) {
                const u = JSON.parse(storedUser);
                if (u?.token) headers['Authorization'] = `Bearer ${u.token}`;
            }

            const res = await fetch(`${API_URL}?action=cpanel_change_webmail_password`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    email: userPart,
                    domain: domainPart,
                    password: newPassword
                })
            });

            const data = await res.json();

            if (data.status === 'success' || data.cpanel_executed) {
                const replyTemplate = `Hello, here is your Webmail password:

• Email: ${detectedCorporateEmail}
• Password: ${newPassword}
• Webmail URL: https://${domainPart}/webmail

Advise:
• Double-check password (use CAPITAL letters and @, no extra spaces).`;

                setReplyText(prev => (prev ? `${prev}\n\n${replyTemplate}` : replyTemplate));
                navigator.clipboard.writeText(newPassword);
                showToast(`cPanel updated! Password copied & inserted into reply.`, 'success');
            } else if (data.account_not_found || (data.message && (data.message.toLowerCase().includes('not found') || data.message.toLowerCase().includes('does not exist')))) {
                const notFoundReply = `Hello,

The corporate email address "${detectedCorporateEmail}" does not exist on our mail server (${domainPart}).

Our support system cannot reset passwords for non-existent accounts, and corporate email accounts cannot be created through this automated flow.

Please verify the spelling of your email address with your team lead or contact your administrator to request mailbox creation.`;

                setReplyText(prev => (prev ? `${prev}\n\n${notFoundReply}` : notFoundReply));
                showToast(`Account does not exist on mail server. Custom reply inserted into draft.`, 'warning');
            } else {
                const manualReply = `Hello,

Our automated reset for ${detectedCorporateEmail} could not execute on the mail server (${data.message || 'cPanel notice'}). 

Our IT team has logged this request to manually reset your webmail credentials. We will update you with your new login details shortly.`;
                setReplyText(prev => (prev ? `${prev}\n\n${manualReply}` : manualReply));
                showToast(`cPanel auto-reset failed. Manual handling reply inserted into draft.`, 'warning');
            }
        } catch (err) {
            console.error(err);
            const manualReply = `Hello,

Our automated reset for ${detectedCorporateEmail} encountered a connection error contacting the mail server. 

Our IT team has logged this request to manually reset your webmail credentials. We will update you with your new login details shortly.`;
            setReplyText(prev => (prev ? `${prev}\n\n${manualReply}` : manualReply));
            showToast('Network error contacting cPanel API. Manual handling reply inserted.', 'warning');
        } finally {
            setIsQuickResetting(false);
        }
    };

    if (!ticket) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-surface-400 dark:text-surface-500 bg-surface-50 dark:bg-dark-bg">
                <Icons.Inbox size={48} className="opacity-20 mb-3" />
                <p className="text-sm font-semibold">Loading ticket details...</p>
            </div>
        );
    }

    // Split AI Data if present
    let aiSummary = '';
    let descriptionText = ticket.description || '';
    let transcriptText = '';

    const hasNewBriefFormat = /^(ISSUE:|USER:|DETAILS:|ACTION NEEDED:)/m.test(descriptionText);
    const hasOldAiFormat = descriptionText.includes('AI Triage Summary:');
    const hasBuiltinFormat = descriptionText.includes('Built-in Assistant Auto-Intake:');

    if (hasNewBriefFormat || hasOldAiFormat) {
        const transcriptMarker = descriptionText.includes('--- Full Transcript ---')
            ? '--- Full Transcript ---'
            : 'Full Transcript:';
        const parts = descriptionText.split(transcriptMarker);
        const summaryRaw = parts[0]
            .replace('AI Triage Summary:', '')
            .replace('--- AI Intake Summary ---', '')
            .trim();
        aiSummary = summaryRaw;
        if (parts[1]) transcriptText = parts[1].trim();
    } else if (hasBuiltinFormat) {
        const parts = descriptionText.split('Transcript:');
        aiSummary = parts[0].replace('Built-in Assistant Auto-Intake:', '').trim();
        if (parts[1]) transcriptText = parts[1].trim();
    }

    // NIMC ticket detection
    const isNimcTicket = ['nimc login details', 'metadata onboarding'].includes((ticket.category || '').toLowerCase());

    const nimcActionTemplates = {
        uploaded: `Hello,

Your NIMC/Metadata details have been verified and your profile has been successfully uploaded to the metadata server.

You should now be able to find your agent profile active. Please check the device and let us know if you need any further assistance.`,
        windowClosed: `Hello,

We have checked your details on the NIMC portal. Unfortunately, the enrollment window for new profiles is currently closed and we are unable to process new uploads at this time.

We will notify you as soon as the window reopens. We apologize for the inconvenience.`,
        loginReset: `Hello,

Your NIMC login credentials have been reset. Please use the new credentials shared via the secure channel to access the portal.

If you encounter any issues logging in after the reset, please reply on this ticket.`,
        pendingVerification: `Hello,

Thank you for providing your details. We have forwarded your information to the NIMC verification team. Please allow 24–48 hours for processing.

We will update you as soon as we receive confirmation.`
    };

    const insertNimcReply = (key: keyof typeof nimcActionTemplates) => {
        const template = nimcActionTemplates[key];
        setReplyText(prev => prev ? `${prev}\n\n${template}` : template);
        showToast('Reply template inserted into draft.', 'success');
    };

    const handleCleanReply = async () => {
        if (!replyText.trim() || isPolishing) return;
        const backupDraft = replyText;
        setIsPolishing(true);
        showToast('Polishing...', 'info');
        try {
            const polished = await cleanStaffReply(replyText, {
                title: ticket.title,
                category: ticket.category,
                userName: ticket.createdByName,
                userEmail: ticket.createdByEmail,
                ticketNumber: ticket.ticketNumber
            });
            if (
                polished && 
                polished.trim() && 
                !polished.startsWith('Network connection') && 
                !polished.startsWith('The AI Support Assistant') &&
                !polished.startsWith('We encountered a momentary')
            ) {
                setReplyText(polished.trim());
                showToast('Reply polished!', 'success');
            } else {
                setReplyText(backupDraft);
                showToast('Could not polish reply. Your draft was kept safe.', 'error');
            }
        } catch (err: any) {
            setReplyText(backupDraft);
            showToast(err?.message || 'Failed to polish reply. Your draft was kept safe.', 'error');
        } finally {
            setIsPolishing(false);
        }
    };

    const handleCleanAndSendReply = async () => {
        if ((!replyText.trim() && pendingAttachments.length === 0) || !user || isSubmitting || isPolishing) return;
        setIsPolishing(true);
        let textToSend = replyText.trim();
        showToast('Polishing & sending...', 'info');
        try {
            const polished = await cleanStaffReply(textToSend, {
                title: ticket.title,
                category: ticket.category,
                userName: ticket.createdByName,
                userEmail: ticket.createdByEmail,
                ticketNumber: ticket.ticketNumber
            });
            if (
                polished && 
                polished.trim() && 
                !polished.startsWith('Network connection') && 
                !polished.startsWith('The AI Support Assistant') &&
                !polished.startsWith('We encountered a momentary')
            ) {
                textToSend = polished.trim();
                setReplyText(textToSend);
            }
        } catch (err) {
            console.error('Auto-polish before send failed, sending original:', err);
        } finally {
            setIsPolishing(false);
        }

        await doSendReply(textToSend);
    };

    const handleAssignToMe = async () => {
        if (!user) return;
        updateLocalTicket(ticket.id, { assignedToEmail: user.email });
        await updateTicket(ticket.id, { assignedToEmail: user.email });
    };

    const handleCloseTicket = async () => {
        updateLocalTicket(ticket.id, { status: 'Closed' });
        await updateTicket(ticket.id, { status: 'Closed' });
        showToast('Ticket marked as Resolved', 'success');
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) {
                setPendingAttachments(prev => [...prev, ev.target!.result as string]);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const doSendReply = async (customContent?: string) => {
        const textToUse = typeof customContent === 'string' ? customContent : replyText;
        if ((!textToUse.trim() && pendingAttachments.length === 0) || !user || isSubmitting) return;
        setIsSubmitting(true);
        const content = textToUse.trim() || 'Sent an attachment';
        const attachments = [...pendingAttachments];
        const tempId = 'temp-' + Date.now();

        const optimisticMsg = {
            id: tempId,
            senderId: user.email,
            senderName: user.name,
            role: user.role,
            content,
            attachments: attachments.slice(),
            timestamp: new Date()
        };

        const currentTicket = getTicket(ticket.id) || ticket;
        const currentMessages = currentTicket?.messages || [];
        const optimisticMessages = [...currentMessages, optimisticMsg];

        setLocalMessages(prev => [...prev, optimisticMsg]);
        setReplyText('');
        setPendingAttachments([]);
        setShowShortcuts(false);
        localStorage.removeItem(draftKey);

        const newStatus = ticket.status === 'Closed' ? 'Open' : (user.role === 'staff' && ticket.status === 'Open' ? 'In Progress' : ticket.status);
        const updates: any = {
            isReadByStaff: true,
            lastMessageRole: user.role,
            lastMessagePreview: stripMarkdown(content).substring(0, 100),
            lastAgentReplyAt: new Date(),
            updatedAt: new Date(),
            status: newStatus,
            messages: optimisticMessages,
            detailsLoaded: true
        };
        if (user.role === 'staff' && !ticket.assignedToEmail) {
            updates.assignedToEmail = user.email;
        }
        updateLocalTicket(ticket.id, updates);

        try {
            const sent = await sendMessage(ticket, {
                senderId: user.email,
                senderName: user.name,
                role: user.role,
                content,
                attachments
            });

            const latestTicket = getTicket(ticket.id) || ticket;
            const confirmedMsg = {
                ...optimisticMsg,
                id: sent?.id || tempId,
                attachments: (sent?.attachments && sent.attachments.length > 0) ? sent.attachments : optimisticMsg.attachments,
                timestamp: sent?.timestamp ? new Date(sent.timestamp) : optimisticMsg.timestamp
            };

            // Retain the confirmed message in localMessages so it NEVER vanishes from view
            setLocalMessages(prev => prev.map(m => m.id === tempId ? confirmedMsg : m));

            // Merge into ticket in context
            const confirmedMessages = (latestTicket?.messages || optimisticMessages).map((m: any) =>
                m.id === tempId ? confirmedMsg : m
            );
            if (!confirmedMessages.some((m: any) => m.id === confirmedMsg.id || (m.content === confirmedMsg.content && m.senderId === confirmedMsg.senderId))) {
                confirmedMessages.push(confirmedMsg);
            }

            updateLocalTicket(ticket.id, {
                messages: confirmedMessages,
                detailsLoaded: true
            });
        } catch(e) {
            const latestTicket = getTicket(ticket.id) || ticket;
            const reverted = (latestTicket?.messages || []).filter((m: any) => m.id !== tempId);
            updateLocalTicket(ticket.id, {
                messages: reverted,
                detailsLoaded: true
            });
            setLocalMessages(prev => prev.filter(m => m.id !== tempId));
            showToast('Failed to send reply. Please try again.', 'error');
            console.error(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSendReply = () => doSendReply();

    const ImageGrid = ({ attachments }: { attachments: string[] }) => {
        return (
            <div className="flex flex-wrap gap-2.5 mt-3 border-t border-surface-200 dark:border-dark-border pt-3">
                {attachments.map((att, i) => (
                    <div 
                        key={i} 
                        className="w-32 h-24 md:w-36 md:h-28 bg-surface-100 dark:bg-dark-card rounded-lg overflow-hidden border border-surface-200 dark:border-dark-border shadow-xs hover:shadow-elevated transition-shadow" 
                    >
                        <img 
                            src={att} 
                            onClick={() => setPreviewImage(att)}
                            className="w-full h-full object-cover cursor-zoom-in hover:opacity-95 transition-opacity" 
                            alt="attachment" 
                            loading="lazy" 
                        />
                    </div>
                ))}
            </div>
        );
    };

    return (
        <section aria-label="Ticket Conversation" className="flex-1 flex flex-col h-full overflow-hidden bg-surface-0 dark:bg-dark-surface font-sans relative w-full">
            {/* Header bar (Phase 3A & Phase 7A mobile responsive) */}
            <div className="relative z-30 bg-surface-0 dark:bg-dark-surface border-b border-surface-200 dark:border-dark-border px-3 md:px-5 py-2.5 md:py-3.5 flex flex-col md:flex-row md:items-center md:justify-between shrink-0 gap-2 md:gap-0 transition-colors">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <button 
                        onClick={() => setActiveTicketId(null)} 
                        className="p-1.5 -ml-1 text-surface-400 hover:text-surface-700 hover:bg-surface-100 dark:hover:bg-dark-hover rounded-lg transition-colors shrink-0"
                        title="Back to list (Esc)"
                        aria-label="Back"
                    >
                        <Icons.Back size={18} />
                    </button>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <h2 className="text-sm md:text-base font-semibold text-surface-900 dark:text-white leading-tight line-clamp-1 md:line-clamp-none">
                                {ticket.title}
                            </h2>
                            <span className={`text-2xs uppercase font-semibold px-2 py-0.5 rounded-md shrink-0 ${
                                ticket.status === 'Closed' ? 'bg-surface-100 text-surface-600 dark:bg-dark-card dark:text-surface-400 border border-surface-200 dark:border-dark-border' :
                                ticket.status === 'In Progress' ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-900' :
                                'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900'
                            }`}>
                                {ticket.status}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 md:gap-2.5 text-xs text-surface-500 dark:text-surface-400 font-medium flex-wrap">
                            <span className="font-mono bg-surface-100 dark:bg-dark-card text-surface-500 px-1.5 py-0.5 rounded-md text-2xs">{ticket.ticketNumber}</span>
                            <span className="flex items-center gap-1.5">
                                {ticket.agentRole && (
                                    <span className={`text-2xs font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                                        ticket.agentRole === 'team_lead' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200' :
                                        ticket.agentRole === 'moniepoint' ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400 border border-teal-200' :
                                        ticket.agentRole === 'referee' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200' : 'bg-surface-100 text-surface-600 dark:bg-dark-card dark:text-surface-400'
                                    }`}>
                                        {ticket.agentRole === 'team_lead' ? 'TL' : ticket.agentRole === 'moniepoint' ? 'MP' : ticket.agentRole === 'referee' ? 'REF' : 'AGENT'}
                                    </span>
                                )}
                                <span 
                                    className="cursor-pointer hover:underline text-brand-600 dark:text-brand-400"
                                    onClick={() => {
                                        navigator.clipboard.writeText(ticket.createdByEmail);
                                        showToast('Email copied to clipboard', 'success');
                                    }}
                                    title="Click to copy"
                                >
                                    {ticket.createdByEmail}
                                </span>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 md:gap-2 flex-wrap justify-end md:justify-start">
                    {/* Compact IT Tools Dropdown */}
                    <div className="relative z-40" ref={toolsDropdownRef}>
                        <button 
                            type="button"
                            onClick={() => setShowToolsDropdown(prev => !prev)}
                            className="px-2.5 md:px-3 py-1.5 md:py-2 border rounded-lg text-xs md:text-sm font-semibold transition-all shadow-xs flex items-center gap-1.5 bg-surface-0 dark:bg-dark-card border-surface-200 dark:border-dark-border text-surface-700 dark:text-surface-200 hover:border-brand-400 hover:text-brand-600"
                            title="Quick IT Support Tools"
                        >
                            <Icons.Settings size={14} className="text-brand-600 dark:text-brand-400" />
                            <span>Tools</span>
                            <Icons.Expand size={12} className={`text-surface-400 transition-transform duration-200 ${showToolsDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {showToolsDropdown && (
                            <div className="fixed inset-x-0 bottom-0 md:absolute md:inset-auto md:right-0 md:mt-2 md:w-72 bg-surface-0 dark:bg-dark-card rounded-t-2xl md:rounded-xl shadow-modal border border-surface-200 dark:border-dark-border py-1.5 z-50 animate-slide-up md:animate-scale-in text-left max-h-[75vh] md:max-h-none overflow-y-auto">
                                <div className="md:hidden flex justify-center py-2">
                                    <div className="w-10 h-1 bg-surface-300 dark:bg-dark-border rounded-full"></div>
                                </div>
                                <div className="px-3 py-1.5 border-b border-surface-100 dark:border-dark-border text-2xs font-semibold uppercase tracking-wider text-surface-400">
                                    Support Action Tools
                                </div>

                                {detectedCorporateEmail && (
                                    <div className="p-2 border-b border-surface-100 dark:border-dark-border bg-emerald-50/60 dark:bg-emerald-950/20">
                                        <button
                                            type="button"
                                            onClick={handleQuickWebmailReset}
                                            disabled={isQuickResetting}
                                            className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-all shadow-xs flex items-center justify-between gap-2"
                                            title={`Auto reset in cPanel & insert draft for ${detectedCorporateEmail}`}
                                        >
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <Icons.Mail size={14} className={isQuickResetting ? 'animate-spin' : ''} />
                                                <span className="truncate">Auto-Reset Webmail</span>
                                            </div>
                                            <span className="text-2xs bg-white/20 px-1.5 py-0.5 rounded font-mono uppercase">1-Click</span>
                                        </button>
                                        <div className="text-2xs text-emerald-800 dark:text-emerald-300 font-medium truncate mt-1 px-1">
                                            For {detectedCorporateEmail}
                                        </div>
                                    </div>
                                )}
                                
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowToolsDropdown(false);
                                        setShowVpnTool(true);
                                    }}
                                    className="w-full px-3 py-2.5 flex items-start gap-2.5 hover:bg-surface-50 dark:hover:bg-dark-hover transition-colors text-left group"
                                >
                                    <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                                        <Icons.Shield size={14} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-semibold text-surface-900 dark:text-white">VPN Tool</div>
                                        <p className="text-2xs text-surface-400 truncate">
                                            Diagnostics, swaps & allocations
                                        </p>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowToolsDropdown(false);
                                        setShowWebmailTool(true);
                                    }}
                                    className="w-full px-3 py-2.5 flex items-start gap-2.5 hover:bg-surface-50 dark:hover:bg-dark-hover transition-colors text-left group"
                                >
                                    <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                                        <Icons.Mail size={14} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-semibold text-surface-900 dark:text-white">Webmail Tool Modal</div>
                                        <p className="text-2xs text-surface-400 truncate">
                                            Detailed cPanel manager & domain router
                                        </p>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowToolsDropdown(false);
                                        const candidate = extractPayIdentifierFromTicket(ticket);
                                        setPayTargetQuery(candidate);
                                        setActiveFolder('Pay');
                                    }}
                                    className="w-full px-3 py-2.5 flex items-start gap-2.5 hover:bg-surface-50 dark:hover:bg-dark-hover transition-colors text-left group"
                                >
                                    <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                                        <Icons.Document size={14} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-semibold text-surface-900 dark:text-white">Pay & Work Records</div>
                                        <p className="text-2xs text-surface-400 truncate">
                                            Monthly volume verification (NIN / IMEI)
                                        </p>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>

                    {ticket.assignedToEmail !== user?.email ? (
                        <button 
                            onClick={handleAssignToMe}
                            className="px-3 md:px-4 py-1.5 md:py-2 bg-surface-0 dark:bg-dark-card border border-surface-200 dark:border-dark-border hover:border-brand-400 dark:hover:border-brand-500 rounded-lg text-xs md:text-sm font-semibold text-surface-700 dark:text-surface-200 hover:text-brand-600 transition-colors shadow-xs"
                        >
                            <span className="hidden sm:inline">Take It</span>
                            <span className="sm:hidden">Take</span>
                        </button>
                    ) : (
                        <div className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs md:text-sm font-semibold flex items-center gap-1.5">
                             <Icons.Check size={14} /> 
                             <span className="hidden sm:inline">Assigned to you</span>
                             <span className="sm:hidden">Assigned</span>
                        </div>
                    )}

                    {ticket.status !== 'Closed' && (
                        <button 
                            onClick={handleCloseTicket}
                            className="px-3 md:px-4 py-1.5 md:py-2 bg-surface-0 dark:bg-dark-card border border-surface-200 dark:border-dark-border hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 hover:border-red-200 rounded-lg text-xs md:text-sm font-semibold text-surface-700 dark:text-surface-200 transition-colors shadow-xs"
                        >
                            Resolve
                        </button>
                    )}
                </div>
            </div>

            {/* NIMC / Metadata 1-Click Action Bar */}
            {isNimcTicket && (
                <div className="border-b border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 px-3 md:px-6 py-2.5 relative z-10 shrink-0">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-2xs uppercase font-bold tracking-wider text-amber-700 dark:text-amber-400">NIMC / Metadata — Staff Actions</span>
                            <span className="text-2xs text-amber-600/80 dark:text-amber-500 font-medium hidden sm:inline">(inserts reply template into draft)</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 md:gap-2">
                            <button
                                type="button"
                                onClick={() => insertNimcReply('uploaded')}
                                className="px-2.5 md:px-3 py-1 md:py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-lg text-[11px] md:text-xs font-semibold transition-all shadow-xs flex items-center gap-1"
                            >
                                <Icons.Check size={12} />
                                <span className="hidden sm:inline">Profile Uploaded</span>
                                <span className="sm:hidden">Uploaded</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => insertNimcReply('windowClosed')}
                                className="px-2.5 md:px-3 py-1 md:py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white rounded-lg text-[11px] md:text-xs font-semibold transition-all shadow-xs flex items-center gap-1"
                            >
                                <Icons.Lock size={12} />
                                <span className="hidden sm:inline">Window Closed</span>
                                <span className="sm:hidden">Closed</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => insertNimcReply('loginReset')}
                                className="px-2.5 md:px-3 py-1 md:py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-lg text-[11px] md:text-xs font-semibold transition-all shadow-xs flex items-center gap-1"
                            >
                                <Icons.Shield size={12} />
                                <span className="hidden sm:inline">Login Reset Done</span>
                                <span className="sm:hidden">Reset Done</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => insertNimcReply('pendingVerification')}
                                className="px-2.5 md:px-3 py-1 md:py-1.5 bg-surface-600 hover:bg-surface-700 active:scale-[0.98] text-white rounded-lg text-[11px] md:text-xs font-semibold transition-all shadow-xs flex items-center gap-1"
                            >
                                <Icons.Clock size={12} />
                                <span className="hidden sm:inline">Pending Verification</span>
                                <span className="sm:hidden">Pending</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Message Thread Body */}
            <div className="flex-1 overflow-y-auto w-full px-2.5 md:px-8 py-4 md:py-6 bg-surface-50/70 dark:bg-dark-bg/70 relative z-0 flex flex-col gap-4 md:gap-5">
                <div className="max-w-4xl w-full mx-auto flex flex-col gap-4 md:gap-5">
                    
                    {/* Form Submission Details Quick Copy Badges */}
                    <TicketFormMetadataCard ticket={ticket} />

                    {/* Initial Ticket Description Card */}
                    <div className="flex flex-col w-full">
                         <div className="flex items-start gap-2.5 md:gap-3 p-3.5 md:p-4 rounded-xl bg-surface-0 dark:bg-dark-card border border-surface-200 dark:border-dark-border">
                             <div className="w-8 h-8 rounded-lg bg-surface-100 dark:bg-dark-hover text-surface-600 dark:text-surface-300 flex items-center justify-center shrink-0 font-bold overflow-hidden text-xs">
                                {ticket.createdByEmail.charAt(0).toUpperCase()}
                             </div>
                             <div className="flex-1 min-w-0 flex flex-col justify-center">
                                 <div className="flex items-start md:items-center justify-between mb-1.5 flex-wrap gap-1">
                                     <div className="flex items-center gap-2">
                                         <p className="font-semibold text-surface-900 dark:text-white text-xs md:text-sm">
                                             <span 
                                                 className="cursor-pointer hover:underline text-brand-600 dark:text-brand-400 mr-1.5"
                                                 onClick={() => {
                                                     navigator.clipboard.writeText(ticket.createdByEmail);
                                                     showToast('Email copied to clipboard', 'success');
                                                 }}
                                                 title="Click to copy email"
                                             >
                                                 {ticket.createdByEmail}
                                             </span>
                                             <span className="opacity-60 font-normal text-xs">({ticket.agentRole || 'Agent'})</span>
                                         </p>
                                         <span className="text-2xs uppercase font-medium text-surface-400 bg-surface-100 dark:bg-dark-hover px-1.5 py-0.5 rounded-md">Original Request</span>
                                     </div>
                                     <span className="text-2xs text-surface-400 font-medium tabular-nums">{formatFullDateTimeWAT(ticket.createdAt as Date)}</span>
                                 </div>
                                 <div className="text-surface-700 dark:text-surface-300 text-[13.5px] md:text-[14px] leading-[1.65] pb-1">
                                      {aiSummary ? (
                                          <>
                                              <div className="font-semibold text-2xs uppercase tracking-wider mb-2 flex items-center gap-1.5 text-brand-600 dark:text-brand-400">
                                                  <Icons.Sparkles size={13} /> Grounded AI Intake Summary
                                              </div>
                                              <div className="mb-3 border-l-2 border-brand-500 pl-3 py-1.5 text-sm text-surface-800 dark:text-surface-200 bg-brand-50/40 dark:bg-brand-950/20 rounded-r-lg font-medium leading-relaxed">
                                                  <FormattedMessage content={aiSummary} />
                                              </div>
                                              {transcriptText ? (
                                                  <details className="mt-3 border border-surface-200 dark:border-dark-border rounded-lg p-2.5 bg-surface-50 dark:bg-dark-hover text-xs group">
                                                      <summary className="font-semibold text-brand-600 dark:text-brand-400 cursor-pointer select-none flex items-center justify-between">
                                                          <span className="flex items-center gap-1.5">
                                                              <Icons.Chat size={13} /> View Full Conversation Transcript
                                                          </span>
                                                          <span className="text-2xs text-surface-400 group-open:rotate-180 transition-transform">▼</span>
                                                      </summary>
                                                      <div className="mt-2 font-mono whitespace-pre-wrap text-2xs opacity-80 pt-2 border-t border-surface-200 dark:border-dark-border max-h-60 overflow-y-auto">
                                                          {transcriptText}
                                                      </div>
                                                  </details>
                                              ) : (
                                                  <div className="font-mono text-2xs opacity-70 border-t border-surface-200 dark:border-dark-border pt-2 whitespace-pre-wrap">
                                                      {descriptionText}
                                                  </div>
                                              )}
                                          </>
                                      ) : (
                                          <FormattedMessage content={descriptionText} />
                                      )}
                                 </div>
                                 {ticket.attachments && (ticket.attachments.length > 0) && (
                                    <ImageGrid attachments={ticket.attachments} />
                                 )}
                             </div>
                         </div>
                    </div>

                    {allMessages.map(msg => {
                        const isOnRight = ['staff', 'admin', 'team_lead'].includes(msg.role);
                        let initial = (msg.senderName || msg.senderId || 'U').charAt(0).toUpperCase();

                        let cardBg = isOnRight ? 'bg-brand-50/20 dark:bg-brand-950/15 border-brand-100 dark:border-brand-900/30' : 'bg-surface-0 dark:bg-dark-card border-surface-200 dark:border-dark-border';
                        let avatarBg = isOnRight ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'bg-surface-100 text-surface-600 dark:bg-dark-hover dark:text-surface-300';

                        return (
                            <div key={msg.id} className="flex flex-col w-full">
                                <div className={`flex items-start gap-2.5 md:gap-3 p-3.5 md:p-4 rounded-xl border ${cardBg}`}>
                                     <div className={`w-8 h-8 rounded-lg ${avatarBg} flex items-center justify-center shrink-0 font-bold overflow-hidden text-xs`}>
                                        {msg.role !== 'guest' && isOnRight ? <Icons.Shield size={14} className="opacity-90"/> : initial}
                                     </div>
                                     <div className="flex-1 min-w-0 flex flex-col justify-center">
                                         <div className="flex items-start md:items-center justify-between mb-1 flex-wrap gap-1">
                                             <div className="flex items-center gap-2">
                                                 <p className="font-semibold text-surface-900 dark:text-white text-xs md:text-sm">
                                                    {msg.senderName || msg.senderId} 
                                                    <span className="opacity-60 text-2xs ml-1 font-normal">{(isOnRight && ['staff', 'admin'].includes(msg.role)) ? 'IT Staff' : msg.role === 'team_lead' ? 'Team Lead' : msg.role === 'guest' ? 'End User' : 'Agent'}</span>
                                                 </p>
                                                 {isOnRight && (
                                                     <span className="text-2xs uppercase font-semibold text-brand-700 dark:text-brand-300 bg-brand-100/60 dark:bg-brand-900/40 px-1.5 py-0.2 rounded-md flex items-center gap-1">
                                                         Support
                                                     </span>
                                                 )}
                                             </div>
                                             <span className="text-2xs text-surface-400 font-medium tabular-nums min-w-fit">{formatFullDateTimeWAT(msg.timestamp)}</span>
                                         </div>
                                         <div className="text-surface-700 dark:text-surface-300 text-[13.5px] md:text-[14px] leading-[1.65] pb-1">
                                            <FormattedMessage content={msg.content} />
                                         </div>
                                         {msg.attachments && (msg.attachments.length > 0) && (
                                            <ImageGrid attachments={msg.attachments} />
                                         )}
                                     </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Always-Accessible Reply Box */}
            <div className="bg-surface-0 dark:bg-dark-surface border-t border-surface-200 dark:border-dark-border px-3 md:px-6 py-2.5 md:py-3.5 shrink-0 relative z-30 w-full transition-colors">
                <div className="max-w-4xl mx-auto relative">
                    
                    {/* Shortcuts autocomplete dropdown - Positioned floating OVER the text field */}
                    {showShortcuts && filteredShortcuts.length > 0 && (
                        <div className="absolute bottom-full mb-2 left-0 sm:left-2 w-80 md:w-96 max-h-64 overflow-y-auto bg-surface-0 dark:bg-dark-card border border-surface-200 dark:border-dark-border shadow-2xl rounded-xl z-50 animate-scale-in">
                            <div className="px-3 py-1.5 border-b border-surface-100 dark:border-dark-border text-2xs font-semibold uppercase tracking-wider text-surface-400 bg-surface-50 dark:bg-dark-surface select-none">
                                Shortcuts ({filteredShortcuts.length})
                            </div>
                            <div className="p-1 space-y-0.5">
                                {filteredShortcuts.map((s, idx) => (
                                    <button
                                        key={s.trigger}
                                        type="button"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            insertShortcut(s);
                                        }}
                                        onClick={() => insertShortcut(s)}
                                        onMouseEnter={() => setSelectedShortcutIndex(idx)}
                                        className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex flex-col gap-0.5 cursor-pointer ${
                                            idx === selectedShortcutIndex
                                                ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-200 dark:border-brand-800 text-brand-900 dark:text-brand-100'
                                                : 'border-transparent hover:bg-surface-50 dark:hover:bg-dark-hover text-surface-700 dark:text-surface-300'
                                        }`}
                                    >
                                        <div className="text-xs font-bold text-brand-600 dark:text-brand-400">
                                            /{s.trigger}
                                        </div>
                                        <div className="text-2xs text-surface-500 dark:text-surface-400 line-clamp-2 leading-relaxed">
                                            {s.text}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Main input card - clear field, no hovering bar */}
                    <div className="rounded-xl border border-surface-200 dark:border-dark-border focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-500 transition-all bg-surface-50 dark:bg-dark-card relative">
                        <textarea 
                            ref={textareaRef}
                            value={replyText}
                            onChange={e => {
                                const val = e.target.value;
                                setReplyText(val);
                                
                                const match = val.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/);
                                if (match) {
                                    setShowShortcuts(true);
                                    setShortcutFilter(match[1].toLowerCase());
                                } else {
                                    setShowShortcuts(false);
                                }
                            }}
                            onKeyDown={e => {
                                if (showShortcuts && filteredShortcuts.length > 0) {
                                    if (e.key === 'ArrowDown') {
                                        e.preventDefault();
                                        setSelectedShortcutIndex(prev => (prev + 1) % filteredShortcuts.length);
                                        return;
                                    }
                                    if (e.key === 'ArrowUp') {
                                        e.preventDefault();
                                        setSelectedShortcutIndex(prev => (prev - 1 + filteredShortcuts.length) % filteredShortcuts.length);
                                        return;
                                    }
                                    if (e.key === 'Enter' || e.key === 'Tab') {
                                        e.preventDefault();
                                        insertShortcut(filteredShortcuts[selectedShortcutIndex]);
                                        return;
                                    }
                                    if (e.key === 'Escape') {
                                        e.preventDefault();
                                        setShowShortcuts(false);
                                        return;
                                    }
                                } else if (showShortcuts && e.key === 'Escape') {
                                    setShowShortcuts(false);
                                    return;
                                }

                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    e.preventDefault();
                                    handleCleanAndSendReply();
                                    return;
                                }

                                if (e.key === 'Enter' && e.shiftKey) {
                                    return;
                                }

                                if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                                    e.preventDefault();
                                    handleSendReply();
                                    return;
                                }
                            }}
                            placeholder="Type a reply..."
                            className="w-full min-h-[76px] md:min-h-[85px] max-h-48 p-3 md:p-3.5 pb-12 md:pb-12 resize-none bg-transparent outline-none text-xs md:text-sm text-surface-800 dark:text-surface-100 placeholder:text-surface-400 leading-relaxed block"
                        />

                        {/* Pending Attachments */}
                        {pendingAttachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 px-3 pb-2">
                                {pendingAttachments.map((att, i) => (
                                    <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-surface-200 dark:border-dark-border shadow-xs group">
                                        <img src={att} alt="pending" className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => setPendingAttachments(prev => prev.filter((_, idx) => idx !== i))}
                                            className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                            aria-label="Remove image"
                                        >
                                            <Icons.Close size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Action Bar - Just Clean (icon only), Attachment (icon only), and Send */}
                        <div className="absolute bottom-2 right-2.5 flex items-center gap-1.5 sm:gap-2">
                            {/* Clean / Polish Button (Icon only) */}
                            <button
                                type="button"
                                disabled={!replyText.trim() || isPolishing}
                                onClick={handleCleanReply}
                                className="p-1.5 bg-purple-50 dark:bg-purple-950/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg transition-all flex items-center justify-center shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                title="Clean reply with AI"
                                aria-label="Clean reply with AI"
                            >
                                <Icons.Sparkles size={16} className={isPolishing ? 'animate-spin text-purple-500' : 'text-purple-600 dark:text-purple-400'} />
                            </button>

                            {/* Attachment Button (Icon only) */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="p-1.5 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors rounded-lg hover:bg-surface-100 dark:hover:bg-dark-hover flex items-center justify-center cursor-pointer"
                                title="Attach image"
                                aria-label="Attach image"
                            >
                                <Icons.Attachment size={16} />
                            </button>

                            {/* Send Button */}
                            <button
                                type="button"
                                disabled={(!replyText.trim() && pendingAttachments.length === 0) || isSubmitting}
                                onClick={() => handleSendReply()}
                                className="bg-brand-600 hover:bg-brand-700 active:scale-[0.98] disabled:bg-surface-200 dark:disabled:bg-dark-card disabled:text-surface-400 text-white px-3 md:px-3.5 py-1.5 rounded-lg font-semibold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                                title="Send"
                                aria-label="Send reply"
                            >
                                {isSubmitting ? (
                                    <Icons.Refresh size={14} className="animate-spin" />
                                ) : (
                                    <>
                                        <span>Send</span>
                                        <Icons.Send size={13} />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lightbox */}
            {previewImage && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center animate-fade-in font-sans" onClick={() => setPreviewImage(null)}>
                    <div className="relative w-full h-full flex flex-col p-4 md:p-8">
                        <div className="flex justify-between items-center absolute top-4 right-4 md:top-8 md:right-8 z-10">
                            <button onClick={() => setPreviewImage(null)} className="text-white/80 hover:text-white p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors" title="Close (Esc)">
                                <Icons.Close size={22} />
                            </button>
                        </div>
                        <div className="flex-1 p-0 flex items-center justify-center min-h-0">
                            <img src={previewImage} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" alt="Preview" onClick={e => e.stopPropagation()} />
                        </div>
                    </div>
                </div>
            )}

            {/* In-Ticket VPN Management Modal */}
            {showVpnTool && (
                <VpnToolModal
                    email={ticket.createdByEmail}
                    ticketId={ticket.ticketNumber || ticket.id}
                    onClose={() => setShowVpnTool(false)}
                    onInsertReply={(text) => {
                        setReplyText(prev => (prev ? `${prev}\n\n${text}` : text));
                    }}
                />
            )}

            {/* In-Ticket Webmail Management Modal */}
            {showWebmailTool && (
                <WebmailToolModal
                    email={detectedCorporateEmail || ticket.createdByEmail}
                    ticketId={ticket.ticketNumber || ticket.id}
                    onClose={() => setShowWebmailTool(false)}
                    onInsertReply={(text) => {
                        setReplyText(prev => (prev ? `${prev}\n\n${text}` : text));
                    }}
                />
            )}
        </section>
    );
};
