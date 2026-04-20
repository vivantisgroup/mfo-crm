'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { usePageTitle } from '@/lib/PageTitleContext';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Receipt, Calendar, TrendingUp, DollarSign, Euro, ArrowRight, Loader2, Plus, Download, CheckCircle, Save, PlusCircle, Building, Users } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import InvoiceDetailModal from './InvoiceDetailModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PromptDialog, PromptOptions } from '@/components/PromptDialog';
import { SecondaryDock } from '@/components/SecondaryDock';
import BillingDashboard from './BillingDashboard';

// Types
type BillingCycle = {
  id: string;
  name: string;
  fxUsdBrl: number;
  fxEurUsd: number;
  isLocked: boolean;
  createdAt: number;
};

type InvoiceRow = {
  id: string;
  targetId: string;
  targetType: 'family' | 'organization' | 'custom';
  targetName: string;
  
  aumOffshore: number;
  aumOnshore: number;
  
  recBrl: number;
  recUsd: number;
  recEur: number;

  adjBrl: number;
  adjUsd: number;
  adjDescription?: string;

  memoSent: string; // 's', 'n', 'n/a'
  invoiceEmittedLabel: string; 
  invoiceSentDate: string;
  invoiceSentTo: string;

  receivedBrl: number;
  receivedUsd: number;
  receivedStatus: string;

  accDateSent: string;
  accRemit: boolean;
  accNfNumber: string;
  accNfEmissionDate: string;
  accNfValue: number;
  accIssValue: number;

  clientAccCompany: string;
  clientAccSentDate: string;

  // Operational metrics
  opStartedAt?: number;
  opMemoSentAt?: number;
  opInvoiceEmittedAt?: number;
  opReceivedAt?: number;
  opNfEmittedAt?: number;
  opTimeSpentMinutes?: number;
};


