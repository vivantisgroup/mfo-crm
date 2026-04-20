'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getDataModel, getPageLayout, getCustomData, saveCustomData, CustomFieldDef } from '@/lib/customizationService';
import { Edit2, Check, X, Loader2, PlayCircle } from 'lucide-react';

function ExternalLookupSelect({ tenantId, targetId, value, onChange }: { tenantId: string, targetId: string, value: any, onChange: (v: string) => void }) {
  const [options, setOptions] = useState<{label: string, value: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const fetchIt = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/integrations/proxy', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             tenantId,
             connectorId: targetId.replace('external:', ''),
             dynamicContext: { SYSTEM_DATE: new Date().toISOString().split('T')[0] }
           })
        });
        if (!res.ok) throw new Error('API failure proxy');
        const payload = await res.json();
        if (active && payload.success) {
           setOptions(payload.data || []);
        }
      } catch (err: any) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchIt();
    return () => { active = false; };
  }, [tenantId, targetId]);

  if (loading) return <div className="text-xs text-secondary flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Fetching Integration...</div>;
  if (error) return <div className="text-xs text-red-500">API Error</div>;

  return (
    <select className="input" style={{ width: '100%' }} value={value || ''} onChange={e => onChange(e.target.value)}>
      <option value="">Select an option...</option>
      {options.map((o, i) => <option key={i} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function ExternalGridTable({ tenantId, targetId, columns, params, context }: { tenantId: string, targetId: string, columns: any[], params: any[], context: any }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const fetchIt = async () => {
      setLoading(true);
      setError('');
      try {
        const dynamicContext: any = { SYSTEM_DATE: new Date().toISOString().split('T')[0] };
        params.forEach(p => {
           dynamicContext[p.paramName] = context[p.sourceField];
        });
        
        const res = await fetch('/api/integrations/proxy', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             tenantId,
             connectorId: targetId.replace('external:', ''),
             dynamicContext
           })
        });
        if (!res.ok) throw new Error('API failure proxy');
        const payload = await res.json();
        if (active && payload.success) {
           setData(payload.data || []);
        }
      } catch (err: any) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    if (tenantId && targetId) fetchIt();
    return () => { active = false; };
  }, [tenantId, targetId, JSON.stringify(params), JSON.stringify(context)]);

  if (loading) return <div className="text-xs text-secondary flex items-center gap-2 mt-2"><Loader2 size={14} className="animate-spin" /> Fetching grid data from integration...</div>;
  if (error) return <div className="text-xs text-red-500 mt-2">Integration Error: {error}</div>;

  return (
    <div className="overflow-x-auto border border-tremor-border rounded-lg mt-2 shadow-sm">
      <table className="w-full text-left text-sm text-tremor-content">
        <thead className="bg-[#f8fafc] border-b border-tremor-border">
          <tr>
            {columns.map(col => <th key={col.key} className="p-3 font-semibold text-xs tracking-wide text-brand-700 uppercase">{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} className="p-6 text-center text-sm text-tertiary bg-white">No data returned from the external integration.</td></tr>
          ) : (
            data.map((row, i) => (
              <tr key={i} className="border-b border-tremor-border last:border-0 hover:bg-slate-50 transition bg-white">
                 {columns.map(col => <td key={col.key} className="p-3 border-r last:border-r-0 border-tremor-border">{String(row.raw?.[col.key] || row[col.key] || '-')}</td>)}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function AutomationTriggerButton({ tenantId, field, context, onComplete }: { tenantId: string, field: CustomFieldDef, context: any, onComplete?: (res: any) => void }) {
  const [running, setRunning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const executeAutomation = async () => {
    if (!field.lookupTarget) return;
    setRunning(true);
    setSuccess(false);
    setError('');
    try {
      const inputs: Record<string, any> = {};
      (field.externalParams || []).forEach(p => {
        inputs[p.paramName] = context[p.sourceField];
      });

      const res = await fetch('/api/automations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          automationId: field.lookupTarget.replace('flow:', ''),
          inputs,
          userRoles: context.roles || []
        })
      });
      
      const payload = await res.json();
      if (!res.ok || payload.error) throw new Error(payload.message || payload.error || 'Automation Failed');
      
      setSuccess(true);
      if (onComplete) onComplete(payload.data);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button 
        onClick={executeAutomation} 
        disabled={running || success}
        className={`btn flex items-center justify-center gap-2 shadow-sm font-semibold text-sm ${running ? 'bg-slate-100 text-slate-500' : success ? 'bg-emerald-500 text-white' : 'btn-primary'}`}
      >
        {running ? <><Loader2 size={16} className="animate-spin" /> Executing Action...</> : 
         success ? <><Check size={16} /> Completed</> :
         <><PlayCircle size={16} /> {field.label}</>}
      </button>
      {error && <div className="text-[10px] text-red-500 bg-red-50 p-2 rounded">{error}</div>}
    </div>
  );
}

interface Props {
  entityName: string;
  pageId: string;
  recordId: string;
  recordName: string;
}

export function DynamicFieldRenderer({ entityName, pageId, recordId, recordName }: Props) {
  const { tenant, authzContext } = useAuth();
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tenant?.id) {
      setLoading(true);
      Promise.all([
        getDataModel(tenant.id, entityName),
        getPageLayout(tenant.id, pageId),
        getCustomData(tenant.id, entityName, recordId)
      ]).then(([model, layout, dataVals]) => {
        const visibleIds = layout?.visibleFields || [];
        const displayedFields = (model?.fields || []).filter(f => visibleIds.includes(f.id));
        setFields(displayedFields);
        setValues(dataVals || {});
        setDrafts(dataVals || {});
      }).finally(() => setLoading(false));
    }
  }, [tenant?.id, entityName, pageId, recordId]);

  const save = async () => {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      await saveCustomData(tenant.id, entityName, recordId, drafts);
      setValues(drafts);
      setEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null; // or a tiny spinner
  if (fields.length === 0) return null; // No fields activated for this layout

  return (
    <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6 mt-6">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="card-title text-base font-bold flex items-center gap-2">
           <span style={{ fontSize: 16 }}>✨</span> Extended Profile
        </h2>
        
        {!editing ? (
          <button 
            onClick={() => { setDrafts(values); setEditing(true); }}
            className="btn btn-secondary btn-sm flex items-center gap-1"
          >
            <Edit2 size={12} /> Edit Data
          </button>
        ) : (
          <div className="flex gap-2">
             <button onClick={() => setEditing(false)} className="btn btn-secondary btn-sm"><X size={14} /></button>
             <button onClick={save} disabled={saving} className="btn btn-primary btn-sm flex items-center gap-1">
               <Check size={14} /> {saving ? 'Saving' : 'Save'}
             </button>
          </div>
        )}
      </div>
      
      <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {fields.map(f => {
          let displayVal = values[f.id] ?? '-';
          if (f.type === 'boolean') displayVal = values[f.id] ? 'Yes' : 'No';
          
          if (f.type === 'external_table') {
            return (
              <div key={f.id} style={{ gridColumn: '1 / -1' }} className="pt-2 border-t mt-2">
                <div className="text-xs text-brand-600 font-bold mb-1 flex items-center gap-2" style={{ textTransform: 'uppercase' }}>
                  <span className="bg-brand-50 px-2 py-0.5 rounded text-[10px]">Data Grid</span> {f.label}
                </div>
                {!editing ? (
                  <ExternalGridTable 
                    tenantId={tenant?.id || ''} 
                    targetId={f.lookupTarget || ''} 
                    columns={f.externalColumns || []} 
                    params={f.externalParams || []} 
                    context={{ recordId, recordName, ...values }}
                  />
                ) : (
                  <div className="text-xs text-tertiary bg-slate-50 p-4 border border-dashed rounded text-center">
                    Integration Grids are read-only and automatically updated per request.
                  </div>
                )}
              </div>
            );
          }

          if (f.type === 'automation_trigger') {
            return (
              <div key={f.id} style={{ gridColumn: '1 / -1' }} className="pt-2 border-t mt-2">
                <div className="text-xs text-brand-600 font-bold mb-3 flex items-center gap-2" style={{ textTransform: 'uppercase' }}>
                  <span className="bg-brand-50 px-2 py-0.5 rounded text-[10px] border border-brand-200 shadow-sm">Automated Action</span>
                </div>
                {!editing ? (
                  <AutomationTriggerButton 
                    tenantId={tenant?.id || ''} 
                    field={f} 
                    context={{ recordId, recordName, roles: authzContext?.role ? [authzContext.role] : [], ...values }}
                  />
                ) : (
                  <div className="text-xs text-tertiary bg-slate-50 p-4 border border-dashed rounded text-center">
                    Trigger logic is disabled in edit mode.
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={f.id}>
              <div className="text-xs text-tertiary fw-600 mb-1" style={{ textTransform: 'uppercase' }}>{f.label}</div>
              
              {!editing ? (
                <div className="text-sm fw-500">{displayVal}</div>
              ) : (
                <div style={{ marginTop: 4 }}>
                   {f.type === 'boolean' ? (
                     <label className="flex items-center gap-2 text-sm">
                       <input 
                         type="checkbox" 
                         checked={!!drafts[f.id]} 
                         onChange={e => setDrafts({...drafts, [f.id]: e.target.checked})} 
                       /> 
                       {f.label}
                     </label>
                   ) : f.type === 'number' ? (
                     <input 
                       type="number" 
                       className="input" 
                       style={{ width: '100%' }}
                       value={drafts[f.id] || ''}
                       onChange={e => setDrafts({...drafts, [f.id]: parseFloat(e.target.value)})}
                     />
                   ) : f.type === 'date' ? (
                     <input 
                       type="date" 
                       className="input" 
                       style={{ width: '100%' }}
                       value={drafts[f.id] || ''}
                       onChange={e => setDrafts({...drafts, [f.id]: e.target.value})}
                     />
                   ) : f.type === 'lookup' ? (
                     f.lookupTarget?.startsWith('external:') ? (
                       <ExternalLookupSelect 
                          tenantId={tenant?.id || ''} 
                          targetId={f.lookupTarget} 
                          value={drafts[f.id]} 
                          onChange={(v) => setDrafts({...drafts, [f.id]: v})} 
                       />
                     ) : (
                       <input 
                           type="text" 
                           className="input" 
                           style={{ width: '100%' }}
                           placeholder={`Search ${f.lookupTarget || 'record'} (ID string)...`}
                           value={drafts[f.id] || ''}
                           onChange={e => setDrafts({...drafts, [f.id]: e.target.value})}
                       />
                     )
                   ) : (
                     <input 
                       type="text" 
                       className="input" 
                       style={{ width: '100%' }}
                       value={drafts[f.id] || ''}
                       onChange={e => setDrafts({...drafts, [f.id]: e.target.value})}
                     />
                   )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
