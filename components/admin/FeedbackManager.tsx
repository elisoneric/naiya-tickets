import React, { useState, useEffect } from 'react';
import { getSystemFeedback, resolveFeedback, addAgentToAllowlist, getFeedbackImage, approveAgentRecovery, setAgentPassword } from '../../services/storageService';
import { sendAgentApprovedEmail, sendAgentRejectedEmail, sendRecoveryPasswordEmail } from '../../services/emailService';
import { SystemFeedback } from '../../types';
import { Icons } from '../common/Icons';
import { useToast } from '../../contexts/ToastContext';

export type FeedbackFilter = 'all' | 'access' | 'recovery' | 'feedback';

export const FeedbackManager: React.FC<{ 
    onClose: () => void;
    initialFilter?: FeedbackFilter;
}> = ({ onClose, initialFilter = 'all' }) => {
    const [items, setItems] = useState<SystemFeedback[]>([]);
    const [activeTab, setActiveTab] = useState<FeedbackFilter>(initialFilter);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
    const [loadedImages, setLoadedImages] = useState<Record<string, string>>({});
    const [expandedImage, setExpandedImage] = useState<string | null>(null);
    const [comments, setComments] = useState<Record<string, string>>({});
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (expandedImage) {
                    setExpandedImage(null);
                    return;
                }
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [expandedImage, onClose]);

    const loadData = () => {
        setLoading(true);
        getSystemFeedback().then(data => {
            setItems(data);
            setLoading(false);
            // Automatically trigger image preloads for items with proof images
            data.forEach(item => {
                if (item.hasProofImage && !loadedImages[item.id]) {
                    if ((item as any).imageUrl) {
                        setLoadedImages(prev => ({ ...prev, [item.id]: (item as any).imageUrl }));
                    } else {
                        handleLoadImage(item.id);
                    }
                }
            });
        }).catch(e => {
            console.error("Failed to load access requests", e);
            setError(e.message || "Failed to load access requests");
            setLoading(false);
        });
    };

    const handleLoadImage = async (id: string) => {
        if (loadingImages.has(id) || loadedImages[id]) return;
        setLoadingImages(prev => new Set(prev).add(id));
        try {
            const image = await getFeedbackImage(id);
            if (image) {
                setLoadedImages(prev => ({ ...prev, [id]: image }));
            }
        } catch (e) {
            // Ignore background image load errors
        } finally {
            setLoadingImages(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleResolve = async (id: string) => {
        await resolveFeedback(id);
        setItems(prev => prev.map(i => i.id === id ? { ...i, isResolved: true } : i));
    };

    const handleApproveAgent = async (item: SystemFeedback) => {
        if (!confirm(`Approve ${item.email} as an agent?`)) return;
        
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, isResolved: true } : i));
        showToast(`Approving ${item.email}...`, 'info');

        try {
            await addAgentToAllowlist(item.email, '');
            await Promise.all([
                sendAgentApprovedEmail(item.email, comments[item.id]),
                resolveFeedback(item.id)
            ]);
            showToast(`Successfully approved ${item.email}`, 'success');
        } catch(e) {
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, isResolved: false } : i));
            showToast(`Failed to approve ${item.email}`, 'error');
        }
    };

    const handleApproveRecovery = async (item: SystemFeedback) => {
        if (!confirm(`Approve email recovery for ${item.email} to use alternative email ${item.name}?`)) return;
        
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, isResolved: true } : i));
        showToast(`Approving recovery for ${item.email}...`, 'info');

        try {
            await approveAgentRecovery(item.email, item.name, item.id);
            const tempPassword = 'Naiya' + Math.floor(1000 + Math.random() * 9000) + '!';
            await setAgentPassword(item.email, tempPassword);
            await sendRecoveryPasswordEmail(item.name, item.email, tempPassword, comments[item.id]);
            showToast(`Successfully approved recovery for ${item.email}`, 'success');
        } catch(e) {
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, isResolved: false } : i));
            showToast(`Failed to approve recovery for ${item.email}`, 'error');
        }
    };

    const handleRejectAgent = async (item: SystemFeedback) => {
        if (!confirm(`Reject access for ${item.email}?`)) return;
        
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, isResolved: true } : i));
        showToast(`Rejecting ${item.email}...`, 'info');

        try {
            await Promise.all([
                sendAgentRejectedEmail(item.email, comments[item.id]),
                resolveFeedback(item.id)
            ]);
            showToast(`Rejection sent to ${item.email}`, 'info');
        } catch(e) {
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, isResolved: false } : i));
            showToast(`Failed to send rejection to ${item.email}`, 'error');
        }
    };

    const filteredItems = items.filter(item => {
        if (activeTab === 'all') return true;
        if (activeTab === 'access') return item.type === 'agent_onboarding';
        if (activeTab === 'recovery') return item.type === 'email_recovery' || item.type === 'company_email_recovery';
        if (activeTab === 'feedback') return item.type === 'complaint' || (item.type !== 'agent_onboarding' && item.type !== 'email_recovery' && item.type !== 'company_email_recovery');
        return true;
    });

    const pendingItems = filteredItems.filter(i => !i.isResolved);

    const toggleSelectAll = () => {
        if (selectedIds.size === pendingItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(pendingItems.map(i => i.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const handleBulkApprove = async () => {
        const targetItems = filteredItems.filter(i => selectedIds.has(i.id) && !i.isResolved);
        if (targetItems.length === 0) return;
        if (!confirm(`Bulk approve ${targetItems.length} access requests?`)) return;

        setIsBulkProcessing(true);
        showToast(`Bulk approving ${targetItems.length} requests...`, 'info');

        try {
            for (const item of targetItems) {
                if (item.type === 'email_recovery' || item.type === 'company_email_recovery') {
                    await approveAgentRecovery(item.email, item.name, item.id);
                } else {
                    await addAgentToAllowlist(item.email, '');
                    await sendAgentApprovedEmail(item.email, comments[item.id]);
                }
                await resolveFeedback(item.id);
            }
            showToast(`Successfully bulk approved ${targetItems.length} requests`, 'success');
            setSelectedIds(new Set());
            loadData();
        } catch (e: any) {
            showToast(e.message || 'Bulk approval partially failed', 'error');
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const handleBulkReject = async () => {
        const targetItems = filteredItems.filter(i => selectedIds.has(i.id) && !i.isResolved);
        if (targetItems.length === 0) return;
        if (!confirm(`Bulk reject ${targetItems.length} requests?`)) return;

        setIsBulkProcessing(true);
        showToast(`Bulk rejecting ${targetItems.length} requests...`, 'info');

        try {
            for (const item of targetItems) {
                await sendAgentRejectedEmail(item.email, comments[item.id]);
                await resolveFeedback(item.id);
            }
            showToast(`Successfully rejected ${targetItems.length} requests`, 'info');
            setSelectedIds(new Set());
            loadData();
        } catch (e: any) {
            showToast(e.message || 'Bulk rejection failed', 'error');
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const handleCommentChange = (id: string, text: string) => {
        setComments(prev => ({ ...prev, [id]: text }));
    };

    const feedbackCount = items.filter(i => i.type === 'complaint' || (i.type !== 'agent_onboarding' && i.type !== 'email_recovery' && i.type !== 'company_email_recovery')).length;
    const accessCount = items.filter(i => i.type === 'agent_onboarding').length;
    const recoveryCount = items.filter(i => i.type === 'email_recovery' || i.type === 'company_email_recovery').length;

    return (
        <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-dark-bg overflow-hidden font-segoe">
             {/* Header */}
             <div className="p-5 border-b dark:border-dark-border flex justify-between items-center bg-white dark:bg-dark-surface shrink-0 shadow-sm">
                 <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center font-bold shadow-md">
                         {activeTab === 'feedback' ? <Icons.Complaint size={20} /> : <Icons.Shield size={20} />}
                     </div>
                     <div>
                         <h2 className="font-bold text-xl text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                             {activeTab === 'feedback' ? 'System Feedback & Complaints' : 'Access & Onboarding Requests'}
                         </h2>
                         <p className="text-xs text-slate-500 dark:text-slate-400">
                             {activeTab === 'feedback'
                                 ? 'View user suggestions, feedback, and access complaints submitted from the login page.'
                                 : 'Review, approve, or reject user access and email recovery requests.'}
                         </p>
                     </div>
                 </div>
                 <button 
                     onClick={onClose} 
                     className="flex items-center gap-2 px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors text-slate-600 dark:text-slate-300 text-xs font-bold"
                     title="Back to Admin Settings"
                 >
                     <Icons.Close size={18} />
                     <span>Back to Settings</span>
                 </button>
             </div>

             {/* Filter Navigation Tabs */}
             <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-100/80 dark:bg-dark-surface/60 border-b dark:border-dark-border overflow-x-auto text-xs font-semibold shrink-0">
                 <button
                     onClick={() => { setActiveTab('all'); setSelectedIds(new Set()); }}
                     className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                         activeTab === 'all'
                             ? 'bg-purple-600 text-white shadow-xs'
                             : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
                     }`}
                 >
                     <span>All</span>
                     <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'all' ? 'bg-purple-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                         {items.length}
                     </span>
                 </button>

                 <button
                     onClick={() => { setActiveTab('feedback'); setSelectedIds(new Set()); }}
                     className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                         activeTab === 'feedback'
                             ? 'bg-purple-600 text-white shadow-xs'
                             : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
                     }`}
                 >
                     <span>System Feedback & Complaints</span>
                     <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'feedback' ? 'bg-purple-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                         {feedbackCount}
                     </span>
                 </button>

                 <button
                     onClick={() => { setActiveTab('access'); setSelectedIds(new Set()); }}
                     className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                         activeTab === 'access'
                             ? 'bg-purple-600 text-white shadow-xs'
                             : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
                     }`}
                 >
                     <span>Access & Onboarding</span>
                     <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'access' ? 'bg-purple-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                         {accessCount}
                     </span>
                 </button>

                 <button
                     onClick={() => { setActiveTab('recovery'); setSelectedIds(new Set()); }}
                     className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                         activeTab === 'recovery'
                             ? 'bg-purple-600 text-white shadow-xs'
                             : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
                     }`}
                 >
                     <span>Email Recovery</span>
                     <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'recovery' ? 'bg-purple-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                         {recoveryCount}
                     </span>
                 </button>
             </div>

             {/* Bulk Action Controls Bar */}
             <div className="p-4 bg-white dark:bg-dark-surface border-b dark:border-dark-border flex flex-wrap justify-between items-center gap-4 shrink-0 shadow-xs">
                 <div className="flex items-center gap-4">
                     <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                         <input 
                             type="checkbox" 
                             checked={pendingItems.length > 0 && selectedIds.size === pendingItems.length}
                             onChange={toggleSelectAll}
                             className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                         />
                         <span>Select All Pending ({pendingItems.length})</span>
                     </label>

                     {selectedIds.size > 0 && (
                         <span className="text-xs font-black bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full border border-purple-200 dark:border-purple-800">
                             {selectedIds.size} Selected
                         </span>
                     )}
                 </div>

                 {selectedIds.size > 0 && (
                     <div className="flex items-center gap-2">
                         <button
                             onClick={handleBulkApprove}
                             disabled={isBulkProcessing}
                             className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                         >
                             {isBulkProcessing ? <Icons.Refresh size={14} className="animate-spin" /> : <Icons.Check size={14} />}
                             Bulk Approve & Grant Access ({selectedIds.size})
                         </button>
                         <button
                             onClick={handleBulkReject}
                             disabled={isBulkProcessing}
                             className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                         >
                             <Icons.Close size={14} />
                             Bulk Reject ({selectedIds.size})
                         </button>
                     </div>
                 )}
             </div>

             {/* Content Stream with Scroll Preview Lazy Loading */}
             <div className="flex-1 overflow-y-auto p-6 space-y-4">
                 {loading && (
                     <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                         <Icons.Refresh size={36} className="animate-spin text-purple-600" />
                         <p className="text-sm font-medium">Loading entries...</p>
                     </div>
                 )}

                 {error && (
                     <div className="p-4 bg-red-50 text-red-600 rounded-xl text-center font-bold text-sm">
                         {error}
                     </div>
                 )}

                 {!loading && !error && filteredItems.length === 0 && (
                     <div className="text-center py-20 text-slate-400 flex flex-col items-center gap-3">
                         <Icons.Check size={48} className="text-emerald-500 opacity-60" />
                         <p className="font-bold text-base text-slate-700 dark:text-slate-300">
                             {activeTab === 'feedback' ? 'No Feedback or Complaints' : 'All Requests Clear'}
                         </p>
                         <p className="text-xs text-slate-500">
                             {activeTab === 'feedback'
                                 ? 'No user feedback or complaints submitted currently.'
                                 : 'Approved items vanish automatically after 1 hour.'}
                         </p>
                     </div>
                 )}

                 {!loading && !error && filteredItems.map(item => (
                     <div 
                         key={item.id} 
                         className={`p-5 rounded-2xl border transition-all duration-200 ${
                             item.isResolved 
                                 ? 'bg-slate-100 dark:bg-slate-900/40 opacity-60 border-slate-200 dark:border-slate-800' 
                                 : selectedIds.has(item.id)
                                 ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800 shadow-md'
                                 : 'bg-white dark:bg-dark-surface border-slate-200 dark:border-dark-border shadow-sm hover:shadow-md'
                         }`}
                     >
                         <div className="flex items-start justify-between gap-4 mb-3">
                             <div className="flex items-center gap-3">
                                 {!item.isResolved && (
                                     <input 
                                         type="checkbox"
                                         checked={selectedIds.has(item.id)}
                                         onChange={() => toggleSelect(item.id)}
                                         className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                                     />
                                 )}
                                 
                                 {item.type === 'agent_onboarding' || item.type === 'complaint' ? (
                                     <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">
                                         Onboarding Access
                                     </span>
                                 ) : (
                                     <span className="bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">
                                         Email Recovery
                                     </span>
                                 )}

                                 <span className="text-base font-bold text-slate-900 dark:text-white">
                                     {item.name || item.email}
                                 </span>
                                 <span className="text-xs text-slate-500 font-mono">&lt;{item.email}&gt;</span>
                             </div>

                             <span className="text-xs text-slate-400 font-medium">
                                 {item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}
                             </span>
                         </div>
                         
                         <p className="text-sm text-slate-700 dark:text-slate-300 mb-4 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-dark-bg p-3 rounded-xl border border-slate-100 dark:border-slate-800 font-sans">
                             {item.content}
                         </p>
                         
                         {/* Scroll Lazy-Loaded Proof Image Preview */}
                         {item.hasProofImage && (
                             <div className="mt-3 mb-4">
                                 <p className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                                     <Icons.Attachment size={14} /> Attached Proof Image (Lazy Scroll Preview):
                                 </p>
                                 {loadedImages[item.id] ? (
                                     <img 
                                         src={loadedImages[item.id]} 
                                         loading="lazy"
                                         className="max-h-48 rounded-xl border dark:border-dark-border cursor-zoom-in hover:opacity-90 transition-opacity shadow-sm object-cover" 
                                         alt="proof attachment preview" 
                                         onClick={() => setExpandedImage(loadedImages[item.id])}
                                     />
                                 ) : (
                                     <button 
                                         onClick={() => handleLoadImage(item.id)}
                                         disabled={loadingImages.has(item.id)}
                                         className="text-xs bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 px-4 py-2 rounded-xl font-bold text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-2"
                                     >
                                         {loadingImages.has(item.id) ? (
                                             <><Icons.Refresh size={14} className="animate-spin" /> Loading Image...</>
                                         ) : (
                                             <><Icons.Attachment size={14} /> View Attached Image</>
                                         )}
                                     </button>
                                 )}
                             </div>
                         )}

                         {/* Individual Action Controls */}
                         {!item.isResolved && (
                             <div className="mt-4 pt-4 border-t dark:border-dark-border flex flex-col gap-3">
                                 <div>
                                     <input 
                                         type="text"
                                         value={comments[item.id] || ''}
                                         onChange={(e) => handleCommentChange(item.id, e.target.value)}
                                         placeholder="Add optional note/comment to email notification..."
                                         className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-purple-500 transition-colors"
                                     />
                                 </div>
                                 <div className="flex gap-2">
                                     {item.type === 'email_recovery' || item.type === 'company_email_recovery' ? (
                                         <button 
                                             onClick={() => handleApproveRecovery(item)}
                                             className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
                                         >
                                             <Icons.Plus size={14} /> Approve Recovery
                                         </button>
                                     ) : (
                                         <button 
                                             onClick={() => handleApproveAgent(item)}
                                             className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
                                         >
                                             <Icons.Check size={14} /> Approve & Add Agent
                                         </button>
                                     )}
                                     <button 
                                         onClick={() => handleRejectAgent(item)}
                                         className="flex items-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-950 dark:text-red-300 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                                     >
                                         <Icons.Close size={14} /> Reject
                                     </button>
                                 </div>
                             </div>
                         )}
                     </div>
                 ))}
             </div>

             {/* Expanded Image Modal */}
             {expandedImage && (
                 <div 
                     className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 cursor-zoom-out"
                     onClick={() => setExpandedImage(null)}
                 >
                     <img src={expandedImage} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" alt="expanded proof" />
                 </div>
             )}
        </div>
    );
};
