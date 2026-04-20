'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { can } from '@/lib/rbacService';
import { getDataModel, saveDataModel, getSystemCatalog, updateSystemCatalog, CustomFieldDef, FieldType, SystemCatalog, DATA_DICTIONARY } from '@/lib/customizationService';
import { getConnectors, IntegrationConnector } from '@/lib/integrationCoreService';
import { getAutomations, AutomationFlow } from '@/lib/automationCoreService';
import { checkFieldHasData } from '@/lib/systemCatalogDataService';
import { SystemCatalogExplorer } from '../components/SystemCatalogExplorer';
import { Trash2, Plus, GripVertical, Download, Upload, Database, Map } from 'lucide-react';
import { toast } from 'sonner';

export default function DataModelPage() {
  const { tenant, authzContext } = useAuth();
  const [activeTab, setActiveTab] = useState<'schema' | 'catalog'>('schema');
  
  const [searchQuery, setSearchQuery] = useState('');
  const filteredEntities = DATA_DICTIONARY.filter(e => e.label.toLowerCase().includes(searchQuery.toLowerCase()) || e.id.toLowerCase().includes(searchQuery.toLowerCase()));
  
  const [activeEntity, setActiveEntity] = useState(DATA_DICTIONARY[0].id);
  const activeRecord = DATA_DICTIONARY.find(e => e.id === activeEntity);

  const [advancedModeFields, setAdvancedModeFields] = useState<Record<string, boolean>>({});

  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  
  const [catalog, setCatalog] = useState<SystemCatalog | null>(null);
  const [connectors, setConnectors] = useState<IntegrationConnector[]>([]);
  const [automations, setAutomations] = useState<AutomationFlow[]>([]);

  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (authzContext) {
      setHasAccess(can(authzContext, 'admin:data_model'));
    }
  }, [authzContext]);

  // Load Schema
  useEffect(() => {
    if (tenant?.id && hasAccess && activeTab === 'schema') {
      setLoading(true);
      Promise.all([
        getDataModel(tenant.id, activeEntity),
        getConnectors(tenant.id),
        getAutomations(tenant.id)
      ]).then(([model, conns, flows]) => {
        setFields(model?.fields || []);
        setConnectors(conns);
        setAutomations(flows);
      }).finally(() => setLoading(false));
    }
  }, [tenant?.id, activeEntity, hasAccess, activeTab]);

  // Load Catalog
  useEffect(() => {
    if (tenant?.id && hasAccess && activeTab === 'catalog') {
      setLoading(true);
      getSystemCatalog(tenant.id).then(cat => {
        setCatalog(cat);
      }).finally(() => setLoading(false));
    }
  }, [tenant?.id, hasAccess, activeTab]);

  const addField = () => {
    const newId = 'field_' + Math.random().toString(36).substr(2, 6);
    setFields([...fields, { id: newId, label: 'New Field', type: 'text' }]);
  };

  const updateField = (index: number, changes: Partial<CustomFieldDef>) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], ...changes };
    setFields(updated);
  };

  const removeField = async (index: number) => {
    const field = fields[index];
    if (tenant?.id && field.id) {
      setLoading(true);
      const inUse = await checkFieldHasData(tenant.id, activeEntity, field.id);
      setLoading(false);
      if (inUse) {
        toast.error(`Cannot delete field "${field.label || field.id}" because it is currently holding data in existing records.`);
        return;
      }
    }
    setFields(fields.filter((_, i) => i !== index));
  };

  const save = async () => {
    if (!tenant?.id || !authzContext) return;
    setSaving(true);
    setMsg('');
    try {
      await saveDataModel(tenant.id, activeEntity, fields, 'current_user_uid');
      
      // Auto-update System Catalog
      const cat = await getSystemCatalog(tenant.id);
      const dm = cat?.dataModels || {};
      dm[activeEntity] = { entityName: activeEntity, fields, updatedAt: new Date().toISOString(), updatedBy: 'uid' };
      await updateSystemCatalog(tenant.id, { dataModels: dm });
      
      setMsg('✅ Schema saved successfully');
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) {
      setMsg('❌ ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportCatalog = () => {
    if (!catalog) return;
    const blob = new Blob([JSON.stringify(catalog, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system_catalog_${tenant?.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!hasAccess) {
    return <div style={{ padding: 40, textAlign: 'center' }}>⛔ You do not have permission to design data models (Requires 'admin:data_model').</div>;
  }

  return (
    <div className="page-wrapper animate-fade-in w-full px-4 lg:px-8">
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="text-2xl font-bold">🗄️ Data Model Editor</h1>
          <p className="text-secondary mt-1">Configure custom schema fields and inspect tenant metadata boundaries.</p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', padding: 4, borderRadius: 8 }}>
          <button 
            onClick={() => setActiveTab('schema')}
            style={{ padding: '6px 14px', borderRadius: 6, fontWeight: 600, fontSize: 13, background: activeTab==='schema' ? 'var(--brand-500)' : 'transparent', color: activeTab==='schema' ? '#fff' : 'var(--text-secondary)' }}>
            Schema Builder
          </button>
          <button 
            onClick={() => setActiveTab('catalog')}
            style={{ padding: '6px 14px', borderRadius: 6, fontWeight: 600, fontSize: 13, background: activeTab==='catalog' ? 'var(--brand-500)' : 'transparent', color: activeTab==='catalog' ? '#fff' : 'var(--text-secondary)' }}>
            System Catalog
          </button>
        </div>
      </div>

      {activeTab === 'schema' && (
      <div className="card grid md:grid-cols-[260px_1fr] gap-0">
        <div style={{ borderRight: '1px solid var(--border)', background: 'var(--bg-canvas)', display: 'flex', flexDirection: 'column', maxHeight: 800 }}>
          <div style={{ padding: '16px 20px', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)' }}>
            System Dictionary
          </div>
          <div style={{ padding: '16px 16px 0' }}>
             <input type="search" placeholder="Search tables..." className="input" style={{ width: '100%', fontSize: 13 }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
            {filteredEntities.map(ent => (
              <button
                key={ent.id}
                onClick={() => setActiveEntity(ent.id)}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  background: activeEntity === ent.id ? 'var(--brand-50)' : 'transparent',
                  color: activeEntity === ent.id ? 'var(--brand-600)' : 'var(--text-primary)',
                  marginBottom: 4, display: 'flex', flexDirection: 'column', gap: 4
                }}
              >
                <span>{ent.label}</span>
                <span style={{ fontSize: 10, color: activeEntity === ent.id ? 'var(--brand-400)' : 'var(--text-tertiary)', fontWeight: 500, fontFamily: 'monospace' }}>{ent.id}</span>
              </button>
            ))}
            {filteredEntities.length === 0 && <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>No tables found.</div>}
          </div>
        </div>

        <div style={{ overflowY: 'auto', maxHeight: 800 }}>
           <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--brand-500)', marginBottom: 8 }}>
                <Map size={14} /><span style={{ color: 'var(--text-tertiary)' }}>Exposed via:</span> {activeRecord?.uiPath}
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div style={{ fontWeight: 800, fontSize: 20 }}>{activeRecord?.label} <span style={{ color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 500 }}>Schema</span></div>
               <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : '💾 Save Customizations'}</button>
             </div>
             <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>{activeRecord?.description}</p>
           </div>

           <div style={{ padding: 24 }}>
             {msg && <div style={{ padding: '10px 14px', background: '#22c55e15', color: '#22c55e', borderRadius: 8, marginBottom: 20 }}>{msg}</div>}
             
             {loading ? <div style={{ color: 'var(--text-tertiary)' }}>Loading fields...</div> : (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                 {fields.length === 0 && (
                   <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-canvas)', borderRadius: 12, border: '1px dashed var(--border)' }}>
                      <div style={{ fontSize: 40, marginBottom: 12 }}>🧱</div>
                      <div style={{ fontWeight: 700 }}>No custom fields defined</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Add fields to allow extending this entity across the app.</div>
                   </div>
                 )}
                 
                 {/* Standard Native Fields */}
                 {activeRecord?.standardFields.map((field, i) => (
                   <div key={`std-${i}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', background: 'var(--bg-canvas)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                      <GripVertical size={16} color="var(--border)" style={{ opacity: 0.5 }} />
                      
                      <div style={{ flex: '1 1 200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                           <label className="text-xs text-tertiary block m-0">Field Label</label>
                           <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', background: 'var(--border)', color: 'var(--text-secondary)', borderRadius: 4, textTransform: 'uppercase' }}>Standard</span>
                        </div>
                        <input className="input" style={{ width: '100%', background: 'transparent' }} readOnly value={field.label} />
                      </div>
                      
                      <div style={{ flex: '1 1 120px' }}>
                        <label className="text-xs text-tertiary mb-1 block">Type</label>
                        <select className="input" style={{ width: '100%', background: 'transparent' }} disabled value={field.type}>
                          <option value={field.type}>{field.type}</option>
                        </select>
                      </div>
                      
                      <div style={{ flex: '1 1 150px' }}>
                        <label className="text-xs text-tertiary mb-1 block">Internal ID</label>
                        <input className="input" style={{ width: '100%', background: 'transparent', fontFamily: 'monospace', fontSize: 12 }} readOnly value={field.id} />
                      </div>
                      
                      <div style={{ width: 34 }}></div>
                   </div>
                 ))}

                 {/* User Custom Fields */}
                 {fields.map((field, i) => (
                   <div key={`cust-${i}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', background: 'var(--bg-surface)', padding: 12, borderRadius: 8, border: '1px solid #10b98140', boxShadow: '0 2px 8px rgba(16,185,129,0.05)' }}>
                      <GripVertical size={16} color="var(--text-tertiary)" style={{ cursor: 'grab' }} />
                      
                      <div style={{ flex: '1 1 200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                           <label className="text-xs text-tertiary block m-0">Field Label</label>
                           <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', background: '#10b98115', color: '#10b981', borderRadius: 4, textTransform: 'uppercase' }}>Custom</span>
                        </div>
                        <input className="input" style={{ width: '100%' }} placeholder="Label" value={field.label} 
                          onChange={e => updateField(i, { label: e.target.value, id: field.id.startsWith('field_') ? e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_') : field.id })}
                        />
                      </div>
                      
                      <div style={{ flex: '1 1 120px' }}>
                        <label className="text-xs text-tertiary mb-1 block">Type</label>
                        <select className="input" style={{ width: '100%' }} value={field.type} onChange={e => updateField(i, { type: e.target.value as FieldType })}>
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                          <option value="boolean">Boolean</option>
                          <option value="lookup">Lookup (Entity)</option>
                          <option value="external_table">External API Grid</option>
                          <option value="automation_trigger">Automation Action</option>
                        </select>
                      </div>
                      
                      {field.type === 'lookup' && (
                         <div style={{ flex: '1 1 140px' }}>
                           <label className="text-xs text-tertiary mb-1 block">Lookup Target</label>
                           <select className="input" style={{ width: '100%' }} value={field.lookupTarget || ''} onChange={e => updateField(i, { lookupTarget: e.target.value })}>
                             <option value="">Select Entity / API...</option>
                             <optgroup label="Internal CRM Collections">
                               <option value="families">Families</option>
                               <option value="contacts">Contacts</option>
                               <option value="users">Users</option>
                             </optgroup>
                             {connectors.length > 0 && (
                               <optgroup label="External Integration Endpoints (iPaaS)">
                                 {connectors.map(c => <option key={c.id} value={`external:${c.id}`}>{c.name}</option>)}
                               </optgroup>
                             )}
                           </select>
                         </div>
                      )}
                      
                      <div style={{ flex: '1 1 150px' }}>
                        <label className="text-xs text-tertiary mb-1 block">Internal ID</label>
                        <input className="input" style={{ width: '100%' }} placeholder="ID" value={field.id} onChange={e => updateField(i, { id: e.target.value })} />
                      </div>
                      
                      <button onClick={() => removeField(i)} style={{ background: 'none', border: 'none', color: '#ef4444', padding: 8, cursor: 'pointer', borderRadius: 4, marginTop: 16 }}>
                        <Trash2 size={18} />
                      </button>

                      {field.type === 'external_table' && (
                        <div style={{ flexBasis: '100%', marginTop: 8, padding: 12, background: 'var(--bg-canvas)', borderRadius: 8, border: '1px dashed var(--brand-300)' }}>
                           <div className="flex justify-between items-center mb-3">
                             <h4 className="text-xs font-bold text-brand-600 uppercase m-0">Data Grid Configurations</h4>
                             <button 
                               onClick={() => setAdvancedModeFields(prev => ({...prev, [field.id]: !prev[field.id]}))}
                               className="text-[10px] font-bold text-tertiary hover:text-brand-500 uppercase px-2 py-1 rounded bg-slate-100"
                             >
                               {advancedModeFields[field.id] ? 'Switch to Simple UI' : 'Advanced JSON Mode'}
                             </button>
                           </div>

                           <div className="flex gap-4">
                             <div className={advancedModeFields[field.id] ? 'w-1/3' : 'flex-1'}>
                               <label className="text-xs text-secondary mb-1 block">Data Source (Integration Endpoint)</label>
                               <select className="input w-full" value={field.lookupTarget || ''} onChange={e => updateField(i, { lookupTarget: e.target.value })}>
                                 <option value="">Select Connector...</option>
                                 {connectors.map(c => <option key={c.id} value={`external:${c.id}`}>{c.name}</option>)}
                               </select>
                             </div>

                             {advancedModeFields[field.id] ? (
                               <>
                                 <div className="flex-1">
                                   <label className="text-xs text-secondary mb-1 block">Params Schema (JSON)</label>
                                   <textarea 
                                     className="input w-full font-mono text-[11px]" rows={5}
                                     defaultValue={JSON.stringify(field.externalParams || [], null, 2)}
                                     onBlur={e => {
                                       try { updateField(i, { externalParams: JSON.parse(e.target.value) }); } catch (er) {}
                                     }}
                                   />
                                 </div>
                                 <div className="flex-1">
                                   <label className="text-xs text-secondary mb-1 block">Columns Schema (JSON)</label>
                                   <textarea 
                                     className="input w-full font-mono text-[11px]" rows={5}
                                     defaultValue={JSON.stringify(field.externalColumns || [], null, 2)}
                                     onBlur={e => {
                                       try { updateField(i, { externalColumns: JSON.parse(e.target.value) }); } catch (er) {}
                                     }}
                                   />
                                 </div>
                               </>
                             ) : (
                               <>
                                 <div className="flex-1">
                                   <label className="text-xs text-secondary mb-1 block">Inject URL Params from Record Context</label>
                                   <input 
                                     className="input w-full font-mono text-[11px]" 
                                     placeholder="e.g. customer_id:familyId,email:ownerEmail" 
                                     value={(field.externalParams || []).map(p => `${p.paramName}:${p.sourceField}`).join(',')}
                                     onChange={e => {
                                       const parts = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                       const parsed = parts.map(p => {
                                          const [paramName, sourceField] = p.split(':');
                                          return { paramName: paramName?.trim(), sourceField: sourceField?.trim() };
                                       }).filter(p => p.paramName && p.sourceField);
                                       updateField(i, { externalParams: parsed });
                                     }}
                                   />
                                   <p className="text-[10px] text-tertiary mt-1">Comma mapped. Ex: <code>query:id</code> injects the current page record ID into <code>{`{{query}}`}</code>.</p>
                                 </div>
                                 <div className="flex-1">
                                   <label className="text-xs text-secondary mb-1 block">Visible Columns (Output Schema)</label>
                                   <input 
                                     className="input w-full font-mono text-[11px]" 
                                     placeholder="e.g. invoice_id:ID,amount:Total" 
                                     value={(field.externalColumns || []).map(c => `${c.key}:${c.label}`).join(',')}
                                     onChange={e => {
                                       const parts = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                       const parsed = parts.map(p => {
                                          const [key, label] = p.split(':');
                                          return { key: key?.trim(), label: label?.trim() || key?.trim() };
                                       }).filter(c => c.key);
                                       updateField(i, { externalColumns: parsed });
                                     }}
                                   />
                                   <p className="text-[10px] text-tertiary mt-1">Comma mapped. Json Key : UI Header Label.</p>
                                 </div>
                               </>
                             )}
                           </div>
                        </div>
                      )}

                      {field.type === 'automation_trigger' && (
                        <div style={{ flexBasis: '100%', marginTop: 8, padding: 12, background: 'var(--brand-50)', borderRadius: 8, border: '1px dashed var(--brand-400)' }}>
                           <h4 className="text-xs font-bold text-brand-700 uppercase mb-3">Automation Button Binding</h4>
                           <div className="flex gap-4">
                             <div className="flex-1">
                               <label className="text-xs text-brand-900 mb-1 block">Trigger Target (Automation Hub Flow)</label>
                               <select className="input w-full border-brand-200" value={field.lookupTarget || ''} onChange={e => updateField(i, { lookupTarget: e.target.value })}>
                                 <option value="">Select Published Workflow...</option>
                                 {automations.map(a => <option key={a.id} value={`flow:${a.id}`}>{a.name}</option>)}
                               </select>
                             </div>
                             <div className="flex-1">
                               <label className="text-xs text-brand-900 mb-1 block">Context Input Mappings</label>
                               <input 
                                 className="input w-full font-mono text-[11px] border-brand-200" 
                                 placeholder="e.g. email:userEmail, familyId:recordId" 
                                 value={(field.externalParams || []).map(p => `${p.paramName}:${p.sourceField}`).join(',')}
                                 onChange={e => {
                                   const parts = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                   const parsed = parts.map(p => {
                                      const [paramName, sourceField] = p.split(':');
                                      return { paramName: paramName?.trim(), sourceField: sourceField?.trim() };
                                   }).filter(p => p.paramName && p.sourceField);
                                   updateField(i, { externalParams: parsed });
                                 }}
                               />
                               <p className="text-[10px] text-brand-700 mt-1">Bind local CRM layout properties into the Automation pipeline inputs.</p>
                             </div>
                           </div>
                        </div>
                      )}
                   </div>
                 ))}
                 
                 <button 
                   onClick={addField}
                   style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px', background: 'var(--bg-canvas)', border: '1px dashed var(--border)', borderRadius: 8, justifyContent: 'center', color: 'var(--brand-500)', fontWeight: 600, cursor: 'pointer', marginTop: 8 }}
                 >
                   <Plus size={18} /> Add Custom Field
                 </button>
               </div>
             )}
           </div>
        </div>
      </div>
      )}

      {activeTab === 'catalog' && (
      <div className="card w-full" style={{ padding: 24 }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
           <div>
             <h2 className="text-lg font-bold flex items-center gap-2"><Database size={18} /> System Metadata Catalog</h2>
             <p className="text-sm text-secondary">JSON visualization of all defined Models and Layouts for this Tenant.</p>
           </div>
           <div style={{ display: 'flex', gap: 8 }}>
             <button className="btn btn-secondary btn-sm flex items-center gap-2" disabled={!catalog} onClick={handleExportCatalog}><Download size={14} /> Export JSON</button>
             <button className="btn btn-secondary btn-sm flex items-center gap-2"><Upload size={14} /> Import Config</button>
           </div>
         </div>
         
         {loading ? <div className="text-center py-10">Loading catalog...</div> : catalog ? (
           <div className="flex flex-col gap-6">
             <SystemCatalogExplorer catalog={catalog} />
             <div className="mt-8">
               <h3 className="text-md font-bold mb-3 border-b border-border pb-2">Raw JSON Export</h3>
               <pre style={{ background: 'var(--bg-slate-900)', color: 'var(--text-brand-100)', padding: 16, borderRadius: 8, overflowX: 'auto', fontSize: 12 }}>
                 {JSON.stringify(catalog, null, 2)}
               </pre>
             </div>
           </div>
         ) : (
           <div className="text-center py-10 text-secondary">System Catalog is empty. Save a schema first.</div>
         )}
      </div>
      )}

    </div>
  );
}
