'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PenTool, MoreVertical, Trash, LayoutDashboard } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { useAuth } from '@/lib/AuthContext';
import { getFirestore, collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';
import RevenueChart from './components/RevenueChart';
import PipelineFunnel from './components/PipelineFunnel';

export default function ReportsPage() {
  const { user, tenant, stage } = useAuth();
  const authLoading = stage === 'loading';
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!tenant?.id) {
      setLoading(false);
      return;
    }
    const db = getFirestore(firebaseApp);
    const q = query(collection(db, 'tenants', tenant.id, 'reports'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, {
       next: (snapshot) => {
         const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
         setReports(docs);
         setLoading(false);
       },
       error: (error) => {
         console.error('Reports snapshot error:', error);
         setLoading(false);
       }
    });

    return () => unsubscribe();
  }, [tenant?.id, authLoading]);

  const handleDelete = async (id: string, title: string) => {
     if (!confirm(`Are you sure you want to delete the dashboard widget: ${title}?`)) return;
     if (!tenant?.id) return;
     const db = getFirestore(firebaseApp);
     await deleteDoc(doc(db, 'tenants', tenant.id, 'reports', id));
  };

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-[var(--bg-background)]">
      {/* Header Dock */}
      <div className="px-6 py-4 lg:py-5 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] shrink-0 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
             <LayoutDashboard size={20} />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-black text-[var(--text-primary)] tracking-tight leading-none mb-1">Business Intelligence</h1>
            <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Enterprise Analytics Portal</p>
          </div>
        </div>
        <div>
           <Link href="/reports/builder" className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-bold rounded-md shadow uppercase tracking-wider transition-colors">
              <PenTool size={14} />
              AI Studio Builder
           </Link>
        </div>
      </div>
      
      {/* Dynamic Dashboard Body */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 w-full">
         {loading ? (
             <div className="flex w-full h-full items-center justify-center text-sm font-semibold text-[var(--text-tertiary)] animate-pulse">Loading Analytics Configuration...</div>
         ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto text-center gap-4">
               <div className="w-20 h-20 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-full flex items-center justify-center text-[var(--border-strong)]"><LayoutDashboard size={32} /></div>
               <h2 className="text-xl font-bold text-[var(--text-primary)]">No custom reports configured</h2>
               <p className="text-sm text-[var(--text-secondary)]">Use the AI Studio Builder to create tailored visualization widgets from your CRM data.</p>
               <Link href="/reports/builder" className="mt-2 text-indigo-600 font-bold text-sm tracking-wide bg-indigo-50 px-4 py-2 rounded shadow-sm border border-indigo-100 hover:bg-indigo-100 transition-colors">Launch AI Copilot</Link>
            </div>
         ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 max-w-[1800px] mx-auto">
               {reports.map((report) => (
                  <div key={report.id} className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col h-[400px] overflow-hidden group">
                     {/* Widget Header */}
                     <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-elevated)] shrink-0">
                        <div>
                          <h3 className="text-[13px] font-bold text-[var(--text-primary)] leading-none">{report.title}</h3>
                          <span className="text-[10px] text-[var(--text-tertiary)] font-semibold uppercase tracking-wider mt-1 block">Data Node: {report.dataSource}</span>
                        </div>
                        <button onClick={() => handleDelete(report.id, report.title)} className="p-1.5 text-[var(--text-tertiary)] hover:bg-red-50 hover:text-red-600 rounded transition-colors opacity-0 group-hover:opacity-100">
                           <Trash size={14} />
                        </button>
                     </div>
                     {/* ECharts Canvas Box */}
                     <div className="flex-1 p-2 w-full relative min-h-0 bg-[var(--bg-background)]">
                        {report.config && Object.keys(report.config).length > 0 ? (
                           <ReactECharts option={report.config} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} notMerge={true} lazyUpdate={true} />
                        ) : (
                           <div className="w-full h-full flex items-center justify-center text-xs text-[var(--text-tertiary)] italic">Broken Schema Payload</div>
                        )}
                     </div>
                  </div>
               ))}
               
               {/* Legacy Placeholder Fallback */}
               <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-sm flex flex-col h-[400px] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] shrink-0">
                     <h3 className="text-[13px] font-bold text-[var(--text-primary)]">System Analytics (Legacy Base)</h3>
                  </div>
                  <div className="flex-1"><RevenueChart /></div>
               </div>
               <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-sm flex flex-col h-[400px] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] shrink-0">
                     <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Pipeline Funnel (Legacy)</h3>
                  </div>
                  <div className="flex-1"><PipelineFunnel /></div>
               </div>
            </div>
         )}
      </div>
    </div>
  );
}
