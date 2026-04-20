'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { can } from '@/lib/rbacService';
import { getDataModel, saveDataModel, getPageLayout, savePageLayout, CustomFieldDef, FieldType } from '@/lib/customizationService';
import { Settings2, X, AlertCircle, Plus, Type, Hash, Calendar, ToggleRight, Link2, LayoutTemplate } from 'lucide-react';
import { useUserSettings } from '@/lib/UserSettingsContext';
import { toast } from 'sonner';

interface Props {
  entityName: string;
  pageId: string;
}

const FIELD_PALETTE: { type: FieldType; icon: any; label: string; desc: string }[] = [
  { type: 'text', icon: Type, label: 'Text Input', desc: 'Short or long form text strings' },
  { type: 'number', icon: Hash, label: 'Number', desc: 'Numeric values, currency, or counts' },
  { type: 'date', icon: Calendar, label: 'Date', desc: 'Calendar date picker' },
  { type: 'boolean', icon: ToggleRight, label: 'Yes / No', desc: 'Switch or boolean toggle' },
  { type: 'lookup', icon: Link2, label: 'Data Lookup', desc: 'Link to another CRM entity record' }
];

export function LayoutCustomizer({ entityName, pageId }: Props) {
  const { tenant, authzContext, user } = useAuth();
  const { appDesignerMode } = useUserSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'layout' | 'build'>('layout');
  
  const [availableFields, setAvailableFields] = useState<CustomFieldDef[]>([]);
  const [visibleFields, setVisibleFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Builder State
  const [buildStep, setBuildStep] = useState<'select_type' | 'configure'>('select_type');
  const [selectedType, setSelectedType] = useState<FieldType | null>(null);
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    if (authzContext) {
      setHasAccess(can(authzContext, 'admin:app_layout') || !!authzContext?.role?.includes('admin'));
    }
  }, [authzContext]);

  useEffect(() => {
    if (isOpen && tenant?.id && hasAccess) {
      setLoading(true);
      Promise.all([
        getDataModel(tenant.id, entityName),
        getPageLayout(tenant.id, pageId)
      ]).then(([model, layout]) => {
        if (model?.fields) setAvailableFields(model.fields);
        if (layout?.visibleFields) setVisibleFields(layout.visibleFields);
      }).finally(() => setLoading(false));
    }
  }, [isOpen, tenant?.id, hasAccess, entityName, pageId]);

  const toggleField = (fieldId: string) => {
    if (visibleFields.includes(fieldId)) setVisibleFields(visibleFields.filter(f => f !== fieldId));
    else setVisibleFields([...visibleFields, fieldId]);
  };

  const createField = async () => {
    if (!tenant?.id || !user?.uid || !selectedType || !newLabel.trim()) return;
    
    // Generate snake_case ID from label
    let genId = newLabel.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (availableFields.some(f => f.id === genId)) {
       genId = `${genId}_${Math.floor(Math.random() * 1000)}`;
    }

    const newField: CustomFieldDef = {
       id: genId,
       label: newLabel.trim(),
       type: selectedType
    };

    setSaving(true);
    try {
      const updatedFields = [...availableFields, newField];
      // Push directly to DB Data Model Schema
      await saveDataModel(tenant.id, entityName, updatedFields, user.uid);
      
      // Update local state instantly
      setAvailableFields(updatedFields);
      setVisibleFields([...visibleFields, newField.id]);
      
      // Reset builder
      setNewLabel('');
      setSelectedType(null);
      setBuildStep('select_type');
      setActiveTab('layout'); // Jump back to layout view to see it checked
    } catch (e: any) {
      toast.error(`Failed to save field: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveLayout = async () => {
    if (!tenant?.id || !user?.uid) return;
    setSaving(true);
    try {
      await savePageLayout(tenant.id, pageId, visibleFields, user.uid);
      setIsOpen(false);
      window.location.reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!hasAccess || !appDesignerMode) return null;

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="btn btn-secondary btn-sm flex items-center gap-2 text-[var(--brand-600)] border-[var(--brand-200)] hover:bg-[var(--brand-50)]"
        style={{ borderRadius: 20 }}
      >
        <Settings2 size={14} /> Customize Layout
      </button>

      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setIsOpen(false)} />
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 380, background: 'var(--bg-surface)', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.3s ease-out' }}>
            
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-muted)' }}>
              <div>
                <h3 style={{ fontWeight: 800, fontSize: 18 }} className="text-[var(--text-primary)] flex items-center gap-2">
                  <LayoutTemplate size={20} className="text-[var(--brand-500)]" /> Studio Layout
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{pageId}</p>
              </div>
              <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex border-b border-[var(--border)] bg-[var(--bg-canvas)]">
              <button 
                onClick={() => setActiveTab('layout')}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'layout' ? 'border-[var(--brand-500)] text-[var(--brand-600)]' : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
              >
                Layout Editor
              </button>
              <button 
                onClick={() => { setActiveTab('build'); setBuildStep('select_type'); }}
                className={`flex-1 py-3 text-sm font-bold border-b-2 flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'build' ? 'border-[var(--brand-500)] text-[var(--brand-600)]' : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
              >
                <Plus size={14} /> Add New Field
              </button>
            </div>

            <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
              
              {loading ? (
                <div className="flex items-center justify-center h-full text-[var(--text-tertiary)]">Loading schema...</div>
              ) : activeTab === 'layout' ? (
                /* LAYOUT TAB */
                <>
                  <div style={{ padding: 12, background: 'var(--brand-50)', borderRadius: 8, display: 'flex', gap: 10, marginBottom: 24, border: '1px solid var(--brand-100)' }}>
                    <AlertCircle size={16} color="var(--brand-600)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: 13, color: 'var(--brand-800)', lineHeight: 1.4 }}>Select which extension fields should be visibly rendered on this CRM view. Ordering will follow selection sequence.</div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {availableFields.length === 0 ? (
                      <div className="text-center py-10 flex flex-col items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-[var(--bg-muted)] flex items-center justify-center text-[var(--text-tertiary)]"><LayoutTemplate size={24}/></div>
                        <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>No custom fields exist for {entityName}.</div>
                        <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('build')}>Create First Field</button>
                      </div>
                    ) : (
                      availableFields.map(f => {
                        const active = visibleFields.includes(f.id);
                        return (
                          <div 
                            key={f.id} 
                            onClick={() => toggleField(f.id)}
                            style={{ 
                              padding: '12px 16px', borderRadius: 8, cursor: 'pointer', border: '1px solid',
                              borderColor: active ? 'var(--brand-400)' : 'var(--border)',
                              background: active ? 'var(--bg-surface)' : 'var(--bg-canvas)',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              boxShadow: active ? '0 2px 4px rgba(0,0,0,0.02)' : 'none'
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14, color: active ? 'var(--brand-700)' : 'var(--text-primary)' }}>{f.label}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }} className="flex items-center gap-1">
                                <code>{f.id}</code> • {f.type}
                              </div>
                            </div>
                            <div>
                              <div style={{ width: 44, height: 24, borderRadius: 12, background: active ? 'var(--brand-500)' : 'var(--border)', position: 'relative', transition: '0.2s' }}>
                                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: active ? 22 : 2, transition: '0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </>
              ) : (
                /* BUILD TAB */
                <div className="flex flex-col h-full animate-fade-in">
                  {buildStep === 'select_type' && (
                    <>
                      <h4 className="font-bold text-sm text-[var(--text-primary)] mb-4">Select Field Component</h4>
                      <div className="flex flex-col gap-3">
                        {FIELD_PALETTE.map(pt => (
                          <button
                            key={pt.type}
                            onClick={() => { setSelectedType(pt.type); setBuildStep('configure'); }}
                            className="flex items-start gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--brand-400)] hover:bg-[var(--brand-50)] text-left transition-colors group"
                          >
                            <div className="w-10 h-10 rounded-lg bg-[var(--bg-canvas)] group-hover:bg-white border border-[var(--border)] group-hover:border-[var(--brand-200)] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[var(--brand-600)] shrink-0 transition-colors">
                              <pt.icon size={20} />
                            </div>
                            <div>
                              <div className="font-bold text-sm text-[var(--text-primary)] group-hover:text-[var(--brand-700)]">{pt.label}</div>
                              <div className="text-xs text-[var(--text-tertiary)] mt-1 leading-relaxed">{pt.desc}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {buildStep === 'configure' && selectedType && (
                    <div className="flex flex-col">
                       <button onClick={() => setBuildStep('select_type')} className="text-xs font-bold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] flex items-center gap-1 mb-6"><X size={12}/> Back to Types</button>
                       
                       <div className="p-4 rounded-xl border border-[var(--brand-200)] bg-[var(--brand-50)] flex gap-3 items-center mb-8">
                         {React.createElement(FIELD_PALETTE.find(x => x.type === selectedType)?.icon || Type, { size: 24, className: 'text-[var(--brand-600)]' })}
                         <div>
                            <div className="text-xs font-bold text-[var(--brand-800)] uppercase tracking-wider">Adding Field</div>
                            <div className="text-sm font-medium text-[var(--brand-600)]">{FIELD_PALETTE.find(x => x.type === selectedType)?.label}</div>
                         </div>
                       </div>

                       <div className="flex flex-col gap-2 mb-6">
                         <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Field Label *</label>
                         <input 
                           autoFocus
                           type="text" 
                           placeholder="e.g. Risk Appetite Score"
                           value={newLabel}
                           onChange={e => setNewLabel(e.target.value)}
                           className="flex h-11 w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm shadow-sm placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
                         />
                         <div className="text-[11px] text-[var(--text-tertiary)] mt-1">
                           Internal ID: <code className="bg-[var(--bg-canvas)] px-1 py-0.5 rounded text-[var(--text-primary)]">{newLabel.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') || '...'}</code>
                         </div>
                       </div>

                       <button 
                         onClick={createField}
                         disabled={!newLabel.trim() || saving}
                         className="btn btn-primary w-full py-3 mt-auto"
                       >
                         {saving ? 'Provisioning Schema...' : 'Create & Add to Layout'}
                       </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* STATIC FOOTER (Only for layout edits) */}
            {activeTab === 'layout' && (
              <div style={{ padding: 20, borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                <button 
                  onClick={saveLayout} 
                  disabled={saving || loading}
                  className="btn btn-primary bg-[var(--brand-600)] text-white hover:bg-[var(--brand-700)] shadow-sm" 
                  style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                >
                  {saving ? 'Applying...' : 'Save Layout & Reload Page'}
                </button>
                <div className="text-center text-[10px] text-[var(--text-tertiary)] mt-3">Requires page reload to mount new dynamic components</div>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
