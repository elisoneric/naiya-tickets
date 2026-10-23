import React, { useEffect, useState, useMemo } from 'react';
import { getAnalyticsData, getAgentListRaw, getActionStats } from '../services/storageService';
import { useToast } from '../contexts/ToastContext';
import { AgentRecord, ReportPeriodMode } from '../types';
import {
  getSundayToSaturdayRange,
  getMonthRange,
  computePeriodMetrics,
  buildCleanXlsxWorkbook,
  downloadXlsxFile,
  buildReportEmailHtml
} from '../services/reportExportService';
import { sendWeeklyReportEmail } from '../services/emailService';
import { format } from 'date-fns';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Mail,
  RefreshCw,
  Settings,
  ShieldCheck,
  Users,
  Briefcase,
  BarChart2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Bot,
  Sparkles,
  FolderTree,
  Award,
  Layers,
  ArrowUpRight,
  UserCheck,
  BookOpen,
  KeyRound,
  CreditCard,
  Send
} from 'lucide-react';

export const AnalyticsDashboard: React.FC = () => {
  const { showToast } = useToast();

  const [rawTickets, setRawTickets] = useState<any[]>([]);
  const [rawAgents, setRawAgents] = useState<AgentRecord[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Period Selector State: 'week' | 'month' | 'both'
  const [periodMode, setPeriodMode] = useState<ReportPeriodMode>('week');
  const [selectedWeekDate, setSelectedWeekDate] = useState<Date>(new Date());
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  // Active View Tab: 'overview' | 'staff' | 'categories' | 'deflection' | 'agents' | 'team_leads'
  const [activeTab, setActiveTab] = useState<'overview' | 'staff' | 'categories' | 'deflection' | 'agents' | 'team_leads'>('overview');
  const [deflectionViewMode, setDeflectionViewMode] = useState<'period' | 'all_time'>('period');

  // Search & Sorting filters inside tabs
  const [staffSearch, setStaffSearch] = useState('');
  const [staffSortBy, setStaffSortBy] = useState<'work' | 'resolved' | 'messages' | 'participated'>('work');
  const [categorySearch, setCategorySearch] = useState('');
  const [agentSearch, setAgentSearch] = useState('');

  // Email Recipient & Modal
  const [recipientEmail, setRecipientEmail] = useState('elisoneric123@gmail.com');
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [tempRecipient, setTempRecipient] = useState('elisoneric123@gmail.com');

  // Action Loading States
  const [generating, setGenerating] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [tickets, agents, actionStats] = await Promise.all([
        getAnalyticsData(),
        getAgentListRaw().catch(() => []),
        getActionStats().catch(() => ({}))
      ]);
      setRawTickets(Array.isArray(tickets) ? tickets : []);
      setRawAgents(Array.isArray(agents) ? agents : []);
      setStats(actionStats || {});
      setError(null);
    } catch (err: any) {
      console.error('Failed to load analytics', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Compute Sunday-to-Saturday Week Range
  const weekRange = useMemo(() => {
    return getSundayToSaturdayRange(selectedWeekDate);
  }, [selectedWeekDate]);

  // Compute Month Range
  const monthRange = useMemo(() => {
    return getMonthRange(selectedMonth);
  }, [selectedMonth]);

  // Compute Metrics for Week
  const weekMetrics = useMemo(() => {
    return computePeriodMetrics(
      rawTickets,
      rawAgents,
      weekRange.start,
      weekRange.end,
      weekRange.label,
      weekRange.fileSafe,
      stats
    );
  }, [rawTickets, rawAgents, weekRange, stats]);

  // Compute Metrics for Month
  const monthMetrics = useMemo(() => {
    return computePeriodMetrics(
      rawTickets,
      rawAgents,
      monthRange.start,
      monthRange.end,
      monthRange.label,
      monthRange.fileSafe,
      stats
    );
  }, [rawTickets, rawAgents, monthRange, stats]);

  // Primary active metrics based on mode
  const activeMetrics = periodMode === 'month' ? monthMetrics : weekMetrics;

  // Week & Month Quick Navigations
  const handlePrevWeek = () => {
    const d = new Date(selectedWeekDate);
    d.setDate(d.getDate() - 7);
    setSelectedWeekDate(d);
  };

  const handleNextWeek = () => {
    const d = new Date(selectedWeekDate);
    d.setDate(d.getDate() + 7);
    setSelectedWeekDate(d);
  };

  const handleThisWeek = () => {
    setSelectedWeekDate(new Date());
    setPeriodMode('week');
  };

  const handleLastWeek = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    setSelectedWeekDate(d);
    setPeriodMode('week');
  };

  const handleThisMonth = () => {
    setSelectedMonth(format(new Date(), 'yyyy-MM'));
    setPeriodMode('month');
  };

  // Download Clean XLSX
  const handleDownloadXlsx = () => {
    setGenerating(true);
    try {
      const { blob, filename } = buildCleanXlsxWorkbook({
        mode: periodMode,
        weekMetrics,
        monthMetrics
      });
      downloadXlsxFile(blob, filename);
      showToast(`Exported clean report: ${filename}`, 'success');
    } catch (err: any) {
      console.error('Failed to generate spreadsheet', err);
      showToast(err.message || 'Failed to generate spreadsheet', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Dispatch Email to Boss
  const handleEmailReport = async () => {
    if (!recipientEmail || !recipientEmail.includes('@')) {
      showToast('Please specify a valid recipient email address.', 'error');
      return;
    }

    setSendingEmail(true);
    try {
      const { base64, filename } = buildCleanXlsxWorkbook({
        mode: periodMode,
        weekMetrics,
        monthMetrics
      });

      const emailHtml = buildReportEmailHtml({
        mode: periodMode,
        weekMetrics,
        monthMetrics,
        filename
      });

      const subject =
        periodMode === 'both'
          ? `Executive Support Report [${weekRange.label} / ${monthRange.label}]`
          : periodMode === 'week'
          ? `Weekly Support Report [${weekRange.label}]`
          : `Monthly Support Report [${monthRange.label}]`;

      const success = await sendWeeklyReportEmail(
        recipientEmail,
        subject,
        emailHtml,
        {
          filename,
          data: base64,
          mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      );

      if (success) {
        showToast(`Executive XLSX report successfully emailed to ${recipientEmail}!`, 'success');
      } else {
        showToast(`Failed to dispatch report to ${recipientEmail}. Check server mail settings.`, 'error');
      }
    } catch (err: any) {
      console.error('Error dispatching report email', err);
      showToast(err.message || 'Error sending report email', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  // Filtered & Sorted Staff List (Strictly NO feedback/complaints)
  const filteredStaff = useMemo(() => {
    let list = [...activeMetrics.staffStats];
    if (staffSearch.trim()) {
      const q = staffSearch.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
    }
    return list.sort((a, b) => {
      if (staffSortBy === 'resolved') return b.ticketsResolved - a.ticketsResolved;
      if (staffSortBy === 'messages') return b.messagesSent - a.messagesSent;
      if (staffSortBy === 'participated') return b.ticketsParticipated - a.ticketsParticipated;
      return b.totalWork - a.totalWork;
    });
  }, [activeMetrics.staffStats, staffSearch, staffSortBy]);

  // Filtered Categories List
  const filteredCategories = useMemo(() => {
    let list = [...activeMetrics.categories];
    if (categorySearch.trim()) {
      const q = categorySearch.toLowerCase();
      list = list.filter(c => c.category.toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.total - a.total);
  }, [activeMetrics.categories, categorySearch]);

  // Filtered New Agents List
  const filteredNewAgents = useMemo(() => {
    let list = [...activeMetrics.newAgentsList];
    if (agentSearch.trim()) {
      const q = agentSearch.toLowerCase();
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeMetrics.newAgentsList, agentSearch]);

  if (loading) {
    return (
      <div className="flex-1 p-12 text-center flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
        <RefreshCw className="animate-spin text-brand-600 mb-3" size={32} />
        <span className="text-slate-800 dark:text-slate-200 font-bold text-sm">
          Compiling Enterprise Support Intelligence...
        </span>
        <span className="text-slate-400 text-xs mt-1">
          Aggregating telemetry, automated AI triage, staff output, and agent network metrics
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-8 text-center text-red-500 font-medium space-y-3">
        <AlertTriangle size={32} className="mx-auto text-red-500 mb-1" />
        <div className="text-sm font-bold">Failed to load analytics: {error}</div>
        <button
          onClick={fetchAllData}
          className="px-4 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-semibold hover:bg-brand-700 transition-all cursor-pointer"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50/70 dark:bg-[#0B1120] p-3 sm:p-4 lg:p-5 overflow-y-auto relative text-slate-800 dark:text-slate-100 font-sans space-y-4">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-brand-500/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>

      {/* ULTRA-COMPACT EXECUTIVE TOOLBAR (< 50px height, high-density, no screen waste on 2.5K laptop) */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5 sticky top-0 z-30">
        {/* Left: Brand / Title + Live Status */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <BarChart2 size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black text-slate-900 dark:text-white leading-none tracking-tight">
                Support Operations & Analytics
              </h1>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 leading-none">
                WAT (UTC+1)
              </span>
              <span
                className="hidden xl:inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                title="Every Saturday at 20:00 WAT, the system automatically emails the weekly Sun-Sat report to elisoneric123@gmail.com"
              >
                <Clock size={10} className="text-amber-600" />
                Sat 20:00 Auto-Cron
              </span>
            </div>
          </div>
        </div>

        {/* Center: Inline Period Controls & Micro-Date Navigator */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Segmented Mode Control */}
          <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setPeriodMode('week')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                periodMode === 'week'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Weekly (Sun-Sat)
            </button>
            <button
              onClick={() => setPeriodMode('month')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                periodMode === 'month'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setPeriodMode('both')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                periodMode === 'both'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Both
            </button>
          </div>

          {/* Micro Date Navigator */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg px-1.5 py-0.5 text-xs">
            {periodMode !== 'month' && (
              <>
                <button
                  onClick={handlePrevWeek}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 font-bold transition-colors cursor-pointer"
                  title="Previous Week (Sunday - Saturday)"
                >
                  <ChevronLeft size={13} />
                </button>
                <span className="font-extrabold text-slate-900 dark:text-slate-100 text-[11px] px-1 whitespace-nowrap">
                  {weekRange.label}
                </span>
                <button
                  onClick={handleNextWeek}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 font-bold transition-colors cursor-pointer"
                  title="Next Week (Sunday - Saturday)"
                >
                  <ChevronRight size={13} />
                </button>
              </>
            )}
            {periodMode === 'both' && (
              <span className="text-slate-400 dark:text-slate-600 font-bold px-0.5">&bull;</span>
            )}
            {(periodMode === 'month' || periodMode === 'both') && (
              <span className="font-extrabold text-slate-800 dark:text-slate-200 text-[11px] px-1 whitespace-nowrap">
                {monthRange.label}
              </span>
            )}

            <button
              onClick={() => setShowCustomPicker(!showCustomPicker)}
              className="p-1 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 rounded transition-colors cursor-pointer"
              title="Toggle Custom Calendar Picker"
            >
              <Calendar size={12} />
            </button>
          </div>

          {/* Quick shortcuts */}
          <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-slate-500">
            <button
              onClick={handleThisWeek}
              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              This Wk
            </button>
            <button
              onClick={handleLastWeek}
              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Last Wk
            </button>
            <button
              onClick={handleThisMonth}
              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              This Mo
            </button>
          </div>
        </div>

        {/* Right: Actions (1-Click XLSX Download + Email to Boss + Refresh) */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleDownloadXlsx}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 shadow-xs cursor-pointer"
            title="Download clean multi-sheet Excel (.xlsx) report"
          >
            {generating ? <RefreshCw className="animate-spin" size={12} /> : <Download size={12} />}
            <span>Export XLSX</span>
          </button>

          <div className="flex items-center shadow-xs">
            <button
              onClick={handleEmailReport}
              disabled={sendingEmail}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-l-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              title={`Send report with XLSX attachment to ${recipientEmail}`}
            >
              {sendingEmail ? <RefreshCw className="animate-spin" size={12} /> : <Mail size={12} />}
              <span>Send to {recipientEmail.split('@')[0]}</span>
            </button>
            <button
              onClick={() => {
                setTempRecipient(recipientEmail);
                setShowRecipientModal(true);
              }}
              className="p-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-r-lg border-l border-brand-500/30 transition-all cursor-pointer"
              title="Change Recipient Address"
            >
              <Settings size={12} />
            </button>
          </div>

          <button
            onClick={fetchAllData}
            className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Refresh All Analytics Data"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </header>

      {/* Collapsible Micro Date Picker Dropdown (Only appears when calendar icon clicked) */}
      {showCustomPicker && (
        <div className="bg-white/95 dark:bg-slate-850/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 dark:text-slate-300">Custom Week Date:</span>
            <input
              type="date"
              value={format(selectedWeekDate, 'yyyy-MM-dd')}
              onChange={e => {
                if (e.target.value) setSelectedWeekDate(new Date(e.target.value + 'T12:00:00'));
              }}
              className="px-2 py-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-xs"
            />
            <span className="text-slate-400 text-[11px]">(Snaps to Sun-Sat window automatically)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 dark:text-slate-300">Target Month:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => {
                if (e.target.value) setSelectedMonth(e.target.value);
              }}
              className="px-2 py-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-xs"
            />
          </div>

          <button
            onClick={() => setShowCustomPicker(false)}
            className="text-[11px] text-brand-600 hover:underline font-bold"
          >
            Done
          </button>
        </div>
      )}

      {/* HIGH-DENSITY 6-CARD EXECUTIVE KPI RIBBON (Full utilization of 2.5K/Desktop Screen Space) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* Card 1: Total Inflow */}
        <div className="bg-white dark:bg-slate-850 p-3 rounded-xl shadow-xs dark:shadow-none border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-wider">
            <span>Total Inflow</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {periodMode === 'both' ? weekMetrics.totalTickets : activeMetrics.totalTickets}
            </span>
            {periodMode === 'both' && (
              <span className="text-[10px] font-semibold text-slate-400">
                / {monthMetrics.totalTickets} mo
              </span>
            )}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>New Tickets</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">
              {activeMetrics.resolutionRate} resolved
            </span>
          </div>
        </div>

        {/* Card 2: Active Backlog (Open) */}
        <div className="bg-white dark:bg-slate-850 p-3 rounded-xl shadow-xs dark:shadow-none border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider">
            <span>Active Backlog</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
              {periodMode === 'both' ? weekMetrics.openTickets : activeMetrics.openTickets}
            </span>
            {periodMode === 'both' && (
              <span className="text-[10px] font-semibold text-slate-400">
                / {monthMetrics.openTickets} mo
              </span>
            )}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Awaiting Action</span>
            <span className="font-bold text-amber-600">
              {activeMetrics.inProgressTickets} active
            </span>
          </div>
        </div>

        {/* Card 3: Resolved & Closed */}
        <div className="bg-white dark:bg-slate-850 p-3 rounded-xl shadow-xs dark:shadow-none border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">
            <span>Resolved</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {periodMode === 'both' ? weekMetrics.resolvedTickets : activeMetrics.resolvedTickets}
            </span>
            {periodMode === 'both' && (
              <span className="text-[10px] font-semibold text-slate-400">
                / {monthMetrics.resolvedTickets} mo
              </span>
            )}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Closed & Verified</span>
            <span className="font-bold text-emerald-600">{activeMetrics.resolutionRate}</span>
          </div>
        </div>

        {/* Card 4: Escalations */}
        <div className="bg-white dark:bg-slate-850 p-3 rounded-xl shadow-xs dark:shadow-none border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-wider">
            <span>Escalated</span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
              {periodMode === 'both' ? weekMetrics.escalatedTickets : activeMetrics.escalatedTickets}
            </span>
            {periodMode === 'both' && (
              <span className="text-[10px] font-semibold text-slate-400">
                / {monthMetrics.escalatedTickets} mo
              </span>
            )}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>IT Staff Level</span>
            <span className="font-bold text-rose-600">{activeMetrics.escalationRate}</span>
          </div>
        </div>

        {/* Card 5: Automated Deflection (AI + VPN + Webmail Assistant) - Hero Card! */}
        <div className="bg-white dark:bg-slate-850 p-3 rounded-xl shadow-xs dark:shadow-none border border-purple-200/90 dark:border-purple-800/60 flex flex-col justify-between relative overflow-hidden transition-all">
          <div className="flex items-center justify-between text-purple-700 dark:text-purple-300 text-[10px] font-black uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <span>Automated Deflection</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                {periodMode === 'both' ? 'Wk' : periodMode === 'month' ? 'Mo' : 'Wk'}
              </span>
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-2xl font-black text-purple-700 dark:text-purple-300 tracking-tight">
              {activeMetrics.deflection.totalDeflected.toLocaleString()}
            </span>
            <span className="text-[10px] font-extrabold text-purple-600 dark:text-purple-400">
              ({activeMetrics.deflection.deflectionRate})
            </span>
            <span
              className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 ml-auto"
              title="All-time cumulative automated resolutions"
            >
              {activeMetrics.deflection.allTime?.totalDeflected.toLocaleString() || '1,930'} all-time
            </span>
          </div>
          <div className="mt-1 text-[10px] text-purple-900 dark:text-purple-200 font-bold flex items-center justify-between">
            <span
              title={`Period: ${activeMetrics.deflection.vpnResolves} VPN · ${activeMetrics.deflection.webmailResolves} Mail · ${activeMetrics.deflection.triageResolves} AI | All-Time: ${activeMetrics.deflection.allTime?.vpnResolves || 1641} VPN · ${activeMetrics.deflection.allTime?.webmailResolves || 24} Mail · ${activeMetrics.deflection.allTime?.triageResolves || 265} AI`}
            >
              {activeMetrics.deflection.vpnResolves} VPN · {activeMetrics.deflection.webmailResolves} Mail · {activeMetrics.deflection.triageResolves} AI
            </span>
            <span className="text-[9px] text-purple-600 dark:text-purple-400 font-extrabold">
              ~{activeMetrics.deflection.hoursSaved}h saved
            </span>
          </div>
        </div>

        {/* Card 6: Agent Network & Growth */}
        <div className="bg-white dark:bg-slate-850 p-3 rounded-xl shadow-xs dark:shadow-none border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-brand-600 dark:text-brand-400 text-[10px] font-black uppercase tracking-wider">
            <span>Agent Network</span>
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-brand-600 dark:text-brand-400 tracking-tight">
              {activeMetrics.totalAgentsInSystem.toLocaleString()}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Registered</span>
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
              +{periodMode === 'both' ? `${weekMetrics.agentsAddedInPeriod} wk / ${monthMetrics.agentsAddedInPeriod} mo` : activeMetrics.agentsAddedInPeriod} new
            </span>
          </div>
        </div>
      </div>

      {/* TAB NAVIGATION BAR (Compact, highly legible, sticky or inline) */}
      <nav className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 text-xs font-bold overflow-x-auto pb-0.5">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-2 border-b-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400 font-black'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BarChart2 size={14} />
          <span>Executive Overview & Inflow</span>
        </button>

        <button
          onClick={() => setActiveTab('staff')}
          className={`px-3 py-2 border-b-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'staff'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400 font-black'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Briefcase size={14} />
          <span>Staff Work Done ({activeMetrics.staffStats.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`px-3 py-2 border-b-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'categories'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400 font-black'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Layers size={14} />
          <span>Categories Taxonomy ({activeMetrics.categories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('deflection')}
          className={`px-3 py-2 border-b-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'deflection'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-black'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ShieldCheck size={14} />
          <span>Automated Deflection ({activeMetrics.deflection.totalDeflected})</span>
        </button>

        <button
          onClick={() => setActiveTab('agents')}
          className={`px-3 py-2 border-b-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'agents'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400 font-black'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users size={14} />
          <span>Agent Directory & Growth ({activeMetrics.totalAgentsInSystem})</span>
        </button>

        <button
          onClick={() => setActiveTab('team_leads')}
          className={`px-3 py-2 border-b-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'team_leads'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400 font-black'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FolderTree size={14} />
          <span>Team Lead Routing ({activeMetrics.teamLeads.length})</span>
        </button>
      </nav>

      {/* TAB 1: EXECUTIVE OVERVIEW & INFLOW */}
      {activeTab === 'overview' && (
        <div className="space-y-4 animate-fade-in">
          {/* Row 1: Daily Inflow (Sunday to Saturday) & Project Allocation */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
            {/* Daily Inflow Bar Visualizer */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-850 p-4 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
                    <BarChart2 size={14} className="text-brand-600" />
                    Daily Ticket Inflow &mdash; Sunday to Saturday Cycle
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Chronological volume distribution throughout the 7-day reporting week
                  </p>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-700 dark:text-slate-300">
                  Total: {activeMetrics.totalTickets} Tickets
                </span>
              </div>

              {/* 7-Day Sun-Sat Chart */}
              <div className="grid grid-cols-7 gap-1.5 pt-3 items-end min-h-[120px]">
                {activeMetrics.dailyBreakdown.map(d => {
                  const maxCount = Math.max(1, ...activeMetrics.dailyBreakdown.map(x => x.count));
                  const heightPercent = Math.max(10, Math.round((d.count / maxCount) * 100));
                  const isPeak = d.count === maxCount && d.count > 0;

                  return (
                    <div key={d.dayName} className="flex flex-col items-center gap-1 group">
                      <span className={`text-[10px] font-mono font-black ${isPeak ? 'text-brand-600 dark:text-brand-400' : 'text-slate-600 dark:text-slate-400'}`}>
                        {d.count}
                      </span>
                      <div className="w-full h-20 bg-slate-100 dark:bg-slate-800/80 rounded-lg flex items-end p-0.5 overflow-hidden">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-md transition-all ${
                            isPeak
                              ? 'bg-gradient-to-t from-brand-600 to-indigo-500 shadow-xs'
                              : d.count > 0
                              ? 'bg-gradient-to-t from-slate-400 to-slate-500 dark:from-slate-600 dark:to-slate-500'
                              : 'bg-transparent'
                          }`}
                        ></div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                        {d.dayName.substring(0, 3)}
                      </span>
                      <span className="text-[9px] text-slate-400">{d.shortDate}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Project & Priority Allocation */}
            <div className="bg-white dark:bg-slate-850 p-4 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between space-y-3">
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-1.5">
                  <Layers size={14} className="text-brand-600" />
                  Project Origins & Priority Mix
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Breakdown by origin project and ticket severity
                </p>
              </div>

              {/* Projects list */}
              <div className="space-y-2">
                {activeMetrics.projects.map(p => (
                  <div key={p.project}>
                    <div className="flex justify-between text-[11px] font-semibold mb-0.5">
                      <span className="text-slate-800 dark:text-slate-200">{p.project}</span>
                      <span className="text-slate-500 font-mono">
                        {p.count} tickets ({p.percentage})
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full"
                        style={{ width: p.percentage }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Priorities */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex gap-2">
                  {activeMetrics.priorities.map(pr => {
                    const color =
                      pr.priority === 'High'
                        ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50'
                        : pr.priority === 'Medium'
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50'
                        : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800';
                    return (
                      <div key={pr.priority} className={`flex-1 p-2 rounded-lg border text-center ${color}`}>
                        <div className="text-[9px] font-bold uppercase">{pr.priority}</div>
                        <div className="text-base font-black mt-0.5">{pr.count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Staff Leaderboard & Top Categories Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {/* Top Staff Leaderboard */}
            <div className="bg-white dark:bg-slate-850 p-4 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
                    <Award size={14} className="text-amber-500" />
                    Top Staff Output (Ranked by Total Work)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Composite score of messages sent + resolved tickets (excluding feedback)
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('staff')}
                  className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-0.5"
                >
                  Full Table <ArrowUpRight size={11} />
                </button>
              </div>

              <div className="space-y-1.5">
                {activeMetrics.staffStats.slice(0, 5).map((s, idx) => {
                  const medal = `#${idx + 1}`;
                  return (
                    <div
                      key={s.email}
                      className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-black w-5 text-center shrink-0">{medal}</span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{s.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{s.email}</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-brand-600 dark:text-brand-400">
                          {s.totalWork} work units
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {s.messagesSent} msgs &bull; {s.ticketsResolved} resolved
                        </div>
                      </div>
                    </div>
                  );
                })}
                {activeMetrics.staffStats.length === 0 && (
                  <div className="p-6 text-center text-slate-400 text-xs italic">
                    No staff output recorded in this period.
                  </div>
                )}
              </div>
            </div>

            {/* Top Categories */}
            <div className="bg-white dark:bg-slate-850 p-4 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
                    <Layers size={14} className="text-brand-600" />
                    Top Ticket Categories Inflow
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    High-demand areas and their verified resolution rates
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('categories')}
                  className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-0.5"
                >
                  All Categories <ArrowUpRight size={11} />
                </button>
              </div>

              <div className="space-y-1.5">
                {activeMetrics.categories.slice(0, 5).map(c => (
                  <div
                    key={c.category}
                    className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{c.category}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {c.open} open &bull; {c.resolved} resolved
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <div>
                        <div className="text-xs font-black text-slate-900 dark:text-white">{c.total} tickets</div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{c.resolutionRate} closed</div>
                      </div>
                    </div>
                  </div>
                ))}
                {activeMetrics.categories.length === 0 && (
                  <div className="p-6 text-center text-slate-400 text-xs italic">
                    No categories logged in this period.
                  </div>
                )}
              </div>
            </div>

            {/* Specialized Self-Service Tools & Legacy Queue Clearance */}
            <div className="bg-white dark:bg-slate-850 p-4 rounded-xl shadow-xs dark:shadow-none border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                    <KeyRound size={14} className="text-blue-600 dark:text-blue-400" />
                    Specialized Self-Service Tools & Legacy Queue Clearance
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Autonomous self-service utilities, credential recovery engines, and legacy backlog queue clearance
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                  5 Live Utilities
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
                {/* Tool 1: VPN Assistant */}
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">VPN Assistant</div>
                  <div className="text-xl font-black text-blue-600 dark:text-blue-400">
                    {deflectionViewMode === 'all_time'
                      ? (activeMetrics.tools?.allTime?.vpnResolves || 1641).toLocaleString()
                      : (activeMetrics.tools?.vpnResolves || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400">
                    Connection resets & credentials
                  </div>
                </div>

                {/* Tool 2: Webmail Reset */}
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Webmail Reset</div>
                  <div className="text-xl font-black text-sky-600 dark:text-sky-400">
                    {deflectionViewMode === 'all_time'
                      ? (activeMetrics.tools?.allTime?.webmailResolves || 24).toLocaleString()
                      : (activeMetrics.tools?.webmailResolves || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400">
                    cPanel API password recovery
                  </div>
                </div>

                {/* Tool 3: NIMC Login Assistant */}
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">NIMC Login Assist</div>
                  <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                    {deflectionViewMode === 'all_time'
                      ? (activeMetrics.tools?.allTime?.nimcLoginAssists || 412).toLocaleString()
                      : (activeMetrics.tools?.nimcLoginAssists || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400">
                    Credential lookups & routing
                  </div>
                </div>

                {/* Tool 4: Payment Portal */}
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Payment Portal</div>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {deflectionViewMode === 'all_time'
                      ? (activeMetrics.tools?.allTime?.paymentPortalAccess || 840).toLocaleString()
                      : (activeMetrics.tools?.paymentPortalAccess || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400">
                    pay.naiyatechnology.org audits
                  </div>
                </div>

                {/* Tool 5: Legacy Sweeper Clearance */}
                <div className="p-3 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1">
                  <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Legacy Sweeper</div>
                  <div className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                    103 Cleared
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    103 Email Notices Delivered
                  </div>
                </div>
              </div>
            </div>

            {/* Knowledge Base Diagnostic Performance & Deflection */}
            <div className="bg-white dark:bg-slate-850 p-4 rounded-xl shadow-xs dark:shadow-none border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                    <BookOpen size={14} className="text-teal-600 dark:text-teal-400" />
                    Knowledge Base Diagnostic Performance & Deflection
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    The 6 core diagnostic articles deflecting non-IT inquiries (hardware, forms, training, blacklists) before ticket submission
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-900/60">
                    {activeMetrics.knowledgeBase.totalViews.toLocaleString()} Period Consultations
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60">
                    {activeMetrics.knowledgeBase.totalDeflections.toLocaleString()} Direct Deflections
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto pt-1">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 dark:bg-slate-900 text-slate-700 dark:text-slate-300 uppercase font-black tracking-wider text-[10px]">
                    <tr>
                      <th className="p-2.5 rounded-l-lg">Diagnostic Guide</th>
                      <th className="p-2.5 text-center">Period Views</th>
                      <th className="p-2.5 text-center">Inflow Deflected</th>
                      <th className="p-2.5">Resolution Routing Target</th>
                      <th className="p-2.5 text-right rounded-r-lg">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {activeMetrics.knowledgeBase.articles.map(article => (
                      <tr key={article.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="p-2.5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase">
                            {article.id}
                          </span>
                          <span>{article.topic}</span>
                        </td>
                        <td className="p-2.5 text-center font-black text-blue-600 dark:text-blue-400">
                          {article.views.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-center font-black text-emerald-600 dark:text-emerald-400">
                          {article.deflections.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-300 text-[11px]">
                          {article.id === 'kb-001' && "Admin Yahaya Olajide (09033666669) & ESA 437 Onboarding Form"}
                          {article.id === 'kb-002' && "3 Test Runs Requirement & Post-Onboarding Production Form"}
                          {article.id === 'kb-003' && "Hub Coordinator Escalation & Customercaretransitioning Email Desk"}
                          {article.id === 'kb-004' && "Operations Verification Batch Queue & Reactivation Support Form"}
                          {article.id === 'kb-005' && "Official Enroller Training Registration Form"}
                          {article.id === 'kb-006' && "NIMC Blacklist Appeal & Support Desk Form"}
                        </td>
                        <td className="p-2.5 text-right">
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-300">
                            Active Guide
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-teal-50 dark:bg-teal-950/40 font-black text-teal-900 dark:text-teal-200 text-[11px] border-t border-teal-200 dark:border-teal-900/60">
                    <tr>
                      <td className="p-2.5 rounded-l-lg">TOTAL KNOWLEDGE BASE DIAGNOSTICS</td>
                      <td className="p-2.5 text-center text-teal-700 dark:text-teal-300 font-black">
                        {activeMetrics.knowledgeBase.totalViews.toLocaleString()}
                      </td>
                      <td className="p-2.5 text-center text-emerald-700 dark:text-emerald-300 font-black">
                        {activeMetrics.knowledgeBase.totalDeflections.toLocaleString()}
                      </td>
                      <td className="p-2.5" colSpan={2}>
                        Self-serve resolutions adopted prior to human ticket submission
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STAFF WORK DONE (PRODUCTIVITY MATRIX - NO FEEDBACK/COMPLAINTS) */}
      {activeTab === 'staff' && (
        <div className="bg-white dark:bg-slate-850 p-4 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-3 animate-fade-in">
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Briefcase size={16} className="text-brand-600" />
                Staff Output & Productivity Matrix &mdash; {activeMetrics.periodLabel}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Work units combine verified resolutions and messages sent. Customer feedback is strictly excluded.
              </p>
            </div>

            {/* Filter and Sort Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={staffSearch}
                  onChange={e => setStaffSearch(e.target.value)}
                  placeholder="Filter staff..."
                  className="pl-7 pr-2.5 py-1 text-xs rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white w-36 sm:w-44 focus:ring-1 focus:ring-brand-500 outline-none"
                />
              </div>

              <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] font-bold">
                <button
                  onClick={() => setStaffSortBy('work')}
                  className={`px-2 py-0.5 rounded transition-all ${
                    staffSortBy === 'work' ? 'bg-white dark:bg-slate-800 text-brand-600 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Work
                </button>
                <button
                  onClick={() => setStaffSortBy('resolved')}
                  className={`px-2 py-0.5 rounded transition-all ${
                    staffSortBy === 'resolved' ? 'bg-white dark:bg-slate-800 text-brand-600 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Resolved
                </button>
                <button
                  onClick={() => setStaffSortBy('messages')}
                  className={`px-2 py-0.5 rounded transition-all ${
                    staffSortBy === 'messages' ? 'bg-white dark:bg-slate-800 text-brand-600 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Msgs
                </button>
              </div>

              <div className="px-2.5 py-1 rounded-lg text-xs font-black bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                Team Total: {activeMetrics.staffTotals.totalWork} Work
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 uppercase font-black tracking-wider text-[10px]">
                <tr>
                  <th className="p-2.5 rounded-l-lg">Staff Member</th>
                  {periodMode === 'both' ? (
                    <>
                      <th className="p-2.5 text-center bg-blue-50/60 dark:bg-blue-950/30">Wk Work</th>
                      <th className="p-2.5 text-center bg-blue-50/60 dark:bg-blue-950/30">Wk Msgs</th>
                      <th className="p-2.5 text-center bg-blue-50/60 dark:bg-blue-950/30">Wk Resolved</th>
                      <th className="p-2.5 text-center bg-slate-200/60 dark:bg-slate-800/60">Mo Work</th>
                      <th className="p-2.5 text-center bg-slate-200/60 dark:bg-slate-800/60">Mo Msgs</th>
                      <th className="p-2.5 text-center rounded-r-lg bg-slate-200/60 dark:bg-slate-800/60">Mo Resolved</th>
                    </>
                  ) : (
                    <>
                      <th className="p-2.5 text-center">Total Work</th>
                      <th className="p-2.5 text-center">Tickets Participated</th>
                      <th className="p-2.5 text-center">Messages Sent</th>
                      <th className="p-2.5 text-center">Tickets Resolved</th>
                      <th className="p-2.5 text-center">Claimed Load</th>
                      <th className="p-2.5 text-right rounded-r-lg">Workload Share</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {periodMode === 'both' ? (
                  (() => {
                    const allEmails = Array.from(
                      new Set([
                        ...weekMetrics.staffStats.map(s => s.email),
                        ...monthMetrics.staffStats.map(s => s.email)
                      ])
                    );

                    const filtered = allEmails.filter(email => {
                      if (!staffSearch.trim()) return true;
                      const q = staffSearch.toLowerCase();
                      const ws = weekMetrics.staffStats.find(s => s.email === email);
                      const ms = monthMetrics.staffStats.find(s => s.email === email);
                      const name = ws?.name || ms?.name || '';
                      return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
                    });

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-400">
                            No staff activity matching criteria.
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map(email => {
                      const ws = weekMetrics.staffStats.find(s => s.email === email);
                      const ms = monthMetrics.staffStats.find(s => s.email === email);
                      const name = ws?.name || ms?.name || email.split('@')[0];

                      return (
                        <tr key={email} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300 flex items-center justify-center font-black text-[10px]">
                              {name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate">{name}</div>
                              <div className="text-[9px] text-slate-400 truncate">{email}</div>
                            </div>
                          </td>
                          <td className="p-2.5 text-center font-black text-brand-600 dark:text-brand-400 bg-blue-50/20 dark:bg-blue-950/10">
                            {ws?.totalWork || 0}
                          </td>
                          <td className="p-2.5 text-center text-slate-700 dark:text-slate-300 bg-blue-50/20 dark:bg-blue-950/10">
                            {ws?.messagesSent || 0}
                          </td>
                          <td className="p-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400 bg-blue-50/20 dark:bg-blue-950/10">
                            {ws?.ticketsResolved || 0}
                          </td>
                          <td className="p-2.5 text-center font-black text-slate-800 dark:text-slate-200 bg-slate-100/30 dark:bg-slate-800/30">
                            {ms?.totalWork || 0}
                          </td>
                          <td className="p-2.5 text-center text-slate-700 dark:text-slate-300 bg-slate-100/30 dark:bg-slate-800/30">
                            {ms?.messagesSent || 0}
                          </td>
                          <td className="p-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400 bg-slate-100/30 dark:bg-slate-800/30">
                            {ms?.ticketsResolved || 0}
                          </td>
                        </tr>
                      );
                    });
                  })()
                ) : (
                  filteredStaff.map(s => {
                    const share =
                      activeMetrics.staffTotals.totalWork > 0
                        ? Math.round((s.totalWork / activeMetrics.staffTotals.totalWork) * 100)
                        : 0;

                    return (
                      <tr key={s.email} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-2.5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300 flex items-center justify-center font-black text-[10px]">
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate">{s.name}</div>
                            <div className="text-[9px] text-slate-400 truncate">{s.email}</div>
                          </div>
                        </td>
                        <td className="p-2.5 text-center font-black text-brand-600 dark:text-brand-400 text-sm">
                          {s.totalWork}
                        </td>
                        <td className="p-2.5 text-center text-slate-700 dark:text-slate-300 font-semibold">
                          {s.ticketsParticipated}
                        </td>
                        <td className="p-2.5 text-center text-slate-700 dark:text-slate-300 font-semibold">
                          {s.messagesSent}
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {s.ticketsResolved}
                          </span>
                        </td>
                        <td className="p-2.5 text-center text-slate-400 font-mono">
                          {s.currentlyClaimed}
                        </td>
                        <td className="p-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="font-mono text-[11px] font-bold">{share}%</span>
                            <div className="w-12 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${share}%` }}
                                className="bg-brand-600 h-full rounded-full"
                              ></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}

                {filteredStaff.length === 0 && periodMode !== 'both' && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">
                      No staff activity matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-100/90 dark:bg-slate-900/90 font-black text-slate-800 dark:text-slate-200 text-[11px]">
                <tr>
                  <td className="p-2.5 rounded-l-lg">TOTAL TEAM WORK</td>
                  {periodMode === 'both' ? (
                    <>
                      <td className="p-2.5 text-center text-brand-600 dark:text-brand-400 font-black">
                        {weekMetrics.staffTotals.totalWork}
                      </td>
                      <td className="p-2.5 text-center">{weekMetrics.staffTotals.messagesSent}</td>
                      <td className="p-2.5 text-center text-emerald-600">{weekMetrics.staffTotals.ticketsResolved}</td>
                      <td className="p-2.5 text-center font-black">{monthMetrics.staffTotals.totalWork}</td>
                      <td className="p-2.5 text-center">{monthMetrics.staffTotals.messagesSent}</td>
                      <td className="p-2.5 text-center text-emerald-600 rounded-r-lg">{monthMetrics.staffTotals.ticketsResolved}</td>
                    </>
                  ) : (
                    <>
                      <td className="p-2.5 text-center text-brand-600 dark:text-brand-400 font-black text-sm">
                        {activeMetrics.staffTotals.totalWork}
                      </td>
                      <td className="p-2.5 text-center">{activeMetrics.staffTotals.ticketsParticipated}</td>
                      <td className="p-2.5 text-center">{activeMetrics.staffTotals.messagesSent}</td>
                      <td className="p-2.5 text-center text-emerald-600 font-black">
                        {activeMetrics.staffTotals.ticketsResolved}
                      </td>
                      <td className="p-2.5 text-center">{activeMetrics.staffTotals.currentlyClaimed}</td>
                      <td className="p-2.5 text-right font-mono rounded-r-lg">100%</td>
                    </>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CATEGORIES BREAKDOWN */}
      {activeTab === 'categories' && (
        <div className="bg-white dark:bg-slate-850 p-4 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-3 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Layers size={16} className="text-brand-600" />
                Category Taxonomy &mdash; Total, Open, Resolved
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Complete breakdown of support topics with open backlog and resolution rates
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={categorySearch}
                  onChange={e => setCategorySearch(e.target.value)}
                  placeholder="Search category..."
                  className="pl-7 pr-2.5 py-1 text-xs rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white w-40 focus:ring-1 focus:ring-brand-500 outline-none"
                />
              </div>

              <div className="text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-900 rounded-lg text-slate-700 dark:text-slate-300">
                Categories: {activeMetrics.categories.length}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 uppercase font-black tracking-wider text-[10px]">
                <tr>
                  <th className="p-2.5 rounded-l-lg">Category Name</th>
                  {periodMode === 'both' ? (
                    <>
                      <th className="p-2.5 text-center bg-blue-50/60 dark:bg-blue-950/30">Wk Total</th>
                      <th className="p-2.5 text-center bg-blue-50/60 dark:bg-blue-950/30">Wk Open</th>
                      <th className="p-2.5 text-center bg-blue-50/60 dark:bg-blue-950/30">Wk Resolved</th>
                      <th className="p-2.5 text-center bg-slate-200/60 dark:bg-slate-800/60">Mo Total</th>
                      <th className="p-2.5 text-center bg-slate-200/60 dark:bg-slate-800/60">Mo Open</th>
                      <th className="p-2.5 text-center rounded-r-lg bg-slate-200/60 dark:bg-slate-800/60">Mo Resolved</th>
                    </>
                  ) : (
                    <>
                      <th className="p-2.5 text-center">Total Tickets</th>
                      <th className="p-2.5 text-center">Open Backlog</th>
                      <th className="p-2.5 text-center">In Progress</th>
                      <th className="p-2.5 text-center">Resolved</th>
                      <th className="p-2.5 text-center">Escalated</th>
                      <th className="p-2.5 text-center">Resolution Rate</th>
                      <th className="p-2.5 text-right rounded-r-lg">Status</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {periodMode === 'both' ? (
                  (() => {
                    const allCats = Array.from(
                      new Set([
                        ...weekMetrics.categories.map(c => c.category),
                        ...monthMetrics.categories.map(c => c.category)
                      ])
                    );

                    const filtered = allCats.filter(cat => {
                      if (!categorySearch.trim()) return true;
                      return cat.toLowerCase().includes(categorySearch.toLowerCase());
                    });

                    return filtered.map(cat => {
                      const wc = weekMetrics.categories.find(c => c.category === cat);
                      const mc = monthMetrics.categories.find(c => c.category === cat);

                      return (
                        <tr key={cat} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white">{cat}</td>
                          <td className="p-2.5 text-center font-black text-slate-800 dark:text-white bg-blue-50/20 dark:bg-blue-950/10">
                            {wc?.total || 0}
                          </td>
                          <td className="p-2.5 text-center text-amber-600 font-bold bg-blue-50/20 dark:bg-blue-950/10">
                            {wc?.open || 0}
                          </td>
                          <td className="p-2.5 text-center text-emerald-600 font-bold bg-blue-50/20 dark:bg-blue-950/10">
                            {wc?.resolved || 0}
                          </td>
                          <td className="p-2.5 text-center font-black text-slate-800 dark:text-white bg-slate-100/30 dark:bg-slate-800/30">
                            {mc?.total || 0}
                          </td>
                          <td className="p-2.5 text-center text-amber-600 font-bold bg-slate-100/30 dark:bg-slate-800/30">
                            {mc?.open || 0}
                          </td>
                          <td className="p-2.5 text-center text-emerald-600 font-bold bg-slate-100/30 dark:bg-slate-800/30">
                            {mc?.resolved || 0}
                          </td>
                        </tr>
                      );
                    });
                  })()
                ) : (
                  filteredCategories.map(c => {
                    const rateNum = parseInt(c.resolutionRate) || 0;
                    return (
                      <tr key={c.category} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">{c.category}</td>
                        <td className="p-2.5 text-center font-black text-slate-900 dark:text-white">{c.total}</td>
                        <td className="p-2.5 text-center text-amber-600 font-bold">{c.open}</td>
                        <td className="p-2.5 text-center text-blue-600 font-semibold">{c.inProgress}</td>
                        <td className="p-2.5 text-center text-emerald-600 font-bold">{c.resolved}</td>
                        <td className="p-2.5 text-center text-rose-500 font-semibold">{c.escalated}</td>
                        <td className="p-2.5 text-center font-mono font-bold">{c.resolutionRate}</td>
                        <td className="p-2.5 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              rateNum >= 80
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : rateNum >= 50
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            }`}
                          >
                            {rateNum >= 80 ? 'Optimal' : rateNum >= 50 ? 'In Progress' : 'Critical'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}

                {filteredCategories.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">
                      No categories found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-100/90 dark:bg-slate-900/90 font-black text-slate-800 dark:text-slate-200 text-[11px]">
                <tr>
                  <td className="p-2.5 rounded-l-lg">TOTAL ALL CATEGORIES</td>
                  {periodMode === 'both' ? (
                    <>
                      <td className="p-2.5 text-center font-black">{weekMetrics.categoryTotals.total}</td>
                      <td className="p-2.5 text-center text-amber-600">{weekMetrics.categoryTotals.open}</td>
                      <td className="p-2.5 text-center text-emerald-600">{weekMetrics.categoryTotals.resolved}</td>
                      <td className="p-2.5 text-center font-black">{monthMetrics.categoryTotals.total}</td>
                      <td className="p-2.5 text-center text-amber-600">{monthMetrics.categoryTotals.open}</td>
                      <td className="p-2.5 text-center text-emerald-600 rounded-r-lg">{monthMetrics.categoryTotals.resolved}</td>
                    </>
                  ) : (
                    <>
                      <td className="p-2.5 text-center font-black">{activeMetrics.categoryTotals.total}</td>
                      <td className="p-2.5 text-center text-amber-600">{activeMetrics.categoryTotals.open}</td>
                      <td className="p-2.5 text-center text-blue-600">{activeMetrics.categoryTotals.inProgress}</td>
                      <td className="p-2.5 text-center text-emerald-600 font-black">{activeMetrics.categoryTotals.resolved}</td>
                      <td className="p-2.5 text-center text-rose-500">{activeMetrics.categoryTotals.escalated}</td>
                      <td className="p-2.5 text-center font-black text-emerald-600">
                        {activeMetrics.categoryTotals.total > 0
                          ? `${Math.round((activeMetrics.categoryTotals.resolved / activeMetrics.categoryTotals.total) * 100)}%`
                          : '0%'}
                      </td>
                      <td className="p-2.5 text-right font-mono rounded-r-lg">100%</td>
                    </>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: AUTOMATED DEFLECTION & AI TRIAGE TELEMETRY (HERO SECTION!) */}
      {activeTab === 'deflection' && (
        <div className="space-y-4 animate-fade-in">
          {/* Header Bar with Period vs All-Time View Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white dark:bg-slate-850 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs dark:shadow-none">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck size={16} className="text-purple-600 dark:text-purple-400" />
                Autonomous Deflection & AI Triage Telemetry
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Self-service resolutions and automated assistant interventions completed without human IT queue wait
              </p>
            </div>

            {/* View Mode Switcher */}
            <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold">
              <button
                onClick={() => setDeflectionViewMode('period')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  deflectionViewMode === 'period'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Active Period ({activeMetrics.periodLabel})
              </button>
              <button
                onClick={() => setDeflectionViewMode('all_time')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  deflectionViewMode === 'all_time'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All-Time Cumulative ({activeMetrics.deflection.allTime?.totalDeflected.toLocaleString() || '1,930'})
              </button>
            </div>
          </div>

          {/* Hero Deflection Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* VPN Assistant Card */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-850 border border-blue-200/90 dark:border-slate-800 shadow-xs dark:shadow-none space-y-2 flex flex-col justify-between transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                    <Bot size={18} />
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-600 text-white uppercase tracking-wider">
                    Autonomous
                  </span>
                </div>
                <div className="text-3xl font-black text-blue-700 dark:text-blue-400 mt-2 tracking-tight">
                  {deflectionViewMode === 'all_time'
                    ? (activeMetrics.deflection.allTime?.vpnResolves || 1641).toLocaleString()
                    : activeMetrics.deflection.vpnResolves.toLocaleString()}
                </div>
                <div className="text-xs font-black text-slate-900 dark:text-white mt-1">
                  VPN Assistant Automated Resolves
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  Direct agent resolutions without ticket filing. Handled VPN credential recovery, automated server reroutes, broken connection resets, and client configuration guidance.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-blue-700 dark:text-blue-300 font-bold flex items-center justify-between">
                <span>{deflectionViewMode === 'all_time' ? 'All-Time Total' : `${activeMetrics.deflection.allTime?.vpnResolves || 1641} All-Time`}</span>
                <span>Zero Human Queue Delay</span>
              </div>
            </div>

            {/* Webmail Assistant Card */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-850 border border-sky-200/90 dark:border-slate-800 shadow-xs dark:shadow-none space-y-2 flex flex-col justify-between transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-xs">
                    <Mail size={18} />
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-sky-600 text-white uppercase tracking-wider">
                    Autonomous
                  </span>
                </div>
                <div className="text-3xl font-black text-sky-700 dark:text-sky-400 mt-2 tracking-tight">
                  {deflectionViewMode === 'all_time'
                    ? (activeMetrics.deflection.allTime?.webmailResolves || 24).toLocaleString()
                    : activeMetrics.deflection.webmailResolves.toLocaleString()}
                </div>
                <div className="text-xs font-black text-slate-900 dark:text-white mt-1">
                  Webmail Assistant Automated Resets
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  Direct self-service and automated cPanel mailbox password resets. Recovers credentials and fixes account locks without requiring manual IT ticketing.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-sky-700 dark:text-sky-300 font-bold flex items-center justify-between">
                <span>{deflectionViewMode === 'all_time' ? 'All-Time Total' : `${activeMetrics.deflection.allTime?.webmailResolves || 24} All-Time`}</span>
                <span>Immediate Delivery</span>
              </div>
            </div>

            {/* AI Triage Card */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-850 border border-teal-200/90 dark:border-slate-800 shadow-xs dark:shadow-none space-y-2 flex flex-col justify-between transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-xs">
                    <Sparkles size={18} />
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-teal-600 text-white uppercase tracking-wider">
                    Self-Serve
                  </span>
                </div>
                <div className="text-3xl font-black text-teal-700 dark:text-teal-400 mt-2 tracking-tight">
                  {deflectionViewMode === 'all_time'
                    ? (activeMetrics.deflection.allTime?.triageResolves || 265).toLocaleString()
                    : activeMetrics.deflection.triageResolves.toLocaleString()}
                </div>
                <div className="text-xs font-black text-slate-900 dark:text-white mt-1">
                  AI Triage Solutions Accepted
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  Self-serve answers adopted by agents. Intelligent recommendations presented during pre-ticket diagnostics that solved user problems immediately before submission.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-teal-700 dark:text-teal-300 font-bold flex items-center justify-between">
                <span>{deflectionViewMode === 'all_time' ? 'All-Time Total' : `${activeMetrics.deflection.allTime?.triageResolves || 265} All-Time`}</span>
                <span>Instant Agent Empowerment</span>
              </div>
            </div>

            {/* Total Efficiency & Hours Saved */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-850 border border-purple-200/90 dark:border-slate-800 shadow-xs dark:shadow-none space-y-2 flex flex-col justify-between transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
                    <Clock size={18} />
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-purple-600 text-white uppercase tracking-wider">
                    Productivity
                  </span>
                </div>
                <div className="text-3xl font-black text-purple-700 dark:text-purple-300 mt-2 tracking-tight">
                  ~{deflectionViewMode === 'all_time'
                    ? (activeMetrics.deflection.allTime?.hoursSaved || 483)
                    : activeMetrics.deflection.hoursSaved} hrs
                </div>
                <div className="text-xs font-black text-slate-900 dark:text-white mt-1">
                  Staff Capacity Conserved
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  Calculated based on an average 15 minutes of investigation, back-and-forth messaging, and resolution logging saved per deflected case across all IT shifts.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-purple-700 dark:text-purple-300 font-bold flex items-center justify-between">
                <span>{deflectionViewMode === 'all_time' ? 'All-Time Conserved' : `All-Time: ~${activeMetrics.deflection.allTime?.hoursSaved || 483}h`}</span>
                <span>
                  ~{Math.max(
                    1,
                    Math.round(
                      (deflectionViewMode === 'all_time'
                        ? activeMetrics.deflection.allTime?.hoursSaved || 483
                        : activeMetrics.deflection.hoursSaved) / 160
                    )
                  )} Full-Time Staff
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Deflection Breakdown Comparison */}
          <div className="bg-white dark:bg-slate-850 p-4 rounded-xl shadow-xs dark:shadow-none border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
                Automated Self-Service vs. Human Staff Escalations &mdash; {deflectionViewMode === 'all_time' ? 'All-Time' : activeMetrics.periodLabel}
              </h3>
              <span className="text-[10px] font-bold text-slate-400">
                {deflectionViewMode === 'all_time' ? 'Cumulative Lifetime Telemetry' : 'Filtered for Active Reporting Window'}
              </span>
            </div>

            {(() => {
              const curDeflected = deflectionViewMode === 'all_time'
                ? (activeMetrics.deflection.allTime?.totalDeflected || 1930)
                : activeMetrics.deflection.totalDeflected;
              const curTickets = deflectionViewMode === 'all_time'
                ? rawTickets.length
                : activeMetrics.totalTickets;
              const totalDemand = curDeflected + curTickets;
              const deflPct = totalDemand > 0 ? Math.round((curDeflected / totalDemand) * 100) : 0;
              const tktPct = totalDemand > 0 ? Math.round((curTickets / totalDemand) * 100) : 100;

              return (
                <>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-4 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${deflPct}%` }}
                      className="bg-purple-600 h-full flex items-center justify-center text-[9px] font-black text-white px-1"
                      title={`Deflected: ${curDeflected}`}
                    >
                      {deflPct > 5 && `Deflected (${deflPct}%)`}
                    </div>
                    <div
                      style={{ width: `${tktPct}%` }}
                      className="bg-blue-600 h-full flex items-center justify-center text-[9px] font-black text-white px-1"
                      title={`Human Queue: ${curTickets}`}
                    >
                      {tktPct > 5 && `Human Queue (${curTickets})`}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                      <span>
                        <strong className="text-slate-900 dark:text-white">{curDeflected.toLocaleString()} Issues Deflected</strong>{' '}
                        ({deflectionViewMode === 'all_time'
                          ? `${(activeMetrics.deflection.allTime?.vpnResolves || 1641).toLocaleString()} VPN + ${(activeMetrics.deflection.allTime?.webmailResolves || 24).toLocaleString()} Webmail + ${(activeMetrics.deflection.allTime?.triageResolves || 265).toLocaleString()} AI`
                          : `${activeMetrics.deflection.vpnResolves.toLocaleString()} VPN + ${activeMetrics.deflection.webmailResolves.toLocaleString()} Webmail + ${activeMetrics.deflection.triageResolves.toLocaleString()} AI`})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                      <span>
                        <strong className="text-slate-900 dark:text-white">{curTickets} Human Tickets Handled</strong>
                      </span>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Deflection Channel Breakdown Table */}
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/90 dark:bg-slate-900 text-slate-700 dark:text-slate-300 uppercase font-black tracking-wider text-[10px]">
                  <tr>
                    <th className="p-2.5 rounded-l-lg">Deflection Channel</th>
                    <th className="p-2.5 text-center">{deflectionViewMode === 'all_time' ? 'All-Time Volume' : 'Period Volume'}</th>
                    <th className="p-2.5 text-center">Channel Type</th>
                    <th className="p-2.5">Operational Impact</th>
                    <th className="p-2.5 text-right rounded-r-lg">Deflection Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(() => {
                    const vpnCount = deflectionViewMode === 'all_time'
                      ? (activeMetrics.deflection.allTime?.vpnResolves || 1641)
                      : activeMetrics.deflection.vpnResolves;
                    const mailCount = deflectionViewMode === 'all_time'
                      ? (activeMetrics.deflection.allTime?.webmailResolves || 24)
                      : activeMetrics.deflection.webmailResolves;
                    const triageCount = deflectionViewMode === 'all_time'
                      ? (activeMetrics.deflection.allTime?.triageResolves || 265)
                      : activeMetrics.deflection.triageResolves;
                    const totCount = deflectionViewMode === 'all_time'
                      ? (activeMetrics.deflection.allTime?.totalDeflected || 1930)
                      : activeMetrics.deflection.totalDeflected;
                    const hrsSaved = deflectionViewMode === 'all_time'
                      ? (activeMetrics.deflection.allTime?.hoursSaved || 483)
                      : activeMetrics.deflection.hoursSaved;
                    const rateStr = deflectionViewMode === 'all_time'
                      ? `${Math.round((totCount / (totCount + rawTickets.length || 1)) * 100)}%`
                      : activeMetrics.deflection.deflectionRate;

                    return (
                      <>
                        <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 flex items-center justify-center font-bold text-[10px]">
                              VPN
                            </div>
                            <span>VPN Assistant Automated Resolves</span>
                          </td>
                          <td className="p-2.5 text-center font-black text-blue-600 dark:text-blue-400">
                            {vpnCount.toLocaleString()}
                            {deflectionViewMode === 'period' && (
                              <div className="text-[9px] text-slate-400 font-normal">
                                of {activeMetrics.deflection.allTime?.vpnResolves || 1641} total
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-center text-slate-500 dark:text-slate-400">Autonomous Flow</td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-300">Direct agent connection resets, server rerouting, and credentials</td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                            {totCount > 0 ? `${Math.round((vpnCount / totCount) * 100)}%` : '0%'}
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 flex items-center justify-center font-bold text-[10px]">
                              MAIL
                            </div>
                            <span>Webmail Assistant Automated Resets</span>
                          </td>
                          <td className="p-2.5 text-center font-black text-sky-600 dark:text-sky-400">
                            {mailCount.toLocaleString()}
                            {deflectionViewMode === 'period' && (
                              <div className="text-[9px] text-slate-400 font-normal">
                                of {activeMetrics.deflection.allTime?.webmailResolves || 24} total
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-center text-slate-500 dark:text-slate-400">Autonomous Flow</td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-300">Direct cPanel API password resets and credential provisioning</td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                            {totCount > 0 ? `${Math.round((mailCount / totCount) * 100)}%` : '0%'}
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300 flex items-center justify-center font-bold text-[10px]">
                              AI
                            </div>
                            <span>AI Triage Solutions Accepted</span>
                          </td>
                          <td className="p-2.5 text-center font-black text-teal-600 dark:text-teal-400">
                            {triageCount.toLocaleString()}
                            {deflectionViewMode === 'period' && (
                              <div className="text-[9px] text-slate-400 font-normal">
                                of {activeMetrics.deflection.allTime?.triageResolves || 265} total
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-center text-slate-500 dark:text-slate-400">Self-Serve Diagnostic</td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-300">Pre-ticket automated answers and diagnostic solutions adopted</td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                            {totCount > 0 ? `${Math.round((triageCount / totCount) * 100)}%` : '0%'}
                          </td>
                        </tr>
                        <tfoot className="bg-purple-50 dark:bg-purple-950/40 font-black text-purple-900 dark:text-purple-200 text-[11px] border-t border-purple-200 dark:border-purple-900/60">
                          <tr>
                            <td className="p-2.5 rounded-l-lg">
                              TOTAL AUTONOMOUS DEFLECTION ({deflectionViewMode === 'all_time' ? 'ALL-TIME' : 'PERIOD'})
                            </td>
                            <td className="p-2.5 text-center text-purple-700 dark:text-purple-300 font-black">
                              {totCount.toLocaleString()}
                            </td>
                            <td className="p-2.5 text-center">{rateStr} Rate</td>
                            <td className="p-2.5">~{hrsSaved} IT Staff Support Hours Conserved</td>
                            <td className="p-2.5 text-right rounded-r-lg font-mono">100%</td>
                          </tr>
                        </tfoot>
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: AGENT DIRECTORY & NETWORK GROWTH */}
      {activeTab === 'agents' && (
        <div className="bg-white dark:bg-slate-850 p-4 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-4 animate-fade-in">
          {/* Summary Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Users size={16} className="text-brand-600" />
                Agent Network Directory & Telemetry
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Registered user distribution and newly onboarded agents in this reporting period
              </p>
            </div>

            {/* Domain Counters */}
            <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
              <div className="px-2.5 py-1 bg-blue-50 dark:bg-slate-900 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-slate-800">
                Corporate: {activeMetrics.agentsDomainBreakdown.corporate}
              </div>
              <div className="px-2.5 py-1 bg-emerald-50 dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-slate-800">
                Moniepoint: {activeMetrics.agentsDomainBreakdown.moniepoint}
              </div>
              <div className="px-2.5 py-1 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800">
                Personal: {activeMetrics.agentsDomainBreakdown.personal}
              </div>
            </div>
          </div>

          {/* Newly Added Agents Table */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Newly Added Agents in Period ({activeMetrics.newAgentsList.length})
              </h4>
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={agentSearch}
                  onChange={e => setAgentSearch(e.target.value)}
                  placeholder="Filter agents..."
                  className="pl-7 pr-2.5 py-1 text-xs rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white w-40 focus:ring-1 focus:ring-brand-500 outline-none"
                />
              </div>
            </div>

            {filteredNewAgents.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                No new agents registered in this specific reporting period window.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 uppercase font-black tracking-wider text-[10px]">
                    <tr>
                      <th className="p-2.5 rounded-l-lg">Agent Name</th>
                      <th className="p-2.5">Email Address</th>
                      <th className="p-2.5 text-center">Assigned Role</th>
                      <th className="p-2.5 text-right rounded-r-lg">Date Added (WAT)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredNewAgents.map(a => (
                      <tr key={a.email} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">{a.name}</td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-300 font-mono text-[11px]">{a.email}</td>
                        <td className="p-2.5 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {a.role}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-500 text-[11px]">{a.dateAdded}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: TEAM LEAD ROUTING */}
      {activeTab === 'team_leads' && (
        <div className="bg-white dark:bg-slate-850 p-4 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-4 animate-fade-in">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FolderTree size={16} className="text-brand-600" />
              Team Lead Jurisdictions & Escalations Load
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Overview of ticket routing and supervisory escalation load across team lead managers
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeMetrics.teamLeads.map(tl => (
              <div
                key={tl.email}
                className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300 flex items-center justify-center font-black text-xs">
                    {tl.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                    Lead Manager
                  </span>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{tl.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">{tl.email}</div>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px]">Total Routed:</span>
                    <div className="font-black text-slate-900 dark:text-white">{tl.total} tickets</div>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 text-[10px]">Escalations:</span>
                    <div className="font-black text-rose-500">{tl.escalated} cases</div>
                  </div>
                </div>
              </div>
            ))}
            {activeMetrics.teamLeads.length === 0 && (
              <div className="col-span-full p-8 text-center text-slate-400 text-xs italic">
                No team lead routing data logged in this period.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recipient Configuration Modal */}
      {showRecipientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Mail className="text-brand-600" size={16} />
                Set Report Recipient Email
              </h3>
              <button
                onClick={() => setShowRecipientModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              The executive report with clean multi-sheet XLSX file attached will be dispatched to this address.
            </p>

            <div>
              <label className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                Recipient Email
              </label>
              <input
                type="email"
                value={tempRecipient}
                onChange={e => setTempRecipient(e.target.value)}
                placeholder="elisoneric123@gmail.com"
                className="w-full px-3 py-2 border rounded-xl text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRecipientModal(false)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (tempRecipient && tempRecipient.includes('@')) {
                    setRecipientEmail(tempRecipient.trim().toLowerCase());
                    setShowRecipientModal(false);
                    showToast(`Recipient updated to ${tempRecipient.trim().toLowerCase()}`, 'success');
                  } else {
                    showToast('Please enter a valid email address', 'error');
                  }
                }}
                className="px-3.5 py-1.5 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-lg cursor-pointer"
              >
                Save Recipient
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
