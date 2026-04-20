'use client';

import { Search, FileType, Plus, LogOut, Loader2, ArrowLeft } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getTemplates, saveTemplate, deleteTemplate, type DocumentTemplate, type TemplateType } from '@/lib/templateService';
import { ConfirmDialog, type ConfirmOptions } from '@/components/ConfirmDialog';
import { RichTextEditor } from '@/components/ui/RichTextEditor';

function Chip({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8, background: color + '20', color, whiteSpace: 'nowrap' }}>{label}</span>;
}

function Msg({ text }: { text: React.ReactNode }) {
  if (!text) return null;
  const ok = typeof text === 'string' ? text.startsWith('✅') : true;
  return <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, background: ok ? '#22c55e15' : '#ef444415', color: ok ? '#22c55e' : '#ef4444', marginBottom: 12, wordBreak: 'break-word' }}>{text}</div>;
}

const TEMPLATE_ICONS: Record<TemplateType, string> = {
  invoice: '🧾',
  authorization_letter: '📝',
  other: '📄'
};

const TEMPLATE_LABELS: Record<TemplateType, string> = {
  invoice: 'Invoice',
  authorization_letter: 'Authorization Letter',
  other: 'Other Document'
};

export default function TemplatesPage() {
  const { user: me, tenant } = useAuth();
  const tenantId = tenant?.id ?? '';
  const performerUid = me?.uid ?? 'unknown';

  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTemplate, setActiveTemplate] = useState<Partial<DocumentTemplate> | null>(null);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const data = await getTemplates(tenantId);
      setTemplates(data);
    } catch (e: any) {
      setMsg('❌ Failed to load templates: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return templates.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()));
  }, [templates, search]);

  async function handleSave() {
    if (!activeTemplate?.name || !activeTemplate?.type) {
      setMsg('❌ Template Name and Type are required.');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      await saveTemplate(tenantId, activeTemplate as any, performerUid);
      setMsg('✅ Template saved successfully.');
      setActiveTemplate(null);
      await load();
    } catch (e: any) {
      setMsg('❌ ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  function doDelete(t: DocumentTemplate) {
    setConfirmOpts({
      title: 'Delete Template',
      message: `Are you sure you want to delete the template "${t.name}"? Active families using this template will fallback to default system generation.`,
      confirmLabel: 'Delete Template',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteTemplate(tenantId, t.id);
          setTemplates(p => p.filter(x => x.id !== t.id));
        } catch(e:any) { setMsg('❌ ' + e.message); }
      },
      onCancel: () => setConfirmOpts(null),
    });
  }

  if (activeTemplate) {
    return (
      <div className="page-wrapper animate-fade-in w-full px-4 lg:px-8 max-w-6xl mx-auto h-[calc(100vh-60px)] flex flex-col">
        <div className="flex items-center gap-4 py-4 border-b border-tremor-border shrink-0">
          <button onClick={() => setActiveTemplate(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{activeTemplate.id ? 'Edit Template' : 'New Template'}</h1>
            <p className="text-sm text-slate-500">Design the professional layout for PDF generation.</p>
          </div>
          <div className="ml-auto flex gap-3">
             <button onClick={() => setActiveTemplate(null)} className="btn btn-ghost px-5">Cancel</button>
             <button onClick={handleSave} disabled={saving} className="btn btn-primary px-6 border-0" style={{ background: 'var(--brand-500)' }}>
               {saving ? <Loader2 size={16} className="animate-spin" /> : '💾 Save Template'}
             </button>
          </div>
        </div>
        
        {msg && <div className="mt-4 shrink-0"><Msg text={msg} /></div>}

        <div className="grid grid-cols-3 gap-6 mt-6 shrink-0 mb-6">
           <div className="col-span-2">
             <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Template Name *</label>
             <input type="text" className="input w-full" placeholder="e.g. Q3 Custom Asset Invoice" value={activeTemplate.name || ''} onChange={e => setActiveTemplate({...activeTemplate, name: e.target.value})} />
           </div>
           <div>
             <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Template Type *</label>
             <select className="input w-full" value={activeTemplate.type || 'invoice'} onChange={e => setActiveTemplate({...activeTemplate, type: e.target.value as TemplateType})}>
                <option value="invoice">Invoice</option>
                <option value="authorization_letter">Authorization Letter</option>
                <option value="other">Other Document</option>
             </select>
           </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
           <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Document Builder</span>
              <div className="text-xs text-indigo-600 font-medium">Use AI ✨ or the (+) menu to inject dynamic merge fields like {'{{FamilyName}}'}.</div>
           </div>
           <RichTextEditor
             value={activeTemplate.htmlContent || ''}
             onChange={(html) => setActiveTemplate({...activeTemplate, htmlContent: html})}
             tenantId={tenantId}
             className="flex-1 rounded-none border-0 overflow-y-auto"
           />
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper animate-fade-in w-full px-4 lg:px-8 max-w-6xl mx-auto">
      {confirmOpts && <ConfirmDialog {...confirmOpts} />}
      
      <div className="py-6 flex items-start justify-between border-b border-tremor-border mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <FileType className="text-indigo-500" size={28} />
            Document Templates
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">
            Manage reusable templates for Invoices and Authorization letters. Once created here, they can be assigned directly to Families inside their Invoicing Settings.
          </p>
        </div>
        <button className="btn btn-primary flex items-center gap-2" style={{ background: 'var(--brand-500)', border: 'none' }} onClick={() => setActiveTemplate({ type: 'invoice', htmlContent: '' })}>
          <Plus size={16} /> Create Template
        </button>
      </div>

      <Msg text={msg} />

      <div className="flex gap-4 items-center mb-6">
        <div className="header-search cursor-text max-w-md w-full shrink-0 flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg bg-white">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates..." className="flex-1 min-w-0 bg-transparent border-none outline-none text-[13px] text-slate-900 placeholder-slate-400" />
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex items-center justify-center text-slate-400">
           <Loader2 className="animate-spin mr-2" /> Loading templates...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-slate-300 rounded-2xl bg-slate-50">
           <FileType className="mx-auto text-slate-300 mb-4" size={48} />
           <p className="text-slate-500 font-medium">No templates found.</p>
           <button className="mt-4 text-sm text-indigo-600 font-semibold" onClick={() => setActiveTemplate({ type: 'invoice', htmlContent: '' })}>Create the first template</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(t => (
            <div key={t.id} className="bg-white border text-left border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer flex flex-col group" onClick={() => setActiveTemplate(t)}>
               <div className="flex justify-between items-start mb-3">
                 <div className="text-3xl bg-slate-50 w-12 h-12 flex items-center justify-center rounded-lg">{TEMPLATE_ICONS[t.type] || '📄'}</div>
                 <Chip label={TEMPLATE_LABELS[t.type] || 'Other'} color={t.type === 'invoice' ? '#10b981' : t.type === 'authorization_letter' ? '#f59e0b' : '#6366f1'} />
               </div>
               <div className="font-bold text-slate-800 text-lg mb-1 truncate">{t.name}</div>
               <div className="text-xs text-slate-500 mb-6">Last edited: {new Date(t.updatedAt).toLocaleDateString()}</div>
               <div className="mt-auto flex justify-between items-center pt-4 border-t border-slate-100">
                 <span className="text-xs font-semibold text-indigo-600 group-hover:underline">Edit Template →</span>
                 <button className="text-slate-400 hover:text-red-500 transition-colors p-1" onClick={(e) => { e.stopPropagation(); doDelete(t); }}>
                    <LogOut className="rotate-180" size={16} /> {/* simple delete icon fallback */}
                 </button>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
