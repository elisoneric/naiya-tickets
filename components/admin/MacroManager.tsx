import React, { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';
import * as storage from '../../services/storageService';
import { useToast } from '../../contexts/ToastContext';
import { Macro } from '../../types';

export const MacroManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [macros, setMacros] = useState<Macro[]>([]);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newActionStatus, setNewActionStatus] = useState('');
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
      setMacros(settings.macros || []);
    } catch (e) {
      showToast('Failed to load macros', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updated: Macro[]) => {
    setLoading(true);
    try {
      const settings = await storage.getGeneralSettings();
      await storage.updateGeneralSettings({ ...settings, macros: updated });
      setMacros(updated);
      showToast('Macros updated', 'success');
    } catch (e) {
      showToast('Failed to save macros', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addMacro = () => {
    if (!newName.trim() || !newContent.trim()) return;

    const next = [...macros, { 
        id: 'macro_' + Date.now(), 
        name: newName.trim(), 
        description: newDesc.trim(),
        content: newContent.trim(),
        actionStatus: newActionStatus as any || undefined
    }];
    handleSave(next);
    setNewName('');
    setNewDesc('');
    setNewContent('');
    setNewActionStatus('');
  };

  const removeMacro = (id: string) => {
    if (!confirm(`Are you sure you want to remove this macro?`)) return;
    const next = macros.filter(m => m.id !== id);
    handleSave(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-[2px] p-0 sm:p-4 font-sans animate-fade-in">
      <div className="bg-surface-0 dark:bg-dark-card w-full sm:max-w-2xl rounded-none sm:rounded-2xl shadow-modal overflow-hidden flex flex-col h-full sm:h-auto max-h-[100dvh] sm:max-h-[85vh] border border-surface-200 dark:border-dark-border animate-scale-in">
        <div className="px-5 md:px-6 py-3.5 border-b border-surface-200 dark:border-dark-border flex justify-between items-center bg-surface-50 dark:bg-dark-surface">
          <h3 className="font-semibold text-base text-surface-900 dark:text-white flex items-center gap-2">
            <Icons.Dashboard size={18} className="text-teal-600 dark:text-teal-400" /> 
            <span>Manage Macros</span>
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-200 dark:hover:bg-dark-hover rounded-lg text-surface-400 transition-colors" title="Close (Esc)">
            <Icons.Close size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/10 space-y-3">
             <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">Add New Macro</h4>
             <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                    <input 
                        type="text" 
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        placeholder="Macro Name (e.g. Password Reset)"
                        className="w-1/2 p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-white text-sm"
                    />
                    <input 
                        type="text" 
                        value={newDesc}
                        onChange={e => setNewDesc(e.target.value)}
                        placeholder="Short description..."
                        className="w-1/2 p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-white text-sm"
                    />
                </div>
                <textarea 
                    value={newContent}
                    onChange={e => setNewContent(e.target.value)}
                    placeholder="Full response text to insert..."
                    rows={3}
                    className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-white text-sm resize-y"
                />
                <div className="flex gap-3 items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Action (Optional):</span>
                    <select 
                        value={newActionStatus}
                        onChange={e => setNewActionStatus(e.target.value)}
                        className="p-2 border rounded-lg text-sm dark:bg-dark-bg dark:text-white dark:border-dark-border"
                    >
                        <option value="">None (Just insert text)</option>
                        <option value="Closed">Set Status to Closed</option>
                    </select>
                </div>
             </div>
             <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-dark-border">
                <button 
                onClick={addMacro}
                disabled={loading || !newName.trim() || !newContent.trim()}
                className="bg-teal-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-teal-700 disabled:opacity-50 text-sm mt-2"
                >
                Add Macro
                </button>
             </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Available Macros</h4>
            {macros.map(m => (
              <div key={m.id} className="flex gap-4 p-4 rounded-xl border border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800 dark:text-white">{m.name}</span>
                        {m.actionStatus && (
                            <span className="text-[10px] bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full uppercase font-bold tracking-widest">
                                Action: {m.actionStatus}
                            </span>
                        )}
                    </div>
                    {m.description && <p className="text-xs text-gray-500">{m.description}</p>}
                    <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap mt-2 bg-gray-100 dark:bg-dark-bg p-2 rounded">{m.content}</p>
                </div>
                <button 
                  onClick={() => removeMacro(m.id)}
                  className="text-gray-400 hover:text-red-500 p-1 shrink-0 self-start"
                  title="Remove Macro"
                >
                  <Icons.Closed size={18} />
                </button>
              </div>
            ))}
            {macros.length === 0 && !loading && (
              <div className="text-center py-8 bg-gray-50 dark:bg-white/5 rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                  <Icons.Dashboard size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-gray-500 text-sm font-medium">No macros defined.</p>
                  <p className="text-gray-400 text-xs mt-1">Add macros above to automate agent workflows.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
