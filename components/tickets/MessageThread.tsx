import React, { useEffect, useRef, useState } from 'react';
import { Ticket } from '../../types';
import { formatPatternWAT } from '../../utils/dateUtils';
import { Icons } from '../common/Icons';
import { FormattedMessage } from '../common/FormattedMessage';
import { TicketFormMetadataCard } from './TicketFormMetadataCard';

export const MessageThread: React.FC<{ ticket: Ticket }> = ({ ticket }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket.messages?.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewImage) {
        setPreviewImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage]);

  const ImageGrid = ({ attachments }: { attachments: string[] }) => {
    const [loaded, setLoaded] = useState<Set<number>>(new Set());

    return (
        <div className="flex flex-wrap gap-2.5 mt-3">
            {attachments.map((att, i) => (
                <div 
                    key={i} 
                    className="w-24 h-24 md:w-28 md:h-28 bg-surface-100 dark:bg-dark-card rounded-lg border border-surface-200 dark:border-dark-border relative overflow-hidden group shadow-xs" 
                >
                    {!loaded.has(i) ? (
                        <button 
                            onClick={() => setLoaded(prev => new Set(prev).add(i))}
                            className="absolute inset-0 flex flex-col items-center justify-center text-surface-500 hover:bg-surface-200 dark:hover:bg-dark-hover transition-colors"
                        >
                            <Icons.Attachment size={18} className="mb-1 text-surface-400" />
                            <span className="text-2xs font-semibold uppercase tracking-wider">Load Image</span>
                        </button>
                    ) : (
                        <div 
                            onClick={() => setPreviewImage(att)}
                            className="w-full h-full cursor-zoom-in"
                        >
                            <img src={att} className="w-full h-full object-cover" alt="attachment" loading="lazy" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
  };

  return (
    <>
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-6 bg-surface-0 dark:bg-dark-bg space-y-4">
            
            {/* Form Submission Details Quick Copy Badges */}
            <TicketFormMetadataCard ticket={ticket} />

            {/* Initial Request (Original Message) */}
            <div className="relative group">
                <div className="flex gap-3.5">
                     <div className="w-8 h-8 rounded-lg bg-surface-100 dark:bg-dark-card border border-surface-200 dark:border-dark-border flex items-center justify-center text-surface-500 shrink-0">
                         <Icons.User size={18} />
                     </div>
                     <div className="flex-1 min-w-0">
                         <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                             <div className="flex items-center gap-2">
                                 <span className="font-semibold text-surface-900 dark:text-white text-sm">
                                    {ticket.createdByEmail} {ticket.project ? `(${ticket.project})` : ''}
                                 </span>
                                 {ticket.agentRole && ticket.agentRole !== 'agent' && (
                                     <span className={`text-2xs font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                                         ticket.agentRole === 'team_lead' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200' :
                                         ticket.agentRole === 'moniepoint' ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400 border border-teal-200' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200'
                                     }`}>
                                         {ticket.agentRole === 'team_lead' ? 'Team Lead' : ticket.agentRole === 'moniepoint' ? 'Moniepoint' : 'Referee'}
                                     </span>
                                 )}
                             </div>
                             <span className="text-2xs text-surface-400 font-medium tabular-nums">{formatPatternWAT(ticket.createdAt, 'PP p')}</span>
                         </div>
                         <div className="text-[13.5px] text-surface-700 dark:text-surface-300 leading-[1.65]">
                             <FormattedMessage content={ticket.description} />
                         </div>
                         {ticket.attachments && ticket.attachments.length > 0 && <ImageGrid attachments={ticket.attachments} />}
                     </div>
                </div>
            </div>

            {ticket.messages.length > 0 && (
                 <div className="relative flex items-center justify-center my-6">
                     <div className="absolute inset-x-0 h-px bg-surface-200 dark:border-dark-border"></div>
                     <span className="relative bg-surface-0 dark:bg-dark-bg px-3 text-2xs font-semibold text-surface-400 uppercase tracking-wider">
                         Reply History
                     </span>
                 </div>
            )}

            {/* Thread Messages */}
            {ticket.messages.map((msg) => {
                const isStaff = msg.role === 'staff' || msg.role === 'team_lead';
                
                return (
                    <div key={msg.id} className={`flex gap-3.5 p-3.5 md:p-4 rounded-xl transition-colors border ${
                        isStaff 
                        ? 'bg-brand-50/20 dark:bg-brand-950/15 border-brand-100 dark:border-brand-900/30' 
                        : 'bg-surface-0 dark:bg-dark-card border-surface-200 dark:border-dark-border hover:bg-surface-50 dark:hover:bg-dark-hover'
                    }`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs ${
                            isStaff 
                            ? 'bg-brand-600 text-white' 
                            : 'bg-surface-100 dark:bg-dark-hover text-surface-600 dark:text-surface-300'
                        }`}>
                            {isStaff ? (
                                <span className="font-bold text-xs">{msg.role === 'team_lead' ? 'TL' : 'IT'}</span>
                            ) : (
                                <Icons.User size={16} />
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                                <div className="flex items-center gap-2">
                                    <span className={`font-semibold text-xs md:text-sm ${isStaff ? 'text-brand-700 dark:text-brand-400' : 'text-surface-900 dark:text-white'}`}>
                                        {isStaff ? msg.senderName : `${ticket.createdByEmail} `}
                                    </span>
                                    {isStaff && (
                                        <span className="text-2xs px-1.5 py-0.2 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded font-medium uppercase">
                                            Internal
                                        </span>
                                    )}
                                    {!isStaff && ticket.agentRole && ticket.agentRole !== 'agent' && (
                                        <span className={`text-2xs font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                                            ticket.agentRole === 'team_lead' ? 'bg-blue-50 text-blue-700' :
                                            ticket.agentRole === 'moniepoint' ? 'bg-teal-50 text-teal-700' : 'bg-orange-50 text-orange-700'
                                        }`}>
                                            {ticket.agentRole === 'team_lead' ? 'Team Lead' : ticket.agentRole === 'moniepoint' ? 'Moniepoint' : 'Referee'}
                                        </span>
                                    )}
                                </div>
                                <span className="text-2xs text-surface-400 tabular-nums font-medium">
                                    {formatPatternWAT(msg.timestamp, 'MMM d, h:mm a')}
                                </span>
                            </div>

                            <div className="text-[13.5px] text-surface-700 dark:text-surface-300 leading-[1.65] mt-1.5">
                                <FormattedMessage content={msg.content} />
                            </div>
                            
                            {msg.attachments && msg.attachments.length > 0 && <ImageGrid attachments={msg.attachments} />}
                        </div>
                    </div>
                );
            })}
            <div ref={bottomRef} className="h-4" />
        </div>

        {/* Fullscreen Image Preview */}
        {previewImage && (
            <div 
                className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-fade-in" 
                onClick={() => setPreviewImage(null)}
            >
                <div className="absolute top-0 w-full p-4 flex justify-between items-center text-white/80">
                    <span className="text-sm font-medium">Image Preview</span>
                    <button onClick={() => setPreviewImage(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Close (Esc)">
                        <Icons.Close size={22} />
                    </button>
                </div>
                
                <img src={previewImage} className="max-w-full max-h-[85vh] object-contain shadow-2xl rounded-lg" alt="Preview" onClick={e => e.stopPropagation()} />
                
                <div className="absolute bottom-8 flex gap-4">
                    <a 
                        href={previewImage} 
                        download="image.png"
                        className="flex items-center gap-2 px-5 py-2 bg-white text-surface-900 rounded-lg font-semibold text-xs hover:scale-105 transition-transform"
                        onClick={e => e.stopPropagation()}
                    >
                        <Icons.Inbox className="rotate-180" size={16} /> Download
                    </a>
                </div>
            </div>
        )}
    </>
  );
};
