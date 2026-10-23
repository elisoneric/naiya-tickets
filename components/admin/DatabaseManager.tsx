import React, { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';
import * as storage from '../../services/storageService';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

// API Endpoint for PHP Backup Handler
const BACKUP_API_URL = import.meta.env?.VITE_BACKUP_API_URL || '/backend/backup_handler.php';
const API_URL = import.meta.env?.VITE_API_URL || '/backend/api.php';

export const DatabaseManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [loading, setLoading] = useState(false);
    const [serverBackups, setServerBackups] = useState<any[]>([]);
    const { showToast } = useToast();
    const { user } = useAuth();
    const authHeaders = { 'Authorization': `Bearer ${user?.token ?? ''}` };

    useEffect(() => {
        fetchServerBackups();
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

    const fetchServerBackups = async () => {
        try {
            const res = await fetch(`${BACKUP_API_URL}?action=list`, { headers: authHeaders });
            const json = await res.json();
            if (json.status === 'success') {
                setServerBackups(json.files);
            }
        } catch (e) {
            console.warn("Could not fetch server backups (PHP script might be missing or in Dev mode)");
        }
    };

    const handleLocalExport = async () => {
        setLoading(true);
        try {
            const data = await storage.getAllSystemData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `local_backup_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Backup downloaded successfully', 'success');
        } catch (e) {
            showToast('Export failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleServerExport = async () => {
        setLoading(true);
        try {
            const data = await storage.getAllSystemData();
            
            const response = await fetch(`${BACKUP_API_URL}?action=save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                showToast(result.message, 'success');
                fetchServerBackups(); // Refresh list
            } else {
                throw new Error(result.message);
            }
        } catch (e: any) {
            showToast('Server backup failed: ' + e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRestoreFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm("CRITICAL WARNING:\n\nThis will ERASE current database and restore from the file.\nThis cannot be undone.\n\nContinue?")) {
            e.target.value = ''; // Reset
            return;
        }

        setLoading(true);
        try {
            const text = await file.text();
            const json = JSON.parse(text);
            await storage.restoreSystemData(json);
            showToast('System restored successfully', 'success');
        } catch (err) {
            console.error(err);
            showToast('Restore failed: Invalid file or API error', 'error');
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    const handleServerRestore = async (filename: string) => {
        if (!confirm(`CRITICAL WARNING:\n\nRestore from ${filename}?\nThis will ERASE current database and replace it with this backup.\n\nContinue?`)) return;

        setLoading(true);
        try {
            const response = await fetch(`${BACKUP_API_URL}?action=get&file=${filename}`, { headers: authHeaders });
            if (!response.ok) throw new Error("Failed to fetch file");
            
            const json = await response.json();
            await storage.restoreSystemData(json);
            showToast('System restored from server backup', 'success');
        } catch (e) {
            showToast('Restore failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCleanup = async (type: 'closed' | 'stale_unreplied') => {
        const msg = type === 'closed' 
            ? "This will backup and delete ALL closed tickets. Continue?" 
            : "This will backup and delete ALL tickets unreplied by agents for over 1 month. Continue?";
            
        if (!confirm(msg)) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}?action=cleanup_tickets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({ type })
            });
            const json = await res.json();
            if (json.status === 'success') {
                showToast(`Successfully backed up and deleted ${json.deletedCount} tickets.`, 'success');
                fetchServerBackups();
            } else {
                throw new Error(json.message);
            }
        } catch (e: any) {
            showToast('Cleanup failed: ' + e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRunMigration = async () => {
        if (!confirm("Run database migration? This adds any missing schema columns (safe to run multiple times).")) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}?action=upgrade`, { headers: authHeaders });
            const json = await res.json();
            if (json.status === 'success') {
                showToast('Database migration completed successfully', 'success');
            } else {
                throw new Error(json.message);
            }
        } catch (e: any) {
            showToast('Migration failed: ' + e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-[2px] p-0 sm:p-4 animate-fade-in font-sans">
            <div className="bg-surface-0 dark:bg-dark-card w-full sm:max-w-2xl rounded-none sm:rounded-2xl shadow-modal overflow-hidden flex flex-col h-full sm:h-auto max-h-[100dvh] sm:max-h-[90vh] border border-surface-200 dark:border-dark-border animate-scale-in">
                <div className="px-5 md:px-6 py-3.5 border-b border-surface-200 dark:border-dark-border flex justify-between items-center bg-surface-50 dark:bg-dark-surface">
                    <h3 className="font-semibold text-base text-surface-900 dark:text-white flex items-center gap-2">
                        <Icons.Briefcase size={18} className="text-brand-600 dark:text-brand-400" /> 
                        <span>System Database & Backups</span>
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-surface-200 dark:hover:bg-dark-hover rounded-lg text-surface-400 transition-colors" title="Close (Esc)">
                        <Icons.Close size={18} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    <div className="mb-6 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900">
                        <p className="font-bold text-blue-800 dark:text-blue-300 mb-1">Data Migration Center</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Create JSON backups or restore data. 
                            <strong> Note:</strong> Restoring overwrites all existing data.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        {/* Local Controls */}
                        <div className="p-4 border dark:border-dark-border rounded-xl">
                            <h4 className="font-bold mb-4 flex items-center gap-2 dark:text-white"><Icons.Inbox size={16} className="rotate-180" /> Local Device</h4>
                            <div className="space-y-3">
                                <button 
                                    onClick={handleLocalExport}
                                    disabled={loading}
                                    className="w-full py-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Download JSON
                                </button>
                                <div className="relative">
                                    <input 
                                        type="file" 
                                        accept=".json" 
                                        onChange={handleRestoreFromFile}
                                        disabled={loading}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                    />
                                    <button 
                                        disabled={loading}
                                        className="w-full py-2 bg-red-50 text-red-700 border border-red-200 dark:bg-transparent dark:border-red-900 dark:text-red-400 rounded-lg text-sm font-bold hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        Restore from File
                                    </button>
                                </div>

                            </div>
                        </div>

                        {/* Server Controls */}
                        <div className="p-4 border dark:border-dark-border rounded-xl bg-gray-50 dark:bg-dark-bg">
                             <h4 className="font-bold mb-4 flex items-center gap-2 dark:text-white"><Icons.Dashboard size={16} /> Web Server</h4>
                             <button 
                                onClick={handleServerExport}
                                disabled={loading}
                                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                {loading ? <Icons.Refresh className="animate-spin" size={16} /> : <Icons.Shield size={16} />}
                                Create Server Backup
                            </button>
                        </div>
                    </div>

                    <h4 className="font-bold mb-3 mt-6 text-sm uppercase tracking-wider text-gray-500">Available Server Backups</h4>
                    <div className="border dark:border-dark-border rounded-xl overflow-hidden mb-8">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-100 dark:bg-white/5 font-bold text-gray-500">
                                <tr>
                                    <th className="p-3">Filename</th>
                                    <th className="p-3">Date</th>
                                    <th className="p-3 text-right">Size</th>
                                    <th className="p-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                                {serverBackups.length === 0 ? (
                                    <tr><td colSpan={4} className="p-4 text-center text-gray-400">No server backups found.</td></tr>
                                ) : (
                                    serverBackups.map((file) => (
                                        <tr key={file.name} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                            <td className="p-3 font-medium dark:text-white truncate max-w-[150px]">{file.name}</td>
                                            <td className="p-3 text-gray-500">{file.date}</td>
                                            <td className="p-3 text-right text-gray-500">{file.size}</td>
                                            <td className="p-3 text-right">
                                                <button 
                                                    onClick={() => handleServerRestore(file.name)}
                                                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-bold"
                                                >
                                                    Restore
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-lg border border-yellow-200 dark:border-yellow-900">
                        <p className="font-bold text-yellow-800 dark:text-yellow-300 mb-1">Database Migration</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            Apply schema updates (adds new columns, safe to run multiple times).
                        </p>
                        <button
                            onClick={handleRunMigration}
                            disabled={loading}
                            className="py-2 px-4 bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300 rounded-lg text-sm font-bold hover:bg-yellow-200 dark:hover:bg-yellow-900/40 transition-colors"
                        >
                            Run Migration
                        </button>
                    </div>

                    <div className="mb-6 bg-red-50 dark:bg-red-900/10 p-4 rounded-lg border border-red-100 dark:border-red-900">
                        <p className="font-bold text-red-800 dark:text-red-300 mb-1">System Cleanup</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            Free up database space by backing up and removing old tickets.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button 
                                onClick={() => handleCleanup('closed')}
                                disabled={loading}
                                className="flex-1 py-2 bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 rounded-lg text-sm font-bold hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
                            >
                                Backup & Delete Closed Tickets
                            </button>
                            <button 
                                onClick={() => handleCleanup('stale_unreplied')}
                                disabled={loading}
                                className="flex-1 py-2 bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300 rounded-lg text-sm font-bold hover:bg-orange-200 dark:hover:bg-orange-900/40 transition-colors"
                            >
                                Backup & Delete Stale Tickets (&gt;1mo unreplied)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
