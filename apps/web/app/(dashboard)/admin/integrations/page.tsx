'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { can } from '@/lib/rbacService';
import { getConnectors, saveConnector, deleteConnector, IntegrationConnector, getVaultCredentials, VaultCredential } from '@/lib/integrationCoreService';
import { getSystemCatalog } from '@/lib/customizationService';
import { uploadAttachment } from '@/lib/attachmentService';
import JsonTreeViewer from '@/components/JsonTreeViewer';
import { PlugZap, Plus, Trash2, Edit2, PlayCircle, Lock, Bot, Sparkles, CheckCircle, Server, Activity, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

export default function IntegrationsPage() {
  const { tenant, authzContext } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [connectors, setConnectors] = useState<IntegrationConnector[]>([]);
  const [vaultSecrets, setVaultSecrets] = useState<VaultCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<IntegrationConnector>>({ method: 'GET' });
  const [testing, setTesting] = useState(false);
  const [testOutput, setTestOutput] = useState<any>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [validCategories, setValidCategories] = useState<string[]>(['Banking', 'Compliance', 'Marketing', 'Data Provider']);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const payloadRef = useRef<HTMLTextAreaElement>(null);
  const [hasPayload, setHasPayload] = useState(false);
  const [wizardPrompt, setWizardPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState('');
  const [wizardTestResults, setWizardTestResults] = useState<Record<string, any>>({});
  const [wizardTestContexts, setWizardTestContexts] = useState<Record<string, Record<string, string>>>({});
  const [wizardHistory, setWizardHistory] = useState<{role: 'user'|'assistant', content: string}[]>([]);
  const [wizardRefinePrompt, setWizardRefinePrompt] = useState('');
  // Wizard States
  const [extractedEndpoints, setExtractedEndpoints] = useState<{ 
    id: string, name: string, method: string, url: string, selected: boolean, vaultId?: string,
    authRequired?: boolean, dataPath?: string, recommendedDataPath?: string, dataPathOptions?: string[], labelField?: string, valueField?: string,
    description?: string, usage?: string, tags?: string[], logoUrl?: string
  }[]>([]);
  const [wizardServer, setWizardServer] = useState('');
  const [wizardTitle, setWizardTitle] = useState('');

  useEffect(() => {
    if (authzContext) {
      setHasAccess(can(authzContext, 'admin:integrations'));
    }
  }, [authzContext]);

  const load = () => {
    if (tenant?.id && hasAccess) {
      setLoading(true);
      Promise.all([
        getConnectors(tenant.id),
        getVaultCredentials(tenant.id),
        getSystemCatalog(tenant.id)
      ]).then(([c, v, cat]) => {
        setConnectors(c);
        setVaultSecrets(v);
        if (cat && cat.hubCategories) setValidCategories(cat.hubCategories);
      }).finally(() => setLoading(false));
    }
  };

  useEffect(() => { load(); }, [tenant?.id, hasAccess]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    const conn: any = {
      id: form.id || 'ext_' + Math.random().toString(36).substr(2, 6),
      name: form.name || 'Unnamed Connector',
      url: form.url || '',
      method: form.method as any,
    };
    if (form.category) conn.category = form.category;
    if (form.vaultId) conn.vaultId = form.vaultId;
    if (form.dataPath) conn.dataPath = form.dataPath;
    if (form.labelField) conn.labelField = form.labelField;
    if (form.valueField) conn.valueField = form.valueField;
    if (form.logoUrl) conn.logoUrl = form.logoUrl;
    
    await saveConnector(tenant.id, conn);
    setShowForm(false);
    setIsEditing(false);
    setForm({ method: 'GET' });
    setTestOutput(null);
    setWizardStep(1);
    load();
  };

  const handleEdit = (conn: IntegrationConnector) => {
    setForm(conn);
    setIsEditing(true);
    setWizardStep(4);
    setShowForm(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !tenant?.id) return;
    setIsUploadingLogo(true);
    try {
       const file = e.target.files[0];
       const result = await uploadAttachment(tenant.id, file);
       setForm(prev => ({ ...prev, logoUrl: result.url }));
    } catch (err: any) {
       toast.error("Upload failed: " + err.message);
    } finally {
       setIsUploadingLogo(false);
    }
  };

  const generateConnectorAI = async () => {
    setIsAiLoading(true);
    setWizardTestResults({});
    setWizardHistory([]);
    try {
      setAiStatusMessage("Analyzing Request...");
      
      const pText = payloadRef.current?.value || '';

      if (pText.trim().startsWith('{')) {
         handleWizardParse(pText);
      } else {
         setAiStatusMessage("Consulting remote LLM...");
         const queryParams = wizardPrompt || pText;
         const res = await fetch('/api/integrations/ai-wizard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: queryParams, tenantId: tenant?.id })
         });
         const data = await res.json();
         if (!res.ok) throw new Error(data.error || 'LLM generation failed');
         
         setWizardHistory([{ role: 'user', content: queryParams }, { role: 'assistant', content: data.swagger }]);
         setAiStatusMessage("Synthesizing Swagger Payload schema...");
         handleWizardParse(data.swagger);
      }
    } catch (err: any) {
      toast.error("AI Generation Error: " + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const generateRefinementAI = async () => {
    if (!wizardRefinePrompt.trim()) return;
    setIsAiLoading(true);
    try {
        setAiStatusMessage("Refining endpoints with LLM...");
        const res = await fetch('/api/integrations/ai-wizard', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ prompt: wizardRefinePrompt, tenantId: tenant?.id, history: wizardHistory })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'LLM generation failed');
        
        setWizardHistory(prev => [...prev, { role: 'user', content: wizardRefinePrompt }, { role: 'assistant', content: data.swagger }]);
        setWizardRefinePrompt("");
        setAiStatusMessage("Synthesizing refined schema...");
        handleWizardParse(data.swagger);
    } catch (err: any) {
        toast.error("AI Refinement Error: " + err.message);
    } finally {
        setIsAiLoading(false);
    }
  };

  const handleWizardParse = (payloadStr: string) => {
    try {
      const parsed = JSON.parse(payloadStr);
      const paths = parsed.paths;
      if (!paths) throw new Error("No paths array found in OpenAPI JSON");
      
      const server = parsed.servers?.[0]?.url || 'https://api.example.com';
      let extractedLogo = parsed.info?.['x-logo']?.url || parsed.info?.logo?.url || '';
      if (!extractedLogo && server.startsWith('http')) {
         try { extractedLogo = `https://icon.horse/icon/${new URL(server).hostname.replace('www.', '').replace('api.', '')}`; } catch(e){}
      }
      
      setWizardTitle(parsed.info?.title || 'OpenAPI Import');
      setWizardServer(server);

      const endpoints: any[] = [];
      Object.keys(paths).forEach(route => {
         Object.keys(paths[route]).forEach(method => {
            const op = paths[route][method];
            endpoints.push({
               id: (op.operationId || method + '_' + route.replace(/[^a-zA-Z0-9]/g, '')).toLowerCase().substring(0, 30),
               name: op.summary || `${method.toUpperCase()} ${route}`,
               method: method.toUpperCase(),
               url: server + route,
               logoUrl: extractedLogo,
               selected: true,
               vaultId: '',
               authRequired: !!op.security || !!parsed.security,
               dataPath: op['x-mfo-datapath'] || '',
               recommendedDataPath: op['x-mfo-datapath'] || '',
               dataPathOptions: Array.isArray(op['x-mfo-datapath-options']) ? op['x-mfo-datapath-options'].filter(Boolean) : [],
               labelField: op['x-mfo-labelfield'] || '',
               valueField: op['x-mfo-valuefield'] || '',
               description: op['x-mfo-description'] || '',
               usage: op['x-mfo-usage'] || '',
               tags: Array.isArray(op['x-mfo-tags']) ? op['x-mfo-tags'] : []
            });
         });
      });
      setExtractedEndpoints(endpoints);
      setWizardStep(2);
    } catch(err: any) {
      toast.error("Analysis Failed: " + err.message);
    }
  };

  const prepareWizardTests = () => {
    setWizardStep(3);
  };

  const runWizardTestSingle = async (ep: any) => {
    if (!tenant?.id) return;
    
    // Mark as running
    setWizardTestResults(prev => ({ ...prev, [ep.id]: null }));
    
    try {
      const conn = { url: ep.url, method: ep.method, vaultId: ep.vaultId };
      const ctx = wizardTestContexts[ep.id] || {};
      
      const res = await fetch('/api/integrations/proxy', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ tenantId: tenant.id, testConnector: conn, dynamicContext: ctx })
      });
      const data = await res.json();
      setWizardTestResults(prev => ({ ...prev, [ep.id]: { ok: res.ok, data } }));
    } catch (err: any) {
      setWizardTestResults(prev => ({ ...prev, [ep.id]: { ok: false, data: { error: err.message } } }));
    }
  };

  const handleBatchImport = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    const toImport = extractedEndpoints.filter(e => e.selected);
    for (const ep of toImport) {
       const conn = {
         id: 'ext_' + ep.id + '_' + Math.random().toString(36).substr(2, 4),
         name: ep.name,
         url: ep.url,
         method: ep.method as any,
         vaultId: ep.vaultId,
         logoUrl: ep.logoUrl,
         dataPath: ep.dataPath,
         labelField: ep.labelField,
         valueField: ep.valueField,
         description: ep.description,
         usage: ep.usage,
         tags: ep.tags,
         isAiGenerated: true
       } as any as IntegrationConnector;
       await saveConnector(tenant.id, conn);
    }
    setWizardStep(4);
    setLoading(false);
  };

  const handleTest = async () => {
    if (!tenant?.id) return;
    setTesting(true);
    setTestOutput(null);
    try {
      const conn = {
        url: form.url || '',
        method: form.method || 'GET',
        vaultId: form.vaultId,
        dataPath: form.dataPath,
        labelField: form.labelField,
        valueField: form.valueField
      };
      const res = await fetch('/api/integrations/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          testConnector: conn,
          dynamicContext: { id: 'TEST_ID', query: 'TEST_QUERY', SYSTEM_DATE: new Date().toISOString().split('T')[0] } 
        })
      });
      const data = await res.json();
      setTestOutput(data);
    } catch (err: any) {
      setTestOutput({ error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!tenant?.id) return;
    if (confirm('Are you sure you want to delete this integration connector?')) {
      await deleteConnector(tenant.id, id);
      load();
    }
  };

  if (!hasAccess) {
    return <div className="p-10 text-center">⛔ Access Denied. Requires 'admin:integrations' permission.</div>;
  }

  return (
    <div className="page-wrapper animate-fade-in w-full px-4 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><PlugZap className="text-brand-500" /> Integration Hub</h1>
          <p className="text-secondary mt-1">Configure external API endpoints to be utilized within Data Models and Layouts.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowWizard(true)} className="btn btn-secondary btn-sm flex items-center gap-2 bg-slate-800 text-white hover:bg-slate-900 border-none">
             OpenAPI / AI Wizard
          </button>
          <button onClick={() => setShowForm(true)} className="btn btn-primary btn-sm flex items-center gap-2"><Plus size={16} /> New Connector</button>
        </div>
      </div>

      {showWizard && (
        <div className="card p-6 mb-6 rounded-lg bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 shadow-sm transition-all duration-500 overflow-hidden relative">
           {isAiLoading && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                 <div className="relative">
                   <Bot size={48} className="text-indigo-600 animate-pulse" />
                   <Sparkles size={20} className="text-amber-500 absolute -top-2 -right-2 animate-bounce" />
                 </div>
                 <h3 className="text-indigo-900 font-bold mt-4 animate-pulse">{aiStatusMessage}</h3>
              </div>
           )}

           <div className="flex justify-between items-center mb-6 border-b border-indigo-200/50 pb-4">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-md">
                 <Bot size={24} />
               </div>
               <div>
                 <h3 className="text-base font-bold text-indigo-950 flex items-center gap-2">Data Integration Specialist</h3>
                 <p className="text-xs text-indigo-600/80 font-medium">Design &rarr; Map &rarr; Test &rarr; Publish</p>
               </div>
             </div>
             
             {/* Stepper Dots */}
             <div className="flex gap-2 items-center px-4 py-2 bg-white/50 rounded-full shadow-inner border border-indigo-100">
                {[1,2,3,4].map(s => (
                  <div key={s} className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${wizardStep === s ? 'w-6 bg-indigo-600' : wizardStep > s ? 'bg-indigo-300' : 'bg-slate-300'}`} />
                ))}
             </div>

             <button onClick={() => {
                setShowWizard(false); 
                setExtractedEndpoints([]); 
                setWizardStep(1); 
                if (payloadRef.current) payloadRef.current.value = '';
                setHasPayload(false);
                setWizardPrompt('');
             }} className="btn btn-secondary bg-white text-slate-500 hover:text-red-500 border-none shadow-sm btn-sm px-2"><Trash2 size={16}/></button>
           </div>
           
           {/* STEP 1: PROMPT */}
           {wizardStep === 1 && (
             <div className="animate-fade-in space-y-4">
               <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-50 flex gap-4 text-sm text-slate-700">
                 <div className="mt-1"><Bot className="text-indigo-400" size={20}/></div>
                 <p>Hello! I can automatically wire endpoints, map Authentication Vault secrets, and build the Connector logic. <strong>What external service are we integrating today?</strong> You can describe it to me or paste the OpenAPI JSON schema directly.</p>
               </div>
               
               <div>
                 <label className="text-xs font-bold text-indigo-900 mb-1 block">Describe what you need</label>
                 <input 
                   className="input w-full shadow-inner border-indigo-100 focus:border-indigo-400 focus:ring-indigo-100" 
                   placeholder="e.g. Fetch live currency rates from the European Central Bank..." 
                   value={wizardPrompt} onChange={e => setWizardPrompt(e.target.value)}
                 />
               </div>
               
               <div>
                 <label className="text-xs font-bold text-indigo-900 mb-1 block">Or Paste OpenAPI / Swagger Definition (Optional)</label>
                 <textarea 
                   ref={payloadRef}
                   className="input w-full font-mono text-[10px] shadow-inner border-indigo-100 max-h-32 focus:border-indigo-400 focus:ring-indigo-100" rows={4} 
                   placeholder={`{ "openapi": "3.0.0", "info": { "title": "Example Bank API" }, "paths": { "/v1/balance": { "get": {} } } }`}
                   onChange={e => setHasPayload(e.target.value.trim().length > 0)}
                 />
               </div>
               <div className="flex justify-end pt-2">
                 <button onClick={generateConnectorAI} disabled={!wizardPrompt.trim() && !hasPayload} className="btn bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-md gap-2 font-bold disabled:opacity-50">
                    <Sparkles size={16} /> Generate Connector Specs
                 </button>
               </div>
             </div>
           )}

           {/* STEP 2: DESIGN & MAP */}
           {wizardStep === 2 && (
             <div className="animate-fade-in mt-2">
               <div className="bg-white px-4 py-3 rounded-lg shadow-sm border border-emerald-100 flex items-center justify-between mb-4">
                 <div>
                   <h4 className="font-bold text-sm text-slate-800">Source: {wizardTitle}</h4>
                   <p className="text-[11px] text-slate-500 font-mono mt-0.5"><Server size={10} className="inline mr-1" />{wizardServer}</p>
                 </div>
                 <div className="text-xs font-bold text-emerald-600 border border-emerald-200 bg-emerald-50 px-2 py-1 rounded-md">
                    {extractedEndpoints.length} Endpoints Analyzed
                 </div>
               </div>
               
               <p className="text-xs text-indigo-800 mb-2 font-medium">Please review these bindings. Uncheck any operations you don't need, and optionally attach a Vault Credential for authentication.</p>
               
               <div className="max-h-[250px] overflow-y-auto border border-indigo-100 rounded-lg bg-white shadow-inner divide-y divide-slate-100">
                 {extractedEndpoints.map((ep, idx) => (
                    <div key={idx} className={`flex flex-col gap-2 p-3 border-b last:border-b-0 transition-colors ${ep.selected ? 'bg-indigo-50/30' : 'bg-slate-50 opacity-60 grayscale'}`}>
                       <div className="flex gap-3 items-center">
                         <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded border-slate-300 ml-1" checked={ep.selected} onChange={e => {
                            const n = [...extractedEndpoints];
                            n[idx].selected = e.target.checked;
                            setExtractedEndpoints(n);
                         }} />
                         <span className={`text-[10px] w-12 text-center font-bold px-2 py-1 rounded shadow-sm ${ep.method === 'GET' ? 'bg-sky-100 text-sky-800 border border-sky-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
                           {ep.method}
                         </span>
                         <div className="flex-1 min-w-0">
                           <div className="text-xs font-bold text-slate-800">{ep.name}</div>
                           <div className="text-[10px] font-mono text-slate-500 truncate mt-0.5">{ep.url}</div>
                         </div>
                         {ep.selected && (
                           <div className="w-48 mr-2 relative">
                             {ep.authRequired && !ep.vaultId && <div className="absolute -top-4 right-0 text-[9px] font-bold text-red-500 animate-pulse">Auth Required!</div>}
                             <select className={`input w-full text-[10px] py-1 h-7 shadow-sm ${ep.authRequired && !ep.vaultId ? 'bg-red-50 border-red-300 text-red-700' : 'bg-white'}`} value={ep.vaultId || ''} onChange={e => {
                                const n = [...extractedEndpoints];
                                n[idx].vaultId = e.target.value;
                                setExtractedEndpoints(n);
                             }}>
                                <option value="">No Auth (Public)</option>
                                {vaultSecrets.map(v => <option key={v.id} value={v.id}>🔐 {v.name} ({v.type})</option>)}
                             </select>
                           </div>
                         )}
                       </div>
                       
                       {ep.selected && (
                         <div className="pl-9 pr-2 pt-1 flex gap-2">
                            <div className="flex-1">
                               <label className="text-[9px] font-bold text-indigo-400 uppercase">Data Path (Optional)</label>
                               <input className="input h-6 text-[10px] w-full mb-1" placeholder="e.g. value or data.items" value={ep.dataPath || ''} onChange={e => {
                                  const n = [...extractedEndpoints]; n[idx].dataPath = e.target.value; setExtractedEndpoints(n);
                               }} />
                               {ep.dataPathOptions && ep.dataPathOptions.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {ep.dataPathOptions.map(opt => {
                                      const isRec = ep.recommendedDataPath === opt;
                                      return (
                                        <button key={opt} onClick={() => {
                                            const n = [...extractedEndpoints]; n[idx].dataPath = opt; setExtractedEndpoints(n);
                                        }} className={`text-[8px] px-1.5 py-0.5 rounded border transition-colors ${isRec ? 'bg-indigo-100 border-indigo-200 text-indigo-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                                          {opt === '' ? '(root)' : opt} {isRec && '★'}
                                        </button>
                                      )
                                    })}
                                  </div>
                               )}
                            </div>
                            <div className="flex-1">
                               <label className="text-[9px] font-bold text-indigo-400 uppercase">Label Field (Optional)</label>
                               <input className="input h-6 text-[10px] w-full" placeholder="e.g. name or description" value={ep.labelField || ''} onChange={e => {
                                  const n = [...extractedEndpoints]; n[idx].labelField = e.target.value; setExtractedEndpoints(n);
                               }} />
                            </div>
                            <div className="flex-1">
                               <label className="text-[9px] font-bold text-indigo-400 uppercase">Value Field (Optional)</label>
                               <input className="input h-6 text-[10px] w-full" placeholder="e.g. id" value={ep.valueField || ''} onChange={e => {
                                  const n = [...extractedEndpoints]; n[idx].valueField = e.target.value; setExtractedEndpoints(n);
                               }} />
                            </div>
                         </div>
                       )}
                    </div>
                 ))}
               </div>
                <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 mt-4">
                 <label className="text-[10px] font-bold text-indigo-900 block mb-1">Make Changes with AI</label>
                 <div className="flex gap-2">
                   <input 
                      className="input h-8 text-xs flex-1 bg-white border-indigo-200 focus:border-indigo-400" 
                      placeholder="e.g. 'Remove the auth requirement, this is public data' or 'Add a POST method'"
                      value={wizardRefinePrompt}
                      onChange={e => setWizardRefinePrompt(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && generateRefinementAI()}
                   />
                   <button onClick={generateRefinementAI} disabled={!wizardRefinePrompt.trim() || isAiLoading} className="btn h-8 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs border-none shadow-sm disabled:opacity-50">
                     Refine &rarr;
                   </button>
                 </div>
               </div>
               <div className="flex justify-between items-center mt-6">
                 <button onClick={() => setWizardStep(1)} className="btn btn-secondary text-xs bg-white text-slate-600 shadow-sm border-slate-200">← Back to Prompt</button>
                 <button onClick={prepareWizardTests} disabled={extractedEndpoints.filter(e => e.selected).length === 0} className="btn bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-md gap-2 font-bold px-6">
                   Proceed to Testing Phase &rarr; 
                 </button>
               </div>
             </div>
           )}

           {/* STEP 3: TESTING */}
           {wizardStep === 3 && (
             <div className="animate-fade-in mt-2">
               <p className="text-sm text-indigo-900 mb-4 bg-white p-3 border border-indigo-100 rounded-md font-medium flex items-center gap-2">
                 <Activity size={18} className="text-indigo-500" /> Ping results against your selected endpoints.
                 </p>
                <div className="max-h-[450px] overflow-y-auto space-y-4 pr-2">
                 {extractedEndpoints.filter(e => e.selected).map(ep => {
                    const res = wizardTestResults[ep.id];
                    const isOk = res?.ok;
                    
                    // Extract variables like {var} or {{var}}
                    const matches = [...ep.url.matchAll(/\{([^}]+)\}/g), ...ep.url.matchAll(/\{\{\s*(.*?)\s*\}\}/g)];
                    const variables = Array.from(new Set(matches.map(m => m[1])));
                    
                    return (
                      <div key={ep.id} className={`border rounded-lg bg-white shadow-sm overflow-hidden ${res === undefined ? 'border-slate-200' : res === null ? 'border-indigo-200 animate-pulse' : (isOk ? 'border-emerald-200' : 'border-red-200')}`}>
                         <div className="p-3 border-b flex justify-between items-start bg-slate-50/50">
                            <div className="flex-1 min-w-0 pr-4">
                               <div className="flex items-center gap-2 mb-1">
                                 <span className={`text-[10px] w-12 text-center font-bold px-2 py-0.5 rounded shadow-sm ${ep.method === 'GET' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'}`}>{ep.method}</span>
                                 {res && isOk && <span className="text-emerald-600 flex items-center gap-1 text-[10px] font-bold bg-emerald-50 px-2 py-0.5 rounded"><CheckCircle size={12}/> PASS</span>}
                                 {res && !isOk && <span className="text-red-500 text-[10px] font-bold bg-red-50 px-2 py-0.5 rounded">FAIL</span>}
                               </div>
                               <div className="text-xs font-mono text-slate-700 break-all">{ep.url}</div>
                            </div>
                            <div className="shrink-0 flex items-center">
                               <button onClick={() => runWizardTestSingle(ep)} disabled={res === null} className="btn btn-sm bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 gap-1 text-xs">
                                  <PlayCircle size={14} /> {res === null ? 'Pinging...' : res ? 'Re-test' : 'Ping Api'}
                               </button>
                            </div>
                         </div>
                         
                         {variables.length > 0 && (
                           <div className="p-3 border-b bg-canvas/30">
                             <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Request Parameters</p>
                             <div className="flex gap-2 flex-wrap">
                               {variables.map(v => (
                                 <div key={v} className="flex items-center gap-2">
                                   <span className="text-xs font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border">{"{{"}{v}{"}}"}</span>
                                   <input 
                                      className="input h-6 text-xs w-32 py-0" 
                                      placeholder="Value" 
                                      value={wizardTestContexts[ep.id]?.[v] || ''}
                                      onChange={e => setWizardTestContexts({...wizardTestContexts, [ep.id]: {...(wizardTestContexts[ep.id]||{}), [v]: e.target.value}})}
                                   />
                                 </div>
                               ))}
                             </div>
                           </div>
                         )}

                         {res && !isOk && (
                            <div className="p-3 text-[10px] font-mono text-red-600 bg-red-50/50 break-all whitespace-pre-wrap max-h-32 overflow-y-auto">
                               {res.data?.message || res.data?.details || res.data?.error || JSON.stringify(res.data).substring(0, 150)}
                            </div>
                         )}
                         
                         {res && isOk && (
                            <div className="px-3 py-2 bg-slate-800 text-slate-300">
                               <JsonTreeViewer data={res.data.data?.[0]?.raw || res.data} />
                            </div>
                         )}
                      </div>
                    )
                 })}
               </div>
               
               <div className="flex justify-between items-center mt-6">
                 <div>
                   <button onClick={() => setWizardStep(1)} className="btn btn-secondary text-xs bg-white text-slate-500 shadow-sm border-slate-200 mr-2 hover:bg-slate-50">← Refine Prompt</button>
                   <button onClick={() => setWizardStep(2)} className="btn btn-secondary text-xs bg-white text-slate-600 shadow-sm border-slate-200">← Edit Configuration</button>
                 </div>
                 <button onClick={handleBatchImport} className="btn bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-md gap-2 font-bold px-6">
                   Continue to Publish &rarr; 
                 </button>
               </div>
             </div>
           )}

           {/* STEP 4: PUBLISH */}
           {wizardStep === 4 && (
             <div className="animate-fade-in flex flex-col items-center justify-center p-8 bg-white border border-emerald-100 rounded-lg shadow-sm text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle size={32} />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Publish Sequence Iterated!</h2>
                <p className="text-sm text-slate-500 max-w-sm mb-6">
                   {extractedEndpoints.filter(e => e.selected).length} endpoints have been securely provisioned in the Integration Hub and are live for mapping to UI Layouts.
                </p>
                <button onClick={() => {
                   setShowWizard(false); 
                   setExtractedEndpoints([]); 
                   setWizardStep(1); 
                   if (payloadRef.current) payloadRef.current.value = '';
                   setHasPayload(false);
                   setWizardPrompt(''); 
                   load();
                }} className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 border-none font-bold px-8 shadow-md">
                   Finish and View Hub
                </button>
             </div>
           )}

        </div>
      )}

      {showForm && (
        <div className="card p-6 mb-6">
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-semibold mb-1 block">Connector ID (e.g. worldbank_countries)</label>
                <input required className="input w-full" value={form.id || ''} onChange={e => setForm({...form, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')})} placeholder="Internal alias" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold mb-1 block">Display Name</label>
                <input required className="input w-full" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. World Bank Countries API" />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-32">
                <label className="text-xs font-semibold mb-1 block">Method</label>
                <select className="input w-full" value={form.method} onChange={e => setForm({...form, method: e.target.value as any})}>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold mb-1 block">Logo Image URL <span className="font-normal text-slate-400">(Optional)</span></label>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2 items-center">
                    {form.logoUrl && <img src={form.logoUrl} className="w-8 h-8 object-contain rounded bg-white shadow-sm" alt="logo" onError={e => (e.currentTarget.style.display = 'none')} />}
                    <input type="url" className="input flex-1 text-sm" value={form.logoUrl || ''} onChange={e => setForm({...form, logoUrl: e.target.value})} placeholder="https://cdn.../logo.png" />
                  </div>
                  <label className="border border-dashed border-slate-300 rounded p-1.5 flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 transition text-xs text-slate-500 w-full group">
                     {isUploadingLogo ? <Activity size={14} className="animate-spin text-indigo-500" /> : <UploadCloud size={14} className="group-hover:text-indigo-500" />}
                     {isUploadingLogo ? 'Uploading to Vault...' : 'Or upload image file from computer'}
                     <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" disabled={isUploadingLogo} />
                  </label>
                </div>
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold mb-1 block">Endpoint URL (Accepts {'{{CURRENT_USER.id}}'})</label>
                <input required type="url" className="input w-full font-mono text-sm" value={form.url || ''} onChange={e => setForm({...form, url: e.target.value})} placeholder="https://api.worldbank.org/v2/country?format=json" />
              </div>
              <div className="w-48">
                <label className="text-xs font-semibold mb-1 block">Category Label</label>
                <select className="input w-full text-sm" value={form.category || ''} onChange={e => setForm({...form, category: e.target.value})}>
                   <option value="">No Category</option>
                   <option value="Extracted">Extracted</option>
                   {validCategories.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
              </div>
            </div>
            
            <div className="p-4 bg-canvas rounded-lg border border-dashed flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-semibold mb-1 block">Auth Secret (Vault Mapping)</label>
                 <select className="input w-full" value={form.vaultId || ''} onChange={e => setForm({...form, vaultId: e.target.value})}>
                    <option value="">No Authentication</option>
                    {vaultSecrets.map(v => <option key={v.id} value={v.id}>{v.name} ({v.type})</option>)}
                 </select>
                 <p className="text-[10px] text-tertiary mt-1">If selected, proxy will attach token to headers.</p>
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold mb-1 block">JSON Data Array Path</label>
                <input className="input w-full font-mono" value={form.dataPath || ''} onChange={e => setForm({...form, dataPath: e.target.value})} placeholder="e.g. data.items or [1]" />
                <p className="text-[10px] text-tertiary mt-1">Path to the array of objects in the response.</p>
              </div>
              <div className="flex-1 flex gap-2">
                 <div className="flex-1">
                    <label className="text-xs font-semibold mb-1 block">Label Key</label>
                    <input className="input w-full font-mono" value={form.labelField || ''} onChange={e => setForm({...form, labelField: e.target.value})} placeholder="e.g. name" />
                 </div>
                 <div className="flex-1">
                    <label className="text-xs font-semibold mb-1 block">Value Key</label>
                    <input className="input w-full font-mono" value={form.valueField || ''} onChange={e => setForm({...form, valueField: e.target.value})} placeholder="e.g. id" />
                 </div>
              </div>
            </div>

            {testOutput && (
               <div className="flex gap-4">
                 <div className="flex-1 overflow-hidden h-96 border border-slate-200 shadow-inner rounded flex flex-col">
                   <div className="font-bold text-[11px] p-2 bg-slate-100 text-slate-700 select-none border-b border-slate-200">⚡ Raw Result Set</div>
                   <div className="flex-1 overflow-auto bg-white">
                      <JsonTreeViewer data={testOutput} defaultExpanded={true} />
                   </div>
                 </div>
                 <div className="flex-1 overflow-hidden h-96 border border-indigo-200 shadow-inner rounded flex flex-col">
                   <div className="font-bold text-[11px] p-2 bg-indigo-50 text-indigo-800 select-none border-b border-indigo-100">💡 Parsed Output (via JSON Array Path)</div>
                   <div className="flex-1 overflow-auto bg-white">
                      <JsonTreeViewer data={(() => {
                         try {
                            let d = testOutput;
                            if (form.dataPath) {
                               const parts = form.dataPath.replace(/\[/g, '.').replace(/\]/g, '').split('.').filter(Boolean);
                               for (const p of parts) { if (d) d = d[p]; }
                            }
                            if (Array.isArray(d)) {
                               return d.map((item: any) => ({
                                  _labelData: form.labelField ? item[form.labelField] : undefined,
                                  _valueData: form.valueField ? item[form.valueField] : undefined,
                                  ...item
                               }));
                            }
                            return d || { warning: 'No matching path found in raw data.' };
                         } catch (e) {
                            return { error: 'Failed to parse data path against raw result' };
                         }
                      })()} defaultExpanded={true} />
                   </div>
                 </div>
               </div>
            )}
            
            <div className="flex justify-end gap-2 mt-2">
              <button type="button" onClick={handleTest} disabled={testing} className="btn bg-white border outline-none text-sm pointer-events-auto shadow-sm px-4">
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setTestOutput(null); setIsEditing(false); setWizardStep(1); setForm({ method: 'GET'}); }} className="btn btn-secondary">Cancel</button>
              <button type="submit" className="btn btn-primary">{isEditing ? 'Save Changes' : 'Publish Connector'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center text-secondary">Loading Connectors...</div>
      ) : connectors.length === 0 ? (
        <div className="card p-12 text-center border border-dashed text-secondary">
          <PlugZap size={32} className="mx-auto mb-3 opacity-50" />
          <h3 className="font-bold text-primary">No Integrations Configured</h3>
          <p className="mt-1">Define an endpoint to start bringing dynamic external data into Data Models.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-6 border-b pb-4 overflow-x-auto">
             <button 
               onClick={() => setActiveCategory('All')} 
               className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${activeCategory === 'All' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
             >
               All Connectors
             </button>
             {Array.from(new Set(connectors.map(a => a.category).filter(Boolean))).map(cat => (
               <button 
                 key={cat}
                 onClick={() => setActiveCategory(cat as string)} 
                 className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${activeCategory === cat ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
               >
                 {cat}
               </button>
             ))}
          </div>

          <div className="card overflow-hidden">
            <table className="data-table w-full">
            <thead>
              <tr className="bg-canvas border-b text-left">
                <th className="p-4 py-3">Connector</th>
                <th className="p-4 py-3">Endpoint URL</th>
                <th className="p-4 py-3">Vault Auth</th>
                <th className="p-4 py-3">Data Mapping</th>
                <th className="p-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {connectors.filter(c => activeCategory === 'All' || c.category === activeCategory).map(c => (
                <tr key={c.id} className="border-b transition hover:bg-slate-50">
                  <td className="p-4 flex gap-3 items-center">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center p-1 overflow-hidden shrink-0">
                      {c.logoUrl ? <img src={c.logoUrl} className="w-full h-full object-contain" alt="App Icon" onError={e => e.currentTarget.src = 'https://ui-avatars.com/api/?name='+c.name+'&background=F8FAFC&color=475569'} /> : <PlugZap size={20} className="text-slate-400" />}
                    </div>
                    <div>
                      <div className="font-bold flex items-center gap-2 text-slate-800 text-sm">
                         {c.name}
                         {c.category && <span className="text-[9px] bg-slate-100 text-slate-500 px-1 rounded uppercase tracking-wide">{c.category}</span>}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5">{c.id}</div>
                      {c.description && <div className="text-[11px] text-slate-600 mt-1 max-w-sm leading-tight">{c.description}</div>}
                      {c.tags && c.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {c.tags.map(tag => (
                            <span key={tag} className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-[1px] rounded-full">#{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="badge badge-secondary mr-2">{c.method}</span>
                    <span className="font-mono text-xs">{c.url}</span>
                  </td>
                  <td className="p-4 text-sm text-tertiary">
                    {c.vaultId ? <span className="text-primary flex items-center gap-1"><Lock size={12}/> {c.vaultId}</span> : 'None'}
                  </td>
                  <td className="p-4 text-xs font-mono text-tertiary">
                    Path: {c.dataPath || 'root'}<br/>
                    {c.labelField && c.valueField && <span className="text-primary">L: {c.labelField} | V: {c.valueField}</span>}
                  </td>
                  <td className="p-4 text-right flex justify-end gap-2">
                    <button onClick={() => handleEdit(c)} className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-2 rounded transition-colors"><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded transition-colors"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
