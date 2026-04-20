import React, { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BankAccount } from '@/lib/tenantAccountingService';
import { toast } from 'sonner';

export function BankReconTab({ tenantId, ledger }: { tenantId: string; ledger: any[] }) {
  const [statementText, setStatementText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [bankId, setBankId] = useState<string>('bank-1'); // Mocking bank selection for now

  // Simulates the flow: 
  const handleReconcile = async () => {
    if (!statementText.trim() || !tenantId) return;
    setAnalyzing(true);
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();

      // We call the same AI endpoint, but it needs to just parse it as normal entries
      const res = await fetch('/api/ai/accounting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ rawText: statementText, tenantId, isReconciliation: true, bankId })
      });

      if (!res.ok) throw new Error('Inference failed');
      const data = await res.json();
      
      if (data.entries) {
        // Run Deduplication locally against `ledger`
        const matchedEntries = data.entries.map((entry: any) => {
          // Find an existing ledger entry with same date and exact amount.
          const isDuplicate = ledger.find(l => l.date === entry.date && Math.abs(l.amount) === Math.abs(entry.amount));
          return {
             ...entry,
             isNew: !isDuplicate,
             duplicateOf: isDuplicate ? isDuplicate.id : null
          };
        });
        setMatches(matchedEntries);
      }
    } catch (e) {
      console.error(e);
      toast.error('Error reconciling statement.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCommitRecon = async () => {
    const newItems = matches.filter(m => m.isNew);
    if (!newItems.length) {
      toast.error("All items already reconciled!");
      return;
    }
    
    // In a real app we'd batch commit the new ledger entries.
    toast.error(`Would commit ${newItems.length} NEW missing transactions to the ledger.`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[700px]">
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex justify-between items-center">
          <h2 className="font-bold text-[var(--text-primary)] text-sm">Upload Bank Statement</h2>
        </div>
        <div className="p-4 flex-1 flex flex-col gap-4">
          <p className="text-xs text-[var(--text-secondary)]">Paste your CC or checking statement lines below. The AI will find missing items.</p>
          <textarea 
             value={statementText}
             onChange={e => setStatementText(e.target.value)}
             className="flex-1 w-full bg-[var(--bg-canvas)] border border-[var(--border)] rounded-md p-3 text-sm font-mono text-[var(--text-primary)] focus:ring-1 focus:ring-indigo-500"
             placeholder={`01/10 AWS SERVICOS -2100,00\n02/10 RECEBIMENTO PIX +15000,00`}
          />
          <button 
             onClick={handleReconcile} disabled={analyzing || !statementText}
             className="w-full bg-slate-800 hover:bg-slate-900 border border-slate-700 text-white font-bold py-2.5 rounded-md text-sm transition-colors disabled:opacity-50"
          >
             {analyzing ? '🔍 Reconciling against Ledger...' : '⚖️ Auto-Reconcile Statement'}
          </button>
        </div>
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex justify-between items-center">
          <h2 className="font-bold text-[var(--text-primary)] text-sm">Reconciliation Matrix</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[var(--bg-canvas)]">
           {!matches.length ? (
             <div className="h-full flex items-center justify-center text-[var(--text-tertiary)] italic text-sm">
               Run reconciliation to view matches and missing entries.
             </div>
           ) : (
             <div className="space-y-3">
               {matches.map((m, i) => (
                 <div key={i} className={`p-3 rounded-lg border text-xs shadow-sm ${m.isNew ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/50' : 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50'}`}>
                    <div className="flex justify-between font-bold mb-1">
                      <span className="text-[var(--text-primary)]">{m.description}</span>
                      <span className="font-mono">R$ {m.amount}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 mt-2 border-t border-black/5 dark:border-white/5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-rose-600">D: {m.debitAccount}</span>
                        <span className="text-[10px] text-emerald-600">C: {m.creditAccount}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.isNew ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {m.isNew ? '+ MISSING IN LEDGER' : '✓ PERFECT MATCH'}
                      </span>
                    </div>
                 </div>
               ))}
               <button onClick={handleCommitRecon} className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-md text-sm transition-colors">
                 Confirm Reconciliation
               </button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
