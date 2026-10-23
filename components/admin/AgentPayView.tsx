import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Icons } from '../common/Icons';
import { useTickets } from '../../contexts/TicketContext';
import { useToast } from '../../contexts/ToastContext';
import { 
    PayAgent, 
    PayMonthlyReport, 
    PaySummary, 
    PayAccessLog,
    searchPayRecords, 
    getPayRecord, 
    formatPayTicketSummary,
    fetchPayAccessLogs,
    getPayAccessLogsExportUrl
} from '../../services/payService';

const AVAILABLE_MONTHS = [
    { value: 'all', label: 'All Recorded Months' },
    { value: 'sep_2026', label: 'September 2026' },
    { value: 'aug_2026', label: 'August 2026' },
    { value: 'jul_2026', label: 'July 2026' },
    { value: 'jun_2026', label: 'June 2026' },
    { value: 'may_2026', label: 'May 2026' },
    { value: 'apr_2026', label: 'April 2026' },
    { value: 'mar_2026', label: 'March 2026' },
    { value: 'feb_2026', label: 'February 2026' },
    { value: 'jan_2026', label: 'January 2026' },
    { value: 'dec_2025', label: 'December 2025' },
    { value: 'nov_2025', label: 'November 2025' },
    { value: 'oct_2025', label: 'October 2025' },
    { value: 'sep_2025', label: 'September 2025' },
    { value: 'jul_2025', label: 'July 2025' },
    { value: 'jun_2025', label: 'June 2025' },
];

