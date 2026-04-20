import React, { useState, useEffect } from 'react';
import { getTenantCOA, addTenantCOAAccount, deleteTenantCOAAccount, ChartAccount } from '@/lib/tenantAccountingService';
import { PromptModal } from '@/components/ui/PromptModal';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { getDictionary } from '@/lib/i18n/accountingDictionaries';

export function ChartOfAccountsTab({ tenantId, ledger }: { tenantId: string; ledger: any[] }) {
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const { user, tenant } = useAuth();
  const userRole = user?.role as string | undefined;
  const canManageCoa = userRole === 'ai_prompt_admin' || userRole === 'saas_master_admin' || userRole === 'tenant_admin';

  const [dict, setDict] = useState<any>(getDictionary('en'));

  useEffect(() => {
    loadCOA();
    
    // Fetch tenant dynamic config for language
    const fetchConfig = async () => {
      try {
        const { getFirestore, doc, getDoc } = await import('firebase/firestore');
        const db = getFirestore();
        const d = await getDoc(doc(db, `tenants/${tenantId}/config`, 'accounting'));
        if (d.exists() && d.data()?.language) {
           setDict(getDictionary(d.data().language));
        } else {
           // fallback to country mapping
           if ((tenant as any)?.country === 'BR') setDict(getDictionary('pt'));
        }
      } catch(e) {}
    };
    fetchConfig();
  }, [tenantId, (tenant as any)?.country]);

  const loadCOA = async () => {
    setLoading(true);
    try {
      const data = await getTenantCOA(tenantId);
      setAccounts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const [addPromptOpen, setAddPromptOpen] = useState(false);

  const handleAddClick = () => {
    setAddPromptOpen(true);
  };

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);

  const handleAiArchitect = async () => {
    if (!aiPrompt.trim()) return;
    setAiProcessing(true);
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch('/api/ai/coa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ tenantId, prompt: aiPrompt })
      });
      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        throw new Error(err.error || 'Failed to process AI COA restructuring');
      }
      const data = await res.json();
      toast.success(`AI Architecture built! Added ${data.addedCount}, Updated ${data.updatedCount} accounts.`);
      setAiModalOpen(false);
      setAiPrompt('');
      loadCOA();
    } catch(e: any) {
      console.error(e);
      toast.error(e.message);
    } finally {
      setAiProcessing(false);
    }
  };

  const handleAddSubmit = async (values: Record<string, string>) => {
    const { code, name, typeStr } = values;
    if (!code || !name) return;
    
    const type = (typeStr || 'EXPENSE') as any;
    
    try {
      await addTenantCOAAccount(tenantId, {
        code, name, type, isGroup: false
      });
      loadCOA();
      toast.success('Account added successfully');
    } catch(e) {
      console.error(e);
      toast.error('Failed adding account');
    }
  };

  const calculateBalance = (accountName: string) => {
    return ledger.reduce((sum, entry) => {
      if (entry.debitAccount === accountName) return sum + entry.amount;
      if (entry.creditAccount === accountName) return sum - entry.amount;
      return sum;
    }, 0);
  };

  if (loading) return <div className="p-8 text-center animate-pulse">Carregando Plano de Contas...</div>;

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden flex flex-col h-full h-[700px]">
      <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex justify-between items-center">
        <div>
          <h2 className="font-bold text-[var(--text-primary)]">Plano de Contas (COA)</h2>
          <p className="text-xs text-[var(--text-tertiary)]">Dynamic accounting hierarchy</p>
        </div>
        <div className="flex gap-2 items-center">
          {canManageCoa && (
            <button onClick={() => setAiModalOpen(true)} className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs px-3 py-1.5 rounded font-bold hover:bg-emerald-200 transition-colors flex items-center">
              ✨ AI Architect
            </button>
          )}
          <button onClick={handleAddClick} className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded font-bold hover:bg-indigo-700">
            + Add Account
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-tertiary)]">
              <th className="pb-2 font-semibold">Código</th>
              <th className="pb-2 font-semibold">Descrição</th>
              <th className="pb-2 font-semibold">Tipo</th>
              <th className="pb-2 font-semibold text-right">Saldo Atual (R$)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {accounts.map(acc => {
              const bg = acc.isGroup ? 'bg-[var(--bg-elevated)]' : '';
              const indentCount = (acc.code.match(/\./g) || []).length;
              const pl = indentCount * 1.5 + 'rem';
              const balance = acc.isGroup ? '-' : calculateBalance(acc.name);
              
              return (
                <tr key={acc.id} className={`${bg} hover:bg-black/5 transition-colors`}>
                  <td className="py-2.5 font-mono text-xs font-bold text-[var(--text-secondary)]" style={{ paddingLeft: pl }}>
                    {acc.code}
                  </td>
                  <td className={`py-2.5 ${acc.isGroup ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                     {acc.name}
                  </td>
                  <td className="py-2.5">
                     <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent text-white shadow
                       ${acc.type === 'ASSET' ? 'bg-emerald-500 hover:bg-emerald-600' :
                         acc.type === 'LIABILITY' ? 'bg-rose-500 hover:bg-rose-600' :
                         acc.type === 'EQUITY' ? 'bg-indigo-500 hover:bg-indigo-600' :
                         acc.type === 'REVENUE' ? 'bg-teal-500 hover:bg-teal-600' :
                         'bg-amber-500 hover:bg-amber-600'
                       }`}>
                       {dict[acc.type] || acc.type}
                     </span>
                  </td>
                  <td className={`py-2.5 text-right font-mono text-xs ${typeof balance === 'number' && balance !== 0 ? 'text-[var(--text-primary)] font-bold' : 'text-[var(--text-tertiary)]'}`}>
                    {typeof balance === 'number' 
                      ? Math.abs(balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + (balance < 0 ? ' (C)' : ' (D)')
                      : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PromptModal
        open={addPromptOpen}
        onOpenChange={setAddPromptOpen}
        title={dict.addAccount}
        description="Provide the code, name, and type for the new account leaf."
        fields={[
          { name: 'code', label: dict.accountCode, placeholder: 'x.x.x' },
          { name: 'name', label: dict.accountName, placeholder: 'Marketing Expense' },
          { name: 'typeStr', label: `${dict.classificationType} (ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE)`, defaultValue: 'EXPENSE' }
        ]}
        onSubmit={handleAddSubmit}
      />

      {/* AI Architect Modal */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-[var(--bg-background)] max-w-xl w-full rounded-2xl shadow-xl overflow-hidden animate-fade-in flex flex-col">
            <div className="p-6 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">✨ AI Graph Architect</h3>
                <p className="text-[13px] text-[var(--text-secondary)] mt-1">Prompt the AI to safely restructure your chart.</p>
              </div>
              <button 
                onClick={() => !aiProcessing && setAiModalOpen(false)}
                className="text-[var(--text-tertiary)] hover:text-black rounded"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6">
              <label className="block text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Natural Language Instructions</label>
              <textarea 
                className="w-full h-32 p-3 text-[13px] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none"
                placeholder="e.g. Can you reorganize the technology expenses into a new group called '6.2 Infraestrutura'?"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                disabled={aiProcessing}
              />
            </div>

            <div className="p-6 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex justify-between items-center">
              <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase max-w-[200px] leading-tight">Data limits restrict AI from destroying legacy nodes.</span>
              <button 
                onClick={handleAiArchitect}
                disabled={aiProcessing || !aiPrompt.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6 rounded-md text-sm transition-colors disabled:opacity-50 flex items-center"
              >
                {aiProcessing ? 'Architecting Node Map...' : 'Run Pipeline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
