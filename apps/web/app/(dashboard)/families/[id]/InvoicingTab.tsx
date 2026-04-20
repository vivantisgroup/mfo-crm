'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDocs, collection, updateDoc, setDoc } from 'firebase/firestore';
import { Save, Loader2, FileText, Landmark, Clock, Languages, DollarSign } from 'lucide-react';
import { getInstitutions, getInstitutionAccounts, type InternalBankAccount } from '@/lib/institutionService';
import { toast } from 'sonner';

export function InvoicingTab({ tenantId, familyId }: { tenantId: string, familyId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>({
    billingCycle: 'quarterly',
    invoiceLanguage: 'EN',
    defaultCurrency: 'USD',
    defaultInvoiceTemplateId: '',
    defaultAuthLetterTemplateId: '',
    defaultReceivingAccountId: ''
  });

  const [templates, setTemplates] = useState<any[]>([]);
  const [receivingAccounts, setReceivingAccounts] = useState<{ id: string, name: string, instName: string, curr: string }[]>([]);

  useEffect(() => {
    if (!tenantId || !familyId) return;

    // Load templates
    getDocs(collection(db, 'tenants', tenantId, 'templates')).then(snap => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Load receiving accounts
    getInstitutions(tenantId).then(async (insts) => {
       const recInsts = insts.filter(i => i.isReceivingBank);
       let allAccs: any[] = [];
       for (const ri of recInsts) {
          const subAccs = await getInstitutionAccounts(tenantId, ri.id);
          for (const sa of subAccs) {
            allAccs.push({
               id: `${ri.id}::${sa.id}`, // Compound ID for easy lookup
               name: sa.name,
               instName: ri.name,
               curr: sa.currency
            });
          }
       }
       setReceivingAccounts(allAccs);
    });

    const unsub = onSnapshot(doc(db, 'tenants', tenantId, 'invoicingProfiles', familyId), (snap) => {
      if (snap.exists()) {
        setConfig(snap.data());
      }
      setLoading(false);
    });

    return () => unsub();
  }, [tenantId, familyId]);

  async function handleSave() {
     setSaving(true);
     try {
       await setDoc(doc(db, 'tenants', tenantId, 'invoicingProfiles', familyId), config, { merge: true });
     } catch (err: any) {
       toast.error(err.message);
     }
     setSaving(false);
  }

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin inline mr-2 text-slate-400"/> Loading Invoicing Profile...</div>;

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
       <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div>
               <h3 className="font-bold text-slate-800 flex items-center gap-2">
                 <FileText size={18} className="text-indigo-500" /> Invoicing Parameters
               </h3>
               <p className="text-xs text-slate-500 mt-1">Configure default billing behaviors for this Family Group to be used during Statement Cycles.</p>
            </div>
            <button className="btn btn-primary bg-indigo-600 border-none flex items-center gap-2" onClick={handleSave} disabled={saving}>
               {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Overrides
            </button>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
             {/* General Defaults */}
             <div className="col-span-2 md:col-span-1 space-y-5">
                <div className="font-bold text-sm text-slate-800 border-b pb-2 mb-3">Cycle Economics</div>
                
                <div>
                   <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      <Clock size={14}/> Default Billing Period
                   </label>
                   <select className="input w-full" value={config.billingCycle} onChange={e => setConfig({...config, billingCycle: e.target.value})}>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="semiannual">Semi-Annual</option>
                      <option value="annual">Annual</option>
                   </select>
                </div>
                
                <div>
                   <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      <DollarSign size={14}/> Preferred Presentation Currency
                   </label>
                   <select className="input w-full font-mono" value={config.defaultCurrency} onChange={e => setConfig({...config, defaultCurrency: e.target.value})}>
                      <option value="USD">USD</option>
                      <option value="BRL">BRL</option>
                      <option value="EUR">EUR</option>
                      <option value="CHF">CHF</option>
                   </select>
                </div>
                
                <div>
                   <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      <Languages size={14}/> Document Language
                   </label>
                   <select className="input w-full" value={config.invoiceLanguage} onChange={e => setConfig({...config, invoiceLanguage: e.target.value})}>
                      <option value="EN">English (EN)</option>
                      <option value="PT">Portuguese (PT)</option>
                      <option value="ES">Spanish (ES)</option>
                   </select>
                </div>
             </div>

             {/* Templates & Routing */}
             <div className="col-span-2 md:col-span-1 space-y-5">
                <div className="font-bold text-sm text-slate-800 border-b pb-2 mb-3">Templates & Routing</div>
                
                <div>
                   <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      <FileText size={14}/> Default Invoice Template
                   </label>
                   <select className="input w-full" value={config.defaultInvoiceTemplateId} onChange={e => setConfig({...config, defaultInvoiceTemplateId: e.target.value})}>
                      <option value="">-- Let system decide --</option>
                      {templates.filter(t => t.type === 'invoice').map(t => (
                         <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                   </select>
                </div>

                <div>
                   <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      <FileText size={14}/> Authorization Letter Template
                   </label>
                   <select className="input w-full" value={config.defaultAuthLetterTemplateId} onChange={e => setConfig({...config, defaultAuthLetterTemplateId: e.target.value})}>
                      <option value="">-- None / N/A --</option>
                      {templates.filter(t => t.type === 'auth_letter').map(t => (
                         <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                   </select>
                </div>

                <div>
                   <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      <Landmark size={14}/> Default Internal Receiving Bank
                   </label>
                   <select className="input w-full" value={config.defaultReceivingAccountId} onChange={e => setConfig({...config, defaultReceivingAccountId: e.target.value})}>
                      <option value="">-- Let system decide based on Currency --</option>
                      {receivingAccounts.map(ra => (
                         <option key={ra.id} value={ra.id}>[{ra.curr}] {ra.instName} - {ra.name}</option>
                      ))}
                   </select>
                   <p className="text-[10px] text-slate-400 mt-1">If blank, the system will select the mapped Default Receiving Account for the invoice's target currency.</p>
                </div>

             </div>

             <div className="col-span-2 mt-4 pt-4 border-t border-slate-100">
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-800">
                   <strong>Note:</strong> These settings are used as defaults when assembling a new Billing Cycle. You will still be able to override them on a per-invoice basis from the master Faturamento Matrix.
                </div>
             </div>
          </div>
       </div>
    </div>
  )
}
