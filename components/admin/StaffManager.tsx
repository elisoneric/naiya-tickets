import React, { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';
import * as storage from '../../services/storageService';
import { useToast } from '../../contexts/ToastContext';
import { StaffAccount } from '../../types';

interface StaffManagerProps {
  onClose: () => void;
}

export const StaffManager: React.FC<StaffManagerProps> = ({ onClose }) => {
  const [staffList, setStaffList] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // Form State
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isRoot, setIsRoot] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadStaff();
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

  const loadStaff = async () => {
    try {
      const list = await storage.getStaffAccounts();
      setStaffList(list);
    } catch (e) {
      showToast('Failed to load staff list', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) return;

    setLoading(true);
    try {
        const staffData: StaffAccount = {
            email,
            name,
            password,
            role: 'staff',
            isRoot: email.toLowerCase() === 'itstaff' ? true : isRoot,
            avatar: `https://ui-avatars.com/api/?name=${name.replace(' ','+')}`
        };

        if (isEditing) {
             await storage.updateStaffAccount(staffData.email, staffData);
             showToast('Staff updated', 'success');
        } else {
             await storage.addStaffAccount(staffData);
             showToast('Staff added', 'success');
        }
        
        // Reset form
        setEmail('');
        setName('');
        setPassword('');
        setIsRoot(false);
        setIsEditing(false);
        await loadStaff();
    } catch(e) {
        showToast('Operation failed', 'error');
    } finally {
        setLoading(false);
    }
  };

  const handleEdit = (staff: StaffAccount) => {
      setEmail(staff.email);
      setName(staff.name);
      setPassword(staff.password);
      setIsRoot(Boolean(staff.isRoot || (staff as any).is_root == 1 || staff.email?.toLowerCase() === 'itstaff'));
      setIsEditing(true);
  };

  const handleDelete = async (emailToDelete: string) => {
      if (emailToDelete?.toLowerCase() === 'itstaff') {
          showToast("Cannot delete Root Admin", 'error');
          return;
      }
      if (!confirm(`Delete staff account ${emailToDelete}?`)) return;
      
      setLoading(true);
      try {
          await storage.deleteStaffAccount(emailToDelete);
          await loadStaff();
          showToast('Staff deleted', 'success');
      } catch (e) {
          showToast('Failed to delete staff', 'error');
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-[2px] p-0 sm:p-4 font-sans animate-fade-in">
      <div className="bg-surface-0 dark:bg-dark-card w-full sm:max-w-2xl rounded-none sm:rounded-2xl shadow-modal overflow-hidden flex flex-col h-full sm:h-auto max-h-[100dvh] sm:max-h-[85vh] border border-surface-200 dark:border-dark-border animate-scale-in">
        <div className="px-5 md:px-6 py-3.5 border-b border-surface-200 dark:border-dark-border flex justify-between items-center bg-surface-50 dark:bg-dark-surface">
          <h3 className="font-semibold text-base text-surface-900 dark:text-white flex items-center gap-2">
            <Icons.User size={18} className="text-brand-600 dark:text-brand-400" />
            <span>Manage IT Staff</span>
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-200 dark:hover:bg-dark-hover rounded-lg text-surface-400 transition-colors" title="Close (Esc)">
            <Icons.Close size={18} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row h-full overflow-hidden">
            {/* Form Section */}
            <div className="p-6 bg-gray-50 dark:bg-dark-bg border-b md:border-b-0 md:border-r dark:border-dark-border w-full md:w-1/3 flex flex-col gap-4">
                <h4 className="font-semibold text-gray-700 dark:text-gray-200">
                    {isEditing ? 'Edit Staff' : 'Add New Staff'}
                </h4>
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Email (Username)</label>
                        <input 
                            type="text" 
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            disabled={isEditing} // Cannot change email as it is the ID
                            className="w-full p-2 rounded border border-gray-300 dark:border-dark-border dark:bg-dark-surface dark:text-white text-sm"
                            placeholder="staff@naiya.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Display Name</label>
                        <input 
                            type="text" 
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full p-2 rounded border border-gray-300 dark:border-dark-border dark:bg-dark-surface dark:text-white text-sm"
                            placeholder="John Doe"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Password</label>
                        <input 
                            type="text" 
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full p-2 rounded border border-gray-300 dark:border-dark-border dark:bg-dark-surface dark:text-white text-sm"
                            placeholder="Set password"
                            required
                        />
                    </div>
                    
                    <div className="flex items-center gap-2 pt-1">
                        <input 
                            type="checkbox"
                            id="isRootCheckbox"
                            checked={isRoot || email.toLowerCase() === 'itstaff'}
                            onChange={e => setIsRoot(e.target.checked)}
                            disabled={email.toLowerCase() === 'itstaff'}
                            className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                        <label htmlFor="isRootCheckbox" className="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                            Grant Root Superadmin Access
                        </label>
                    </div>
                    
                    <div className="flex gap-2 mt-2">
                        <button 
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-brand-600 text-white py-2 rounded text-sm hover:bg-brand-700 transition-colors shadow-sm"
                        >
                            {isEditing ? 'Update' : 'Create'}
                        </button>
                        {isEditing && (
                            <button 
                                type="button"
                                onClick={() => {
                                    setIsEditing(false);
                                    setEmail('');
                                    setName('');
                                    setPassword('');
                                    setIsRoot(false);
                                }}
                                className="px-3 py-2 bg-gray-200 text-gray-600 rounded text-sm hover:bg-gray-300"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* List Section */}
            <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-dark-surface">
                {loading && staffList.length === 0 ? (
                    <div className="text-center text-gray-400 mt-10">Loading staff accounts...</div>
                ) : (
                    <div className="space-y-2">
                        {staffList.map(staff => (
                            <div key={staff.email} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <img src={staff.avatar} alt={staff.name} className="w-8 h-8 rounded-full bg-gray-200" loading="lazy" />
                                    <div>
                                        <div className="font-medium text-sm dark:text-white flex items-center gap-2">
                                            {staff.name}
                                            {(staff.isRoot || staff.email?.toLowerCase() === 'itstaff') && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 rounded border border-amber-200">ROOT</span>}
                                        </div>
                                        <div className="text-xs text-gray-500">{staff.email}</div>
                                    </div>
                                </div>
                                <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => handleEdit(staff)}
                                        className="text-brand-600 hover:bg-brand-50 p-1.5 rounded"
                                        title="Edit"
                                    >
                                        <Icons.More className="rotate-90" size={16} />
                                    </button>
                                    {!(staff.isRoot || staff.email?.toLowerCase() === 'itstaff') && (
                                        <button 
                                            onClick={() => handleDelete(staff.email)}
                                            className="text-red-500 hover:bg-red-50 p-1.5 rounded"
                                            title="Delete"
                                        >
                                            <Icons.Closed size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};