export const AgentPayView: React.FC = () => {
    const { 
        activeTicketId, 
        activeTicket, 
        setActiveFolder, 
        payTargetQuery, 
        setPayTargetQuery 
    } = useTickets();
    const { showToast } = useToast();

    // Primary View Tab
    const [viewMode, setViewMode] = useState<'directory' | 'audit_logs'>('directory');

    // --- Directory State ---
    const [searchQuery, setSearchQuery] = useState(payTargetQuery || '');
    const [selectedFep, setSelectedFep] = useState<'All FEPs' | 'NAIYA TECHNOLOGIES LIMITED' | 'SAMUIKY GLOBAL'>('All FEPs');
    const [selectedMonth, setSelectedMonth] = useState<string>('all');
    const [dirSortBy, setDirSortBy] = useState<'volume_desc' | 'volume_asc' | 'name_asc'>('volume_desc');
    const [dirPage, setDirPage] = useState<number>(1);
    const [dirLimit, setDirLimit] = useState<number>(50);
    const [dirTotalFiltered, setDirTotalFiltered] = useState<number>(0);
    const [dirTotalPages, setDirTotalPages] = useState<number>(1);
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<PayAgent[]>([]);

    // Agent Details State
    const [selectedAgent, setSelectedAgent] = useState<PayAgent | null>(null);
    const [agentReports, setAgentReports] = useState<PayMonthlyReport[]>([]);
    const [agentSummary, setAgentSummary] = useState<PaySummary | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [copiedSummary, setCopiedSummary] = useState(false);

    // --- Access Audit Logs State ---
    const [logSearchQuery, setLogSearchQuery] = useState<string>('');
    const [logStatus, setLogStatus] = useState<string>('ALL');
    const [logSource, setLogSource] = useState<string>('ALL');
    const [logTimeFilter, setLogTimeFilter] = useState<string>('all');
    const [logStartDate, setLogStartDate] = useState<string>('');
    const [logEndDate, setLogEndDate] = useState<string>('');
    const [logSortBy, setLogSortBy] = useState<string>('newest');
    const [logPage, setLogPage] = useState<number>(1);
    const [logLimit, setLogLimit] = useState<number>(50);
    const [logTotalFiltered, setLogTotalFiltered] = useState<number>(0);
    const [logTotalRecords, setLogTotalRecords] = useState<number>(0);
    const [logTotalPages, setLogTotalPages] = useState<number>(1);
    const [logs, setLogs] = useState<PayAccessLog[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);

    // Initial search or target query handler
    const runSearch = useCallback(async (query: string, fep: string, month: string, sortBy: 'volume_desc' | 'volume_asc' | 'name_asc', page: number, limit: number) => {
        setIsSearching(true);
        try {
            const res = await searchPayRecords(query, fep, { month, sortBy, page, limit });
            if (res.status === 'success') {
                setSearchResults(res.agents);
                setDirTotalFiltered(res.total_filtered ?? res.agents.length);
                setDirTotalPages(res.total_pages ?? 1);
                setDirPage(res.page ?? 1);

                if (res.agents.length === 1 && !selectedAgent) {
                    loadAgentDetails(res.agents[0].identifier);
                } else if (res.agents.length === 0 && query.trim().length >= 8) {
                    // Try direct lookup if query might be exact identifier
                    const direct = await getPayRecord(query.trim());
                    if (direct.status === 'success' && direct.agent) {
                        setSearchResults([direct.agent]);
                        setSelectedAgent(direct.agent);
                        setAgentReports(direct.reports || []);
                        setAgentSummary(direct.summary || null);
                    }
                }
            } else {
                setSearchResults([]);
            }
        } catch (err: any) {
            console.error('Pay search error:', err);
            showToast('Failed to perform pay records search', 'error');
        } finally {
            setIsSearching(false);
        }
    }, [selectedAgent, showToast]);

    // Load full details for a chosen agent
    const loadAgentDetails = useCallback(async (identifier: string) => {
        setIsLoadingDetails(true);
        setCopiedSummary(false);
        try {
            const res = await getPayRecord(identifier);
            if (res.status === 'success' && res.agent) {
                setSelectedAgent(res.agent);
                setAgentReports(res.reports || []);
                setAgentSummary(res.summary || null);
            } else {
                showToast(res.message || 'Unable to retrieve agent details', 'error');
            }
        } catch (err: any) {
            console.error('Pay get record error:', err);
            showToast('Failed to load agent monthly reports', 'error');
        } finally {
            setIsLoadingDetails(false);
        }
    }, [showToast]);

    // Fetch live access logs from pay portal
    const loadAuditLogs = useCallback(async () => {
        setIsLoadingLogs(true);
        try {
            const res = await fetchPayAccessLogs({
                page: logPage,
                limit: logLimit,
                q: logSearchQuery,
                status: logStatus,
                source: logSource,
                timeFilter: logTimeFilter,
                startDate: logStartDate,
                endDate: logEndDate,
                sortBy: logSortBy
            });

            if (res.status === 'success') {
                setLogs(res.logs);
                setLogTotalFiltered(res.total_filtered);
                setLogTotalRecords(res.total_records);
                setLogTotalPages(res.total_pages);
            } else {
                setLogs([]);
            }
        } catch (err: any) {
            console.error('Audit logs error:', err);
            showToast('Failed to retrieve access audit logs', 'error');
        } finally {
            setIsLoadingLogs(false);
        }
    }, [logPage, logLimit, logSearchQuery, logStatus, logSource, logTimeFilter, logStartDate, logEndDate, logSortBy, showToast]);

    // Auto-search on mount if payTargetQuery is provided
    useEffect(() => {
        if (payTargetQuery) {
            setSearchQuery(payTargetQuery);
            runSearch(payTargetQuery, selectedFep, selectedMonth, dirSortBy, 1, dirLimit);
        } else {
            runSearch('', selectedFep, selectedMonth, dirSortBy, 1, dirLimit);
        }
    }, [payTargetQuery]);

    // Load logs on tab switch or filter changes
    useEffect(() => {
        if (viewMode === 'audit_logs') {
            loadAuditLogs();
        }
    }, [viewMode, logPage, logLimit, logStatus, logSource, logTimeFilter, logSortBy]);

    // Directory handlers
    const handleSearchSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setDirPage(1);
        runSearch(searchQuery, selectedFep, selectedMonth, dirSortBy, 1, dirLimit);
    };

    const handleFepFilterChange = (fep: 'All FEPs' | 'NAIYA TECHNOLOGIES LIMITED' | 'SAMUIKY GLOBAL') => {
        setSelectedFep(fep);
        setDirPage(1);
        runSearch(searchQuery, fep, selectedMonth, dirSortBy, 1, dirLimit);
    };

    const handleMonthChange = (month: string) => {
        setSelectedMonth(month);
        setDirPage(1);
        runSearch(searchQuery, selectedFep, month, dirSortBy, 1, dirLimit);
    };

    const handleDirSortChange = (sortBy: 'volume_desc' | 'volume_asc' | 'name_asc') => {
        setDirSortBy(sortBy);
        setDirPage(1);
        runSearch(searchQuery, selectedFep, selectedMonth, sortBy, 1, dirLimit);
    };

    const changeDirPage = (delta: number) => {
        const next = dirPage + delta;
        if (next >= 1 && next <= dirTotalPages) {
            setDirPage(next);
            runSearch(searchQuery, selectedFep, selectedMonth, dirSortBy, next, dirLimit);
        }
    };

    // Copy statement to clipboard
    const handleCopySummary = () => {
        if (!selectedAgent) return;
        const text = formatPayTicketSummary(selectedAgent, agentReports, agentSummary || undefined);
        navigator.clipboard.writeText(text);
        setCopiedSummary(true);
        showToast('Performance summary copied to clipboard!', 'success');
        setTimeout(() => setCopiedSummary(false), 3000);
    };

    // Return to ticket and optionally insert into draft
    const handleReturnToTicket = () => {
        setActiveFolder('Inbox');
    };

    const handleInsertAndReturn = () => {
        if (!selectedAgent || !activeTicketId) return;
        const text = formatPayTicketSummary(selectedAgent, agentReports, agentSummary || undefined);
        const draftKey = `ticket_draft_${activeTicketId}`;
        const existingDraft = localStorage.getItem(draftKey) || '';
        const updated = existingDraft ? `${existingDraft}\n\n${text}` : text;
        localStorage.setItem(draftKey, updated);
        showToast('Summary appended to ticket reply draft', 'success');
        setActiveFolder('Inbox');
    };

    // Export single agent statement CSV
    const handleExportCsv = () => {
        if (!selectedAgent || agentReports.length === 0) return;
        let csv = 'Month,Period Label,Enrollment Count,Status,FEP Category\n';
        agentReports.forEach(r => {
            csv += `"${r.month}","${r.month_label}","${r.enrollment_count}","${r.status}","${selectedAgent.fep_category}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pay_report_${selectedAgent.identifier}_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Export all filtered agents in directory
    const handleExportFilteredAgents = () => {
        if (searchResults.length === 0) return;
        let csv = 'Identifier,Type,Agent Name,FEP Category,License Type,Status,Volume\n';
        searchResults.forEach(a => {
            csv += `"${a.identifier}","${a.identifier_type}","${a.full_name}","${a.fep_category}","${a.license_type || ''}","${a.verification_status || ''}","${(a as any).total_volume || 0}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `enroller_directory_${selectedFep.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Download audit logs matching active filters
    const handleDownloadAuditLogsCsv = () => {
        const url = getPayAccessLogsExportUrl({
            q: logSearchQuery,
            status: logStatus,
            source: logSource,
            timeFilter: logTimeFilter,
            startDate: logStartDate,
            endDate: logEndDate,
            sortBy: logSortBy
        });
        window.open(url, '_blank');
    };

    const totalVolume = useMemo(() => {
        if (agentSummary?.total_volume !== undefined) return agentSummary.total_volume;
        return agentReports.reduce((acc, r) => acc + (Number(r.enrollment_count) || 0), 0);
    }, [agentSummary, agentReports]);

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface-50 dark:bg-dark-bg font-sans">
            {/* Top Header & Dual Tab Navigation */}
            <header className="bg-surface-0 dark:bg-dark-surface border-b border-surface-200 dark:border-dark-border px-4 py-3 shrink-0 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    {activeTicketId && (
                        <button
                            onClick={handleReturnToTicket}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-200 dark:border-dark-border bg-surface-50 dark:bg-dark-card hover:bg-brand-50 hover:border-brand-300 dark:hover:bg-brand-950/30 dark:hover:border-brand-800 text-surface-700 dark:text-surface-200 hover:text-brand-600 transition-colors text-xs font-semibold shrink-0 shadow-xs"
                            title="Return to the active support ticket"
                        >
                            <Icons.Back size={14} />
                            <span>Back to Ticket {activeTicket?.ticketNumber ? `#${activeTicket.ticketNumber}` : ''}</span>
                        </button>
                    )}

                    <div className="min-w-0">
                        <h1 className="text-base font-bold text-surface-900 dark:text-white leading-tight">
                            Pay & Work Records Hub
                        </h1>
                        <p className="text-xs text-surface-500 dark:text-surface-400 truncate mt-0.5">
                            Verified enrollment volumes & live access audits across NAIYA & SAMUIKY
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* View Switcher Tabs */}
                    <div className="flex bg-surface-100 dark:bg-dark-card p-0.5 rounded-lg border border-surface-200 dark:border-dark-border text-xs font-semibold">
                        <button
                            type="button"
                            onClick={() => setViewMode('directory')}
                            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                                viewMode === 'directory'
                                    ? 'bg-surface-0 dark:bg-dark-surface text-brand-600 dark:text-brand-400 shadow-xs'
                                    : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
                            }`}
                        >
                            <Icons.User size={13} />
                            <span>Enroller Directory</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('audit_logs')}
                            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                                viewMode === 'audit_logs'
                                    ? 'bg-surface-0 dark:bg-dark-surface text-brand-600 dark:text-brand-400 shadow-xs'
                                    : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
                            }`}
                        >
                            <Icons.Dashboard size={13} />
                            <span>Portal Access Audits</span>
                        </button>
                    </div>

                    <button
                        onClick={() => {
                            if (viewMode === 'directory') {
                                runSearch(searchQuery, selectedFep, selectedMonth, dirSortBy, dirPage, dirLimit);
                            } else {
                                loadAuditLogs();
                            }
                        }}
                        disabled={isSearching || isLoadingLogs}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-200 dark:border-dark-border hover:bg-surface-100 dark:hover:bg-dark-hover text-surface-600 dark:text-surface-300 text-xs font-medium transition-colors"
                        title="Reload records"
                    >
                        <Icons.Refresh size={14} className={isSearching || isLoadingLogs ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </div>
            </header>

            {/* TAB 1: ENROLLER DIRECTORY & STATEMENTS */}
            {viewMode === 'directory' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Directory Filter Toolbar */}
                    <div className="bg-surface-0 dark:bg-dark-surface/60 border-b border-surface-200 dark:border-dark-border px-4 py-2.5 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <form onSubmit={handleSearchSubmit} className="flex-1 relative max-w-md">
                            <div className="relative">
                                <Icons.Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by NIN (11 digits), IMEI, or Agent Name..."
                                    className="w-full pl-9 pr-16 py-1.5 bg-surface-50 dark:bg-dark-card border border-surface-200 dark:border-dark-border rounded-lg text-xs md:text-sm text-surface-900 dark:text-surface-100 placeholder-surface-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchQuery('');
                                            setPayTargetQuery('');
                                            setDirPage(1);
                                            runSearch('', selectedFep, selectedMonth, dirSortBy, 1, dirLimit);
                                        }}
                                        className="absolute right-10 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 p-1 rounded-md"
                                        title="Clear search"
                                    >
                                        <Icons.Close size={13} />
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-brand-600 hover:bg-brand-500 active:scale-95 text-white text-xs font-semibold rounded-md shadow-xs transition-all"
                                >
                                    Find
                                </button>
                            </div>
                        </form>

                        {/* Dropdown Filters & Actions */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {/* FEP Pills */}
                            <div className="flex items-center gap-1">
                                {(['All FEPs', 'NAIYA TECHNOLOGIES LIMITED', 'SAMUIKY GLOBAL'] as const).map(fep => {
                                    const active = selectedFep === fep;
                                    return (
                                        <button
                                            key={fep}
                                            type="button"
                                            onClick={() => handleFepFilterChange(fep)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                                                active
                                                    ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                                                    : 'bg-surface-0 dark:bg-dark-card text-surface-600 dark:text-surface-300 border-surface-200 dark:border-dark-border hover:bg-surface-100'
                                            }`}
                                        >
                                            {fep === 'NAIYA TECHNOLOGIES LIMITED' ? 'NAIYA' : fep === 'SAMUIKY GLOBAL' ? 'SAMUIKY' : 'All FEPs'}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Month Filter */}
                            <select
                                value={selectedMonth}
                                onChange={(e) => handleMonthChange(e.target.value)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface-50 dark:bg-dark-card border border-surface-200 dark:border-dark-border text-surface-700 dark:text-surface-200 outline-none cursor-pointer"
                            >
                                {AVAILABLE_MONTHS.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>

                            {/* Sort By */}
                            <select
                                value={dirSortBy}
                                onChange={(e) => handleDirSortChange(e.target.value as any)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface-50 dark:bg-dark-card border border-surface-200 dark:border-dark-border text-surface-700 dark:text-surface-200 outline-none cursor-pointer"
                            >
                                <option value="volume_desc">Sort: Volume (High to Low)</option>
                                <option value="volume_asc">Sort: Volume (Low to High)</option>
                                <option value="name_asc">Sort: Name (A to Z)</option>
                            </select>

                            {/* Export Filtered Agents */}
                            <button
                                type="button"
                                onClick={handleExportFilteredAgents}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border border-surface-200 dark:border-dark-border hover:bg-surface-100 dark:hover:bg-dark-hover text-surface-700 dark:text-surface-200 transition-colors cursor-pointer shadow-xs"
                                title="Download filtered agents as CSV"
                            >
                                <Icons.Download size={13} />
                                <span>Export List</span>
                            </button>
                        </div>
                    </div>

                    {/* Directory Master-Detail Split Workspace */}
                    <div className="flex-1 flex overflow-hidden">
                        {/* Left Column: Search Results List */}
                        <div className="w-full md:w-80 lg:w-96 border-r border-surface-200 dark:border-dark-border flex flex-col bg-surface-0 dark:bg-dark-card shrink-0 overflow-hidden">
                            <div className="px-3.5 py-2 border-b border-surface-200 dark:border-dark-border flex items-center justify-between bg-surface-50 dark:bg-dark-surface/40 text-2xs font-semibold text-surface-500 dark:text-surface-400">
                                <span className="uppercase tracking-wider">Agents & Enrollers</span>
                                <span>{dirTotalFiltered.toLocaleString()} total matches</span>
                            </div>

                            <div className="flex-1 overflow-y-auto divide-y divide-surface-100 dark:divide-dark-border">
                                {isSearching ? (
                                    <div className="p-8 text-center text-surface-400 flex flex-col items-center justify-center gap-2">
                                        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-xs">Searching enroller directory...</span>
                                    </div>
                                ) : searchResults.length === 0 ? (
                                    <div className="p-8 text-center text-surface-400">
                                        <Icons.Search size={24} className="mx-auto mb-2 opacity-50" />
                                        <p className="text-xs font-medium text-surface-600 dark:text-surface-300">No agents found</p>
                                        <p className="text-2xs text-surface-400 mt-1">Try entering a bare IMEI number or 11-digit NIN</p>
                                    </div>
                                ) : (
                                    searchResults.map(agent => {
                                        const isSelected = selectedAgent?.identifier === agent.identifier;
                                        const isNaiya = agent.fep_category === 'NAIYA TECHNOLOGIES LIMITED';
                                        const vol = (agent as any).total_volume;

                                        return (
                                            <button
                                                key={agent.identifier}
                                                type="button"
                                                onClick={() => loadAgentDetails(agent.identifier)}
                                                className={`w-full p-3 text-left transition-colors flex items-start gap-3 group ${
                                                    isSelected 
                                                        ? 'bg-brand-50/80 dark:bg-brand-950/30 border-l-4 border-brand-600' 
                                                        : 'hover:bg-surface-50 dark:hover:bg-dark-hover border-l-4 border-transparent'
                                                }`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                                                    isNaiya 
                                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' 
                                                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                                                }`}>
                                                    {isNaiya ? 'N' : 'S'}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                                        <h3 className="text-xs font-semibold text-surface-900 dark:text-white truncate">
                                                            {agent.full_name || 'Enroller'}
                                                        </h3>
                                                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded shrink-0 ${
                                                            isNaiya 
                                                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
                                                                : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                                                        }`}>
                                                            {isNaiya ? 'NAIYA' : 'SAMUIKY'}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 text-2xs text-surface-500 dark:text-surface-400 font-mono truncate">
                                                        <span className="font-semibold text-surface-600 dark:text-surface-300">{agent.identifier_type}:</span>
                                                        <span className="truncate">{agent.identifier}</span>
                                                    </div>

                                                    <div className="flex items-center justify-between mt-1 text-[11px]">
                                                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-medium">
                                                            <Icons.Check size={10} /> Verified Record
                                                        </span>
                                                        {vol !== undefined && (
                                                            <span className="font-bold text-surface-800 dark:text-surface-200 tabular-nums">
                                                                {Number(vol).toLocaleString()} vol
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>

                            {/* Directory Pagination Bar */}
                            <div className="p-2 border-t border-surface-200 dark:border-dark-border bg-surface-50 dark:bg-dark-surface/40 flex items-center justify-between text-2xs">
                                <span className="font-medium text-surface-500">
                                    Page {dirPage} of {Math.max(1, dirTotalPages)}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => changeDirPage(-1)}
                                        disabled={dirPage <= 1}
                                        className="px-2 py-1 rounded bg-surface-0 dark:bg-dark-card border border-surface-200 dark:border-dark-border font-semibold disabled:opacity-40"
                                    >
                                        Prev
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => changeDirPage(1)}
                                        disabled={dirPage >= dirTotalPages}
                                        className="px-2 py-1 rounded bg-surface-0 dark:bg-dark-card border border-surface-200 dark:border-dark-border font-semibold disabled:opacity-40"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Detailed Statement & Monthly Breakdown */}
                        <div className="flex-1 flex flex-col bg-surface-50 dark:bg-dark-bg overflow-y-auto">
                            {isLoadingDetails ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-12 text-surface-400 gap-3">
                                    <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-sm font-medium">Retrieving verified monthly work breakdown...</p>
                                </div>
                            ) : selectedAgent ? (
                                <div className="p-4 md:p-6 max-w-5xl mx-auto w-full space-y-6">
                                    {/* Profile & Privacy Header Card */}
                                    <div className="bg-surface-0 dark:bg-dark-card rounded-xl border border-surface-200 dark:border-dark-border p-5 shadow-xs">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex items-start gap-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${
                                                    selectedAgent.fep_category === 'NAIYA TECHNOLOGIES LIMITED'
                                                        ? 'bg-emerald-500 text-white shadow-sm'
                                                        : 'bg-blue-600 text-white shadow-sm'
                                                }`}>
                                                    {selectedAgent.fep_category === 'NAIYA TECHNOLOGIES LIMITED' ? 'N' : 'S'}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h2 className="text-lg font-bold text-surface-900 dark:text-white">
                                                            {selectedAgent.full_name}
                                                        </h2>
                                                        <span className="text-xs uppercase font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                                            VERIFIED
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-3 mt-1 text-xs text-surface-500 dark:text-surface-400 flex-wrap">
                                                        <div className="flex items-center gap-1">
                                                            <span className="font-semibold text-surface-700 dark:text-surface-300">{selectedAgent.identifier_type}:</span>
                                                            <code className="font-mono bg-surface-100 dark:bg-dark-surface px-1.5 py-0.5 rounded text-surface-800 dark:text-surface-200 select-all">
                                                                {selectedAgent.identifier}
                                                            </code>
                                                        </div>
                                                        <span>•</span>
                                                        <span className="font-medium text-surface-700 dark:text-surface-200">
                                                            {selectedAgent.fep_category}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <button
                                                    type="button"
                                                    onClick={handleCopySummary}
                                                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-0 dark:bg-dark-surface border border-surface-200 dark:border-dark-border hover:border-brand-500 text-surface-700 dark:text-surface-200 rounded-lg text-xs font-semibold shadow-xs transition-colors"
                                                    title="Copy clean statement to clipboard"
                                                >
                                                    {copiedSummary ? <Icons.Check size={14} className="text-emerald-600" /> : <Icons.Chat size={14} />}
                                                    <span>{copiedSummary ? 'Copied to Clipboard!' : 'Copy Summary'}</span>
                                                </button>

                                                {activeTicketId && (
                                                    <button
                                                        type="button"
                                                        onClick={handleInsertAndReturn}
                                                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-95"
                                                        title="Append summary to active ticket draft and return"
                                                    >
                                                        <Icons.Sent size={14} />
                                                        <span>Insert & Back to Ticket</span>
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={handleExportCsv}
                                                    className="p-2 border border-surface-200 dark:border-dark-border hover:bg-surface-100 dark:hover:bg-dark-hover text-surface-600 dark:text-surface-300 rounded-lg transition-colors"
                                                    title="Export Agent Monthly Statement CSV"
                                                >
                                                    <Icons.Download size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* KPI Volume Cards */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                                        <div className="bg-surface-0 dark:bg-dark-card rounded-xl border border-surface-200 dark:border-dark-border p-4 shadow-xs">
                                            <div className="text-2xs font-semibold uppercase text-surface-400">Total Verified Volume</div>
                                            <div className="text-2xl font-extrabold text-surface-900 dark:text-white mt-1 tabular-nums">
                                                {totalVolume.toLocaleString()}
                                            </div>
                                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                                                Confirmed Enrolments
                                            </div>
                                        </div>

                                        <div className="bg-surface-0 dark:bg-dark-card rounded-xl border border-surface-200 dark:border-dark-border p-4 shadow-xs">
                                            <div className="text-2xs font-semibold uppercase text-surface-400">Reporting Periods</div>
                                            <div className="text-2xl font-extrabold text-surface-900 dark:text-white mt-1 tabular-nums">
                                                {agentReports.length}
                                            </div>
                                            <div className="text-[11px] text-surface-500 mt-1">
                                                Active Months Recorded
                                            </div>
                                        </div>

                                        <div className="bg-surface-0 dark:bg-dark-card rounded-xl border border-surface-200 dark:border-dark-border p-4 shadow-xs">
                                            <div className="text-2xs font-semibold uppercase text-surface-400">Latest Recorded Month</div>
                                            <div className="text-base font-bold text-surface-900 dark:text-white mt-2 truncate">
                                                {agentSummary?.latest_month || (agentReports[0]?.month_label ?? 'None')}
                                            </div>
                                            <div className="text-[11px] text-surface-500 mt-1">
                                                Recent Activity
                                            </div>
                                        </div>

                                        <div className="bg-surface-0 dark:bg-dark-card rounded-xl border border-surface-200 dark:border-dark-border p-4 shadow-xs">
                                            <div className="text-2xs font-semibold uppercase text-surface-400">First Recorded Month</div>
                                            <div className="text-base font-bold text-surface-900 dark:text-white mt-2 truncate">
                                                {agentSummary?.first_month || (agentReports[agentReports.length - 1]?.month_label ?? 'None')}
                                            </div>
                                            <div className="text-[11px] text-surface-500 mt-1">
                                                Tenure Start
                                            </div>
                                        </div>
                                    </div>

                                    {/* Monthly Breakdown Statement Table */}
                                    <div className="bg-surface-0 dark:bg-dark-card rounded-xl border border-surface-200 dark:border-dark-border overflow-hidden shadow-xs">
                                        <div className="px-5 py-3.5 border-b border-surface-200 dark:border-dark-border flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Icons.Document size={16} className="text-brand-600 dark:text-brand-400" />
                                                <h3 className="text-sm font-bold text-surface-900 dark:text-white">
                                                    Verified Monthly Volume Statement
                                                </h3>
                                            </div>
                                            <span className="text-2xs text-surface-400 font-medium">
                                                Newest periods listed first
                                            </span>
                                        </div>

                                        {agentReports.length === 0 ? (
                                            <div className="p-8 text-center text-surface-400">
                                                <Icons.Calendar size={28} className="mx-auto mb-2 opacity-40" />
                                                <p className="text-xs font-semibold">No monthly enrollment records found for this enroller.</p>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-surface-50 dark:bg-dark-surface/60 text-2xs uppercase tracking-wider text-surface-500 dark:text-surface-400 border-b border-surface-200 dark:border-dark-border font-semibold">
                                                            <th className="py-2.5 px-4">Period</th>
                                                            <th className="py-2.5 px-4 text-right">Verified Enrolments</th>
                                                            <th className="py-2.5 px-4 text-center">Share of Total</th>
                                                            <th className="py-2.5 px-4 text-center">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-surface-100 dark:divide-dark-border text-xs">
                                                        {agentReports.map(report => {
                                                            const vol = Number(report.enrollment_count) || 0;
                                                            const share = totalVolume > 0 ? Math.round((vol / totalVolume) * 100) : 0;
                                                            const isNewReport = report.month === 'sep_2026' || report.month === 'aug_2026';

                                                            return (
                                                                <tr key={report.month} className="hover:bg-surface-50/80 dark:hover:bg-dark-hover transition-colors">
                                                                    <td className="py-3 px-4 font-medium text-surface-900 dark:text-surface-100">
                                                                        <div className="flex items-center gap-2">
                                                                            <span>{report.month_label}</span>
                                                                            {isNewReport && (
                                                                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                                                                    New Report
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-3 px-4 text-right font-bold tabular-nums text-surface-900 dark:text-white">
                                                                        {vol.toLocaleString()}
                                                                    </td>
                                                                    <td className="py-3 px-4 text-center">
                                                                        <div className="inline-flex items-center gap-1.5">
                                                                            <div className="w-16 bg-surface-200 dark:bg-dark-surface rounded-full h-1.5 overflow-hidden">
                                                                                <div 
                                                                                    className="bg-brand-600 h-full rounded-full transition-all" 
                                                                                    style={{ width: `${Math.min(100, Math.max(5, share))}%` }} 
                                                                                />
                                                                            </div>
                                                                            <span className="text-2xs text-surface-500 font-mono w-7 text-right">{share}%</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-3 px-4 text-center">
                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                                                            <Icons.Check size={11} /> {report.status || 'VERIFIED'}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr className="bg-surface-50 dark:bg-dark-surface/80 border-t-2 border-surface-200 dark:border-dark-border font-bold text-xs text-surface-900 dark:text-white">
                                                            <td className="py-3 px-4">Total Aggregate Volume</td>
                                                            <td className="py-3 px-4 text-right tabular-nums text-brand-600 dark:text-brand-400 text-sm">
                                                                {totalVolume.toLocaleString()} enrolments
                                                            </td>
                                                            <td className="py-3 px-4 text-center text-2xs text-surface-500 font-normal">
                                                                100%
                                                            </td>
                                                            <td className="py-3 px-4 text-center text-2xs text-emerald-600 font-semibold">
                                                                Audit Complete
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-surface-400 max-w-md mx-auto">
                                    <div className="w-14 h-14 rounded-2xl bg-surface-100 dark:bg-dark-card border border-surface-200 dark:border-dark-border flex items-center justify-center text-brand-600 dark:text-brand-400 mb-4 shadow-xs">
                                        <Icons.Document size={28} />
                                    </div>
                                    <h3 className="text-base font-bold text-surface-900 dark:text-white mb-1">
                                        Select an Enroller or Search
                                    </h3>
                                    <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed mb-6">
                                        Enter a National Identification Number (NIN), device IMEI, or search by name to view official monthly enrollment volumes across FEPs.
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 w-full text-left">
                                        <button
                                            onClick={() => handleFepFilterChange('NAIYA TECHNOLOGIES LIMITED')}
                                            className="p-3 bg-surface-0 dark:bg-dark-card border border-surface-200 dark:border-dark-border rounded-xl hover:border-brand-500 transition-colors"
                                        >
                                            <div className="text-2xs font-bold text-emerald-600 dark:text-emerald-400">NAIYA TECHNOLOGIES</div>
                                            <div className="text-xs font-semibold text-surface-800 dark:text-surface-200 mt-0.5">Browse 1,966 Agents</div>
                                        </button>
                                        <button
                                            onClick={() => handleFepFilterChange('SAMUIKY GLOBAL')}
                                            className="p-3 bg-surface-0 dark:bg-dark-card border border-surface-200 dark:border-dark-border rounded-xl hover:border-brand-500 transition-colors"
                                        >
                                            <div className="text-2xs font-bold text-blue-600 dark:text-blue-400">SAMUIKY GLOBAL</div>
                                            <div className="text-xs font-semibold text-surface-800 dark:text-surface-200 mt-0.5">Browse 1,911 Agents</div>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: PORTAL ACCESS & AUDIT LOGS */}
            {viewMode === 'audit_logs' && (
                <div className="flex-1 flex flex-col overflow-hidden p-4 md:p-6 space-y-4 max-w-7xl mx-auto w-full">
                    {/* Top KPI Summary Metrics */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
                        <div className="p-4 bg-surface-0 dark:bg-dark-card rounded-xl border border-surface-200 dark:border-dark-border shadow-xs">
                            <span className="text-2xs font-bold uppercase tracking-wider text-surface-400">Total Audit Queries</span>
                            <div className="text-2xl font-extrabold text-surface-900 dark:text-white mt-1">
                                {logTotalRecords.toLocaleString()}
                            </div>
                            <p className="text-2xs text-surface-500 mt-0.5">All-time enroller queries</p>
                        </div>

                        <div className="p-4 bg-surface-0 dark:bg-dark-card rounded-xl border border-surface-200 dark:border-dark-border shadow-xs">
                            <span className="text-2xs font-bold uppercase tracking-wider text-surface-400">Filtered Records</span>
                            <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
                                {logTotalFiltered.toLocaleString()}
                            </div>
                            <p className="text-2xs text-surface-500 mt-0.5">Matches active criteria</p>
                        </div>

                        <div className="p-4 bg-surface-0 dark:bg-dark-card rounded-xl border border-surface-200 dark:border-dark-border shadow-xs">
                            <span className="text-2xs font-bold uppercase tracking-wider text-surface-400">Portal Origin Channels</span>
                            <div className="text-sm font-bold text-surface-800 dark:text-surface-200 mt-2 flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-2xs">Ticket Portal</span>
                                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-2xs">Pay Portal</span>
                            </div>
                            <p className="text-2xs text-surface-500 mt-1">Direct API telemetry</p>
                        </div>

                        <div className="p-4 bg-surface-0 dark:bg-dark-card rounded-xl border border-surface-200 dark:border-dark-border shadow-xs">
                            <span className="text-2xs font-bold uppercase tracking-wider text-surface-400">Audit Status</span>
                            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
                                <Icons.Check size={14} /> Live Bridge Active
                            </div>
                            <p className="text-2xs text-surface-500 mt-1">Connected to pay hub</p>
                        </div>
                    </div>

                    {/* Filter & Controls Toolbar */}
                    <div className="p-3.5 bg-surface-0 dark:bg-dark-card rounded-xl border border-surface-200 dark:border-dark-border shadow-xs shrink-0 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 flex-1">
                            <div className="relative min-w-[220px] flex-1 max-w-sm">
                                <Icons.Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                                <input
                                    type="text"
                                    value={logSearchQuery}
                                    onChange={(e) => setLogSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            setLogPage(1);
                                            loadAuditLogs();
                                        }
                                    }}
                                    placeholder="Search by email, IMEI, NIN, agent..."
                                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-50 dark:bg-dark-surface border border-surface-200 dark:border-dark-border rounded-lg text-surface-900 dark:text-surface-100 outline-none focus:ring-1 focus:ring-brand-500"
                                />
                            </div>

                            {/* Status Filter */}
                            <select
                                value={logStatus}
                                onChange={(e) => {
                                    setLogStatus(e.target.value);
                                    setLogPage(1);
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-surface-50 dark:bg-dark-surface border border-surface-200 dark:border-dark-border text-surface-700 dark:text-surface-200 outline-none cursor-pointer"
                            >
                                <option value="ALL">All Status</option>
                                <option value="FOUND">FOUND Only</option>
                                <option value="NOT_FOUND">NOT_FOUND Only</option>
                            </select>

                            {/* Portal Channel Filter */}
                            <select
                                value={logSource}
                                onChange={(e) => {
                                    setLogSource(e.target.value);
                                    setLogPage(1);
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-surface-50 dark:bg-dark-surface border border-surface-200 dark:border-dark-border text-surface-700 dark:text-surface-200 outline-none cursor-pointer"
                            >
                                <option value="ALL">All Portals</option>
                                <option value="ticket_site">Ticket Portal Only</option>
                                <option value="direct">Pay Portal Only</option>
                            </select>

                            {/* Time Filter */}
                            <select
                                value={logTimeFilter}
                                onChange={(e) => {
                                    setLogTimeFilter(e.target.value);
                                    setLogPage(1);
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-surface-50 dark:bg-dark-surface border border-surface-200 dark:border-dark-border text-surface-700 dark:text-surface-200 outline-none cursor-pointer"
                            >
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="yesterday">Yesterday</option>
                                <option value="7d">Last 7 Days</option>
                                <option value="30d">Last 30 Days</option>
                                <option value="month">This Month</option>
                                <option value="custom">Custom Date Range...</option>
                            </select>

                            {/* Sort By Filter */}
                            <select
                                value={logSortBy}
                                onChange={(e) => {
                                    setLogSortBy(e.target.value);
                                    setLogPage(1);
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-surface-50 dark:bg-dark-surface border border-surface-200 dark:border-dark-border text-surface-700 dark:text-surface-200 outline-none cursor-pointer"
                            >
                                <option value="newest">Sort: Newest First</option>
                                <option value="oldest">Sort: Oldest First</option>
                                <option value="vol_desc">Sort: Volume (High to Low)</option>
                                <option value="vol_asc">Sort: Volume (Low to High)</option>
                                <option value="source">Sort: Portal Channel</option>
                                <option value="email">Sort: Email (A-Z)</option>
                            </select>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={handleDownloadAuditLogsCsv}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                                title="Download filtered CSV matching all active filters"
                            >
                                <Icons.Download size={13} />
                                <span>Export Filtered CSV</span>
                            </button>

                            <button
                                type="button"
                                onClick={loadAuditLogs}
                                disabled={isLoadingLogs}
                                className="p-1.5 rounded-lg border border-surface-200 dark:border-dark-border hover:bg-surface-100 dark:hover:bg-dark-hover text-surface-600 dark:text-surface-300 transition-colors"
                                title="Refresh audit logs"
                            >
                                <Icons.Refresh size={14} className={isLoadingLogs ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    {/* Custom Date Pickers Row (if custom is selected) */}
                    {logTimeFilter === 'custom' && (
                        <div className="p-3 bg-surface-0 dark:bg-dark-card rounded-xl border border-surface-200 dark:border-dark-border flex flex-wrap items-center gap-3 text-xs shrink-0">
                            <span className="font-semibold text-surface-600 dark:text-surface-300">Custom Date Range:</span>
                            <div className="flex items-center gap-1.5">
                                <span>From:</span>
                                <input
                                    type="date"
                                    value={logStartDate}
                                    onChange={(e) => setLogStartDate(e.target.value)}
                                    className="px-2 py-1 rounded bg-surface-50 dark:bg-dark-surface border border-surface-200 dark:border-dark-border text-xs outline-none"
                                />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span>To:</span>
                                <input
                                    type="date"
                                    value={logEndDate}
                                    onChange={(e) => setLogEndDate(e.target.value)}
                                    className="px-2 py-1 rounded bg-surface-50 dark:bg-dark-surface border border-surface-200 dark:border-dark-border text-xs outline-none"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setLogPage(1);
                                    loadAuditLogs();
                                }}
                                className="px-3 py-1 rounded-lg bg-brand-600 text-white font-bold text-xs shadow-xs"
                            >
                                Apply Range
                            </button>
                        </div>
                    )}

                    {/* Audit Logs Table */}
                    <div className="flex-1 bg-surface-0 dark:bg-dark-card rounded-xl border border-surface-200 dark:border-dark-border overflow-hidden shadow-xs flex flex-col">
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-surface-50 dark:bg-dark-surface/60 text-2xs uppercase tracking-wider text-surface-500 dark:text-surface-400 border-b border-surface-200 dark:border-dark-border sticky top-0 font-semibold z-10">
                                    <tr>
                                        <th className="py-2.5 px-4">Timestamp (UTC)</th>
                                        <th className="py-2.5 px-4">Enroller Email</th>
                                        <th className="py-2.5 px-4">Searched Identifier</th>
                                        <th className="py-2.5 px-4">Matched Profile / FEP</th>
                                        <th className="py-2.5 px-4 text-right">Volume</th>
                                        <th className="py-2.5 px-4 text-center">Portal Channel</th>
                                        <th className="py-2.5 px-4 text-center">Status</th>
                                        <th className="py-2.5 px-4 font-mono">Client IP</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-100 dark:divide-dark-border">
                                    {isLoadingLogs ? (
                                        <tr>
                                            <td colSpan={8} className="p-12 text-center text-surface-400">
                                                <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                                <span>Loading access logs from Pay System...</span>
                                            </td>
                                        </tr>
                                    ) : logs.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="p-12 text-center text-surface-400 font-medium">
                                                No access audit records match the current filter criteria.
                                            </td>
                                        </tr>
                                    ) : (
                                        logs.map((log) => {
                                            const isFound = log.status === 'FOUND';
                                            const isTicketSite = log.source === 'ticket_site';

                                            return (
                                                <tr key={log.id} className="hover:bg-surface-50 dark:hover:bg-dark-hover transition-colors">
                                                    <td className="py-2.5 px-4 font-mono text-[11px] text-surface-500 whitespace-nowrap">
                                                        {log.created_at || 'N/A'}
                                                    </td>
                                                    <td className="py-2.5 px-4 font-semibold text-surface-900 dark:text-white">
                                                        {log.email}
                                                    </td>
                                                    <td className="py-2.5 px-4 font-mono text-[11px] font-bold text-brand-600 dark:text-brand-400">
                                                        {log.identifier}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-surface-700 dark:text-surface-300">
                                                        <div className="font-medium">{log.matched_agent_name || 'Unmatched'}</div>
                                                        {log.fep_category && (
                                                            <div className="text-[10px] text-surface-400">{log.fep_category}</div>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-right font-bold tabular-nums text-surface-900 dark:text-white">
                                                        {Number(log.total_volume || 0).toLocaleString()}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-center">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                            isTicketSite 
                                                                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800' 
                                                                : 'bg-surface-100 dark:bg-dark-surface text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-dark-border'
                                                        }`}>
                                                            {isTicketSite ? 'Ticket Portal' : 'Pay Portal'}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-4 text-center">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                            isFound
                                                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                                        }`}>
                                                            {log.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-4 font-mono text-[11px] text-surface-400 whitespace-nowrap">
                                                        {log.ip_address || 'N/A'}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Audit Logs Pagination Bar */}
                        <div className="p-3 bg-surface-50 dark:bg-dark-surface/60 border-t border-surface-200 dark:border-dark-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
                            <div className="flex items-center gap-3 text-surface-500">
                                <span>
                                    Showing {logTotalFiltered === 0 ? 0 : (logPage - 1) * logLimit + 1}–{Math.min(logTotalFiltered, logPage * logLimit)} of {logTotalFiltered.toLocaleString()} Records
                                </span>
                                <span>•</span>
                                <div className="flex items-center gap-1.5">
                                    <span>Rows:</span>
                                    <select
                                        value={logLimit}
                                        onChange={(e) => {
                                            setLogLimit(Number(e.target.value));
                                            setLogPage(1);
                                        }}
                                        className="px-2 py-0.5 rounded bg-surface-0 dark:bg-dark-card border border-surface-200 dark:border-dark-border text-xs outline-none"
                                    >
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                        <option value={200}>200</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setLogPage(p => Math.max(1, p - 1))}
                                    disabled={logPage <= 1}
                                    className="px-3 py-1 rounded-lg border border-surface-200 dark:border-dark-border bg-surface-0 dark:bg-dark-card font-semibold disabled:opacity-40"
                                >
                                    Previous
                                </button>
                                <span className="px-2 font-medium text-surface-600 dark:text-surface-300">
                                    Page {logPage} of {Math.max(1, logTotalPages)}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setLogPage(p => Math.min(logTotalPages, p + 1))}
                                    disabled={logPage >= logTotalPages}
                                    className="px-3 py-1 rounded-lg border border-surface-200 dark:border-dark-border bg-surface-0 dark:bg-dark-card font-semibold disabled:opacity-40"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
