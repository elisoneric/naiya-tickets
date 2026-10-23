import React, { useState, useMemo, useEffect } from 'react';
import { Icons } from '../common/Icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTickets } from '../../contexts/TicketContext';
import { createNewTicket } from '../../services/ticketService';
import { useToast } from '../../contexts/ToastContext';
import { COMPANY_DOMAINS, isCompanyEmail } from '../../utils/emailUtils';
import { 
    SavedWebmailCredential, 
    getLocalSavedCredentials, 
    saveLocalCredential, 
    fetchRemoteSavedCredentials 
} from '../../utils/webmailCredentials';
import { trackAction } from '../../services/storageService';

interface WebmailAssistantProps {
    onClose: () => void;
}

export const WebmailAssistant: React.FC<WebmailAssistantProps> = ({ onClose }) => {
    const { user } = useAuth();
    const { refreshTickets } = useTickets();
    const { showToast } = useToast();
    const [submitting, setSubmitting] = useState(false);
    const [copied, setCopied] = useState(false);
    const [forceResetView, setForceResetView] = useState(false);

    // Saved credentials registry
    const [savedCredentials, setSavedCredentials] = useState<SavedWebmailCredential[]>([]);

    useEffect(() => {
        setSavedCredentials(getLocalSavedCredentials());
        fetchRemoteSavedCredentials().then(creds => {
            if (creds && creds.length) setSavedCredentials(creds);
        });
    }, []);

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

    // Derive initial prefilled email from user context
    const initialValues = useMemo(() => {
        const uEmail = (user?.email || '').trim().toLowerCase();
        const aEmail = ((user as any)?.altEmail || '').trim().toLowerCase();

        for (const candidate of [uEmail, aEmail]) {
            if (candidate.includes('@')) {
                const [u, d] = candidate.split('@');
                const matchedDomain = COMPANY_DOMAINS.find(cd => cd.toLowerCase() === d.toLowerCase());
                if (matchedDomain) {
                    return { user: u, domain: matchedDomain };
                }
            }
        }
        if (uEmail && !uEmail.includes('@')) {
            return { user: uEmail, domain: 'naiyatechnology.org' as const };
        }
        return { user: '', domain: 'naiyatechnology.org' as const };
    }, [user]);

    const [username, setUsername] = useState(initialValues.user);
    const [domain, setDomain] = useState<typeof COMPANY_DOMAINS[number]>(initialValues.domain);
    const [issue, setIssue] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    // Instant auto-reset success state
    const [successResult, setSuccessResult] = useState<{
        email: string;
        password: string;
        domain: string;
    } | null>(null);

    const handleEmailInput = (val: string) => {
        setErrorMsg('');
        const trimmed = val.trim();
        if (trimmed.includes('@')) {
            const [u, d] = trimmed.split('@');
            setUsername(u.trim());
            const matched = COMPANY_DOMAINS.find(cd => cd.toLowerCase() === d.toLowerCase());
            if (matched) {
                setDomain(matched);
            } else {
                setErrorMsg(`Allowed: @${COMPANY_DOMAINS.join(', @')}`);
            }
        } else {
            setUsername(trimmed);
        }
    };

    const cleanUsername = username.trim().replace(/@.+$/, '');
    const fullEmail = cleanUsername ? `${cleanUsername}@${domain}` : '';

    // SMART AUTOMATION: Check if target email already has a saved password!
    const matchedSaved = useMemo(() => {
        if (!fullEmail) return null;
        return savedCredentials.find(c => c.email.toLowerCase() === fullEmail.toLowerCase()) || null;
    }, [fullEmail, savedCredentials]);

    // Verify if the requested address matches the agent's own active credentials
    const isOwnEmail = useMemo(() => {
        if (!user || !fullEmail) return false;
        const target = fullEmail.trim().toLowerCase();
        const userEmail = (user.email || '').trim().toLowerCase();
        const altEmail = ((user as any)?.altEmail || '').trim().toLowerCase();

        if (userEmail && userEmail === target) return true;
        if (altEmail && altEmail === target) return true;

        const targetUser = cleanUsername.toLowerCase();
        const userUser = userEmail.split('@')[0].toLowerCase();
        if (userUser && userUser.length >= 2 && userUser === targetUser) return true;

        if (user.role === 'staff' || user.role === 'admin' || user.isRoot) return true;

        return false;
    }, [user, fullEmail, cleanUsername]);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        showToast('Password copied to clipboard!', 'success');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!cleanUsername) {
            showToast('Enter webmail username', 'error');
            return;
        }

        if (!isCompanyEmail(fullEmail)) {
            showToast(`Domain must be @${COMPANY_DOMAINS.join(', @')}`, 'error');
            setErrorMsg(`Domain must be @${COMPANY_DOMAINS.join(', @')}`);
            return;
        }

        setSubmitting(true);

        // CASE 1: Own Email -> Instant Automation
        if (isOwnEmail) {
            const DIGITS = '0123456789';
            const getRandomDigits = (len: number) => {
                let res = '';
                for (let i = 0; i < len; i++) res += DIGITS.charAt(Math.floor(Math.random() * DIGITS.length));
                return res;
            };

            const prefix = domain.includes('samuiky') ? 'SAMUIKY' : (domain.includes('naiya') ? 'NAIYA' : 'CORP');
            const newPassword = `${prefix}@${getRandomDigits(6)}`;

            try {
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
                        email: cleanUsername,
                        domain,
                        password: newPassword
                    })
                });

                const data = await res.json();

                const isNotFound = data.account_not_found || 
                    (data.message && (
                        data.message.toLowerCase().includes('not found') || 
                        data.message.toLowerCase().includes('does not exist') ||
                        data.message.toLowerCase().includes('no such user') ||
                        data.message.toLowerCase().includes('unknown user') ||
                        data.message.toLowerCase().includes('cannot find')
                    ));

                if (isNotFound) {
                    // System should NOT create email, and if it doesn't exist, make no execution confirm
                    const cleanList = savedCredentials.filter(c => c.email.toLowerCase() !== fullEmail.toLowerCase());
                    setSavedCredentials(cleanList);
                    try {
                        localStorage.setItem('webmail_saved_passwords', JSON.stringify(cleanList));
                    } catch {}

                    const fallbackDesc = `Request Type: Webmail Account Not Found (Account Creation Needed)\n\nCorporate Email: ${fullEmail}\nMail Server: ${domain}\nStatus: The corporate email address does not exist on the mail server. Automated reset was aborted without execution. Corporate email accounts cannot be created through this automated flow.\n\nUser Notes: ${issue.trim() || 'None provided'}`;
                    await createNewTicket({
                        title: `Webmail Account Not Found: ${fullEmail}`,
                        category: 'WEBMAIL',
                        description: fallbackDesc,
                        createdByName: user?.name || 'User',
                        createdByEmail: user?.email || fullEmail,
                        project: domain.includes('samuiky') ? 'SAMUIKY' : 'FEP : NAIYA',
                        attachments: []
                    });
                    refreshTickets();
                    showToast(`Account does not exist on mail server. Ticket routed to IT.`, 'warning');
                    onClose();
                    return;
                }

                if (data.status === 'success' || data.cpanel_executed) {
                    // Save credential locally and sync to database ONLY when cPanel actually executed
                    const updatedList = saveLocalCredential({
                        email: fullEmail,
                        password: newPassword,
                        domain,
                        resetBy: user?.email || 'User'
                    });
                    setSavedCredentials(updatedList);

                    trackAction('webmail_resolves');
                    setSuccessResult({
                        email: fullEmail,
                        password: newPassword,
                        domain
                    });
                    setForceResetView(false);
                    showToast(`Password updated in cPanel!`, 'success');
                    return;
                } else {
                    const fallbackDesc = `Request Type: Webmail Manual Reset Required (Auto-Reset Failed)\n\nCorporate Email: ${fullEmail}\nMail Server: ${domain}\nServer Notice: ${data.message || 'cPanel server rejected auto-reset'}\n\nStatus: Automated reset could not be completed on mail server.\nAction Required: IT Staff must manually reset this mailbox password in cPanel.\n\nUser Notes: ${issue.trim() || 'None provided'}`;
                    await createNewTicket({
                        title: `Webmail Manual Reset: ${fullEmail}`,
                        category: 'WEBMAIL',
                        description: fallbackDesc,
                        createdByName: user?.name || 'User',
                        createdByEmail: user?.email || fullEmail,
                        project: domain.includes('samuiky') ? 'SAMUIKY' : 'FEP : NAIYA',
                        attachments: []
                    });
                    refreshTickets();
                    showToast('Auto-reset failed on server. Ticket opened for IT to handle manually.', 'warning');
                    onClose();
                    return;
                }
            } catch (err) {
                console.error(err);
                await createNewTicket({
                    title: `Webmail Manual Reset: ${fullEmail}`,
                    category: 'WEBMAIL',
                    description: `Request Type: Webmail Manual Reset Required (Network Error)\n\nCorporate Email: ${fullEmail}\nMail Server: ${domain}\nServer Notice: Network error connecting to mail server API.\n\nAction Required: IT Staff must manually reset this mailbox password in cPanel.\n\nUser Notes: ${issue.trim() || 'None provided'}`,
                    createdByName: user?.name || 'User',
                    createdByEmail: user?.email || fullEmail,
                    project: domain.includes('samuiky') ? 'SAMUIKY' : 'FEP : NAIYA',
                    attachments: []
                });
                refreshTickets();
                showToast('Server connection error. Ticket opened for IT to handle manually.', 'warning');
                onClose();
                return;
            } finally {
                setSubmitting(false);
            }
        }

        // CASE 2: Secondary / other email -> Submit to IT Staff
        const description = `Corporate Email: ${fullEmail}\nRequested By: ${user?.email || 'Unknown'}\nNote: ${issue.trim() || 'Password reset requested'}`;
        try {
            await createNewTicket({
                title: `Webmail Access: ${fullEmail}`,
                category: 'WEBMAIL',
                description,
                createdByName: user?.name || 'User',
                createdByEmail: user?.email || fullEmail,
                project: domain.includes('samuiky') ? 'SAMUIKY' : 'FEP : NAIYA',
                attachments: []
            });
            showToast('Ticket submitted to IT Staff.', 'success');
            refreshTickets();
            onClose();
        } catch (error) {
            console.error(error);
            showToast('Error creating ticket', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-0 sm:p-4 animate-fade-in font-sans">
            <div className="bg-surface-0 dark:bg-dark-card border border-surface-200 dark:border-dark-border w-full max-w-sm rounded-none sm:rounded-2xl shadow-modal flex flex-col overflow-hidden h-full sm:h-auto max-h-[100dvh] sm:max-h-[90vh] animate-scale-in">
                {/* Clean Header */}
                <div className="px-5 py-3.5 border-b border-surface-200 dark:border-dark-border flex justify-between items-center bg-surface-50/70 dark:bg-dark-card shrink-0">
                    <div className="flex items-center gap-2">
                        <Icons.Mail className="text-brand-600" size={18} />
                        <h2 className="text-sm font-bold text-surface-900 dark:text-dark-textPrimary">
                            Webmail Assistant
                        </h2>
                    </div>

                    <button 
                        onClick={onClose} 
                        disabled={submitting} 
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <Icons.Close size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto space-y-4">
                    {successResult ? (
                        /* SUCCESS RESULT */
                        <div className="space-y-3.5 text-center py-1">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                                <Icons.Check size={20} />
                            </div>

                            <div>
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                    Password Reset Complete
                                </h3>
                                <p className="text-xs text-gray-400 font-mono mt-0.5">
                                    {successResult.email}
                                </p>
                            </div>

                            <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-black/30 border border-emerald-300 dark:border-emerald-700/50 rounded-xl px-3 py-2">
                                <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
                                    {successResult.password}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleCopy(successResult.password)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                >
                                    {copied ? <Icons.Check size={12} /> : <Icons.Lock size={12} />}
                                    <span>{copied ? 'Copied' : 'Copy'}</span>
                                </button>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <a
                                    href={`https://${successResult.domain}/webmail`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl transition-colors text-center"
                                >
                                    Open Webmail
                                </a>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white font-bold text-xs rounded-xl transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    ) : (matchedSaved && !forceResetView) ? (
                        /* SMART AUTOMATION: If already saved, immediately put out the password! */
                        <div className="space-y-3 py-1 animate-fade-in">
                            <div>
                                <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">
                                    Your Webmail Account
                                </span>
                                <div className="font-mono text-sm font-bold text-gray-900 dark:text-white">
                                    {matchedSaved.email}
                                </div>
                            </div>

                            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-black/30 border border-emerald-300 dark:border-emerald-700/50 space-y-2">
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-emerald-700 dark:text-emerald-400 font-bold uppercase text-[10px]">
                                        Active Password
                                    </span>
                                    <span className="text-gray-400 text-[10px]">
                                        Reset: {new Date(matchedSaved.resetAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
                                        {matchedSaved.password}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(matchedSaved.password)}
                                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                    >
                                        {copied ? <Icons.Check size={12} /> : <Icons.Lock size={12} />}
                                        <span>{copied ? 'Copied' : 'Copy'}</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <a
                                    href={`https://${matchedSaved.domain}/webmail`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl transition-colors text-center"
                                >
                                    Open Webmail
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setForceResetView(true)}
                                    className="px-3 py-2 text-xs font-semibold text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                                >
                                    Reset New
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* RESET FORM */
                        <form onSubmit={handleSubmit} className="space-y-3.5">
                            <div>
                                <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block mb-1">
                                    Corporate Email
                                </label>

                                <div className="flex rounded-xl shadow-sm border border-gray-200 dark:border-white/15 overflow-hidden focus-within:ring-2 focus-within:ring-brand-500 bg-white dark:bg-black/20">
                                    <input 
                                        required
                                        type="text"
                                        value={username}
                                        onChange={e => handleEmailInput(e.target.value)}
                                        className="flex-1 px-3 py-2 text-sm font-mono text-gray-900 dark:text-white bg-transparent outline-none"
                                        placeholder="username"
                                    />
                                    <div className="flex items-center px-2 bg-gray-100 dark:bg-white/5 border-l border-gray-200 dark:border-white/10 text-gray-500 font-bold text-xs">
                                        @
                                    </div>
                                    <select 
                                        value={domain}
                                        onChange={e => {
                                            setDomain(e.target.value as typeof COMPANY_DOMAINS[number]);
                                            setErrorMsg('');
                                        }}
                                        className="px-2.5 py-2 bg-gray-50 dark:bg-[#1f242c] text-xs font-semibold text-gray-800 dark:text-gray-200 border-l border-gray-200 dark:border-white/10 outline-none cursor-pointer"
                                    >
                                        {COMPANY_DOMAINS.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>

                                {errorMsg && (
                                    <p className="text-xs text-red-500 font-semibold mt-1">{errorMsg}</p>
                                )}
                            </div>

                            {!isOwnEmail && (
                                <div>
                                    <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block mb-1">
                                        Note (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={issue}
                                        onChange={e => setIssue(e.target.value)}
                                        placeholder="e.g. Password reset requested"
                                        className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-gray-900 dark:text-white outline-none"
                                    />
                                </div>
                            )}

                            <div className="pt-1">
                                <button
                                    type="submit"
                                    disabled={submitting || !cleanUsername}
                                    className={`w-full py-2.5 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 ${
                                        isOwnEmail
                                            ? 'bg-emerald-600 hover:bg-emerald-700'
                                            : 'bg-brand-600 hover:bg-brand-700'
                                    }`}
                                >
                                    {submitting ? (
                                        <>
                                            <Icons.Refresh size={14} className="animate-spin" />
                                            <span>Resetting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Icons.Mail size={14} />
                                            <span>{isOwnEmail ? 'Auto-Reset Password' : 'Submit Ticket to IT'}</span>
                                        </>
                                    )}
                                </button>

                                {matchedSaved && forceResetView && (
                                    <button
                                        type="button"
                                        onClick={() => setForceResetView(false)}
                                        className="w-full mt-2 text-center text-xs text-gray-400 hover:text-gray-600"
                                    >
                                        Cancel & keep current password
                                    </button>
                                )}
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
