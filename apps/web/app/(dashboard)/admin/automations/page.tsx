'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { can } from '@/lib/rbacService';
import { getAutomations, saveAutomation, deleteAutomation, AutomationFlow, AutomationStep } from '@/lib/automationCoreService';
import { getConnectors, IntegrationConnector } from '@/lib/integrationCoreService';
import { getSystemCatalog } from '@/lib/customizationService';
import { Bot, Plus, Trash2, ArrowRight, Settings2, PlayCircle, Box, AlertCircle, X } from 'lucide-react';

export default function AutomationsPage() {
  const { tenant, authzContext } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [automations, setAutomations] = useState<AutomationFlow[]>([]);
  const [connectors, setConnectors] = useState<IntegrationConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [validCategories, setValidCategories] = useState<string[]>(['Banking', 'Compliance', 'Marketing', 'Data Provider']);

  // Editor State
  const [editingFlow, setEditingFlow] = useState<AutomationFlow | null>(null);

  useEffect(() => {
    if (authzContext) {
      setHasAccess(can(authzContext, 'admin:automations') || can(authzContext, 'admin:integrations'));
    }
  }, [authzContext]);

  const load = () => {
    if (tenant?.id && hasAccess) {
      setLoading(true);
      Promise.all([
        getAutomations(tenant.id),
        getConnectors(tenant.id),
        getSystemCatalog(tenant.id)
      ]).then(([flows, conns, cat]) => {
        setAutomations(flows);
        setConnectors(conns);
        if (cat?.hubCategories) setValidCategories(cat.hubCategories);
      }).finally(() => setLoading(false));
    }
  };

  useEffect(() => { load(); }, [tenant?.id, hasAccess]);

  const handleSaveFlow = async () => {
    if (!tenant?.id || !editingFlow) return;
    await saveAutomation(tenant.id, editingFlow);
    setEditingFlow(null);
    load();
  };

  const handleDeleteFlow = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tenant?.id) return;
    if (confirm('Delete this automation?')) {
      await deleteAutomation(tenant.id, id);
      load();
    }
  };

  const createBlankFlow = () => {
    setEditingFlow({
      id: 'flow_' + Math.random().toString(36).substr(2, 6),
      name: 'New Workflow',
      description: 'Describe what this automation handles.',
      icon: 'Bot',
      color: '#3b82f6',
      inputs: [],
      steps: [],
      createdAt: new Date().toISOString()
    });
  };

  const addInput = () => {
    if (!editingFlow) return;
    setEditingFlow({ ...editingFlow, inputs: [...editingFlow.inputs, { key: '', label: '' }] });
  };

  const addStep = () => {
    if (!editingFlow) return;
    setEditingFlow({
      ...editingFlow,
      steps: [...editingFlow.steps, { id: 'step_' + (editingFlow.steps.length + 1), type: 'api_connector', target: '', params: {} }]
    });
  };

  if (!hasAccess) {
    return <div className="p-10 text-center">⛔ Access Denied. Requires admin privileges.</div>;
  }

  if (editingFlow) {
    return (
      <div className="page-wrapper animate-fade-in w-full px-4 lg:px-8 pb-32">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setEditingFlow(null)} className="btn btn-secondary text-xs">← Back to Hub</button>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-brand-900">Workflow Designer</h1>
          </div>
          <button onClick={handleSaveFlow} className="btn btn-primary flex items-center gap-2 font-semibold">
            Save Automation
          </button>
        </div>

        <div className="flex flex-col gap-8 max-w-4xl">
          {/* Metadata */}
          <div className="card p-6" style={{ borderTop: `4px solid ${editingFlow.color}` }}>
             <h3 className="text-sm font-bold text-slate-800 uppercase mb-4">1. Hub Metadata</h3>
             <div className="flex gap-4 mb-4">
               <div className="flex-1">
                 <label className="text-xs font-semibold mb-1 block">Workflow ID</label>
                 <input className="input w-full font-mono text-xs" value={editingFlow.id} readOnly />
               </div>
               <div className="flex-1">
                 <label className="text-xs font-semibold mb-1 block">App Store Name</label>
                 <input className="input w-full" value={editingFlow.name} onChange={e => setEditingFlow({...editingFlow, name: e.target.value})} />
               </div>
               <div className="flex-1">
                 <label className="text-xs font-semibold mb-1 block">Color Hex</label>
                 <input type="color" className="w-full h-[38px] p-1 border rounded" value={editingFlow.color} onChange={e => setEditingFlow({...editingFlow, color: e.target.value})} />
               </div>
               <div className="flex-1">
                 <label className="text-xs font-semibold mb-1 block">Category Label</label>
                 <select className="input w-full" value={editingFlow.category || ''} onChange={e => setEditingFlow({...editingFlow, category: e.target.value})}>
                   <option value="">No Category</option>
                   {validCategories.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
               </div>
             </div>
             <div>
               <label className="text-xs font-semibold mb-1 block">Description</label>
               <input className="input w-full" value={editingFlow.description} onChange={e => setEditingFlow({...editingFlow, description: e.target.value})} />
             </div>
          </div>

          {/* Inputs Schema */}
          <div className="card p-6 bg-slate-50">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-sm font-bold text-slate-800 uppercase m-0">2. Input Parameters Schema</h3>
               <button onClick={addInput} className="text-xs btn btn-secondary py-1 px-2 flex items-center gap-1">+ Add Required Input</button>
             </div>
             <p className="text-[11px] text-tertiary mb-4">Define properties the CRM record must map into this workflow before starting (e.g. <code>customer_id</code>).</p>
             
             {editingFlow.inputs.map((inp, i) => (
                <div key={i} className="flex gap-4 mb-2 items-center bg-white p-3 rounded border border-slate-200">
                  <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-1 rounded">{'{{'}inputs.{inp.key || 'key'}{'}}'}</span>
                  <div className="flex-1">
                    <input placeholder="Key (e.g. email)" className="input w-full font-mono text-xs" value={inp.key} onChange={e => {
                       const newI = [...editingFlow.inputs]; newI[i].key = e.target.value.replace(/[^a-zA-Z0-9_]/g, ''); setEditingFlow({...editingFlow, inputs: newI});
                    }} />
                  </div>
                  <div className="flex-1">
                    <input placeholder="Human Label" className="input w-full text-xs" value={inp.label} onChange={e => {
                       const newI = [...editingFlow.inputs]; newI[i].label = e.target.value; setEditingFlow({...editingFlow, inputs: newI});
                    }} />
                  </div>
                  <button onClick={() => {
                     const newI = [...editingFlow.inputs]; newI.splice(i, 1); setEditingFlow({...editingFlow, inputs: newI});
                  }} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                </div>
             ))}
             {editingFlow.inputs.length === 0 && <div className="text-center text-xs text-slate-400 italic">No inputs required. Variables like {'{{SYSTEM_DATE}}'} are always available.</div>}
          </div>

          {/* Steps */}
          <div className="card p-6">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-sm font-bold text-slate-800 uppercase m-0">3. Execution Pipeline</h3>
             </div>
             
             <div className="flex flex-col gap-6">
               {editingFlow.steps.map((step, i) => (
                 <div key={step.id} className="relative border-2 border-slate-100 rounded-xl p-4 bg-white shadow-sm">
                    {i > 0 && <div className="absolute -top-6 left-8 h-6 w-0 border-l-2 border-dashed border-slate-300"></div>}
                    
                    <div className="flex justify-between items-start mb-4">
                       <div className="flex items-center gap-2">
                         <div className="bg-brand-50 text-brand-600 font-bold rounded-full w-6 h-6 flex items-center justify-center text-xs">{(i+1)}</div>
                         <h4 className="font-semibold text-sm">Action: {step.id}</h4>
                       </div>
                       <button onClick={() => {
                         const nSteps = [...editingFlow.steps]; nSteps.splice(i, 1); setEditingFlow({...editingFlow, steps: nSteps});
                       }} className="text-slate-400 hover:text-red-500"><X size={16}/></button>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded p-4 flex flex-col gap-4">
                       <div className="flex gap-4">
                         <div className="flex-1">
                           <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Target API Connector</label>
                           <select className="input w-full text-sm" value={step.target} onChange={e => {
                             const nSteps = [...editingFlow.steps]; nSteps[i].target = e.target.value; setEditingFlow({...editingFlow, steps: nSteps});
                           }}>
                             <option value="">Select Connector Endpoint...</option>
                             {connectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                           </select>
                         </div>
                       </div>

                       <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Payload Variables (JSON Mapping)</label>
                          <textarea 
                             className="input w-full font-mono text-[11px]" 
                             rows={4}
                             placeholder={`{\n  "customerId": "{{inputs.email}}"\n}`}
                             value={JSON.stringify(step.params || {}, null, 2)}
                             onBlur={e => {
                               try {
                                 const parsed = JSON.parse(e.target.value);
                                 const nSteps = [...editingFlow.steps]; nSteps[i].params = parsed; setEditingFlow({...editingFlow, steps: nSteps});
                               } catch(e) {}
                             }}
                          />
                          <p className="text-[10px] text-tertiary mt-1">Bind input context to the Integration. E.g. <code>{`"search": "{{inputs.query}}"`}</code> or <code>{`"prev_id": "{{steps.step_1.data.id}}"`}</code></p>
                       </div>
                    </div>
                 </div>
               ))}

               <button onClick={addStep} className="btn border border-dashed border-slate-300 text-slate-600 w-full py-4 flex items-center justify-center gap-2 hover:bg-slate-50 hover:text-brand-600 transition">
                 <Plus size={18} /> Add Next Step
               </button>
             </div>
          </div>
          
          <div className="card p-6 bg-slate-50">
             <h3 className="text-sm font-bold text-slate-800 uppercase mb-4">4. Pipeline Output</h3>
             <label className="text-xs font-semibold mb-1 block">Return Data Path (Optional)</label>
             <input className="input w-full font-mono text-xs" placeholder="e.g. steps.step_2.data" value={editingFlow.outputKey || ''} onChange={e => setEditingFlow({...editingFlow, outputKey: e.target.value})} />
             <p className="text-[10px] text-tertiary mt-1">If blank, the API will return the full context JSON (all inputs and all step responses).</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper animate-fade-in w-full px-4 lg:px-8 pb-20">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><PlayCircle className="text-emerald-500" /> Automation Hub</h1>
          <p className="text-secondary mt-2">Construct scalable workflow actions leveraging Integrations, publishable onto CRM profiles.</p>
        </div>
        <button onClick={createBlankFlow} className="btn btn-primary shadow-sm hover:shadow flex items-center gap-2">
          <Plus size={16} /> Create Workspace Flow
        </button>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 p-20 animate-pulse">Loading Hub...</div>
      ) : automations.length === 0 ? (
        <div className="card p-16 text-center border-dashed border-2 flex flex-col items-center">
          <Box size={48} className="text-slate-300 mb-4" />
          <h2 className="text-lg font-bold text-slate-700">App Store Empty</h2>
          <p className="text-slate-500 text-sm mt-2 max-w-md">You haven't built any zero-code workflows yet. Automations stitch APIs together and can be activated via UI Buttons across the CRM.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-6 border-b pb-4 overflow-x-auto">
             <button 
               onClick={() => setActiveCategory('All')} 
               className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${activeCategory === 'All' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
             >
               All Workflows
             </button>
             {Array.from(new Set(automations.map(a => a.category).filter(Boolean))).map(cat => (
               <button 
                 key={cat}
                 onClick={() => setActiveCategory(cat as string)} 
                 className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${activeCategory === cat ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
               >
                 {cat}
               </button>
             ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {automations.filter(a => activeCategory === 'All' || a.category === activeCategory).map(f => (
              <div key={f.id} onClick={() => setEditingFlow(f)} className="card hover:shadow-md transition cursor-pointer overflow-hidden border border-slate-200 relative">
                 <div className="h-2 w-full" style={{ background: f.color || '#3b82f6' }}></div>
                 {f.category && <span className="absolute top-4 right-4 text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-2 py-1 rounded">{f.category}</span>}
                 <div className="p-6">
                   <div className="flex justify-between items-start mb-4">
                     <div className="p-3 rounded-xl" style={{ background: `${f.color}15`, color: f.color }}>
                       <Bot size={24} />
                     </div>
                     <button onClick={(e) => handleDeleteFlow(f.id, e)} className="text-slate-300 hover:text-red-500 transition"><Trash2 size={16}/></button>
                   </div>
                   <h3 className="font-bold text-slate-800 text-lg mr-10">{f.name}</h3>
                   <p className="text-xs text-slate-500 mt-1 line-clamp-2 min-h-[32px]">{f.description}</p>
                   
                   <div className="mt-6 flex flex-wrap gap-2">
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">ID: {f.id}</span>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{f.steps?.length || 0} Steps</span>
                   </div>
                 </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
