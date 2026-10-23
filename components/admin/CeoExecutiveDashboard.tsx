import React, { useState } from 'react';
import {
  Printer,
  Copy,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  Cpu,
  Users,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  Layers,
  Clock,
  ExternalLink,
  ChevronRight,
  Check,
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';

export const CeoExecutiveDashboard: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopySummary = () => {
    const summaryText = `NA'IYA TECHNOLOGY LIMITED - EXECUTIVE PERFORMANCE BRIEFING
Period: Sun, Oct 4 – Sat, Oct 10, 2026 | System Health: OPTIMAL & HEALTHY

KEY PERFORMANCE INDICATORS:
• Inflow & Resolution: 72 Tickets Received | 31 Resolved (43% Resolution Rate, 41 in progress)
• Autonomous Tools Deflection: 227 Inquiries Deflected | ~57 Support Hours Saved (+2.5 FTE Equivalent)
• Field Agent Registry: 6,740 Active Field Agents in Registry (+3 New Enrolled)
• SLA Performance: 0 Critical Escalations (100% SLA Compliance)

AUTONOMOUS ROI & TOOLS BREAKDOWN:
• VPN Assistant: 148 deflections (94.2% success) | ~37.0 hrs saved [TOP DEFLECTOR]
• Agent Payment Portal (pay.naiyatechnology.org): 38 deflections (100.0% success) | ~9.5 hrs saved [PERFECT BENCHMARK]
• NIMC Login Assistant: 22 deflections (89.4% success) | ~5.5 hrs saved
• Webmail Reset Assistant: 11 deflections (98.1% success) | ~2.8 hrs saved
• AI Diagnostic & Smart Triage: 8 deflections (88.0% success) | ~2.0 hrs saved

WORKLOAD DISTRIBUTION:
• VPN Related: 31.9% (23 tickets)
• NIMC Login Details: 26.4% (19 tickets)
• Webmail Access: 20.8% (15 tickets)
• Others: 16.7% (12 tickets)
• Device & Activation: 4.2% (3 tickets)

SUPPORT ROSTER THROUGHPUT:
• Abubakar Ibrahim Olose: 58 Work Score (14 Resolved, 44 Messages, 12 Active Queue)
• Yahaya Olajide Hammed: 41 Work Score (9 Resolved, 32 Messages, 15 Active Queue)
• IT Administrator: 24 Work Score (5 Resolved, 19 Messages, 8 Active Queue)
• Support Desk: 16 Work Score (3 Resolved, 13 Messages, 6 Active Queue)
• Total Team Work Done: 139 Score | 31 Resolved | 108 Messages

CEO STRATEGIC VERDICTS:
1. Team Productivity: [ON TRACK] - 139 verified staff actions, 43% turnaround, backlog contained.
2. Autonomous ROI: [EXCEEDED] - 227 inquiries deflected (+2.5 FTE equivalent), ~57 hours saved.
3. Payment Self-Service: [OPTIMAL] - pay.naiyatechnology.org 100% success, zero manual statement tickets.
4. Network Coverage: [EXPANDING] - 6,740 active agents, 100% SLA compliance, 0 critical escalations.`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(summaryText);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] text-[#0F172A] dark:text-[#F8FAFC] p-4 sm:p-6 lg:p-8 font-sans antialiased transition-colors">
      
      {/* Executive Container */}
      <div className="max-w-7xl mx-auto flex flex-col gap-4">

        {/* C-Suite Screen Action Bar (Hidden in Print) */}
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold uppercase tracking-wider text-[10px]">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Executive Briefing
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              C-Suite Weekly Operations Dashboard
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="tabular-nums">West Africa Time (WAT)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition"
              title="Copy bulleted executive summary"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Summary</span>
                </>
              )}
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-[#0F172A] dark:bg-indigo-600 text-white hover:bg-slate-800 dark:hover:bg-indigo-500 shadow-sm transition"
              title="Print to PDF or physical printer formatted for A4"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Export PDF</span>
            </button>
          </div>
        </div>

        {/* 1. Header Bar */}
        <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm relative overflow-hidden print:p-3 print:border-slate-300 print:shadow-none">
          {/* Subtle Accent Stripe */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0F172A] via-[#4F46E5] to-[#10B981]" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Left: Branding */}
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#0F172A] dark:bg-slate-800 text-white dark:text-sky-400 font-extrabold text-lg flex items-center justify-center shadow-md border border-white/10 dark:border-slate-700 flex-shrink-0">
                NT
              </div>
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-[#0F172A] dark:text-white uppercase">
                    NA&apos;IYA TECHNOLOGY LIMITED
                  </h1>
                  <span className="text-slate-300 dark:text-slate-700 font-light hidden sm:inline">/</span>
                  <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Executive Performance &amp; Operations Report
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase">
                    CONFIDENTIAL CEO BRIEFING
                  </span>
                  <span>•</span>
                  <span>Operations, IT Service Desk &amp; Autonomous Telemetry</span>
                  <span>•</span>
                  <span className="tabular-nums">Report ID: NTL-OPS-2026-W41</span>
                </div>
              </div>
            </div>

            {/* Right: Metadata Badges */}
            <div className="flex flex-col md:items-end gap-1.5 text-left md:text-right">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>Period: Sun, Oct 4 – Sat, Oct 10, 2026</span>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>System Health: OPTIMAL &amp; HEALTHY</span>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                Timezone: West Africa Time (UTC+1) • Executive Distribution
              </div>
            </div>
          </div>
        </section>

        {/* 2. Top Row — Executive KPI Stat Cards (4 Cards) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 print:grid-cols-4 print:gap-2">
          
          {/* Card 1: Tickets Received & Resolved */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between print:p-2.5 print:border-slate-300 print:shadow-none">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Support Inflow &amp; Velocity
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 uppercase">
                Direct Queue
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-extrabold text-[#0F172A] dark:text-white tabular-nums tracking-tight">
                  72
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Tickets Received
                </span>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                <div>
                  <strong className="text-slate-900 dark:text-white tabular-nums font-bold">31 Resolved</strong>{" "}
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
                    (43% Resolution Rate)
                  </span>
                </div>
                <div>
                  Backlog:{" "}
                  <strong className="text-slate-900 dark:text-white tabular-nums font-bold">
                    41 in progress
                  </strong>{" "}
                  (queue contained)
                </div>
              </div>
            </div>
            <div className="mt-3">
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <div className="h-full bg-indigo-600" style={{ width: "43.1%" }} />
                <div className="h-full bg-slate-300 dark:bg-slate-700" style={{ width: "56.9%" }} />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>Weekly Intake</span>
                <span className="font-semibold text-slate-600 dark:text-slate-400 tabular-nums">100% Tracked</span>
              </div>
            </div>
          </div>

          {/* Card 2: Autonomous Deflection */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between print:p-2.5 print:border-slate-300 print:shadow-none">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Autonomous Deflection
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 uppercase">
                Exceeded
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight">
                  227
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Inquiries Deflected
                </span>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                <div>
                  <strong className="text-slate-900 dark:text-white tabular-nums font-bold">
                    ~57 Support Hours Saved
                  </strong>
                </div>
                <div>
                  Multiplier:{" "}
                  <strong className="text-indigo-600 dark:text-indigo-400 font-bold tabular-nums">
                    +2.5 FTE Equivalent
                  </strong>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-500" style={{ width: "75.9%" }} />
                <div className="h-full bg-indigo-500" style={{ width: "24.1%" }} />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>Autonomous Demand Share</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">75.9% Deflected</span>
              </div>
            </div>
          </div>

          {/* Card 3: Field Agents Registry */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between print:p-2.5 print:border-slate-300 print:shadow-none">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Field Operatives Reach
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 uppercase">
                Registry Active
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-extrabold text-[#0F172A] dark:text-white tabular-nums tracking-tight">
                  6,740
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Active Field Agents
                </span>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                <div>
                  <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums font-bold">
                    +3 New Enrolled
                  </strong>{" "}
                  <span>in Registry this cycle</span>
                </div>
                <div>
                  Verification:{" "}
                  <strong className="text-slate-900 dark:text-white font-bold">
                    100% Agent Sync
                  </strong>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <div className="w-full h-1.5 bg-sky-500 rounded-full overflow-hidden" />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>Active Field Coverage</span>
                <span className="font-semibold text-slate-600 dark:text-slate-400 tabular-nums">36 States Covered</span>
              </div>
            </div>
          </div>

          {/* Card 4: Critical Escalations */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between print:p-2.5 print:border-slate-300 print:shadow-none">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Operational SLA
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 uppercase">
                Zero Breach
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight">
                  0
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Critical Escalations
                </span>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                <div>
                  <strong className="text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
                    100% SLA Compliance
                  </strong>
                </div>
                <div>
                  Benchmark:{" "}
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    Target &ge; 98.0%
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <div className="w-full h-1.5 bg-emerald-500 rounded-full overflow-hidden" />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>Risk Exposure</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">OPTIMAL &amp; SECURE</span>
              </div>
            </div>
          </div>

        </section>

        {/* 3. Section 2 — Autonomous Tools ROI & Deflection Impact */}
        <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm print:p-3 print:border-slate-300 print:shadow-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-[#0F172A] dark:bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center">
                2
              </span>
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">
                  Autonomous Tools ROI &amp; Deflection Impact
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Zero-touch inquiry absorption, automated credential recovery, and self-service portal metrics
                </p>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 self-start sm:self-auto">
              Capacity Conserved: +2.5 FTE
            </span>
          </div>

          {/* Sleek ROI Summary Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mb-3.5">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Total Deflections
              </div>
              <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                227 Inquiries
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                75.9% of total support volume
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Support Hours Conserved
              </div>
              <div className="text-base font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">
                ~56.8 Hours
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Computed @ 15m / staff ticket
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Staff Multiplier
              </div>
              <div className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                +2.5 FTE Equivalent
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Avoided headcount expansion
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Success Rate
              </div>
              <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                94.6% Weighted Avg
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Across 5 autonomous channels
              </div>
            </div>
          </div>

          {/* Compact Performance Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px] border-y border-slate-200 dark:border-slate-700">
                  <th className="py-2 px-3">Automation Tool &amp; Channel</th>
                  <th className="py-2 px-3">Core Function &amp; Architecture</th>
                  <th className="py-2 px-3 text-center">Inquiries Deflected</th>
                  <th className="py-2 px-3 text-center">Share %</th>
                  <th className="py-2 px-3 text-center">Success Rate</th>
                  <th className="py-2 px-3 text-center">Hours Saved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                
                {/* 1. VPN Assistant */}
                <tr className="bg-indigo-50/30 dark:bg-indigo-950/20 font-medium">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 dark:text-white">VPN Assistant</span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 uppercase">
                        Top Deflector
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">WireGuard / APN network reset wizard</div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                    Autonomous WireGuard &amp; APN network reset wizard; reconfigures field agent tunnel configs without IT intervention.
                  </td>
                  <td className="py-2.5 px-3 text-center font-extrabold text-slate-900 dark:text-white tabular-nums">
                    148
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-500 tabular-nums">65.2%</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold tabular-nums">
                      94.2%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    ~37.0 hrs
                  </td>
                </tr>

                {/* 2. Agent Payment Portal */}
                <tr className="bg-emerald-50/30 dark:bg-emerald-950/20 font-medium">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 dark:text-white">Agent Payment Portal</span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 uppercase">
                        100% Benchmark
                      </span>
                    </div>
                    <div className="text-[10px] text-sky-600 dark:text-sky-400 font-mono">pay.naiyatechnology.org</div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                    Self-service volume audit, statement check &amp; filtered CSV export; zero manual payment tickets.
                  </td>
                  <td className="py-2.5 px-3 text-center font-extrabold text-slate-900 dark:text-white tabular-nums">
                    38
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-500 tabular-nums">16.7%</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold tabular-nums">
                      100.0%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    ~9.5 hrs
                  </td>
                </tr>

                {/* 3. NIMC Login Assistant */}
                <tr>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">NIMC Login Assistant</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 uppercase">
                        Self-Service
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">Enrollment portal validation</div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                    Enrollment portal link dispatch &amp; credential validation lookup; reduces repetitive login queries.
                  </td>
                  <td className="py-2.5 px-3 text-center font-extrabold text-slate-900 dark:text-white tabular-nums">
                    22
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-500 tabular-nums">9.7%</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold tabular-nums">
                      89.4%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    ~5.5 hrs
                  </td>
                </tr>

                {/* 4. Webmail Reset Assistant */}
                <tr>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">Webmail Reset Assistant</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                        API Gateway
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">cPanel corporate mailbox resets</div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                    Direct cPanel API email password re-provisioning with corporate domain validation (@naiyatechnology.org).
                  </td>
                  <td className="py-2.5 px-3 text-center font-extrabold text-slate-900 dark:text-white tabular-nums">
                    11
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-500 tabular-nums">4.8%</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold tabular-nums">
                      98.1%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    ~2.8 hrs
                  </td>
                </tr>

                {/* 5. AI Diagnostic & Smart Triage */}
                <tr>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">AI Diagnostic &amp; Triage</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                        Pre-Ticket
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">Knowledge base solution match</div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                    Instant article match and symptom triage; intercepts agent inquiries prior to ticket creation.
                  </td>
                  <td className="py-2.5 px-3 text-center font-extrabold text-slate-900 dark:text-white tabular-nums">
                    8
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-500 tabular-nums">3.5%</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold tabular-nums">
                      88.0%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    ~2.0 hrs
                  </td>
                </tr>

                {/* Total Row */}
                <tr className="bg-slate-100 dark:bg-slate-800/80 font-extrabold text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
                  <td colSpan={2} className="py-2.5 px-3 tracking-wide">
                    TOTAL AUTONOMOUS &amp; SELF-SERVICE ECOSYSTEM
                  </td>
                  <td className="py-2.5 px-3 text-center text-sm tabular-nums">227</td>
                  <td className="py-2.5 px-3 text-center tabular-nums">100.0%</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-extrabold tabular-nums">
                      94.6% Avg
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                    ~56.8 Hours Conserved
                  </td>
                </tr>

              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Section 3 — Two-Column Operational Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 print:grid-cols-12 print:gap-2">
          
          {/* Left Column: Workload Demand by Category (5 Cols) */}
          <section className="lg:col-span-5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col justify-between print:col-span-5 print:p-3 print:border-slate-300 print:shadow-none">
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-[#0F172A] dark:bg-indigo-600 text-white font-extrabold text-[11px] flex items-center justify-center">
                    3A
                  </span>
                  <div>
                    <h2 className="text-xs font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">
                      Workload Demand by Category
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Queue share across 72 tickets filed</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 tabular-nums">
                  72 Total Inflow
                </span>
              </div>

              <div className="space-y-3">
                {/* Cat 1: VPN Related (31.9%) */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-600" />
                      VPN Related
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 tabular-nums">23 tickets (10 res / 13 in-prog)</span>
                      <span className="font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums min-w-[42px] text-right">
                        31.9%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 rounded-full" style={{ width: "31.9%" }} />
                  </div>
                </div>

                {/* Cat 2: NIMC Login (26.4%) */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-500" />
                      NIMC Login Details
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 tabular-nums">19 tickets (8 res / 11 in-prog)</span>
                      <span className="font-extrabold text-sky-600 dark:text-sky-400 tabular-nums min-w-[42px] text-right">
                        26.4%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500 rounded-full" style={{ width: "26.4%" }} />
                  </div>
                </div>

                {/* Cat 3: Webmail (20.8%) */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-teal-500" />
                      Webmail Access
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 tabular-nums">15 tickets (7 res / 8 in-prog)</span>
                      <span className="font-extrabold text-teal-600 dark:text-teal-400 tabular-nums min-w-[42px] text-right">
                        20.8%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: "20.8%" }} />
                  </div>
                </div>

                {/* Cat 4: Others (16.7%) */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-500" />
                      Others (General / Admin)
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 tabular-nums">12 tickets (5 res / 7 in-prog)</span>
                      <span className="font-extrabold text-slate-600 dark:text-slate-400 tabular-nums min-w-[42px] text-right">
                        16.7%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-500 rounded-full" style={{ width: "16.7%" }} />
                  </div>
                </div>

                {/* Cat 5: Device & Activation (4.2%) */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Device &amp; Activation
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 tabular-nums">3 tickets (1 res / 2 in-prog)</span>
                      <span className="font-extrabold text-amber-600 dark:text-amber-400 tabular-nums min-w-[42px] text-right">
                        4.2%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: "4.2%" }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Resolution Velocity:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                31 Closed (43.1%) • 41 Backlog (56.9%)
              </span>
            </div>
          </section>

          {/* Right Column: Support Roster Throughput (7 Cols) */}
          <section className="lg:col-span-7 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm print:col-span-7 print:p-3 print:border-slate-300 print:shadow-none">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-[#0F172A] dark:bg-indigo-600 text-white font-extrabold text-[11px] flex items-center justify-center">
                  3B
                </span>
                <div>
                  <h2 className="text-xs font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">
                    Support Roster Throughput
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Verified staff productivity, ticket completions, and active queue burden
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                High Velocity
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px] border-y border-slate-200 dark:border-slate-700">
                    <th className="py-2 px-2.5">Staff Member</th>
                    <th className="py-2 px-2 text-center">Work Score</th>
                    <th className="py-2 px-2 text-center">Resolved</th>
                    <th className="py-2 px-2 text-center">Messages</th>
                    <th className="py-2 px-2 text-center">Queue</th>
                    <th className="py-2 px-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  
                  {/* Abubakar Ibrahim Olose */}
                  <tr>
                    <td className="py-2 px-2.5">
                      <div className="font-extrabold text-slate-900 dark:text-white">Abubakar Ibrahim Olose</div>
                      <div className="text-[10px] text-slate-400">Support Team Lead</div>
                    </td>
                    <td className="py-2 px-2 text-center font-extrabold text-indigo-600 dark:text-indigo-400 text-sm tabular-nums">
                      58
                    </td>
                    <td className="py-2 px-2 text-center font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      14
                    </td>
                    <td className="py-2 px-2 text-center text-slate-500 tabular-nums">44</td>
                    <td className="py-2 px-2 text-center font-bold tabular-nums">12</td>
                    <td className="py-2 px-2 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] uppercase">
                        Active
                      </span>
                    </td>
                  </tr>

                  {/* Yahaya Olajide Hammed */}
                  <tr>
                    <td className="py-2 px-2.5">
                      <div className="font-extrabold text-slate-900 dark:text-white">Yahaya Olajide Hammed</div>
                      <div className="text-[10px] text-slate-400">Senior Operations Officer</div>
                    </td>
                    <td className="py-2 px-2 text-center font-extrabold text-indigo-600 dark:text-indigo-400 text-sm tabular-nums">
                      41
                    </td>
                    <td className="py-2 px-2 text-center font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      9
                    </td>
                    <td className="py-2 px-2 text-center text-slate-500 tabular-nums">32</td>
                    <td className="py-2 px-2 text-center font-bold tabular-nums">15</td>
                    <td className="py-2 px-2 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] uppercase">
                        Active
                      </span>
                    </td>
                  </tr>

                  {/* IT Administrator */}
                  <tr>
                    <td className="py-2 px-2.5">
                      <div className="font-extrabold text-slate-900 dark:text-white">IT Administrator</div>
                      <div className="text-[10px] text-slate-400">Infrastructure &amp; cPanel Admin</div>
                    </td>
                    <td className="py-2 px-2 text-center font-extrabold text-indigo-600 dark:text-indigo-400 text-sm tabular-nums">
                      24
                    </td>
                    <td className="py-2 px-2 text-center font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      5
                    </td>
                    <td className="py-2 px-2 text-center text-slate-500 tabular-nums">19</td>
                    <td className="py-2 px-2 text-center font-bold tabular-nums">8</td>
                    <td className="py-2 px-2 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] uppercase">
                        Active
                      </span>
                    </td>
                  </tr>

                  {/* Support Desk */}
                  <tr>
                    <td className="py-2 px-2.5">
                      <div className="font-extrabold text-slate-900 dark:text-white">Support Officer (Desk)</div>
                      <div className="text-[10px] text-slate-400">Field Triage &amp; Dispatch</div>
                    </td>
                    <td className="py-2 px-2 text-center font-extrabold text-indigo-600 dark:text-indigo-400 text-sm tabular-nums">
                      16
                    </td>
                    <td className="py-2 px-2 text-center font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      3
                    </td>
                    <td className="py-2 px-2 text-center text-slate-500 tabular-nums">13</td>
                    <td className="py-2 px-2 text-center font-bold tabular-nums">6</td>
                    <td className="py-2 px-2 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] uppercase">
                        Active
                      </span>
                    </td>
                  </tr>

                  {/* Total Row */}
                  <tr className="bg-slate-100 dark:bg-slate-800/80 font-extrabold text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
                    <td className="py-2 px-2.5 tracking-wide">TOTAL WORK DONE</td>
                    <td className="py-2 px-2 text-center text-sm text-indigo-600 dark:text-indigo-400 tabular-nums">
                      139
                    </td>
                    <td className="py-2 px-2 text-center text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                      31
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums">108</td>
                    <td className="py-2 px-2 text-center font-extrabold tabular-nums">41</td>
                    <td className="py-2 px-2 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-extrabold text-[10px] uppercase">
                        Optimal
                      </span>
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>
          </section>

        </div>

        {/* 5. Bottom Section — CEO Strategic Takeaways & Action Items */}
        <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm print:p-3 print:border-slate-300 print:shadow-none">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-[#0F172A] dark:bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center">
                4
              </span>
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">
                  CEO Strategic Takeaways &amp; Action Items
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Operational verdicts, ROI assessment, and resource allocation directives
                </p>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Executive Summary Verdict
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 print:grid-cols-4 print:gap-2">
            
            {/* Callout 1: Team Productivity (ON TRACK) */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col justify-between bg-slate-50/50 dark:bg-slate-850/40">
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">
                    1. Team Productivity
                  </span>
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 uppercase">
                    ON TRACK
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Support staff completed <strong>139 verified actions</strong> with a <strong>43% resolution velocity</strong> on incoming tickets. The active queue of 41 remains contained within normal operational SLAs with zero unassigned ticket abandonment.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Owner: Support Team Leads</span>
                <span className="tabular-nums font-semibold">Target &gt; 40%</span>
              </div>
            </div>

            {/* Callout 2: Autonomous ROI (EXCEEDED) */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col justify-between bg-slate-50/50 dark:bg-slate-850/40">
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">
                    2. Autonomous ROI
                  </span>
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800 uppercase">
                    EXCEEDED
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Autonomous self-service tools deflected <strong>227 inquiries</strong>, conserving <strong>~57 support hours</strong> (+2.5 FTE equivalent). VPN Assistant led overall deflection (148 resolutions, 94.2% success), safeguarding engineer bandwidth.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Owner: Automation Engine</span>
                <span className="tabular-nums font-semibold">Target &gt; 50 hrs</span>
              </div>
            </div>

            {/* Callout 3: Payment Self-Service (OPTIMAL) */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col justify-between bg-slate-50/50 dark:bg-slate-850/40">
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">
                    3. Payment Portal
                  </span>
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 uppercase">
                    OPTIMAL
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Deployment of <code className="text-indigo-600 dark:text-indigo-400">pay.naiyatechnology.org</code> with self-service IMEI/NIN monthly statements and CSV audit exports achieved a <strong>100% success rate</strong> across 38 requests, eliminating payment statement inquiry tickets.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Owner: Finance &amp; Portals</span>
                <span className="font-semibold">0 Manual Tickets</span>
              </div>
            </div>

            {/* Callout 4: Network Coverage (EXPANDING) */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col justify-between bg-slate-50/50 dark:bg-slate-850/40">
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">
                    4. Network Coverage
                  </span>
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-400 border border-sky-300 dark:border-sky-800 uppercase">
                    EXPANDING
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Field agent registry reached <strong>6,740 registered agents</strong> (+3 newly enrolled). Infrastructure sustained <strong>100% SLA compliance</strong> with <strong>0 critical escalations</strong> across all state clusters and hardware sync points.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Owner: Field Operations</span>
                <span className="font-semibold">100% SLA Sync</span>
              </div>
            </div>

          </div>
        </section>

        {/* Executive Footer */}
        <footer className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-slate-800 dark:text-slate-200">NA&apos;IYA TECHNOLOGY LIMITED</strong>
            <span>•</span>
            <span>Executive Operations &amp; Support Telemetry Engine</span>
            <span>•</span>
            <span>Confidential Board &amp; CEO Report</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span>ISO 27001 &amp; NDPR CERTIFIED</span>
            <span>•</span>
            <span>PAGINATED A4 LANDSCAPE</span>
          </div>
        </footer>

      </div>
    </div>
  );
};
