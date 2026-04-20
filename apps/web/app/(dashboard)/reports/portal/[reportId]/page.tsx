'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getReportById, type ReportDefinition } from '@/lib/reportsService';
import AdvancedEChartsCore from '@/components/AdvancedEChartsCore';

import { LayoutTemplate, ChevronLeft, Calendar, Database, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
const ResponsiveGridLayout = WidthProvider(Responsive);
import { format } from 'date-fns';

// Reusing same mock data generator for read-only view
const getMockData = (dataSource: string, globalFilter: string | null = null) => {
  let raw: any[] = [];
  switch(dataSource) {
    case 'families': raw = [{ name: 'UHNW', value: 45 }, { name: 'HNW', value: 120 }, { name: 'Core', value: 340 }]; break;
    case 'contacts': raw = [{ name: 'Principals', value: 85 }, { name: 'Advisors', value: 156 }, { name: 'Dependents', value: 210 }]; break;
    case 'activities': raw = [{ name: 'Calls', value: 450 }, { name: 'Meetings', value: 120 }, { name: 'Emails', value: 1250 }]; break;
    case 'tasks': raw = [{ name: 'To Do', value: 55 }, { name: 'In Progress', value: 34 }, { name: 'Review', value: 12 }, { name: 'Done', value: 89 }]; break;
    case 'calendar': raw = [{ name: 'Q1', value: 120 }, { name: 'Q2', value: 145 }, { name: 'Q3', value: 110 }, { name: 'Q4', value: 95 }]; break;
    case 'portfolio': raw = [{ name: 'Equities', value: 65000000 }, { name: 'Fixed Income', value: 30000000 }, { name: 'Alts', value: 15000000 }, { name: 'Cash', value: 5000000 }]; break;
    case 'documents': raw = [{ name: 'Signed', value: 450 }, { name: 'Pending', value: 32 }, { name: 'Archived', value: 1200 }]; break;
    case 'estate': raw = [{ name: 'Trusts', value: 45 }, { name: 'Wills', value: 120 }, { name: 'Directives', value: 85 }]; break;
    case 'governance': raw = [{ name: 'Active', value: 12 }, { name: 'In Review', value: 3 }, { name: 'Drafts', value: 5 }]; break;
    case 'compliance':
    case 'suitability': raw = [{ name: 'Approved', value: 850 }, { name: 'Pending Review', value: 45 }, { name: 'Flagged', value: 12 }]; break;
    case 'concierge': raw = [{ name: 'Travel', value: 120 }, { name: 'Events', value: 45 }, { name: 'Lifestyle', value: 80 }]; break;
    case 'crm_opportunities': raw = [{ name: 'Q1', value: 120000 }, { name: 'Q2', value: 200000 }, { name: 'Q3', value: 150000 }, { name: 'Q4', value: 80000 }]; break;
    default: raw = [{ name: 'Metric A', value: 42 }, { name: 'Metric B', value: 58 }]; break;
  }
  if (globalFilter) {
    return raw.map(d => ({
      ...d,
      value: typeof d.value === 'number' ? Math.floor(d.value * (0.1 + (Math.random() * 0.3))) : d.value
    }));
  }
  return raw;
};

export default function ReportPortalPage() {
  const params = useParams();
  const reportId = params.reportId as string;
  const router = useRouter();

  const [report, setReport] = useState<ReportDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!reportId) return;
    getReportById(reportId).then((data) => {
      setReport(data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [reportId]);

  if (loading) {
    return <div className="p-10 text-[var(--text-secondary)] animate-pulse">Loading Dashboard...</div>;
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-[var(--text-tertiary)] bg-[var(--bg-background)] p-6">
        <LayoutTemplate size={48} className="mb-4 opacity-50 text-[var(--text-secondary)]" />
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Dashboard Not Found</h2>
        <p className="text-sm border border-[var(--border-subtle)] p-4 rounded bg-[var(--bg-surface)] shadow-sm">
          The requested report ({reportId}) either does not exist or you do not have permission to view it.
        </p>
        <button onClick={() => router.push('/reports')} className="mt-6 text-[var(--brand-primary)] hover:underline text-sm font-semibold">
          Return to Reports Home
        </button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-[var(--bg-background)] overflow-y-auto animate-fade-in z-40">
      {/* Portal Header - Simplified and Clean */}
      <div className="h-16 shrink-0 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-6 sm:px-10 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/reports" className="w-8 h-8 flex items-center justify-center rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors" title="Back to Reports">
             <ChevronLeft size={16} />
          </Link>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-[var(--text-primary)] leading-tight">{report.name}</h1>
            <div className="flex items-center gap-2 text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest mt-0.5">
               <span className="flex items-center gap-1"><Calendar size={12}/> Updated {format(new Date(report.updatedAt), 'MMM d, yyyy')}</span>
               <span className="px-1.5 py-0.5 bg-[var(--brand-primary)] text-white rounded shadow-sm">Published</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {report.isPublished && (
            <button 
              onClick={() => router.push('/reports/builder')}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-background)] rounded shadow-sm text-xs font-bold transition-colors"
            >
              Edit Dashboard
            </button>
          )}
        </div>
      </div>

      {/* Portal Canvas */}
      <div className="flex-1 p-6 sm:p-10 relative">
        {report.widgets.length === 0 ? (
           <div className="py-20 text-center text-[var(--text-tertiary)]">
             <p className="text-sm font-medium">This dashboard has no components.</p>
           </div>
        ) : (
           <div className="max-w-[1400px] mx-auto pb-12 flex flex-col gap-6 w-full">
              {globalFilter && (
                   <div className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-elevated)] border border-[var(--brand-primary)]/30 text-[var(--brand-primary)] rounded-lg self-start text-sm font-bold shadow-sm animate-fade-in">
                      <Database size={16} className="opacity-70" />
                      <span>Filtered perspective: <span className="text-[var(--text-primary)]">{globalFilter}</span></span>
                      <div className="w-px h-4 bg-[var(--brand-primary)]/30 mx-2"></div>
                      <button onClick={() => setGlobalFilter(null)} className="hover:text-rose-500 transition-colors flex items-center">
                         <Trash2 size={14} /> <span className="ml-1 uppercase text-[10px] tracking-wider">Clear Filter</span>
                      </button>
                   </div>
              )}
             <div 
               className="grid gap-6 auto-rows-[minmax(0,1fr)] w-full" 
               style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
             >
              {report.widgets.map(widget => (
                 <div key={widget.id} className="p-4 border border-border rounded-lg bg-card hover:border-primary/30 transition-colors shadow-sm">
                   <AdvancedEChartsCore
                     widget={widget}
                     data={getMockData(widget.dataSource || 'families', globalFilter)}
                     
                      
                     
                   />
                 </div>
              ))}
           </div>
           </div>
        )}
      </div>
    </div>
  );
}

