import React, { useState } from 'react';
import { PlayCircle, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function PayrollRunsView({ payrolls, employees, tenantId }: { payrolls: any[], employees: any[], tenantId: string }) {

  const [generating, setGenerating] = useState(false);

  // Generate a mock payroll run from employee base salaries
  const handleGenerateCycle = async () => {
     if (!tenantId) return;
     setGenerating(true);
     
     try {
        const totalBase = employees.reduce((acc, e) => acc + (Number(e.baseSalary) || 8500), 0);
        const thisMonth = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
        
        await addDoc(collection(db, 'tenants', tenantId, 'payrolls'), {
           cycle: thisMonth,
           status: 'draft',
           employeeCount: employees.length,
           totalAmount: totalBase,
           createdAt: serverTimestamp()
        });
     } catch (e) {
        console.error("Failed to generate payroll", e);
     } finally {
        setGenerating(false);
     }
  };

  const StatusBadge = ({ status }: { status: string }) => {
     if (status === 'draft') return <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-slate-100 text-slate-800 shadow"><Clock className="h-3 w-3 mr-1" />Calculating</span>;
     if (status === 'approved') return <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-amber-100 text-amber-800 shadow"><AlertCircle className="h-3 w-3 mr-1" />Awaiting Payment</span>;
     if (status === 'paid') return <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-emerald-100 text-emerald-800 shadow"><CheckCircle2 className="h-3 w-3 mr-1" />Disbursed</span>;
     return <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-slate-100 text-slate-800 shadow">{status}</span>;
  };

  return (
    <div className="w-full h-full p-8 overflow-y-auto animate-fade-in">
       <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-semibold tracking-tight mb-2 text-2xl font-bold">Folha e Comissões</h3>
            <div className="text-sm text-[var(--text-secondary)]">Historical payroll cycles (Pay Runs) generated from employee data.</div>
          </div>
          <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 transition-colors h-9 px-4 py-2 shadow border-none text-white bg-[var(--brand-primary)] hover:bg-[#003833]" 
            onClick={handleGenerateCycle}
            disabled={generating}
          >
            {generating ? 'Starting...' : <><PlayCircle className="mr-2 h-4 w-4" /> Start New Cycle</>}
          </button>
       </div>

       {payrolls.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-16 text-center shadow-sm">
             <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-sm">💸</div>
             <h3 className="text-xl font-bold text-slate-800 mb-2">No Payroll Runs Active</h3>
             <p className="text-slate-500 mb-6">Click "Start New Cycle" to snapshot salaries and compute commissions for the current month.</p>
          </div>
       ) : (
          <div className="grid gap-4">
             {payrolls.sort((a,b) => (b.createdAt?.toMillis() || Date.now()) - (a.createdAt?.toMillis() || Date.now())).map((pr, idx) => (
                <div key={pr.id} className={`p-6 rounded-2xl border ${idx === 0 ? 'bg-indigo-50/30 border-indigo-200 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'} flex items-center justify-between`}>
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center font-bold text-xs leading-none text-slate-600">
                         {pr.cycle?.split(' ')[0].substring(0,3)}
                         <span className="text-[10px] uppercase font-medium mt-1">{pr.cycle?.split(' ')[1]}</span>
                      </div>
                      <div>
                         <h4 className="font-bold text-slate-800 text-lg">{pr.cycle || 'Unknown Cycle'}</h4>
                         <p className="text-sm text-slate-500 font-medium">{pr.employeeCount} employees processed</p>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-8">
                      <div className="text-right">
                         <div className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">Total Liability</div>
                         <div className="text-xl font-extrabold text-slate-800">
                            R$ {(Number(pr.totalAmount) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                         </div>
                      </div>
                      
                      <StatusBadge status={pr.status || 'draft'} />
                      <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 ml-4">Review</button>
                   </div>
                </div>
             ))}
          </div>
       )}
    </div>
  );
}
