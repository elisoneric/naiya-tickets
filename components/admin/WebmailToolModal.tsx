import React, { useState, useEffect, useMemo } from 'react';
import { Icons } from '../common/Icons';
import { useToast } from '../../contexts/ToastContext';
import { useTickets } from '../../contexts/TicketContext';
import { useAuth } from '../../contexts/AuthContext';
import { createNewTicket } from '../../services/ticketService';
import { 
    SavedWebmailCredential, 
    getLocalSavedCredentials, 
    saveLocalCredential, 
    fetchRemoteSavedCredentials 
} from '../../utils/webmailCredentials';
import { trackAction } from '../../services/storageService';

interface WebmailToolModalProps {
    email: string;
    ticketId?: string;
    onClose: () => void;
    onInsertReply?: (text: string) => void;
}

const COMPANY_DOMAINS = [
    'naiyatechnology.org',
    'naiyatech.com.ng',
    'samuikyglobal.com.ng'
] as const;

type CompanyDomain = typeof COMPANY_DOMAINS[number];

interface DomainConfigItem {
    host: string;
    user: string;
    has_token: boolean;
    source?: string;
}

export const WebmailToolModal: React.FC<WebmailToolModalProps> = ({
    email,
    ticketId,
    onClose,
    onInsertReply
}) => {
    const { user } = useAuth();
    const { refreshTickets } = useTickets();
    const { showToast } = useToast();
    const [isCreatingTicket, setIsCreatingTicket] = useState(false);
    const API_URL = (import.meta as any).env?.VITE_API_URL || '/backend/api.php';

    // Tabs: 'tool' | 'domain_setup'
    const [activeTab, setActiveTab] = useState<'tool' | 'domain_setup'>('tool');

    // Parse initial email & domain
    const parseEmail = (raw: string): { user: string; domain: CompanyDomain } => {
        const clean = (raw || '').trim().toLowerCase();
        if (clean.includes('@')) {
            const [u, d] = clean.split('@');
            const matchedDomain = COMPANY_DOMAINS.find(cd => cd === d);
            return {
                user: u,
                domain: matchedDomain || 'naiyatechnology.org'
            };
        }
        return {
            user: clean,
            domain: 'naiyatechnology.org'
        };
    };

    const initialParsed = parseEmail(email);
    const [username, setUsername] = useState(initialParsed.user);
    const [domain, setDomain] = useState<CompanyDomain>(initialParsed.domain);
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [apiResult, setApiResult] = useState<{
        status: 'success' | 'warning' | 'error';
        message: string;
        accountNotFound?: boolean;
        hostCalled?: string;
        userCalled?: string;
        credentialSource?: string;
    } | null>(null);
    const [copied, setCopied] = useState(false);

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
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Domain Configurations State
    const [domainConfigs, setDomainConfigs] = useState<Record<string, DomainConfigItem>>({});
    const [setupSelectedDomain, setSetupSelectedDomain] = useState<CompanyDomain>('naiyatechnology.org');
    const [setupHost, setSetupHost] = useState('');
    const [setupUser, setSetupUser] = useState('');
    const [setupToken, setSetupToken] = useState('');
    const [savingConfig, setSavingConfig] = useState(false);

    const fetchDomainConfigs = async () => {
        try {
            const headers: Record<string, string> = {};
            const storedUser = localStorage.getItem('app_user');
            if (storedUser) {
                const u = JSON.parse(storedUser);
                if (u?.token) headers['Authorization'] = `Bearer ${u.token}`;
            }

            const res = await fetch(`${API_URL}?action=get_cpanel_domain_configs`, { headers });
            const data = await res.json();
            if (data.status === 'success' && data.domains) {
                setDomainConfigs(data.domains);
                const current = data.domains[setupSelectedDomain];
                if (current) {
                    setSetupHost(current.host || '');
                    setSetupUser(current.user || '');
                }
            }
        } catch {}
    };

    useEffect(() => {
        fetchDomainConfigs();
    }, []);

    useEffect(() => {
        const conf = domainConfigs[setupSelectedDomain];
        if (conf) {
            setSetupHost(conf.host || `https://${setupSelectedDomain}:2083`);
            setSetupUser(conf.user || '');
            setSetupToken('');
        } else {
            setSetupHost(`https://${setupSelectedDomain}:2083`);
            setSetupUser('');
            setSetupToken('');
        }
    }, [setupSelectedDomain, domainConfigs]);

    const handleSaveDomainConfig = async () => {
        if (!setupUser.trim()) {
            showToast('Enter cPanel username', 'error');
            return;
        }

        setSavingConfig(true);
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            const storedUser = localStorage.getItem('app_user');
            if (storedUser) {
                const u = JSON.parse(storedUser);
                if (u?.token) headers['Authorization'] = `Bearer ${u.token}`;
            }

            const res = await fetch(`${API_URL}?action=update_cpanel_domain_configs`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    domain: setupSelectedDomain,
                    host: setupHost.trim() || `https://${setupSelectedDomain}:2083`,
                    user: setupUser.trim(),
                    token: setupToken.trim()
                })
            });

            const data = await res.json();
            if (data.status === 'success') {
                showToast(`Credentials saved for ${setupSelectedDomain}`, 'success');
                setSetupToken('');
                await fetchDomainConfigs();
            } else {
                showToast(data.message || 'Failed to update domain configuration', 'error');
            }
        } catch {
            showToast('Network error saving configuration', 'error');
        } finally {
            setSavingConfig(false);
        }
    };

    const generatePassword = (type: 'random' | 'naiya' | 'samuiky' = 'random') => {
        const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const digits = '0123456789';
        const getDigits = (len: number) => {
            let res = '';
            for (let i = 0; i < len; i++) res += digits.charAt(Math.floor(Math.random() * digits.length));
            return res;
        };
        const getLetters = (len: number) => {
            let res = '';
            for (let i = 0; i < len; i++) res += letters.charAt(Math.floor(Math.random() * letters.length));
            return res;
        };

        let generated = '';
        if (type === 'naiya') {
            generated = `NAIYA@${getDigits(6)}`;
        } else if (type === 'samuiky') {
            generated = `SAMUIKY@${getDigits(6)}`;
        } else {
            generated = `${getLetters(6)}@${getDigits(6)}`;
        }

        setPassword(generated);
        setApiResult(null);
    };

    const cleanUser = username.trim().replace(/@.+$/, '');
    const fullEmail = cleanUser ? `${cleanUser}@${domain}` : `@${domain}`;

    // SMART AUTOMATION: If a saved password exists for this email, put it out immediately!
    const matchedSaved = useMemo(() => {
        if (!cleanUser) return null;
        return savedCredentials.find(c => c.email.toLowerCase() === fullEmail.toLowerCase()) || null;
    }, [fullEmail, cleanUser, savedCredentials]);

    // On email change or savedCredentials load, automatically populate saved password if one exists!
    useEffect(() => {
        if (matchedSaved && matchedSaved.password) {
            setPassword(matchedSaved.password);
        } else if (!password) {
            generatePassword(domain.includes('samuiky') ? 'samuiky' : 'random');
        }
    }, [fullEmail, matchedSaved]);

    const isPasswordSaved = !!(matchedSaved && matchedSaved.password && matchedSaved.password === password);

    const passwordValidation = useMemo(() => {
        if (!password) return { isValid: false, reason: 'Password cannot be empty' };
        const illegalChars = password.match(/[^A-Z0-9@]/g);
        if (illegalChars) {
            return { isValid: false, reason: 'Only uppercase letters, @, and numbers allowed' };
        }
        if (!password.includes('@')) return { isValid: false, reason: "Must include '@'" };
        if (!/[A-Z]/.test(password)) return { isValid: false, reason: 'Must include uppercase letter' };
        if (!/[0-9]/.test(password)) return { isValid: false, reason: 'Must include number' };
        if (password.length < 8) return { isValid: false, reason: 'Minimum 8 characters' };
        return { isValid: true, reason: 'Valid' };
    }, [password]);

    const handleUsernameChange = (val: string) => {
        const trimmed = val.trim();
        if (trimmed.includes('@')) {
            const [u, d] = trimmed.split('@');
            setUsername(u);
            const matched = COMPANY_DOMAINS.find(cd => cd.toLowerCase() === d.toLowerCase());
            if (matched) setDomain(matched);
        } else {
            setUsername(trimmed);
        }
        setApiResult(null);
    };

    const handleCopyPassword = () => {
        if (!password) return;
        navigator.clipboard.writeText(password);
        setCopied(true);
        showToast('Password copied!', 'success');
        setTimeout(() => setCopied(false), 2000);
    };

    const saveAndRecordCredential = (pwd: string) => {
        const updated = saveLocalCredential({
            email: fullEmail,
            password: pwd,
            domain,
            resetBy: 'IT Staff'
        });
        setSavedCredentials(updated);
    };

    // Insert reply directly without re-resetting if already saved!
    const handleInsertExistingReply = () => {
        if (!onInsertReply || !password) return;
        const replyTemplate = `Hello, here is your Webmail password:

• Email: ${fullEmail}
• Password: ${password}
• Webmail URL: https://${domain}/webmail

Advise:
• Use CAPITAL letters and @, no extra spaces.`;

        onInsertReply(replyTemplate);
        navigator.clipboard.writeText(password);
        trackAction('webmail_resolves');
        showToast('Saved password copied & inserted into reply!', 'success');
        onClose();
    };

    const getAccountNotFoundReply = () => {
        return `Hello,

The corporate email address "${fullEmail}" does not exist on our mail server (${domain}).

Our support system cannot reset passwords for non-existent accounts, and corporate email accounts cannot be created through this automated flow.

Please verify the spelling of your email address with your team lead or contact your administrator to request mailbox creation.`;
    };

    const handleInsertNotFoundReply = () => {
        if (!onInsertReply) return;
        onInsertReply(getAccountNotFoundReply());
        showToast('Custom "Account Not Found" reply inserted into draft!', 'info');
        onClose();
    };

    // Execute full cPanel reset and insert reply
    const handleAutoChangeAndInsert = async () => {
        if (!cleanUser) {
            showToast('Enter email username', 'error');
            return;
        }
        if (!passwordValidation.isValid) {
            showToast(passwordValidation.reason, 'error');
            return;
        }

        setIsSubmitting(true);
        setApiResult(null);

        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            try {
                const storedUser = localStorage.getItem('app_user');
                if (storedUser) {
                    const u = JSON.parse(storedUser);
                    if (u?.token) headers['Authorization'] = `Bearer ${u.token}`;
                }
            } catch {}

            const res = await fetch(`${API_URL}?action=cpanel_change_webmail_password`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    email: cleanUser,
                    domain,
                    password
                })
            });

            const data = await res.json();

            if (data.status === 'success' || data.cpanel_executed) {
                saveAndRecordCredential(password);

                const replyTemplate = `Hello, here is your Webmail password:

• Email: ${fullEmail}
• Password: ${password}
• Webmail URL: https://${domain}/webmail

Advise:
• Use CAPITAL letters and @, no extra spaces.`;

                if (onInsertReply) onInsertReply(replyTemplate);
                navigator.clipboard.writeText(password);
                trackAction('webmail_resolves');
                showToast('Password updated in cPanel & inserted!', 'success');
                onClose();
            } else if (data.account_not_found || (data.message && (data.message.toLowerCase().includes('not found') || data.message.toLowerCase().includes('does not exist')))) {
                // If account does not exist, make the custom reply with NO execution confirmation!
                if (onInsertReply) onInsertReply(getAccountNotFoundReply());
                setApiResult({
                    status: 'warning',
                    message: `Account '${fullEmail}' does not exist on ${domain} mail server. Custom reply inserted into draft.`,
                    accountNotFound: true,
                    hostCalled: data.host_called,
                    userCalled: data.user_called,
                    credentialSource: data.credential_source
                });
                showToast('Account does not exist on mail server. Custom reply inserted into draft.', 'warning');
            } else {
                setApiResult({
                    status: 'warning',
                    message: data.message || 'cPanel returned notice. No execution performed.',
                    accountNotFound: data.account_not_found || false,
                    hostCalled: data.host_called,
                    userCalled: data.user_called,
                    credentialSource: data.credential_source
                });

                if (onInsertReply) {
                    const manualReply = `Hello,

Our automated reset for ${fullEmail} could not execute on the mail server (${data.message || 'cPanel notice'}). 

Our IT team has logged this request to manually reset your webmail credentials. We will update you with your new login details shortly.`;
                    onInsertReply(manualReply);
                    showToast('cPanel auto-reset failed. Manual handling note inserted into draft.', 'warning');
                } else {
                    try {
                        await createNewTicket({
                            title: `Webmail Manual Reset: ${fullEmail}`,
                            category: 'WEBMAIL',
                            description: `Request Type: Webmail Manual Reset Required (Auto-Reset Failed)\n\nCorporate Email: ${fullEmail}\nMail Server: ${domain}\nServer Notice: ${data.message || 'cPanel server rejected auto-reset'}\n\nStatus: Automated reset could not execute via API.\nAction Required: IT Staff must log into cPanel at https://${domain}:2083 and manually reset the password for this account.`,
                            createdByName: user?.name || 'IT Staff',
                            createdByEmail: fullEmail,
                            project: domain.includes('samuiky') ? 'SAMUIKY' : 'FEP : NAIYA',
                            attachments: []
                        });
                        refreshTickets();
                        showToast(`cPanel reset failed. Ticket created for manual reset of ${fullEmail}.`, 'warning');
                        onClose();
                    } catch {
                        showToast(data.message || 'cPanel notice. No execution performed.', 'info');
                    }
                }
            }
        } catch {
            showToast('Connection error to cPanel. No execution performed.', 'error');
            if (!ticketId) {
                try {
                    await createNewTicket({
                        title: `Webmail Manual Reset: ${fullEmail}`,
                        category: 'WEBMAIL',
                        description: `Request Type: Webmail Manual Reset Required (Network Error)\n\nCorporate Email: ${fullEmail}\nMail Server: ${domain}\nServer Notice: Connection error contacting cPanel API.\n\nAction Required: IT Staff must manually reset this mailbox password in cPanel.`,
                        createdByName: user?.name || 'IT Staff',
                        createdByEmail: fullEmail,
                        project: domain.includes('samuiky') ? 'SAMUIKY' : 'FEP : NAIYA',
                        attachments: []
                    });
                    refreshTickets();
                    showToast(`Connection error. Ticket created for manual reset of ${fullEmail}.`, 'warning');
                    onClose();
                } catch {}
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenManualTicket = async () => {
        if (!cleanUser) {
            showToast('Enter email username', 'error');
            return;
        }
        setIsCreatingTicket(true);
        try {
            await createNewTicket({
                title: `Webmail Manual Reset: ${fullEmail}`,
                category: 'WEBMAIL',
                description: `Request Type: Webmail Manual Reset Required (Auto-Reset Failed)\n\nCorporate Email: ${fullEmail}\nMail Server: ${domain}\nServer Notice: ${apiResult?.message || 'Manual reset requested by IT Staff'}\n\nStatus: Automated reset could not execute via API.\nAction Required: IT Staff must log into cPanel at https://${domain}:2083 and manually reset the password for this account.`,
                createdByName: user?.name || 'IT Staff',
                createdByEmail: fullEmail,
                project: domain.includes('samuiky') ? 'SAMUIKY' : 'FEP : NAIYA',
                attachments: []
            });
            refreshTickets();
            showToast(`Support ticket opened for manual reset of ${fullEmail}`, 'success');
            onClose();
        } catch {
            showToast('Error creating manual reset ticket', 'error');
        } finally {
            setIsCreatingTicket(false);
        }
    };

    const handleResetCpanelOnly = async () => {
        if (!cleanUser) {
            showToast('Enter email username', 'error');
            return;
        }
        if (!passwordValidation.isValid) {
            showToast(passwordValidation.reason, 'error');
            return;
        }

        setIsSubmitting(true);
        setApiResult(null);

        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            try {
                const storedUser = localStorage.getItem('app_user');
                if (storedUser) {
                    const u = JSON.parse(storedUser);
                    if (u?.token) headers['Authorization'] = `Bearer ${u.token}`;
                }
            } catch {}

            const res = await fetch(`${API_URL}?action=cpanel_change_webmail_password`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    email: cleanUser,
                    domain,
                    password
                })
            });

            const data = await res.json();

            if (data.status === 'success' || data.cpanel_executed) {
                saveAndRecordCredential(password);
                setApiResult({
                    status: 'success',
                    message: `Password for ${fullEmail} updated on cPanel!`
                });
                showToast(`cPanel: Password updated for ${fullEmail}`, 'success');
            } else {
                setApiResult({
                    status: 'warning',
                    message: data.message || 'cPanel notice',
                    accountNotFound: data.account_not_found || false,
                    hostCalled: data.host_called,
                    userCalled: data.user_called,
                    credentialSource: data.credential_source
                });
                showToast(data.message || 'cPanel notice', 'info');
            }
        } catch {
            setApiResult({
                status: 'error',
                message: 'Connection error to cPanel'
            });
            showToast('Connection error to cPanel', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-0 sm:p-4 animate-fade-in font-sans"
        >
            <div 
                className="bg-surface-0 dark:bg-dark-card border border-surface-200 dark:border-dark-border rounded-none sm:rounded-2xl shadow-modal w-full sm:max-w-md overflow-hidden flex flex-col h-full sm:h-auto max-h-[100dvh] sm:max-h-[92vh] animate-scale-in"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-surface-200 dark:border-dark-border flex items-center justify-between bg-surface-50 dark:bg-dark-surface">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <Icons.Mail size={16} />
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                            Webmail Tool
                        </h3>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex bg-gray-200 dark:bg-white/10 p-0.5 rounded-lg text-xs font-semibold">
                            <button
                                type="button"
                                onClick={() => setActiveTab('tool')}
                                className={`px-2.5 py-1 rounded-md transition-colors ${
                                    activeTab === 'tool'
                                        ? 'bg-white dark:bg-[#161b22] text-gray-900 dark:text-white shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                }`}
                            >
                                Tool
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('domain_setup')}
                                className={`px-2.5 py-1 rounded-md transition-colors ${
                                    activeTab === 'domain_setup'
                                        ? 'bg-white dark:bg-[#161b22] text-gray-900 dark:text-white shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                }`}
                            >
                                APIs
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <Icons.Close size={16} />
                        </button>
                    </div>
                </div>

                {/* Body: TOOL */}
                {activeTab === 'tool' ? (
                    <div className="p-5 overflow-y-auto space-y-4">
                        {/* Target Account */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                                    Target Corporate Account
                                </label>
                                {email && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const p = parseEmail(email);
                                            setUsername(p.user);
                                            setDomain(p.domain);
                                            setApiResult(null);
                                        }}
                                        className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                                    >
                                        Use ticket email
                                    </button>
                                )}
                            </div>

                            <div className="flex rounded-xl shadow-sm border border-gray-200 dark:border-white/15 overflow-hidden focus-within:ring-2 focus-within:ring-brand-500 bg-white dark:bg-black/20">
                                <input
                                    type="text"
                                    value={username}
                                    onChange={e => handleUsernameChange(e.target.value)}
                                    placeholder="username"
                                    className="flex-1 px-3 py-2 text-sm font-mono text-gray-900 dark:text-white bg-transparent outline-none"
                                />
                                <div className="flex items-center px-2 bg-gray-100 dark:bg-white/5 border-l border-gray-200 dark:border-white/10 text-gray-500 font-bold text-xs">
                                    @
                                </div>
                                <select
                                    value={domain}
                                    onChange={e => {
                                        setDomain(e.target.value as CompanyDomain);
                                        setApiResult(null);
                                    }}
                                    className="px-2.5 py-2 bg-gray-50 dark:bg-[#1f242c] text-xs font-semibold text-gray-800 dark:text-gray-200 border-l border-gray-200 dark:border-white/10 outline-none cursor-pointer"
                                >
                                    {COMPANY_DOMAINS.map(d => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Password Section */}
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <Icons.Lock size={13} className="text-emerald-500" />
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                                        Password
                                    </span>
                                    {isPasswordSaved && (
                                        <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                                            Saved
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => generatePassword('random')}
                                        className="px-2 py-0.5 text-xs font-semibold rounded bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors"
                                        title="Generate random password"
                                    >
                                        New Random
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => generatePassword('naiya')}
                                        className="px-2 py-0.5 text-xs font-semibold rounded bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors"
                                    >
                                        NAIYA@
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => generatePassword('samuiky')}
                                        className="px-2 py-0.5 text-xs font-semibold rounded bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors"
                                    >
                                        SAMUIKY@
                                    </button>
                                </div>
                            </div>

                            <div className="flex rounded-lg shadow-sm border border-gray-200 dark:border-white/15 overflow-hidden bg-white dark:bg-[#11151c] focus-within:ring-2 focus-within:ring-emerald-500">
                                <input
                                    type="text"
                                    value={password}
                                    onChange={e => {
                                        setPassword(e.target.value.toUpperCase().replace(/\s/g, ''));
                                        setApiResult(null);
                                    }}
                                    placeholder="e.g. NAIYA@849201"
                                    className="flex-1 px-3 py-2 text-sm font-mono font-bold tracking-wider text-emerald-600 dark:text-emerald-400 bg-transparent outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={handleCopyPassword}
                                    className="px-3 py-2 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border-l border-gray-200 dark:border-white/10 text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1"
                                >
                                    {copied ? <Icons.Check size={13} /> : <Icons.Lock size={13} />}
                                    <span>{copied ? 'Copied' : 'Copy'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Status Alert */}
                        {apiResult && (
                            <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                                apiResult.status === 'success'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                                    : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                            }`}>
                                <div className="shrink-0 mt-0.5">
                                    {apiResult.status === 'success' ? <Icons.Check size={14} /> : <Icons.Alert size={14} />}
                                </div>
                                <div className="flex-1">
                                    <strong className="font-bold block mb-0.5">
                                        {apiResult.status === 'success' ? 'cPanel Succeeded' : 'Notice'}
                                    </strong>
                                    <p className="opacity-90">{apiResult.message}</p>
                                    {apiResult.userCalled && (
                                        <div className="mt-1.5 pt-1.5 border-t border-amber-200/60 dark:border-amber-800/60 text-[11px] font-mono">
                                            Host: {apiResult.hostCalled} | User: {apiResult.userCalled}
                                        </div>
                                    )}
                                    {apiResult.accountNotFound && onInsertReply && (
                                        <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={handleInsertNotFoundReply}
                                                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition-colors flex items-center gap-1.5 shadow-sm"
                                            >
                                                <Icons.Send size={12} />
                                                <span>Insert "Account Not Found" Reply</span>
                                            </button>
                                        </div>
                                    )}
                                    {apiResult.status === 'warning' && !apiResult.accountNotFound && (
                                        <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={handleOpenManualTicket}
                                                disabled={isCreatingTicket}
                                                className="px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-bold text-[11px] transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                                            >
                                                <Icons.Ticket size={12} />
                                                <span>{isCreatingTicket ? 'Opening Ticket...' : 'Open Ticket for Manual Reset'}</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Body: DOMAIN APIS */
                    <div className="p-5 overflow-y-auto space-y-3.5 text-xs">
                        <div className="grid grid-cols-3 gap-2">
                            {COMPANY_DOMAINS.map(d => {
                                const conf = domainConfigs[d];
                                return (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() => setSetupSelectedDomain(d)}
                                        className={`p-2 rounded-xl border text-left transition-all ${
                                            setupSelectedDomain === d
                                                ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300 ring-2 ring-brand-500/20'
                                                : 'border-gray-200 dark:border-white/10 hover:border-gray-300 text-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        <div className="font-bold truncate text-[11px]">{d}</div>
                                        <div className="text-[10px] mt-0.5 font-semibold">
                                            {conf?.has_token ? (
                                                <span className="text-emerald-600">Active</span>
                                            ) : (
                                                <span className="text-amber-600">No Token</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="p-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 space-y-2.5">
                            <div className="font-bold text-gray-800 dark:text-white border-b border-gray-200 dark:border-white/10 pb-1 font-mono">
                                {setupSelectedDomain}
                            </div>

                            <div>
                                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-0.5">Host URL</label>
                                <input
                                    type="text"
                                    value={setupHost}
                                    onChange={e => setSetupHost(e.target.value)}
                                    placeholder={`https://${setupSelectedDomain}:2083`}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22] font-mono text-xs outline-none"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-0.5">cPanel Username</label>
                                <input
                                    type="text"
                                    value={setupUser}
                                    onChange={e => setSetupUser(e.target.value)}
                                    placeholder="e.g. naiyatechnology"
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22] font-mono text-xs outline-none"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-0.5">
                                    API Token {domainConfigs[setupSelectedDomain]?.has_token && <span className="text-emerald-600 font-normal">(Set)</span>}
                                </label>
                                <input
                                    type="password"
                                    value={setupToken}
                                    onChange={e => setSetupToken(e.target.value)}
                                    placeholder={domainConfigs[setupSelectedDomain]?.has_token ? "Leave empty to keep existing" : "Paste cPanel API Token"}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22] font-mono text-xs outline-none"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={handleSaveDomainConfig}
                                disabled={savingConfig || !setupUser.trim()}
                                className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-50"
                            >
                                {savingConfig ? 'Saving...' : 'Save Credentials'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Footer Actions */}
                <div className="px-5 py-3 bg-gray-50 dark:bg-[#11151c] border-t border-gray-100 dark:border-white/10 flex items-center justify-between gap-2 shrink-0">
                    {activeTab === 'tool' ? (
                        <>
                            <button
                                type="button"
                                onClick={handleResetCpanelOnly}
                                disabled={isSubmitting || !cleanUser || !passwordValidation.isValid}
                                className="px-3 py-2 rounded-xl font-bold text-xs bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-100 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50"
                            >
                                {isSubmitting ? 'Resetting...' : 'Reset cPanel Only'}
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-3 py-2 rounded-xl font-semibold text-xs text-gray-600 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                                >
                                    Cancel
                                </button>

                                {isPasswordSaved ? (
                                    /* Already saved: Insert directly! */
                                    <button
                                        type="button"
                                        onClick={handleInsertExistingReply}
                                        className="px-3.5 py-2 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm flex items-center gap-1.5"
                                    >
                                        <Icons.Send size={13} />
                                        <span>Insert Saved Password</span>
                                    </button>
                                ) : (
                                    /* New password: Reset in cPanel & insert! */
                                    <button
                                        type="button"
                                        onClick={handleAutoChangeAndInsert}
                                        disabled={isSubmitting || !cleanUser || !passwordValidation.isValid}
                                        className="px-3.5 py-2 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        <Icons.Send size={13} />
                                        <span>{isSubmitting ? 'Processing...' : 'Auto-Reset & Insert'}</span>
                                    </button>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex justify-end w-full">
                            <button
                                type="button"
                                onClick={() => setActiveTab('tool')}
                                className="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-brand-600 hover:bg-brand-700 text-white transition-colors"
                            >
                                Back to Tool
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
