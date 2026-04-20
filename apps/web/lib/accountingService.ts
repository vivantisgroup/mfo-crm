import { collection, doc, query, orderBy, limit, getDocs, addDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface LedgerEntry {
  id: string;
  date: string;
  accountId: string; // e.g., '101'
  accountName: string; // e.g., 'Cash', 'Accounts Receivable', 'Software Expenses', 'SaaS Revenue'
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  description: string;
  debit: number;
  credit: number;
}

export interface ChartAccount {
  id: string;
  code: string;         // e.g., "1.1.1"
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  isGroup: boolean;     // True if it just groups children (no direct transactions)
  parentId?: string;    // Links to parent account ID to build the hierarchy
  isSystem?: boolean;   // Marks the base template to prevent deletion
}

let localChartOfAccounts: ChartAccount[] = [
  { id: 'coa-1',   code: '1',     name: 'Assets', type: 'ASSET', isGroup: true, isSystem: true },
  { id: 'coa-1.1', code: '1.1',   name: 'Current Assets', type: 'ASSET', isGroup: true, parentId: 'coa-1', isSystem: true },
  { id: 'coa-101', code: '1.1.1', name: 'Cash and Equivalents', type: 'ASSET', isGroup: false, parentId: 'coa-1.1', isSystem: true },
  { id: 'coa-102', code: '1.1.2', name: 'Accounts Receivable', type: 'ASSET', isGroup: false, parentId: 'coa-1.1', isSystem: true },
  { id: 'coa-1.2', code: '1.2',   name: 'Non-Current Assets', type: 'ASSET', isGroup: true, parentId: 'coa-1', isSystem: true },
  
  { id: 'coa-2',   code: '2',     name: 'Liabilities', type: 'LIABILITY', isGroup: true, isSystem: true },
  { id: 'coa-2.1', code: '2.1',   name: 'Current Liabilities', type: 'LIABILITY', isGroup: true, parentId: 'coa-2', isSystem: true },
  { id: 'coa-201', code: '2.1.1', name: 'Accounts Payable', type: 'LIABILITY', isGroup: false, parentId: 'coa-2.1', isSystem: true },

  { id: 'coa-3',   code: '3',     name: 'Equity', type: 'EQUITY', isGroup: true, isSystem: true },
  { id: 'coa-301', code: '3.1.1', name: 'Common Stock', type: 'EQUITY', isGroup: false, parentId: 'coa-3', isSystem: true },
  { id: 'coa-302', code: '3.1.2', name: 'Retained Earnings', type: 'EQUITY', isGroup: false, parentId: 'coa-3', isSystem: true },

  { id: 'coa-4',   code: '4',     name: 'Revenue', type: 'REVENUE', isGroup: true, isSystem: true },
  { id: 'coa-400', code: '4.1.1', name: 'Operating Revenue', type: 'REVENUE', isGroup: false, parentId: 'coa-4', isSystem: true },

  { id: 'coa-5',   code: '5',     name: 'Expenses', type: 'EXPENSE', isGroup: true, isSystem: true },
  { id: 'coa-501', code: '5.1.1', name: 'Cost of Goods Sold', type: 'EXPENSE', isGroup: false, parentId: 'coa-5', isSystem: true },
  { id: 'coa-510', code: '5.2.1', name: 'Operating Expenses', type: 'EXPENSE', isGroup: false, parentId: 'coa-5', isSystem: true },
  { id: 'coa-520', code: '5.2.2', name: 'Payroll Expenses', type: 'EXPENSE', isGroup: false, parentId: 'coa-5', isSystem: true },
  { id: 'coa-530', code: '5.2.3', name: 'Marketing & Advertising', type: 'EXPENSE', isGroup: false, parentId: 'coa-5', isSystem: true },
];

// Generate some sample data locally if Firestore is empty
let localLedger: LedgerEntry[] = [
  { id: 'le-1', date: new Date(Date.now() - 5*86400000).toISOString(), accountId: '400', accountName: 'SaaS Revenue', type: 'REVENUE', description: 'Monthly Subscription Billing', debit: 0, credit: 15400 },
  { id: 'le-2', date: new Date(Date.now() - 5*86400000).toISOString(), accountId: '101', accountName: 'Cash', type: 'ASSET', description: 'Monthly Subscription Billing', debit: 15400, credit: 0 },
  { id: 'le-3', date: new Date(Date.now() - 3*86400000).toISOString(), accountId: '501', accountName: 'Software Expenses', type: 'EXPENSE', description: 'AWS Hosting', debit: 2100, credit: 0 },
  { id: 'le-4', date: new Date(Date.now() - 3*86400000).toISOString(), accountId: '101', accountName: 'Cash', type: 'ASSET', description: 'AWS Hosting', debit: 0, credit: 2100 },
  { id: 'le-5', date: new Date(Date.now() - 1*86400000).toISOString(), accountId: '510', accountName: 'Travel & Entertainment', type: 'EXPENSE', description: 'Client Dinner NYC', debit: 650, credit: 0 },
  { id: 'le-6', date: new Date(Date.now() - 1*86400000).toISOString(), accountId: '201', accountName: 'Accounts Payable', type: 'LIABILITY', description: 'Client Dinner NYC', debit: 0, credit: 650 },
];

export async function getLedgerEntries(): Promise<LedgerEntry[]> {
  const q = query(collection(db, 'platform_accounting'), orderBy('date', 'desc'), limit(100));
  const snap = await getDocs(q);
  if (snap.empty) return localLedger.sort((a,b) => b.date.localeCompare(a.date));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerEntry));
}

export async function addLedgerEntry(entry: Omit<LedgerEntry, 'id'>): Promise<LedgerEntry> {
  const docRef = await addDoc(collection(db, 'platform_accounting'), entry);
  return { id: docRef.id, ...entry };
}

export async function getChartOfAccounts(): Promise<ChartAccount[]> {
  const q = query(collection(db, 'platform_chart_accounts'), orderBy('code', 'asc'));
  const snap = await getDocs(q);
  if (snap.empty) return localChartOfAccounts.sort((a,b) => a.code.localeCompare(b.code));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ChartAccount));
}

export async function addChartAccount(entry: Omit<ChartAccount, 'id'>): Promise<ChartAccount> {
  const docRef = await addDoc(collection(db, 'platform_chart_accounts'), entry);
  return { id: docRef.id, ...entry };
}

export async function postMarketingExpenseToLedger(amount: number, description: string, campaignId?: string): Promise<void> {
  const date = new Date().toISOString();
  
  // Debit Marketing Expenses
  await addLedgerEntry({
    date,
    accountId: '530',
    accountName: 'Marketing & Advertising',
    type: 'EXPENSE',
    description: `[MKT${campaignId ? ` - ${campaignId}` : ''}] ${description}`,
    debit: amount,
    credit: 0
  });

  // Credit Accounts Payable
  await addLedgerEntry({
    date,
    accountId: '201',
    accountName: 'Accounts Payable',
    type: 'LIABILITY',
    description: `[MKT${campaignId ? ` - ${campaignId}` : ''}] ${description}`,
    debit: 0,
    credit: amount 
  });
}
