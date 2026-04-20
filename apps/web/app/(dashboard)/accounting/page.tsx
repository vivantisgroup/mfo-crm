'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, orderBy, query, Timestamp, doc, getDoc, setDoc } from 'firebase/firestore';

const DEFAULT_ACCOUNTING_PROMPT = `Você é um Controller Financeiro e Especialista Contábil sênior operando dentro de um Multi-Family Office (MFO) de alta renda. Sua função é analisar transações financeiras brutas, descrições de faturas (invoices) e eventos de recebimento, e classificá-los com precisão milimétrica de acordo com o Plano de Contas da empresa.

O MFO possui operações no Brasil e no exterior, prestando serviços de gestão patrimonial, consultoria (advisory), estruturação financeira e licenciamento de software (SaaS) para outros consultores.

### SEU OBJETIVO
Sempre que receber os dados de uma transação ou fechamento de câmbio, você deve:
1. Identificar a natureza da operação (Receita, Despesa, Movimentação de Ativo/Passivo).
2. Classificar a transação na conta contábil correta.
3. Em caso de recebimentos internacionais, separar o valor principal da receita, os custos da operação (Spread/IOF) e alocar a Variação Cambial (Ativa ou Passiva).

### PLANO DE CONTAS AUTORIZADO
Utilize EXCLUSIVAMENTE as seguintes contas para a classificação:
[CHART_OF_ACCOUNTS_INJECTED_HERE]

### REGRAS DE CLASSIFICAÇÃO PARA CÂMBIO (ATENÇÃO PLENA)
- A Receita de Serviço Internacional é travada no valor da PTAX do dia da EMISSÃO.
- Qualquer valor recebido A MAIS na liquidação NÃO é receita de serviço; deve ser lançado como Variação Cambial Ativa (Receita).
- Qualquer valor recebido A MENOS deve ser lançado como Variação Cambial Passiva (Despesa).
- Custos descontados pelo banco devem ir para Tarifas Bancárias/IOF.
- Regra de Partidas Dobradas: Ativo Sobe (Débito) / Despesa (Débito). Passivo, Receita, PL Sobem (Crédito).

Você DEVE responder ESTRITAMENTE num JSON contendo um array "entries":
{
  "entries": [
    {
      "date": "2026-04-14",
      "description": "Pagamento Invoice 101 - Serviços de Advisory + Variação",
      "amount": 50000.00,
      "debitAccount": "O nome da conta exata do plano",
      "creditAccount": "O nome da conta exata do plano"
    }
  ]
}

- "amount" MUST be an absolute positive number.
- If the operation involves multiple splits (e.g. Principal Receita + Variação Cambial + IOF), you must return MULTIPLE ENTRIES in the array.
CRITICAL: return ONLY the valid JSON object. Do not output anything else.`;

import { ChartOfAccountsTab } from './components/ChartOfAccountsTab';
import { BankReconTab } from './components/BankReconTab';
import { FinancialDashboardsTab } from './components/FinancialDashboardsTab';
import { PromptModal } from '@/components/ui/PromptModal';
import { toast } from 'sonner';
import { executeExpenseRules } from '@/lib/expenseRulesService';

interface LedgerEntry {
  id?: string;
  date: string;
  description: string;
  amount: number;
  debitAccount: string;
  creditAccount: string;
  type: string;
  createdAt: any;
}

