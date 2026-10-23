import React, { useState } from 'react';
import { Icons } from '../common/Icons';
import { NimcLoginAssistant } from '../user/NimcLoginAssistant';
import { WebmailAssistant } from '../user/WebmailAssistant';
import { VpnAssistant } from '../user/VpnAssistant';

export const AgentCreateTicketView: React.FC = () => {
    const [activeFlow, setActiveFlow] = useState<'vpn' | 'nimc' | 'webmail' | null>(null);

    const handleBack = () => setActiveFlow(null);

    if (activeFlow === 'vpn') {
        return (
            <div className="flex-1 h-full overflow-hidden bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-white/10 lg:border-none relative">
                <button onClick={handleBack} className="absolute inset-x-0 bottom-0 py-4 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-center font-bold shadow-md z-40 transition-colors">
                    Back to Options
                </button>
                <div className="absolute inset-0 pb-14 overflow-hidden">
                    <VpnAssistant onClose={handleBack} onRevertToManual={() => {}} project="Dont Know" />
                </div>
            </div>
        );
    }
    if (activeFlow === 'nimc') {
        return (
            <div className="flex-1 h-full overflow-hidden bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-white/10 lg:border-none relative">
                <button onClick={handleBack} className="absolute z-40 top-4 right-4 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold p-2 rounded-full transition-colors flex items-center justify-center">
                    <Icons.Close size={20} className="text-gray-600 dark:text-gray-300"/>
                </button>
                <div className="absolute inset-0 overflow-hidden">
                    <NimcLoginAssistant onClose={handleBack} />
                </div>
            </div>
        );
    }
    if (activeFlow === 'webmail') {
        return (
            <div className="flex-1 h-full overflow-hidden bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-white/10 lg:border-none relative">
                <button onClick={handleBack} className="absolute z-40 top-4 right-4 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold p-2 rounded-full transition-colors flex items-center justify-center">
                    <Icons.Close size={20} className="text-gray-600 dark:text-gray-300"/>
                </button>
                <div className="absolute inset-0 overflow-hidden bg-white dark:bg-slate-900">
                    <WebmailAssistant onClose={handleBack} />
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 h-full overflow-y-auto p-8 bg-[#f8f9fc] dark:bg-slate-900">
            <div className="max-w-4xl mx-auto space-y-8">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2 mb-2">
                        Create New Ticket
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">Select an area to quickly generate a specialized support request.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button 
                        onClick={() => setActiveFlow('vpn')}
                        id="guide-vpn-btn"
                        className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 hover:shadow-md hover:border-blue-500 transition-all text-left flex flex-col gap-4 group"
                    >
                        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Icons.Lock size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">VPN Services</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Create a ticket for generic VPN issues.</p>
                        </div>
                    </button>

                    <button 
                        onClick={() => setActiveFlow('nimc')}
                        id="guide-nimc-btn"
                        className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 hover:shadow-md hover:border-green-500 transition-all text-left flex flex-col gap-4 group"
                    >
                        <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Icons.User size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">NIMC Login</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Support for NIMC identity verification.</p>
                        </div>
                    </button>

                    <button 
                        onClick={() => setActiveFlow('webmail')}
                        id="guide-webmail-btn"
                        className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 hover:shadow-md hover:border-orange-500 transition-all text-left flex flex-col gap-4 group"
                    >
                        <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Icons.Sent size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Webmail</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Issues with corporate email accounts.</p>
                        </div>
                    </button>

                    <button 
                        onClick={() => {
                            window.dispatchEvent(new Event('open-ticket-history'));
                        }}
                        id="guide-custom-btn"
                        className="bg-brand-50 dark:bg-brand-900/20 p-6 rounded-2xl shadow-sm border border-brand-200 dark:border-brand-500/30 hover:border-brand-500 transition-all text-left flex flex-col gap-4 group"
                    >
                        <div className="w-12 h-12 bg-brand-600 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                            <Icons.Chat size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-brand-900 dark:text-brand-100 mb-1">Recent Requests</h3>
                            <p className="text-sm text-brand-700/80 dark:text-brand-300">View recent requests or history.</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};
