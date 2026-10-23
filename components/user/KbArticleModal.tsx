import React, { useEffect } from 'react';
import { Icons } from '../common/Icons';
import { KBArticle } from '../../services/knowledgeBase';

interface KbArticleModalProps {
    article: KBArticle;
    onClose: () => void;
}

export const KbArticleModal: React.FC<KbArticleModalProps> = ({ article, onClose }) => {
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

    return (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-0 sm:p-6 animate-fade-in font-sans">
            <div className="bg-surface-0 dark:bg-dark-card border border-surface-200 dark:border-dark-border w-full max-w-2xl rounded-none sm:rounded-2xl shadow-modal flex flex-col overflow-hidden h-full sm:h-auto max-h-[100dvh] sm:max-h-[90vh] animate-scale-in">
                <div className="px-6 py-4 border-b border-surface-200 dark:border-dark-border flex justify-between items-center bg-surface-50/70 dark:bg-dark-card shrink-0">
                    <h2 className="text-lg sm:text-xl font-bold text-surface-900 dark:text-dark-textPrimary flex items-center gap-2">
                        <Icons.Document className="text-brand-600" />
                        {article.topic}
                    </h2>
                    <button onClick={onClose} className="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-dark-textPrimary hover:bg-surface-100 dark:hover:bg-dark-hover rounded-lg transition-colors" title="Close (Esc)">
                        <Icons.Close size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    <div className="prose dark:prose-invert max-w-none">
                        <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {article.resolutionText}
                        </div>
                    </div>

                    {article.link && (
                        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-white/10">
                            <a 
                                href={article.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-xl font-bold shadow-sm transition-all hover:shadow-md"
                            >
                                Open Official Link <Icons.Expand className="-rotate-90" size={18} />
                            </a>
                        </div>
                    )}
                </div>

                <div className="bg-gray-50 dark:bg-black/40 px-6 py-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between shrink-0">
                    <span className="text-sm text-gray-500">Didn't find what you need?</span>
                    <button 
                        onClick={() => {
                            onClose();
                            window.dispatchEvent(new CustomEvent('open-support-chat'));
                        }}
                        className="text-sm font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1.5"
                    >
                        <Icons.Message size={16} />
                        Chat with Support
                    </button>
                </div>
            </div>
        </div>
    );
};
