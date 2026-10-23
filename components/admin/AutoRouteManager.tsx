import React, { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';
import * as storage from '../../services/storageService';
import { useToast } from '../../contexts/ToastContext';
import { AutoRouteRule } from '../../types';

export const AutoRouteManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [rules, setRules] = useState<AutoRouteRule[]>([]);
  const [newName, setNewName] = useState('');
  const [newPriority, setNewPriority] = useState('Any');
  const [newCategory, setNewCategory] = useState('Any');
  const [newAssignee, setNewAssignee] = useState('');
  
  const [categories, setCategories] = useState<string[]>([]);
  const [staffEmails, setStaffEmails] = useState<string[]>([]);
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
      const [settings, staff] = await Promise.all([
          storage.getGeneralSettings(),
          storage.getStaffAccounts()
      ]);
      setRules(settings.autoRouteRules || []);
      setCategories(settings.categories || []);
      setStaffEmails(staff.map((s: any) => s.email));
    } catch (e) {
      showToast('Failed to load auto-route rules', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updated: AutoRouteRule[]) => {
    setLoading(true);
    try {
      const settings = await storage.getGeneralSettings();
      await storage.updateGeneralSettings({ ...settings, autoRouteRules: updated });
      setRules(updated);
      showToast('Routing Rules updated', 'success');
    } catch (e) {
      showToast('Failed to save routing rules', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addRule = () => {
    if (!newName.trim() || !newAssignee.trim()) return;

    const next = [...rules, { 
        id: 'rule_' + Date.now(), 
        name: newName.trim(), 
        conditionPriority: newPriority as any,
        conditionCategory: newCategory,
        assignToEmail: newAssignee,
        isActive: true
    }];
    handleSave(next);
    setNewName('');
    setNewPriority('Any');
    setNewCategory('Any');
    setNewAssignee('');
  };

  const removeRule = (id: string) => {
    if (!confirm(`Are you sure you want to remove this rule?`)) return;
    const next = rules.filter(r => r.id !== id);
    handleSave(next);
  };

  const toggleRule = (id: string) => {
    const next = rules.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r);
    handleSave(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-[2px] p-0 sm:p-4 font-sans animate-fade-in">
      <div className="bg-surface-0 dark:bg-dark-card w-full sm:max-w-3xl rounded-none sm:rounded-2xl shadow-modal overflow-hidden flex flex-col h-full sm:h-auto max-h-[100dvh] sm:max-h-[85vh] border border-surface-200 dark:border-dark-border animate-scale-in">
        <div className="px-5 md:px-6 py-3.5 border-b border-surface-200 dark:border-dark-border flex justify-between items-center bg-surface-50 dark:bg-dark-surface">
          <h3 className="font-semibold text-base text-surface-900 dark:text-white flex items-center gap-2">
            <Icons.Send size={18} className="text-purple-600 dark:text-purple-400" /> 
            <span>Manage Auto-Routing Rules</span>
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-200 dark:hover:bg-dark-hover rounded-lg text-surface-400 transition-colors" title="Close (Esc)">
            <Icons.Close size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/10 space-y-3">
             <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">Add New Routing Rule</h4>
             <div className="flex flex-col gap-3">
                <input 
                    type="text" 
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Rule Name (e.g. High Priority to IT Lead)"
                    className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-white text-sm"
                />
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Condition: Priority</label>
                        <select 
                            value={newPriority}
                            onChange={e => setNewPriority(e.target.value)}
                            className="w-full p-2 border rounded-lg text-sm dark:bg-dark-bg dark:text-white dark:border-dark-border"
                        >
                            <option value="Any">Any Priority</option>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Condition: Category</label>
                        <select 
                            value={newCategory}
                            onChange={e => setNewCategory(e.target.value)}
                            className="w-full p-2 border rounded-lg text-sm dark:bg-dark-bg dark:text-white dark:border-dark-border"
                        >
                            <option value="Any">Any Category</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Action: Assign To</label>
                        <select 
                            value={newAssignee}
                            onChange={e => setNewAssignee(e.target.value)}
                            className="w-full p-2 border rounded-lg text-sm dark:bg-dark-bg dark:text-white dark:border-dark-border"
                        >
                            <option value="">Select Staff...</option>
                            {staffEmails.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                    </div>
                </div>
             </div>
             <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-dark-border mt-2">
                <button 
                onClick={addRule}
                disabled={loading || !newName.trim() || !newAssignee.trim()}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 text-sm mt-2"
                >
                Add Rule
                </button>
             </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Active Rules (Evaluated top to bottom)</h4>
            {rules.map(r => (
              <div key={r.id} className={`flex gap-4 p-4 rounded-xl border transition-colors ${r.isActive ? 'border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-white/5' : 'border-dashed border-gray-200 opacity-50'}`}>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800 dark:text-white">{r.name}</span>
                        {!r.isActive && <span className="text-[10px] bg-red-100 text-red-600 px-2 rounded-full uppercase font-bold">Disabled</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs mt-1 text-gray-600 dark:text-gray-400">
                        <span className="font-mono bg-gray-100 dark:bg-white/10 px-1 rounded">IF</span> Priority is <b>{r.conditionPriority}</b> 
                        <span className="font-mono bg-gray-100 dark:bg-white/10 px-1 rounded">AND</span> Category is <b>{r.conditionCategory}</b>
                        <Icons.Sent size={12} className="mx-1 text-brand-500" />
                        <span className="font-mono bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-1 rounded font-bold">ASSIGN TO {r.assignToEmail}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => toggleRule(r.id)}
                        className={`text-xs font-bold px-3 py-1 rounded ${r.isActive ? 'bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-white' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}
                    >
                        {r.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button 
                        onClick={() => removeRule(r.id)}
                        className="text-gray-400 hover:text-red-500 p-2 shrink-0"
                        title="Remove Rule"
                    >
                        <Icons.Closed size={18} />
                    </button>
                </div>
              </div>
            ))}
            {rules.length === 0 && !loading && (
              <div className="text-center py-8 bg-gray-50 dark:bg-white/5 rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                  <Icons.Send size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-gray-500 text-sm font-medium">No routing rules defined.</p>
                  <p className="text-gray-400 text-xs mt-1">Add rules above to automatically assign incoming tickets to staff.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
