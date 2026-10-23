import React, { useState } from 'react';
import { Icons } from './Icons';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

interface MaintenanceOverlayProps {
    message?: string;
    onLoginSuccess?: () => void;
}

export const MaintenanceOverlay: React.FC<MaintenanceOverlayProps> = ({ message, onLoginSuccess }) => {
    const [showStaffModal, setShowStaffModal] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const { loginStaff, loginTeamLead } = useAuth();
    const { showToast } = useToast();

    const handleStaffLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        const emailTrimmed = email.trim();
        if (!emailTrimmed) {
            setErrorMsg('Please enter your IT Staff or Administrator email.');
            return;
        }

        if (!password) {
            setErrorMsg('Please enter your password.');
            return;
        }

        setSubmitting(true);
        try {
            // Attempt staff login first, fallback to team lead
            let success = await loginStaff(emailTrimmed, password);
            if (!success) {
                success = await loginTeamLead(emailTrimmed, password);
            }

            if (success) {
                showToast('Authenticated as Administrator. Welcome back.', 'success');
                setShowStaffModal(false);
                if (onLoginSuccess) {
                    onLoginSuccess();
                }
            } else {
                setErrorMsg('Invalid staff email or password. Access restricted.');
            }
        } catch (err: any) {
            setErrorMsg(err?.message || 'Authentication error. Please check credentials.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-950 text-white flex flex-col justify-between overflow-y-auto font-sans selection:bg-amber-500/30">
            {/* Background ambient lighting */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-amber-500/15 via-orange-500/10 to-transparent blur-3xl rounded-full" />
                <div className="absolute bottom-0 left-1/4 w-[500px] h-[300px] bg-brand-600/10 blur-3xl rounded-full" />
            </div>

            {/* Top Bar */}
            <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center font-black text-slate-950 text-lg shadow-md shadow-amber-500/20">
                        N
                    </div>
                    <div>
                        <span className="font-black text-base tracking-tight text-white block">
                            NA'IYA IT DESK
                        </span>
                        <span className="text-[10px] text-slate-400 tracking-wider uppercase font-semibold block">
                            Operations & Service Infrastructure
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-sm shadow-amber-400/80" />
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider bg-amber-950/60 border border-amber-800/80 px-3 py-1 rounded-full">
                        Maintenance Mode
                    </span>
                </div>
            </header>

            {/* Main Center Hero */}
            <main className="relative z-10 w-full max-w-3xl mx-auto px-6 py-12 my-auto text-center flex flex-col items-center">
                {/* Shield / Gear Icon Container */}
                <div className="relative mb-6">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-amber-500/30 flex items-center justify-center shadow-2xl shadow-amber-500/10 relative">
                        <Icons.Settings size={44} className="text-amber-400 animate-[spin_10s_linear_infinite]" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-lg">
                        <Icons.Alert size={16} />
                    </div>
                </div>

                {/* Status Pill */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-wide uppercase mb-4">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>System Under Scheduled Maintenance</span>
                </div>

                {/* Primary Headline */}
                <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight mb-4">
                    Platform Temporarily Offline for Upgrades
                </h1>

                {/* Custom Maintenance Message */}
                <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed mb-8">
                    {message || 'The IT Technical Team is performing scheduled system upgrades. Regular services, ticket submission, and agent portals are temporarily offline. Normal operations will resume shortly.'}
                </p>

                {/* Status Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full max-w-2xl mb-10 text-left">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                            Ticketing Desk
                        </div>
                        <p className="text-xs text-slate-300 font-semibold">Submissions Paused</p>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                            Pay & Work Reports
                        </div>
                        <p className="text-xs text-slate-300 font-semibold">Gateway Offline</p>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                            IT Technical Team
                        </div>
                        <p className="text-xs text-slate-300 font-semibold">Maintenance In Progress</p>
                    </div>
                </div>

                {/* Staff Bypass Trigger */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 hover:border-slate-600 flex items-center gap-2"
                    >
                        <Icons.Refresh size={14} />
                        Check Status / Refresh
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowStaffModal(true)}
                        className="px-5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 text-xs font-bold transition-all border border-amber-500/30 flex items-center gap-2"
                    >
                        <Icons.User size={14} />
                        IT Staff & Administrator Login
                    </button>
                </div>
            </main>

            {/* Bottom Footer */}
            <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 border-t border-slate-900 gap-2">
                <span>NA'IYA TECHNOLOGIES & SAMUIKY GLOBAL SYSTEMS</span>
                <span>Protected Management Infrastructure · Scheduled Maintenance Window</span>
            </footer>

            {/* Staff / IT Admin Login Modal */}
            {showStaffModal && (
                <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-scale-in">
                        <button
                            type="button"
                            onClick={() => { setShowStaffModal(false); setErrorMsg(''); }}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            <Icons.Close size={18} />
                        </button>

                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
                                <Icons.Shield size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-base">IT Administrator Authentication</h3>
                                <p className="text-xs text-slate-400">Access management console during maintenance</p>
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-center gap-2">
                                <Icons.Alert size={14} className="shrink-0 text-red-400" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <form onSubmit={handleStaffLogin} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                                    Staff Email / Username
                                </label>
                                <input
                                    type="text"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="itstaff@naiyatechnology.org"
                                    required
                                    autoFocus
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-amber-400 outline-none placeholder-slate-500 font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="••••••••••••"
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-amber-400 outline-none placeholder-slate-500 pr-10 font-medium"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                    >
                                        <Icons.Eye size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowStaffModal(false); setErrorMsg(''); }}
                                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-xs font-black transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                                >
                                    {submitting ? (
                                        <Icons.Refresh size={14} className="animate-spin text-slate-950" />
                                    ) : (
                                        'Authenticate'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
