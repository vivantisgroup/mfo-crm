/**
 * expenseService.ts
 * Firestore-backed expense tracking for SaaS platform OPEX management.
 */

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logAction } from '@/lib/auditLog';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ExpenseCategory =
  | 'infrastructure'
  | 'software'
  | 'personnel'
  | 'marketing'
  | 'legal'
  | 'support'
  | 'office'
  | 'other';

export type ExpenseFrequency = 'monthly' | 'annual' | 'one_time';

export interface PlatformExpense {
  id:          string;
  name:        string;          // e.g. "Firebase / GCP"
  category:    ExpenseCategory;
  frequency:   ExpenseFrequency;
  amountUsd:   number;          // base amount (monthly if monthly/annual, total if one_time)
  vendor:      string;
  description: string;
  startDate:   string;          // ISO date string YYYY-MM-DD
  endDate?:    string;          // for one-time or cancelled recurring
  active:      boolean;
  tags:        string[];
  createdBy:   string;
  createdAt:   string;
  updatedAt:   string;
}

export const EXPENSE_CATEGORIES: Record<ExpenseCategory, { label: string; icon: string; color: string }> = {
  infrastructure: { label: 'Infrastructure',      icon: '☁️',  color: '#6366f1' },
  software:       { label: 'Software / SaaS',     icon: '💻',  color: '#22d3ee' },
  personnel:      { label: 'Personnel',           icon: '👥',  color: '#f59e0b' },
  marketing:      { label: 'Marketing',           icon: '📣',  color: '#ec4899' },
  legal:          { label: 'Legal & Compliance',  icon: '⚖️',  color: '#8b5cf6' },
  support:        { label: 'Customer Support',    icon: '🎫',  color: '#14b8a6' },
  office:         { label: 'Office & Admin',      icon: '🏢',  color: '#94a3b8' },
  other:          { label: 'Other',               icon: '📦',  color: '#64748b' },
};

