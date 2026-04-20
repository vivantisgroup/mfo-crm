import { collection, doc, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface ChartAccount {
  id: string;
  code: string;         // e.g., "1.1.1"
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  isGroup: boolean;     // True if it just groups children (no direct transactions)
  parentId?: string;    // Links to parent account ID to build the hierarchy
  isSystem?: boolean;   // Marks the base template to prevent deletion
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountName: string; // e.g., 'Caixa Principal' or 'Itaú CC'
  chartAccountId: string; // the linked asset account ID in the COA
}

export interface LedgerEntry {
  id?: string;
  date: string;
  description: string;
  amount: number;
  debitAccount: string; // This should eventually map to ChartAccount name or Code. Right now relying on strings.
  creditAccount: string;
  type?: string;
  createdAt?: any;
  createdBy?: string;
  reconciled?: boolean; // If linked to a bank statement
}

const DEFAULT_COA_BR: Omit<ChartAccount, 'id'>[] = [
  // 1. ATIVO
  { code: '1', name: 'Ativo', type: 'ASSET', isGroup: true, isSystem: true },
  { code: '1.1', name: 'Ativo Circulante', type: 'ASSET', isGroup: true, parentId: '1', isSystem: true },
  { code: '1.1.1.1', name: 'Bancos Conta Movimento (BRL)', type: 'ASSET', isGroup: false, parentId: '1.1', isSystem: true },
  { code: '1.1.1.2', name: 'Bancos Conta Movimento (Exterior - USD/EUR)', type: 'ASSET', isGroup: false, parentId: '1.1', isSystem: true },
  { code: '1.1.2.1', name: 'Taxas de Gestão a Receber (BRL)', type: 'ASSET', isGroup: false, parentId: '1.1', isSystem: true },
  { code: '1.1.2.2', name: 'Clientes Nacionais a Receber', type: 'ASSET', isGroup: false, parentId: '1.1', isSystem: true },
  { code: '1.1.2.3', name: 'Advisory a Receber (BRL)', type: 'ASSET', isGroup: false, parentId: '1.1', isSystem: true },
  { code: '1.1.2.4', name: 'Clientes Exterior a Receber (Invoice Moeda Estrangeira)', type: 'ASSET', isGroup: false, parentId: '1.1', isSystem: true },
  { code: '1.1.3', name: 'Aplicações Financeiras', type: 'ASSET', isGroup: false, parentId: '1.1', isSystem: true },
  { code: '1.1.4', name: 'Adiantamentos', type: 'ASSET', isGroup: false, parentId: '1.1', isSystem: true },
  { code: '1.1.5', name: 'Impostos a Recuperar', type: 'ASSET', isGroup: false, parentId: '1.1', isSystem: true },
  
  // 2. PASSIVO
  { code: '2', name: 'Passivo', type: 'LIABILITY', isGroup: true, isSystem: true },
  { code: '2.1', name: 'Passivo Circulante', type: 'LIABILITY', isGroup: true, parentId: '2', isSystem: true },
  { code: '2.1.1', name: 'Fornecedores (Nacionais e Internacionais)', type: 'LIABILITY', isGroup: false, parentId: '2.1', isSystem: true },
  { code: '2.1.2', name: 'Obrigações Trabalhistas e Sociais', type: 'LIABILITY', isGroup: false, parentId: '2.1', isSystem: true },
  { code: '2.1.3', name: 'Obrigações Tributárias', type: 'LIABILITY', isGroup: false, parentId: '2.1', isSystem: true },
  { code: '2.1.4', name: 'Contas a Pagar - Parceiros (Fee Sharing / Bankers)', type: 'LIABILITY', isGroup: false, parentId: '2.1', isSystem: true },
  { code: '2.1.5', name: 'Dividendos a Pagar', type: 'LIABILITY', isGroup: false, parentId: '2.1', isSystem: true },

  // 3. PATRIMÔNIO LÍQUIDO
  { code: '3', name: 'Patrimônio Líquido', type: 'EQUITY', isGroup: true, isSystem: true },
  { code: '3.1.1', name: 'Capital Social', type: 'EQUITY', isGroup: false, parentId: '3', isSystem: true },
  { code: '3.1.2', name: 'Lucros Acumulados', type: 'EQUITY', isGroup: false, parentId: '3', isSystem: true },
  { code: '3.1.9', name: 'Balanço de Abertura / Implantação', type: 'EQUITY', isGroup: false, parentId: '3', isSystem: true },

  // 4. RECEITAS
  { code: '4', name: 'Receitas', type: 'REVENUE', isGroup: true, isSystem: true },
  { code: '4.1', name: 'Receitas Nacionais', type: 'REVENUE', isGroup: true, parentId: '4', isSystem: true },
  { code: '4.1.1', name: 'Taxas de Gestão (BRL)', type: 'REVENUE', isGroup: false, parentId: '4.1', isSystem: true },
  { code: '4.1.2', name: 'Taxas de Performance (BRL)', type: 'REVENUE', isGroup: false, parentId: '4.1', isSystem: true },
  { code: '4.1.3', name: 'Estruturação Financeira (BRL)', type: 'REVENUE', isGroup: false, parentId: '4.1', isSystem: true },
  { code: '4.2', name: 'Receitas Internacionais', type: 'REVENUE', isGroup: true, parentId: '4', isSystem: true },
  { code: '4.2.1', name: 'Consultoria e Advisory (Exterior)', type: 'REVENUE', isGroup: false, parentId: '4.2', isSystem: true },
  { code: '4.2.2', name: 'Rebates e Fee Sharing Internacional', type: 'REVENUE', isGroup: false, parentId: '4.2', isSystem: true },
  { code: '4.3', name: 'Receitas de Tecnologia (Licenciamento SaaS)', type: 'REVENUE', isGroup: false, parentId: '4', isSystem: true },
  { code: '4.5.1', name: 'Variação Cambial Ativa (Ganhos de Câmbio no Recebimento)', type: 'REVENUE', isGroup: false, parentId: '4', isSystem: true },

  // 5. CUSTOS E DESPESAS
  { code: '5', name: 'Custos e Despesas', type: 'EXPENSE', isGroup: true, isSystem: true },
  { code: '5.1', name: 'Custos Operacionais', type: 'EXPENSE', isGroup: true, parentId: '5', isSystem: true },
  { code: '5.1.1', name: 'Provedores de Dados Financeiros (Bloomberg, etc.)', type: 'EXPENSE', isGroup: false, parentId: '5.1', isSystem: true },
  { code: '5.1.2', name: 'Repasses a Associados', type: 'EXPENSE', isGroup: false, parentId: '5.1', isSystem: true },
  { code: '5.2', name: 'Despesas Administrativas', type: 'EXPENSE', isGroup: true, parentId: '5', isSystem: true },
  { code: '5.2.1', name: 'Pessoal e Encargos', type: 'EXPENSE', isGroup: false, parentId: '5.2', isSystem: true },
  { code: '5.2.2', name: 'Infraestrutura Cloud, APIs e Licenças', type: 'EXPENSE', isGroup: false, parentId: '5.2', isSystem: true },
  { code: '5.4', name: 'Despesas Financeiras e Câmbio', type: 'EXPENSE', isGroup: true, parentId: '5', isSystem: true },
  { code: '5.4.1', name: 'Variação Cambial Passiva (Perdas de Câmbio no Recebimento)', type: 'EXPENSE', isGroup: false, parentId: '5.4', isSystem: true },
  { code: '5.4.2', name: 'Tarifas Bancárias, IOF e Câmbio', type: 'EXPENSE', isGroup: false, parentId: '5.4', isSystem: true },
];

const DEFAULT_COA_US: Omit<ChartAccount, 'id'>[] = [
  { code: '1', name: 'Assets', type: 'ASSET', isGroup: true, isSystem: true },
  { code: '1.1', name: 'Current Assets', type: 'ASSET', isGroup: true, parentId: '1', isSystem: true },
  { code: '1.1.1', name: 'Bank Accounts', type: 'ASSET', isGroup: false, parentId: '1.1', isSystem: true },
  { code: '1.1.2', name: 'Accounts Receivable', type: 'ASSET', isGroup: false, parentId: '1.1', isSystem: true },
  { code: '2', name: 'Liabilities', type: 'LIABILITY', isGroup: true, isSystem: true },
  { code: '3', name: 'Equity', type: 'EQUITY', isGroup: true, isSystem: true },
  { code: '4', name: 'Revenue', type: 'REVENUE', isGroup: true, isSystem: true },
  { code: '4.1.1', name: 'Service Revenue', type: 'REVENUE', isGroup: false, parentId: '4', isSystem: true },
  { code: '5', name: 'Expenses', type: 'EXPENSE', isGroup: true, isSystem: true },
  { code: '5.1.1', name: 'Operating Expenses', type: 'EXPENSE', isGroup: false, parentId: '5', isSystem: true },
];

export async function getTenantCOA(tenantId: string, configuredRegion: string = 'Brasil'): Promise<ChartAccount[]> {
  const q = query(collection(db, `tenants/${tenantId}/chart_of_accounts`), orderBy('code', 'asc'));
  const snap = await getDocs(q);
  
  // Auto-seed if empty
  if (snap.empty) {
    const colRef = collection(db, `tenants/${tenantId}/chart_of_accounts`);
    const seeded: ChartAccount[] = [];
    const template = configuredRegion === 'US' ? DEFAULT_COA_US : DEFAULT_COA_BR;
    
    for (const act of template) {
      const docRef = await addDoc(colRef, act);
      seeded.push({ id: docRef.id, ...act });
    }
    return seeded.sort((a, b) => a.code.localeCompare(b.code));
  }

  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ChartAccount));
}

export async function updateTenantCOAAccount(tenantId: string, accountId: string, data: Partial<ChartAccount>) {
  await updateDoc(doc(db, `tenants/${tenantId}/chart_of_accounts`, accountId), data);
}

export async function addTenantCOAAccount(tenantId: string, data: Omit<ChartAccount, 'id'>) {
  const docRef = await addDoc(collection(db, `tenants/${tenantId}/chart_of_accounts`), data);
  return { id: docRef.id, ...data };
}

export async function deleteTenantCOAAccount(tenantId: string, accountId: string) {
  await deleteDoc(doc(db, `tenants/${tenantId}/chart_of_accounts`, accountId));
}

export async function getTenantBanks(tenantId: string): Promise<BankAccount[]> {
  const q = query(collection(db, `tenants/${tenantId}/banks`));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount));
}

export async function addTenantBank(tenantId: string, data: Omit<BankAccount, 'id'>) {
  const docRef = await addDoc(collection(db, `tenants/${tenantId}/banks`), data);
  return { id: docRef.id, ...data };
}
