import React, { useState, useEffect, useRef } from 'react';
import { Icons } from '../common/Icons';
import { FormattedMessage } from '../common/FormattedMessage';
import { useAuth } from '../../contexts/AuthContext';
import { useTickets } from '../../contexts/TicketContext';
import { runIntakeConversation, summarizeForStaff } from '../../services/deepseekService';
import { getAiIntakePrompt, DisabledCategory } from '../../config/AiIntakePrompt';
import { createNewTicket } from '../../services/ticketService';
import { useToast } from '../../contexts/ToastContext';
import { UserChat } from './UserChat';
import { knowledgeBase } from '../../services/knowledgeBase';
import { 
    getMainMenuOptions, 
    processBuiltinAssistantMessage, 
    ChatOption, 
    ChatActionButton 
} from '../../services/builtinAssistantService';
import { resolveVpnForUser } from '../../services/vpnAutonomousService';
import { attemptWebmailReset, extractCorporateEmail } from '../../services/webmailAutonomousService';

const DEFAULT_CATEGORIES = [
    "Device & Activation Related",
    "Metadata Onboarding",
    "NIMC Login Details",
    "VPN Related",
    "WEBMAIL",
    "Others"
];

interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    options?: ChatOption[];
    actionButton?: ChatActionButton;
    ticketId?: string;
}

