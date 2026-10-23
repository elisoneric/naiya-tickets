import React, { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';
import { useToast } from '../../contexts/ToastContext';

interface VpnRecord {
    id: string;
    name?: string;
    password?: string;
    status: string;
    assignedTo?: string;
    lastAssignedAt?: string;
    reviewReason?: string;
}

interface UserDetails {
    email: string;
    role: string;
    swap_count?: number;
    referee_email?: string | null;
    vpn_quota?: number;
}

interface VpnToolModalProps {
    email: string;
    ticketId?: string;
    onClose: () => void;
    onInsertReply?: (text: string) => void;
}

export const VpnToolModal: React.FC<VpnToolModalProps> = ({ email, ticketId, onClose, onInsertReply }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [userData, setUserData] = useState<UserDetails | null>(null);
    const [vpns, setVpns] = useState<VpnRecord[]>([]);
    const [poolAvailable, setPoolAvailable] = useState<number>(0);
    const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

    // Manual assign modal input
    const [customVpnId, setCustomVpnId] = useState('');
    const [showManualAssign, setShowManualAssign] = useState(false);

    const API_URL = import.meta.env?.VITE_API_URL || '/backend/api.php';

    const getAuthHeaders = (): Record<string, string> => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        try {
            const stored = localStorage.getItem('app_user');
            if (stored) {
                const u = JSON.parse(stored);
                if (u?.token) {
                    headers['Authorization'] = `Bearer ${u.token}`;
                }
            }
        } catch {}
        return headers;
    };

    const fetchUserDetails = async () => {
        if (!email) return;
        setLoading(true);
        try {
            const safeEmail = encodeURIComponent(email.trim().toLowerCase());
            const res = await fetch(`${API_URL}?action=vpn_admin_get_user&email=${safeEmail}`, {
                headers: getAuthHeaders()
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                const msg = data?.message || data?.error || `HTTP ${res.status}`;
                throw new Error(msg);
            }
            if (data && data.status === 'success') {
                setUserData(data.user || null);
                setVpns(data.vpns || []);
                setPoolAvailable(data.pool_available_count || 0);
            } else {
                showToast(data?.message || data?.error || 'Failed to load VPN details', 'error');
            }
        } catch (err: any) {
            console.error(err);
            showToast(err?.message || 'Unable to connect to VPN Hub. Please check token or network.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUserDetails();
    }, [email]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showManualAssign) {
                    setShowManualAssign(false);
                } else {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, showManualAssign]);

    const toggleReveal = (vpnId: string) => {
        setRevealedPasswords(prev => ({ ...prev, [vpnId]: !prev[vpnId] }));
    };

    const copyText = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        showToast(`${label} copied to clipboard!`, 'success');
    };

    const handleSwap = async (vpnId?: string) => {
        const confirmSwap = window.confirm(
            `Are you sure you want to swap ${vpnId || 'this user\'s VPN'}? This will mark the old VPN for review and allocate a fresh verified working VPN.`
        );
        if (!confirmSwap) return;

        setActionLoading(`swap-${vpnId || 'auto'}`);
        try {
            const res = await fetch(`${API_URL}?action=vpn_admin_swap`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    vpnId: vpnId || '',
                    reason: `Support Agent swap on ticket #${ticketId || 'manual'}`
                })
            });
            const data = await res.json();
            if (res.ok && data.status === 'success') {
                showToast(data.message || 'VPN successfully swapped!', 'success');
                await fetchUserDetails();
            } else {
                showToast(data.error || data.message || 'Swap failed.', 'error');
            }
        } catch (err: any) {
            console.error(err);
            showToast('Failed to swap VPN.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleAssign = async (specificId?: string) => {
        setActionLoading('assign');
        try {
            const res = await fetch(`${API_URL}?action=vpn_admin_assign`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    specificVpnId: specificId || customVpnId.trim()
                })
            });
            const data = await res.json();
            if (res.ok && data.status === 'success') {
                showToast(data.message || 'VPN assigned successfully!', 'success');
                setShowManualAssign(false);
                setCustomVpnId('');
                await fetchUserDetails();
            } else {
                showToast(data.error || data.message || 'Assignment failed.', 'error');
            }
        } catch (err: any) {
            console.error(err);
            showToast('Failed to assign VPN.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRevoke = async (vpnId: string) => {
        const confirmRevoke = window.confirm(`Are you sure you want to revoke VPN ${vpnId} from ${email}?`);
        if (!confirmRevoke) return;

        setActionLoading(`revoke-${vpnId}`);
        try {
            const res = await fetch(`${API_URL}?action=vpn_admin_revoke`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    vpnId
                })
            });
            const data = await res.json();
            if (res.ok && data.status === 'success') {
                showToast(data.message || 'VPN revoked successfully!', 'success');
                await fetchUserDetails();
            } else {
                showToast(data.error || data.message || 'Revocation failed.', 'error');
            }
        } catch (err: any) {
            console.error(err);
            showToast('Failed to revoke VPN.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleInsertToReply = (vpn: VpnRecord) => {
        if (!onInsertReply) return;

        const replyTemplate = `Hello, here is your VPN:

• Username: ${vpn.id}
• Password: ${vpn.password || '(Contact IT)'}

Advise:
• Use MTN network for best connection.
• Double-check password (no spaces, check Caps Lock).`;

        onInsertReply(replyTemplate);
        showToast('VPN details inserted into reply!', 'success');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-0 sm:p-4 animate-fade-in font-sans">
            <div className="bg-surface-0 dark:bg-dark-card border border-surface-200 dark:border-dark-border w-full sm:max-w-2xl rounded-none sm:rounded-2xl shadow-modal flex flex-col overflow-hidden h-full sm:h-auto max-h-[100dvh] sm:max-h-[90vh] animate-scale-in">
                
                {/* Modal Header */}
                <div className="px-5 md:px-6 py-3.5 border-b border-surface-200 dark:border-dark-border flex items-center justify-between bg-surface-50 dark:bg-dark-surface shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800">
                            <Icons.Shield size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                    In-Ticket VPN Management Tool
                                </h3>
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                    Hub Live
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-sm">
                                Managing: <span className="font-semibold text-gray-700 dark:text-gray-300">{email}</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={fetchUserDetails}
                            disabled={loading || !!actionLoading}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                            title="Refresh Data"
                        >
                            <Icons.Refresh size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <Icons.Close size={20} />
                        </button>
                    </div>
                </div>

                {/* User Overview Bar */}
                <div className="px-6 py-3 bg-slate-50 dark:bg-[#11151c] border-b border-gray-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-4 text-xs shrink-0">
                    <div className="flex items-center gap-4">
                        <div>
                            <span className="text-gray-400 block text-[10px] uppercase font-bold">Role</span>
                            <span className="font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                                {userData?.role || 'Agent'}
                            </span>
                        </div>
                        <div className="h-6 w-px bg-gray-200 dark:bg-white/10" />
                        <div>
                            <span className="text-gray-400 block text-[10px] uppercase font-bold">Assigned Accounts</span>
                            <span className="font-bold text-brand-600 dark:text-brand-400">
                                {vpns.length} VPN{vpns.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div className="h-6 w-px bg-gray-200 dark:bg-white/10" />
                        <div>
                            <span className="text-gray-400 block text-[10px] uppercase font-bold">User Swaps Used</span>
                            <span className={`font-bold ${(userData?.swap_count || 0) >= 1 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {userData?.swap_count || 0} / 1
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            Available Pool: <strong className="text-gray-900 dark:text-white font-bold">{poolAvailable}</strong>
                        </span>
                        <button
                            type="button"
                            onClick={() => handleAssign()}
                            disabled={loading || !!actionLoading}
                            className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                            <Icons.Plus size={14} />
                            <span>Add VPN</span>
                        </button>
                    </div>
                </div>

                {/* Content Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {loading && (
                        <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-400">
                            <Icons.Refresh size={28} className="animate-spin text-brand-600" />
                            <p className="text-sm font-semibold">Contacting VPN Hub Database...</p>
                        </div>
                    )}

                    {!loading && vpns.length === 0 && (
                        <div className="py-12 text-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 p-8 space-y-4">
                            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/5 text-gray-400 mx-auto flex items-center justify-center">
                                <Icons.Shield size={32} />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 dark:text-gray-200 text-base">No VPN Attached to This Email</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1">
                                    This user currently has no VPN credentials assigned. You can assign a verified working account directly from the pool.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleAssign()}
                                disabled={!!actionLoading}
                                className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-all shadow-md inline-flex items-center gap-2"
                            >
                                <Icons.Plus size={16} />
                                <span>Assign First Available VPN</span>
                            </button>
                        </div>
                    )}

                    {!loading && vpns.map((vpn, idx) => {
                        const isRevealed = !!revealedPasswords[vpn.id];
                        const isSwapping = actionLoading === `swap-${vpn.id}`;
                        const isRevoking = actionLoading === `revoke-${vpn.id}`;

                        return (
                            <div
                                key={vpn.id || idx}
                                className="bg-white dark:bg-[#1a202c] border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-4 transition-all hover:border-brand-500/50"
                            >
                                <div className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-white/5 pb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-gray-400">Account #{idx + 1}</span>
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                            vpn.status === 'assigned'
                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                        }`}>
                                            {vpn.status}
                                        </span>
                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                                            <Icons.Check size={11} /> Verified Ready
                                        </span>
                                    </div>

                                    {onInsertReply && (
                                        <button
                                            type="button"
                                            onClick={() => handleInsertToReply(vpn)}
                                            className="px-3 py-1 bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/30 dark:hover:bg-brand-900/50 text-brand-700 dark:text-brand-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                                            title="Insert into agent ticket reply"
                                        >
                                            <Icons.Send size={12} />
                                            <span>Insert Into Reply</span>
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* Username Box */}
                                    <div className="bg-gray-50 dark:bg-black/20 rounded-xl p-3 border border-gray-200/80 dark:border-white/5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                                            VPN Username
                                        </span>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200 select-all truncate">
                                                {vpn.id}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => copyText(vpn.id, 'Username')}
                                                className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded text-gray-400 hover:text-gray-600 transition-colors"
                                                title="Copy username"
                                            >
                                                <span className="text-[10px] font-bold uppercase px-1">Copy</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Password Box */}
                                    <div className="bg-gray-50 dark:bg-black/20 rounded-xl p-3 border border-gray-200/80 dark:border-white/5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                                            VPN Password
                                        </span>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200 select-all truncate">
                                                {isRevealed ? (vpn.password || '(None)') : '••••••••••••'}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleReveal(vpn.id)}
                                                    className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded text-gray-400 hover:text-gray-600 transition-colors"
                                                    title={isRevealed ? 'Hide' : 'Show'}
                                                >
                                                    {isRevealed ? <Icons.EyeOff size={14} /> : <Icons.Eye size={14} />}
                                                </button>
                                                {vpn.password && (
                                                    <button
                                                        type="button"
                                                        onClick={() => copyText(vpn.password!, 'Password')}
                                                        className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded text-gray-400 hover:text-gray-600 transition-colors"
                                                        title="Copy password"
                                                    >
                                                        <span className="text-[10px] font-bold uppercase px-1">Copy</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons for this VPN */}
                                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-white/5">
                                    <button
                                        type="button"
                                        onClick={() => handleSwap(vpn.id)}
                                        disabled={!!actionLoading}
                                        className="px-3 py-1.5 bg-white dark:bg-white/5 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-gray-700 dark:text-gray-200 hover:text-amber-700 dark:hover:text-amber-300 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                                    >
                                        <Icons.Refresh size={13} className={isSwapping ? 'animate-spin' : ''} />
                                        <span>{isSwapping ? 'Swapping...' : 'Swap This VPN'}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleRevoke(vpn.id)}
                                        disabled={!!actionLoading}
                                        className="px-3 py-1.5 bg-white dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-700 dark:text-gray-200 hover:text-red-600 dark:hover:text-red-300 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                                    >
                                        <Icons.Close size={13} />
                                        <span>{isRevoking ? 'Revoking...' : 'Revoke'}</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {/* Manual Assign Drawer */}
                    {showManualAssign ? (
                        <div className="bg-slate-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-2xl p-4 space-y-3">
                            <h5 className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                Assign Specific VPN ID
                            </h5>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={customVpnId}
                                    onChange={e => setCustomVpnId(e.target.value)}
                                    placeholder="e.g. AG-1029.Naiya"
                                    className="flex-1 px-3 py-2 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-brand-500 font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAssign(customVpnId)}
                                    disabled={!customVpnId.trim() || !!actionLoading}
                                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-colors shadow-sm"
                                >
                                    Assign
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowManualAssign(false)}
                                    className="px-3 py-2 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="pt-2 flex items-center justify-between text-xs text-gray-500">
                            <button
                                type="button"
                                onClick={() => setShowManualAssign(true)}
                                className="text-brand-600 dark:text-brand-400 hover:underline font-semibold"
                            >
                                + Assign specific VPN username manually
                            </button>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/80 dark:bg-black/20 flex items-center justify-between shrink-0">
                    <span className="text-[11px] text-gray-400">
                        Changes are committed immediately to the live VPN Hub database.
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 bg-gray-800 hover:bg-gray-900 dark:bg-white/10 dark:hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
