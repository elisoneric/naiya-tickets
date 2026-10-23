import React, { useState } from 'react';
import { Icons } from '../common/Icons';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

interface ReportItem {
    id: number | string;
    identifier: string;
    identifier_type: string;
    month: string;
    month_label: string;
    enrollment_count: number;
    status: string;
}

interface AgentReportData {
    identifier: string;
    identifier_type: string;
    full_name: string;
    fep_category: string;
    license_type: string;
    verification_status: string;
    total_enrollments: number;
    periods_count: number;
    reports: ReportItem[];
    tracked_source?: string;
}

interface PayPortalModalProps {
    onClose: () => void;
    isDisabled?: boolean;
    disabledMessage?: string;
}

export const PayPortalModal: React.FC<PayPortalModalProps> = ({ onClose, isDisabled, disabledMessage }) => {
    const { user } = useAuth();
    const { showToast } = useToast();

    const [inputType, setInputType] = useState<'imei' | 'nin'>('imei');
    const [identifier, setIdentifier] = useState('');
    const [email, setEmail] = useState(user?.email || '');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [reportData, setReportData] = useState<AgentReportData | null>(null);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const idTrimmed = identifier.trim();
        const emailTrimmed = email.trim();

        if (!idTrimmed) {
            setErrorMessage('Please enter your Device IMEI or Enroller NIN.');
            return;
        }

        if (!emailTrimmed) {
            setErrorMessage('Please provide your official email address.');
            return;
        }

        if (isDisabled) {
            setErrorMessage(disabledMessage || 'Payment & Work Report portal is currently undergoing scheduled maintenance.');
            return;
        }

        setLoading(true);
        setErrorMessage('');

        try {
            const backendUrl = `/backend/api.php?action=pay_get_report&identifier=${encodeURIComponent(idTrimmed)}&email=${encodeURIComponent(emailTrimmed)}&source=ticket_site`;
            
            let res = await fetch(backendUrl, { credentials: 'omit' });
            let data = null;

            if (res.ok) {
                data = await res.json();
            } else if (res.status === 404) {
                const errData = await res.json().catch(() => null);
                throw new Error(errData?.message || `No enrollment record found for "${idTrimmed}". Please check your IMEI or NIN.`);
            } else if (res.status === 503) {
                const errData = await res.json().catch(() => null);
                if (errData?.code === 'SITE_MAINTENANCE') {
                    if (typeof window !== 'undefined') {
                        try {
                            localStorage.setItem('site_maintenance_mode', '1');
                            if (errData.message) localStorage.setItem('site_maintenance_msg', errData.message);
                        } catch {}
                        window.dispatchEvent(new CustomEvent('site-maintenance-updated', {
                            detail: { mode: true, message: errData.message }
                        }));
                    }
                }
                throw new Error(errData?.message || 'Payment & Work Report portal is temporarily undergoing scheduled maintenance.');
            } else if (res.status === 403) {
                const errData = await res.json().catch(() => null);
                throw new Error(errData?.message || 'Access to Payment & Work Report is restricted.');
            } else {
                throw new Error('Support gateway returned error (' + res.status + '). Service may be undergoing maintenance.');
            }

            if (data?.status === 'success' && data.data) {
                setReportData(data.data);
                showToast('Work record loaded successfully.', 'success');
            } else {
                throw new Error(data?.message || 'No record found.');
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'Unable to connect to Pay System API. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = () => {
        if (!reportData) return;
        const headers = ['Period', 'Enrollments', 'Status'];
        const rows = (reportData.reports || []).map(r => [
            `"${r.month_label || r.month}"`,
            r.enrollment_count,
            `"${r.status || 'Verified'}"`
        ]);

        const csvContent = [
            `"NA'IYA TECHNOLOGIES & SAMUIKY GLOBAL - OFFICIAL ENROLLER STATEMENT"`,
            `"Identifier","${reportData.identifier}"`,
            `"Identifier Type","${reportData.identifier_type}"`,
            `"Agent Name","${reportData.full_name}"`,
            `"FEP Category","${reportData.fep_category}"`,
            `"Total Verified Enrollments","${reportData.total_enrollments}"`,
            `"Queried By","${email}"`,
            `"Generated At","${new Date().toISOString()}"`,
            '',
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `work_report_${reportData.identifier}_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Statement exported to CSV.', 'success');
    };

    const handlePrint = () => {
        window.print();
    };

    if (isDisabled) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-[#090e17] overflow-y-auto font-sans text-slate-800 dark:text-slate-100 animate-fade-in">
                {/* Top Navigation Bar */}
                <header className="sticky top-0 z-30 px-4 sm:px-8 py-3 bg-white/95 dark:bg-[#0c1322]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <button
                            onClick={onClose}
                            className="inline-flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold transition-all border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-xs cursor-pointer shrink-0"
                            title="Back to Help Center"
                        >
                            <Icons.Back size={16} />
                            <span className="hidden sm:inline">Back to Help Center</span>
                            <span className="sm:hidden">Back</span>
                        </button>

                        <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>

                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                                <Icons.CreditCard size={20} />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-xs sm:text-sm font-black tracking-tight text-slate-900 dark:text-white uppercase truncate">
                                    Payment & Work Report
                                </h1>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Close"
                    >
                        <Icons.Close size={20} />
                    </button>
                </header>

                {/* Maintenance Body */}
                <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-16 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 rounded-3xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center mb-6 shadow-md">
                        <Icons.CreditCard size={38} />
                    </div>
                    <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-bold uppercase tracking-wider mb-3">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        Service Maintenance Active
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
                        Payment & Work Report Offline
                    </h2>
                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-lg mb-8">
                        {disabledMessage || 'The Payment & Work Report portal is temporarily undergoing scheduled maintenance. Please check back later.'}
                    </p>
                    <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-left mb-8 shadow-xs">
                        <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">
                            Temporarily Suspended Operations:
                        </h4>
                        <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span>Enroller monthly volume statement lookups</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span>Device IMEI record verification</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span>Official CSV disbursement downloads</span>
                            </li>
                        </ul>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl text-sm hover:opacity-90 transition-opacity"
                    >
                        Return to Help Center
                    </button>
                </main>
            </div>
        );
    }

    return (
        /* Full Page View */
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-[#090e17] overflow-y-auto font-sans text-slate-800 dark:text-slate-100 animate-fade-in">
            
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-30 px-4 sm:px-8 py-3 bg-white/95 dark:bg-[#0c1322]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <button
                        onClick={onClose}
                        className="inline-flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold transition-all border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-xs cursor-pointer shrink-0"
                        title="Back to Help Center"
                    >
                        <Icons.Back size={16} />
                        <span className="hidden sm:inline">Back to Help Center</span>
                        <span className="sm:hidden">Back</span>
                    </button>

                    <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>

                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                            <Icons.CreditCard size={20} />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xs sm:text-sm font-black tracking-tight text-slate-900 dark:text-white uppercase truncate">
                                <span className="hidden sm:inline">NA'IYA TECHNOLOGIES & SAMUIKY GLOBAL</span>
                                <span className="sm:hidden">NA'IYA & SAMUIKY</span>
                            </h1>
                            <p className="text-[10px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 truncate">
                                <Icons.Shield size={11} />
                                <span>Official Agent Reporter</span>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                        title="Close (Esc)"
                    >
                        <Icons.Close size={20} />
                    </button>
                </div>
            </header>

            {/* Main Workspace */}
            <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
                {!reportData ? (
                    /* Search & Identification View */
                    <div className="max-w-xl mx-auto py-4 sm:py-8 space-y-6 animate-fade-in">
                        
                        <div className="text-center space-y-2">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold">
                                <Icons.Briefcase size={13} />
                                <span>Enroller Work Verification</span>
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                Check Work Done Records
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                                Query monthly enrollment counts and performance statements under <strong>NA'IYA TECHNOLOGIES LIMITED</strong> and <strong>SAMUIKY GLOBAL LTD</strong>.
                            </p>
                        </div>

                        <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xl space-y-5">
                            
                            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200 dark:border-slate-700/80">
                                <button
                                    type="button"
                                    onClick={() => { setInputType('imei'); setErrorMessage(''); }}
                                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                        inputType === 'imei'
                                            ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    <Icons.Shield size={14} />
                                    <span>Device IMEI</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setInputType('nin'); setErrorMessage(''); }}
                                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                        inputType === 'nin'
                                            ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    <Icons.User size={14} />
                                    <span>Enroller NIN</span>
                                </button>
                            </div>

                            <form onSubmit={handleSearch} className="space-y-4">
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                                        Email Address <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                            <Icons.Mail size={16} className="text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            placeholder="enroller@example.com"
                                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm font-medium bg-slate-50 dark:bg-[#0b1120] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700/80 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all lowercase"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                                        {inputType === 'imei' ? 'Device IMEI' : 'Enroller NIN'} <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                            <Icons.Lock size={16} className="text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            value={identifier}
                                            onChange={e => setIdentifier(e.target.value.toUpperCase())}
                                            placeholder={inputType === 'imei' ? 'Enter Device IMEI' : 'Enter 11-digit NIN'}
                                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm font-semibold bg-slate-50 dark:bg-[#0b1120] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700/80 font-mono tracking-tight outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all uppercase"
                                        />
                                    </div>
                                </div>

                                {errorMessage && (
                                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
                                        <span>{errorMessage}</span>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                                >
                                    {loading ? (
                                        <>
                                            <Icons.Refresh size={16} className="animate-spin" />
                                            <span>Loading Records...</span>
                                        </>
                                    ) : (
                                        <span>View Work Done Report</span>
                                    )}
                                </button>
                            </form>

                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-400 text-center">
                            <span>Official NIMC Audit</span>
                            <span>•</span>
                            <span>NA'IYA TECHNOLOGIES & SAMUIKY GLOBAL</span>
                        </div>

                    </div>
                ) : (
                    /* Statement Display View */
                    <div className="space-y-6 animate-fade-in">
                        
                        {/* Toolbar: Search Another Identifier, Export CSV, Print */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                            <button
                                onClick={() => setReportData(null)}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer py-1.5 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <Icons.Back size={14} />
                                <span>Search Another Identifier</span>
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleExportCSV}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                                >
                                    <Icons.Download size={14} />
                                    <span>Export CSV</span>
                                </button>

                                <button
                                    onClick={handlePrint}
                                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer"
                                >
                                    <Icons.Printer size={14} />
                                    <span>Print Official Slip</span>
                                </button>
                            </div>
                        </div>

                        {/* Summary Card */}
                        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-700">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider">
                                            {reportData.verification_status || 'VERIFIED'}
                                        </span>
                                        <span className="px-3 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-mono">
                                            {reportData.identifier_type}: {reportData.identifier}
                                        </span>
                                    </div>

                                    <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                                        {reportData.full_name}
                                    </h3>

                                    <div className="text-xs text-slate-300 flex items-center gap-2 font-medium">
                                        <span>FEP Partner:</span>
                                        <strong className="text-emerald-400">{reportData.fep_category}</strong>
                                        <span>•</span>
                                        <span>License: {reportData.license_type}</span>
                                    </div>
                                </div>

                                <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 text-center md:text-right shrink-0">
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                                        Total Verified Enrollments
                                    </div>
                                    <div className="text-3xl sm:text-4xl font-black text-emerald-400 mt-1">
                                        {reportData.total_enrollments.toLocaleString()}
                                    </div>
                                    <div className="text-[11px] text-slate-300 mt-0.5">
                                        Across {reportData.periods_count} Active Reporting Periods
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Breakdown Table */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between pb-1">
                                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <Icons.Chart size={16} className="text-blue-500" />
                                    <span>Monthly Performance Breakdown</span>
                                </h4>
                                <span className="text-xs text-slate-400 font-medium">
                                    Showing all verified periods
                                </span>
                            </div>

                            <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                                <table className="w-full text-left text-xs sm:text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                                            <th className="py-3 px-4 sm:px-6">Reporting Month</th>
                                            <th className="py-3 px-4 sm:px-6 text-right">Verified Enrollments</th>
                                            <th className="py-3 px-4 sm:px-6 text-right">Audit Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {(reportData.reports || []).map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                                <td className="py-3.5 px-4 sm:px-6 font-semibold text-slate-800 dark:text-slate-200">
                                                    {item.month_label || item.month}
                                                </td>
                                                <td className="py-3.5 px-4 sm:px-6 text-right font-black text-slate-900 dark:text-white font-mono text-base">
                                                    {item.enrollment_count.toLocaleString()}
                                                </td>
                                                <td className="py-3.5 px-4 sm:px-6 text-right">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                                        {item.status || 'Verified & Cleared'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-50 dark:bg-slate-900/80 font-bold border-t border-slate-200 dark:border-slate-800">
                                            <td className="py-3.5 px-4 sm:px-6 text-slate-700 dark:text-slate-300">
                                                Cumulative Aggregate Total
                                            </td>
                                            <td className="py-3.5 px-4 sm:px-6 text-right font-black text-emerald-600 dark:text-emerald-400 font-mono text-base">
                                                {reportData.total_enrollments.toLocaleString()}
                                            </td>
                                            <td className="py-3.5 px-4 sm:px-6 text-right text-xs text-slate-500 font-medium">
                                                Operational Clearance
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                    </div>
                )}
            </main>

            {/* Simple Footer */}
            <footer className="mt-auto border-t border-slate-200 dark:border-slate-800/80 py-4 bg-white/50 dark:bg-[#0c1322]/50 text-center text-xs text-slate-400 print:hidden">
                <p>&copy; 2026 NA'IYA TECHNOLOGIES LIMITED & SAMUIKY GLOBAL LTD. All rights reserved.</p>
            </footer>
        </div>
    );
};