export const SupportMessengerWidget: React.FC<{ hidden?: boolean }> = ({ hidden }) => {

    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<'home' | 'ai_chat' | 'ticket'>('home');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const { tickets, activeTicketId, setActiveTicketId, refreshTickets, triageCategories, getTicket } = useTickets();
    const { showToast } = useToast();
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Derive disabled categories to inject into AI prompt and use for code-level blocks
    const disabledCategories: DisabledCategory[] = (triageCategories || []).filter(c => c.disabled).map(c => ({
        name: c.presetCategory || c.title,
        message: c.disabledMessage || 'This service is temporarily unavailable. Please check back later.',
    }));

    const myTickets = tickets.filter(t => t.createdByEmail?.toLowerCase() === user?.email?.toLowerCase());

    const [isExpanded, setIsExpanded] = useState(false);

    // Voice note recording states (max 30s)
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [voiceTranscript, setVoiceTranscript] = useState('');
    const recognitionRef = useRef<any>(null);
    const timerRef = useRef<any>(null);
    const voiceTranscriptRef = useRef('');

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch {}
            }
        };
    }, []);

    const startVoiceRecording = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            showToast('Voice recording / speech recognition is not supported in this browser. Please type your message.', 'info');
            return;
        }

        try {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            voiceTranscriptRef.current = '';
            setVoiceTranscript('');
            setRecordingSeconds(0);
            setIsRecording(true);

            recognition.onresult = (event: any) => {
                let text = '';
                for (let i = 0; i < event.results.length; i++) {
                    text += event.results[i][0].transcript;
                }
                voiceTranscriptRef.current = text;
                setVoiceTranscript(text);
            };

            recognition.onerror = (event: any) => {
                console.warn('Speech recognition warning:', event.error);
                if (event.error === 'not-allowed') {
                    showToast('Microphone access was denied. Please allow microphone permissions in your browser.', 'error');
                    stopVoiceRecording(false);
                }
            };

            recognition.onend = () => {
                // Keep recording state synced if recognition terminates prematurely
            };

            recognition.start();
            recognitionRef.current = recognition;

            let elapsed = 0;
            timerRef.current = setInterval(() => {
                elapsed += 1;
                setRecordingSeconds(elapsed);
                if (elapsed >= 30) {
                    stopVoiceRecording(true);
                }
            }, 1000);
        } catch (err: any) {
            console.error('Failed to start speech recognition:', err);
            showToast('Unable to access microphone: ' + (err.message || 'Microphone error'), 'error');
            setIsRecording(false);
        }
    };

    const stopVoiceRecording = (shouldSend: boolean = true) => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch { /* ignore */ }
            recognitionRef.current = null;
        }

        setIsRecording(false);

        const captured = voiceTranscriptRef.current.trim();
        if (shouldSend) {
            if (captured) {
                handleSend(`[Voice Note]: "${captured}"`);
            } else {
                showToast('No speech was detected. Please state your issue clearly or type your message.', 'info');
            }
        }
        setVoiceTranscript('');
        voiceTranscriptRef.current = '';
    };

    const cancelVoiceRecording = () => {
        stopVoiceRecording(false);
    };

    useEffect(() => {
        const handleOpenSupportChat = (e: any) => {
            setIsOpen(true);
            setIsExpanded(window.innerWidth < 768); // Auto-expand on mobile
            const initialMsg = e?.detail?.initialMessage;
            setTimeout(() => {
                 startChat();
                 if (initialMsg) {
                     setTimeout(() => {
                         handleSend(initialMsg);
                     }, 200);
                 }
            }, 100);
        };
        window.addEventListener('open-support-chat', handleOpenSupportChat);
        return () => window.removeEventListener('open-support-chat', handleOpenSupportChat);
    }, [messages.length]);

    // Detect incoming referral from Pay Portal
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const fromSource = urlParams.get('from') || urlParams.get('ref');
        if (fromSource === 'pay_portal' || fromSource === 'pay' || urlParams.get('chat') === 'ai') {
            const agentId = urlParams.get('agent_id') || urlParams.get('identifier') || '';
            const email = urlParams.get('email') || '';
            setIsOpen(true);
            setView('ai_chat');
            setIsExpanded(window.innerWidth < 768);

            const welcome = agentId 
                ? `Hello! I noticed you are visiting from the NA'IYA & SAMUIKY Agent Pay/Work Portal (Identifier: ${agentId}${email ? `, Email: ${email}` : ''}). How can I assist you with your report, monthly volume, or settlement inquiry today?`
                : `Hello! I noticed you are visiting from the NA'IYA & SAMUIKY Agent Pay/Work Portal. How can I assist you with your report or work records today?`;

            setMessages([
                {
                    id: 'pay-portal-referral',
                    role: 'model',
                    text: welcome,
                    options: getMainMenuOptions()
                }
            ]);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (view === 'ticket') {
                    setView('ai_chat');
                } else {
                    setIsOpen(false);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, view]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, view, loading]);

    const startChat = () => {
        setView('ai_chat');
        setIsExpanded(window.innerWidth < 768); // Only expand on mobile, keep as popup on desktop
        if (messages.length === 0) {
            setMessages([{
                id: 'init-msg',
                role: 'model',
                text: "Hi! I'm the Naiya Support Assistant. How can I help you today? Please choose a topic below or type your question:",
                options: getMainMenuOptions()
            }]);
        }
    };

    const handleOptionClick = async (opt: ChatOption) => {
        if (opt.action === 'back_main') {
            setMessages(prev => [
                ...prev,
                { id: 'user-' + Date.now(), role: 'user', text: opt.label },
                {
                    id: 'bot-' + Date.now(),
                    role: 'model',
                    text: "How can I help you? Please select a topic below or type your message:",
                    options: getMainMenuOptions()
                }
            ]);
            return;
        }

        if (opt.action === 'open_modal' && opt.modalType) {
            if (opt.modalType === 'vpn') {
                window.dispatchEvent(new CustomEvent('open-vpn-assistant'));
                setIsOpen(false);
            } else if (opt.modalType === 'nimc') {
                window.dispatchEvent(new CustomEvent('open-nimc-assistant'));
                setIsOpen(false);
            } else if (opt.modalType === 'webmail') {
                window.dispatchEvent(new CustomEvent('open-webmail-assistant'));
                setIsOpen(false);
            } else if (opt.modalType === 'pay') {
                const payBlocked = disabledCategories.find(d => 
                    d.name === 'Payment & Statement Portal' || 
                    d.name === 'Payment & Work Report'
                );
                if (payBlocked) {
                    showToast(payBlocked.message, 'error');
                    return;
                }
                window.dispatchEvent(new CustomEvent('open-pay-portal'));
                setIsOpen(false);
            } else if (opt.modalType === 'history') {
                window.dispatchEvent(new CustomEvent('open-ticket-history'));
                setIsOpen(false);
            }
            return;
        }

        if (opt.action === 'open_kb' && opt.kbId) {
            const article = knowledgeBase.find(k => k.id === opt.kbId);
            if (article) {
                window.dispatchEvent(new CustomEvent('open-kb-article', { detail: article }));
            }
            return;
        }

        if (opt.action === 'create_ticket') {
            const category = opt.category || 'Others';
            handleSend(`I would like to escalate to an IT engineer regarding ${category}. Please check if a ticket is needed.`);
            return;
        }

        // Default: send option value as message
        handleSend(opt.value);
    };

    const handleActionButtonClick = (btn: ChatActionButton) => {
        if (btn.action === 'link' && btn.url) {
            window.open(btn.url, '_blank', 'noopener,noreferrer');
            return;
        }
        if (btn.action === 'open_modal' && btn.modalType) {
            if (btn.modalType === 'vpn') {
                window.dispatchEvent(new CustomEvent('open-vpn-assistant'));
                setIsOpen(false);
            } else if (btn.modalType === 'nimc') {
                window.dispatchEvent(new CustomEvent('open-nimc-assistant'));
                setIsOpen(false);
            } else if (btn.modalType === 'webmail') {
                window.dispatchEvent(new CustomEvent('open-webmail-assistant'));
                setIsOpen(false);
            } else if (btn.modalType === 'pay') {
                const payBlocked = disabledCategories.find(d => 
                    d.name === 'Payment & Statement Portal' || 
                    d.name === 'Payment & Work Report'
                );
                if (payBlocked) {
                    showToast(payBlocked.message, 'error');
                    return;
                }
                window.dispatchEvent(new CustomEvent('open-pay-portal'));
                setIsOpen(false);
            } else if (btn.modalType === 'history') {
                window.dispatchEvent(new CustomEvent('open-ticket-history'));
                setIsOpen(false);
            }
            return;
        }
        if (btn.action === 'open_kb' && btn.kbId) {
            const article = knowledgeBase.find(k => k.id === btn.kbId);
            if (article) {
                window.dispatchEvent(new CustomEvent('open-kb-article', { detail: article }));
            }
            return;
        }
        if (btn.action === 'create_ticket') {
            if (btn.url && tickets.some(t => t.id === btn.url)) {
                openTicket(btn.url);
                return;
            }
            handleSend(`I would like to escalate to an IT engineer regarding ${btn.category || 'my issue'}. Please check if a ticket is needed.`);
            return;
        }
    };

    const handleSend = async (customMsg?: string, e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const userMsg = (customMsg !== undefined ? customMsg : input).trim();
        if (!userMsg || loading) return;

        setInput('');
        const userMsgObj: ChatMessage = { id: 'user-' + Date.now(), role: 'user', text: userMsg };
        const updatedMessages = [...messages, userMsgObj];
        setMessages(updatedMessages);
        setLoading(true);

        try {
            const aiReplyRaw = await runIntakeConversation(updatedMessages, userMsg, disabledCategories);

            if (aiReplyRaw) {
                let aiReply = aiReplyRaw;
                // Strip markdown bold/italic from AI reply (agents reading on mobile)
                aiReply = aiReply.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');

                // ============================================================
                // TRIGGER: WEBMAIL AUTO-RESET
                // ============================================================
                if (aiReply.includes('[SYSTEM: WEBMAIL_RESET_INTENT]')) {
                    const emailMatch = aiReply.match(/\[EMAIL:\s*([^\]]+)\]/);
                    const providedEmail = emailMatch ? emailMatch[1].trim() : extractCorporateEmail(userMsg) || userMsg.trim();
                    const cleanReply = aiReply
                        .replace('[SYSTEM: WEBMAIL_RESET_INTENT]', '')
                        .replace(/\[EMAIL:\s*[^\]]+\]/, '')
                        .trim();

                    setMessages(prev => [...prev, {
                        id: 'bot-' + Date.now(), role: 'model',
                        text: cleanReply || `Processing webmail reset for ${providedEmail}. Please wait...`
                    }]);

                    const webmailLocked = disabledCategories.find(d => d.name === 'WEBMAIL');
                    if (webmailLocked) {
                        setMessages(prev => [...prev, {
                            id: 'bot-' + Date.now(), role: 'model',
                            text: `Webmail service is currently under maintenance.\n\n${webmailLocked.message}\n\nPlease check back later.`,
                            options: getMainMenuOptions()
                        }]);
                        return;
                    }

                    // Get incidentBanner from tickets context if available
                    const incidentBanner = (window as any).__NAIYA_INCIDENT_BANNER__;
                    const resetResult = await attemptWebmailReset(
                        user?.name || '',
                        user?.email || '',
                        providedEmail,
                        incidentBanner
                    );

                    if (resetResult.success) {
                        // Auto-resolved — deliver credentials directly in chat
                        showToast('Webmail password reset successfully!', 'success');
                        setMessages(prev => [...prev, {
                            id: 'bot-' + Date.now(), role: 'model',
                            text: resetResult.replyText || 'Your webmail password has been reset.',
                            options: [{ label: 'Main Menu', value: 'main menu', action: 'back_main' }]
                        }]);
                        // Log auto-resolved ticket for telemetry (Closed status)
                        createNewTicket({
                            title: `Webmail Auto-Reset: ${resetResult.corporateEmail}`,
                            category: 'WEBMAIL',
                            description: `AI AUTO-RESOLVED\n${resetResult.matchResult?.reason || ''}\nEmail: ${resetResult.corporateEmail}\nReset by: Autonomous cPanel UAPI`,
                            createdByName: user?.name || 'User',
                            createdByEmail: user?.email || 'unknown',
                            project: 'Dont Know',
                            attachments: []
                        }).catch(() => {}); // Non-blocking telemetry
                    } else {
                        // Cannot auto-resolve — escalate to staff with the brief
                        const staffBrief = resetResult.staffBrief || `Webmail reset for ${providedEmail} requires manual staff action.`;
                        const chatHistoryForBrief = updatedMessages;

                        // Summarize with AI, or fall back to staffBrief
                        let description = staffBrief;
                        try {
                            const aiSummary = await summarizeForStaff(chatHistoryForBrief, 'WEBMAIL', user?.name || '', user?.email || '');
                            description = `${staffBrief}\n\n--- AI Intake Summary ---\n${aiSummary}`;
                        } catch { /* use staffBrief only */ }

                        await createNewTicket({
                            title: `Webmail Reset: ${providedEmail}`,
                            category: 'WEBMAIL',
                            description,
                            createdByName: user?.name || 'User',
                            createdByEmail: user?.email || 'unknown',
                            project: 'Dont Know',
                            attachments: []
                        });
                        refreshTickets();
                        showToast('Webmail request sent to IT staff.', 'info');
                        setMessages(prev => [...prev, {
                            id: 'bot-' + Date.now(), role: 'model',
                            text: resetResult.replyText || 'Your reset request has been escalated to our IT staff. They will respond shortly.',
                            options: [{ label: 'Main Menu', value: 'main menu', action: 'back_main' }]
                        }]);
                    }

                // ============================================================
                // TRIGGER: VPN WIDGET (attempt live lookup first)
                // ============================================================
                } else if (aiReply.includes('[SYSTEM: SHOW_VPN_WIDGET]')) {
                    const cleanReply = aiReply.replace('[SYSTEM: SHOW_VPN_WIDGET]', '').trim();
                    const vpnLocked = disabledCategories.find(d => d.name === 'VPN Related');

                    if (vpnLocked) {
                        setMessages(prev => [...prev, {
                            id: 'bot-' + Date.now(), role: 'model',
                            text: `The VPN service is currently under maintenance.\n\n${vpnLocked.message}\n\nPlease check back later.`,
                            options: getMainMenuOptions()
                        }]);
                        return;
                    }

                    // Attempt live VPN lookup if user is logged in
                    if (user?.email) {
                        setMessages(prev => [...prev, {
                            id: 'bot-thinking-' + Date.now(), role: 'model',
                            text: cleanReply || 'Looking up your VPN credentials...'
                        }]);

                        const isComplaint = /broken|not working|fail|issue|problem|cant connect|cannot connect/i.test(userMsg);
                        const vpnResult = await resolveVpnForUser(user.email);

                        if (vpnResult.success && vpnResult.replyText) {
                            showToast('VPN credentials retrieved!', 'success');
                            let responseText = vpnResult.replyText;
                            if (isComplaint) {
                                responseText += '\n\n⚠️ Policy Reminder: All VPN accounts in the system are verified and functional. Automated self-swapping is disabled for agents. Please verify your connection via MTN network / hotspot and confirm Caps Lock is OFF. If issues persist, an IT staff member can manually assist you.';
                            }
                            setMessages(prev => [...prev, {
                                id: 'bot-' + Date.now(), role: 'model',
                                text: responseText,
                                options: [{ label: 'Main Menu', value: 'main menu', action: 'back_main' }]
                            }]);
                        } else {
                            // Pool empty or retrieval error — show widget + fallback
                            const fallbackMsg = vpnResult.outcome === 'pool_empty'
                                ? 'No VPN is currently assigned to your account, and the central pool is awaiting new allocations. Please contact IT staff for provisioning.'
                                : 'I could not automatically retrieve your VPN credentials. Please use the VPN tool below to check or request access:';
                            setMessages(prev => [...prev, {
                                id: 'bot-' + Date.now(), role: 'model',
                                text: fallbackMsg,
                                actionButton: { label: 'Open VPN Tool', action: 'open_modal', modalType: 'vpn' },
                                options: [
                                    { label: 'Open VPN Tool', value: 'LAUNCH_VPN', action: 'open_modal', modalType: 'vpn' },
                                    { label: 'Main Menu', value: 'main menu', action: 'back_main' }
                                ]
                            }]);
                        }
                    } else {
                        // Guest user — just show VPN widget
                        setMessages(prev => [...prev, {
                            id: 'bot-' + Date.now(), role: 'model',
                            text: cleanReply || 'Click below to open the VPN Assistant:',
                            actionButton: { label: 'Launch VPN Assistant', action: 'open_modal', modalType: 'vpn' },
                            options: [
                                { label: 'Launch VPN Assistant', value: 'LAUNCH_VPN', action: 'open_modal', modalType: 'vpn' },
                                { label: 'Main Menu', value: 'main menu', action: 'back_main' }
                            ]
                        }]);
                    }

                // ============================================================
                // TRIGGER: HANDOFF TO STAFF (NIMC = direct to Open; others = AI Triage)
                // ============================================================
                } else if (aiReply.includes('[SYSTEM: HANDOFF_TRIGGER]')) {
                    const categoryMatch = aiReply.match(/\[CATEGORY:\s*([^\]]+)\]/);
                    const category = categoryMatch ? categoryMatch[1].trim() : 'Others';
                    let cleanReply = aiReply
                        .replace('[SYSTEM: HANDOFF_TRIGGER]', '')
                        .replace(/\[CATEGORY:\s*[^\]]+\]/, '')
                        .trim();

                    // Code-level lockdown guard
                    const blockedCat = disabledCategories.find(
                        d => d.name.toLowerCase() === category.toLowerCase()
                    );
                    if (blockedCat) {
                        setMessages(prev => [...prev, {
                            id: 'bot-' + Date.now(), role: 'model',
                            text: `This service is currently under maintenance and cannot accept new tickets.\n\n${blockedCat.message}\n\nPlease check back later or contact support through a different channel.`,
                            options: getMainMenuOptions()
                        }]);
                        return;
                    }

                    // STRICT INTERCEPTOR: Zero ticket creation for Device & Activation issues
                    const isDeviceCategory = category.toLowerCase().includes('device') || 
                                             category.toLowerCase().includes('activation') ||
                                             cleanReply.toLowerCase().includes('imei') ||
                                             userMsg.toLowerCase().includes('switch to production');
                    if (isDeviceCategory) {
                        setMessages(prev => [...prev, {
                            id: 'bot-' + Date.now(), role: 'model',
                            text: `Notice: IT Technical Support handles technical system access only (NIMC login credentials, metadata). We do not handle physical devices, hardware repairs, or form approvals, and we cannot fast-track requests.\n\nIf you submitted an onboarding, switch, or reactivation form, it will be considered in normal batch processing by operations handlers. For device troubleshooting or peer assistance, please ask in your official Enroller Community Group.`,
                            options: getMainMenuOptions()
                        }]);
                        return;
                    }

                    // Generate AI-summarized staff brief
                    let staffBrief = cleanReply;
                    try {
                        staffBrief = await summarizeForStaff(updatedMessages, category, user?.name || 'User', user?.email || '');
                    } catch { /* use cleanReply as fallback */ }

                    // NIMC always routes DIRECT to Staff Inbox (Open) — skip AI Triage
                    const isNimcCategory = category.toLowerCase().includes('nimc') || category.toLowerCase().includes('metadata');
                    const isVpnCategory = category.toLowerCase().includes('vpn');

                    let ticketTitle = `${category} Escalation`;
                    if (isNimcCategory) {
                        ticketTitle = `NIMC/Metadata: ${user?.name || 'Agent'}`;
                    } else if (isVpnCategory) {
                        ticketTitle = `VPN Escalation: ${user?.name || user?.email || 'Agent'}`;
                    } else {
                        const briefLine = staffBrief.split('\n')[0].replace(/^ISSUE:\s*/i, '').trim();
                        ticketTitle = briefLine ? `${category}: ${briefLine.slice(0, 45)}` : `${category} Request`;
                    }

                    const fullDescription = `${staffBrief}\n\n--- Full Transcript ---\n${updatedMessages.map(m => `[${m.role}]: ${m.text}`).join('\n')}`;

                    try {
                        const newTkt = await createNewTicket({
                            title: ticketTitle,
                            category,
                            description: fullDescription,
                            createdByName: user?.name || 'Guest User',
                            createdByEmail: user?.email || 'unknown',
                            project: 'Dont Know',
                            attachments: []
                        });

                        showToast('Ticket submitted to IT Support.', 'success');
                        refreshTickets();
                        setMessages(prev => [...prev, {
                            id: 'bot-' + Date.now(), role: 'model',
                            text: `${cleanReply || 'Thank you for providing the diagnostic details.'}\n\nTicket #${newTkt.ticketNumber || ''} has been created with your verified technical diagnosis. Our IT team has received your ticket and will follow up shortly.`,
                            options: [{ label: 'Main Menu', value: 'main menu', action: 'back_main' }]
                        }]);
                    } catch (err: any) {
                        showToast(err.message || 'Failed to submit ticket', 'error');
                        setMessages(prev => [...prev, {
                            id: 'bot-' + Date.now(), role: 'model',
                            text: `Failed to create ticket: ${err.message || 'Unknown error'}. Please try again.`,
                            options: getMainMenuOptions()
                        }]);
                    }

                // ============================================================
                // STANDARD AI REPLY
                // ============================================================
                } else {
                    setMessages(prev => [...prev, {
                        id: 'bot-' + Date.now(), role: 'model',
                        text: aiReply,
                        options: [
                            { label: 'Main Menu', value: 'main menu', action: 'back_main' }
                        ]
                    }]);
                }
            }
        } catch (err) {
            console.warn('External AI unreachable, activating built-in assistant engine.', err);
            const fallbackResp = processBuiltinAssistantMessage(userMsg, messages, disabledCategories);
            setMessages(prev => [...prev, {
                id: 'bot-' + Date.now(),
                role: 'model',
                text: fallbackResp.text,
                options: fallbackResp.options,
                actionButton: fallbackResp.actionButton
            }]);
        } finally {
            setLoading(false);
            if (inputRef.current) inputRef.current.focus();
        }
    };

    const openTicket = (id: string) => {
        setActiveTicketId(id);
        setView('ticket');
    };

    const renderMessageText = (text: string, isUser: boolean) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.split(urlRegex).map((part, i) => {
            if (part.match(urlRegex)) {
                return (
                    <a 
                        key={i} 
                        href={part} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className={`underline break-all font-semibold transition-colors hover:opacity-80 ${isUser ? 'text-white' : 'text-brand-600 dark:text-brand-400'}`}
                    >
                        {part}
                    </a>
                );
            }
            return part;
        });
    };

    return (
        <div 
            className={`fixed z-50 font-segoe transition-all ${
                isExpanded 
                    ? 'inset-0 w-full h-[100dvh] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-0 md:p-6' 
                    : 'bottom-6 right-6 flex flex-col items-end'
            }`}
            style={{ display: hidden ? 'none' : 'flex' }}
        >
            {isOpen && (
                <div className={`bg-white dark:bg-dark-surface shadow-2xl flex flex-col overflow-hidden transition-all ${
                    isExpanded 
                        ? 'w-full h-full md:max-w-4xl md:h-[92vh] md:rounded-3xl border border-slate-200/80 dark:border-dark-border animate-fade-in' 
                        : 'w-[390px] sm:w-[420px] h-[650px] max-h-[88vh] rounded-2xl border border-gray-100 dark:border-dark-border animate-slide-in-up mb-4'
                }`}>
                    
                    {/* Header */}
                    <div className="bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 text-white p-4 sm:p-5 flex justify-between items-center shrink-0 shadow-[0_4px_20px_rgba(0,0,0,0.1)] relative z-10 overflow-hidden">
                        {/* Abstract background for header */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-10 -translate-y-10 pointer-events-none"></div>
                        <div className="flex items-center gap-3">
                            {view !== 'home' && (
                                <button onClick={() => {
                                    if (view === 'ticket') setActiveTicketId(null);
                                    setView('home');
                                }} className="hover:bg-white/20 p-2 rounded-xl transition-colors text-white" title="Back to home">
                                    <Icons.Back size={18} />
                                </button>
                            )}
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-10 h-10 bg-white text-brand-600 rounded-full flex items-center justify-center font-bold text-lg shadow-sm border-2 border-brand-400">N</div>
                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-brand-600 rounded-full"></div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-base sm:text-lg tracking-tight drop-shadow-sm">Naiya Support</h3>
                                    <p className="text-[12px] text-brand-50/90 flex items-center gap-1.5 font-medium">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                        Instant AI Assistant & Gatekeeper
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button 
                                type="button"
                                onClick={() => setIsExpanded(!isExpanded)} 
                                className="hover:bg-white/20 p-2 rounded-xl transition-colors text-white" 
                                title={isExpanded ? 'Restore window size' : 'Expand full screen'}
                            >
                                {isExpanded ? <Icons.Minimize2 size={18} /> : <Icons.Maximize2 size={18} />}
                            </button>
                            <button 
                                type="button"
                                onClick={() => { setIsOpen(false); setIsExpanded(false); }} 
                                className="hover:bg-white/20 p-2 rounded-xl transition-colors text-white"
                                title="Close chat"
                            >
                                <Icons.Close size={20} />
                            </button>
                        </div>
                    </div>

                    {/* View: Home */}
                    {view === 'home' && (
                        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-dark-bg p-5 sm:p-6 space-y-6 relative">
                            {/* Ambient background blur */}
                            <div className="absolute top-0 left-0 w-full h-40 bg-brand-500/5 blur-3xl -z-10 pointer-events-none"></div>

                            <div className="bg-white/80 dark:bg-dark-surface/80 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-sm border border-brand-100 dark:border-dark-border text-center relative overflow-hidden group">
                                <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-500/10 rounded-full blur-xl group-hover:bg-brand-500/20 transition-colors"></div>
                                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-brand-100 to-brand-50 dark:from-brand-900/40 dark:to-brand-800/20 rounded-full flex items-center justify-center mb-4 border border-brand-200 dark:border-brand-700/50 shadow-inner">
                                    <Icons.Chat className="text-brand-600 dark:text-brand-400" size={28} />
                                </div>
                                <h4 className="font-bold text-xl text-slate-800 dark:text-white mb-2 tracking-tight">Start a conversation</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium max-w-md mx-auto">
                                    Our assistant resolves issues instantly through self-service tools, Knowledge Base guides, or verified diagnostic tickets.
                                </p>
                                <button onClick={startChat} className="w-full sm:w-auto sm:px-8 py-3.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-xl shadow-[0_4px_14px_0_rgba(2,132,199,0.39)] hover:shadow-[0_6px_20px_rgba(2,132,199,0.23)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 mx-auto">
                                    <Icons.Send size={18} /> Chat with Support
                                </button>
                            </div>

                            {myTickets.length > 0 && (
                                <div>
                                    <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400 mb-3 ml-2">Recent Tickets</h4>
                                    <div className="space-y-2">
                                        {myTickets.slice(0, 3).map(ticket => (
                                            <button 
                                                key={ticket.id} 
                                                onClick={() => openTicket(ticket.id)}
                                                className="w-full text-left bg-white dark:bg-dark-surface p-3.5 rounded-xl border border-gray-100 dark:border-dark-border shadow-sm hover:shadow-md transition-shadow flex justify-between items-center group"
                                            >
                                                <div className="pr-4 truncate">
                                                    <p className="font-semibold text-sm text-gray-800 dark:text-gray-200 truncate">{ticket.title}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5 truncate">{ticket.lastMessagePreview || ticket.description}</p>
                                                </div>
                                                <Icons.Back size={16} className="rotate-180 text-gray-300 group-hover:text-brand-500 shrink-0 transition-colors" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* View: AI & Built-in Chat */}
                    {view === 'ai_chat' && (
                        <>
                            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/60 dark:bg-dark-bg text-sm space-y-4" ref={scrollRef}>
                                {messages.map((m) => (
                                    <div key={m.id} className={`flex w-full animate-fade-in-up ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`flex items-end gap-2.5 max-w-[92%] sm:max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                            {m.role !== 'user' && (
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-brand-600 text-white shadow-md mb-1 border-2 border-white dark:border-dark-bg">
                                                    <span className="font-bold text-xs">AI</span>
                                                </div>
                                            )}
                                            <div className="flex flex-col gap-1.5 max-w-full">
                                                <div className={`px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-sm ${
                                                    m.role === 'user' 
                                                        ? 'bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-br-sm shadow-brand-500/20' 
                                                        : 'bg-white dark:bg-dark-surface text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-dark-border rounded-bl-sm'
                                                } max-w-full overflow-hidden`}>
                                                    <div className="leading-relaxed text-[13.5px] sm:text-[14px] break-words">
                                                        <FormattedMessage content={m.text} isUser={m.role === 'user'} />
                                                    </div>

                                                    {/* Action Button inside bubble if present */}
                                                    {m.actionButton && (
                                                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/10">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleActionButtonClick(m.actionButton!)}
                                                                className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 hover:shadow hover:-translate-y-0.5 active:scale-95"
                                                            >
                                                                <span>{m.actionButton.label}</span>
                                                                <Icons.Expand size={14} className="-rotate-90" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Interactive Option Chips underneath message if present */}
                                                {m.role === 'model' && m.options && m.options.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5 mt-1 max-w-full">
                                                        {m.options.map((opt, optIdx) => (
                                                            <button
                                                                key={optIdx}
                                                                type="button"
                                                                onClick={() => handleOptionClick(opt)}
                                                                disabled={loading || isRecording}
                                                                className="px-3 py-1.5 bg-white dark:bg-dark-surface text-brand-700 dark:text-brand-300 hover:bg-brand-50 hover:border-brand-300 dark:hover:bg-brand-900/30 border border-slate-200 dark:border-slate-700/80 rounded-xl text-[11.5px] sm:text-xs font-semibold transition-all shadow-xs hover:shadow-sm active:scale-95 text-left flex items-center gap-1.5 disabled:opacity-50"
                                                            >
                                                                <span>{opt.label}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {loading && (
                                    <div className="flex w-full animate-fade-in justify-start">
                                        <div className="flex items-end gap-2.5 max-w-[85%]">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-brand-600 text-white shadow-md mb-1 border-2 border-white dark:border-dark-bg">
                                                <span className="font-bold text-xs">AI</span>
                                            </div>
                                            <div className="px-4 py-3.5 rounded-2xl shadow-sm bg-white dark:bg-dark-surface border border-slate-100 dark:border-dark-border rounded-bl-sm flex items-center h-full">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce"></div>
                                                    <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                                                    <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Quick Category Bar */}
                            <div className="px-3 py-2 overflow-x-auto no-scrollbar whitespace-nowrap flex gap-1.5 shrink-0 border-t border-slate-100 dark:border-dark-border bg-white dark:bg-dark-surface">
                                {DEFAULT_CATEGORIES.map(cat => (
                                    <button 
                                        key={cat}
                                        type="button"
                                        onClick={() => handleSend(cat)}
                                        disabled={loading || isRecording}
                                        className="px-3 py-1 bg-slate-50 dark:bg-dark-bg text-brand-600 dark:text-brand-400 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold shadow-xs hover:bg-brand-50 hover:border-brand-300 dark:hover:bg-brand-900/30 transition-all shrink-0 active:scale-95 disabled:opacity-50"
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            {/* Input Form / Voice Note Deck */}
                            <form onSubmit={(e) => handleSend(undefined, e)} className="p-3 sm:p-4 bg-white dark:bg-dark-surface shrink-0 border-t border-slate-100 dark:border-dark-border shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
                                {isRecording ? (
                                    <div className="flex items-center justify-between p-3 bg-red-50/80 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl animate-fade-in shadow-inner">
                                        <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                                            <div className="relative flex items-center justify-center shrink-0">
                                                <span className="w-3.5 h-3.5 rounded-full bg-red-500 animate-ping absolute"></span>
                                                <span className="w-3 h-3 rounded-full bg-red-600 relative"></span>
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                                                        Recording Voice Note
                                                    </span>
                                                    <span className="text-xs font-mono font-bold text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40">
                                                        {30 - recordingSeconds}s remaining
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5 font-medium">
                                                    {voiceTranscript ? `"${voiceTranscript}"` : 'Listening... state your issue clearly (max 30s)'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Sound wave pulses */}
                                        <div className="hidden sm:flex items-center gap-1 px-2 shrink-0">
                                            <span className="w-1 bg-red-400 dark:bg-red-500 rounded-full animate-pulse h-4"></span>
                                            <span className="w-1 bg-red-500 dark:bg-red-400 rounded-full animate-pulse h-6" style={{ animationDelay: '150ms' }}></span>
                                            <span className="w-1 bg-red-400 dark:bg-red-500 rounded-full animate-pulse h-3" style={{ animationDelay: '300ms' }}></span>
                                            <span className="w-1 bg-red-600 dark:bg-red-300 rounded-full animate-pulse h-5" style={{ animationDelay: '450ms' }}></span>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={cancelVoiceRecording}
                                                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl transition-colors"
                                                title="Cancel recording"
                                            >
                                                <Icons.Close size={18} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => stopVoiceRecording(true)}
                                                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                                                title="Send voice note"
                                            >
                                                <Icons.Send size={14} />
                                                <span>Send Note</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative flex items-end bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700/80 rounded-2xl focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-500 overflow-hidden transition-all shadow-inner">
                                        <button 
                                            type="button"
                                            className="p-3.5 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors self-stretch border-r border-slate-200 dark:border-slate-700/80 flex items-center justify-center shrink-0"
                                            title="Helpful self-service menu"
                                            onClick={() => handleOptionClick({ label: 'Main Menu', value: 'main menu', action: 'back_main' })}
                                        >
                                            <Icons.Help size={18} />
                                        </button>
                                        <textarea 
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSend();
                                                }
                                            }}
                                            placeholder="Describe your issue, paste error details, or record a voice note..."
                                            className="w-full bg-transparent max-h-32 min-h-[50px] py-3.5 pl-3.5 pr-20 outline-none resize-none text-[14px] sm:text-[15px] text-slate-800 dark:text-slate-200 overflow-y-auto no-scrollbar font-medium placeholder-slate-400 dark:placeholder-slate-500"
                                            rows={1}
                                            disabled={loading}
                                            ref={inputRef}
                                        />
                                        <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={startVoiceRecording}
                                                disabled={loading}
                                                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-xl transition-all"
                                                title="Record 30s voice note"
                                            >
                                                <Icons.Mic size={17} />
                                            </button>
                                            <button 
                                                type="submit" 
                                                disabled={loading || !input.trim()}
                                                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-brand-600 text-white disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 hover:bg-brand-700 rounded-xl transition-all shadow-sm group"
                                                title="Send message"
                                            >
                                                <Icons.Send size={15} className="ml-0.5 group-hover:scale-110 transition-transform" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </>
                    )}

                    {view === 'ticket' && activeTicketId && (
                        <div className="flex-1 flex flex-col h-full bg-white dark:bg-dark-bg">
                            {(() => {
                                const ticketToView = (activeTicketId ? getTicket(activeTicketId) : undefined) || tickets.find(t => t.id === activeTicketId);
                                return ticketToView ? (
                                    <UserChat ticket={ticketToView} onBack={() => setView('ai_chat')} hideHeader={true} />
                                ) : null;
                            })()}
                        </div>
                    )}
                </div>
            )}

            {/* Bubble */}
            {!isOpen && (
                <button 
                    onClick={() => {
                        setIsOpen(true);
                        startChat();
                    }}
                    className="w-16 h-16 bg-gradient-to-tr from-brand-700 to-brand-500 hover:from-brand-800 hover:to-brand-600 text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 animate-pulse-halo"
                >
                    <Icons.Message size={28} />
                </button>
            )}
        </div>
    );
};
