import React, { useState, useEffect } from 'react';
import { StaffManager } from '../components/admin/StaffManager';
import { TeamLeadManager } from '../components/admin/TeamLeadManager';
import { CategoryManager } from '../components/admin/CategoryManager';
import { FeedbackManager } from '../components/admin/FeedbackManager';
import { DatabaseManager } from '../components/admin/DatabaseManager';
import { ShortcutManager } from '../components/admin/ShortcutManager';
import { TriageManager } from '../components/admin/TriageManager';
import { MacroManager } from '../components/admin/MacroManager';
import { AutoRouteManager } from '../components/admin/AutoRouteManager';
import { SystemBroadcastModal } from '../components/admin/SystemBroadcastModal';
import { Icons } from '../components/common/Icons';
import { useAuth } from '../contexts/AuthContext';
import { ServiceStatusManager } from '../components/admin/ServiceStatusManager';
import { AiProviderSettingsModal } from '../components/admin/AiProviderSettingsModal';
import { getGeneralSettings, saveGeneralSettings } from '../services/storageService';
import { useToast } from '../contexts/ToastContext';

export const AdminSettings: React.FC<{ onSelectView?: (view: string) => void }> = ({ onSelectView }) => {
    const [activeModal, setActiveModal] = useState<string | null>(null);
    const [subView, setSubView] = useState<'requests' | 'feedback' | null>(null);
    const { user } = useAuth();
    const { showToast } = useToast();
    const isRoot = !!user?.isRoot || user?.email?.toLowerCase() === 'itstaff';

    // Incident banner editor state
    const [bannerEnabled, setBannerEnabled] = useState(true);
    const [bannerTitle, setBannerTitle] = useState('VPN Service Disruption');
    const [bannerMessage, setBannerMessage] = useState('Our team is resolving connectivity issues. Use the VPN Assistant after login. First time? Just enter your email below.');
    const [bannerSaving, setBannerSaving] = useState(false);

    useEffect(() => {
        if (activeModal === 'banner') {
            getGeneralSettings().then(s => {
                if (s.incidentBanner) {
                    setBannerEnabled(s.incidentBanner.enabled);
                    setBannerTitle(s.incidentBanner.title);
                    setBannerMessage(s.incidentBanner.message);
                }
            }).catch(() => {});
        }
    }, [activeModal]);

    // Esc key handling to close modals
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (activeModal) {
                    setActiveModal(null);
                } else if (subView) {
                    setSubView(null);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeModal, subView]);

    const saveBanner = async () => {
        setBannerSaving(true);
        try {
            const s = await getGeneralSettings();
            s.incidentBanner = { enabled: bannerEnabled, title: bannerTitle, message: bannerMessage };
            await saveGeneralSettings(s);
            showToast('Banner updated', 'success');
            setActiveModal(null);
        } catch {
            showToast('Failed to save banner', 'error');
        } finally {
            setBannerSaving(false);
        }
    };

    const SettingsCard = ({ title, icon: Icon, desc, action, restricted = false }: any) => {
        if (restricted && !isRoot) return null;
        return (
            <div 
                onClick={action}
                className="group bg-surface-0 dark:bg-dark-card p-5 md:p-6 rounded-xl border border-surface-200 dark:border-dark-border hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-elevated transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col"
            >
                <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 border border-brand-100 dark:border-brand-800 flex items-center justify-center mb-4 transition-colors group-hover:bg-brand-100 dark:group-hover:bg-brand-900/40">
                    <Icon size={22} />
                </div>
                <h3 className="font-semibold text-base text-surface-900 dark:text-white mb-1.5">{title}</h3>
                <p className="text-xs md:text-sm text-surface-500 dark:text-surface-400 leading-relaxed">{desc}</p>
            </div>
        );
    };

    if (subView) {
        return (
            <div className="flex-1 overflow-hidden bg-surface-50 dark:bg-dark-bg flex flex-col h-full w-full font-sans">
                <FeedbackManager 
                    initialFilter={subView === 'feedback' ? 'feedback' : 'access'} 
                    onClose={() => setSubView(null)} 
                />
            </div>
        );
    }

    return (
        <div className="flex-1 bg-surface-50 dark:bg-dark-bg p-4 md:p-8 overflow-y-auto relative font-sans">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-surface-0 dark:bg-dark-card rounded-xl shadow-xs flex items-center justify-center border border-surface-200 dark:border-dark-border">
                        <Icons.Settings className="text-brand-600 dark:text-brand-400" size={22} />
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-surface-900 dark:text-white tracking-tight">System Settings</h2>
                        <p className="text-xs md:text-sm text-surface-500 dark:text-surface-400">Manage users, access controls, and system configurations.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
                    
                    {/* Incident Banner */}
                    <div
                        onClick={() => setActiveModal('banner')}
                        className="group bg-surface-0 dark:bg-dark-card p-5 md:p-6 rounded-xl border border-red-200 dark:border-red-900/60 hover:shadow-elevated hover:border-red-300 dark:hover:border-red-700 transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col"
                    >
                        <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center justify-center mb-4 transition-colors">
                            <Icons.AlertCircle size={22} />
                        </div>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <h3 className="font-semibold text-base text-surface-900 dark:text-white">Incident Banner</h3>
                            <span className="text-2xs bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 font-semibold px-2 py-0.5 rounded-md border border-red-200 dark:border-red-800">LOGIN PAGE</span>
                        </div>
                        <p className="text-xs md:text-sm text-surface-500 dark:text-surface-400 leading-relaxed">Set or disable the 2-line downtime alert shown above the login form (VPN, Metadata, any outage).</p>
                    </div>

                    {/* Service Status */}
                    <div
                        onClick={() => setActiveModal('status')}
                        className="group bg-surface-0 dark:bg-dark-card p-5 md:p-6 rounded-xl border border-amber-200 dark:border-amber-900/60 hover:shadow-elevated hover:border-amber-300 dark:hover:border-amber-700 transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col"
                    >
                        <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center mb-4 transition-colors">
                            <Icons.Settings size={22} />
                        </div>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <h3 className="font-semibold text-base text-surface-900 dark:text-white">Service Status Control</h3>
                            <span className="text-2xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-semibold px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">CIRCUIT BREAKER</span>
                        </div>
                        <p className="text-xs md:text-sm text-surface-500 dark:text-surface-400 leading-relaxed">Instantly lock down VPN, Metadata, or any service section during downtime. Blocks UI, AI, and all ticket paths.</p>
                    </div>

                    <SettingsCard 
                        title="AI Gateway & Provider" 
                        icon={Icons.Sparkles} 
                        desc="Configure Indunix AI corporate gateway, manage API keys, inspect curl integration, and verify connectivity with live tester."
                        action={() => setActiveModal('ai_provider')}
                        restricted={true}
                    />

                    <SettingsCard 
                        title="Agent Directory" 
                        icon={Icons.Agents} 
                        desc="Manage authorized agents, bulk upload email lists (.TXT/.CSV), and assign roles."
                        action={() => onSelectView ? onSelectView('Agents') : setActiveModal('agents')}
                    />

                    <SettingsCard 
                        title="System Broadcast & Email" 
                        icon={Icons.Mail} 
                        desc="Compose and send official emails directly to the agent base or team leads."
                        action={() => setActiveModal('broadcast')}
                    />

                    <SettingsCard 
                        title="Access & Onboarding Requests" 
                        icon={Icons.Shield} 
                        desc="Review, bulk approve, or reject user access and email recovery requests."
                        action={() => onSelectView ? onSelectView('Requests') : setSubView('requests')}
                    />

                    <SettingsCard 
                        title="IT Staff Accounts" 
                        icon={Icons.Shield} 
                        desc="Create and manage IT Staff accounts, passwords, and specialized roles."
                        action={() => setActiveModal('staff')}
                        restricted={true}
                    />

                    <SettingsCard 
                        title="Auto-Routing Rules" 
                        icon={Icons.Send} 
                        desc="Configure auto-assignment for incoming tickets based on rules."
                        action={() => setActiveModal('autoroute')}
                        restricted={true}
                    />

                    <SettingsCard 
                        title="Ticket Categories" 
                        icon={Icons.Inbox} 
                        desc="Add or remove support categories available to agents."
                        action={() => setActiveModal('cats')}
                        restricted={true} 
                    />

                    <SettingsCard 
                        title="Triage Builder" 
                        icon={Icons.Dashboard} 
                        desc="Configure the user self-service Support Wizard."
                        action={() => setActiveModal('triage')}
                        restricted={true} 
                    />

                    <SettingsCard 
                        title="Macros" 
                        icon={Icons.Dashboard} 
                        desc="Create smart macro responses with actions for support agents."
                        action={() => setActiveModal('macros')}
                        restricted={true} 
                    />

                    <SettingsCard 
                        title="Reply Shortcuts" 
                        icon={Icons.Chat} 
                        desc="Manage quick reply shortcuts for agents and staff (e.g., /details)."
                        action={() => setActiveModal('shortcuts')}
                        restricted={true} 
                    />

                    <SettingsCard 
                        title="System Feedback" 
                        icon={Icons.Complaint} 
                        desc="View suggestions and access complaints submitted from the login page."
                        action={() => onSelectView ? onSelectView('Feedback') : setSubView('feedback')}
                    />

                    <SettingsCard 
                        title="Team Leads" 
                        icon={Icons.Users} 
                        desc="Configure Team Lead profiles and credentials for regional supervision."
                        action={() => setActiveModal('leads')}
                        restricted={true}
                    />

                    <SettingsCard 
                        title="Database & Backup" 
                        icon={Icons.Briefcase} 
                        desc="Export system data for migration or restore from backups."
                        action={() => setActiveModal('db')}
                        restricted={true}
                    />
                </div>
            </div>

            {/* Incident Banner Modal */}
            {activeModal === 'banner' && (
                <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-3 md:p-4">
                    <div className="bg-surface-0 dark:bg-dark-card rounded-2xl shadow-modal border border-surface-200 dark:border-dark-border w-full max-w-md p-5 md:p-6 space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between pb-3 border-b border-surface-100 dark:border-dark-border">
                            <div>
                                <h2 className="text-base font-semibold text-surface-900 dark:text-white">Incident Banner</h2>
                                <p className="text-2xs text-surface-400 mt-0.5">Displayed above login form as a 2-line alert</p>
                            </div>
                            <button onClick={() => setActiveModal(null)} className="p-1 hover:bg-surface-100 dark:hover:bg-dark-hover rounded-lg text-surface-400" title="Close (Esc)">
                                <Icons.Close size={18} />
                            </button>
                        </div>

                        {/* Live preview */}
                        <div className={`rounded-xl px-3.5 py-2.5 border ${bannerEnabled ? 'bg-amber-400/90 border-amber-300 text-amber-950' : 'bg-surface-100 dark:bg-dark-hover border-surface-200 dark:border-dark-border text-surface-400'}`}>
                            <div className="flex items-center gap-2">
                                <Icons.AlertCircle className="shrink-0 text-amber-950" size={16} />
                                <div className="min-w-0">
                                    <p className="font-semibold text-xs leading-tight truncate">{bannerTitle || 'Banner title'}</p>
                                    <p className="text-2xs opacity-80 leading-tight line-clamp-1 mt-0.5">{bannerMessage || 'Banner message'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Enable toggle */}
                        <label className="flex items-center justify-between cursor-pointer py-1">
                            <span className="text-xs font-semibold text-surface-700 dark:text-surface-300">Show banner on login page</span>
                            <div
                                onClick={() => setBannerEnabled(v => !v)}
                                className={`w-10 h-5 rounded-full transition-colors ${bannerEnabled ? 'bg-brand-600' : 'bg-surface-300 dark:bg-dark-border'} relative cursor-pointer`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-xs transition-transform ${bannerEnabled ? 'translate-x-5' : ''}`} />
                            </div>
                        </label>

                        {/* Title */}
                        <div>
                            <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1">Title (line 1)</label>
                            <input
                                type="text"
                                value={bannerTitle}
                                onChange={e => setBannerTitle(e.target.value)}
                                maxLength={80}
                                placeholder="e.g. VPN Service Disruption"
                                className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-dark-border bg-surface-50 dark:bg-dark-surface text-surface-900 dark:text-white text-xs focus:outline-none focus:border-brand-400"
                            />
                        </div>

                        {/* Message */}
                        <div>
                            <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1">Message (line 2)</label>
                            <textarea
                                value={bannerMessage}
                                onChange={e => setBannerMessage(e.target.value)}
                                maxLength={200}
                                rows={2}
                                placeholder="e.g. Our team is resolving the issue. Use the VPN Assistant after login."
                                className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-dark-border bg-surface-50 dark:bg-dark-surface text-surface-900 dark:text-white text-xs focus:outline-none focus:border-brand-400 resize-none"
                            />
                            <p className="text-2xs text-surface-400 mt-1">{bannerMessage.length}/200</p>
                        </div>

                        <div className="flex gap-2.5 pt-2">
                            <button onClick={() => setActiveModal(null)} className="flex-1 py-2 rounded-lg border border-surface-200 dark:border-dark-border text-surface-600 dark:text-surface-300 text-xs font-medium hover:bg-surface-50 dark:hover:bg-dark-hover transition-colors">Cancel (Esc)</button>
                            <button onClick={saveBanner} disabled={bannerSaving} className="flex-1 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-40 text-white text-xs font-semibold transition-all shadow-xs">
                                {bannerSaving ? 'Saving…' : 'Save Banner'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {activeModal === 'broadcast' && <SystemBroadcastModal onClose={() => setActiveModal(null)} />}
            {activeModal === 'status' && <ServiceStatusManager onClose={() => setActiveModal(null)} />}
            {activeModal === 'staff' && <StaffManager onClose={() => setActiveModal(null)} />}
            {activeModal === 'leads' && <TeamLeadManager onClose={() => setActiveModal(null)} />}
            {activeModal === 'cats' && <CategoryManager onClose={() => setActiveModal(null)} />}
            {activeModal === 'shortcuts' && <ShortcutManager onClose={() => setActiveModal(null)} />}
            {activeModal === 'macros' && <MacroManager onClose={() => setActiveModal(null)} />}
            {activeModal === 'autoroute' && <AutoRouteManager onClose={() => setActiveModal(null)} />}
            {activeModal === 'triage' && <TriageManager onClose={() => setActiveModal(null)} />}
            {activeModal === 'feedback' && (
                <div className="fixed inset-0 z-50 bg-surface-50 dark:bg-dark-bg flex flex-col overflow-hidden">
                    <FeedbackManager initialFilter="feedback" onClose={() => setActiveModal(null)} />
                </div>
            )}
            {activeModal === 'db' && <DatabaseManager onClose={() => setActiveModal(null)} />}
            {activeModal === 'ai_provider' && <AiProviderSettingsModal onClose={() => setActiveModal(null)} />}
        </div>
    );
};
