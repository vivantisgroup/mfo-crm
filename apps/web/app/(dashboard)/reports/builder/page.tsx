'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { Database, LayoutTemplate, Settings2, Play, Save, ChevronLeft, Bot, Code, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { ROLE_PERMISSIONS, type Permission } from '@/lib/rbacService';
import type { PlatformRole } from '@/lib/platformService';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';
import { toast } from 'sonner';

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
  const { user, tenant } = useAuth();
  const userRole = user?.role as PlatformRole | undefined;
  
  // Calculate authorized tables
  const userPermissions = userRole ? (ROLE_PERMISSIONS[userRole] || []) : [];
  const availableTables = ALL_MODULE_TABLES.filter(t => userPermissions.includes(t.permission as Permission));

  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveTitle, setSaveTitle] = useState('My AI Dashboard Report');
  const [dataSource, setDataSource] = useState(availableTables.length > 0 ? availableTables[0].id : 'crm_opportunities');
  const [rightTab, setRightTab] = useState<'design'|'code'>('design');
  
  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Default Blueprint
  const INITIAL_OPTION = {
    color: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
    textStyle: { fontFamily: 'Inter, sans-serif' },
    tooltip: { trigger: 'item' },
    xAxis: { type: 'category', data: ['Q1', 'Q2', 'Q3', 'Q4'] },
    yAxis: { type: 'value' },
    series: [ { type: 'bar', data: [120000, 200000, 150000, 80000] } ]
  };

  const [chartConfigStr, setChartConfigStr] = useState(JSON.stringify(INITIAL_OPTION, null, 2));

  let parsedOption: any = {};
  try {
     parsedOption = JSON.parse(chartConfigStr);
  } catch (e) {
     // Ignore real-time typing errors in JSON
  }

  const updateOption = (updater: (opt: any) => void) => {
    try {
       const current = JSON.parse(chartConfigStr);
       updater(current);
       setChartConfigStr(JSON.stringify(current, null, 2));
    } catch {
       toast.error("Cannot use Design Studio while JSON structure is invalid. Please fix syntax in Code tab first.");
    }
  };

  // Boxed UI ResizeObserver
  useEffect(() => {
    if (!containerRef.current || !chartRef.current) return;
    let timer: NodeJS.Timeout;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          chartRef.current?.getEchartsInstance()?.resize();
        } catch (e) {
          console.warn('ECharts resize layout engine skipped due to transitional structural fault:', e);
        }
      }, 50);
    });
    observer.observe(containerRef.current);
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, []);

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/ai/chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           prompt: aiPrompt,
           schema: { activeTable: dataSource },
           theme: 'emerald'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate chart');
      
      if (data.option) {
         setChartConfigStr(JSON.stringify(data.option, null, 2));
      }
    } catch (e: any) {
      toast.error("AI Generation Error: " + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToDashboard = async () => {
     if (!tenant?.id || !user?.uid) {
        toast.error("You must be part of a tenant to save analytics.");
        return;
     }
     if (!saveTitle.trim()) { toast.error("Please provide a title"); return; }
     
     setIsSaving(true);
     try {
       const db = getFirestore(firebaseApp);
       await addDoc(collection(db, 'tenants', tenant.id, 'reports'), {
         title: saveTitle,
         type: 'echarts_widget',
         config: parsedOption,
         dataSource,
         createdBy: user.uid,
         createdAt: serverTimestamp()
       });
       toast.error("Successfully saved to your Analytics Dashboard!");
     } catch (e: any) {
       console.error(e);
       toast.error("Failed to save report: " + e.message);
     } finally {
       setIsSaving(false);
     }
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
          <input 
            type="text" 
            value={saveTitle} 
            onChange={e => setSaveTitle(e.target.value)} 
            placeholder="Dashboard Widget Title" 
            className="w-64 px-3 py-1.5 bg-[var(--bg-background)] border border-[var(--border-subtle)] rounded text-xs font-semibold focus:outline-none"
          />
          <button disabled={isSaving} onClick={handleSaveToDashboard} className="flex items-center gap-2 px-3 py-1.5 bg-[var(--brand-primary)] text-white border border-transparent hover:brightness-90 rounded text-xs font-bold transition-colors shadow-sm disabled:opacity-50">
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {isSaving ? 'Deploying...' : 'Save & Publish'}
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
          </div>
          <div className="px-4 py-3 border-b border-t mt-auto border-[var(--border-subtle)] flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)] bg-[var(--bg-elevated)]">
            <Bot size={14} /> AI Builder Prompt
          </div>
          <div className="p-4 flex-col flex shrink-0">
             <textarea 
               value={aiPrompt}
               onChange={e => setAiPrompt(e.target.value)}
               placeholder="Example: Produce a sleek 3D Globe with data routes, or a stacked area chart analyzing sales by quarter."
               className="w-full h-32 bg-[var(--bg-background)] border border-indigo-200 text-[var(--text-primary)] text-xs rounded-md px-3 py-2 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 resize-none mb-3"
             />
             <button disabled={isGenerating} onClick={handleAiGenerate} className="w-full justify-center flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded text-xs font-bold transition-colors shadow-sm disabled:opacity-50">
                {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />} {isGenerating ? 'Generating Chart logic via LLM...' : 'Generate with Copilot'}
             </button>
          </div>
        </div>

        {/* Center Pane: Live Canvas */}
        <div className="flex-1 bg-[var(--bg-background)] p-6 flex flex-col min-h-0 relative">
          <div className="absolute top-8 left-8 flex items-center gap-2 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-widest z-10 bg-[var(--bg-surface)] px-3 py-1.5 rounded-full border border-[var(--border-subtle)] shadow-sm">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div> Live Preview
          </div>
          
          <div ref={containerRef} className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-sm overflow-hidden flex flex-col p-6 mt-10">
             {Object.keys(parsedOption).length > 0 ? (
                <ReactECharts ref={chartRef} option={parsedOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} notMerge={true} lazyUpdate={true} />
             ) : (
                <div className="flex-1 flex items-center justify-center text-[var(--text-tertiary)] text-sm font-semibold">JSON Structure is invalid or empty.</div>
             )}
          </div>
        </div>

        <div className="w-[350px] shrink-0 bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] flex flex-col">
          <div className="flex items-center shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1 gap-1">
             <button onClick={() => setRightTab('design')} className={`flex-1 py-1.5 text-xs font-bold rounded flex justify-center items-center gap-2 transition-colors ${rightTab === 'design' ? 'bg-[var(--bg-surface)] shadow-sm text-[var(--text-primary)] border border-[var(--border-subtle)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>
                <LayoutTemplate size={14} /> Studio Design
             </button>
             <button onClick={() => setRightTab('code')} className={`flex-1 py-1.5 text-xs font-bold rounded flex justify-center items-center gap-2 transition-colors ${rightTab === 'code' ? 'bg-[#1e1e1e] text-emerald-400 border border-[#333]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>
                <Code size={14} /> Raw JSON
             </button>
          </div>
          
          {rightTab === 'design' ? (
             <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
                {/* Title Controls */}
                <div>
                  <h3 className="text-xs font-bold text-[var(--text-secondary)] mb-3 border-b border-[var(--border-subtle)] pb-1">Chart Title</h3>
                  <label className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)] mb-3 cursor-pointer">
                     Display Title
                     <div onClick={() => updateOption(o => { o.title = o.title || {}; o.title.show = o.title.show === false ? true : false; })} className={`w-8 h-4 rounded-full flex items-center transition-colors px-0.5 ${parsedOption?.title?.show !== false ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                        <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${parsedOption?.title?.show !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                     </div>
                  </label>
                  <input type="text" value={parsedOption?.title?.text || ''} placeholder="Main Title" onChange={e => updateOption(o => { o.title = o.title || {}; o.title.text = e.target.value; })} className="w-full mb-2 bg-[var(--bg-background)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs rounded px-2 py-1.5 outline-none" />
                  <input type="text" value={parsedOption?.title?.subtext || ''} placeholder="Subtitle Text" onChange={e => updateOption(o => { o.title = o.title || {}; o.title.subtext = e.target.value; })} className="w-full bg-[var(--bg-background)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs rounded px-2 py-1.5 outline-none" />
                </div>

                {/* Legend & Tooltip */}
                <div>
                  <h3 className="text-xs font-bold text-[var(--text-secondary)] mb-3 border-b border-[var(--border-subtle)] pb-1">Interactive Elements</h3>
                  <label className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)] mb-3 cursor-pointer">
                     Show Legend
                     <div onClick={() => updateOption(o => { o.legend = o.legend || {}; o.legend.show = o.legend.show === false ? true : false; })} className={`w-8 h-4 rounded-full flex items-center transition-colors px-0.5 ${parsedOption?.legend?.show !== false ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                        <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${parsedOption?.legend?.show !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                     </div>
                  </label>
                  <label className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)] mb-3 cursor-pointer">
                     Show Tooltips
                     <div onClick={() => updateOption(o => { o.tooltip = o.tooltip || { trigger: 'item' }; o.tooltip.show = o.tooltip.show === false ? true : false; })} className={`w-8 h-4 rounded-full flex items-center transition-colors px-0.5 ${parsedOption?.tooltip?.show !== false ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                        <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${parsedOption?.tooltip?.show !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                     </div>
                  </label>
                  <label className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)] cursor-pointer">
                     Enable DataZoom Sliders
                     <div onClick={() => updateOption(o => { if(o.dataZoom){ delete o.dataZoom; } else { o.dataZoom = [{ type: 'slider', show: true }]; } })} className={`w-8 h-4 rounded-full flex items-center transition-colors px-0.5 ${parsedOption?.dataZoom ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                        <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${parsedOption?.dataZoom ? 'translate-x-4' : 'translate-x-0'}`} />
                     </div>
                  </label>
                </div>

                {/* Series Base Type */}
                <div>
                  <h3 className="text-xs font-bold text-[var(--text-secondary)] mb-3 border-b border-[var(--border-subtle)] pb-1">Primary Series Override</h3>
                  <div className="grid grid-cols-3 gap-2">
                     {['bar', 'line', 'pie', 'scatter', 'area', 'radar', 'funnel', 'gauge', 'heatmap', 'candlestick'].map(t => (
                        <button 
                           key={t} 
                           onClick={() => updateOption(o => { 
                             if(o.series?.[0]) {
                               o.series[0].type = t === 'area' ? 'line' : t; 
                               if(t === 'area') o.series[0].areaStyle = {};
                               else if (o.series[0].areaStyle) delete o.series[0].areaStyle;
                               
                               if (t === 'heatmap') {
                                 if (!o.visualMap) o.visualMap = { min: 0, max: 100, calculable: true, orient: 'horizontal', left: 'center', bottom: '0%' };
                                 // Heatmaps strictly require X and Y axes to be 'category' types
                                 if (!o.xAxis) o.xAxis = { type: 'category' };
                                 if (!o.yAxis) o.yAxis = { type: 'category' };

                                 if (Array.isArray(o.xAxis)) { o.xAxis.forEach((axis: any) => axis.type = 'category'); } 
                                 else { o.xAxis.type = 'category'; }

                                 if (Array.isArray(o.yAxis)) { o.yAxis.forEach((axis: any) => axis.type = 'category'); } 
                                 else { o.yAxis.type = 'category'; }
                               } else {
                                 delete o.visualMap;
                               }
                             }
                           })} 
                           className={`py-1.5 capitalize text-[11px] font-bold rounded border transition-colors ${
                              (parsedOption?.series?.[0]?.type === t || (t === 'area' && parsedOption?.series?.[0]?.areaStyle)) 
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                              : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                           }`}
                        >
                           {t}
                        </button>
                     ))}
                  </div>
                  <p className="text-[10px] text-[var(--text-tertiary)] font-medium mt-3 leading-relaxed bg-[var(--bg-elevated)] p-2 rounded border border-[var(--border-subtle)]">
                     <strong>Missing 3D/Maps/Trees?</strong> Advanced charts (like 3D Globe, Geo/Map, Sankey, Sunburst, or Tree) require specialized hierarchical or geographic datasets. To use them, prompt the <strong>AI Copilot</strong> directly, or paste config into the <strong>Raw JSON</strong> tab.
                  </p>
                </div>
                
                {/* Advanced Toolkit */}
                <div>
                  <h3 className="text-xs font-bold text-[var(--text-secondary)] mb-3 border-b border-[var(--border-subtle)] pb-1">Export Toolbox</h3>
                  <label className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)] cursor-pointer">
                     Enable Download/Save Menu
                     <div onClick={() => updateOption(o => { if(o.toolbox?.show === true){ delete o.toolbox; } else { o.toolbox = { show: true, feature: { saveAsImage: { show: true } } }; } })} className={`w-8 h-4 rounded-full flex items-center transition-colors px-0.5 ${parsedOption?.toolbox?.show === true ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                        <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${parsedOption?.toolbox?.show === true ? 'translate-x-4' : 'translate-x-0'}`} />
                     </div>
                  </label>
                </div>
             </div>
          ) : (
             <div className="flex-1 overflow-hidden flex flex-col bg-[#1e1e1e]">
                <div className="px-3 py-1.5 text-[10px] text-gray-400 bg-[#2d2d2d] flex justify-between">
                   <span>Advanced Mode (Live)</span>
                   <a href="https://echarts.apache.org/examples/en/index.html" target="_blank" className="text-indigo-400 hover:text-indigo-300">View ECharts Reference API</a>
                </div>
                <textarea 
                  value={chartConfigStr}
                  spellCheck={false}
                  onChange={e => setChartConfigStr(e.target.value)}
                  className="flex-1 w-full p-4 font-mono text-[12px] text-emerald-300 bg-transparent outline-none resize-none leading-relaxed"
                />
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
