'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { Database, LayoutTemplate, Settings2, Play, Save, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { ROLE_PERMISSIONS, type Permission } from '@/lib/rbacService';
import type { PlatformRole } from '@/lib/platformService';

// Database Registry mapping to RBAC Permissions
const ALL_MODULE_TABLES = [
  { id: 'families', label: 'Families & Entities', permission: 'families:read' },
  { id: 'contacts', label: 'Contacts Directory', permission: 'contacts:read' },
  { id: 'activities', label: 'CRM Activities', permission: 'activities:read' },
  { id: 'tasks', label: 'Task Management', permission: 'tasks:read' },
  { id: 'calendar', label: 'Calendar Events', permission: 'calendar:read' },
  { id: 'portfolio', label: 'Portfolio Positions', permission: 'portfolio:read' },
  { id: 'documents', label: 'Document Vault', permission: 'documents:read' },
  { id: 'estate', label: 'Estate Planning', permission: 'estate:read' },
  { id: 'governance', label: 'Governance Policies', permission: 'governance:read' },
  { id: 'compliance', label: 'Compliance & KYC', permission: 'compliance:read' },
  { id: 'suitability', label: 'Suitability Profiles', permission: 'suitability:read' },
  { id: 'concierge', label: 'Concierge Services', permission: 'concierge:read' },
];