export const FREQ_LABELS: Record<ExpenseFrequency, string> = {
  monthly:  'Monthly',
  annual:   'Annual',
  one_time: 'One-time',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const COL = 'platform_expenses';

function toExpense(id: string, data: any): PlatformExpense {
  return {
    id,
    name:        data.name        ?? '',
    category:    data.category    ?? 'other',
    frequency:   data.frequency   ?? 'monthly',
    amountUsd:   data.amountUsd   ?? 0,
    vendor:      data.vendor      ?? '',
    description: data.description ?? '',
    startDate:   data.startDate   ?? '',
    endDate:     data.endDate,
    active:      data.active      ?? true,
    tags:        data.tags        ?? [],
    createdBy:   data.createdBy   ?? '',
    createdAt:   data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : (data.createdAt ?? ''),
    updatedAt:   data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : (data.updatedAt ?? ''),
  };
}

/** Monthly equivalent for any frequency */
export function monthlyEquivalent(e: PlatformExpense): number {
  if (e.frequency === 'monthly')  return e.amountUsd;
  if (e.frequency === 'annual')   return Math.round(e.amountUsd / 12);
  return 0; // one_time — not counted in MRR-style expense calc
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────

export async function getAllExpenses(): Promise<PlatformExpense[]> {
  const snap = await getDocs(query(collection(db, COL), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => toExpense(d.id, { id: d.id, ...d.data() }));
}

export interface CreateExpenseInput {
  name: string; category: ExpenseCategory; frequency: ExpenseFrequency;
  amountUsd: number; vendor: string; description: string; startDate: string;
  endDate?: string; active?: boolean; tags?: string[]; createdBy: string;
}

export async function createExpense(
  input: CreateExpenseInput,
  performer: { uid: string },
): Promise<PlatformExpense> {
  const payload = {
    ...input,
    active: input.active ?? true,
    tags:   input.tags ?? [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, COL), payload);
  await updateDoc(doc(db, COL, ref.id), { id: ref.id });
  await logAction({
    tenantId: 'platform', userId: performer.uid, userName: performer.uid,
    action: 'EXPENSE_CREATED', resourceId: ref.id,
    resourceType: 'expense', resourceName: input.name, status: 'success',
  });
  return toExpense(ref.id, { ...payload, id: ref.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
}

export async function updateExpense(
  id: string,
  patch: Partial<Omit<PlatformExpense, 'id' | 'createdAt' | 'createdBy'>>,
  performer: { uid: string },
): Promise<void> {
  await updateDoc(doc(db, COL, id), { ...patch, updatedAt: serverTimestamp() });
  await logAction({
    tenantId: 'platform', userId: performer.uid, userName: performer.uid,
    action: 'EXPENSE_UPDATED', resourceId: id,
    resourceType: 'expense', resourceName: patch.name ?? id, status: 'success',
  });
}

export async function deleteExpense(id: string, name: string, performer: { uid: string }): Promise<void> {
  await deleteDoc(doc(db, COL, id));
  await logAction({
    tenantId: 'platform', userId: performer.uid, userName: performer.uid,
    action: 'EXPENSE_DELETED', resourceId: id,
    resourceType: 'expense', resourceName: name, status: 'success',
  });
}

// ─── Seed ──────────────────────────────────────────────────────────────────────

export async function seedExpensesIfEmpty(performer: { uid: string }): Promise<boolean> {
  const snap = await getDocs(collection(db, COL));
  if (!snap.empty) return false;

  const seeds: CreateExpenseInput[] = [
    { name: 'Firebase / GCP',           category: 'infrastructure', frequency: 'monthly', amountUsd: 380,  vendor: 'Google Cloud',    description: 'Firestore, Auth, Storage, Cloud Run',        startDate: '2024-01-01', createdBy: performer.uid },
    { name: 'OpenAI API',               category: 'software',       frequency: 'monthly', amountUsd: 210,  vendor: 'OpenAI',          description: 'Shared API usage across all tenants',        startDate: '2024-01-01', createdBy: performer.uid },
    { name: 'Vercel Hosting',           category: 'infrastructure', frequency: 'monthly', amountUsd: 120,  vendor: 'Vercel',          description: 'Production and preview deployments',         startDate: '2024-01-01', createdBy: performer.uid },
    { name: 'SendGrid Email',           category: 'software',       frequency: 'monthly', amountUsd: 45,   vendor: 'Twilio SendGrid', description: 'Transactional and notification emails',       startDate: '2024-06-01', createdBy: performer.uid },
    { name: 'Datadog Monitoring',       category: 'infrastructure', frequency: 'monthly', amountUsd: 120,  vendor: 'Datadog',         description: 'APM, logs, and uptime monitoring',            startDate: '2024-03-01', createdBy: performer.uid },
    { name: 'Domain & DNS',             category: 'infrastructure', frequency: 'annual',  amountUsd: 144,  vendor: 'Cloudflare',      description: 'Annual domain registration and DNS',          startDate: '2024-01-01', createdBy: performer.uid },
    { name: 'Legal & Compliance',       category: 'legal',          frequency: 'monthly', amountUsd: 500,  vendor: 'LegalZoom Pro',   description: 'Compliance review, ToS updates, contracts',  startDate: '2024-01-01', createdBy: performer.uid },
    { name: 'Operations Team',          category: 'personnel',      frequency: 'monthly', amountUsd: 4200, vendor: 'Internal',        description: 'Ops team salaries allocated to platform',     startDate: '2024-01-01', createdBy: performer.uid },
    { name: 'Marketing & Ads',          category: 'marketing',      frequency: 'monthly', amountUsd: 800,  vendor: 'Google / Meta',   description: 'Paid acquisition campaigns',                 startDate: '2024-09-01', createdBy: performer.uid },
    { name: 'Customer Support Tools',   category: 'support',        frequency: 'monthly', amountUsd: 85,   vendor: 'Intercom',        description: 'Live chat and support ticket platform',       startDate: '2024-04-01', createdBy: performer.uid },
    { name: 'SOC 2 Audit',             category: 'legal',          frequency: 'one_time', amountUsd: 8000, vendor: 'A-LIGN',         description: 'Annual SOC 2 Type II audit engagement',      startDate: '2026-01-15', endDate: '2026-03-15', createdBy: performer.uid },
  ];

  await Promise.all(seeds.map(s => createExpense(s, performer)));
  return true;
}
