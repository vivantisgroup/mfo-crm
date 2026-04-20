'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { can } from '@/lib/rbacService';
import { getVaultCredentials, saveVaultCredential, deleteVaultCredential, VaultCredential } from '@/lib/integrationCoreService';
import { Lock, Plus, Trash2, Eye, EyeOff, Edit2, Variable, Sparkles, Loader2, Activity, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function VaultPage() {
  const { tenant, authzContext } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [credentials, setCredentials] = useState<VaultCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTokenFor, setShowTokenFor] = useState<string | null>(null);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [revealSecrets, setRevealSecrets] = useState(false);
  const [form, setForm] = useState<Partial<VaultCredential> & { allowedRolesStr?: string }>({ type: 'bearer', arguments: [] });

  // AI Wizard
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Test Auth
  const [testUrl, setTestUrl] = useState("");
  const [testMethod, setTestMethod] = useState("GET");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    if (authzContext) {
      setHasAccess(can(authzContext, 'admin:credentials'));
    }
  }, [authzContext]);

  const load = () => {
    if (tenant?.id && hasAccess) {
      setLoading(true);
      getVaultCredentials(tenant.id).then(setCredentials).finally(() => setLoading(false));
    }
  };

  useEffect(() => { load(); }, [tenant?.id, hasAccess]);

  const generateVaultAI = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/vault/ai-wizard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, tenantId: tenant?.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI layout mapping failed');

      const sch = JSON.parse(data.schema);
      setForm(prev => ({
        ...prev,
        type: sch.type,
        headerName: sch.headerName || '',
        arguments: sch.arguments || []
      }));
    } catch (err: any) {
      toast.error("AI Configuration failed: " + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleTestAuth = async () => {
     if (!testUrl.trim()) return toast.error("Enter a target Test URL first.");
     setIsTesting(true);
     setTestResult(null);
     
     try {
       const res = await fetch('/api/integrations/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
             tenantId: tenant?.id,
             testConnector: { url: testUrl, method: testMethod },
             testVaultOverride: form,
             userRoles: authzContext?.role ? [authzContext.role] : []
          })
       });
       const data = await res.json();
       setTestResult({ status: res.status, ok: res.ok, data });
     } catch (err: any) {
       setTestResult({ ok: false, error: err.message });
     } finally {
       setIsTesting(false);
     }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    const cred: VaultCredential = {
      id: form.id || 'cred_' + Math.random().toString(36).substr(2, 6),
      name: form.name || 'Unnamed',
      type: form.type as any,
      token: form.token || '',
      createdAt: form.createdAt || new Date().toISOString()
    };
    if (form.type === 'custom_header' && form.headerName) cred.headerName = form.headerName;
    if (form.type === 'dynamic' && form.arguments) cred.arguments = form.arguments;
    if (form.allowedRolesStr) cred.allowedRoles = form.allowedRolesStr.split(',').map(s=>s.trim()).filter(Boolean);
    else cred.allowedRoles = [];
    
    await saveVaultCredential(tenant.id, cred);
    setShowForm(false);
    setIsEditing(false);
    setForm({ type: 'bearer', arguments: [] });
    setTestResult(null);
    setTestUrl("");
    load();
  };

  const handleEdit = (c: VaultCredential) => {
     setForm({ ...c, allowedRolesStr: c.allowedRoles?.join(', ') || '' });
     setIsEditing(true);
     setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!tenant?.id) return;
    if (confirm('Are you sure you want to delete this secret from the vault?')) {
      await deleteVaultCredential(tenant.id, id);
      load();
    }
  };

  if (!hasAccess) {
    return <div className="p-10 text-center">⛔ Access Denied. Requires 'admin:credentials' permission.</div>;
  }

  return (
    <div className="page-wrapper animate-fade-in w-full px-4 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Lock className="text-brand-500" /> Credential Vault</h1>
          <p className="text-secondary mt-1">Securely map API Keys and Tokens for Integration Hub endpoints.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary btn-sm flex items-center gap-2"><Plus size={16} /> Add Secret</button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          {!isEditing && (
            <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-100 p-4 rounded-xl mb-6 shadow-sm">
                <h4 className="flex items-center gap-2 font-bold text-sky-800 text-sm mb-2"><Sparkles size={16} /> AI Configuration Wizard</h4>
                <p className="text-xs text-sky-700 mb-3 block">Describe the external API connection you need mapping for, and the AI will auto-configure the credential structure (You will securely insert the final secrets yourself).</p>
                <div className="flex gap-2">
                   <input disabled={isAiLoading} className="input flex-1 border-sky-200 focus:border-sky-400 bg-white" placeholder="e.g. Generate OAuth2 client config for Google Workspace..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && generateVaultAI()} />
                   <button disabled={isAiLoading || !aiPrompt.trim()} onClick={generateVaultAI} className="btn bg-sky-600 hover:bg-sky-700 text-white border-none flex items-center gap-2">
                     {isAiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} 
                     {isAiLoading ? 'Synthesizing...' : 'Build Schema'}
                   </button>
                </div>
            </div>
          )}

          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex gap-4 items-start">
            <div className="flex-1">
              <label className="text-xs font-semibold mb-1 block">Secret ID (e.g. stripe_key)</label>
              <input disabled={isEditing} required className={`input w-full ${isEditing ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`} value={form.id || ''} onChange={e => setForm({...form, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')})} placeholder="Secret unique alias" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold mb-1 block">Display Name</label>
              <input required className="input w-full" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Stripe Production Key" />
            </div>
            <div className="w-40">
              <label className="text-xs font-semibold mb-1 block">Type</label>
              <select className="input w-full" value={form.type} onChange={e => setForm({...form, type: e.target.value as any})}>
                <option value="bearer">Bearer Token</option>
                <option value="apikey">API Key</option>
                <option value="basic">Basic Auth</option>
                <option value="oauth2">OAuth2 Payload</option>
                <option value="custom_header">Custom Header</option>
                <option value="dynamic">✨ Dynamic / Multi-Args</option>
              </select>
            </div>
            
            {form.type === 'custom_header' && (
              <div className="w-40">
                <label className="text-xs font-semibold mb-1 block">Header Name</label>
                <input required className="input w-full" value={form.headerName || ''} onChange={e => setForm({...form, headerName: e.target.value})} placeholder="e.g. x-auth-token" />
              </div>
            )}

            {form.type !== 'dynamic' && (
              <div className="flex-2">
                <label className="text-xs font-semibold mb-1 block">Secret Token / Client ID {isEditing ? '(Type to replace)' : '(Will be hidden)'}</label>
                <div className="relative">
                  <input required={!isEditing} type={revealSecrets ? "text" : "password"} className="input w-full pr-8" value={form.token || ''} onChange={e => setForm({...form, token: e.target.value})} placeholder={isEditing ? '•••••••• (Preserved unless typed)' : 'Enter secret...'} />
                  <button type="button" onClick={() => setRevealSecrets(!revealSecrets)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 focus:outline-none">
                    {revealSecrets ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {form.type === 'dynamic' && (
            <div className="bg-slate-50 p-4 border rounded-md border-slate-200 shadow-inner mt-2">
               <h4 className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-2"><Variable size={14} className="text-sky-500" /> Key-Value Variables</h4>
               <p className="text-[10px] text-slate-500 mb-4">Define multiple injection pieces for this credential (e.g. Client ID, Client Secret, Audience). They will be natively resolved by the backend proxy.</p>
               <div className="space-y-2">
                 {form.arguments?.map((arg, i) => (
                    <div key={i} className="flex gap-2 items-center w-full">
                       <input className="input h-8 text-xs w-40 flex-shrink-0" value={arg.key} onChange={e => {
                           const n = [...(form.arguments || [])]; n[i].key = e.target.value; setForm({...form, arguments: n});
                       }} placeholder="Variable Key Name" />
                       
                       <div className="relative flex-1">
                         <input className="input h-8 text-xs w-full pr-8" type={revealSecrets ? "text" : "password"} value={arg.value} onChange={e => {
                             const n = [...(form.arguments || [])]; n[i].value = e.target.value; setForm({...form, arguments: n});
                         }} placeholder="Secured Value string" />
                         <button type="button" onClick={() => setRevealSecrets(!revealSecrets)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 focus:outline-none bg-transparent">
                           {revealSecrets ? <EyeOff size={14} /> : <Eye size={14} />}
                         </button>
                       </div>
                       
                       <select className="input h-8 text-xs w-32 flex-shrink-0" value={arg.placement} onChange={e => {
                           const n = [...(form.arguments || [])]; n[i].placement = e.target.value as any; setForm({...form, arguments: n});
                       }}>
                         <option value="header">HTTP Header</option>
                         <option value="query">Query Param</option>
                       </select>
                       
                       <button type="button" onClick={() => {
                          const n = [...(form.arguments || [])]; n.splice(i, 1); setForm({...form, arguments: n});
                       }} className="btn btn-secondary btn-sm p-1.5 h-8 text-red-500 hover:bg-red-50"><Trash2 size={14}/></button>
                    </div>
                 ))}
                 <button type="button" onClick={() => setForm({...form, arguments: [...(form.arguments || []), { key: '', value: '', placement: 'header' }]})} className="btn btn-secondary btn-sm text-xs mt-2 border-dashed">
                    + Add Argument Row
                 </button>
               </div>
            </div>
          )}
          <div className="flex gap-4 items-end mt-4">
             <div className="flex-1">
               <label className="text-xs font-semibold mb-1 block flex items-center gap-2">Allowed Roles (RBAC Restriction) <span className="text-[9px] bg-slate-100 text-slate-500 px-1 rounded uppercase">Optional</span></label>
               <input className="input w-full" value={form.allowedRolesStr || ''} onChange={e => setForm({...form, allowedRolesStr: e.target.value})} placeholder="e.g. tenant_admin, security_officer" />
               <p className="text-[10px] text-slate-400 mt-1">Leave blank to allow any integrated proxy flow. Separate by commas to lock this credential down.</p>
             </div>
           </div>

           <div className="bg-slate-50 border border-slate-200 mt-4 p-4 rounded-xl shadow-inner">
             <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2 mb-2"><Activity size={14} className="text-indigo-500" /> Sandbox Connection Test</h4>
             <p className="text-[10px] text-slate-500 mb-4">Validate this vault mapping configuration against a real target API before saving. This ping runs securely via backend proxy.</p>
             <div className="flex gap-2">
                 <select className="input h-8 text-xs w-24" value={testMethod} onChange={e => setTestMethod(e.target.value)}>
                    <option>GET</option><option>POST</option>
                 </select>
                 <input className="input h-8 text-xs flex-1" placeholder="https://api.example.com/v1/ping" value={testUrl} onChange={e => setTestUrl(e.target.value)} />
                 <button type="button" onClick={handleTestAuth} disabled={isTesting || !testUrl.trim()} className="btn btn-secondary border-none h-8 text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-4">
                    {isTesting ? 'Pinging...' : 'Test Auth Payload'}
                 </button>
             </div>
             {testResult && (
                <div className={`mt-3 p-3 rounded text-[10px] font-mono overflow-auto max-h-48 border ${testResult.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                   <div className="font-bold flex items-center gap-2 mb-1">
                      {testResult.ok ? <CheckCircle size={12}/> : <Trash2 size={12}/>} HTTP {testResult.status}
                   </div>
                   <pre>{JSON.stringify(testResult.data || testResult.error, null, 2)}</pre>
                </div>
             )}
           </div>

           <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
               <button type="button" onClick={() => {setShowForm(false); setIsEditing(false); setRevealSecrets(false); setForm({ type: 'bearer', arguments: [] }); setAiPrompt(''); setTestResult(null);}} className="btn btn-secondary border-none">Cancel</button>
               <button type="submit" className="btn btn-primary bg-slate-800 hover:bg-slate-900 border-none">{isEditing ? 'Save Changes' : 'Save to Vault'}</button>
           </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center text-secondary">Loading Vault...</div>
      ) : credentials.length === 0 ? (
        <div className="card p-12 text-center border border-dashed text-secondary">
          <Lock size={32} className="mx-auto mb-3 opacity-50" />
          <h3 className="font-bold text-primary">Vault is Empty</h3>
          <p className="mt-1">Add your first secret token to securely auth outgoing integration endpoints.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table w-full">
            <thead>
              <tr className="bg-canvas border-b text-left">
                <th className="p-4 py-3">Secret ID</th>
                <th className="p-4 py-3">Name</th>
                <th className="p-4 py-3">Type</th>
                <th className="p-4 py-3">Token Mask</th>
                <th className="p-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {credentials.map(c => (
                <tr key={c.id} className="border-b">
                  <td className="p-4 font-mono text-sm text-brand-600">{c.id}</td>
                  <td className="p-4 font-semibold">{c.name}</td>
                  <td className="p-4">
                     <span className="badge badge-primary">{c.type.toUpperCase()}</span>
                     {c.allowedRoles && c.allowedRoles.length > 0 && (
                       <div className="text-[10px] text-slate-500 mt-1 flex flex-wrap gap-1">
                         <Lock size={10} className="inline text-red-400" />
                         {c.allowedRoles.map(r => <span key={r}>{r}</span>)}
                       </div>
                     )}
                  </td>
                  <td className="p-4 flex items-center gap-2">
                     <span className="font-mono text-xs bg-slate-100 p-1 rounded">
                       {c.type === 'dynamic' ? `[${c.arguments?.length || 0} Dynamic Arguments]` : (showTokenFor === c.id ? c.token : '••••••••••••••••••••')}
                     </span>
                     {c.type !== 'dynamic' && (
                        <button onClick={() => setShowTokenFor(showTokenFor === c.id ? null : c.id)} className="text-secondary hover:text-primary">
                          {showTokenFor === c.id ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                     )}
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
      )}
    </div>
  );
}
