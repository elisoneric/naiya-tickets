import React, { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';
import { getGeneralSettings, saveGeneralSettings } from '../../services/storageService';
import { useToast } from '../../contexts/ToastContext';
import { useTickets } from '../../contexts/TicketContext';
import { TriageCategory } from '../../types';

// The key categories we want to surface prominently in this panel
const TRACKED_SERVICES = [
    {
        presetCategory: 'VPN Related',
        label: 'VPN Service',
        description: 'Auto-swap, credential lookup, and VPN ticket escalation.',
        icon: Icons.Shield,
        color: 'blue',
    },
    {
        presetCategory: 'Payment & Statement Portal',
        label: 'Payment & Work Report',
        description: 'Self-service enroller volume, statement verification, and pay portal.',
        icon: Icons.CreditCard,
        color: 'emerald',
    },
    {
        presetCategory: 'NIMC Login Details',
        label: 'NIMC / Metadata Check',
        description: 'Metadata status verification and NIMC login reset tickets.',
        icon: Icons.User,
        color: 'purple',
    },
    {
        presetCategory: 'WEBMAIL',
        label: 'Webmail Support',
        description: 'Webmail password resets and email access tickets.',
        icon: Icons.Inbox,
        color: 'orange',
    },
    {
        presetCategory: 'Metadata Onboarding',
        label: 'Metadata Onboarding',
        description: 'Agent upload requests and training registration.',
        icon: Icons.Agents,
        color: 'green',
    },
    {
        presetCategory: 'Device & Activation Related',
        label: 'Device & Activation',
        description: 'Device activation, onboarding, and reactivation workflows.',
        icon: Icons.Briefcase,
        color: 'teal',
    },
    {
        presetCategory: 'Others',
        label: 'General Support (Others)',
        description: 'Catch-all category for miscellaneous support tickets.',
        icon: Icons.Chat,
        color: 'gray',
    },
];

const COLOR_MAP: Record<string, { ring: string; bg: string; iconBg: string; iconText: string; badge: string }> = {
    blue:    { ring: 'ring-blue-500',    bg: 'bg-blue-50 dark:bg-blue-900/20',       iconBg: 'bg-blue-100 dark:bg-blue-900/40',       iconText: 'text-blue-600 dark:text-blue-400',       badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
    emerald: { ring: 'ring-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', iconText: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' },
    purple:  { ring: 'ring-purple-500',  bg: 'bg-purple-50 dark:bg-purple-900/20',   iconBg: 'bg-purple-100 dark:bg-purple-900/40',   iconText: 'text-purple-600 dark:text-purple-400',   badge: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' },
    orange:  { ring: 'ring-orange-500',  bg: 'bg-orange-50 dark:bg-orange-900/20',   iconBg: 'bg-orange-100 dark:bg-orange-900/40',   iconText: 'text-orange-600 dark:text-orange-400',   badge: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' },
    green:   { ring: 'ring-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', iconText: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' },
    teal:    { ring: 'ring-teal-500',    bg: 'bg-teal-50 dark:bg-teal-900/20',       iconBg: 'bg-teal-100 dark:bg-teal-900/40',       iconText: 'text-teal-600 dark:text-teal-400',       badge: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300' },
    gray:    { ring: 'ring-gray-400',    bg: 'bg-gray-50 dark:bg-gray-800/40',       iconBg: 'bg-gray-100 dark:bg-gray-700/60',       iconText: 'text-gray-600 dark:text-gray-400',       badge: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' },
};

export const ServiceStatusManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [categories, setCategories] = useState<TriageCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [editingMessage, setEditingMessage] = useState<Record<string, string>>({});
    
    // Global Site Maintenance Mode states
    const [siteMaintenanceMode, setSiteMaintenanceMode] = useState(false);
    const [siteMaintenanceMessage, setSiteMaintenanceMessage] = useState('');
    const [savingSiteMaintenance, setSavingSiteMaintenance] = useState(false);
    const [savingSiteMaintenanceMsg, setSavingSiteMaintenanceMsg] = useState(false);

    const { showToast } = useToast();
    const { updateCategoriesList } = useTickets();

    useEffect(() => {
        loadSettings();
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

    const loadSettings = async () => {
        setLoading(true);
        try {
            const settings = await getGeneralSettings();
            const cats = settings.triageCategories || [];
            setCategories(cats);
            setSiteMaintenanceMode(!!settings.siteMaintenanceMode);
            setSiteMaintenanceMessage(settings.siteMaintenanceMessage || 'System Under Scheduled Maintenance. The IT Technical Team is performing scheduled system upgrades. Regular services and agent portals will resume shortly.');

            // Pre-fill local message state
            const msgs: Record<string, string> = {};
            cats.forEach(c => {
                const key = c.presetCategory || c.title;
                msgs[key] = c.disabledMessage || '';
            });
            setEditingMessage(msgs);
        } catch {
            showToast('Failed to load service status settings.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const findCat = (presetOrTitle: string) => {
        return categories.find(
            c => c.presetCategory === presetOrTitle || c.title === presetOrTitle
        );
    };

    const toggleSiteMaintenance = async (currentMode: boolean) => {
        setSavingSiteMaintenance(true);
        try {
            const settings = await getGeneralSettings();
            const updatedMode = !currentMode;
            const updatedSettings = {
                ...settings,
                siteMaintenanceMode: updatedMode,
                siteMaintenanceMessage: siteMaintenanceMessage.trim() || 'System Under Scheduled Maintenance. The IT Technical Team is performing scheduled system upgrades. Regular services and agent portals will resume shortly.'
            };

            await saveGeneralSettings(updatedSettings);
            setSiteMaintenanceMode(updatedMode);
            window.dispatchEvent(new CustomEvent('site-maintenance-updated', { detail: { mode: updatedMode } }));
            showToast(
                updatedMode
                    ? 'FULL SITE MAINTENANCE MODE IS NOW ACTIVE'
                    : 'FULL SITE MAINTENANCE MODE DEACTIVATED — SITE IS LIVE',
                updatedMode ? 'info' : 'success'
            );
        } catch (e) {
            showToast('Failed to update full site maintenance status.', 'error');
        } finally {
            setSavingSiteMaintenance(false);
        }
    };

    const saveSiteMaintenanceMessage = async () => {
        setSavingSiteMaintenanceMsg(true);
        try {
            const settings = await getGeneralSettings();
            const updatedSettings = {
                ...settings,
                siteMaintenanceMessage: siteMaintenanceMessage.trim()
            };
            await saveGeneralSettings(updatedSettings);
            window.dispatchEvent(new CustomEvent('site-maintenance-updated', { detail: { mode: siteMaintenanceMode } }));
            showToast('Global maintenance announcement saved.', 'success');
        } catch (e) {
            showToast('Failed to save announcement.', 'error');
        } finally {
            setSavingSiteMaintenanceMsg(false);
        }
    };

    const toggleService = async (presetCategory: string, currentDisabled: boolean) => {
        setSaving(presetCategory);
        try {
            const settings = await getGeneralSettings();
            let found = false;
            let updated = (settings.triageCategories || []).map(c => {
                if (c.presetCategory === presetCategory || c.title === presetCategory) {
                    found = true;
                    return {
                        ...c,
                        disabled: !currentDisabled,
                        disabledMessage: editingMessage[presetCategory] || c.disabledMessage || 'This service is temporarily unavailable. Please check back later.',
                    };
                }
                return c;
            });

            if (!found) {
                // Auto-create category in triage categories so admin can toggle immediately
                updated.push({
                    id: `tc_${Date.now()}`,
                    title: presetCategory,
                    presetCategory: presetCategory,
                    description: `Service access for ${presetCategory}`,
                    type: 'manual',
                    disabled: !currentDisabled,
                    disabledMessage: editingMessage[presetCategory] || 'This service is temporarily unavailable. Please check back later.',
                });
            }

            await saveGeneralSettings({ ...settings, triageCategories: updated });
            setCategories(updated);
            updateCategoriesList();
            showToast(
                currentDisabled
                    ? `${presetCategory} is now LIVE`
                    : `${presetCategory} is now in MAINTENANCE MODE`,
                currentDisabled ? 'success' : 'info'
            );
        } catch (e) {
            showToast('Failed to update service status.', 'error');
        } finally {
            setSaving(null);
        }
    };

    const saveMessage = async (presetCategory: string) => {
        setSaving(presetCategory + '_msg');
        try {
            const settings = await getGeneralSettings();
            let found = false;
            let updated = (settings.triageCategories || []).map(c => {
                if (c.presetCategory === presetCategory || c.title === presetCategory) {
                    found = true;
                    return { ...c, disabledMessage: editingMessage[presetCategory] || '' };
                }
                return c;
            });

            if (!found) {
                updated.push({
                    id: `tc_${Date.now()}`,
                    title: presetCategory,
                    presetCategory: presetCategory,
                    description: `Service access for ${presetCategory}`,
                    type: 'manual',
                    disabled: true,
                    disabledMessage: editingMessage[presetCategory] || '',
                });
            }

            await saveGeneralSettings({ ...settings, triageCategories: updated });
            setCategories(updated);
            updateCategoriesList();
            showToast('Message saved.', 'success');
        } catch (e) {
            showToast('Failed to save message.', 'error');
        } finally {
            setSaving(null);
        }
    };

    const disabledCount = TRACKED_SERVICES.filter(s => findCat(s.presetCategory)?.disabled).length;

    return (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-0 sm:p-4 font-sans">
            <div className="bg-surface-0 dark:bg-dark-card border border-surface-200 dark:border-dark-border rounded-none sm:rounded-2xl shadow-modal w-full max-w-3xl flex flex-col h-full sm:h-auto max-h-[100dvh] sm:max-h-[90vh] animate-scale-in overflow-hidden">

                {/* Header */}
                <div className="flex justify-between items-start p-4 sm:p-6 border-b border-surface-200 dark:border-dark-border bg-surface-50/60 dark:bg-dark-card shrink-0">
                    <div className="flex items-start gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm shrink-0">
                            <Icons.Settings size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-bold text-surface-900 dark:text-dark-textPrimary flex items-center gap-2 flex-wrap">
                                Service & System Status Control
                                {siteMaintenanceMode && (
                                    <span className="text-[11px] bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-bold px-2.5 py-0.5 rounded-full border border-red-300 dark:border-red-800 animate-pulse">
                                        FULL SITE MAINTENANCE
                                    </span>
                                )}
                                {disabledCount > 0 && !siteMaintenanceMode && (
                                    <span className="text-[11px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-700/40 animate-pulse">
                                        {disabledCount} SERVICE(S) IN MAINTENANCE
                                    </span>
                                )}
                            </h2>
                            <p className="text-xs sm:text-sm text-surface-500 dark:text-dark-textMuted mt-0.5">
                                Instantly pause individual services or activate full site maintenance mode across the entire platform.
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-dark-hover p-2 rounded-lg transition-colors shrink-0" title="Close (Esc)">
                        <Icons.Close size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 bg-surface-50/50 dark:bg-dark-bg">
                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <Icons.Refresh className="animate-spin text-brand-500" size={32} />
                        </div>
                    ) : (
                        <>
                            {/* MASTER CONTROL: FULL SITE MAINTENANCE MODE */}
                            <div className={`rounded-2xl border-2 transition-all duration-300 overflow-hidden shadow-sm ${
                                siteMaintenanceMode
                                    ? 'border-red-400 dark:border-red-600/80 bg-red-50/60 dark:bg-red-950/20'
                                    : 'border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface'
                            }`}>
                                <div className="p-5 flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                                        siteMaintenanceMode
                                            ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                                            : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                                    }`}>
                                        <Icons.Alert size={24} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-bold text-gray-900 dark:text-white text-base">Full Site Maintenance Mode</h3>
                                            <span className={`text-[11px] font-black tracking-wider uppercase px-2.5 py-0.5 rounded-full ${
                                                siteMaintenanceMode
                                                    ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                                                    : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                            }`}>
                                                {siteMaintenanceMode ? 'ACTIVE — USERS BLOCKED' : 'ONLINE & LIVE'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            {siteMaintenanceMode
                                                ? 'Public access, ticket creation, and self-service are currently blocked. IT Staff and Administrators maintain dashboard access.'
                                                : 'Turn this on to show a full-screen maintenance notice to all regular users and field agents during major system upgrades.'}
                                        </p>
                                    </div>

                                    {/* Toggle Switch */}
                                    <div className="shrink-0 flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => toggleSiteMaintenance(siteMaintenanceMode)}
                                            disabled={savingSiteMaintenance}
                                            className={`relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${
                                                siteMaintenanceMode
                                                    ? 'bg-red-600 focus:ring-red-500'
                                                    : 'bg-slate-300 dark:bg-slate-700 focus:ring-slate-400'
                                            }`}
                                        >
                                            {savingSiteMaintenance ? (
                                                <span className="absolute inset-0 flex items-center justify-center">
                                                    <Icons.Refresh size={14} className="animate-spin text-white" />
                                                </span>
                                            ) : (
                                                <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${
                                                    siteMaintenanceMode ? 'left-8' : 'left-1'
                                                }`} />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Custom Announcement Editor (shown when active or expandable) */}
                                {siteMaintenanceMode && (
                                    <div className="px-5 pb-5 pt-3 border-t border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/10 space-y-2">
                                        <label className="block text-xs font-bold text-red-800 dark:text-red-300 flex items-center gap-1.5">
                                            <Icons.Message size={14} />
                                            Full-Page Maintenance Notice to Public Users:
                                        </label>
                                        <div className="flex gap-2">
                                            <textarea
                                                rows={2}
                                                value={siteMaintenanceMessage}
                                                onChange={e => setSiteMaintenanceMessage(e.target.value)}
                                                placeholder="e.g. System Under Scheduled Maintenance. The IT Technical Team is performing scheduled system upgrades. Regular services will resume shortly."
                                                className="flex-1 text-xs px-3.5 py-2.5 rounded-xl bg-white dark:bg-dark-card border border-red-200 dark:border-red-800 focus:ring-2 focus:ring-red-400 outline-none text-gray-900 dark:text-white placeholder-gray-400 resize-none leading-relaxed"
                                            />
                                            <button
                                                type="button"
                                                onClick={saveSiteMaintenanceMessage}
                                                disabled={savingSiteMaintenanceMsg}
                                                className="shrink-0 px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-60 self-start"
                                            >
                                                {savingSiteMaintenanceMsg ? <Icons.Refresh size={14} className="animate-spin" /> : 'Save Notice'}
                                            </button>
                                        </div>
                                        <p className="text-[11px] text-red-700/80 dark:text-red-400/80">
                                            This message appears in prominent typography on the full-screen maintenance overlay for visitors and field agents.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Section Subheading */}
                            <div className="pt-2 flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-surface-400 dark:text-surface-500">
                                    Individual Module & Service Controls
                                </h4>
                                <span className="text-[11px] text-surface-400">
                                    {TRACKED_SERVICES.length} Controlled Services
                                </span>
                            </div>

                            {/* Service Cards */}
                            {TRACKED_SERVICES.map(service => {
                                const cat = findCat(service.presetCategory);
                                const isDisabled = cat?.disabled ?? false;
                                const isSavingToggle = saving === service.presetCategory;
                                const isSavingMsg = saving === service.presetCategory + '_msg';
                                const colors = COLOR_MAP[service.color] || COLOR_MAP.gray;

                                return (
                                    <div
                                        key={service.presetCategory}
                                        className={`rounded-xl border-2 transition-all duration-300 overflow-hidden ${
                                            isDisabled
                                                ? 'border-amber-300 dark:border-amber-600/60 bg-amber-50/50 dark:bg-amber-900/10'
                                                : 'border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface'
                                        }`}
                                    >
                                        {/* Top row */}
                                        <div className="p-4 flex items-center gap-4">
                                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isDisabled ? 'bg-amber-100 dark:bg-amber-900/30' : colors.iconBg}`}>
                                                <service.icon size={20} className={isDisabled ? 'text-amber-600 dark:text-amber-400' : colors.iconText} />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-bold text-gray-900 dark:text-white text-sm">{service.label}</h4>
                                                    {!cat && (
                                                        <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full font-medium">Ready</span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{service.description}</p>
                                            </div>

                                            {/* Status badge + toggle */}
                                            <div className="flex items-center gap-3 shrink-0">
                                                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                                                    isDisabled
                                                        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                                                        : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                }`}>
                                                    {isDisabled ? 'MAINTENANCE' : 'LIVE'}
                                                </span>

                                                {/* Toggle switch */}
                                                <button
                                                    onClick={() => toggleService(service.presetCategory, isDisabled)}
                                                    disabled={isSavingToggle}
                                                    className={`relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                                                        isDisabled
                                                            ? 'bg-amber-400 dark:bg-amber-500 focus:ring-amber-400'
                                                            : 'bg-emerald-500 focus:ring-emerald-400'
                                                    }`}
                                                >
                                                    {isSavingToggle ? (
                                                        <span className="absolute inset-0 flex items-center justify-center">
                                                            <Icons.Refresh size={12} className="animate-spin text-white" />
                                                        </span>
                                                    ) : (
                                                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${
                                                            isDisabled ? 'left-7' : 'left-1'
                                                        }`} />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expanded maintenance message editor */}
                                        {isDisabled && (
                                            <div className="px-4 pb-4 border-t border-amber-200 dark:border-amber-700/40 pt-3 bg-amber-50/70 dark:bg-amber-900/10">
                                                <label className="block text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
                                                    <Icons.Message size={12} />
                                                    Custom maintenance message shown to users & AI:
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={editingMessage[service.presetCategory] || ''}
                                                        onChange={e => setEditingMessage(prev => ({ ...prev, [service.presetCategory]: e.target.value }))}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                saveMessage(service.presetCategory);
                                                            }
                                                        }}
                                                        placeholder={`e.g. ${service.label} is currently undergoing technical maintenance. Please check back later.`}
                                                        className="flex-1 text-sm px-3 py-2 rounded-lg bg-surface-0 dark:bg-dark-card border border-amber-300 dark:border-amber-600/50 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none text-surface-900 dark:text-dark-textPrimary placeholder-surface-400"
                                                    />
                                                    <button
                                                        onClick={() => saveMessage(service.presetCategory)}
                                                        disabled={isSavingMsg}
                                                        className="shrink-0 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-60"
                                                    >
                                                        {isSavingMsg ? <Icons.Refresh size={14} className="animate-spin" /> : 'Save'}
                                                    </button>
                                                </div>
                                                <p className="text-[11px] text-amber-600/80 dark:text-amber-400/70 mt-1.5">
                                                    This message replaces ALL user interactions in this section — portal UI, AI chat, and direct lookup. Press Enter to save.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-surface-200 dark:border-dark-border flex justify-between items-center bg-surface-50/50 dark:bg-dark-card shrink-0">
                    <p className="text-xs text-surface-400 dark:text-dark-textMuted flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-pulse"></span>
                        Changes take effect immediately for all users.
                    </p>
                    <button
                        onClick={onClose}
                        className="bg-surface-100 hover:bg-surface-200 dark:bg-dark-hover dark:hover:bg-dark-border text-surface-700 dark:text-dark-textPrimary px-5 py-2 rounded-lg font-semibold text-sm transition-colors active:scale-95"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
