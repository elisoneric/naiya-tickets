import React, { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';
import * as storage from '../../services/storageService';
import { useToast } from '../../contexts/ToastContext';
import { useTickets } from '../../contexts/TicketContext';

export const CategoryManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [newCat, setNewCat] = useState('');
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const { updateCategoriesList } = useTickets();

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
      setCategories(settings.categories);
    } catch (e) {
      showToast('Failed to load categories', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updated: string[]) => {
    setLoading(true);
    try {
      await storage.updateGeneralSettings({ categories: updated });
      setCategories(updated);
      updateCategoriesList();
      showToast('Categories updated', 'success');
    } catch (e) {
      showToast('Failed to save categories', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addCategory = () => {
    if (!newCat.trim()) return;
    if (categories.includes(newCat.trim())) {
      showToast('Category already exists', 'error');
      return;
    }
    const next = [...categories, newCat.trim()];
    handleSave(next);
    setNewCat('');
  };

  const removeCategory = (cat: string) => {
    if (!confirm(`Are you sure you want to remove the category: ${cat}?`)) return;
    const next = categories.filter(c => c !== cat);
    handleSave(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-[2px] p-0 sm:p-4 font-sans animate-fade-in">
      <div className="bg-surface-0 dark:bg-dark-card w-full sm:max-w-lg rounded-none sm:rounded-2xl shadow-modal overflow-hidden flex flex-col h-full sm:h-auto max-h-[100dvh] sm:max-h-[80vh] border border-surface-200 dark:border-dark-border animate-scale-in">
        <div className="px-5 md:px-6 py-3.5 border-b border-surface-200 dark:border-dark-border flex justify-between items-center bg-surface-50 dark:bg-dark-surface">
          <h3 className="font-semibold text-base text-surface-900 dark:text-white flex items-center gap-2">
            <Icons.Dashboard size={18} className="text-brand-600 dark:text-brand-400" /> 
            <span>Manage Ticket Categories</span>
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-200 dark:hover:bg-dark-hover rounded-lg text-surface-400 transition-colors" title="Close (Esc)">
            <Icons.Close size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              placeholder="New Category Name"
              className="flex-1 p-2 rounded border dark:bg-dark-bg dark:border-dark-border dark:text-white"
            />
            <button 
              onClick={addCategory}
              disabled={loading || !newCat.trim()}
              className="bg-brand-600 text-white px-4 py-2 rounded font-bold hover:bg-brand-700 disabled:opacity-50"
            >
              Add
            </button>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Available Categories</h4>
            {categories.map(cat => (
              <div key={cat} className="flex justify-between items-center p-3 rounded-lg border dark:border-dark-border hover:bg-gray-50 dark:hover:bg-white/5">
                <span className="text-sm font-medium dark:text-gray-200">{cat}</span>
                <button 
                  onClick={() => removeCategory(cat)}
                  className="text-gray-400 hover:text-red-500 p-1"
                >
                  <Icons.Closed size={16} />
                </button>
              </div>
            ))}
            {categories.length === 0 && !loading && (
              <p className="text-center text-gray-500 py-4 italic">No categories defined.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};