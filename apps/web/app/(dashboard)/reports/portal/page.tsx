'use client';

import React, { useEffect, useState } from 'react';

import { PlaySquare, Database, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { getReports, type ReportDefinition } from '@/lib/reportsService';

export default function ReportsPortalLobby() {
  const { tenant } = useAuth();
  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (tenant) {
        const data = await getReports(tenant.id);
        setReports(data.filter(r => r.isPublished));
      }
      setLoading(false);
    }
    load();
  }, [tenant]);

  return (
    <div className="relative w-full h-full flex flex-col bg-background text-foreground overflow-y-auto overflow-y-auto w-full relative h-[100vh] flex flex-col">
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-8 pt-8 pb-6 shrink-0 z-10 w-full shadow-sm sticky top-0">
        <h1 className="text-2xl font-black text-[var(--text-primary)]">Reporting Portals</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1 max-w-2xl">
          Select a published dashboard below to view live data analytics and business intelligence views.
        </p>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-8 p-8 pb-32"><div className="max-w-[1200px] w-full mx-auto flex flex-col gap-6">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-[var(--text-tertiary)] text-sm">
            Loading portals...
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col h-64 items-center justify-center text-[var(--text-tertiary)] border border-dashed border-[var(--border-strong)] rounded-xl bg-[var(--bg-surface)] mt-4">
            <Database size={32} className="mb-4 opacity-40" />
            <p className="text-sm font-medium text-[var(--text-primary)]">No Published Portals Found</p>
            <p className="text-xs mt-1">Dashboards must first be built and published using the composer.</p>
            <Link href="/reports/builder" className="text-[var(--brand-primary)] text-xs font-bold mt-4 hover:underline px-3 py-1.5 border border-[var(--brand-primary)] rounded">
              Access BI Composer
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-4">
            {reports.map(report => (
              <Link 
                href={`/reports/portal/${report.id}`} 
                key={report.id}
                className="group flex flex-col p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--brand-primary)] hover:shadow-md transition-all h-48 cursor-pointer relative top-0 hover:-top-1"
              >
                <div className="flex justify-between items-start mb-auto">
                    <div>
                        <h3 className="font-bold text-[var(--text-primary)] text-lg leading-tight group-hover:text-[var(--brand-primary)] transition-colors pr-2">{report.name}</h3>
                        <div className="text-xs text-[var(--text-secondary)] mt-2 line-clamp-2 pr-2">{report.description || 'No description provided for this portal.'}</div>
                    </div>
                    <div className="w-10 h-10 rounded-lg shadow-sm bg-[var(--bg-background)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--brand-primary)] shrink-0 group-hover:bg-[var(--brand-primary)] group-hover:text-white transition-colors">
                        <PlaySquare size={18} />
                    </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)] font-semibold uppercase tracking-widest pt-4 border-t border-[var(--border-subtle)]">
                    <span className="flex items-center gap-1.5"><Database size={12} className="opacity-70"/> {report.widgets.length} Widgets</span>
                    <span className="flex items-center gap-1.5"><Calendar size={12} className="opacity-70"/> {new Date(report.updatedAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div></div>
    </div>
  );
}
