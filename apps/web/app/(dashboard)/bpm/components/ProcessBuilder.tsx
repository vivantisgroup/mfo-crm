'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { 
  getBPMTemplates,
  BPMTemplate,
} from '@/lib/bpmService';
import { can } from '@/lib/rbacService';
import { toast } from 'sonner';

export default function ProcessBuilder() {
  const { user, tenant, authzContext: authz } = useAuth();
  const tenantId = tenant?.id;
  const [templates, setTemplates] = useState<BPMTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedTemplate, setSelectedTemplate] = useState<BPMTemplate | null>(null);

  useEffect(() => {
    if (tenantId && user) {
      loadData();
    }
  }, [tenantId, user]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (tenantId) {
        const tpls = await getBPMTemplates(tenantId);
        setTemplates(tpls);
        if (tpls.length > 0 && !selectedTemplate) {
          setSelectedTemplate(tpls[0]);
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'permission-denied') {
        toast.error('Insufficient permissions to view builder.');
      } else {
        toast.error('Failed to load process blueprints.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!can(authz, 'processes:design')) {
    return <div className="p-8 text-red-500">You do not have permission to design processes. Need processes:design role.</div>;
  }

  return (
    <div className="w-full flex flex-col h-[calc(100vh-200px)]">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Process Builder & AI Automation</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Design and configure business workflows, stages, and SLAs.</p>
        </div>
        <button 
          className="px-4 py-2 bg-[var(--brand-500)] text-white rounded-lg hover:opacity-90 transition shadow-sm text-sm font-medium"
        >
          + Create New Blueprint
        </button>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden min-h-0">
        
        {/* Sidebar: List of Blueprints */}
        <div className="w-1/3 bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] overflow-hidden flex flex-col shadow-sm">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-surface)] sticky top-0 font-semibold text-[var(--text-primary)]">
            Workflow Blueprints
          </div>
          <div className="p-3 space-y-2 overflow-y-auto">
            {loading ? (
               <div className="p-4 text-sm text-[var(--text-secondary)]">Loading...</div>
            ) : templates.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t)}
                className={`w-full text-left p-4 rounded-xl transition-all border ${
                  selectedTemplate?.id === t.id 
                    ? 'bg-[var(--brand-500)]/10 border-[var(--brand-500)]/50 shadow-inner' 
                    : 'hover:bg-[var(--bg-surface)] border-transparent'
                }`}
              >
                <div className="font-semibold text-[var(--text-primary)]">{t.name}</div>
                <div className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{t.description}</div>
                <div className="mt-3 text-[10px] font-mono tracking-wider font-bold bg-[var(--bg-surface)] border border-[var(--border)] inline-block px-2.5 py-1 rounded text-[var(--brand-500)]">
                  {t.stages.length} STAGES • v{t.version}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content: Stage Builder UI */}
        <div className="flex-[2] bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] overflow-hidden flex flex-col shadow-sm">
          {selectedTemplate ? (
            <>
              <div className="p-6 border-b border-[var(--border)] bg-[var(--bg-surface)]">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-2xl font-bold text-[var(--text-primary)]">{selectedTemplate.name}</h2>
                  <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-sm">Active</span>
                </div>
                <p className="text-[var(--text-secondary)]">{selectedTemplate.description}</p>
              </div>

              <div className="flex-1 p-6 overflow-y-auto">
                <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-6 border-b border-[var(--border)] pb-2">Pipeline Architecture</h3>

                <div className="space-y-4">
                  {selectedTemplate.stages.sort((a,b) => a.order - b.order).map((s, index) => (
                    <div key={s.id} className="relative pl-8">
                       {/* Line connector */}
                       {index !== selectedTemplate.stages.length - 1 && (
                         <div className="absolute left-[11px] top-8 bottom-[-24px] w-[2px] bg-[var(--brand-500)] opacity-20 z-0"></div>
                       )}
                       {/* Circle marker */}
                       <div className="absolute left-0 top-3 w-6 h-6 rounded-full bg-[var(--bg-surface)] border-2 border-[var(--brand-500)] flex items-center justify-center z-10 shadow-sm">
                         <span className="text-[10px] font-bold text-[var(--brand-500)]">{index + 1}</span>
                       </div>

                       <div className="bg-[var(--bg-surface)] p-5 rounded-xl border border-[var(--border)] shadow-sm ml-2 group hover:border-[var(--brand-500)] transition">
                          <div className="flex items-start justify-between">
                            <div>
                               <h4 className="font-semibold text-[var(--text-primary)] text-lg">{s.name}</h4>
                               <p className="text-sm text-[var(--text-secondary)] mt-1">{s.description || 'No description'}</p>
                            </div>
                            <button className="text-[var(--text-secondary)] hover:text-[var(--brand-500)] transition opacity-0 group-hover:opacity-100">
                               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </button>
                          </div>
                          
                          <div className="mt-5 grid grid-cols-2 gap-4">
                             <div className="bg-[var(--bg-canvas)] p-3 rounded-lg border border-[var(--border)]">
                               <span className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-widest block mb-1">Assigned Role Queue</span>
                               <span className="text-sm font-medium font-mono text-[var(--brand-500)]">{s.assignedRole || 'System / Auto'}</span>
                             </div>
                             <div className="bg-[var(--bg-canvas)] p-3 rounded-lg border border-[var(--border)]">
                               <span className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-widest block mb-1">SLA Target</span>
                               <span className="text-sm font-medium text-[var(--text-primary)]">
                                 {s.slaHours ? `${s.slaHours} Hours` : 'No rigid deadline'}
                               </span>
                             </div>
                          </div>
                          
                          {(s.requiresApproval || s.requiresDocuments) && (
                            <div className="mt-4 flex gap-2">
                              {s.requiresApproval && <span className="bg-orange-50 text-orange-700 dark:bg-orange-500/10 border border-orange-500/30 dark:text-orange-400 text-[10px] tracking-wider font-bold uppercase px-2.5 py-1 rounded">Requires Approval</span>}
                              {s.requiresDocuments && <span className="bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 border border-cyan-500/30 dark:text-cyan-400 text-[10px] tracking-wider font-bold uppercase px-2.5 py-1 rounded">Document Vault Req.</span>}
                            </div>
                          )}
                       </div>
                    </div>
                  ))}

                  <div className="pl-[42px] pt-6">
                    <button className="flex items-center gap-3 text-[var(--brand-500)] font-semibold transition group text-sm tracking-wide">
                      <div className="w-8 h-8 rounded-full bg-[var(--brand-500)]/10 flex items-center justify-center border border-[var(--brand-500)]/30 group-hover:bg-[var(--brand-500)]/20 transition">
                        +
                      </div>
                      Add Next Stage
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-secondary)] opacity-60">
              <svg className="w-16 h-16 opacity-30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
              Select a blueprint to configure architecture.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
