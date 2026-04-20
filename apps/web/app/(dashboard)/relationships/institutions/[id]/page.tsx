'use client';

import { Building, Plus, ArrowLeft, ArrowRight, Loader2, Save, Trash2, Landmark, DollarSign, MapPin, Search } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getInstitutions, getInstitutionAccounts, saveInstitutionAccount, deleteInstitutionAccount, type FinancialInstitution, type InternalBankAccount } from '@/lib/institutionService';
import { ConfirmDialog, type ConfirmOptions } from '@/components/ConfirmDialog';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function Msg({ text }: { text: React.ReactNode }) {
  if (!text) return null;
  const ok = typeof text === 'string' ? text.startsWith('✅') : true;
  return <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, background: ok ? '#22c55e15' : '#ef444415', color: ok ? '#22c55e' : '#ef4444', marginBottom: 12, wordBreak: 'break-word' }}>{text}</div>;
}

function AccountModal({ tenantId, instId, acc, onClose, onSaved }: { tenantId: string, instId: string, acc?: InternalBankAccount, onClose: () => void, onSaved: () => void }) {
  const [form, setForm] = useState<Partial<InternalBankAccount>>({
    name: acc?.name || '',
    currency: acc?.currency || 'USD',
    accountName: acc?.accountName || '',
    accountNumber: acc?.accountNumber || '',
    routingNumber: acc?.routingNumber || '',
    iban: acc?.iban || '',
    swiftOveride: acc?.swiftOveride || '',
    notes: acc?.notes || '',
    isDefaultReceiving: acc?.isDefaultReceiving || false
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.currency || !form.accountNumber) {
        setMsg('❌ Name, Currency, and Account Number are required.');
        return;
    }
    setSaving(true);
    try {
      await saveInstitutionAccount(tenantId, instId, { ...(acc || {}), ...(form as any) });
      onSaved();
    } catch(err:any) {
      setMsg('❌ ' + err.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 my-auto">
        <form onSubmit={handleSave}>
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Landmark size={20} className="text-indigo-500" />
                {acc ? 'Edit Account' : 'Register New Account'}
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <Msg text={msg} />
            <div className="grid grid-cols-2 gap-5">
               <div className="col-span-2 md:col-span-1">
                 <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Account Nickname *</label>
                 <input autoFocus required type="text" className="input w-full" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Master USD Operations" />
               </div>
               <div className="col-span-2 md:col-span-1">
                 <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Currency *</label>
                 <select required className="input w-full font-mono" value={form.currency} onChange={e => setForm({...form, currency: e.target.value})}>
                     <option value="USD">USD - US Dollar</option>
                     <option value="BRL">BRL - Brazilian Real</option>
                     <option value="EUR">EUR - Euro</option>
                     <option value="CHF">CHF - Swiss Franc</option>
                     <option value="GBP">GBP - British Pound</option>
                 </select>
               </div>

               <div className="col-span-2">
                 <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Target Name (Account Holder)</label>
                 <input type="text" className="input w-full" value={form.accountName} onChange={e => setForm({...form, accountName: e.target.value})} placeholder="Legal name on the account" />
               </div>

               <div className="col-span-2 md:col-span-1">
                 <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Account Number *</label>
                 <input required type="text" className="input w-full font-mono text-sm" value={form.accountNumber} onChange={e => setForm({...form, accountNumber: e.target.value})} />
               </div>
               <div className="col-span-2 md:col-span-1">
                 <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Routing / ABA / Sort Code</label>
                 <input type="text" className="input w-full font-mono text-sm" value={form.routingNumber} onChange={e => setForm({...form, routingNumber: e.target.value})} />
               </div>

               <div className="col-span-2 md:col-span-1">
                 <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">IBAN</label>
                 <input type="text" className="input w-full font-mono text-sm" value={form.iban} onChange={e => setForm({...form, iban: e.target.value})} placeholder="International Bank Acct Num" />
               </div>
               <div className="col-span-2 md:col-span-1">
                 <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">SWIFT Override</label>
                 <input type="text" className="input w-full font-mono text-sm" value={form.swiftOveride} onChange={e => setForm({...form, swiftOveride: e.target.value})} placeholder="Only if diff from Institution" />
               </div>

               <div className="col-span-2">
                 <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Internal Notes / Instructions</label>
                 <textarea className="input w-full text-sm min-h-[80px]" value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} placeholder="'FFC: Account Name' or specific reference instructions..." />
               </div>

               <div className="col-span-2 mt-2">
                  <label className="flex items-center gap-3 cursor-pointer group bg-slate-50 border border-slate-200 p-3 rounded-lg hover:border-indigo-300 transition-colors">
                    <input type="checkbox" className="w-5 h-5 cursor-pointer accent-indigo-600 rounded" checked={form.isDefaultReceiving} onChange={e => setForm({...form, isDefaultReceiving: e.target.checked})} />
                    <div>
                      <div className="text-sm font-bold text-slate-800">Set as Primary Receiving Account</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Will be the default suggested account for invoice generation for this currency.</div>
                    </div>
                  </label>
               </div>
            </div>
          </div>
          <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 rounded-b-2xl border-t border-slate-100">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary bg-indigo-600 border-none px-6" disabled={saving}>
              {saving ? 'Saving...' : 'Save Routing Info'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InstitutionDetailPage() {
  const params = useParams() as { id: string };
  const { tenant } = useAuth();
  const tenantId = tenant?.id ?? '';
  const router = useRouter();

  const [institution, setInstitution] = useState<FinancialInstitution | null>(null);
  const [accounts, setAccounts] = useState<InternalBankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<Partial<InternalBankAccount> | null>(null);
  const [msg, setMsg] = useState('');
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null);

  const load = useCallback(async () => {
    if (!tenantId || !params.id) return;
    setLoading(true);
    try {
      // Find the specific institution from the collection.
      const all = await getInstitutions(tenantId);
      const target = all.find(x => x.id === params.id);
      if (!target) throw new Error("Institution not found or deleted.");
      setInstitution(target);

      const accs = await getInstitutionAccounts(tenantId, params.id);
      setAccounts(accs);
    } catch (e: any) {
      setMsg('❌ ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId, params.id]);

  useEffect(() => { load(); }, [load]);

  function doDelete(acc: InternalBankAccount) {
    setConfirmOpts({
      title: 'Delete Account',
      message: `Remove account ${acc.name} (${acc.accountNumber})? Invoices pointing to this account will lose their reference.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteInstitutionAccount(tenantId, params.id, acc.id);
          setAccounts(p => p.filter(x => x.id !== acc.id));
        } catch(e:any) { setMsg('❌ ' + e.message); }
      },
      onCancel: () => setConfirmOpts(null),
    });
  }

  if (loading) {
    return <div className="p-20 text-center"><Loader2 className="animate-spin inline mr-2 text-slate-400" /></div>;
  }

  if (!institution) {
     return <div className="p-20 text-center text-slate-500">Institution not found. <Link href="/relationships/institutions" className="text-indigo-600 underline">Go Back</Link></div>;
  }

  return (
    <div className="page-wrapper animate-fade-in w-full px-4 lg:px-8 max-w-6xl mx-auto pb-20">
      {confirmOpts && <ConfirmDialog {...confirmOpts} />}
      {showForm && (
        <AccountModal 
          tenantId={tenantId}
          instId={params.id}
          acc={showForm.id ? showForm as InternalBankAccount : undefined}
          onClose={() => setShowForm(null)}
          onSaved={() => { setShowForm(null); load(); setMsg('✅ Bank account saved.'); }}
        />
      )}
      
      <div className="py-2 mb-6 border-b border-slate-200">
         <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-4 hover:text-indigo-600 cursor-pointer w-fit transition-colors pt-4" onClick={() => router.push('/relationships/institutions')}>
            <ArrowLeft size={16} /> Back to Institutions
         </div>
         
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6">
            <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-slate-100 border border-slate-200 text-slate-400 rounded-xl flex items-center justify-center shadow-inner">
                   <Building size={32} />
                </div>
                <div>
                   <h1 className="text-3xl font-black text-slate-900 leading-tight tracking-tight">{institution.name}</h1>
                   <div className="flex items-center gap-4 mt-2">
                      {institution.bicSwift && <span className="font-mono text-xs bg-slate-100 border border-slate-200 text-slate-500 px-2.5 py-1 rounded-md shadow-sm flex items-center gap-1"><ArrowRight size={12}/> SWIFT: {institution.bicSwift}</span>}
                      {institution.country && <span className="text-xs font-bold text-slate-500 flex items-center gap-1"><MapPin size={12}/> {institution.country}</span>}
                   </div>
                </div>
            </div>
            
            <div className="flex gap-2">
                 {institution.isReceivingBank && <span className="text-xs font-bold bg-green-100 text-green-700 px-3 py-1.5 rounded-lg border border-green-200 shadow-sm flex items-center gap-1.5"><DollarSign size={14}/> Internal Receiving Bank</span>}
                 {institution.isIntermediary && <span className="text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200 shadow-sm">Intermediary</span>}
            </div>
         </div>
      </div>

      <Msg text={msg} />

      <div className="flex items-center justify-between mt-8 mb-6">
         <div>
             <h2 className="text-lg font-bold text-slate-800">Associated Bank Accounts</h2>
             <p className="text-xs text-slate-500">Routing instructions, sub-accounts, and escrow nodes linked to this institution.</p>
         </div>
         <button className="btn btn-secondary bg-white shadow-sm flex items-center gap-2" onClick={() => setShowForm({ currency: 'USD' })}>
            <Plus size={16} /> Add Account
         </button>
      </div>

      {accounts.length === 0 ? (
         <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl py-16 flex flex-col items-center justify-center text-center px-4">
            <Landmark size={40} className="text-slate-300 mb-4" />
            <div className="text-slate-600 font-bold">No accounts registered</div>
            <div className="text-sm text-slate-500 mt-1 max-w-sm">You haven't setup any routing instructions or sub-accounts for this institution yet.</div>
            <button className="mt-6 font-bold text-indigo-600 text-sm hover:underline" onClick={() => setShowForm({ currency: 'USD' })}>+ Map First Account</button>
         </div>
      ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {accounts.map(a => (
               <div key={a.id} className="bg-white border text-left border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all flex flex-col pt-5">
                  <div className="flex justify-between items-start mb-4 px-5">
                     <div>
                        <div className="flex items-center gap-2 mb-1">
                           <div className="font-bold text-slate-800 text-lg leading-none">{a.name}</div>
                           {a.isDefaultReceiving && <span className="bg-indigo-100 text-indigo-700 text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border border-indigo-200">Default</span>}
                        </div>
                        <div className="text-xs text-slate-500">{a.accountName || 'No Specific Account Holder Name'}</div>
                     </div>
                     <div className="bg-slate-100 border border-slate-200 text-slate-700 font-black text-sm px-2 py-1 rounded w-12 text-center shadow-inner shrink-0">
                        {a.currency}
                     </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-y-4 gap-x-2 px-5 py-4 bg-slate-50/50 border-t border-slate-100 text-xs">
                     <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider">Account Number</div>
                        <div className="font-mono font-bold text-slate-700 text-sm">{a.accountNumber}</div>
                     </div>
                     <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider">ABA / Routing</div>
                        <div className="font-mono text-slate-600">{a.routingNumber || '-'}</div>
                     </div>
                     {a.iban && (
                        <div className="col-span-2">
                           <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider">IBAN</div>
                           <div className="font-mono text-slate-600 tracking-tight">{a.iban}</div>
                        </div>
                     )}
                     {a.swiftOveride && (
                        <div className="col-span-2">
                           <div className="text-[10px] uppercase font-bold text-indigo-400 mb-1 tracking-wider">Custom SWIFT</div>
                           <div className="font-mono text-indigo-900 tracking-tight bg-indigo-50 px-2 py-1 border border-indigo-100 rounded inline-block">{a.swiftOveride}</div>
                        </div>
                     )}
                  </div>
                  
                  <div className="mt-auto flex justify-between items-center py-3 px-4 border-t border-slate-100 bg-white rounded-b-xl border-dashed">
                    <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800 px-2 py-1 -ml-2 rounded hover:bg-indigo-50 transition-colors" onClick={() => setShowForm(a)}>
                       Edit Routing
                    </button>
                    <button className="text-slate-400 hover:text-red-500 transition-colors p-1.5 -mr-1.5 rounded-md hover:bg-red-50" onClick={() => doDelete(a)}>
                       <Trash2 size={16} />
                    </button>
                  </div>
               </div>
            ))}
         </div>
      )}
    </div>
  );
}
