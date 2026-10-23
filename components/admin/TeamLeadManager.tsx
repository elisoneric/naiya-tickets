import React, { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';
import * as storage from '../../services/storageService';
import { useToast } from '../../contexts/ToastContext';
import { TeamLead } from '../../types';

interface TeamLeadManagerProps {
  onClose: () => void;
}

export const TeamLeadManager: React.FC<TeamLeadManagerProps> = ({ onClose }) => {
  const [leads, setLeads] = useState<TeamLead[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const [id, setId] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    loadLeads();
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

  const loadLeads = async () => {
    try {
      const list = await storage.getTeamLeads();
      setLeads(list);
    } catch (e) {
      showToast('Failed to load team leads', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
        const tlData: TeamLead = {
            id, email, name, password
        };
        await storage.addTeamLead(tlData);
        showToast('Team Lead added', 'success');
        setId(''); setEmail(''); setName(''); setPassword('');
        loadLeads();
    } catch (e) {
        showToast('Error saving Team Lead', 'error');
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async (email: string) => {
      if (!confirm('Delete this Team Lead?')) return;
      await storage.deleteTeamLead(email);
      loadLeads();
      showToast('Deleted', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-[2px] p-0 sm:p-4 font-sans animate-fade-in">
      <div className="bg-surface-0 dark:bg-dark-card w-full sm:max-w-3xl rounded-none sm:rounded-2xl shadow-modal overflow-hidden flex flex-col h-full sm:h-auto max-h-[100dvh] sm:max-h-[85vh] border border-surface-200 dark:border-dark-border animate-scale-in">
        <div className="px-5 md:px-6 py-3.5 border-b border-surface-200 dark:border-dark-border flex justify-between items-center bg-surface-50 dark:bg-dark-surface">
          <h3 className="font-semibold text-base text-surface-900 dark:text-white flex items-center gap-2">
            <Icons.Users size={18} className="text-purple-600 dark:text-purple-400" />
            <span>Manage Team Leads</span>
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-200 dark:hover:bg-dark-hover rounded-lg text-surface-400 transition-colors" title="Close (Esc)">
            <Icons.Close size={18} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row h-full overflow-hidden">
             {/* Form */}
             <div className="w-full md:w-1/3 p-4 bg-gray-50 dark:bg-dark-bg border-r dark:border-dark-border overflow-y-auto">
                 <h4 className="font-semibold mb-4 dark:text-white">Create Lead</h4>
                 <form onSubmit={handleSubmit} className="space-y-3">
                     <div>
                         <label className="text-xs uppercase font-bold text-gray-500">ID (e.g. TL001)</label>
                         <input required type="text" value={id} onChange={e => setId(e.target.value)} className="w-full p-2 border rounded dark:bg-dark-surface dark:border-dark-border dark:text-white" />
                     </div>
                     <div>
                         <label className="text-xs uppercase font-bold text-gray-500">Email</label>
                         <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 border rounded dark:bg-dark-surface dark:border-dark-border dark:text-white" />
                     </div>
                     <div>
                         <label className="text-xs uppercase font-bold text-gray-500">Name</label>
                         <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded dark:bg-dark-surface dark:border-dark-border dark:text-white" />
                     </div>
                     <div>
                         <label className="text-xs uppercase font-bold text-gray-500">Password</label>
                         <input required type="text" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 border rounded dark:bg-dark-surface dark:border-dark-border dark:text-white" />
                     </div>
                     <button type="submit" disabled={loading} className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700">Create</button>
                 </form>
             </div>

             {/* List */}
             <div className="flex-1 p-4 overflow-y-auto bg-white dark:bg-dark-surface">
                 <div className="space-y-2">
                     {leads.map(lead => (
                         <div key={lead.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 dark:border-dark-border">
                             <div>
                                 <div className="flex items-center gap-2">
                                     <span className="font-bold text-purple-700 dark:text-purple-400">{lead.id}</span>
                                     <span className="font-medium dark:text-white">{lead.name}</span>
                                 </div>
                                 <div className="text-xs text-gray-500">{lead.email}</div>
                             </div>
                             <button onClick={() => handleDelete(lead.email)} className="text-red-500 p-2 hover:bg-red-50 rounded">
                                 <Icons.Closed size={16} />
                             </button>
                         </div>
                     ))}
                     {leads.length === 0 && <p className="text-center text-gray-400 mt-10">No Team Leads defined.</p>}
                 </div>
             </div>
        </div>
      </div>
    </div>
  );
};