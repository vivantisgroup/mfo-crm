'use client';

import { Search, Building, Plus, Landmark, PiggyBank, Briefcase, FileSignature, ArrowRight, Loader2 } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getInstitutions, saveInstitution, deleteInstitution, type FinancialInstitution } from '@/lib/institutionService';
import { ConfirmDialog, type ConfirmOptions } from '@/components/ConfirmDialog';
import Link from 'next/link';

function Chip({ label, color, solid }: { label: string; color: string; solid?: boolean }) {
  if (!label) return null;
  return (
    <span style={{ 
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8, 
      background: solid ? color : color + '20', 
      color: solid ? '#fff' : color, 
      whiteSpace: 'nowrap' 
    }}>
      {label}
    </span>
  );
}

function Msg({ text }: { text: React.ReactNode }) {
  if (!text) return null;
  const ok = typeof text === 'string' ? text.startsWith('✅') : true;
  return <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, background: ok ? '#22c55e15' : '#ef444415', color: ok ? '#22c55e' : '#ef4444', marginBottom: 12, wordBreak: 'break-word' }}>{text}</div>;
}

const INST_TYPES = {
  bank: { label: 'Commercial Bank', icon: <Landmark size={20} />, color: '#3b82f6' },
  custodian: { label: 'Custodian', icon: <PiggyBank size={20} />, color: '#10b981' },
  broker: { label: 'Broker/Dealer', icon: <Briefcase size={20} />, color: '#f59e0b' },
  trust_company: { label: 'Trust Company', icon: <FileSignature size={20} />, color: '#8b5cf6' },
};

