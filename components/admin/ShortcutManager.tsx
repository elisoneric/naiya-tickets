import React, { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';
import * as storage from '../../services/storageService';
import { useToast } from '../../contexts/ToastContext';
import { Shortcut } from '../../types';

export const ShortcutManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [newTrigger, setNewTrigger] = useState('');
  const [newText, setNewText] = useState('');
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, loading]);

  const loadSettings = async () => {
    try {
      const settings = await storage.getGeneralSettings();
      setShortcuts(settings.shortcuts || []);
    } catch (e) {
      showToast('Failed to load shortcuts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updated: Shortcut[]) => {
    setLoading(true);
    try {
      const settings = await storage.getGeneralSettings();
      await storage.updateGeneralSettings({ ...settings, shortcuts: updated });
      setShortcuts(updated);
      showToast('Shortcuts updated', 'success');
    } catch (e) {
      showToast('Failed to save shortcuts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addShortcut = () => {
    if (!newTrigger.trim() || !newText.trim()) return;
    
    // Ensure trigger starts with /
    let trigger = newTrigger.trim();
    if (!trigger.startsWith('/')) {
      trigger = '/' + trigger;
    }

    if (shortcuts.some(s => s.trigger === trigger)) {
      showToast('Shortcut trigger already exists', 'error');
      return;
    }
    const next = [...shortcuts, { trigger, text: newText.trim() }];
    handleSave(next);
    setNewTrigger('');
    setNewText('');
  };

  const removeShortcut = (trigger: string) => {
    if (!confirm(`Are you sure you want to remove the shortcut: ${trigger}?`)) return;
    const next = shortcuts.filter(s => s.trigger !== trigger);
    handleSave(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-[2px] p-0 sm:p-4 font-sans animate-fade-in">
      <div className="bg-surface-0 dark:bg-dark-card w-full sm:max-w-2xl rounded-none sm:rounded-2xl shadow-modal overflow-hidden flex flex-col h-full sm:h-auto max-h-[100dvh] sm:max-h-[85vh] border border-surface-200 dark:border-dark-border animate-scale-in">
        <div className="px-5 md:px-6 py-3.5 border-b border-surface-200 dark:border-dark-border flex justify-between items-center bg-surface-50 dark:bg-dark-surface">
          <h3 className="font-semibold text-base text-surface-900 dark:text-white flex items-center gap-2">
            <Icons.Chat size={18} className="text-brand-600 dark:text-brand-400" /> 
            <span>Manage Reply Shortcuts</span>
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-200 dark:hover:bg-dark-hover rounded-lg text-surface-400 transition-colors" title="Close (Esc)">
            <Icons.Close size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/10 space-y-3">
             <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">Add New Shortcut</h4>
             <div className="flex gap-3">
                <div className="w-1/3">
                    <input 
                    type="text" 
                    value={newTrigger}
                    onChange={e => setNewTrigger(e.target.value)}
                    placeholder="Trigger (e.g. /details)"
                    className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-white text-sm"
                    />
                </div>
                <div className="flex-1">
                    <textarea 
                    value={newText}
                    onChange={e => setNewText(e.target.value)}
                    placeholder="Full response text..."
                    rows={2}
                    className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-white text-sm resize-none"
                    />
                </div>
             </div>
             <div className="flex justify-end">
                <button 
                onClick={addShortcut}
                disabled={loading || !newTrigger.trim() || !newText.trim()}
                className="bg-brand-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-brand-700 disabled:opacity-50 text-sm"
                >
                Add Shortcut
                </button>
             </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Available Shortcuts</h4>
            {shortcuts.map(s => (
              <div key={s.trigger} className="flex gap-4 p-4 rounded-xl border border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <div className="w-1/4 shrink-0">
                    <span className="inline-block bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-2 py-1 rounded font-mono text-xs font-bold">
                        {s.trigger}
                    </span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{s.text}</p>
                </div>
                <button 
                  onClick={() => removeShortcut(s.trigger)}
                  className="text-gray-400 hover:text-red-500 p-1 shrink-0 self-start"
                  title="Remove Shortcut"
                >
                  <Icons.Closed size={18} />
                </button>
              </div>
            ))}
            {shortcuts.length === 0 && !loading && (
              <div className="text-center py-8 bg-gray-50 dark:bg-white/5 rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                  <Icons.Chat size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-gray-500 text-sm font-medium">No shortcuts defined.</p>
                  <p className="text-gray-400 text-xs mt-1">Add shortcuts above to speed up agent replies.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
