import React, { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTickets } from '../../contexts/TicketContext';
import { createNewTicket } from '../../services/ticketService';
import { useToast } from '../../contexts/ToastContext';

interface NimcLoginAssistantProps {
    onClose: () => void;
    isDisabled?: boolean;
    disabledMessage?: string;
}

type MenuOption = 'menu' | 'errors' | 'form';

export const NimcLoginAssistant: React.FC<NimcLoginAssistantProps> = ({ onClose, isDisabled, disabledMessage }) => {
    const { user } = useAuth();
    const { refreshTickets } = useTickets();
    const { showToast } = useToast();
    const [view, setView] = useState<MenuOption>('menu');
    const [formType, setFormType] = useState<'status' | 'reset' | 'agent_not_found' | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (view !== 'menu') {
                    setView('menu');
                } else {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [view, onClose]);

    // Form state
    const [isReferee, setIsReferee] = useState(false);
    const [fullName, setFullName] = useState('');
    const [nin, setNin] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [selectedFep, setSelectedFep] = useState<'FEP : NAIYA' | 'SAMUIKY' | ''>(() => {
        const uEmail = (user?.email || '').toLowerCase();
        if (uEmail.includes('samuiky')) return 'SAMUIKY';
        if (uEmail.includes('naiya')) return 'FEP : NAIYA';
        return '';
    });

    const resetForm = (resetFep = true) => {
        setFullName('');
        setNin('');
        setEmail('');
        setPhone('');
        setIsReferee(false);
        if (resetFep) {
            const uEmail = (user?.email || '').toLowerCase();
            if (uEmail.includes('samuiky')) {
                setSelectedFep('SAMUIKY');
            } else if (uEmail.includes('naiya')) {
                setSelectedFep('FEP : NAIYA');
            } else {
                setSelectedFep('');
            }
        }
    };

    const handleMenuClick = (option: 'status' | 'reset' | 'errors' | 'agent_not_found') => {
        if (option === 'errors') {
            setView('errors');
        } else {
            setFormType(option);
            resetForm(false);
            setView('form');
        }
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // === LOCKDOWN GUARD ===
        if (isDisabled) {
            showToast(disabledMessage || 'NIMC service is temporarily unavailable.', 'error');
            return;
        }
        // === END LOCKDOWN GUARD ===

        if (!selectedFep) {
            showToast('Please select which FEP you belong to (NA\'IYA or SAMUIKY).', 'error');
            return;
        }

        setSubmitting(true);
        let title = 'NIMC Login Reset Request';
        if (formType === 'status') title = 'NIMC Metadata Status Check';
        if (formType === 'agent_not_found') title = 'Agent Not Found Resolution Request';

        const fepDisplay = selectedFep === 'FEP : NAIYA' ? "NA'IYA" : "SAMUIKY";

        let description = `Request Type: ${title}\nFEP: ${fepDisplay}\n\n`;
        if (isReferee) {
            description += `SUBMITTED BY REFEREE\n\n`;
        }
        description += `Agent Full Name: ${fullName}\nAgent NIN: ${nin}\nAgent Email: ${email}\nAgent Phone: ${phone}\nFEP: ${fepDisplay}`;
        
        try {
            await createNewTicket({
                title,
                category: 'NIMC Login Details',
                description,
                createdByName: user?.name || 'User',
                createdByEmail: user?.email || 'unknown',
                project: selectedFep,
                attachments: []
            });
            showToast(`Your ${title} ticket (${fepDisplay}) has been created.`, 'success');
            refreshTickets();
            onClose();
        } catch (error) {
            console.error(error);
            showToast('Error processing request.', 'error');
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-0 sm:p-6 animate-fade-in font-sans">
            <div className="bg-surface-0 dark:bg-dark-card border border-surface-200 dark:border-dark-border w-full max-w-lg rounded-none sm:rounded-2xl shadow-modal flex flex-col overflow-hidden h-full sm:h-auto max-h-[100dvh] sm:max-h-[90vh] animate-scale-in">
                <div className="px-6 py-4 border-b border-surface-200 dark:border-dark-border flex justify-between items-center bg-surface-50/70 dark:bg-dark-card shrink-0">
                    <h2 className="text-lg sm:text-xl font-bold text-surface-900 dark:text-dark-textPrimary flex items-center gap-2">
                        {view !== 'menu' && (
                            <button onClick={() => setView('menu')} className="text-surface-400 hover:text-brand-500 transition-colors -ml-2 p-1" title="Back">
                                <Icons.Back size={20} />
                            </button>
                        )}
                        <Icons.User className="text-brand-600" />
                        NIMC Login Assistant
                    </h2>
                    <button onClick={onClose} disabled={submitting} className="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-dark-textPrimary hover:bg-surface-100 dark:hover:bg-dark-hover rounded-lg transition-colors disabled:opacity-50" title="Close (Esc)">
                        <Icons.Close size={20} />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    {/* === MAINTENANCE MODE SCREEN === */}
                    {isDisabled ? (
                        <div className="flex flex-col items-center text-center py-8 space-y-5 animate-fade-in">
                            <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <Icons.Settings size={36} className="text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">NIMC / Metadata — Under Maintenance</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs mx-auto">
                                    {disabledMessage || 'The NIMC metadata service is temporarily unavailable. Please check back later.'}
                                </p>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-4 w-full max-w-xs text-left">
                                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">What's blocked:</p>
                                <ul className="text-xs text-amber-600 dark:text-amber-400/80 space-y-0.5">
                                    <li>• Metadata status check tickets</li>
                                    <li>• NIMC login reset requests</li>
                                    <li>• AI escalation to NIMC category</li>
                                </ul>
                            </div>
                            <button onClick={onClose} className="mt-2 px-6 py-2.5 bg-gray-800 dark:bg-white/10 text-white font-semibold rounded-xl text-sm hover:bg-gray-700 dark:hover:bg-white/20 transition-colors">
                                Close
                            </button>
                        </div>
                    ) : (
                    <>
                    {view === 'menu' && (
                        <div className="space-y-4 animate-fade-in">
                            {/* FEP Quick Selection */}
                            <div className="bg-slate-50 dark:bg-black/20 p-3.5 rounded-2xl border border-gray-200 dark:border-white/10 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                                        <Icons.Briefcase size={14} className="text-brand-600" />
                                        Select Your FEP <span className="text-red-500">*</span>
                                    </span>
                                    {selectedFep && (
                                        <span className="text-[11px] font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 rounded-md">
                                            {selectedFep === 'FEP : NAIYA' ? "NA'IYA" : 'SAMUIKY'}
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedFep('FEP : NAIYA')}
                                        className={`p-3 rounded-xl border-2 text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                                            selectedFep === 'FEP : NAIYA'
                                                ? 'border-brand-600 bg-white dark:bg-slate-800 text-brand-900 dark:text-white shadow-sm ring-2 ring-brand-500/20'
                                                : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 bg-white/70 dark:bg-slate-900/50 text-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            <span className="font-extrabold text-sm tracking-wide">NA'IYA</span>
                                            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                                selectedFep === 'FEP : NAIYA' 
                                                    ? 'border-brand-600 bg-brand-600 text-white' 
                                                    : 'border-gray-300 dark:border-gray-600'
                                            }`}>
                                                {selectedFep === 'FEP : NAIYA' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </div>
                                        </div>
                                        <span className="text-[10px] opacity-75 mt-0.5">Na'iya Technology</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setSelectedFep('SAMUIKY')}
                                        className={`p-3 rounded-xl border-2 text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                                            selectedFep === 'SAMUIKY'
                                                ? 'border-brand-600 bg-white dark:bg-slate-800 text-brand-900 dark:text-white shadow-sm ring-2 ring-brand-500/20'
                                                : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 bg-white/70 dark:bg-slate-900/50 text-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            <span className="font-extrabold text-sm tracking-wide">SAMUIKY</span>
                                            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                                selectedFep === 'SAMUIKY' 
                                                    ? 'border-brand-600 bg-brand-600 text-white' 
                                                    : 'border-gray-300 dark:border-gray-600'
                                            }`}>
                                                {selectedFep === 'SAMUIKY' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </div>
                                        </div>
                                        <span className="text-[10px] opacity-75 mt-0.5">Samuiky Global</span>
                                    </button>
                                </div>
                            </div>

                            <p className="text-sm text-gray-600 dark:text-gray-400">Please select the type of NIMC issue you are experiencing:</p>
                            
                            <button onClick={() => handleMenuClick('status')} className="w-full text-left p-4 rounded-xl border border-gray-200 dark:border-white/10 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-all flex items-center justify-between group">
                                <div>
                                    <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-1">Check Metadata Status</h3>
                                    <p className="text-xs text-gray-500">Check if your data profile is active and synced.</p>
                                </div>
                                <Icons.Back className="rotate-180 text-gray-300 group-hover:text-brand-500 transition-colors" size={20} />
                            </button>

                            <button onClick={() => handleMenuClick('reset')} className="w-full text-left p-4 rounded-xl border border-gray-200 dark:border-white/10 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-all flex items-center justify-between group">
                                <div>
                                    <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-1">Reset NIMC Login</h3>
                                    <p className="text-xs text-gray-500">Request a credential reset or device re-binding.</p>
                                </div>
                                <Icons.Back className="rotate-180 text-gray-300 group-hover:text-brand-500 transition-colors" size={20} />
                            </button>

                            <button onClick={() => handleMenuClick('errors')} className="w-full text-left p-4 rounded-xl border border-gray-200 dark:border-white/10 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all flex items-center justify-between group">
                                <div>
                                    <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-1">Login Errors</h3>
                                    <p className="text-xs text-gray-500">experiencing specific app errors or blacklists.</p>
                                </div>
                                <Icons.Back className="rotate-180 text-gray-300 group-hover:text-red-500 transition-colors" size={20} />
                            </button>
                        </div>
                    )}

                    {view === 'errors' && (
                        <div className="space-y-4 animate-fade-in">
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Select Your Error</h3>
                            
                            <button 
                                onClick={() => handleMenuClick('agent_not_found')}
                                disabled={submitting}
                                className="w-full text-left p-4 bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-xl hover:border-brand-500 shadow-sm transition-all"
                            >
                                <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">"UNABLE TO FIND AN AGENT PROVIDED USERNAME AND PASSWORD"</p>
                                <p className="text-xs text-gray-500 mt-1">Submit your details for manual account creation or verification.</p>
                            </button>

                            <a 
                                href="https://docs.google.com/forms/d/e/1FAIpQLSftewnstHxw8sZvZA2JVRarpoaqYAQnVHv-2z-Jh6S_TvnGDQ/viewform"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full text-left p-4 bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-xl hover:border-red-500 shadow-sm transition-all block"
                            >
                                <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">Account Blacklisted</p>
                                <p className="text-xs text-gray-500 mt-1 text-brand-600 dark:text-brand-400 font-medium">Click to open the Official Blacklist Resolution Form <Icons.Expand className="-rotate-90 inline ml-1" size={14}/></p>
                            </a>

                            <button 
                                onClick={() => {
                                    window.dispatchEvent(new CustomEvent('open-support-chat'));
                                    onClose();
                                }}
                                disabled={submitting}
                                className="w-full text-left p-4 bg-gray-50 dark:bg-white/5 border border-dashed border-gray-300 dark:border-white/20 rounded-xl hover:border-gray-500 transition-all"
                            >
                                <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">Other / Unknown Error</p>
                                <p className="text-xs text-gray-500 mt-1">Open AI Chat Support to describe your issue and create a ticket.</p>
                            </button>
                        </div>
                    )}

                    {view === 'form' && (
                        <div className="animate-fade-in">
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-4">
                                {formType === 'status' && 'NIMC Metadata Status Check'}
                                {formType === 'reset' && 'NIMC Login Reset Request'}
                                {formType === 'agent_not_found' && 'Agent Not Found Resolution'}
                            </h3>
                            
                            <form onSubmit={handleFormSubmit} className="space-y-4">
                                {/* FEP Selection Field */}
                                <div className="p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border border-gray-200 dark:border-white/10 space-y-2">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center justify-between">
                                        <span className="flex items-center gap-1.5">
                                            <Icons.Briefcase size={14} className="text-brand-600" />
                                            Which FEP do you belong to? <span className="text-red-500">*</span>
                                        </span>
                                        {selectedFep && (
                                            <span className="text-[11px] font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 rounded-md">
                                                {selectedFep === 'FEP : NAIYA' ? "NA'IYA" : 'SAMUIKY'}
                                            </span>
                                        )}
                                    </label>

                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedFep('FEP : NAIYA')}
                                            className={`p-3 rounded-xl border-2 text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                                                selectedFep === 'FEP : NAIYA'
                                                    ? 'border-brand-600 bg-white dark:bg-slate-800 text-brand-900 dark:text-white shadow-sm ring-2 ring-brand-500/20'
                                                    : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 bg-white/70 dark:bg-slate-900/50 text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between w-full mb-1">
                                                <span className="font-extrabold text-sm sm:text-base tracking-wide">NA'IYA</span>
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                                    selectedFep === 'FEP : NAIYA' 
                                                        ? 'border-brand-600 bg-brand-600 text-white' 
                                                        : 'border-gray-300 dark:border-gray-600'
                                                }`}>
                                                    {selectedFep === 'FEP : NAIYA' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                </div>
                                            </div>
                                            <span className="text-[11px] opacity-75">FEP : Na'iya Technology</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setSelectedFep('SAMUIKY')}
                                            className={`p-3 rounded-xl border-2 text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                                                selectedFep === 'SAMUIKY'
                                                    ? 'border-brand-600 bg-white dark:bg-slate-800 text-brand-900 dark:text-white shadow-sm ring-2 ring-brand-500/20'
                                                    : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 bg-white/70 dark:bg-slate-900/50 text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between w-full mb-1">
                                                <span className="font-extrabold text-sm sm:text-base tracking-wide">SAMUIKY</span>
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                                    selectedFep === 'SAMUIKY' 
                                                        ? 'border-brand-600 bg-brand-600 text-white' 
                                                        : 'border-gray-300 dark:border-gray-600'
                                                }`}>
                                                    {selectedFep === 'SAMUIKY' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                </div>
                                            </div>
                                            <span className="text-[11px] opacity-75">FEP : Samuiky Global</span>
                                        </button>
                                    </div>

                                    {!selectedFep && (
                                        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1 font-medium">
                                            <Icons.Alert size={12} /> Please select NA'IYA or SAMUIKY to proceed.
                                        </p>
                                    )}
                                </div>

                                <label className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={isReferee}
                                        onChange={(e) => setIsReferee(e.target.checked)}
                                        className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                    />
                                    <span className="text-sm font-semibold text-amber-900 dark:text-amber-400">
                                        I am a Referee submitting on behalf of an Agent
                                    </span>
                                </label>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                                        Agent Full Name
                                    </label>
                                    <input 
                                        required
                                        type="text"
                                        value={fullName}
                                        onChange={e => setFullName(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm dark:text-white"
                                        placeholder="e.g. Yahaya Olajide"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                                        Agent NIN
                                    </label>
                                    <input 
                                        required
                                        type="text"
                                        value={nin}
                                        onChange={e => setNin(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm dark:text-white"
                                        placeholder="11-digit NIN"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                                        Agent Email
                                    </label>
                                    <input 
                                        required
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm dark:text-white"
                                        placeholder="agent@example.com"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                                        Agent Phone Number
                                    </label>
                                    <input 
                                        required
                                        type="tel"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm dark:text-white"
                                        placeholder="e.g. 0903..."
                                    />
                                </div>

                                <button 
                                    type="submit"
                                    disabled={submitting || !selectedFep}
                                    className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 dark:disabled:bg-slate-700 text-white font-bold text-sm rounded-lg mt-4 transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:cursor-not-allowed"
                                >
                                    {submitting ? 'Submitting...' : !selectedFep ? 'Select FEP to Submit' : 'Submit to IT Support'}
                                    {!submitting && <Icons.Send size={16} />}
                                </button>
                            </form>
                        </div>
                    )}
                    </>
                    )}
                </div>
            </div>
        </div>
    );
};