function InstFormModal({ tenantId, inst, onClose, onSaved }: { tenantId: string, inst?: FinancialInstitution, onClose: () => void, onSaved: () => void }) {
  const [form, setForm] = useState<Partial<FinancialInstitution>>({
    name: inst?.name || '',
    type: inst?.type || 'bank',
    isReceivingBank: inst?.isReceivingBank || false,
    isIntermediary: inst?.isIntermediary || false,
    bicSwift: inst?.bicSwift || '',
    country: inst?.country || ''
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    try {
      await saveInstitution(tenantId, { ...(inst || {}), ...(form as any) });
      onSaved();
    } catch(err:any) {
      setMsg('❌ ' + err.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <form onSubmit={handleSave}>
          <div className="px-6 py-5 border-b border-slate-100">
            <h3 className="text-xl font-bold text-slate-800">{inst ? 'Edit Institution' : 'New Financial Institution'}</h3>
          </div>
          <div className="p-6 space-y-4">
            <Msg text={msg} />
            <div className="grid grid-cols-2 gap-4">
               <div className="col-span-2">
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Legal/Entity Name *</label>
                 <input autoFocus required type="text" className="input w-full" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. JPMorgan Chase Bank N.A." />
               </div>
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Primary Type</label>
                 <select className="input w-full" value={form.type} onChange={e => setForm({...form, type: e.target.value as any})}>
                   {Object.entries(INST_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                 </select>
               </div>
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Country Origin</label>
                 <input type="text" className="input w-full" value={form.country} onChange={e => setForm({...form, country: e.target.value})} placeholder="e.g. US, CH, BR" />
               </div>
               <div className="col-span-2">
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">BIC / SWIFT Code</label>
                 <input type="text" className="input w-full" value={form.bicSwift} onChange={e => setForm({...form, bicSwift: e.target.value.toUpperCase()})} placeholder="8 or 11 characters" />
               </div>
            </div>
            
            <div className="mt-4 p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 space-y-3">
              <div className="text-xs font-extrabold text-indigo-800 uppercase tracking-wider">System Role Flags</div>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" className="mt-1 w-4 h-4 cursor-pointer accent-indigo-600" checked={form.isReceivingBank} onChange={e => setForm({...form, isReceivingBank: e.target.checked})} />
                <div>
                  <div className="text-sm font-bold text-slate-800 group-hover:text-indigo-700">Is Internal Receiving Bank</div>
                  <div className="text-xs text-slate-500">Check this if this institution holds accounts where YOU (the MFO) receive advisory or performance fees.</div>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" className="mt-1 w-4 h-4 cursor-pointer accent-indigo-600" checked={form.isIntermediary} onChange={e => setForm({...form, isIntermediary: e.target.checked})} />
                <div>
                  <div className="text-sm font-bold text-slate-800 group-hover:text-indigo-700">Is Intermediary Bank</div>
                  <div className="text-xs text-slate-500">Check this if this bank is frequently used as a routing intermediary for international wires.</div>
                </div>
              </label>
            </div>
          </div>
          <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 rounded-b-2xl border-t border-slate-100">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary bg-indigo-600 border-none px-6" disabled={saving}>
              {saving ? 'Saving...' : 'Save Institution'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InstitutionsHubPage() {
  const { tenant } = useAuth();
  const tenantId = tenant?.id ?? '';

  const [institutions, setInstitutions] = useState<FinancialInstitution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState<Partial<FinancialInstitution> | null>(null);
  const [msg, setMsg] = useState('');
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const data = await getInstitutions(tenantId);
      setInstitutions(data);
    } catch (e: any) {
      setMsg('❌ Failed to load institutions: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return institutions.filter(i => {
      const q = search.toLowerCase();
      return !q || i.name.toLowerCase().includes(q) || (i.bicSwift && i.bicSwift.toLowerCase().includes(q));
    });
  }, [institutions, search]);

  function doDelete(inst: FinancialInstitution) {
    setConfirmOpts({
      title: 'Delete Institution',
      message: `Are you sure you want to delete "${inst.name}"? This may break billing configurations if accounts are actively linked.`,
      confirmLabel: 'Delete Institution',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteInstitution(tenantId, inst.id);
          setInstitutions(p => p.filter(x => x.id !== inst.id));
        } catch(e:any) { setMsg('❌ ' + e.message); }
      },
      onCancel: () => setConfirmOpts(null),
    });
  }

  return (
    <div className="page-wrapper animate-fade-in w-full px-4 lg:px-8 max-w-6xl mx-auto pb-20">
      {confirmOpts && <ConfirmDialog {...confirmOpts} />}
      {showForm && (
        <InstFormModal 
          tenantId={tenantId}
          inst={showForm as any}
          onClose={() => setShowForm(null)}
          onSaved={() => { setShowForm(null); load(); setMsg('✅ Institution saved.'); }}
        />
      )}
      
      <div className="py-6 flex flex-col md:flex-row md:items-center justify-between border-b border-tremor-border mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <Building className="text-indigo-500" size={28} />
            Financial Institutions
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">
            Master registry of banks, custodians, and brokers. Flag internal receiving banks to wire up invoice routing, or track intermediary SWIFTs.
          </p>
        </div>
        <button className="btn btn-primary flex items-center gap-2 shrink-0" style={{ background: 'var(--brand-500)', border: 'none' }} onClick={() => setShowForm({ type: 'bank', isIntermediary: false, isReceivingBank: false })}>
          <Plus size={16} /> Register Institution
        </button>
      </div>

      <Msg text={msg} />

      <div className="flex gap-4 items-center mb-6">
        <div className="header-search cursor-text max-w-md w-full shrink-0 flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg bg-white">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or SWIFT..." className="flex-1 min-w-0 bg-transparent border-none outline-none text-[13px] text-slate-900 placeholder-slate-400" />
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex items-center justify-center text-slate-400">
           <Loader2 className="animate-spin mr-2" /> Loading registry...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-slate-300 rounded-2xl bg-slate-50">
           <Landmark className="mx-auto text-slate-300 mb-4" size={48} />
           <p className="text-slate-500 font-medium pb-4">No financial institutions found.</p>
           <button className="text-sm font-bold bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm text-indigo-600 hover:border-indigo-500" onClick={() => setShowForm({})}>Register the first Bank</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(i => {
             const typeConf = INST_TYPES[i.type] || INST_TYPES.bank;
             return (
              <Link key={i.id} href={`/relationships/institutions/${i.id}`} className="bg-white border text-left border-slate-200 rounded-xl p-5 hover:border-indigo-400 hover:shadow-lg transition-all flex flex-col group block">
                 <div className="flex justify-between items-start mb-3">
                   <div className="w-10 h-10 flex flex-col items-center justify-center rounded-lg shadow-sm border border-slate-100" style={{ background: typeConf.color + '15', color: typeConf.color }}>
                      {typeConf.icon}
                   </div>
                   <div className="flex gap-1">
                      {i.isReceivingBank && <Chip label="Receiving" color="#10b981" solid />}
                      {i.isIntermediary && <Chip label="Interm." color="#f59e0b" />}
                   </div>
                 </div>
                 
                 <div className="font-bold text-slate-800 text-lg mb-1 truncate leading-tight group-hover:text-indigo-700">{i.name}</div>
                 
                 <div className="flex items-center gap-3 mt-1 mb-6">
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{typeConf.label}</span>
                    {i.country && <span className="text-xs font-bold text-slate-400">{i.country}</span>}
                 </div>
                 
                 <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-4 mt-auto">
                    <div>
                      <div className="text-slate-400 font-medium">SWIFT / BIC</div>
                      <div className="font-mono text-slate-700">{i.bicSwift || 'N/A'}</div>
                    </div>
                    <div className="text-right flex flex-col justify-end">
                       <div className="text-indigo-600 font-bold flex items-center justify-end gap-1 group-hover:translate-x-1 transition-transform">
                          Accounts <ArrowRight size={14} />
                       </div>
                    </div>
                 </div>
              </Link>
             );
          })}
        </div>
      )}
    </div>
  );
}
