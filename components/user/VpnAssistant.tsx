import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Icons } from '../common/Icons';
import { ProjectType } from '../../types';
import { trackAction } from '../../services/storageService';

const MAIL_API_URL = import.meta.env?.VITE_MAIL_API_URL || '/backend/mail_handler.php';

interface VpnAssistantProps {
    project: ProjectType;
    onClose: () => void;
    onRevertToManual: (description: string, autoSubmit?: boolean, category?: string) => void;
    isDisabled?: boolean;
    disabledMessage?: string;
}

type VpnFlowState = 'loading' | 'active_vpn' | 'no_password_yet' | 'no_vpn' | 'troubleshooting_checks' | 'referee_dashboard';

export const VpnAssistant: React.FC<VpnAssistantProps> = ({ onClose, onRevertToManual, isDisabled, disabledMessage }) => {
    const { user, loading: authLoading } = useAuth();
    const { showToast } = useToast();
    const [flowState, setFlowState] = useState<VpnFlowState>('loading');
    
    const [vpnUsername, setVpnUsername] = useState('');
    const [vpnPassword, setVpnPassword] = useState('');
    const [swapCount, setSwapCount] = useState(0);
    const [isDiverted, setIsDiverted] = useState(false);
    
    // For claim flow
    const [inputUsername, setInputUsername] = useState('');
    const [claiming, setClaiming] = useState(false);

    // For troubleshooting
    const [checks, setChecks] = useState({ restart: false, capsLock: false });
    const [isSendingEmail, setIsSendingEmail] = useState(false);

    const [roster, setRoster] = useState<Array<{email: string, username: string, password: string}>>([]);
    const [isSendingRosterEmail, setIsSendingRosterEmail] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    useEffect(() => {
        if (authLoading) return;
        if (!user || typeof user.email !== 'string' || user.email.trim() === '') {
            return;
        }
        checkVpnStatus(user.email);
    }, [user, authLoading]);

    const checkVpnStatus = async (email: string) => {
        try {
            // 1. Force lowercase and remove any accidental spaces from the session data
            const rawEmail = email.toLowerCase().trim();
            
            // 2. Safely encode it for transmission in a GET query string
            const safeEmailParam = encodeURIComponent(rawEmail);
            
            // 3. Build URL to backend proxy
            const API_URL = import.meta.env?.VITE_API_URL || '/backend/api.php';
            const apiUrl = `${API_URL}?action=check_vpn_status&email=${safeEmailParam}`;
            console.log("FINAL CONSTRUCTED URL:", apiUrl);

            const res = await fetch(apiUrl);

            if (res.status === 404) {
                // Gate 3: Verbose Error Handling
                try {
                    const errorResponseData = await res.json();
                    console.error("API 404 Data:", errorResponseData);
                } catch (e) {
                    console.error("API 404 Data: (Failed to parse JSON response)");
                }
                setFlowState('no_vpn');
                return;
            }
            
            if (!res.ok) {
                // If it fails, fallback to standard ticket creation or error
                showToast('Failed to connect to VPN Hub. Please submit a standard ticket.', 'error');
                return;
            }

            const data = await res.json();
            
            if (data.swap_count !== undefined) {
                setSwapCount(data.swap_count);
            }
            
            if (data.status === 'password_ready') {
                setVpnUsername(data.username);
                setVpnPassword(data.password);
                setIsDiverted(false);
                setFlowState('active_vpn');
            } else if (data.status === 'empty_password') {
                setVpnUsername(data.username || '');
                setFlowState('no_password_yet');
            } else if (data.status === 'referee_dashboard') {
                setRoster(data.roster || []);
                setFlowState('referee_dashboard');
            } else {
                setFlowState('no_vpn');
            }
        } catch (err) {
            console.error(err);
            setFlowState('no_vpn'); // Fallback on hard catch errors
            showToast('VPN Hub connection error or parsing failed.', 'error');
        }
    };

    const claimTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (claimTimerRef.current) clearInterval(claimTimerRef.current);
        };
    }, []);

    const handleClaim = async () => {
        if (!inputUsername.trim()) return;
        // === LOCKDOWN GUARD ===
        if (isDisabled) {
            showToast(disabledMessage || 'VPN service is temporarily unavailable.', 'error');
            return;
        }
        // === END LOCKDOWN GUARD ===
        setClaiming(true);
        try {
            const cleanEmail = user?.email?.trim().toLowerCase() || '';
            const cleanUsername = inputUsername.trim();
            const res = await fetch('https://vpn.naiyatechnology.org/api/vpn/claim', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer GCTj-kfp8-G@Ph`
                },
                body: JSON.stringify({ email: cleanEmail, username: cleanUsername })
            });

            if (res.status === 404) {
                const desc = `Automated Report: User attempted to claim VPN username '${cleanUsername}', but it was not found in the database.`;
                showToast('We could not find that VPN username in the database.', 'error');
                
                // Show countdown before auto-redirecting
                let countdown = 5;
                claimTimerRef.current = setInterval(() => {
                    countdown--;
                    if (countdown <= 0) {
                        if (claimTimerRef.current) clearInterval(claimTimerRef.current);
                        onRevertToManual(desc, true);
                        onClose();
                        window.dispatchEvent(new CustomEvent('open-support-chat'));
                    } else {
                        showToast(`Redirecting to support in ${countdown}s...`, 'info');
                    }
                }, 1000);
                
                return;
            }

            if (res.status === 403) {
                // Conflict
                const desc = `Automated Report: VPN Conflict: Username '${cleanUsername}' is already registered to another user. Please verify.`;
                showToast('Username conflict detected.', 'info');
                
                // Show countdown before auto-redirecting
                let countdown = 5;
                claimTimerRef.current = setInterval(() => {
                    countdown--;
                    if (countdown <= 0) {
                        if (claimTimerRef.current) clearInterval(claimTimerRef.current);
                        onRevertToManual(desc, true);
                        onClose();
                        window.dispatchEvent(new CustomEvent('open-support-chat'));
                    } else {
                        showToast(`Redirecting to support in ${countdown}s...`, 'info');
                    }
                }, 1000);
                
                return;
            }

            if (!res.ok) {
                showToast('Failed to claim VPN. Please try again.', 'error');
                return;
            }

            const data = await res.json();
            setVpnPassword(data.password || data.vpnPassword || '');
            setVpnUsername(data.username || cleanUsername);
            
            if (data.note === "crisis_divert") {
                setIsDiverted(true);
                showToast('Assigned a temporary working VPN!', 'info');
            } else {
                setIsDiverted(false);
                showToast('VPN claimed successfully!', 'success');
            }
            trackAction('vpn_resolves');
            setFlowState('active_vpn');
        } catch (err) {
            console.error(err);
            showToast('Error claiming VPN', 'error');
        } finally {
            setClaiming(false);
        }
    };

    const sendEmail = async () => {
        setIsSendingEmail(true);
        
        const payload = {
            to: user?.email, // The logged-in user's email
            subject: "Your NAIYA VPN Credentials",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Your NAIYA VPN Details</h2>
                    <p>As requested, here are your current VPN credentials:</p>
                    <p><strong>Username:</strong> ${vpnUsername}</p>
                    <p><strong>Password:</strong> ${vpnPassword}</p>
                    <br/>
                    <p>If you have any issues connecting, please return to the ticketing system to report a broken connection.</p>
                </div>
            `
        };

        try {
            const response = await fetch(MAIL_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    to: payload.to,
                    subject: payload.subject,
                    body: payload.html
                })
            });

            const data = await response.json();

            if (data.status === 'success' || data.success === true) {
                showToast('Email sent successfully!', 'success');
            } else {
                console.error("Mail error:", data.message || data.error);
                showToast(data.message || data.error || 'Failed to send email.', 'error');
            }
        } catch (error) {
            console.error("Network error sending email:", error);
            showToast('Network error sending email.', 'error');
        } finally {
            setIsSendingEmail(false);
        }
    };

    const handleCopyRoster = async () => {
        const text = roster.map(r => `Agent: ${r.email} | VPN: ${r.username} | Pass: ${r.password}`).join('\n');
        try {
            await navigator.clipboard.writeText(text);
            showToast('Copied!', 'success');
        } catch (err) {
            showToast('Failed to copy to clipboard', 'error');
        }
    };

    const handleSendRosterEmail = async () => {
        setIsSendingRosterEmail(true);
        const htmlRoster = roster.map(r => `
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${r.email}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${r.username}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${r.password}</td>
            </tr>
        `).join('');

        const payload = {
            to: user?.email,
            subject: "Your Team VPN Roster",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Here is your current team roster</h2>
                    <table style="border-collapse: collapse; width: 100%;">
                        <thead>
                            <tr style="background-color: #f4f4f4;">
                                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Agent Email</th>
                                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Username</th>
                                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Password</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${htmlRoster}
                        </tbody>
                    </table>
                </div>
            `
        };
        
        try {
            const response = await fetch(MAIL_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    to: payload.to,
                    subject: payload.subject,
                    body: payload.html
                })
            });
            const data = await response.json();
            if (data.status === 'success' || data.success === true) {
                showToast('Email sent successfully!', 'success');
            } else {
                console.error("Mail error:", data.message || data.error);
                showToast(data.message || data.error || 'Failed to send email.', 'error');
            }
        } catch (error) {
            console.error("Network error sending email:", error);
            showToast('Network error sending email.', 'error');
        } finally {
            setIsSendingRosterEmail(false);
        }
    };

    const ChatBubble = ({ type, text }: { type: 'system' | 'user', text: React.ReactNode }) => (
        <div className={`flex w-full ${type === 'user' ? 'justify-end' : 'justify-start'} mb-4 animate-fade-in-up`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                type === 'user' 
                ? 'bg-brand-600 text-white rounded-br-sm' 
                : 'bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-gray-200 rounded-bl-sm'
            }`}>
                {text}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-0 sm:p-6 animate-fade-in font-sans">
            <div className="bg-surface-0 dark:bg-dark-card border border-surface-200 dark:border-dark-border w-full max-w-lg rounded-none sm:rounded-2xl shadow-modal flex flex-col overflow-hidden h-full sm:h-auto max-h-[100dvh] sm:max-h-[90vh] animate-scale-in">
                <div className="px-6 py-4 border-b border-surface-200 dark:border-dark-border flex justify-between items-center bg-surface-50/70 dark:bg-dark-card shrink-0">
                    <h2 className="text-lg sm:text-xl font-bold text-surface-900 dark:text-dark-textPrimary flex items-center gap-2">
                        <Icons.Shield className="text-brand-600" />
                        VPN Assistant
                    </h2>
                    <button onClick={onClose} className="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-dark-textPrimary hover:bg-surface-100 dark:hover:bg-dark-hover rounded-lg transition-colors" title="Close (Esc)">
                        <Icons.Close size={20} />
                    </button>
                </div>
                <div className="flex flex-col flex-1 bg-white dark:bg-dark-bg p-4 overflow-y-auto">
                {/* === MAINTENANCE MODE SCREEN === */}
                    {isDisabled && (
                        <div className="flex flex-col items-center justify-center flex-1 text-center p-8 space-y-5">
                            <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <Icons.Settings size={36} className="text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">VPN Service — Under Maintenance</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs mx-auto">
                                    {disabledMessage || 'The VPN service is temporarily unavailable. Please check back later.'}
                                </p>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-4 w-full max-w-xs text-left">
                                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">What's blocked:</p>
                                <ul className="text-xs text-amber-600 dark:text-amber-400/80 space-y-0.5">
                                    <li>• Credential lookup</li>
                                    <li>• Ticket escalation</li>
                                    <li>• AI routing to VPN support</li>
                                </ul>
                            </div>
                            <button onClick={onClose} className="mt-2 px-6 py-2.5 bg-gray-800 dark:bg-white/10 text-white font-semibold rounded-xl text-sm hover:bg-gray-700 dark:hover:bg-white/20 transition-colors">
                                Close
                            </button>
                        </div>
                    )}
                    {/* === END MAINTENANCE MODE === */}

                    {!isDisabled && flowState === 'loading' && (
                        <div className="flex flex-col items-center justify-center flex-1 space-y-4">
                            <Icons.Refresh className="animate-spin text-brand-600" size={32} />
                            <p className="text-gray-500 font-medium">Connecting to NAIYA VPN HUB...</p>
                        </div>
                    )}

                    {flowState === 'active_vpn' && (
                        <div className="flex-1">
                            <ChatBubble type="system" text={<>I found your verified VPN credentials in the system!</>} />
                            
                            {isDiverted && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 p-4 rounded-xl mb-6 text-amber-800 dark:text-amber-200 text-sm font-medium">
                                    <div className="flex gap-2">
                                        <Icons.Alert size={20} className="shrink-0" />
                                        <div>
                                            Notice: Your requested VPN username is currently undergoing maintenance. We have automatically assigned you a new, temporary working VPN so you can continue your shift.
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Credentials Card */}
                            <div className="bg-gray-50 dark:bg-dark-surface p-4 rounded-xl border border-gray-200 dark:border-dark-border mb-4">
                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200/60 dark:border-white/5">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Active Credentials</span>
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center gap-1">
                                        <Icons.Check size={11} /> Gateway Verified
                                    </span>
                                </div>

                                <div className="mb-3">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Username</span>
                                    <div className="flex items-center gap-2">
                                        <div className="font-mono bg-white dark:bg-black/20 px-3 py-2 rounded-lg text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-white/5 flex-1 select-all font-semibold">
                                            {vpnUsername}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText(vpnUsername);
                                                showToast('Username copied!', 'success');
                                            }}
                                            className="px-3 py-2 bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-200 transition-colors"
                                            title="Copy Username"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Password</span>
                                    <div className="flex items-center gap-2">
                                        <div className="font-mono bg-white dark:bg-black/20 px-3 py-2 rounded-lg text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-white/5 flex-1 select-all font-semibold">
                                            {vpnPassword}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText(vpnPassword);
                                                showToast('Password copied! Ensure zero spaces.', 'success');
                                            }}
                                            className="px-3 py-2 bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-200 transition-colors"
                                            title="Copy Password"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>

                                <button 
                                    onClick={sendEmail}
                                    disabled={isSendingEmail}
                                    className="w-full py-2 bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-xs"
                                >
                                    {isSendingEmail ? (
                                        <><Icons.Refresh className="animate-spin" size={14} /> Sending to email...</>
                                    ) : (
                                        <><Icons.Inbox className="rotate-180" size={14} /> Backup: Send to my Email</>
                                    )}
                                </button>
                            </div>

                            {/* MTN Network Recommendation & Policy Banner */}
                            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 p-3.5 rounded-xl mb-4 text-xs">
                                <div className="flex items-start gap-2.5">
                                    <Icons.Info size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-amber-900 dark:text-amber-200">
                                            All VPN Accounts Are Verified & Working — Self-Swaps Disabled
                                        </p>
                                        <p className="text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                                            • Connect exclusively using an <strong>MTN network or mobile hotspot</strong>.<br />
                                            • Double-check password (ensure <strong>no spaces</strong>) and Caps Lock is <strong>OFF</strong>.<br />
                                            • Verify physical machine keyboard layout is <strong>US-English</strong>.<br />
                                            • Only human IT Staff can authorize or perform credential swaps.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* User Satisfaction / Complain Decision Gate */}
                            <div className="bg-slate-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-3.5 rounded-xl mb-4">
                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2.5">
                                    Did this VPN resolve your connection?
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            showToast('Glad your VPN is working! Have a productive session.', 'success');
                                            onClose();
                                        }}
                                        className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                                    >
                                        <Icons.Check size={14} /> Yes, Satisfied
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onClose();
                                            window.dispatchEvent(new CustomEvent('open-support-chat', {
                                                detail: { initialMessage: `I am trying to connect to VPN '${vpnUsername}' but it is not working. I need help troubleshooting.` }
                                            }));
                                        }}
                                        className="py-2 px-3 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                    >
                                        <Icons.Alert size={14} /> Having Issues / Complain
                                    </button>
                                </div>
                            </div>

                            {/* Pre-Checks & Escalation */}
                            <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-4 mb-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                    <Icons.Settings size={14} className="text-slate-500" /> Quick Pre-Checks
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                    Please confirm before escalating to IT:
                                </p>
                                
                                <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={checks.restart}
                                            onChange={e => setChecks(prev => ({ ...prev, restart: e.target.checked }))}
                                            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                        />
                                        <span>I verified my internet connection (tested on <strong>MTN network/hotspot</strong> or verified stable data).</span>
                                    </label>

                                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={checks.capsLock}
                                            onChange={e => setChecks(prev => ({ ...prev, capsLock: e.target.checked }))}
                                            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                        />
                                        <span>I copied the password directly with <strong>no spaces</strong> and verified Caps Lock is OFF.</span>
                                    </label>
                                </div>

                                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 flex flex-col gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onRevertToManual(`VPN Connection Escalation:\nUser verified MTN network connection and password accuracy for VPN '${vpnUsername}'. Connection issue persists. Escalating to IT for assistance.`, true);
                                            onClose();
                                        }}
                                        disabled={!checks.restart || !checks.capsLock}
                                        className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                                    >
                                        <Icons.Send size={14} /> Escalate to IT Support
                                    </button>
                                    <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center leading-relaxed">
                                        All VPNs are gateway-verified. If your connection fails after pre-checks, IT staff will assist you.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {flowState === 'referee_dashboard' && (
                        <div className="flex-1 flex flex-col h-full animate-fade-in">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Your Team's VPN Roster</h2>
                            
                            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-xl mb-6 text-sm">
                                You can manage your agents, view complete details, or request additional VPNs by logging into the <a href="https://vpn.naiyatechnology.org" target="_blank" rel="noopener noreferrer" className="font-bold underline">NAIYA VPN Management Hub</a>.
                            </div>

                            <div className="flex-1 overflow-auto mb-6 bg-gray-50 dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border shadow-sm">
                                <table className="w-full text-left text-sm min-w-max">
                                    <thead className="bg-gray-100 dark:bg-white/5 text-gray-500 uppercase font-semibold text-xs tracking-wider">
                                        <tr>
                                            <th className="px-4 py-3 border-b border-gray-200 dark:border-white/5">Agent Email</th>
                                            <th className="px-4 py-3 border-b border-gray-200 dark:border-white/5">Username</th>
                                            <th className="px-4 py-3 border-b border-gray-200 dark:border-white/5">Password</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                        {roster.map((r, i) => (
                                            <tr key={i} className="hover:bg-white dark:hover:bg-white/5 transition-colors">
                                                <td className="px-4 py-3 text-slate-800 dark:text-gray-200 whitespace-nowrap">{r.email}</td>
                                                <td className="px-4 py-3 font-mono text-slate-600 dark:text-gray-400">{r.username || <span className="text-gray-400 italic">Not assigned</span>}</td>
                                                <td className="px-4 py-3 font-mono text-slate-600 dark:text-gray-400">{r.password || <span className="text-gray-400 italic">Not available</span>}</td>
                                            </tr>
                                        ))}
                                        {roster.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="px-4 py-8 text-center text-gray-500 bg-white dark:bg-transparent">No agents currently in your roster.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex gap-3 shrink-0 flex-col sm:flex-row mt-auto">
                                <button 
                                    onClick={handleCopyRoster}
                                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-xl font-semibold transition-colors flex justify-center items-center gap-2"
                                >
                                    Copy All to Clipboard
                                </button>
                                <button 
                                    onClick={handleSendRosterEmail}
                                    disabled={isSendingRosterEmail}
                                    className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isSendingRosterEmail ? (
                                        <><Icons.Refresh className="animate-spin" size={18} /> Sending...</>
                                    ) : (
                                        <><Icons.Inbox className="rotate-180" size={18} /> Send Roster via Email</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {flowState === 'no_password_yet' && (
                        <div className="flex-1">
                            <ChatBubble type="system" text={<>Your password has not been updated yet following the recent system reset.</>} />
                            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-4 rounded-xl mb-6">
                                <div className="mb-2">
                                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest block mb-1">Username</span>
                                    <div className="font-mono bg-white dark:bg-black/20 px-3 py-2 rounded text-slate-800 dark:text-slate-200 border border-amber-100 dark:border-amber-800/30">{vpnUsername}</div>
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    const desc = `Automated Report: Missing VPN password after system reset for username: ${vpnUsername}`;
                                    onRevertToManual(desc, true);
                                    onClose();
                                }}
                                className="w-full mt-4 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold transition-colors"
                            >
                                Notify IT
                            </button>
                        </div>
                    )}

                    {flowState === 'no_vpn' && (
                        <div className="flex-1">
                            <ChatBubble type="system" text={<>We could not find a VPN linked to your email.</>} />
                            <div className="bg-white dark:bg-dark-surface p-4 rounded-xl border border-gray-200 dark:border-dark-border mt-4">
                                <label className="text-sm font-semibold text-gray-800 dark:text-white mb-2 block">Enter your VPN Username to claim it:</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={inputUsername}
                                        onChange={(e) => setInputUsername(e.target.value.replace(/\s/g, ''))}
                                        onBlur={() => setInputUsername(inputUsername.trim())}
                                        className="flex-1 p-3 border border-gray-200 dark:border-dark-border rounded-xl bg-white dark:bg-dark-surface dark:text-white outline-none focus:border-brand-500"
                                        placeholder="Username"
                                        disabled={claiming}
                                    />
                                    <button 
                                        onClick={handleClaim}
                                        disabled={claiming || !inputUsername.trim()}
                                        className="px-6 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl font-bold transition-colors"
                                    >
                                        {claiming ? <Icons.Refresh className="animate-spin" size={20} /> : 'Submit'}
                                    </button>
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => {
                                    const desc = `Automated Report: User does not have or forgot their VPN username.`;
                                    onRevertToManual(desc, true);
                                    onClose();
                                }}
                                className="w-full mt-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 text-gray-800 dark:text-gray-200 rounded-xl font-bold transition-colors"
                            >
                                I don't have a username / I forgot it
                            </button>
                        </div>
                    )}

                    {flowState === 'troubleshooting_checks' && (
                        <div className="flex-1">
                            <ChatBubble type="system" text={<>Please confirm your pre-checks before escalating to IT:</>} />
                            <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-4 mt-2 space-y-4">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={checks.capsLock} onChange={e => setChecks({...checks, capsLock: e.target.checked})} className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-600" />
                                    <span className="text-gray-700 dark:text-gray-300">Is Caps Lock turned OFF (no spaces in password)?</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={checks.restart} onChange={e => setChecks({...checks, restart: e.target.checked})} className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-600" />
                                    <span className="text-gray-700 dark:text-gray-300">Did you verify internet on MTN network or stable data?</span>
                                </label>
                            </div>
                            <button 
                                onClick={() => {
                                    onRevertToManual(`VPN Connection Escalation:\nUser verified MTN connection and password accuracy for VPN '${vpnUsername}'. Connection issue persists. Escalating to IT support.`, true);
                                    onClose();
                                }}
                                disabled={!checks.restart || !checks.capsLock}
                                className="w-full mt-6 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                            >
                                <Icons.Send size={18} /> Confirm & Escalate to IT
                            </button>
                            <button onClick={() => setFlowState('active_vpn')} className="w-full mt-3 py-3 bg-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-bold transition-colors">
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