export default function BIBuilderPage() {
  const { user } = useAuth();
  const userRole = user?.role as PlatformRole | undefined;
  
  // Calculate authorized tables
  const userPermissions = userRole ? (ROLE_PERMISSIONS[userRole] || []) : [];
  const availableTables = ALL_MODULE_TABLES.filter(t => userPermissions.includes(t.permission as Permission));

  const [chartType, setChartType] = useState<'line' | 'bar' | 'pie'>('bar');
  const [dataSource, setDataSource] = useState(availableTables.length > 0 ? availableTables[0].id : 'crm_opportunities');
  const [colorScheme, setColorScheme] = useState('emerald');
  
  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync default if current is unauthorized
  useEffect(() => {
    if (availableTables.length > 0 && !availableTables.find(t => t.id === dataSource)) {
      setDataSource(availableTables[0].id);
    }
  }, [availableTables, dataSource]);

  // Boxed UI ResizeObserver
  useEffect(() => {
    if (!containerRef.current || !chartRef.current) return;
    let timer: NodeJS.Timeout;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        chartRef.current?.getEchartsInstance()?.resize();
      }, 50);
    });
    observer.observe(containerRef.current);
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, []);

  // Mock data generator for live preview
  const getMockData = () => {
    switch(dataSource) {
      case 'families':
        return [
          { name: 'UHNW', value: 45 }, { name: 'HNW', value: 120 }, { name: 'Core', value: 340 }
        ];
      case 'contacts':
        return [
          { name: 'Principals', value: 85 }, { name: 'Advisors', value: 156 }, { name: 'Dependents', value: 210 }
        ];
      case 'activities':
        return [
          { name: 'Calls', value: 450 }, { name: 'Meetings', value: 120 }, { name: 'Emails', value: 1250 }
        ];
      case 'tasks':
        return [
          { name: 'To Do', value: 55 }, { name: 'In Progress', value: 34 }, { name: 'Review', value: 12 }, { name: 'Done', value: 89 }
        ];
      case 'calendar':
        return [
          { name: 'Q1', value: 120 }, { name: 'Q2', value: 145 }, { name: 'Q3', value: 110 }, { name: 'Q4', value: 95 }
        ];
      case 'portfolio':
        return [
          { name: 'Equities', value: 65000000 }, { name: 'Fixed Income', value: 30000000 }, { name: 'Alts', value: 15000000 }, { name: 'Cash', value: 5000000 }
        ];
      case 'documents':
        return [
          { name: 'Signed', value: 450 }, { name: 'Pending', value: 32 }, { name: 'Archived', value: 1200 }
        ];
      case 'estate':
        return [
          { name: 'Trusts', value: 45 }, { name: 'Wills', value: 120 }, { name: 'Directives', value: 85 }
        ];
      case 'governance':
        return [
          { name: 'Active', value: 12 }, { name: 'In Review', value: 3 }, { name: 'Drafts', value: 5 }
        ];
      case 'compliance':
      case 'suitability':
        return [
          { name: 'Approved', value: 850 }, { name: 'Pending Review', value: 45 }, { name: 'Flagged', value: 12 }
        ];
      case 'concierge':
        return [
          { name: 'Travel', value: 120 }, { name: 'Events', value: 45 }, { name: 'Lifestyle', value: 80 }
        ];
      case 'crm_opportunities':
        return [
          { name: 'Q1', value: 120000 }, { name: 'Q2', value: 200000 }, { name: 'Q3', value: 150000 }, { name: 'Q4', value: 80000 }
        ];
      default:
        return [
          { name: 'Metric A', value: 42 }, { name: 'Metric B', value: 58 }
        ];
    }
  };

  const data = getMockData();

  const getColors = () => {
    if (colorScheme === 'emerald') return ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0']; // Bright emerald sequence for charts
    if (colorScheme === 'slate') return ['#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0'];
    return ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe']; // Blue
  };

  const option = {
    color: getColors(),
    textStyle: { fontFamily: 'Inter, sans-serif' },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'var(--bg-surface)',
      borderColor: 'var(--border-subtle)',
      borderWidth: 1,
      textStyle: { color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 },
      extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border-radius: 8px;'
    },
    xAxis: chartType !== 'pie' ? {
      type: 'category',
      data: data.map(d => d.name),
      axisLine: { lineStyle: { color: 'var(--border-strong)' } },
      axisLabel: { color: 'var(--text-secondary)' }
    } : undefined,
    yAxis: chartType !== 'pie' ? {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: 'var(--border-subtle)', type: 'dashed' } },
      axisLabel: { color: 'var(--text-secondary)' }
    } : undefined,
    series: [
      {
        type: chartType,
        data: chartType === 'pie' ? data : data.map(d => d.value),
        radius: chartType === 'pie' ? ['40%', '70%'] : undefined,
        itemStyle: {
          borderRadius: chartType === 'bar' ? [4, 4, 0, 0] : chartType === 'pie' ? 6 : 0,
          borderColor: chartType === 'pie' ? 'var(--bg-surface)' : 'transparent',
          borderWidth: chartType === 'pie' ? 2 : 0
        },
        symbolSize: 8,
        smooth: true,
      }
    ]
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-[var(--bg-background)] overflow-hidden animate-fade-in z-40">
      {/* Editor Header */}
      <div className="h-16 shrink-0 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/reports" className="w-8 h-8 flex items-center justify-center rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
             <ChevronLeft size={16} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)] leading-tight">BI Studio</h1>
            <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Custom ECharts Builder</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] rounded text-xs font-bold transition-colors">
            <Play size={14} /> Preview Query
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-[var(--brand-primary)] text-white border border-transparent hover:brightness-90 rounded text-xs font-bold transition-colors shadow-sm">
            <Save size={14} /> Save Dashboard
          </button>
        </div>
      </div>

      {/* Builder Workspace */}
      <div className="flex-1 flex min-h-0">
        
        {/* Left Pane: Data & Logic */}
        <div className="w-[300px] shrink-0 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] flex flex-col">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)] bg-[var(--bg-elevated)]">
            <Database size={14} /> Data Source
          </div>
          <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-5">
             <div>
               <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Primary Dataset</label>
               <select 
                 value={dataSource} 
                 onChange={e => setDataSource(e.target.value)}
                 className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm rounded-md px-3 py-2 outline-none focus:border-[var(--brand-primary)]"
               >
                 {availableTables.length > 0 ? availableTables.map(t => (
                   <option key={t.id} value={t.id}>
                     {t.label} {userRole ? `(${t.permission})` : ''}
                   </option>
                 )) : (
                   <option value="none" disabled>No access to database tables</option>
                 )}
               </select>
             </div>
             <div>
               <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Metrics (Y Axis)</label>
               <div className="bg-[var(--bg-background)] border border-[var(--border-subtle)] rounded-md p-2 flex items-center justify-center text-[var(--text-tertiary)] text-xs border-dashed">
                  Drag numeric dimension here
               </div>
             </div>
             <div>
               <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Grouping (X Axis / Slices)</label>
               <div className="bg-[var(--bg-background)] border border-[var(--border-subtle)] rounded-md p-2 flex items-center gap-2 text-[var(--text-primary)] text-xs font-semibold shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-[var(--brand-primary)]"></span> Stage Dates
               </div>
             </div>
          </div>
        </div>

        {/* Center Pane: Live Canvas */}
        <div className="flex-1 bg-[var(--bg-background)] p-6 flex flex-col min-h-0 relative">
          <div className="absolute top-8 left-8 flex items-center gap-2 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-widest z-10 bg-[var(--bg-surface)] px-3 py-1.5 rounded-full border border-[var(--border-subtle)] shadow-sm">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div> Live Preview
          </div>
          
          <div ref={containerRef} className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-sm overflow-hidden flex flex-col p-6 mt-10">
             <ReactECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {/* Right Pane: Visualization Styling */}
        <div className="w-[300px] shrink-0 bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] flex flex-col">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)] bg-[var(--bg-elevated)]">
            <LayoutTemplate size={14} /> Visualization
          </div>
          <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-6">
             <div>
               <label className="block text-xs font-bold text-[var(--text-secondary)] mb-3">Chart Type</label>
               <div className="grid grid-cols-3 gap-2">
                 {['bar', 'line', 'pie'].map(type => (
                   <button 
                     key={type}
                     onClick={() => setChartType(type as any)}
                     className={`py-2 rounded border text-xs font-bold capitalize transition-colors ${chartType === type ? 'bg-[var(--bg-elevated)] border-[var(--brand-primary)] text-[var(--brand-primary)] shadow-sm' : 'bg-transparent border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'}`}
                   >
                     {type}
                   </button>
                 ))}
               </div>
             </div>
             
             <div>
               <label className="block text-xs font-bold text-[var(--text-secondary)] mb-3">Color Scheme</label>
               <div className="flex flex-col gap-2">
                 {[
                   { id: 'emerald', label: 'Deep Emerald', colors: ['bg-[#10b981]', 'bg-[#34d399]'] },
                   { id: 'slate', label: 'Monochrome', colors: ['bg-[#64748b]', 'bg-[#94a3b8]'] },
                   { id: 'blue', label: 'Ocean', colors: ['bg-[#3b82f6]', 'bg-[#60a5fa]'] },
                 ].map(scheme => (
                   <button 
                     key={scheme.id}
                     onClick={() => setColorScheme(scheme.id)}
                     className={`flex items-center justify-between p-2 rounded border transition-colors ${colorScheme === scheme.id ? 'bg-[var(--bg-elevated)] border-[var(--brand-primary)] shadow-sm' : 'bg-transparent border-[var(--border-subtle)] hover:border-[var(--border-strong)]'}`}
                   >
                     <span className={`text-xs font-semibold ${colorScheme === scheme.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{scheme.label}</span>
                     <div className="flex items-center gap-0.5">
                       <div className={`w-3 h-3 rounded-sm ${scheme.colors[0]}`}></div>
                       <div className={`w-3 h-3 rounded-sm ${scheme.colors[1]}`}></div>
                     </div>
                   </button>
                 ))}
               </div>
             </div>

             <div className="pt-4 border-t border-[var(--border-subtle)]">
                <button className="w-full flex items-center justify-center gap-2 py-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-background)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-xs font-bold transition-colors">
                  <Settings2 size={14} /> Advanced Settings
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
