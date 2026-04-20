'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { 
  getBPMInstances, 
  getBPMTemplates, 
  BPMInstance, 
  BPMTemplate,
  startProcess,
  seedBPMTemplates,
  advanceStage
} from '@/lib/bpmService';
import { can } from '@/lib/rbacService';
import { toast } from 'sonner';

export default function ActiveWorkflows() {
  const { user, tenant, authzContext: authz } = useAuth();
  const tenantId = tenant?.id;
  const [instances, setInstances] = useState<BPMInstance[]>([]);
  const [templates, setTemplates] = useState<BPMTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [viewInstance, setViewInstance] = useState<BPMInstance | null>(null);

  useEffect(() => {
    if (tenantId && user) {
      loadData();
    }
  }, [tenantId, user]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (tenantId && user) {
        await seedBPMTemplates(tenantId, user.uid).catch(e => console.warn('BPM Templates seed error:', e));
        
        const [inst, tpls] = await Promise.all([
          getBPMInstances(tenantId),
          getBPMTemplates(tenantId)
        ]);
        setInstances(inst);
        setTemplates(tpls);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'permission-denied') {
        toast.error('Insufficient permissions to view workflows.');
      } else {
        toast.error('Failed to load workflows.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartProcess = async () => {
    if (!selectedTemplate || !tenantId || !user) return;
    try {
      await startProcess(tenantId, selectedTemplate, user.uid, { notes: 'Initialized from dashboard' });
      setShowModal(false);
      loadData();
      toast.success('Process started successfully');
    } catch (err: any) {
      console.error(err);
      toast.error('Error starting process: ' + err.message);
    }
  };

  if (!can(authz, 'processes:read')) {
    return <div className="p-8 text-red-500">You do not have permission to view processes.</div>;
  }

  const columns = ['active', 'on_hold', 'completed', 'cancelled'] as const;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Active Workflows</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Manage and track in-flight business processes.</p>
        </div>
        {can(authz, 'processes:write') && (
          <button 
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-[var(--brand-500)] text-white rounded-lg hover:opacity-90 transition shadow-sm text-sm font-medium"
          >
            + Start Process
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className="flex gap-6 overflow-x-auto pb-4">
          {columns.map(status => {
            const colInstances = instances.filter(i => i.status === status);
            return (
              <div key={status} className="flex-1 min-w-[300px] flex flex-col bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)] h-[calc(100vh-250px)] shadow-sm">
                <div className="flex items-center justify-between mb-4 px-1">
                  <h3 className="font-semibold text-[var(--text-secondary)] capitalize text-sm">{status.replace('_', ' ')}</h3>
                  <span className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-bold px-2 py-1 rounded-full">
                    {colInstances.length}
                  </span>
                </div>
                
                <div className="flex flex-col gap-3 overflow-y-auto pr-1">
                  {colInstances.map(instance => {
                    const template = templates.find(t => t.id === instance.templateId);
                    const currentStage = template?.stages.find(s => s.id === instance.currentStageId);
                    
                    return (
                      <div key={instance.id} className="bg-[var(--bg-surface)] p-4 rounded-lg border border-[var(--border)] hover:border-[var(--brand-500)] transition group shadow-sm">
                        <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--brand-500)] mb-1">{instance.templateName}</div>
                        <div className="text-sm text-[var(--text-primary)] font-medium mb-2">Stage: {currentStage?.name || 'Unknown'}</div>
                        <div className="flex items-center justify-between mt-3 text-xs text-[var(--text-secondary)]">
                          <span>Updated {new Date(instance.updatedAt).toLocaleDateString()}</span>
                          <button onClick={() => setViewInstance(instance)} className="text-[var(--brand-500)] font-semibold opacity-80 group-hover:opacity-100">&rarr; View</button>
                        </div>
                      </div>
                    )
                  })}

                  {colInstances.length === 0 && (
                    <div className="text-center py-8 text-xs font-medium text-[var(--text-secondary)] opacity-60">
                      Empty Phase
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Start New Process</h2>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Select Template</label>
              <select 
                className="w-full bg-[var(--bg-canvas)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl p-3 focus:ring-1 focus:ring-[var(--brand-500)] outline-none transition-shadow"
                value={selectedTemplate}
                onChange={e => setSelectedTemplate(e.target.value)}
              >
                <option value="">Select a workflow...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)] rounded-lg transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleStartProcess}
                disabled={!selectedTemplate}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand-500)] hover:opacity-90 rounded-lg disabled:opacity-50 transition shadow-sm"
              >
                Start Process
              </button>
            </div>
          </div>
        </div>
      )}

      {viewInstance && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl max-w-xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start mb-6">
               <div>
                  <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--brand-500)] mb-1">{viewInstance.templateName}</div>
                  <h2 className="text-2xl font-bold text-[var(--text-primary)]">Instance progression Details</h2>
               </div>
               <button onClick={() => setViewInstance(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-2xl leading-none">&times;</button>
            </div>
            
            <div className="space-y-4 mb-6">
               <div className="bg-[var(--bg-canvas)] p-4 rounded-xl border border-[var(--border)]">
                  <div className="text-sm text-[var(--text-secondary)] font-medium mb-1">Current Status</div>
                  <div className="text-lg font-bold text-[var(--text-primary)] capitalize">{viewInstance.status.replace('_', ' ')}</div>
               </div>

               {(() => {
                  const t = templates.find(temp => temp.id === viewInstance.templateId);
                  const currentStageIndex = t?.stages.findIndex(s => s.id === viewInstance.currentStageId) ?? -1;

                  return (
                    <div className="bg-[var(--bg-canvas)] p-4 rounded-xl border border-[var(--border)]">
                      <div className="text-sm text-[var(--text-secondary)] font-medium mb-4">Stage Progression</div>
                      <div className="space-y-1">
                         {t?.stages.sort((a,b)=> a.order - b.order).map((stage, idx) => (
                           <div key={stage.id} className="flex gap-4 items-start">
                             <div className="flex flex-col items-center mt-1">
                                <div className={`w-4 h-4 rounded-full flex-shrink-0 border-2 ${idx < currentStageIndex ? 'bg-emerald-500 border-emerald-500' : idx === currentStageIndex ? 'bg-amber-400 border-amber-400 animate-pulse' : 'bg-transparent border-[var(--border-strong)]'}`}></div>
                                {idx < (t.stages.length - 1) && <div className={`w-0.5 h-7 my-1 ${idx < currentStageIndex ? 'bg-emerald-500' : 'bg-[var(--border-strong)]'}`}></div>}
                             </div>
                             <div className="pb-4">
                                <div className={`text-sm tracking-tight ${idx === currentStageIndex ? 'font-bold text-[var(--text-primary)]' : idx < currentStageIndex ? 'font-medium text-emerald-600' : 'font-medium text-[var(--text-secondary)]'}`}>{stage.name}</div>
                                {idx === currentStageIndex && <div className="text-xs text-[var(--text-secondary)] mt-1">{stage.description || 'No description provided.'}</div>}
                             </div>
                           </div>
                         ))}
                      </div>
                      
                      {viewInstance.status === 'active' && currentStageIndex !== -1 && can(authz, 'processes:write') && (
                         <div className="mt-4 pt-4 border-t border-[var(--border)] flex justify-end">
                            <button 
                               onClick={async () => {
                                  if (!tenantId || !user) return;
                                  try {
                                    await advanceStage(tenantId, viewInstance.id!, user.uid);
                                    toast.success('Stage advanced successfully');
                                    setViewInstance(null);
                                    loadData();
                                  } catch (e: any) {
                                    toast.error(e.message || 'Error advancing stage');
                                  }
                               }}
                               className="px-4 py-2 text-sm font-bold bg-[var(--brand-500)] text-white hover:opacity-90 rounded-lg transition shadow-sm"
                            >
                               Mark Complete & Advance &rarr;
                            </button>
                         </div>
                      )}
                    </div>
                  );
               })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
