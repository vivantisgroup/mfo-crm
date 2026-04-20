'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { X, Clock, FileText, CheckCircle, ArrowRight, Loader2, PlayCircle, DollarSign, ExternalLink, Calculator } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { renderPDF } from './pdfEngine'; // A stub that we'll implement next
import CalculationMemoryTab from './CalculationMemoryTab';
import PdfDossierAssembler from './PdfDossierAssembler';
import { toast } from 'sonner';

export default function InvoiceDetailModal({
  tenantId,
  cycleId,
  rowId,
  onClose
}: {
  tenantId: string;
  cycleId: string;
  rowId: string;
  onClose: () => void;
}) {
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'memory'>('overview');
  
  // Template Selection State
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  useEffect(() => {
    async function load() {
       const snap = await getDoc(doc(db, 'tenants', tenantId, 'billing_cycles', cycleId, 'invoices', rowId));
       if (snap.exists()) {
          const r = { id: snap.id, ...snap.data() } as any;
          setRow(r);
          
          if (r.targetType === 'family') {
             const cfgSnap = await getDoc(doc(db, 'tenants', tenantId, 'invoicingProfiles', r.targetId));
             if (cfgSnap.exists()) {
                setConfig(cfgSnap.data());
             }
          }
       }
       
       // Load Templates
       try {
           const tSnap = await getDocs(collection(db, 'tenants', tenantId, 'templates'));
           setTemplates(tSnap.docs.map(d => ({id: d.id, ...d.data()})));
       } catch(e) {
           console.log("Could not load templates", e);
       }

       setLoading(false);
    }
    load();
  }, [tenantId, cycleId, rowId]);

  const recordTime = async (field: string) => {
     if (!row) return;
     const now = Date.now();
     const updates: any = { [field]: now };
     
     // Calculate total time spent if it's the final stage (NF Emitted)
     if (field === 'opNfEmittedAt' && row.opStartedAt) {
         updates.opTimeSpentMinutes = Math.floor((now - row.opStartedAt) / 60000);
     }
     
     await updateDoc(doc(db, 'tenants', tenantId, 'billing_cycles', cycleId, 'invoices', rowId), updates);
     setRow({ ...row, ...updates });
  };

  const handleGenerateClick = () => {
      setSelectedTemplateId(config?.defaultInvoiceTemplateId || (templates[0]?.id || ''));
      setShowTemplateModal(true);
  };

  const handleGenerateInvoice = async () => {
      if (!selectedTemplateId) {
          toast.error('Select or enter a template ID');
          return;
      }
      setShowTemplateModal(false);
      setGenerating(true);
      try {
         const tmplSnap = await getDoc(doc(db, 'tenants', tenantId, 'templates', selectedTemplateId));
         if (!tmplSnap.exists()) throw new Error("Template not found in registry.");
         
         const pdfHtml = renderPDF(tmplSnap.data().content, {
             targetName: row.targetName,
             aumUsd: (row.aumOffshore + row.aumOnshore).toFixed(2), // Simplification
             totalBrl: (row.recBrl + row.adjBrl).toFixed(2),
             totalUsd: (row.recUsd + row.recEur + row.adjUsd).toFixed(2), // Using parity for demonstration
             date: formatDate(new Date().toISOString())
         });

         const win = window.open('', '_blank');
         if (win) {
             win.document.write(pdfHtml);
             win.document.close();
         }
         
         await updateDoc(doc(db, 'tenants', tenantId, 'billing_cycles', cycleId, 'invoices', rowId), {
             invoiceEmittedLabel: `INV-${Date.now().toString().slice(-4)}`,
             opInvoiceEmittedAt: Date.now()
         });
         setRow({ ...row, invoiceEmittedLabel: `INV-${Date.now().toString().slice(-4)}`, opInvoiceEmittedAt: Date.now() });
      } catch (e: any) {
         toast.error("Generation Error: " + e.message);
      }
      setGenerating(false);
  };

  if (loading) return (
     <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center">
       <Loader2 className="animate-spin text-white w-8 h-8" />
     </div>
  );

  if (!row) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" onClick={(e) => { if(e.target===e.currentTarget) onClose(); }}>
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 border-b border-slate-200 bg-slate-50 flex flex-col justify-between">
           <div className="flex justify-between items-center py-5">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center shadow-inner">
                    <FileText size={24} />
                  </div>
                  <div>
                     <div className="text-xs font-black text-slate-400 uppercase tracking-wider mb-0.5">Invoice Dossier</div>
                     <h2 className="text-xl font-bold text-slate-800">{row.targetName}</h2>
                  </div>
               </div>
               <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                  <X size={20} />
               </button>
           </div>
           
           {/* Tab Navigation */}
           <div className="flex items-center gap-6 mt-2">
               <button 
                  onClick={() => setActiveTab('overview')} 
                  className={`py-3 px-1 text-sm font-bold border-b-2 transition-colors ${activeTab === 'overview' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
               >
                  Dossier & Operations
               </button>
               <button 
                  onClick={() => setActiveTab('memory')} 
                  className={`py-3 px-1 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'memory' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
               >
                  <Calculator size={16} /> Memória de Cálculo
               </button>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
           {activeTab === 'memory' && (
               <CalculationMemoryTab tenantId={tenantId} cycleId={cycleId} row={row} />
           )}
           
           {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Left Column: Economics & Config */}
              <div className="md:col-span-2 space-y-6">
                  
                  {/* Economics Summary */}
                  <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5">
                      <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4 text-sm flex items-center gap-2"><DollarSign size={16}/> Financial Summary Snapshot</h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                         <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                           <div className="text-xs text-slate-500 font-medium">Offshore AUM Mapped</div>
                           <div className="text-xl font-black text-slate-800 mt-1">US$ {formatCurrency(row.aumOffshore)}</div>
                         </div>
                         <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                           <div className="text-xs text-slate-500 font-medium">Onshore AUM Mapped</div>
                           <div className="text-xl font-black text-slate-800 mt-1">R$ {formatCurrency(row.aumOnshore)}</div>
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
                         <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                           <div className="text-xs text-emerald-700 font-bold">Total Billable (USD/EUR)</div>
                           <div className="text-xl font-black text-emerald-900 mt-1">US$ {formatCurrency(row.recUsd + row.recEur + row.adjUsd)}</div>
                         </div>
                         <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                           <div className="text-xs text-emerald-700 font-bold">Total Billable (BRL)</div>
                           <div className="text-xl font-black text-emerald-900 mt-1">R$ {formatCurrency(row.recBrl + row.adjBrl)}</div>
                         </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-100">
                         <label className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 block">Adjustment Justification / Notes</label>
                         <textarea 
                            className="w-full text-sm border border-slate-200 rounded-lg p-3 text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                            rows={3}
                            placeholder="If adjustments were applied to the standard calculation, internally justify them here..."
                            value={row.adjDescription || ''}
                            onChange={(e) => setRow({...row, adjDescription: e.target.value})}
                            onBlur={async (e) => {
                               await updateDoc(doc(db, 'tenants', tenantId, 'billing_cycles', cycleId, 'invoices', rowId), {
                                  adjDescription: e.target.value
                               });
                            }}
                         />
                      </div>
                  </div>

                  {/* Operational Settings Profile */}
                  <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5">
                      <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4 text-sm">Family Invoicing Profile Data</h3>
                      
                      {config ? (
                         <div className="grid grid-cols-2 gap-y-4 text-sm">
                            <div><span className="text-slate-500 font-bold">Cycle Config:</span> <span className="capitalize">{config.billingCycle}</span></div>
                            <div><span className="text-slate-500 font-bold">Currency Pref:</span> <span>{config.defaultCurrency}</span></div>
                            <div><span className="text-slate-500 font-bold">Language:</span> <span>{config.invoiceLanguage}</span></div>
                            <div className="col-span-2">
                               <span className="text-slate-500 font-bold">Default Template ID:</span> 
                               <span className="ml-2 font-mono text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{config.defaultInvoiceTemplateId || 'Not set'}</span>
                            </div>
                         </div>
                      ) : (
                         <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                            No dedicated Invoicing Profile mapped for this target. The system will rely on manual templating via the master matrix.
                         </div>
                      )}
                  </div>

                  {/* PDF Dossier Assembler Integration */}
                  <div className="mt-6">
                     <PdfDossierAssembler targetName={row.targetName || row.targetEntityId || 'Invoice'} />
                  </div>
              </div>

              {/* Right Column: Operations Tracker */}
              <div className="md:col-span-1">
                 <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 sticky top-6">
                    <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4 text-sm flex items-center gap-2"><Clock size={16}/> Operations Workflow</h3>
                    
                    <div className="flex flex-col gap-0 relative">
                       {/* Line interconnect */}
                       <div className="absolute left-[15px] top-6 bottom-6 w-0.5 bg-slate-200 z-0"></div>

                       {/* Stages */}
                       <OpStage 
                          title="Matrix Record Instantiated" 
                          time={row.opStartedAt} />
                       
                       <OpStage 
                          title="Internal Memo Overrides Approved" 
                          time={row.opMemoSentAt} 
                          actionLabel="Complete Memo" 
                          onAction={() => recordTime('opMemoSentAt')} />
                       
                       <OpStage 
                          title="Invoice Automatically Emitted" 
                          time={row.opInvoiceEmittedAt} 
                          actionLabel="Generate & Emit PDF" 
                          isPrimary
                          loading={generating}
                          onAction={handleGenerateClick} 
                       />

                       <OpStage 
                          title="Payment Received" 
                          time={row.opReceivedAt} 
                          actionLabel="Mark Paid" 
                          onAction={() => recordTime('opReceivedAt')} />

                       <OpStage 
                          title="Accounting NF Emitted" 
                          time={row.opNfEmittedAt} 
                          actionLabel="Mark NF Completed" 
                          onAction={() => recordTime('opNfEmittedAt')} />
                    </div>

                    {row.opTimeSpentMinutes > 0 && (
                       <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Effort Consumed</div>
                          <div className="text-lg font-black text-indigo-700">{row.opTimeSpentMinutes} Minutes</div>
                       </div>
                    )}
                 </div>
              </div>

           </div>
           )}
        </div>
      </div>
      
      {showTemplateModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowTemplateModal(false)}>
           <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                 <h3 className="font-bold text-slate-800">Select Invoice Template</h3>
                 <button onClick={() => setShowTemplateModal(false)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
              </div>
              <div className="p-5 space-y-4">
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Choose a template</label>
                    <select 
                       className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                       value={templates.find(t=>t.id === selectedTemplateId) ? selectedTemplateId : ""}
                       onChange={e => setSelectedTemplateId(e.target.value)}
                    >
                       <option value="">-- Custom ID / Select Below --</option>
                       {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name || t.id}</option>
                       ))}
                    </select>
                 </div>
                 <div className="flex items-center gap-4">
                    <div className="flex-1 border-b border-slate-100"></div>
                    <div className="text-xs text-slate-400 font-bold uppercase">OR</div>
                    <div className="flex-1 border-b border-slate-100"></div>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Provide Custom Template ID</label>
                    <input 
                       type="text" 
                       placeholder="e.g. custom_template_abc"
                       className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                       value={!templates.find(t=>t.id === selectedTemplateId) ? selectedTemplateId : ''}
                       onChange={e => setSelectedTemplateId(e.target.value)}
                    />
                 </div>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                 <button onClick={() => setShowTemplateModal(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-200 hover:text-slate-700 rounded-lg transition-colors">Cancel</button>
                 <button onClick={handleGenerateInvoice} disabled={!selectedTemplateId || generating} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2">
                    {generating ? <Loader2 size={16} className="animate-spin" /> : 'Confirm & Render'}
                 </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}

function OpStage({ title, time, actionLabel, onAction, isPrimary, loading }: any) {
   const isDone = !!time;
   return (
      <div className="flex items-start gap-4 mb-6 relative z-10">
         <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ring-4 ring-white transition-colors duration-300 ${isDone ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-200 border border-slate-300 text-slate-400'}`}>
            {isDone ? <CheckCircle size={16} /> : <div className="w-2 h-2 rounded-full bg-slate-400"></div>}
         </div>
         <div className="pt-1.5 flex-1 w-full min-w-0">
            <div className={`text-sm font-bold ${isDone ? 'text-slate-800' : 'text-slate-500'}`}>{title}</div>
            {isDone ? (
               <div className="text-xs text-slate-400 mt-0.5">{formatDate(time)}</div>
            ) : actionLabel && (
               <button 
                  onClick={onAction}
                  disabled={loading}
                  className={`mt-2 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded w-full flex justify-center items-center gap-1 transition-all
                  ${isPrimary ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
               >
                  {loading ? <Loader2 size={12} className="animate-spin" /> : actionLabel} {isPrimary && !loading && <ExternalLink size={12}/>}
               </button>
            )}
         </div>
      </div>
   )
}
