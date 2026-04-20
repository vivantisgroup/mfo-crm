import React, { useMemo, useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';

export function FinancialDashboardsTab({ tenantId, ledger }: { tenantId: string, ledger: any[] }) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [snapshotMonth, setSnapshotMonth] = useState<string>('');
  
  const chartData = useMemo(() => {
    // Group ledger entries by month
    const monthlyData: Record<string, { revenue: number, expense: number }> = {};
    
    ledger.forEach(entry => {
      const dateStr = entry.date?.substring(0, 7) || 'Unknown';
      if (!monthlyData[dateStr]) monthlyData[dateStr] = { revenue: 0, expense: 0 };
      
      const isRevenue = entry.creditAccount?.toLowerCase().includes('receit') || entry.creditAccount?.toLowerCase().includes('venda') || entry.debitAccount?.toLowerCase() === 'caixa';
      const isExpense = entry.debitAccount?.toLowerCase().includes('despes') || entry.debitAccount?.toLowerCase().includes('cust');
      
      if (isRevenue) {
        monthlyData[dateStr].revenue += (entry.amount || 0);
      } else if (isExpense) {
        monthlyData[dateStr].expense += (entry.amount || 0);
      }
    });

    const categories = Object.keys(monthlyData).sort().slice(-6); // max 6 months
    const maxVal = Math.max(
      ...categories.map(c => Math.max(monthlyData[c].revenue, monthlyData[c].expense)),
      1 // prevent div zero
    );

    return {
       categories,
       monthlyData,
       maxVal
    };
  }, [ledger]);

  useEffect(() => {
    // Select the most recent month by default if none is selected
    if (chartData.categories.length > 0 && !snapshotMonth) {
       setSnapshotMonth(chartData.categories[chartData.categories.length - 1]);
    }
  }, [chartData.categories, snapshotMonth]);

  const handleCaptureSnapshot = async () => {
     if (!tenantId || !snapshotMonth) {
        toast.error("Nenhum mês selecionado.");
        return;
     }

     const monthData = chartData.monthlyData[snapshotMonth];
     if (!monthData) return;

     setIsCapturing(true);
     try {
        const docRef = doc(db, `tenants/${tenantId}/monthly_snapshots`, snapshotMonth);
        await setDoc(docRef, {
           periodId: snapshotMonth,
           revenue: monthData.revenue,
           expense: monthData.expense,
           netIncome: monthData.revenue - monthData.expense,
           capturedAt: Timestamp.now(),
           status: 'sealed'
        }, { merge: true });

        toast.success(`Snapshot para ${snapshotMonth} salvo e consolidado com sucesso!`);
     } catch (e) {
        console.error("Falha ao salvar snapshot:", e);
        toast.error("Falha ao gravar o fechamento do período.");
     } finally {
        setIsCapturing(false);
     }
  };

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-sm p-6 overflow-hidden">
      <h2 className="text-xl font-bold mb-6 text-[var(--text-primary)] border-b border-[var(--border)] pb-4 flex items-center justify-between">
        <span>Dashboards &amp; Snapshots Financeiros</span>
        <div className="flex bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-md shadow-sm overflow-hidden">
          <select 
            value={snapshotMonth}
            onChange={(e) => setSnapshotMonth(e.target.value)}
            className="bg-transparent text-xs font-semibold px-2 py-1.5 focus:outline-none border-r border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
            disabled={chartData.categories.length === 0 || isCapturing}
          >
             {chartData.categories.length === 0 && <option value="">No data</option>}
             {chartData.categories.map(c => (
               <option key={c} value={c}>{c}</option>
             ))}
          </select>
          <button 
            onClick={handleCaptureSnapshot}
            disabled={!snapshotMonth || isCapturing}
            className="text-xs bg-indigo-50 text-indigo-700 font-bold px-3 py-1.5 hover:bg-indigo-100 transition-colors disabled:opacity-50"
          >
            {isCapturing ? 'Capturing...' : 'Capture Snapshot'}
          </button>
        </div>
      </h2>
      
      {/* CSS-based Bar Chart */}
      <div className="w-full h-80 flex items-end justify-around gap-4 p-4 border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-canvas)]">
         {chartData.categories.length === 0 ? (
           <div className="text-[var(--text-tertiary)] flex-1 text-center font-semibold pb-10">
             Not enough history to generate snapshots yet.
           </div>
         ) : (
           chartData.categories.map(month => {
             const rev = chartData.monthlyData[month].revenue;
             const exp = chartData.monthlyData[month].expense;
             
             // Calculate percentage height of maxVal (max 90% so it fits well)
             const revH = (rev / chartData.maxVal) * 90;
             const expH = (exp / chartData.maxVal) * 90;
             
             return (
               <div key={month} className="flex flex-col items-center flex-1 group">
                 {/* Tooltips using native titles for now */}
                 <div className="flex gap-2 items-end justify-center w-full h-64 border-b border-[var(--border-strong)] pb-2 relative">
                    <div 
                      title={`Receitas: R$ ${rev.toLocaleString()}`} 
                      className="w-8 bg-emerald-500 rounded-t-sm transition-all hover:brightness-110" 
                      style={{ height: `${revH}%`, minHeight: rev > 0 ? '4px' : '0' }}
                    />
                    <div 
                      title={`Despesas: R$ ${exp.toLocaleString()}`} 
                      className="w-8 bg-rose-500 rounded-t-sm transition-all hover:brightness-110" 
                      style={{ height: `${expH}%`, minHeight: exp > 0 ? '4px' : '0' }}
                    />
                 </div>
                 <span className="text-xs font-semibold text-[var(--text-secondary)] mt-3">
                   {month}
                 </span>
               </div>
             );
           })
         )}
      </div>

      <div className="mt-6 flex justify-center gap-8 text-sm font-semibold">
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
            Receitas
          </div>
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <div className="w-3 h-3 bg-rose-500 rounded-sm"></div>
            Despesas
          </div>
      </div>
      
      <div className="mt-8 pt-4 border-t border-[var(--border-subtle)]">
         <h3 className="text-sm font-bold text-[var(--text-secondary)] mb-4 flex items-center gap-2">
            <span className="p-1 bg-indigo-50 dark:bg-indigo-900 rounded text-indigo-500">📸</span> Snapshot Engine
         </h3>
         <p className="text-xs text-[var(--text-tertiary)]">
            Os snapshots registram permanentemente na base a posição da DRE e Balanço no último momento do mês, selando imutabilidade para relatórios dos investidores e conselheiros do MFO.
         </p>
      </div>
    </div>
  );
}
