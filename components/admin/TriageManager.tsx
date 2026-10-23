import React, { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';
import { getGeneralSettings, saveGeneralSettings } from '../../services/storageService';
import { useToast } from '../../contexts/ToastContext';
import { useTickets } from '../../contexts/TicketContext';
import { TriageCategory, TriageOption } from '../../types';

export const TriageManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [categories, setCategories] = useState<TriageCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { showToast } = useToast();
    const { updateCategoriesList } = useTickets();

    const [editingCategory, setEditingCategory] = useState<TriageCategory | null>(null);

    useEffect(() => {
        loadSettings();
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !saving) {
                if (editingCategory) {
                    setEditingCategory(null);
                } else {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, saving, editingCategory]);

    const loadSettings = async () => {
        const settings = await getGeneralSettings();
        setCategories(settings.triageCategories || []);
        setLoading(false);
    };

    const handleSave = async (updatedCategories: TriageCategory[]) => {
        setSaving(true);
        try {
            const settings = await getGeneralSettings();
            await saveGeneralSettings({ 
                ...settings, 
                triageCategories: updatedCategories 
            });
            setCategories(updatedCategories);
            updateCategoriesList();
            showToast('Triage logic saved successfully', 'success');
        } catch (e) {
            showToast('Error saving triage logic', 'error');
        } finally {
            setSaving(false);
        }
    };

    const addCategory = () => {
        const newCat: TriageCategory = {
            id: Date.now().toString(),
            title: 'New Category',
            description: '',
            type: 'manual',
            options: [],
        };
        handleSave([...categories, newCat]);
    };

    const deleteCategory = (id: string) => {
        if (!window.confirm('Are you sure you want to delete this category?')) return;
        handleSave(categories.filter(c => c.id !== id));
    };

    const saveEditingCategory = () => {
        if (editingCategory) {
            handleSave(categories.map(c => c.id === editingCategory.id ? editingCategory : c));
            setEditingCategory(null);
        }
    };

    const addSubOption = () => {
        if (!editingCategory) return;
        const newOption: TriageOption = {
            id: Date.now().toString(),
            title: 'New Option',
            type: 'manual',
        };
        setEditingCategory({
            ...editingCategory,
            options: [...(editingCategory.options || []), newOption]
        });
    };

    const updateSubOption = (optionId: string, updates: Partial<TriageOption>) => {
        if (!editingCategory) return;
        setEditingCategory({
            ...editingCategory,
            options: (editingCategory.options || []).map(opt => 
                opt.id === optionId ? { ...opt, ...updates } : opt
            )
        });
    };

    const deleteSubOption = (optionId: string) => {
        if (!editingCategory) return;
        setEditingCategory({
            ...editingCategory,
            options: (editingCategory.options || []).filter(opt => opt.id !== optionId)
        });
    };

    const seedDefaultTriage = () => {
        const defaults: TriageCategory[] = [
            {
                id: 'cat_1',
                title: 'Device & Activation Related',
                description: 'Onboarding, switching to prod, lost devices, workflow issues.',
                type: 'options',
                options: [
                    { id: 'opt_1a', type: 'resolution', title: 'Option 1A: New Device Activation / Onboarding', resolutionText: "To activate a new transitioning device, please fill out the Activation Request Form:\n\nUse these official admin details:\nFirst Name: Yahaya\nSurname: Olajide\nNIN: 18050024425\nPhone: 09033666669\nEmail: olajideyahayahammed@naiyatechnology.org\nESA NAME: NA'IYA TECHNOLOGY SOLUTIONS LTD\nESA CODE: 437.\n\nAfter the license is assigned, notify us by emailing Customercaretransitioning@naiyatechnology.org and copying Abubakaribrahimolose@naiyatechnlogy.org & Naiyatransitioningcustomercare@gmail.com.", resolutionLink: "https://docs.google.com/forms/d/e/1FAIpQLSeSKPdSgAbAkJDC6vORXiKCmNPH2Kj7r5nMW90ai9_Tv_Ganw/viewform?usp=header" },
                    { id: 'opt_1b', type: 'resolution', title: 'Option 1B: Switch to Production (After Test Runs)', resolutionText: "If you have conducted three test runs and are ready to switch, fill out the Certification & Production Switch Form.\n\nDevices will be certified and switched within 48 hours. (Note: Devices pending switch should already be active, except for these IMEIs still on test run: 216795438902483, 376787999860826). Upon successful onboarding, commence live enrollments.", resolutionLink: "https://docs.google.com/forms/d/e/1FAIpQLSeqpetDm8DH8wtlmu4SkiUhpp1VEsQToIxsEqitqVRoF5b4kg/viewform?usp=header" },
                    { id: 'opt_1c', type: 'resolution', title: 'Option 1C: Device Damage, Loss, or Theft', resolutionText: "To request deactivation of a device license and reassignment to a new IMEI, email Customercaretransitioning@naiyatechnology.org and copy Abubakaribrahimolose@naiyatechnlogy.org & Naiyatransitioningcustomercare@gmail.com." },
                    { id: 'opt_1d', type: 'resolution', title: 'Option 1D: Reactivation or Unresolved Workflow Issues', resolutionText: "For active devices requiring reactivation or workflow issues unresolved for over a week, fill out the Reactivation Request Form:", resolutionLink: "https://docs.google.com/forms/d/e/1FAIpQLSdQuZlgQRqv6bHBaoMByY6JoZhESex7c4VxN1A3TDvLoCojQw/viewform?usp=header" }
                ]
            },
            {
                id: 'cat_2',
                title: 'Metadata Onboarding & Agent Accounts',
                description: 'Training registration, metadata status, blacklisted login.',
                type: 'options',
                options: [
                    { id: 'opt_2a', type: 'resolution', title: 'Option 2A: Register for Training', resolutionText: "To register for training, fill out this form:", resolutionLink: "https://docs.google.com/forms/d/e/1FAIpQLSfxWbHiyCebu0lCrsEzVd6nlhhsClraKYN-VY7bx0Sj6-BOZw/viewform?usp=header" },
                    { id: 'opt_2b', type: 'manual', title: 'Option 2B: Verify Metadata Status', presetCategory: 'Metadata Onboarding & Agent Accounts' },
                    { id: 'opt_2c', type: 'resolution', title: 'Option 2C: Agent Not on Metadata (Post-Training)', resolutionText: "If you are confirmed not on metadata despite training and certification, submit the Agent Upload Request Form:", resolutionLink: "https://docs.google.com/forms/d/e/1FAIpQLSeT5Ou82Iha4zdHZ2ADwPHvcpS8NfNrlyAlSU1sYq6PyLAFHQ/viewform" },
                    { id: 'opt_2d', type: 'resolution', title: 'Option 2D: Resolve Blacklisted Login', resolutionText: "To resolve blacklisted login issues, fill out the Resolution Request Form:", resolutionLink: "https://docs.google.com/forms/d/e/1FAIpQLSftewnstHxw8sZvZA2JVRarpoaqYAQnVHv-2z-Jh6S_TvnGDQ/viewform?usp=header" }
                ]
            },
            { id: 'cat_3', title: 'WEBMAIL', type: 'manual', presetCategory: 'WEBMAIL' },
            { id: 'cat_4', title: 'NIMC Login Details', type: 'manual', presetCategory: 'NIMC Login Details' },
            { id: 'cat_5', title: 'VPN Related', type: 'manual', presetCategory: 'VPN Related' },
            { id: 'cat_6', title: 'Others', description: 'Manual ticket override.', type: 'manual', presetCategory: 'Others' }
        ];
        handleSave(defaults);
    };

    return (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px] z-[100] flex items-center justify-center p-0 sm:p-4 font-sans animate-fade-in">
            <div className="bg-surface-0 dark:bg-dark-card w-full sm:max-w-4xl rounded-none sm:rounded-2xl shadow-modal flex flex-col h-full sm:h-auto max-h-[100dvh] sm:max-h-[90vh] border border-surface-200 dark:border-dark-border animate-scale-in">
                <div className="flex justify-between items-center px-5 md:px-6 py-3.5 border-b border-surface-200 dark:border-dark-border bg-surface-50 dark:bg-dark-surface">
                    <h2 className="text-base font-semibold text-surface-900 dark:text-white flex items-center gap-2">
                        <Icons.Chat className="text-brand-600 dark:text-brand-400" size={18} />
                        <span>Triage Builder (Support Wizard)</span>
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-surface-200 dark:hover:bg-dark-hover rounded-lg text-surface-400 transition-colors" title="Close (Esc)">
                        <Icons.Close size={18} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 bg-gray-50 dark:bg-dark-bg">
                    {loading ? (
                        <div className="flex justify-center p-10"><Icons.Refresh className="animate-spin text-brand-600" size={32} /></div>
                    ) : editingCategory ? (
                        <div className="space-y-6">
                            <button onClick={() => setEditingCategory(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
                                <Icons.Back size={16} /> Back to Categories
                            </button>
                            
                            <div className="bg-white dark:bg-dark-surface p-6 rounded-lg border dark:border-dark-border shadow-sm space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Category Title</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-2 border dark:border-dark-border rounded bg-transparent dark:text-white"
                                        value={editingCategory.title}
                                        onChange={(e) => setEditingCategory({...editingCategory, title: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Short Description (Optional)</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-2 border dark:border-dark-border rounded bg-transparent dark:text-white"
                                        value={editingCategory.description || ''}
                                        onChange={(e) => setEditingCategory({...editingCategory, description: e.target.value})}
                                    />
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <input 
                                        type="checkbox" 
                                        id="disablecat"
                                        checked={editingCategory.disabled || false}
                                        onChange={(e) => setEditingCategory({...editingCategory, disabled: e.target.checked})}
                                    />
                                    <label htmlFor="disablecat" className="text-sm font-medium dark:text-gray-300">Disable Category Temporarily (e.g. for downtime)</label>
                                </div>
                                {editingCategory.disabled && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Disabled Message</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. NIMC network is currently down, please check back later."
                                            className="w-full p-2 border dark:border-dark-border rounded bg-transparent dark:text-white"
                                            value={editingCategory.disabledMessage || ''}
                                            onChange={(e) => setEditingCategory({...editingCategory, disabledMessage: e.target.value})}
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Behavior</label>
                                    <select 
                                        className="w-full p-2 border dark:border-dark-border rounded bg-transparent dark:text-white"
                                        value={editingCategory.type}
                                        onChange={(e) => setEditingCategory({...editingCategory, type: e.target.value as any})}
                                    >
                                        <option value="manual">Pass Through (Create Ticket directly)</option>
                                        <option value="resolution">Show Resolution Text / Form Link</option>
                                        <option value="options">Require Sub-Option Selection</option>
                                    </select>
                                </div>

                                {editingCategory.type === 'manual' && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Preset Ticket Category (Optional)</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. WEBMAIL"
                                            className="w-full p-2 border dark:border-dark-border rounded bg-transparent dark:text-white"
                                            value={editingCategory.presetCategory || ''}
                                            onChange={(e) => setEditingCategory({...editingCategory, presetCategory: e.target.value})}
                                        />
                                    </div>
                                )}

                                {editingCategory.type === 'resolution' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Resolution Text / Instructions</label>
                                            <textarea 
                                                rows={4}
                                                className="w-full p-2 border dark:border-dark-border rounded bg-transparent dark:text-white"
                                                value={editingCategory.resolutionText || ''}
                                                onChange={(e) => setEditingCategory({...editingCategory, resolutionText: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Form Link (Optional)</label>
                                            <input 
                                                type="text" 
                                                className="w-full p-2 border dark:border-dark-border rounded bg-transparent dark:text-white"
                                                value={editingCategory.resolutionLink || ''}
                                                onChange={(e) => setEditingCategory({...editingCategory, resolutionLink: e.target.value})}
                                            />
                                        </div>
                                    </>
                                )}

                                {editingCategory.type === 'options' && (
                                    <div className="mt-4 border-t pt-4 dark:border-dark-border">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold dark:text-white">Sub-Options</h3>
                                            <button onClick={addSubOption} className="text-xs bg-brand-50 text-brand-600 px-3 py-1 rounded font-bold hover:bg-brand-100">Add Option</button>
                                        </div>
                                        <div className="space-y-4">
                                            {editingCategory.options?.map((opt) => (
                                                <div key={opt.id} className="border dark:border-dark-border p-4 rounded-lg relative bg-gray-50 dark:bg-black/20">
                                                    <button onClick={() => deleteSubOption(opt.id)} className="absolute top-2 right-2 text-red-500 hover:text-red-700">
                                                        <Icons.Close size={16} />
                                                    </button>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                                        <div>
                                                            <label className="block text-xs font-medium mb-1 dark:text-gray-400">Option Title</label>
                                                            <input type="text" className="w-full p-1.5 text-sm border dark:border-dark-border rounded bg-white dark:bg-dark-surface dark:text-white" value={opt.title} onChange={e => updateSubOption(opt.id, { title: e.target.value })} />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium mb-1 dark:text-gray-400">Behavior</label>
                                                            <select className="w-full p-1.5 text-sm border dark:border-dark-border rounded bg-white dark:bg-dark-surface dark:text-white" value={opt.type} onChange={e => updateSubOption(opt.id, { type: e.target.value as any })}>
                                                                <option value="resolution">Show Resolution</option>
                                                                <option value="manual">Pass Through to Ticket</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    
                                                    {opt.type === 'resolution' && (
                                                        <div className="space-y-3">
                                                            <div>
                                                                <label className="block text-xs font-medium mb-1 dark:text-gray-400">Text / Instructions</label>
                                                                <textarea rows={3} className="w-full p-1.5 text-sm border dark:border-dark-border rounded bg-white dark:bg-dark-surface dark:text-white" value={opt.resolutionText || ''} onChange={e => updateSubOption(opt.id, { resolutionText: e.target.value })} />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-medium mb-1 dark:text-gray-400">Form Link</label>
                                                                <input type="text" className="w-full p-1.5 text-sm border dark:border-dark-border rounded bg-white dark:bg-dark-surface dark:text-white" value={opt.resolutionLink || ''} onChange={e => updateSubOption(opt.id, { resolutionLink: e.target.value })} />
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {opt.type === 'manual' && (
                                                        <div>
                                                            <label className="block text-xs font-medium mb-1 dark:text-gray-400">Preset Ticket Category</label>
                                                            <input type="text" className="w-full p-1.5 text-sm border dark:border-dark-border rounded bg-white dark:bg-dark-surface dark:text-white" value={opt.presetCategory || ''} onChange={e => updateSubOption(opt.id, { presetCategory: e.target.value })} />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-white dark:bg-dark-surface p-4 rounded-lg shadow-sm border dark:border-dark-border">
                                <div>
                                    <h3 className="font-bold text-gray-800 dark:text-gray-200">Wizard Categories</h3>
                                    <p className="text-sm text-gray-500">Configure the top-level menu items users see when they open a new ticket.</p>
                                </div>
                                <button onClick={addCategory} className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-brand-700 active:scale-95 transition-all shadow-sm">
                                    + Add Category
                                </button>
                            </div>

                            <div className="grid gap-3">
                                {categories.map(cat => (
                                    <div key={cat.id} className="bg-white dark:bg-dark-surface p-4 rounded-lg border dark:border-dark-border shadow-sm flex items-center justify-between group hover:border-brand-500 transition-all">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold dark:text-white">{cat.title}</h4>
                                            {cat.description && <p className="text-sm text-gray-500 truncate">{cat.description}</p>}
                                            <div className="mt-1 flex gap-2">
                                                <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded">{cat.type}</span>
                                                {cat.type === 'options' && <span className="text-[10px] uppercase font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 rounded">{cat.options?.length || 0} sub-options</span>}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setEditingCategory(cat)} className="p-2 text-gray-400 hover:text-brand-600 bg-gray-50 dark:bg-white/5 rounded"><Icons.Settings size={18} /></button>
                                            <button onClick={() => deleteCategory(cat.id)} className="p-2 text-gray-400 hover:text-red-600 bg-gray-50 dark:bg-white/5 rounded"><Icons.Close size={18} /></button>
                                        </div>
                                    </div>
                                ))}
                                {categories.length === 0 && (
                                    <div className="text-center p-10 text-gray-500 bg-white dark:bg-dark-surface rounded-lg border border-dashed dark:border-dark-border">
                                        <p className="mb-4">No categories defined.</p>
                                        <button onClick={seedDefaultTriage} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-900 shadow-sm disabled:opacity-50" disabled={saving}>
                                            Load Default Naiya Options
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t dark:border-dark-border flex justify-end gap-3 bg-white dark:bg-dark-surface">
                    {editingCategory && (
                        <button onClick={saveEditingCategory} disabled={saving} className="bg-brand-600 text-white px-6 py-2 rounded-lg font-bold shadow-sm hover:bg-brand-700">
                            {saving ? 'Saving...' : 'Save Editing Category'}
                        </button>
                    )}
                    {!editingCategory && (
                        <button onClick={onClose} className="bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 px-6 py-2 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-white/20">
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
