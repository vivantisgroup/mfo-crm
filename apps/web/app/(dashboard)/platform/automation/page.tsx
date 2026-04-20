'use client';

import React, { useState } from 'react';
import { usePageTitle } from '@/lib/PageTitleContext';
import { SecondaryDock } from '@/components/SecondaryDock';
import { Settings, Play, Pause, Activity, CalendarClock, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';

// ─── Mock Data ─────────────────────────────────────────────────────────────

const MOCK_JOBS = [
  { id: '1', name: 'Nightly Account Plan Audit', schedule: '0 0 * * *', status: 'active', type: 'compliance', lastRun: '2 hours ago', nextRun: 'in 22 hours' },
  { id: '2', name: 'Birthday & Anniversary Alerts', schedule: '0 8 * * *', status: 'active', type: 'crm', lastRun: '14 hours ago', nextRun: 'in 10 hours' },
  { id: '3', name: 'FX Rate & Market Data Sync', schedule: '0,30 * * * 1-5', status: 'paused', type: 'finance', lastRun: '2 days ago', nextRun: 'Paused' },
  { id: '4', name: 'Overdue Task Escalations', schedule: '0 9 * * 1', status: 'active', type: 'workflow', lastRun: '4 days ago', nextRun: 'in 3 days' },
];

const MOCK_LOGS = [
  { id: 'log_1', job: 'Nightly Account Plan Audit', timestamp: '2026-03-30T00:00:00Z', status: 'success', details: 'Processed 142 active plans. Flagged 3 as stale.' },
  { id: 'log_2', job: 'Birthday & Anniversary Alerts', timestamp: '2026-03-29T08:00:00Z', status: 'success', details: 'Sent 12 notifications to internal Slack webhooks.' },
  { id: 'log_3', job: 'FX Rate & Market Data Sync', timestamp: '2026-03-28T16:30:00Z', status: 'error', details: 'Timeout reaching external API provider after 3000ms.' },
  { id: 'log_4', job: 'FX Rate & Market Data Sync', timestamp: '2026-03-28T16:00:00Z', status: 'success', details: 'Synced 15 active currency pairs to platform cache.' },
  { id: 'log_5', job: 'Overdue Task Escalations', timestamp: '2026-03-23T09:00:00Z', status: 'success', details: 'Escalated 4 task items to Sales Managers.' },
];

const HUB_TABS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'jobs', label: 'Trigger Functions', icon: '⚡' },
  { id: 'logs', label: 'Execution Logs', icon: '📝' },
];

// ─── Subcomponents ─────────────────────────────────────────────────────────

