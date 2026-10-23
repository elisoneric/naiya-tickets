import React, { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';
import { useToast } from '../../contexts/ToastContext';
import { getAgentListRaw, getTeamLeads } from '../../services/storageService';
import { sendSystemBroadcastEmail } from '../../services/emailService';
import { useAuth } from '../../contexts/AuthContext';

interface SystemBroadcastModalProps {
    onClose: () => void;
    initialRecipients?: string[];
}

export const SystemBroadcastModal: React.FC<SystemBroadcastModalProps> = ({ onClose, initialRecipients = [] }) => {
    const { user } = useAuth();
    const { showToast } = useToast();

    const [audienceType, setAudienceType] = useState<'all' | 'team_leads' | 'custom'>(
        initialRecipients.length > 0 ? 'custom' : 'all'
    );
    const [allAgents, setAllAgents] = useState<{ email: string; name?: string }[]>([]);
    const [teamLeads, setTeamLeads] = useState<{ email: string; name?: string }[]>([]);
    const [selectedEmails, setSelectedEmails] = useState<string[]>(initialRecipients);
    const [customEmailInput, setCustomEmailInput] = useState('');
    
    const [subject, setSubject] = useState('');
    const [badge, setBadge] = useState('Announcement');
    const [message, setMessage] = useState('');
    
    const [isSending, setIsSending] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
    const [previewMode, setPreviewMode] = useState(false);

    useEffect(() => {
        const loadAudienceData = async () => {
            try {
                const [agentsRes, leadsRes] = await Promise.all([
                    getAgentListRaw(),
                    getTeamLeads()
                ]);
                setAllAgents(agentsRes || []);
                setTeamLeads((leadsRes || []).map(l => ({ email: l.email, name: l.name })));
            } catch (e) {
                console.error("Failed to load audience data", e);
            }
        };
        loadAudienceData();
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSending) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, isSending]);

    // Calculate recipient count
    const resolvedRecipients = (): string[] => {
        if (audienceType === 'all') {
            return allAgents.map(a => a.email.toLowerCase().trim()).filter(e => e.includes('@'));
        }
        if (audienceType === 'team_leads') {
            return teamLeads.map(l => l.email.toLowerCase().trim()).filter(e => e.includes('@'));
        }
        return selectedEmails.map(e => e.toLowerCase().trim()).filter(e => e.includes('@'));
    };

    const recipientList = resolvedRecipients();

    const handleAddCustomEmail = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const raw = customEmailInput.trim().toLowerCase();
        if (!raw || !raw.includes('@')) {
            showToast('Please enter a valid email address', 'error');
            return;
        }
        if (!selectedEmails.includes(raw)) {
            setSelectedEmails(prev => [...prev, raw]);
            setCustomEmailInput('');
        }
    };

    const handleRemoveEmail = (emailToRemove: string) => {
        setSelectedEmails(prev => prev.filter(e => e !== emailToRemove));
    };

    const handleSend = async () => {
        if (!subject.trim()) {
            showToast('Subject line is required', 'error');
            return;
        }
        if (!message.trim()) {
            showToast('Message body cannot be empty', 'error');
            return;
        }
        if (recipientList.length === 0) {
            showToast('No valid recipients selected', 'error');
            return;
        }

        const confirmMsg = `Are you sure you want to dispatch this email from the system to ${recipientList.length} recipient(s)?`;
        if (!window.confirm(confirmMsg)) return;

        setIsSending(true);
        setProgress({ current: 0, total: recipientList.length });

        try {
            const senderName = user?.name || "Na'iya IT Support Desk";
            const result = await sendSystemBroadcastEmail(
                recipientList,
                subject.trim(),
                message.trim(),
                badge,
                senderName
            );

            if (result.sent > 0) {
                showToast(`Successfully dispatched email to ${result.sent} recipient(s)!`, 'success');
                onClose();
            } else {
                showToast('Failed to dispatch email. Please check SMTP settings.', 'error');
            }
        } catch (err: any) {
            console.error(err);
            showToast(err.message || 'Error dispatching emails', 'error');
        } finally {
            setIsSending(false);
            setProgress(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-[2px] p-0 sm:p-4 animate-fade-in font-sans">
            <div className="bg-surface-0 dark:bg-dark-card w-full sm:max-w-2xl rounded-none sm:rounded-2xl shadow-modal overflow-hidden flex flex-col h-full sm:h-auto max-h-[100dvh] sm:max-h-[90vh] border border-surface-200 dark:border-dark-border animate-scale-in">
                
                {/* Header */}
                <div className="bg-brand-600 text-white px-5 md:px-6 py-3.5 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold shadow-inner">
                            <Icons.Mail size={22} />
                        </div>
                        <div>
                            <h3 className="font-black text-lg tracking-tight">System Direct Email / Broadcast</h3>
                            <p className="text-xs text-brand-100 opacity-90">Send official emails directly to the agent base</p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={isSending} className="hover:bg-white/20 p-2 rounded-full transition-colors text-white/80 hover:text-white">
                        <Icons.Close size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-5 flex-1">
                    
                    {/* Audience Selector */}
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                            Select Recipients Audience
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <button
                                type="button"
                                onClick={() => setAudienceType('all')}
                                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                                    audienceType === 'all'
                                        ? 'bg-brand-50 border-brand-500 dark:bg-brand-900/30 dark:border-brand-500 shadow-sm ring-1 ring-brand-500'
                                        : 'border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-white/5'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-xs text-gray-900 dark:text-white">All Agents</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 font-bold">
                                        {allAgents.length}
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">Broadcast to all registered agents</p>
                            </button>

                            <button
                                type="button"
                                onClick={() => setAudienceType('team_leads')}
                                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                                    audienceType === 'team_leads'
                                        ? 'bg-brand-50 border-brand-500 dark:bg-brand-900/30 dark:border-brand-500 shadow-sm ring-1 ring-brand-500'
                                        : 'border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-white/5'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-xs text-gray-900 dark:text-white">Team Leads</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-bold">
                                        {teamLeads.length}
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">Managers and regional supervisors</p>
                            </button>

                            <button
                                type="button"
                                onClick={() => setAudienceType('custom')}
                                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                                    audienceType === 'custom'
                                        ? 'bg-brand-50 border-brand-500 dark:bg-brand-900/30 dark:border-brand-500 shadow-sm ring-1 ring-brand-500'
                                        : 'border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-white/5'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-xs text-gray-900 dark:text-white">Selected / Custom</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold">
                                        {selectedEmails.length}
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">Specific email list or agents</p>
                            </button>
                        </div>
                    </div>

                    {/* Custom recipients list if custom */}
                    {audienceType === 'custom' && (
                        <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-200 dark:border-dark-border space-y-3">
                            <div className="flex gap-2">
                                <input 
                                    type="email"
                                    value={customEmailInput}
                                    onChange={e => setCustomEmailInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomEmail(); } }}
                                    placeholder="Enter recipient email address..."
                                    className="flex-1 px-3 py-2 text-sm bg-white dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-lg outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAddCustomEmail()}
                                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition-colors"
                                >
                                    Add Recipient
                                </button>
                            </div>

                            {/* Chips */}
                            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                                {selectedEmails.map(em => (
                                    <span key={em} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-full text-xs font-medium text-gray-800 dark:text-gray-200 shadow-xs">
                                        {em}
                                        <button 
                                            type="button" 
                                            onClick={() => handleRemoveEmail(em)}
                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            &times;
                                        </button>
                                    </span>
                                ))}
                                {selectedEmails.length === 0 && (
                                    <p className="text-xs text-gray-400 italic">No specific emails added yet. Type an email above and press Enter.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Category / Badge */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                                Notice Badge
                            </label>
                            <select
                                value={badge}
                                onChange={e => setBadge(e.target.value)}
                                className="w-full px-3 py-2.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500 font-semibold dark:text-white"
                            >
                                <option value="Announcement">General Announcement</option>
                                <option value="Urgent">Urgent Notice</option>
                                <option value="Maintenance">Scheduled Maintenance</option>
                                <option value="Action Required">Action Required</option>
                                <option value="System Update">System Update</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                                Sender Profile
                            </label>
                            <div className="px-3 py-2.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 truncate">
                                ticket@naiyatechnology.org (Official Bot)
                            </div>
                        </div>
                    </div>

                    {/* Subject */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                            Email Subject <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            placeholder="e.g. Important VPN Configuration Update for Field Agents"
                            className="w-full px-4 py-2.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500 font-medium dark:text-white"
                        />
                    </div>

                    {/* Message Body */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                Message Content <span className="text-red-500">*</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setPreviewMode(!previewMode)}
                                className="text-xs text-brand-600 dark:text-brand-400 font-bold hover:underline"
                            >
                                {previewMode ? 'Edit Message' : 'Preview Email'}
                            </button>
                        </div>

                        {previewMode ? (
                            <div className="p-4 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl max-h-56 overflow-y-auto">
                                <div className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Email Preview:</div>
                                <div className="bg-white dark:bg-dark-surface p-4 rounded-lg border border-gray-100 dark:border-white/5 shadow-xs text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                                    {message || '<Empty message body>'}
                                </div>
                            </div>
                        ) : (
                            <textarea
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                rows={6}
                                placeholder="Dear Agents, please be informed that..."
                                className="w-full p-4 bg-white dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500 resize-y leading-relaxed dark:text-white"
                            />
                        )}
                    </div>

                    {/* Info summary */}
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 rounded-xl flex items-center justify-between text-xs text-blue-800 dark:text-blue-300 font-medium">
                        <span className="flex items-center gap-1.5">
                            <Icons.Info size={16} /> Total target recipients:
                        </span>
                        <span className="font-bold text-sm bg-blue-200/50 dark:bg-blue-800/50 px-2.5 py-0.5 rounded-full">
                            {recipientList.length} {recipientList.length === 1 ? 'agent' : 'agents'}
                        </span>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-dark-bg border-t border-gray-200 dark:border-dark-border flex items-center justify-between shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSending}
                        className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={isSending || recipientList.length === 0 || !subject.trim() || !message.trim()}
                        className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center gap-2"
                    >
                        {isSending ? (
                            <>
                                <Icons.Refresh size={16} className="animate-spin" />
                                <span>Sending to {progress?.total || 0}...</span>
                            </>
                        ) : (
                            <>
                                <Icons.Send size={16} />
                                <span>Dispatch Email ({recipientList.length})</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