const formatCurrency = (val: number | string | undefined | null) => {
  if (!val) return '0.00';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Specialized Input component to prevent keystroke lag
const MatrixInput = ({ value, onChange, type = "text", className, disabled, placeholder }: any) => {
   const [local, setLocal] = useState(value);
   
   useEffect(() => {
     setLocal(value);
   }, [value]);

   const handleBlur = () => {
     if (local !== value) {
        if (type === "number") {
           onChange(parseFloat(local) || 0);
        } else {
           onChange(local);
        }
     }
   }

   return (
     <input 
       type={type}
       disabled={disabled}
       value={local === null || local === undefined ? '' : local}
       onChange={e => setLocal(e.target.value)}
       onBlur={handleBlur}
       className={className}
       placeholder={placeholder}
     />
   )
}

export default function FaturamentoPage() {
  usePageTitle('Faturamento & Invoicing');
  const { tenant } = useAuth();
  
  const [activeTab, setActiveTab] = useState('matrix');

  // Cycles State
  const [cycles, setCycles] = useState<BillingCycle[]>([]);
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [loadingCycles, setLoadingCycles] = useState(true);

  // Entities lookup
  const [families, setFamilies] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);

  // Rows state
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [savingRows, setSavingRows] = useState(false);
  const [viewRowId, setViewRowId] = useState<string | null>(null);

  const [confirmState, setConfirmState] = useState<{title: string, message: string, onConfirm: () => void} | null>(null);
  const [promptState, setPromptState] = useState<PromptOptions | null>(null);

  // FX Editing
  const [fxEditUsdBrl, setFxEditUsdBrl] = useState<string>('5.00');
  const [fxEditEurUsd, setFxEditEurUsd] = useState<string>('1.10');

  // Load Cycles
  useEffect(() => {
    if (!tenant?.id) return;
    const unsub = onSnapshot(query(collection(db, 'tenants', tenant.id, 'billing_cycles'), orderBy('createdAt', 'desc')), (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() })) as BillingCycle[];
      setCycles(arr);
      if (arr.length > 0 && !activeCycleId) {
        setActiveCycleId(arr[0].id);
        setFxEditUsdBrl(String(arr[0].fxUsdBrl || 5.00));
        setFxEditEurUsd(String(arr[0].fxEurUsd || 1.10));
      }
      setLoadingCycles(false);
    });
    return unsub;
  }, [tenant?.id]);

  // Load Global Entities (Families and Orgs) for the dropdown picker
  useEffect(() => {
    if (!tenant?.id) return;
    getDocs(collection(db, 'tenants', tenant.id, 'families')).then(snap => {
       setFamilies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    getDocs(collection(db, 'tenants', tenant.id, 'organizations')).then(snap => {
       setOrganizations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [tenant?.id]);

  // Load Rows for active cycle
  useEffect(() => {
    if (!tenant?.id || !activeCycleId) { setRows([]); return; }
    setLoadingRows(true);
    const unsub = onSnapshot(collection(db, 'tenants', tenant.id, 'billing_cycles', activeCycleId, 'invoices'), (snap) => {
       const arr = snap.docs.map(d => ({ id: d.id, ...d.data() })) as InvoiceRow[];
       setRows(arr);
       setLoadingRows(false);
    });
    return unsub;
  }, [tenant?.id, activeCycleId]);

  // Actions
  const handleCreateCycle = async () => {
    if (!tenant?.id) return;
    setPromptState({
       title: "New Billing Cycle",
       placeholder: "e.g. Q2-2026",
       onConfirm: async (name) => {
          if (!name) return;
          const docRef = doc(collection(db, 'tenants', tenant.id, 'billing_cycles'));
          await setDoc(docRef, {
            name,
            fxUsdBrl: 5.00,
            fxEurUsd: 1.10,
            isLocked: false,
            createdAt: Date.now()
          });
          setActiveCycleId(docRef.id);
       },
       onCancel: () => setPromptState(null)
    });
  };

  const handleUpdateFX = async () => {
    if (!tenant?.id || !activeCycleId) return;
    await updateDoc(doc(db, 'tenants', tenant.id, 'billing_cycles', activeCycleId), {
       fxUsdBrl: parseFloat(fxEditUsdBrl) || 0,
       fxEurUsd: parseFloat(fxEditEurUsd) || 0
    });
  };

  const activeCycle = cycles.find(c => c.id === activeCycleId);
  const isLocked = activeCycle?.isLocked;

  const handleAddRow = async (type: 'family' | 'organization' | 'custom', entityId: string, entityName: string) => {
     if (!tenant?.id || !activeCycleId || isLocked) return;
     const newRow: InvoiceRow = {
        id: uuidv4(),
        targetId: entityId,
        targetType: type,
        targetName: entityName,
        aumOffshore: 0, aumOnshore: 0,
        recBrl: 0, recUsd: 0, recEur: 0,
        adjBrl: 0, adjUsd: 0,
        memoSent: 'n', invoiceEmittedLabel: '', invoiceSentDate: '', invoiceSentTo: '',
        receivedBrl: 0, receivedUsd: 0, receivedStatus: '',
        accDateSent: '', accRemit: false, accNfNumber: '', accNfEmissionDate: '', accNfValue: 0, accIssValue: 0,
        clientAccCompany: '', clientAccSentDate: '',
        opStartedAt: Date.now(), opTimeSpentMinutes: 0
     };
     await setDoc(doc(db, 'tenants', tenant.id, 'billing_cycles', activeCycleId, 'invoices', newRow.id), newRow);
  };

  const handleDeleteRow = async (rowId: string) => {
    if (!tenant?.id || !activeCycleId || isLocked) return;
    setConfirmState({
       title: "Delete Row",
       message: "Are you sure you want to delete this row?",
       onConfirm: async () => {
          await deleteDoc(doc(db, 'tenants', tenant.id, 'billing_cycles', activeCycleId, 'invoices', rowId));
       }
    });
  }

  // Row Updating
  // We use a local state clone for rows when editing to avoid massive re-renders on keystroke,
  // but for simplicity and real-time feel, we'll push directly via onBlur or just write to state and debounce.
  const updateRowField = async (rowId: string, field: keyof InvoiceRow, value: any) => {
     if (!tenant?.id || !activeCycleId || isLocked) return;
     try {
       await updateDoc(doc(db, 'tenants', tenant.id, 'billing_cycles', activeCycleId, 'invoices', rowId), {
          [field]: value
       });
     } catch (e) { console.error("Update failed", e); }
  };

  // Matrix UI Calculations (Derived fields)
  // FX Editing
  const fxUSD = activeCycle?.fxUsdBrl || 1;
  const fxEUR = activeCycle?.fxEurUsd || 1;

  // Global Progress metrics
  const progress = useMemo(() => {
     if (rows.length === 0) return { total: 0, emitted: 0, paid: 0, nf: 0, pct: 0 };
     const emitted = rows.filter(r => !!r.opInvoiceEmittedAt).length;
     const paid = rows.filter(r => !!r.opReceivedAt).length;
     const nf = rows.filter(r => !!r.opNfEmittedAt).length;
     return { 
        total: rows.length, emitted, paid, nf, 
        pct: Math.round((nf / rows.length) * 100) 
     };
  }, [rows]);

  if (loadingCycles) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden w-full relative">
      
      {/* HEADER & CYCLE MANAGER */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10 relative">
        <div className="flex items-center gap-4">
           <div className="bg-emerald-100 text-emerald-700 p-2 rounded-lg">
             <Receipt size={24} />
           </div>
           <div>
             <h1 className="text-xl font-bold text-slate-800">Faturamento & Invoicing</h1>
             <p className="text-xs text-slate-500 mt-0.5">Corporate billing cycles and accounting tracker</p>
           </div>
        </div>

        <div className="flex items-stretch gap-4 border border-slate-200 p-2 rounded-xl bg-slate-50">
           <div className="flex items-center gap-2 pr-4 border-r border-slate-200">
             <Calendar size={16} className="text-slate-400" />
             <select 
               className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 cursor-pointer outline-none w-32"
               value={activeCycleId || ''}
               onChange={e => {
                  setActiveCycleId(e.target.value);
                  const cyc = cycles.find(c => c.id === e.target.value);
                  if (cyc) { setFxEditUsdBrl(String(cyc.fxUsdBrl)); setFxEditEurUsd(String(cyc.fxEurUsd)); }
               }}
             >
                {cycles.length === 0 && <option value="">No cycles</option>}
                {cycles.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.isLocked ? '(Locked)' : ''}</option>
                ))}
             </select>
             <button onClick={handleCreateCycle} className="p-1 hover:bg-slate-200 rounded text-slate-500" title="New Cycle"><Plus size={14}/></button>
           </div>

           <div className="flex items-center gap-3 px-2">
             <div className="flex items-center gap-1 text-xs">
                <span className="font-bold text-slate-500">USD/BRL</span>
                <input type="number" disabled={isLocked} value={fxEditUsdBrl} onChange={e => setFxEditUsdBrl(e.target.value)} onBlur={handleUpdateFX} className="w-16 px-1.5 py-0.5 border border-slate-300 rounded text-right mx-1 bg-white" />
             </div>
             <div className="flex items-center gap-1 text-xs">
                <span className="font-bold text-slate-500">EUR/USD</span>
                <input type="number" disabled={isLocked} value={fxEditEurUsd} onChange={e => setFxEditEurUsd(e.target.value)} onBlur={handleUpdateFX} className="w-16 px-1.5 py-0.5 border border-slate-300 rounded text-right mx-1 bg-white" />
             </div>
           </div>
           
           <div className="pl-4 border-l border-slate-200 flex items-center">
              <button 
                onClick={async () => {
                  if(!activeCycleId || !tenant?.id) return;
                  await updateDoc(doc(db, 'tenants', tenant.id, 'billing_cycles', activeCycleId), { isLocked: !isLocked });
                }}
                className={`text-xs font-bold px-3 py-1.5 rounded-md transition ${isLocked ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
              >
                 {isLocked ? '🔒 Locked' : '🔓 Unlock'}
              </button>
           </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 py-0 border-b border-slate-200 bg-white">
         <SecondaryDock 
            tabs={[
              { id: 'matrix', label: 'Operacional (Matrix)', icon: '📋' },
              { id: 'dashboard', label: 'Management Dashboard', icon: '📈' }
            ]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
         />
      </div>

      {/* MATRIX WORKSPACE */}
      {activeTab === 'matrix' ? (
        <div className="flex-1 overflow-auto bg-white relative w-full flex flex-col">
           {activeCycle && (
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between shadow-sm shrink-0">
                 <div className="text-sm font-bold text-slate-700 flex items-center gap-2">Cycle Tracking Pipeline <span className="text-slate-400 font-normal">({progress.nf} / {progress.total} Complete)</span></div>
                 <div className="flex flex-1 items-center max-w-xl ml-8 gap-3">
                    <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                       <div className="h-full bg-blue-400 transition-all" style={{ width: `${(progress.emitted / progress.total) * 100}%` }} title={`Emitted: ${progress.emitted}`}></div>
                       <div className="h-full bg-indigo-500 transition-all absolute left-0" style={{ width: `${(progress.paid / progress.total) * 100}%` }} title={`Paid: ${progress.paid}`}></div>
                       <div className="h-full bg-emerald-500 transition-all absolute left-0" style={{ width: `${(progress.nf / progress.total) * 100}%` }} title={`NF: ${progress.nf}`}></div>
                    </div>
                    <div className="text-xs font-black text-emerald-600 w-12 text-right">{progress.pct}%</div>
                 </div>
              </div>
           )}

           {!activeCycle ? (
              <div className="flex flex-col items-center justify-center p-20 text-slate-400 relative z-0">
                 <Calendar size={48} className="mb-4 opacity-50" />
                 <p className="mb-4">Select or create a billing cycle to begin.</p>
                 <button onClick={handleCreateCycle} className="btn btn-primary">Create Cycle</button>
              </div>
           ) : (
             <div className="flex-1 overflow-auto relative">
               <table className="w-full text-left text-xs whitespace-nowrap table-fixed border-collapse relative z-0 min-w-[3200px]">

             <thead className="sticky top-0 bg-slate-100 shadow-sm z-[20]">
                {/* Master Headers */}
                <tr>
                   <th className="w-[300px] bg-amber-200/50 text-amber-800 border border-slate-200 p-2 font-black sticky left-0 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Target Entity</th>
                   <th colSpan={3} className="bg-slate-200 text-slate-600 border border-slate-300 p-2 font-bold text-center">AUM Apurado no Período</th>
                   <th colSpan={3} className="bg-[#ccffcc] text-emerald-800 border border-slate-300 p-2 font-bold text-center relative">
                      Recebíveis (Período)
                      <div className="absolute right-0 top-0 bottom-0 bg-emerald-300/30 w-px"></div>
                   </th>
                   <th colSpan={2} className="bg-[#b3d9ff] text-blue-800 border border-slate-300 p-2 font-bold text-center">Ajustes Período Anterior</th>
                   <th colSpan={2} className="bg-[#d9ecd9] text-emerald-900 border border-slate-300 p-2 font-bold text-center">Total Aplicado (Faturar)</th>
                   <th colSpan={5} className="bg-[#e6ccff] text-purple-800 border border-slate-300 p-2 font-bold text-center bg-opacity-40">FATURAMENTO (Pipeline)</th>
                   <th colSpan={2} className="bg-indigo-100 text-indigo-800 border border-indigo-200 p-2 font-bold text-center">RECEBIMENTO</th>
                   <th colSpan={6} className="bg-[#ffccff] text-pink-800 border border-slate-300 p-2 font-bold text-center bg-opacity-40">CONTROLE CONTÁBIL (Transparenza)</th>
                   <th colSpan={2} className="bg-orange-100 text-orange-800 border border-slate-300 p-2 font-bold text-center">Controle Cliente</th>
                   <th className="w-[40px] bg-slate-100 border border-slate-200 p-2 text-center text-slate-400"></th>
                </tr>
                {/* Sub Headers */}
                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                   <th className="border border-slate-200 p-2 sticky left-0 bg-slate-50 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.05)] text-[12px] capitalize font-medium text-slate-600">Company / Client Name</th>
                   
                   <th className="w-[120px] border border-slate-200 p-2 text-right">Offshore (USD)</th>
                   <th className="w-[120px] border border-slate-200 p-2 text-right">Onshore (BRL)</th>
                   <th className="w-[140px] border border-slate-200 p-2 text-right">Total USD</th>
                   
                   <th className="w-[100px] border border-slate-200 p-2 text-right">BRL</th>
                   <th className="w-[100px] border border-slate-200 p-2 text-right">USD</th>
                   <th className="w-[100px] border border-slate-200 p-2 text-right">EUR</th>
                   
                   <th className="w-[100px] border border-slate-200 p-2 text-right bg-blue-50/50">Diferença BRL</th>
                   <th className="w-[100px] border border-slate-200 p-2 text-right bg-blue-50/50">Diferença USD</th>

                   <th className="w-[120px] border border-slate-200 p-2 text-right font-black bg-emerald-50">Total BRL</th>
                   <th className="w-[120px] border border-slate-200 p-2 text-right font-black bg-emerald-50">Total USD</th>

                   <th className="w-[100px] border border-slate-200 p-2 text-center">Memo Enviada</th>
                   <th className="w-[140px] border border-slate-200 p-2 text-center">Ação</th>
                   <th className="w-[120px] border border-slate-200 p-2 text-center">Invoice Emitida/#</th>
                   <th className="w-[100px] border border-slate-200 p-2 text-center">Data Enviada</th>
                   <th className="w-[160px] border border-slate-200 p-2 text-center">Enviado Para</th>

                   <th className="w-[100px] border border-slate-300 p-2 text-right bg-indigo-50 text-indigo-700">USD Pago</th>
                   <th className="w-[100px] border border-slate-300 p-2 text-right bg-indigo-50 text-indigo-700">BRL Pago</th>

                   <th className="w-[120px] border border-slate-200 p-2 text-center">Envio Contabilidade</th>
                   <th className="w-[80px] border border-slate-200 p-2 text-center">Remessa?</th>
                   <th className="w-[100px] border border-slate-200 p-2 text-center">NF Nro</th>
                   <th className="w-[100px] border border-slate-200 p-2 text-center">Emissão NF</th>
                   <th className="w-[100px] border border-slate-200 p-2 text-right">NF Valor</th>
                   <th className="w-[100px] border border-slate-200 p-2 text-right">ISS</th>

                   <th className="w-[140px] border border-slate-200 p-2 text-center">Empresa/Contador</th>
                   <th className="w-[120px] border border-slate-200 p-2 text-center">Extratos (Data)</th>
                   
                   <th className="w-[40px] border border-slate-200 p-2 text-center"></th>
                </tr>
             </thead>
             <tbody>
                {rows.map((row, idx) => {
                   
                   // Math
                   const aumTotalUsd = (row.aumOffshore) + (row.aumOnshore / fxUSD);
                   
                   // For billing total: 
                   // Receivable BRL directly + Adj BRL
                   // Receivable USD directly + Adj USD
                   // Wait, EUR is converted to USD? Spreadsheet: EUR converted via EUR/USD to determine total USD?
                   // If they have Recebivel EUR, adding to USD: EUR * EUR/USD.
                   // Total BRL to Bill = recBrl + adjBrl
                   // Total USD to Bill = recUsd + (recEur * fxEUR) + adjUsd
                   const totalBrlFaturar = row.recBrl + row.adjBrl;
                   const totalUsdFaturar = row.recUsd + (row.recEur * fxEUR) + row.adjUsd;

                   return (
                     <tr key={row.id} className="hover:bg-indigo-50/40 group border-b border-slate-100 transition-colors">
                        <td className="border border-slate-200 bg-white sticky left-0 z-10 p-2 flex items-center justify-between shadow-[2px_0_5px_rgba(0,0,0,0.03)] h-full min-h-[40px] group-hover:bg-indigo-50/40 transition-colors">
                           <div className="flex items-center gap-2 flex-1 min-w-0">
                               <div className={`w-1.5 h-1.5 shrink-0 rounded-full ${row.targetType === 'family' ? 'bg-emerald-400' : row.targetType === 'organization' ? 'bg-blue-400' : 'bg-slate-300'}`}></div>
                               <MatrixInput disabled={isLocked} value={row.targetName} onChange={(v:any) => updateRowField(row.id, 'targetName', v)} className="w-full bg-transparent border-none p-0 outline-none font-bold text-slate-700 truncate" />
                           </div>
                           <button onClick={() => setViewRowId(row.id)} className="w-6 h-6 shrink-0 bg-slate-100 hover:bg-indigo-100 text-slate-500 hover:text-indigo-600 rounded flex items-center justify-center transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                           </button>
                        </td>
                        
                        <td className="border border-slate-200 bg-white"><MatrixInput type="number" disabled={isLocked} value={row.aumOffshore} onChange={(v:any) => updateRowField(row.id, 'aumOffshore', v)} className="w-full bg-transparent outline-none p-2 text-right" /></td>
                        <td className="border border-slate-200 bg-white"><MatrixInput type="number" disabled={isLocked} value={row.aumOnshore} onChange={(v:any) => updateRowField(row.id, 'aumOnshore', v)} className="w-full bg-transparent outline-none p-2 text-right" /></td>
                        <td className="border border-slate-200 bg-slate-50 p-2 text-right font-medium text-slate-500">US$ {formatCurrency(aumTotalUsd)}</td>

                        <td className="border border-slate-200 bg-emerald-50/20"><MatrixInput type="number" disabled={isLocked} value={row.recBrl} onChange={(v:any) => updateRowField(row.id, 'recBrl', v)} className="w-full bg-transparent outline-none p-2 text-right" /></td>
                        <td className="border border-slate-200 bg-emerald-50/20"><MatrixInput type="number" disabled={isLocked} value={row.recUsd} onChange={(v:any) => updateRowField(row.id, 'recUsd', v)} className="w-full bg-transparent outline-none p-2 text-right" /></td>
                        <td className="border border-slate-200 bg-emerald-50/20"><MatrixInput type="number" disabled={isLocked} value={row.recEur} onChange={(v:any) => updateRowField(row.id, 'recEur', v)} className="w-full bg-transparent outline-none p-2 text-right" /></td>

                        <td className="border border-slate-200 bg-blue-50/20"><MatrixInput type="number" disabled={isLocked} value={row.adjBrl} onChange={(v:any) => updateRowField(row.id, 'adjBrl', v)} className="w-full bg-transparent outline-none p-2 text-right text-blue-700" /></td>
                        <td className="border border-slate-200 bg-blue-50/20"><MatrixInput type="number" disabled={isLocked} value={row.adjUsd} onChange={(v:any) => updateRowField(row.id, 'adjUsd', v)} className="w-full bg-transparent outline-none p-2 text-right text-blue-700" /></td>

                        <td className="border border-slate-200 bg-emerald-50 p-2 text-right font-black text-emerald-800">R$ {formatCurrency(totalBrlFaturar)}</td>
                        <td className="border border-slate-200 bg-emerald-50 p-2 text-right font-black text-emerald-800">US$ {formatCurrency(totalUsdFaturar)}</td>

                        <td className="border border-slate-200 bg-white">
                           <select disabled={isLocked} value={row.memoSent} onChange={e => updateRowField(row.id, 'memoSent', e.target.value)} className="w-full bg-transparent outline-none border-none p-2 text-center text-xs">
                             <option value="s">Sim</option>
                             <option value="n">Não</option>
                             <option value="x">N/A</option>
                           </select>
                        </td>
                        <td className="border border-slate-200 bg-white p-1 text-center">
                           <button disabled={isLocked} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] uppercase font-bold rounded shadow-sm w-full transition-colors truncate">Gerar Invoice</button>
                        </td>
                        <td className="border border-slate-200 bg-white"><MatrixInput disabled={isLocked} value={row.invoiceEmittedLabel} onChange={(v:any) => updateRowField(row.id, 'invoiceEmittedLabel', v)} placeholder="INV-..." className="w-full bg-transparent outline-none p-2 text-center text-xs font-mono text-purple-700" /></td>
                        <td className="border border-slate-200 bg-white p-1"><MatrixInput type="date" disabled={isLocked} value={row.invoiceSentDate} onChange={(v:any) => updateRowField(row.id, 'invoiceSentDate', v)} className="w-full bg-transparent outline-none text-[10px] text-center" /></td>
                        <td className="border border-slate-200 bg-white"><MatrixInput disabled={isLocked} value={row.invoiceSentTo} onChange={(v:any) => updateRowField(row.id, 'invoiceSentTo', v)} className="w-full bg-transparent outline-none p-2 text-center" placeholder="Morgan Stanley..." /></td>

                        <td className="border border-slate-300 bg-slate-50"><MatrixInput type="number" disabled={isLocked} value={row.receivedUsd} onChange={(v:any) => updateRowField(row.id, 'receivedUsd', v)} className="w-full bg-transparent outline-none p-2 text-right font-bold text-slate-800" /></td>
                        <td className="border border-slate-300 bg-slate-50"><MatrixInput type="number" disabled={isLocked} value={row.receivedBrl} onChange={(v:any) => updateRowField(row.id, 'receivedBrl', v)} className="w-full bg-transparent outline-none p-2 text-right font-bold text-slate-800" /></td>

                        <td className="border border-slate-200 bg-pink-50/20 p-1"><MatrixInput type="date" disabled={isLocked} value={row.accDateSent} onChange={(v:any) => updateRowField(row.id, 'accDateSent', v)} className="w-full bg-transparent outline-none text-[10px] text-center" /></td>
                        <td className="border border-slate-200 bg-pink-50/20 p-2 text-center"><input type="checkbox" disabled={isLocked} checked={row.accRemit} onChange={e => updateRowField(row.id, 'accRemit', e.target.checked)} className="cursor-pointer" /></td>
                        <td className="border border-slate-200 bg-pink-50/20"><MatrixInput disabled={isLocked} value={row.accNfNumber} onChange={(v:any) => updateRowField(row.id, 'accNfNumber', v)} className="w-full bg-transparent outline-none p-2 text-center font-mono" /></td>
                        <td className="border border-slate-200 bg-pink-50/20 p-1"><MatrixInput type="date" disabled={isLocked} value={row.accNfEmissionDate} onChange={(v:any) => updateRowField(row.id, 'accNfEmissionDate', v)} className="w-full bg-transparent outline-none text-[10px] text-center" /></td>
                        <td className="border border-slate-200 bg-pink-50/20"><MatrixInput type="number" disabled={isLocked} value={row.accNfValue} onChange={(v:any) => updateRowField(row.id, 'accNfValue', v)} className="w-full bg-transparent outline-none p-2 text-right" /></td>
                        <td className="border border-slate-200 bg-pink-50/20"><MatrixInput type="number" disabled={isLocked} value={row.accIssValue} onChange={(v:any) => updateRowField(row.id, 'accIssValue', v)} className="w-full bg-transparent outline-none p-2 text-right" /></td>

                        <td className="border border-slate-200 bg-orange-50/30"><MatrixInput disabled={isLocked} value={row.clientAccCompany} onChange={(v:any) => updateRowField(row.id, 'clientAccCompany', v)} className="w-full bg-transparent outline-none p-2 text-center" placeholder="Evora..." /></td>
                        <td className="border border-slate-200 bg-orange-50/30 p-1"><MatrixInput type="date" disabled={isLocked} value={row.clientAccSentDate} onChange={(v:any) => updateRowField(row.id, 'clientAccSentDate', v)} className="w-full bg-transparent outline-none text-[10px] text-center" /></td>

                        <td className="border border-slate-200 bg-slate-50 text-center p-1">
                           <button onClick={()=>handleDeleteRow(row.id)} disabled={isLocked} className="text-red-400 hover:text-red-600 disabled:opacity-30">x</button>
                        </td>
                     </tr>
                   )
                })}

                {/* Add Row Tools */}
                {!isLocked && (
                  <tr>
                     <td className="border border-slate-200 bg-white sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.03)] group" colSpan={1}>
                        <div className="flex h-[40px]">
                           <div className="flex-1 border-r border-slate-100 flex items-center">
                              <select 
                                 className="w-full bg-transparent text-[11px] outline-none text-slate-500 font-bold p-2 h-full cursor-pointer hover:bg-slate-50"
                                 onChange={(e) => {
                                    if(e.target.value) {
                                       const [type, id, name] = e.target.value.split('|');
                                       handleAddRow(type as any, id, name);
                                       e.target.value = ''; // reset 
                                    }
                                 }}
                              >
                                 <option value="">+ Add Pre-Registered Entity...</option>
                                 <optgroup label="Family Groups">
                                    {families.map(f => <option key={f.id} value={`family|${f.id}|${f.name}`}>{f.name}</option>)}
                                 </optgroup>
                                 <optgroup label="Organizations / Funds">
                                    {organizations.map(o => <option key={o.id} value={`organization|${o.id}|${o.name}`}>{o.name}</option>)}
                                 </optgroup>
                              </select>
                           </div>
                           <button onClick={() => {
                               setPromptState({
                                  title: "Add Custom Entity",
                                  placeholder: "Entity Name...",
                                  onConfirm: (nm) => {
                                     if(nm) handleAddRow('custom', uuidv4(), nm);
                                  },
                                  onCancel: () => setPromptState(null)
                               });
                             }} 
                             className="px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-[10px] tracking-wider uppercase transition-colors shrink-0"
                           >
                             + Custom
                           </button>
                        </div>
                     </td>
                     <td colSpan={30} className="bg-slate-100 border-none"></td>
                  </tr>
                )}
             </tbody>
             
             {/* Totalizing Footer */}
             {rows.length > 0 && (
               <tfoot className="sticky bottom-0 z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] text-[12px] font-semibold border-t-2 border-slate-300 bg-white">
                  <tr>
                     <td className="p-3 font-extrabold sticky left-0 bg-slate-100 border-r border-slate-200 text-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.03)]">Total Calculation</td>
                     <td className="p-3 text-right bg-slate-50 border-r border-slate-200 text-slate-600">{formatCurrency(rows.reduce((s,r) => s + (r.aumOffshore||0), 0))}</td>
                     <td className="p-3 text-right bg-slate-50 border-r border-slate-200 text-slate-600">{formatCurrency(rows.reduce((s,r) => s + (r.aumOnshore||0), 0))}</td>
                     <td className="p-3 text-right bg-slate-100 border-r border-slate-200 font-bold text-slate-800">{formatCurrency(rows.reduce((s,r) => s + ((r.aumOffshore||0) + ((r.aumOnshore||0)/fxUSD)), 0))}</td>
                     
                     <td className="p-3 text-right bg-emerald-50/50 border-r border-slate-200 text-emerald-800">{formatCurrency(rows.reduce((s,r) => s + (r.recBrl||0), 0))}</td>
                     <td className="p-3 text-right bg-emerald-50/50 border-r border-slate-200 text-emerald-800">{formatCurrency(rows.reduce((s,r) => s + (r.recUsd||0), 0))}</td>
                     <td className="p-3 text-right bg-emerald-50/50 border-r border-slate-200 text-emerald-800">{formatCurrency(rows.reduce((s,r) => s + (r.recEur||0), 0))}</td>

                     <td className="p-3 text-right bg-blue-50/50 border-r border-slate-200 text-blue-800">{formatCurrency(rows.reduce((s,r) => s + (r.adjBrl||0), 0))}</td>
                     <td className="p-3 text-right bg-blue-50/50 border-r border-slate-200 text-blue-800">{formatCurrency(rows.reduce((s,r) => s + (r.adjUsd||0), 0))}</td>

                     <td className="p-3 text-right bg-emerald-100 font-black border-r border-emerald-200 text-emerald-900 tracking-tight">R$ {formatCurrency(rows.reduce((s,r) => s + (r.recBrl||0) + (r.adjBrl||0), 0))}</td>
                     <td className="p-3 text-right bg-emerald-100 font-black border-r border-emerald-200 text-emerald-900 tracking-tight">US$ {formatCurrency(rows.reduce((s,r) => s + (r.recUsd||0) + ((r.recEur||0)*fxEUR) + (r.adjUsd||0), 0))}</td>
                     
                     <td colSpan={5} className="bg-slate-50 border-r border-slate-200"></td>

                     <td className="p-3 text-right bg-indigo-50 border-r border-indigo-100 font-bold text-indigo-700">{formatCurrency(rows.reduce((s,r) => s + (r.receivedUsd||0), 0))}</td>
                     <td className="p-3 text-right bg-indigo-50 border-r border-indigo-100 font-bold text-indigo-700">{formatCurrency(rows.reduce((s,r) => s + (r.receivedBrl||0), 0))}</td>

                     <td colSpan={2} className="bg-slate-50 border-r border-slate-200"></td>
                     <td colSpan={2} className="bg-pink-50 border-r border-pink-100"></td>
                     <td className="p-3 text-right bg-pink-100 font-bold border-r border-pink-200 text-pink-700">R$ {formatCurrency(rows.reduce((s,r) => s + (r.accNfValue||0), 0))}</td>
                     <td className="p-3 text-right bg-pink-100 font-bold border-r border-pink-200 text-pink-700">R$ {formatCurrency(rows.reduce((s,r) => s + (r.accIssValue||0), 0))}</td>

                     <td colSpan={3} className="bg-slate-50"></td>
                  </tr>
               </tfoot>
             )}
           </table>
           </div>
         )}
        </div>
      ) : activeTab === 'dashboard' ? (
         <div className="flex-1 overflow-auto bg-slate-50 relative w-full h-full p-6">
            <BillingDashboard cycles={cycles} tenantId={tenant?.id || ''} />
         </div>
      ) : null}
      
      {viewRowId && (
        <InvoiceDetailModal 
           tenantId={tenant?.id || ''}
           cycleId={activeCycleId!}
           rowId={viewRowId}
           onClose={() => setViewRowId(null)}
        />
      )}

      {confirmState && (
         <ConfirmDialog 
           title={confirmState.title} 
           message={confirmState.message} 
           onConfirm={confirmState.onConfirm} 
           onCancel={() => setConfirmState(null)} 
         />
      )}
      {promptState && <PromptDialog {...promptState} />}
    </div>
  );
}