function OverviewTab() {
  const metricData = [
    { name: 'Routine Audits', value: 34 },
    { name: 'CRM Alerts', value: 89 },
    { name: 'Market Data Sync', value: 12 },
    { name: 'Task Overdue Escalation', value: 4 },
  ];

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto p-6 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 border-t-4 border-t-indigo-500">
          <div className="text-sm text-[var(--text-secondary)]">24h Executions</div>
          <div className="text-3xl font-bold tracking-tight">139</div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-[var(--text-secondary)]">Successful runs</div>
            <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">+12.5%</span>
          </div>
        </div>
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 border-t-4 border-t-emerald-500">
          <div className="text-sm text-[var(--text-secondary)]">Active Triggers</div>
          <div className="text-3xl font-bold tracking-tight">3</div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-[var(--text-secondary)]">Scheduled Cron Routines</div>
          </div>
        </div>
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 border-t-4 border-t-red-500">
          <div className="text-sm text-[var(--text-secondary)]">Failing Jobs</div>
          <div className="text-3xl font-bold tracking-tight">1</div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-[var(--text-secondary)] text-red-500 font-medium">FX Rate Sync</div>
            <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">Since 2 days ago</span>
          </div>
        </div>
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
         <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
            <h3 className="text-lg font-semibold tracking-tight mb-2">Execution Events by Type (Last 30 Days)</h3>
            <div className="mt-6 flex flex-col gap-2">
               {metricData.map(m => (
                 <div key={m.name} className="flex flex-col gap-1">
                   <div className="flex justify-between text-sm"><span>{m.name}</span><span className="font-bold">{m.value}</span></div>
                   <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-[var(--brand-500)] h-2 rounded-full" style={{ width: `${(m.value / 100) * 100}%` }}></div></div>
                 </div>
               ))}
            </div>
         </div>
         <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 flex flex-col">
            <h3 className="text-lg font-semibold tracking-tight mb-2">System Health Status</h3>
            <div className="flex-1 flex flex-col items-center justify-center pt-8 pb-4">
               <div className="w-24 h-24 rounded-full bg-emerald-50 flex items-center justify-center border-4 border-emerald-100 mb-6 relative">
                 <div className="absolute inset-0 rounded-full border-4 border-emerald-400 opacity-20 animate-ping"></div>
                 <Activity size={40} className="text-emerald-500" />
               </div>
               <div className="text-center">
                 <h3 className="text-lg font-black text-slate-800 tracking-tight">Cloud Pub/Sub Operational</h3>
                 <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">All Google Cloud functions and scheduled event buses are responsive. Message queue latency is currently ~42ms.</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

function JobsTab() {
  const [jobs, setJobs] = useState(MOCK_JOBS);

  const toggleJob = (id: string) => {
    setJobs(jobs.map(j => {
      if (j.id === id) return { ...j, status: j.status === 'active' ? 'paused' : 'active', nextRun: j.status === 'active' ? 'Paused' : 'Pending verification...' };
      return j;
    }));
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto p-6 animate-fade-in">
      <div className="flex justify-between items-end mb-2">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Automation Triggers</h2>
          <p className="text-sm text-slate-500">Manage background routines executed via Cloud Scheduler and Pub/Sub.</p>
        </div>
        <button className="btn btn-primary btn-sm flex items-center gap-2">
           <Settings size={14} /> Global Settings
        </button>
      </div>

      <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] overflow-hidden">
        <table className="min-w-full divide-y border-slate-200">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 border-b border-slate-200">Schedule / Frequency</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 border-b border-slate-200">Job Detail</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 border-b border-slate-200">Target Pool</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 border-b border-slate-200">Last Executed</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 border-b border-slate-200">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {jobs.map(job => (
               <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                 <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                      <CalendarClock size={16} className={job.status==='active' ? 'text-indigo-400' : 'text-slate-300'} />
                      <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{job.schedule}</span>
                    </div>
                 </td>
                 <td className="whitespace-nowrap px-3 py-4">
                    <div className="font-bold text-sm text-slate-800">{job.name}</div>
                    <div className="text-xs text-slate-500">Next run: {job.nextRun}</div>
                 </td>
                 <td className="whitespace-nowrap px-3 py-4">
                    <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold shadow uppercase tracking-wider ${job.type === 'crm' ? 'bg-emerald-500 text-white hover:bg-emerald-600' : job.type === 'finance' ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-indigo-500 text-white hover:bg-indigo-600'}`}>
                      {job.type}
                    </span>
                 </td>
                 <td className="whitespace-nowrap px-3 py-4">
                    <span className="text-sm text-slate-600 font-medium">{job.lastRun}</span>
                 </td>
                 <td className="whitespace-nowrap px-3 py-4">
                    <div className="flex items-center gap-3">
                       <button 
                         onClick={() => toggleJob(job.id)}
                         className={`w-12 h-6 rounded-full p-1 transition-all flex border shadow-sm ${job.status === 'active' ? 'bg-emerald-500 border-emerald-600 justify-end' : 'bg-slate-200 border-slate-300 justify-start'}`}
                       >
                          <div className={`w-4 h-4 rounded-full bg-white shadow-sm flex items-center justify-center`}>
                            {job.status === 'active' ? <Play size={8} className="text-emerald-500 ml-0.5"/> : <Pause size={8} className="text-slate-400" />}
                          </div>
                       </button>
                       <span className={`text-xs font-bold uppercase ${job.status === 'active' ? 'text-emerald-600' : 'text-slate-400'}`}>
                         {job.status}
                       </span>
                    </div>
                 </td>
               </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-start gap-3 mt-4">
        <AlertCircle size={20} className="text-indigo-500 shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-bold text-indigo-900 mb-1">Infrastructure Notice</div>
          <div className="text-xs text-indigo-700/80 leading-relaxed max-w-3xl">
            Currently, standard execution jobs run within the `us-central1` zone on Cloud Functions v2. For high-throughput analytics jobs, we route directly to BigQuery asynchronous handlers. Changing schedules does not historically affect jobs currently parked in the queue.
          </div>
        </div>
      </div>
    </div>
  );
}

function LogsTab() {
  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto p-6 animate-fade-in">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Execution Logs</h2>

        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] overflow-hidden">
          <table className="min-w-full divide-y border-slate-200">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 border-b border-slate-200">Time (UTC)</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 border-b border-slate-200">Status</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 border-b border-slate-200">Trigger Name</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 border-b border-slate-200">Output / Error Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {MOCK_LOGS.map(log => (
                 <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="whitespace-nowrap px-3 py-4">
                      <span className="font-mono text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4">
                      {log.status === 'success' ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-flex">
                          <CheckCircle2 size={12} /> Success
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full inline-flex">
                          <AlertCircle size={12} /> Failed
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4">
                      <span className="font-semibold text-sm text-slate-700">{log.job}</span>
                    </td>
                    <td className="px-3 py-4">
                      <span className={`text-xs ${log.status === 'error' ? 'text-red-700 font-medium' : 'text-slate-600'}`}>{log.details}</span>
                    </td>
                 </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="flex justify-center mt-4">
           <button className="btn btn-secondary btn-sm flex items-center gap-2">Load More Logs <ChevronRight size={14}/></button>
        </div>
    </div>
  );
}

// ─── Main Hub Page ─────────────────────────────────────────────────────────

export default function AutomationHubPage() {
  usePageTitle('Automation Hub');
  const [tab, setTab] = useState<'overview' | 'jobs' | 'logs'>('overview');

  return (
    <div className="flex flex-col absolute inset-0 overflow-hidden bg-canvas z-0">
      <SecondaryDock 
        tabs={HUB_TABS} 
        activeTab={tab} 
        onTabChange={(id) => setTab(id as any)} 
      />
      <main className="flex-1 flex flex-col min-h-0 relative overflow-y-auto w-full">
         {tab === 'overview' && <OverviewTab />}
         {tab === 'jobs'     && <JobsTab />}
         {tab === 'logs'     && <LogsTab />}
      </main>
    </div>
  );
}