export default function AccountingPage() {
  const { tenant, user, firebaseUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'copilot' | 'dre' | 'balanco' | 'coa' | 'recon' | 'dashboards'>('copilot');
  
  // Copilot State
  const [rawText, setRawText] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [extractingPdf, setExtractingPdf] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [proposedEntries, setProposedEntries] = useState<LedgerEntry[]>([]);
  const [saving, setSaving] = useState(false);
  
  // Database State
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(true);

  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_ACCOUNTING_PROMPT);
  const [isPromptPanelOpen, setIsPromptPanelOpen] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [availableAis, setAvailableAis] = useState<{id: string, label: string}[]>([]);
  const [aiProvider, setAiProvider] = useState<string>(''); // Dynamic Provider State

  // Modal State
  const [expensePromptOpen, setExpensePromptOpen] = useState(false);
  
  // Kickstart Config State
  const [hasConfig, setHasConfig] = useState(true);
  const [configForm, setConfigForm] = useState({ region: 'Brasil', taxRegime: 'Lucro Presumido', language: 'pt' });
  const [savingConfig, setSavingConfig] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const userRole = user?.role as string | undefined;
  const canManagePrompts = userRole === 'ai_prompt_admin' || userRole === 'saas_master_admin' || userRole === 'tenant_admin';

  // ─── Fetch Ecosystem ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tenant?.id) return;
    const fetchLedger = async () => {
      setLoadingLedger(true);
      try {
        const q = query(collection(db, `tenants/${tenant.id}/ledger_entries`), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LedgerEntry));
        setLedger(data);
      } catch (e) {
        console.error("Failed to load ledger:", e);
      } finally {
        setLoadingLedger(false);
      }
    };
    const fetchPrompt = async () => {
      try {
        const pRef = doc(db, `tenants/${tenant.id}/config/ai_prompts`);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists() && pSnap.data().accountingPrompt) {
          setSystemPrompt(pSnap.data().accountingPrompt);
        } else {
          setSystemPrompt(DEFAULT_ACCOUNTING_PROMPT);
        }

        // Fetch BYOK AI Keys & Ecosystem via API
        const { getAuth } = await import('firebase/auth');
        const token = await getAuth().currentUser?.getIdToken();
        const providersRes = await fetch(`/api/ai/accounting?tenantId=${tenant.id}`, {
           headers: { Authorization: `Bearer ${token}` }
        });
        if (providersRes.ok) {
           const d = await providersRes.json();
           if (d.providers && Array.isArray(d.providers)) {
             setAvailableAis(d.providers);
             if (d.providers.length > 0) setAiProvider(d.providers[0].id);
           }
        }

      } catch (e) {
        console.error("Failed to load prompt:", e);
      }
    };

    const fetchConfig = async () => {
      try {
        const docRef = doc(db, `tenants/${tenant.id}/config`, 'accounting');
        const d = await getDoc(docRef);
        if (d.exists() && d.data()?.region) {
          setHasConfig(true);
        } else {
          setHasConfig(false);
          // Set standard defaults for tenant
          setConfigForm({ region: 'Brasil', taxRegime: 'Lucro Presumido', language: 'pt' });
        }
      } catch (e) {
        console.error("Failed to load accounting config", e);
      }
    };
    fetchConfig();
    fetchPrompt();
    fetchLedger();
  }, [tenant?.id, activeTab]); // re-fetch when swapping tabs

  // ─── AI Pipeline ────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!rawText.trim() || !tenant?.id) return;
    setAnalyzing(true);
    setProposedEntries([]);
    try {
      const token = await firebaseUser?.getIdToken();
      if (!token) throw new Error('No auth token');

      const res = await fetch('/api/ai/accounting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rawText, tenantId: tenant.id, provider: aiProvider, systemPromptOverride: systemPrompt })
      });

      if (!res.ok) {
        const errObj = await res.json().catch(() => ({}));
        toast.error(errObj.details || errObj.error || 'Inference failed due to Server Error');
        return;
      }
      
      const data = await res.json();
      if (data.entries) {
        setProposedEntries(data.entries);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error parsing transactions. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCommit = async () => {
    if (!tenant?.id || proposedEntries.length === 0) return;
    setSaving(true);
    try {
      const colRef = collection(db, `tenants/${tenant.id}/ledger_entries`);
      
      const promises = proposedEntries.map(entry => 
        addDoc(colRef, {
          ...entry,
          createdAt: Timestamp.now(),
          createdBy: user?.uid
        })
      );
      
      await Promise.all(promises);
      toast.success('Contabilização realizada com sucesso!');
      setProposedEntries([]);
      setRawText('');
      
    } catch (e) {
      console.error('Failed to commit ledger entries', e);
      toast.error('Error committing entries.');
    } finally {
      setSaving(false);
    }
  };

  const saveConfig = async () => {
    if (!tenant?.id) return;
    setSavingConfig(true);
    try {
      if (pdfFile) {
        const formData = new FormData();
        formData.append('pdf', pdfFile);
        formData.append('tenantId', tenant.id);
        formData.append('region', configForm.region);
        if (aiProvider) formData.append('provider', aiProvider);
        
        const token = await firebaseUser?.getIdToken();

        toast.info('Processando documentos de abertura com Inteligência Artificial. Isso pode demorar até 1 minuto.');
        
        const res = await fetch('/api/ai/kickstart', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        if (!res.ok) {
           const errObj = await res.json().catch(() => ({}));
           throw new Error(`${errObj.error || 'Falha na leitura Autônoma de Balanço Inicial.'} ${errObj.details || ''}`);
        }
        
        const { getFirestore, doc, setDoc } = await import('firebase/firestore');
        const db = getFirestore();
        const docRef = doc(db, `tenants/${tenant.id}/config`, 'accounting');
        await setDoc(docRef, { ...configForm, companyName: tenant.name, crmContactName: (tenant as any).crmContactName || '' }, { merge: true });
        toast.success('Configuração contábil e saldos iniciais injetados com sucesso!');
        window.location.reload();
      } else {
        const { getFirestore, doc, setDoc } = await import('firebase/firestore');
        const db = getFirestore();
        const docRef = doc(db, `tenants/${tenant.id}/config`, 'accounting');
        await setDoc(docRef, { ...configForm, companyName: tenant.name, crmContactName: (tenant as any).crmContactName || '' }, { merge: true });
        toast.success('Configuração salva. Plano de contas padrão populado!');
        window.location.reload();
      }
    } catch(e: any) {
      toast.error(e.message || 'Erro ao salvar a configuração.');
      console.error(e);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSavePrompt = async () => {
    if (!tenant?.id) return;
    setSavingPrompt(true);
    try {
      const pRef = doc(db, `tenants/${tenant.id}/config/ai_prompts`);
      await setDoc(pRef, { accountingPrompt: systemPrompt }, { merge: true });
      toast.success('System Prompt saved as Tenant Default!');
    } catch(e) {
      toast.error('Failed to save System Prompt.');
      console.error(e);
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleCommitExpenseClick = () => {
    if (!tenant?.id || proposedEntries.length === 0) return;
    setExpensePromptOpen(true);
  };

  const handleCommitExpenseSubmit = async (values: Record<string, string>) => {
    const expenseTitle = values.title;
    if (!expenseTitle || !tenant?.id) return;
    setSaving(true);
    try {
      const colRef = collection(db, `tenants/${tenant?.id}/expenses`);

      const promises = proposedEntries.map(entry => 
         addDoc(colRef, {
           title: `${expenseTitle} - ${entry.description}`,
           amount: entry.amount,
           category: entry.debitAccount,
           status: 'submitted',
           date: entry.date,
           source: 'AI Accounting Pipeline',
           createdAt: Timestamp.now(),
           createdBy: user?.uid
         })
      );
      const expenseDocs = await Promise.all(promises);

      // Route through Expense Approval Rules Engine
      for (let i = 0; i < expenseDocs.length; i++) {
        const docRef = expenseDocs[i];
        const entryData = proposedEntries[i];
        await executeExpenseRules(tenant.id, docRef.id, {
           status: 'submitted',
           amount: entryData.amount,
           category: entryData.debitAccount
        });
      }

      toast.success('🌟 Expense Report generated successfully!');
      setProposedEntries([]);
      setRawText('');
      setPdfUrl(null);
    } catch (e) {
      console.error(e);
      toast.error('Error creating expense report.');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.pdf')) {
      const url = URL.createObjectURL(file);
      setPdfUrl(url);

      const formData = new FormData();
      formData.append('file', file);
      setExtractingPdf(true);
      try {
        const res = await fetch('/api/tools/parse-pdf', { method: 'POST', body: formData });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setRawText(data.text);
      } catch (err) {
        console.error(err);
        toast.error('Failed to extract text from PDF. It may be an image without OCR data.');
      } finally {
        setExtractingPdf(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result;
        if (typeof text === 'string') {
          setRawText(prev => prev ? prev + '\n\n' + text : text);
        }
      };
      reader.readAsText(file);
    }
  };

  // ─── DRE Calculation (Income Statement) ─────────────────────────────────────
  // Net Income = Receitas - Custos - Despesas
  const calculateDRE = () => {
    let receitaBruta = 0;
    let impostos = 0;
    let despesasPessoal = 0;
    let despesasAdmin = 0;
    let revFinanceira = 0;

    ledger.forEach(entry => {
      // Receitas are CREDITED when increasing.
      if (entry.creditAccount === 'Receita de Serviços') receitaBruta += entry.amount;
      if (entry.creditAccount === 'Receita Financeira') revFinanceira += entry.amount;
      
      // Despesas are DEBITED when increasing.
      if (entry.debitAccount === 'Impostos sobre Serviços (ISS)' || entry.debitAccount === 'IRPJ' || entry.debitAccount === 'CSLL') impostos += entry.amount;
      if (entry.debitAccount === 'Despesas com Pessoal') despesasPessoal += entry.amount;
      if (entry.debitAccount === 'Despesas Administrativas' || entry.debitAccount === 'Despesas Operacionais' || entry.debitAccount === 'Despesas Bancárias') despesasAdmin += entry.amount;
    });

    const receitaLiquida = receitaBruta - impostos;
    const lucroOperacional = receitaLiquida - despesasPessoal - despesasAdmin;
    const lucroLiquido = lucroOperacional + revFinanceira;

    return { receitaBruta, impostos, receitaLiquida, despesasPessoal, despesasAdmin, lucroOperacional, revFinanceira, lucroLiquido };
  };

  // ─── Balance Sheet Calculation ────────────────────────────────────────────────
  // Ativo = Passivo + P.L.
  const calculateBalance = () => {
    let ativo = { banco: 0, contasReceber: 0 };
    let passivo = { contasPagar: 0, impostosRecolher: 0, salariosPagar: 0 };
    let pl = { capitalSocial: 0, lucrosAcumulados: 0 };

    ledger.forEach(e => {
      // ATIVO (Aumenta no Débito, Reduz no Crédito)
      if (e.debitAccount === 'Banco' || e.debitAccount === 'Caixa') ativo.banco += e.amount;
      if (e.creditAccount === 'Banco' || e.creditAccount === 'Caixa') ativo.banco -= e.amount;

      if (e.debitAccount === 'Contas a Receber') ativo.contasReceber += e.amount;
      if (e.creditAccount === 'Contas a Receber') ativo.contasReceber -= e.amount;

      // PASSIVO (Aumenta no Crédito, Reduz no Débito)
      if (e.creditAccount === 'Contas a Pagar') passivo.contasPagar += e.amount;
      if (e.debitAccount === 'Contas a Pagar') passivo.contasPagar -= e.amount;

      if (e.creditAccount === 'Impostos a Recolher') passivo.impostosRecolher += e.amount;
      if (e.debitAccount === 'Impostos a Recolher') passivo.impostosRecolher -= e.amount;

      if (e.creditAccount === 'Salários a Pagar') passivo.salariosPagar += e.amount;
      if (e.debitAccount === 'Salários a Pagar') passivo.salariosPagar -= e.amount;

      // PL (Aumenta no Crédito, Reduz no Débito)
      if (e.creditAccount === 'Capital Social') pl.capitalSocial += e.amount;
      if (e.debitAccount === 'Capital Social') pl.capitalSocial -= e.amount;

      if (e.creditAccount === 'Lucros Acumulados') pl.lucrosAcumulados += e.amount;
      if (e.debitAccount === 'Lucros Acumulados') pl.lucrosAcumulados -= e.amount;
    });

    // To balance, we must inject current year's Lucro Liquido into PL
    const dre = calculateDRE();
    pl.lucrosAcumulados += dre.lucroLiquido;

    const totalAtivo = ativo.banco + ativo.contasReceber;
    const totalPassivo = passivo.contasPagar + passivo.impostosRecolher + passivo.salariosPagar;
    const totalPL = pl.capitalSocial + pl.lucrosAcumulados;

    return { ativo, passivo, pl, totalAtivo, totalPassivoPL: totalPassivo + totalPL, totalPassivo, totalPL };
  };

  const dre = calculateDRE();
  const bal = calculateBalance();

  return (
    <div className="absolute inset-0 flex flex-col animate-fade-in w-full bg-[var(--bg-background)] overflow-hidden">
      {/* ── Kickstart Config Overlay ── */}
      {!hasConfig && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[var(--bg-background)] max-w-lg w-full rounded-2xl shadow-xl overflow-hidden animate-fade-in p-6 border border-[var(--border)]">
            <div className="flex flex-col items-center text-center space-y-4">
               <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-full flex items-center justify-center text-3xl shadow-sm mb-2">
                 🌍
               </div>
               <h3 className="text-xl font-bold text-[var(--text-primary)]">Configuração Regional da Contabilidade</h3>
               <p className="text-sm text-[var(--text-secondary)]">
                 Antes de prosseguir, configure as informações primárias para {tenant?.name}. Isso habilitará os módulos fiscais e o motor de inteligência artificial na região correta.
               </p>
               
               <div className="w-full space-y-3 mt-4 text-left">
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Região Contábil / Accounting Region</div>
                    <select className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" value={configForm.region} onChange={e => setConfigForm({...configForm, region: e.target.value})}>
                      <option value="Brasil">Brasil (BR GAAP)</option>
                      <option value="US">United States (US GAAP)</option>
                      <option value="IFRS">Internacional (IFRS)</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Idioma de Interface / User Language</div>
                    <select className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" value={(configForm as any).language || 'pt'} onChange={e => setConfigForm({...configForm, language: e.target.value})}>
                      <option value="pt">Português (Brasil)</option>
                      <option value="en">English (US)</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Regime Tributário</div>
                    <select className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" value={configForm.taxRegime} onChange={e => setConfigForm({...configForm, taxRegime: e.target.value})}>
                      <option value="Lucro Presumido">Lucro Presumido</option>
                      <option value="Lucro Real">Lucro Real</option>
                      <option value="Simples Nacional">Simples Nacional</option>
                    </select>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-[var(--border-subtle)]">
                     <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">Empresa Contratante</div>
                     <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{tenant?.name}</div>
                     {(tenant as any)?.crmContactName && <div className="text-xs text-slate-500 dark:text-slate-400">Responsável Legal: {(tenant as any).crmContactName}</div>}
                  </div>

                  <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                    <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                      Balanço de Abertura / Opening Trial Balance (Opcional)
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)] mb-3">
                      Faça o upload do Balancete/DRE em PDF. A Inteligência Artificial lerá o documento para criar dinamicamente as raízes do Plano de Contas e os lançamentos para refletir o saldo inicial exato da empresa neste sistema. Caso vazio, um default será gerado.
                    </p>
                    <label className="flex items-center gap-3 border-2 border-dashed border-[var(--border-strong)] rounded-lg p-3 text-sm cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors">
                      <span className="text-2xl text-indigo-500">📄</span>
                      <span className="flex-1 overflow-hidden truncate text-[var(--text-secondary)]">
                        {pdfFile ? pdfFile.name : 'Selecionar Documento PDF...'}
                      </span>
                      <input type="file" className="hidden" accept="application/pdf" onChange={e => setPdfFile(e.target.files?.[0] || null)} />
                    </label>

                    {pdfFile && (
                      <div className="mt-4 animate-fade-in">
                        <div className="text-xs font-semibold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Motor de Inteligência Artificial</div>
                        {availableAis.length === 0 ? (
                           <div className="text-xs text-rose-500 font-semibold bg-rose-50 p-2 rounded border border-rose-100">
                             Nenhuma AI configurada no sistema. O motor padrão embutido será utilizado em modo passivo.
                           </div>
                        ) : (
                           <select 
                             className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                             value={aiProvider} 
                             onChange={e => setAiProvider(e.target.value)}
                           >
                             {availableAis.map(ai => (
                               <option key={ai.id} value={ai.id}>{ai.label}</option>
                             ))}
                           </select>
                        )}
                        <p className="text-[10px] text-[var(--text-tertiary)] mt-1">O prompt de configuração será processado dinamicamente pela arquitetura neural do motor selecionado.</p>
                      </div>
                    )}
                  </div>
               </div>

               <button 
                 onClick={saveConfig} disabled={savingConfig}
                 className="w-full mt-6 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-3 rounded-xl shadow-md disabled:opacity-50 transition-colors"
               >
                 {savingConfig ? 'Salvando...' : 'Confirmar e Iniciar'}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="h-16 shrink-0 border-b border-[var(--border)] bg-[var(--bg-surface)] backdrop-blur-md sticky top-0 z-20 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold">
            🧾
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">AI Accounting Suite</h1>
            <p className="text-xs text-[var(--text-secondary)]">Autonomous Ledger Classifications & Reports</p>
          </div>
        </div>
        
        <div className="flex items-center bg-[var(--bg-elevated)] p-1 rounded-lg border border-[var(--border-subtle)]">
          {[
            { id: 'copilot', label: 'AI Copilot' },
            { id: 'recon', label: 'Bank Reconciliation' },
            { id: 'coa', label: 'Plano de Contas' },
            { id: 'dre', label: 'DRE (P&L)' },
            { id: 'balanco', label: 'Balanço Patrimonial' },
            { id: 'dashboards', label: 'Dashboards & Snapshots' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === t.id ? 'bg-[var(--bg-surface)] text-indigo-600 shadow-sm border border-[var(--border)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[var(--bg-canvas)]">
        <div className="max-w-5xl mx-auto w-full">

          {activeTab === 'coa' && <ChartOfAccountsTab tenantId={tenant?.id || ''} ledger={ledger} />}
          {activeTab === 'recon' && <BankReconTab tenantId={tenant?.id || ''} ledger={ledger} />}
          {activeTab === 'dashboards' && <FinancialDashboardsTab tenantId={tenant?.id || ''} ledger={ledger} />}

          {/* TAB: COPILOT */}
          {activeTab === 'copilot' && (
            <div className="flex flex-col gap-6">

              {/* AI Cognition Prompt Accordion */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden flex-shrink-0">
                 <button 
                   onClick={() => setIsPromptPanelOpen(!isPromptPanelOpen)}
                   className="w-full p-4 flex justify-between items-center hover:bg-[var(--bg-elevated)] transition-colors border-b border-[var(--border-subtle)]"
                 >
                   <div className="flex items-center gap-2">
                     <span className="text-xl">⚙️</span>
                     <span className="font-bold text-[var(--text-primary)] text-sm">AI Cognition Prompt Configuration</span>
                   </div>
                   <span className="text-[var(--text-secondary)] text-xs font-bold bg-[var(--bg-canvas)] px-2 py-1 rounded shadow-sm border border-[var(--border-subtle)]">{isPromptPanelOpen ? '▲ Collapse' : '▼ Expand & Customize'}</span>
                 </button>
                 
                 {isPromptPanelOpen && (
                   <div className="p-4 bg-[var(--bg-canvas)] flex flex-col gap-4">
                     <div className="flex justify-between items-start">
                        <p className="text-xs text-[var(--text-secondary)]">Customize the underlying System Prompt sent to the AI. Use the exact placeholder <code className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-1 rounded text-indigo-500 font-bold">[CHART_OF_ACCOUNTS_INJECTED_HERE]</code> where the mapped accounts should be injected.</p>
                        {canManagePrompts && (
                          <button 
                            onClick={handleSavePrompt} disabled={savingPrompt}
                            className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-md shadow-sm disabled:opacity-50 transition-colors whitespace-nowrap ml-4"
                          >
                            {savingPrompt ? 'Saving...' : '💾 Save as Tenant Default'}
                          </button>
                        )}
                     </div>
                     <textarea
                       className="w-full h-80 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md p-4 text-[var(--text-primary)] font-mono text-[13px] leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500"
                       value={systemPrompt}
                       onChange={e => setSystemPrompt(e.target.value)}
                     />
                   </div>
                 )}
              </div>

              {/* Copilot Pipeline Grid */}
              <div className={`grid grid-cols-1 ${pdfUrl ? 'lg:grid-cols-3' : 'md:grid-cols-2'} gap-6`}>
              
              {/* PDF Preview Pane (Left) */}
              {pdfUrl && (
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden flex flex-col h-[600px] lg:col-span-1">
                  <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex justify-between items-center">
                    <h2 className="font-bold text-[var(--text-primary)] text-sm">Document Presenter</h2>
                    <button onClick={() => setPdfUrl(null)} className="text-xs font-bold text-red-500 hover:text-red-700">✕ Close</button>
                  </div>
                  <iframe src={pdfUrl} className="flex-1 w-full bg-slate-100" />
                </div>
              )}

              {/* Center/Left: Input */}
              <div className={`bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden flex flex-col h-[600px] ${pdfUrl ? 'lg:col-span-1' : ''}`}>
                <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex justify-between items-center">
                  <h2 className="font-bold text-[var(--text-primary)] text-sm">Raw Transaction Input</h2>
                </div>
                <div className="p-4 flex-1 flex flex-col gap-4">
                  <p className="text-xs text-[var(--text-secondary)] mb-2">Paste raw statements, invoices, or manual narratives (e.g., "Pagamos R$ 5000 de salarios hoje" or CSV dumps). The AI will deduce the accounting entries.</p>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <label className="flex-1 text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:bg-[var(--bg-canvas)] cursor-pointer text-center py-2 rounded-md transition-colors text-[var(--text-primary)] relative">
                       {extractingPdf ? '⏳ Extracting Text from PDF...' : '📄 Upload Document (PDF, CSV, TXT)'}
                       <input 
                         type="file" 
                         accept=".csv,.txt,.ofx,.qif,.pdf" 
                         className="hidden"
                         onChange={handleFileUpload}
                         disabled={extractingPdf}
                       />
                    </label>
                  </div>

                  <textarea 
                    value={rawText}
                    onChange={e => setRawText(e.target.value)}
                    className="flex-1 w-full bg-[var(--bg-canvas)] border border-[var(--border)] rounded-md p-3 text-[var(--text-primary)] font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="2023-10-01, ALUGUEL SALA, -4500.00&#10;2023-10-02, HONORARIOS VIVANTS, +12000.00"
                  />
                  <div className="flex items-center gap-2">
                    {availableAis.length === 0 ? (
                      <div className="flex-1 bg-rose-50 border border-rose-200 text-rose-600 px-3 py-2.5 rounded-md text-xs font-bold text-center">
                        ⚠️ Please Configure AI Keys in Admin Panel First
                      </div>
                    ) : (
                      <>
                        <select 
                          value={aiProvider}
                          onChange={e => setAiProvider(e.target.value)}
                          className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold rounded-md py-2.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {availableAis.map(ai => (
                             <option key={ai.id} value={ai.id}>{ai.label}</option>
                          ))}
                        </select>
                        <button 
                          onClick={handleAnalyze} disabled={analyzing || !rawText}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-md text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {analyzing ? '⚙️ Classifying...' : '✨ Run AI Classifier'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Output */}
              <div className="flex flex-col h-[600px]">
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex justify-between items-center">
                    <h2 className="font-bold text-[var(--text-primary)] text-sm">Proposed Double-Entry Ledger</h2>
                    {proposedEntries.length > 0 && <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{proposedEntries.length} Items</span>}
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[var(--bg-canvas)]">
                    {proposedEntries.length === 0 ? (
                       <div className="h-full flex flex-col items-center justify-center text-[var(--text-tertiary)] italic text-sm">
                         Awaiting AI Input...
                       </div>
                    ) : (
                      <div className="space-y-3">
                        {proposedEntries.map((e, i) => (
                          <div key={i} className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3 rounded-lg shadow-sm text-xs">
                             <div className="flex justify-between items-start mb-2 pb-2 border-b border-[var(--border-subtle)]">
                               <div className="font-bold text-[var(--text-primary)]">{e.description}</div>
                               <div className="text-[var(--text-secondary)] font-mono">{e.date}</div>
                             </div>
                             <div className="flex justify-between items-center py-1">
                                <span className="text-rose-600 font-semibold w-24">DÉBITO</span>
                                <span className="flex-1 font-mono text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded ml-2">{e.debitAccount}</span>
                             </div>
                             <div className="flex justify-between items-center py-1">
                                <span className="text-emerald-600 font-semibold w-24">CRÉDITO</span>
                                <span className="flex-1 font-mono text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded ml-2">{e.creditAccount}</span>
                             </div>
                             <div className="mt-2 text-right font-bold text-sm text-[var(--text-primary)] border-t border-[var(--border-subtle)] pt-2">
                                R$ {e.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                             </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {proposedEntries.length > 0 && (
                    <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-elevated)] flex flex-col gap-2">
                      <button 
                        onClick={handleCommit} disabled={saving}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-md text-sm transition-colors disabled:opacity-50"
                      >
                        {saving ? 'Committing...' : 'Post to Standard Ledger (Livro Diário)'}
                      </button>
                      <button 
                        onClick={handleCommitExpenseClick} disabled={saving}
                        className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 rounded-md text-sm transition-colors disabled:opacity-50 border border-slate-700"
                      >
                        {saving ? 'Saving...' : '🧾 Save as Expense Report'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            </div>
          )}

          {/* TAB: DRE */}
          {activeTab === 'dre' && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-sm p-6 overflow-hidden">
               <h2 className="text-xl font-bold mb-6 text-[var(--text-primary)] border-b border-[var(--border)] pb-4 flex items-center justify-between">
                 <span>Demonstração do Resultado do Exercício (DRE)</span>
                 <button onClick={() => setActiveTab('dre')} className="text-xs bg-indigo-50 text-indigo-700 font-bold px-3 py-1 rounded shadow-sm border border-indigo-200">Export PDF</button>
               </h2>
               
               {loadingLedger ? (
                 <div className="py-20 text-center animate-pulse text-[var(--text-tertiary)] font-bold">Calculando...</div>
               ) : (
                 <div className="space-y-1 font-mono text-sm max-w-3xl mx-auto">
                   
                   <div className="flex justify-between py-2 font-bold text-[var(--text-primary)] text-base">
                      <span>(=) Receita Bruta</span>
                      <span className="text-emerald-600">R$ {dre.receitaBruta.toLocaleString('pt-BR', { minimumFractionDigits:2 })}</span>
                   </div>
                   
                   <div className="flex justify-between py-2 text-rose-600 pl-4 border-b border-[var(--border-subtle)] border-dashed">
                      <span>(-) Impostos e Deduções (ISS, CSLL, IRPJ)</span>
                      <span>(R$ {dre.impostos.toLocaleString('pt-BR', { minimumFractionDigits:2 })})</span>
                   </div>
                   
                   <div className="flex justify-between py-3 font-bold text-[var(--text-primary)]">
                      <span>(=) Receita Líquida</span>
                      <span>R$ {dre.receitaLiquida.toLocaleString('pt-BR', { minimumFractionDigits:2 })}</span>
                   </div>

                   <div className="flex justify-between py-1 text-rose-600 pl-4">
                      <span>(-) Despesas com Pessoal</span>
                      <span>(R$ {dre.despesasPessoal.toLocaleString('pt-BR', { minimumFractionDigits:2 })})</span>
                   </div>
                   <div className="flex justify-between py-1 text-rose-600 pl-4 border-b border-[var(--border-subtle)] border-dashed pb-3">
                      <span>(-) Despesas Administrativas & Operacionais</span>
                      <span>(R$ {dre.despesasAdmin.toLocaleString('pt-BR', { minimumFractionDigits:2 })})</span>
                   </div>
                   
                   <div className="flex justify-between py-3 font-bold text-[var(--text-primary)] bg-[var(--bg-elevated)] px-4 rounded-md mt-2">
                      <span>(=) Lucro Operacional (EBIT)</span>
                      <span>R$ {dre.lucroOperacional.toLocaleString('pt-BR', { minimumFractionDigits:2 })}</span>
                   </div>

                   <div className="flex justify-between py-2 text-emerald-600 pl-4 mt-2 border-b border-[var(--border-subtle)] border-dashed pb-3">
                      <span>(+) Receitas Financeiras</span>
                      <span>R$ {dre.revFinanceira.toLocaleString('pt-BR', { minimumFractionDigits:2 })}</span>
                   </div>

                   <div className="flex justify-between py-4 font-black text-lg text-[var(--text-primary)] bg-indigo-50 border border-indigo-100 px-4 rounded-md mt-4 dark:bg-indigo-900/20 dark:border-indigo-500/30">
                      <span>(=) Lucro Líquido do Exercício</span>
                      <span className={dre.lucroLiquido < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                        R$ {dre.lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits:2 })}
                      </span>
                   </div>
                 </div>
               )}
            </div>
          )}

          {/* TAB: BALANCO */}
          {activeTab === 'balanco' && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-sm p-6 overflow-hidden">
               <h2 className="text-xl font-bold mb-6 text-[var(--text-primary)] border-b border-[var(--border)] pb-4 flex items-center justify-between">
                 <span>Balanço Patrimonial</span>
                 <div className="flex items-center gap-3">
                   {Math.abs(bal.totalAtivo - bal.totalPassivoPL) < 0.01 ? (
                     <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded">✅ BALANCING MATCH</span>
                   ) : (
                     <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-1 rounded">⚠️ UNBALANCED (Δ {bal.totalAtivo - bal.totalPassivoPL})</span>
                   )}
                 </div>
               </h2>
               
               {loadingLedger ? (
                 <div className="py-20 text-center animate-pulse text-[var(--text-tertiary)] font-bold">Calculando...</div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-mono text-sm max-w-5xl mx-auto">
                   
                   {/* Left Side: Ativo */}
                   <div>
                     <h3 className="font-bold text-lg mb-4 text-[var(--text-primary)] bg-[var(--bg-elevated)] p-2 rounded text-center">ATIVO (Onde o recurso foi aplicado)</h3>
                     
                     <div className="space-y-4">
                       <div>
                         <div className="font-bold border-b border-[var(--border-subtle)] pb-1 mb-2">Ativo Circulante</div>
                         <div className="flex justify-between py-1 text-[var(--text-secondary)] pl-2">
                           <span>Banco / Caixa</span>
                           <span>R$ {bal.ativo.banco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                         </div>
                         <div className="flex justify-between py-1 text-[var(--text-secondary)] pl-2">
                           <span>Contas a Receber</span>
                           <span>R$ {bal.ativo.contasReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                         </div>
                       </div>
                     </div>

                     <div className="mt-8 flex justify-between py-3 px-4 font-black text-base text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-md">
                        <span>TOTAL DO ATIVO</span>
                        <span>R$ {bal.totalAtivo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                     </div>
                   </div>

                   {/* Right Side: Passivo e PL */}
                   <div>
                     <h3 className="font-bold text-lg mb-4 text-[var(--text-primary)] bg-[var(--bg-elevated)] p-2 rounded text-center">PASSIVO E PL (Origem do Recurso)</h3>
                     
                     <div className="space-y-6">
                       <div>
                         <div className="font-bold border-b border-[var(--border-subtle)] pb-1 mb-2">Passivo Circulante</div>
                         <div className="flex justify-between py-1 text-[var(--text-secondary)] pl-2">
                           <span>Contas a Pagar</span>
                           <span>R$ {bal.passivo.contasPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                         </div>
                         <div className="flex justify-between py-1 text-[var(--text-secondary)] pl-2">
                           <span>Impostos a Recolher</span>
                           <span>R$ {bal.passivo.impostosRecolher.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                         </div>
                         <div className="flex justify-between py-1 text-[var(--text-secondary)] pl-2">
                           <span>Salários a Pagar</span>
                           <span>R$ {bal.passivo.salariosPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                         </div>
                         <div className="flex justify-between py-2 font-bold text-[var(--text-primary)] pl-2 border-t border-[var(--border-subtle)] mt-2">
                           <span>Total Passivo</span>
                           <span>R$ {bal.totalPassivo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                         </div>
                       </div>

                       <div>
                         <div className="font-bold border-b border-[var(--border-subtle)] pb-1 mb-2">Patrimônio Líquido</div>
                         <div className="flex justify-between py-1 text-[var(--text-secondary)] pl-2">
                           <span>Capital Social</span>
                           <span>R$ {bal.pl.capitalSocial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                         </div>
                         <div className="flex justify-between py-1 text-[var(--text-secondary)] pl-2">
                           <span>Lucros Acumulados (Incluso Resultado do Exc.)</span>
                           <span>R$ {bal.pl.lucrosAcumulados.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                         </div>
                         <div className="flex justify-between py-2 font-bold text-[var(--text-primary)] pl-2 border-t border-[var(--border-subtle)] mt-2">
                           <span>Total PL</span>
                           <span>R$ {bal.totalPL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                         </div>
                       </div>
                     </div>

                     <div className="mt-8 flex justify-between py-3 px-4 font-black text-base text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-md">
                        <span>TOTAL DO PASSIVO + PL</span>
                        <span>R$ {bal.totalPassivoPL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                     </div>
                   </div>

                 </div>
               )}
            </div>
          )}

        </div>
      </div>

      <PromptModal
        open={expensePromptOpen}
        onOpenChange={setExpensePromptOpen}
        title="Expense Report Details"
        description="Provide a parent title for this expense collection before committing to the approval queue."
        fields={[{ name: 'title', label: 'Report Title', defaultValue: 'Generated Expense Report' }]}
        onSubmit={handleCommitExpenseSubmit}
        submitText="Generate Report"
      />
    </div>
  );
}
