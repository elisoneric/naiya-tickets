import React, { useState } from 'react';
import { Icons } from '../common/Icons';
import { OutlookHeader } from '../layout/OutlookHeader';
import { SupportMessengerWidget } from './SupportMessengerWidget';
import { knowledgeBase, KBArticle } from '../../services/knowledgeBase';
import { useAuth } from '../../contexts/AuthContext';
import { useTickets } from '../../contexts/TicketContext';
import { VpnAssistant } from './VpnAssistant';
import { KbArticleModal } from './KbArticleModal';
import { NimcLoginAssistant } from './NimcLoginAssistant';
import { WebmailAssistant } from './WebmailAssistant';
import { PayPortalModal } from './PayPortalModal';
import { ChatPage } from '../../pages/ChatPage';
import { AgentOnboardingGuide } from '../admin/AgentOnboardingGuide';
import { useToast } from '../../contexts/ToastContext';
import { createNewTicket } from '../../services/ticketService';

export const HelpCenterLayout: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const { user } = useAuth();
    const { tickets, triageCategories } = useTickets();
    const { showToast } = useToast();
    
    const [activeFlow, setActiveFlow] = useState<'vpn' | 'nimc' | 'webmail' | 'history' | 'pay' | null>(null);

    const myOpenTickets = tickets.filter(t => 
        t.createdByEmail?.toLowerCase() === user?.email?.toLowerCase() && t.status !== 'Closed'
    );

    const handleRevertToManual = async (description: string, autoSubmit: boolean = false, category?: string) => {
        if (autoSubmit) {
            try {
                let finalCategory = category || 'Others';
                if (!category) {
                    if (activeFlow === 'vpn') finalCategory = 'VPN Related';
                    else if (activeFlow === 'nimc') finalCategory = 'NIMC Login Details';
                    else if (activeFlow === 'webmail') finalCategory = 'WEBMAIL';
                }

                await createNewTicket({
                    title: "Automated Protocol Esc",
                    category: finalCategory,
                    description,
                    createdByName: user?.name || 'User',
                    createdByEmail: user?.email || 'unknown',
                    project: 'Dont Know',
                    attachments: []
                });
                showToast("Your ticket has been sent to support staff.", "success");
            } catch (err) {
                console.error(err);
                showToast("Failed to auto-submit ticket.", "error");
            }
        }
    };
    const [selectedKb, setSelectedKb] = useState<KBArticle | null>(null);

    React.useEffect(() => {
        const h = () => setActiveFlow('history');
        const vpnH = () => setActiveFlow('vpn');
        const nimcH = () => setActiveFlow('nimc');
        const webmailH = () => setActiveFlow('webmail');
        const payH = () => setActiveFlow('pay');
        const kbH = (e: CustomEvent<KBArticle>) => {
            if (e.detail) setSelectedKb(e.detail);
        };
        
        window.addEventListener('open-ticket-history', h);
        window.addEventListener('open-vpn-assistant', vpnH);
        window.addEventListener('open-nimc-assistant', nimcH);
        window.addEventListener('open-webmail-assistant', webmailH);
        window.addEventListener('open-pay-portal', payH);
        window.addEventListener('open-kb-article', kbH as EventListener);
        
        return () => {
            window.removeEventListener('open-ticket-history', h);
            window.removeEventListener('open-vpn-assistant', vpnH);
            window.removeEventListener('open-nimc-assistant', nimcH);
            window.removeEventListener('open-webmail-assistant', webmailH);
            window.removeEventListener('open-pay-portal', payH);
            window.removeEventListener('open-kb-article', kbH as EventListener);
        };
    }, []);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (selectedKb) {
                    setSelectedKb(null);
                    return;
                }
                if (activeFlow) {
                    setActiveFlow(null);
                    return;
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedKb, activeFlow]);

    const filteredKB = knowledgeBase.filter(article => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return article.topic.toLowerCase().includes(q) || article.keywords.some(k => k.toLowerCase().includes(q));
    });

    const vpnCat = triageCategories?.find(c => c.presetCategory === 'VPN Related' || c.title === 'VPN Related');
    const nimcCat = triageCategories?.find(c => c.presetCategory === 'NIMC Login Details' || c.title === 'NIMC Login Details');
    const webmailCat = triageCategories?.find(c => c.presetCategory === 'WEBMAIL' || c.title === 'WEBMAIL');
    const payCat = triageCategories?.find(c => 
        c.presetCategory === 'Payment & Statement Portal' || 
        c.presetCategory === 'Payment & Work Report' || 
        c.title === 'Payment & Statement Portal' || 
        c.title === 'Payment & Work Report'
    );

    const handleFlowClick = (flow: 'vpn' | 'nimc' | 'webmail') => {
        if (flow === 'vpn' && vpnCat?.disabled) {
            showToast(vpnCat.disabledMessage || "Service is currently not available due to network maintenance.", "error");
            return;
        }
        if (flow === 'nimc' && nimcCat?.disabled) {
            showToast(nimcCat.disabledMessage || "Service is currently not available due to network maintenance.", "error");
            return;
        }
        if (flow === 'webmail' && webmailCat?.disabled) {
            showToast(webmailCat.disabledMessage || "Service is currently not available due to network maintenance.", "error");
            return;
        }
        setActiveFlow(flow);
    };

    return (
        <div className="flex flex-col min-h-[100dvh] bg-surface-50 dark:bg-dark-bg font-sans selection:bg-brand-500/30">
            <OutlookHeader />
            
            <main className="flex-1 pb-24">
                {/* Hero section */}
                <div className="bg-gradient-to-b from-brand-700 via-brand-600 to-brand-800 text-white pt-14 pb-20 px-6 relative overflow-hidden shrink-0 shadow-lg">
                    <div className="max-w-4xl mx-auto relative z-10 text-center space-y-4">
                        <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs font-bold uppercase tracking-wider backdrop-blur-md border border-white/20">
                            Support & Help Center
                        </span>
                        
                        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
                            Hi {user?.name?.split(' ')[0] || 'Partner'}, how can we help?
                        </h1>
                        
                        <p className="text-white/80 text-sm md:text-base max-w-xl mx-auto font-medium">
                            Choose an automated fix below, search articles, or submit a request directly to IT staff.
                        </p>

                        {/* Search Bar */}
                        <div className="relative max-w-2xl mx-auto mt-6 shadow-2xl rounded-2xl group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-500 transition-colors">
                                <Icons.Search size={22} />
                            </div>
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search articles, setup instructions, or error codes..."
                                className="w-full pl-12 pr-4 py-4 md:py-5 rounded-2xl text-base md:text-lg bg-white dark:bg-slate-900 border-none focus:ring-4 focus:ring-brand-400/40 outline-none transition-all text-slate-900 dark:text-white placeholder-gray-400 shadow-xl"
                            />
                        </div>

                        {/* Fast Action Buttons */}
                        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                            <button 
                                onClick={() => window.dispatchEvent(new CustomEvent('open-support-chat'))}
                                className="flex items-center gap-2 px-6 py-3 bg-white text-brand-700 hover:bg-white/95 rounded-2xl text-sm font-black transition-all shadow-xl hover:scale-105"
                            >
                                <Icons.Message size={18} />
                                <span>New Request / Chat with AI</span>
                            </button>

                            <button 
                                onClick={() => setActiveFlow('history')} 
                                className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-sm font-bold transition-all backdrop-blur-sm border border-white/20 shadow-md"
                            >
                                <Icons.Ticket size={18} />
                                <span>My Tickets</span>
                                {myOpenTickets.length > 0 && (
                                    <span className="px-2 py-0.5 rounded-full bg-brand-500 text-white text-xs font-black">
                                        {myOpenTickets.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="max-w-5xl mx-auto px-6 -mt-8 relative z-20 space-y-12">
                    {/* Top Priority Action Cards: 3 inline on Row 1, next card goes down to Row 2 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
                        
                        {/* VPN Card */}
                        <button 
                            onClick={() => handleFlowClick('vpn')}
                            className={`relative bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-lg border transition-all text-left group flex flex-col items-start overflow-hidden ${
                                vpnCat?.disabled
                                    ? 'border-amber-200 dark:border-amber-700/50 opacity-90'
                                    : 'border-gray-100 dark:border-white/10 hover:shadow-2xl hover:border-brand-500 dark:hover:border-brand-500 hover:-translate-y-1'
                            }`}
                        >
                            {vpnCat?.disabled && (
                                <div className="absolute top-0 left-0 right-0 bg-amber-400/90 dark:bg-amber-600/90 text-white text-[10px] font-bold text-center py-1 tracking-widest uppercase flex items-center justify-center gap-1">
                                    <Icons.Alert size={12} /> Maintenance
                                </div>
                            )}
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform ${vpnCat?.disabled ? 'mt-4 bg-amber-50 dark:bg-amber-900/20 text-amber-500' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:scale-110'}`}>
                                <Icons.Shield size={28} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">VPN Troubleshooting</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                {vpnCat?.disabled
                                    ? (vpnCat.disabledMessage || 'Service temporarily unavailable.')
                                    : 'Fix connection drops, credentials, and network certificates with our auto-tool.'}
                            </p>
                        </button>

                        {/* NIMC Card */}
                        <button 
                            onClick={() => handleFlowClick('nimc')}
                            className={`relative bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-lg border transition-all text-left group flex flex-col items-start overflow-hidden ${
                                nimcCat?.disabled
                                    ? 'border-amber-200 dark:border-amber-700/50 opacity-90'
                                    : 'border-gray-100 dark:border-white/10 hover:shadow-2xl hover:border-brand-500 dark:hover:border-brand-500 hover:-translate-y-1'
                            }`}
                        >
                            {nimcCat?.disabled && (
                                <div className="absolute top-0 left-0 right-0 bg-amber-400/90 dark:bg-amber-600/90 text-white text-[10px] font-bold text-center py-1 tracking-widest uppercase flex items-center justify-center gap-1">
                                    <Icons.Alert size={12} /> Maintenance
                                </div>
                            )}
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform ${nimcCat?.disabled ? 'mt-4 bg-amber-50 dark:bg-amber-900/20 text-amber-500' : 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 group-hover:scale-110'}`}>
                                <Icons.User size={28} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">NIMC Login Support</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                {nimcCat?.disabled
                                    ? (nimcCat.disabledMessage || 'Service temporarily unavailable.')
                                    : 'Reset passwords, verify metadata status, and resolve enrollment blacklist errors.'}
                            </p>
                        </button>

                        {/* Webmail Card */}
                        <button 
                            onClick={() => handleFlowClick('webmail')}
                            className={`relative bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-lg border transition-all text-left group flex flex-col items-start overflow-hidden ${
                                webmailCat?.disabled
                                    ? 'border-amber-200 dark:border-amber-700/50 opacity-90'
                                    : 'border-gray-100 dark:border-white/10 hover:shadow-2xl hover:border-brand-500 dark:hover:border-brand-500 hover:-translate-y-1'
                            }`}
                        >
                            {webmailCat?.disabled && (
                                <div className="absolute top-0 left-0 right-0 bg-amber-400/90 dark:bg-amber-600/90 text-white text-[10px] font-bold text-center py-1 tracking-widest uppercase flex items-center justify-center gap-1">
                                    <Icons.Alert size={12} /> Maintenance
                                </div>
                            )}
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform ${webmailCat?.disabled ? 'mt-4 bg-amber-50 dark:bg-amber-900/20 text-amber-500' : 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 group-hover:scale-110'}`}>
                                <Icons.Inbox size={28} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">Webmail Access</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                {webmailCat?.disabled
                                    ? (webmailCat.disabledMessage || 'Service temporarily unavailable.')
                                    : 'Restore access to official Naiya webmail and reset company mailbox passwords.'}
                            </p>
                        </button>

                        {/* Payment & Work Report Card - Row 2 (the next goes down) */}
                        <button 
                            onClick={() => {
                                if (payCat?.disabled) {
                                    showToast(payCat.disabledMessage || "Payment & Work Report portal is temporarily undergoing scheduled maintenance.", "error");
                                    return;
                                }
                                setActiveFlow('pay');
                            }}
                            className={`relative bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-lg border transition-all text-left group flex flex-col sm:flex-row sm:items-center justify-between gap-4 overflow-hidden md:col-span-3 ${
                                payCat?.disabled
                                    ? 'border-amber-300 dark:border-amber-700/60 bg-amber-50/20 dark:bg-amber-900/10'
                                    : 'border-gray-100 dark:border-white/10 hover:shadow-2xl hover:border-emerald-500 dark:hover:border-emerald-500 hover:-translate-y-1'
                            }`}
                        >
                            <div className="flex items-center gap-4 min-w-0">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform shrink-0 ${
                                    payCat?.disabled
                                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                        : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 group-hover:scale-110'
                                }`}>
                                    <Icons.CreditCard size={28} />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Payment & Work Report</h3>
                                        {payCat?.disabled ? (
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 animate-pulse">
                                                MAINTENANCE
                                            </span>
                                        ) : (
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                NA'IYA & SAMUIKY
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-1">
                                        {payCat?.disabled
                                            ? (payCat.disabledMessage || 'Payment & Work Report portal is temporarily undergoing scheduled maintenance.')
                                            : 'Check verified enrollment counts, work volume, and monthly disbursement reports under NIMC license.'}
                                    </p>
                                </div>
                            </div>
                            <div className={`flex items-center gap-2 text-xs font-bold shrink-0 self-end sm:self-auto px-3.5 py-2 rounded-xl border ${
                                payCat?.disabled
                                    ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
                                    : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800'
                            }`}>
                                <span>{payCat?.disabled ? 'Maintenance Mode' : 'Open Reporter'}</span>
                                <Icons.Back size={14} className="rotate-180 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </button>
                    </div>

                    {/* Knowledge Base Section */}
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center gap-2">
                            <Icons.Document size={24} className="text-brand-500" />
                            <span>Quick Knowledge Base</span>
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredKB.length > 0 ? filteredKB.map(article => (
                                <button 
                                    key={article.id}
                                    onClick={() => setSelectedKb(article)}
                                    className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm hover:shadow-md hover:border-brand-200 dark:border-brand-800 transition-all flex flex-col items-start group text-left"
                                >
                                    <h3 className="text-base font-bold text-slate-800 dark:text-gray-100 mb-2 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{article.topic}</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                                        {article.resolutionText}
                                    </p>
                                </button>
                            )) : (
                                <div className="col-span-full py-12 text-center text-gray-500">
                                    <Icons.Search size={40} className="mx-auto mb-3 opacity-20" />
                                    <p className="text-base font-semibold text-gray-700 dark:text-gray-300">No matching articles found</p>
                                    <p className="text-xs mt-1 mb-4">Try searching another term or talk directly to support.</p>
                                    <button 
                                        onClick={() => window.dispatchEvent(new CustomEvent('open-support-chat'))}
                                        className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-sm transition-colors inline-flex items-center gap-2 shadow-sm"
                                    >
                                        <Icons.Message size={16} />
                                        Chat with AI Support
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {activeFlow === 'vpn' && <VpnAssistant onClose={() => setActiveFlow(null)} project="Dont Know" onRevertToManual={handleRevertToManual} isDisabled={vpnCat?.disabled} disabledMessage={vpnCat?.disabledMessage} />}
            {activeFlow === 'nimc' && <NimcLoginAssistant onClose={() => setActiveFlow(null)} isDisabled={nimcCat?.disabled} disabledMessage={nimcCat?.disabledMessage} />}
            {activeFlow === 'webmail' && <WebmailAssistant onClose={() => setActiveFlow(null)} />}
            {activeFlow === 'pay' && <PayPortalModal onClose={() => setActiveFlow(null)} isDisabled={payCat?.disabled} disabledMessage={payCat?.disabledMessage} />}
            {activeFlow === 'history' && <ChatPage onClose={() => setActiveFlow(null)} />}
            {selectedKb && <KbArticleModal article={selectedKb} onClose={() => setSelectedKb(null)} />}

            <SupportMessengerWidget hidden={!!activeFlow || !!selectedKb} />
            <AgentOnboardingGuide />
        </div>
    );
};
