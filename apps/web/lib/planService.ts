/**
 * planService.ts
 *
 * Manages subscription plan definitions stored in Firestore.
 * Plans are versioned — every edit creates an immutable snapshot so we can
 * reconstruct exactly what conditions a customer was licensed under at any
 * point in time (grandfather clause support).
 *
 * Firestore collections:
 *   subscription_plans/{code}              — active plan definitions
 *   subscription_plan_versions/{id}        — immutable snapshots on each edit
 */

import { firebaseApp } from '@mfo-crm/config';
import {
  getFirestore,
  collection, doc, getDoc, getDocs, setDoc, addDoc,
  updateDoc, deleteDoc, query, where, orderBy, writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

const db = getFirestore(firebaseApp);

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlanStatus = 'active' | 'legacy' | 'archived';

export interface PlanDefinition {
  // Identity
  code:           string;    // immutable slug, e.g. "STARTER-2026" — never changes
  name:           string;
  description:    string;
  icon:           string;
  color:          string;
  sortOrder:      number;

  // Pricing
  baseMonthly:      number;
  baseAnnual:       number;   // full year price (not per month)
  pricePerSeat:     number;   // / seat / month
  pricePerSeatAnnual: number; // / seat / year
  aumFeeBps:        number;   // annual bps on AUM, billed monthly /12

  // Limits  (-1 = unlimited)
  maxSeats:   number;
  maxAumUsd:  number;
  trialDays:  number;

  // Feature flags
  features:   string[];    // bullet points shown on pricing page
  addOns:     string[];    // optional extras

  // Visibility & lifecycle
  publishedToWeb: boolean;   // shown on the public /pricing page
  status:         PlanStatus; // active | legacy (can still renew) | archived (hidden)

  // Versioning / audit
  version:    number;        // incremented on every save
  createdAt:  string;
  createdBy:  string;
  updatedAt:  string;
  updatedBy:  string;
  changeNote: string;        // optional human note on this version
}

export interface PlanVersion {
  id:         string;
  planCode:   string;
  version:    number;
  snapshot:   PlanDefinition;
  changedBy:  string;
  changedAt:  string;
  changeNote: string;
}

// ─── Default seed plans ────────────────────────────────────────────────────────
// Used to initialise Firestore on first run and as fallback while loading.

export const DEFAULT_PLANS: PlanDefinition[] = [
  {
    code: 'TRIAL', name: 'Trial', description: '14-day full-feature evaluation — no credit card required',
    icon: '🧪', color: '#f59e0b', sortOrder: 0,
    baseMonthly: 0, baseAnnual: 0, pricePerSeat: 0, pricePerSeatAnnual: 0, aumFeeBps: 0,
    maxSeats: 5, maxAumUsd: 50_000_000, trialDays: 14,
    features: ['All features included', 'Up to 5 users', 'Up to $50M AUM', 'Email support'],
    addOns: [],
    publishedToWeb: false, status: 'active',
    version: 1, createdAt: '', createdBy: 'system', updatedAt: '', updatedBy: 'system', changeNote: 'Initial seed',
  },
  {
    code: 'STARTER-2026', name: 'Starter', description: 'For boutique family offices under $100M AUM',
    icon: '🌱', color: '#22d3ee', sortOrder: 1,
    baseMonthly: 299, baseAnnual: 2_990, pricePerSeat: 49, pricePerSeatAnnual: 490, aumFeeBps: 2,
    maxSeats: 10, maxAumUsd: 100_000_000, trialDays: 14,
    features: [
      'Up to 10 licensed users', 'Up to $100M AUM', 'Family CRM & KYC pipeline',
      'Portfolio consolidation', 'Task & workflow management',
      'Document vault (10 GB)', 'Email support',
    ],
    addOns: ['API Access', 'Custom branding'],
    publishedToWeb: true, status: 'active',
    version: 1, createdAt: '', createdBy: 'system', updatedAt: '', updatedBy: 'system', changeNote: 'Initial seed',
  },
  {
    code: 'STANDARD-2026', name: 'Standard', description: 'For growing MFOs up to $500M AUM',
    icon: '⭐', color: '#818cf8', sortOrder: 2,
    baseMonthly: 799, baseAnnual: 7_990, pricePerSeat: 79, pricePerSeatAnnual: 790, aumFeeBps: 3,
    maxSeats: 25, maxAumUsd: 500_000_000, trialDays: 30,
    features: [
      'Up to 25 licensed users', 'Up to $500M AUM', 'Everything in Starter',
      'Private investments tracking', 'Suitability assessments',
      'Advanced reporting & dashboards', 'Calendar integrations',
      'Document vault (100 GB)', 'Priority email & chat support',
    ],
    addOns: ['API Access', 'Custom branding', 'Dedicated onboarding'],
    publishedToWeb: true, status: 'active',
    version: 1, createdAt: '', createdBy: 'system', updatedAt: '', updatedBy: 'system', changeNote: 'Initial seed',
  },
  {
    code: 'PROFESSIONAL-2026', name: 'Professional', description: 'For established MFOs up to $2B AUM',
    icon: '💎', color: '#a78bfa', sortOrder: 3,
    baseMonthly: 1_999, baseAnnual: 19_990, pricePerSeat: 99, pricePerSeatAnnual: 990, aumFeeBps: 2,
    maxSeats: 50, maxAumUsd: 2_000_000_000, trialDays: 30,
    features: [
      'Up to 50 licensed users', 'Up to $2B AUM', 'Everything in Standard',
      'Estate & succession planning', 'Governance & board workflows',
      'Concierge & lifestyle services', 'AI-powered task extraction',
      'White-label available', 'Document vault (1 TB)',
      'Dedicated success manager', 'SLA-backed support (4h response)',
    ],
    addOns: ['API Access', 'Custom branding', 'Data export', 'Custom integrations'],
    publishedToWeb: true, status: 'active',
    version: 1, createdAt: '', createdBy: 'system', updatedAt: '', updatedBy: 'system', changeNote: 'Initial seed',
  },
  {
    code: 'ENTERPRISE', name: 'Enterprise', description: 'Unlimited scale — custom pricing for large MFOs',
    icon: '🏛️', color: '#6366f1', sortOrder: 4,
    baseMonthly: 0, baseAnnual: 0, pricePerSeat: 0, pricePerSeatAnnual: 0, aumFeeBps: 1,
    maxSeats: -1, maxAumUsd: -1, trialDays: 30,
    features: [
      'Unlimited users', 'Unlimited AUM', 'Everything in Professional',
      'Multi-tenant management', 'Custom integrations & full API access',
      'On-premise or private cloud deploy', 'Custom data retention policies',
      'Dedicated infrastructure', 'White-glove onboarding', '24/7 dedicated support',
    ],
    addOns: [],
    publishedToWeb: true, status: 'active',
    version: 1, createdAt: '', createdBy: 'system', updatedAt: '', updatedBy: 'system', changeNote: 'Initial seed',
  },
];

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function getPlans(): Promise<PlanDefinition[]> {
  const snap = await getDocs(collection(db, 'subscription_plans'));
  const plans = snap.docs.map(d => d.data() as PlanDefinition);
  return plans.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getPlan(code: string): Promise<PlanDefinition | null> {
  const snap = await getDoc(doc(db, 'subscription_plans', code));
  return snap.exists() ? snap.data() as PlanDefinition : null;
}

export async function upsertPlan(
  plan: PlanDefinition,
  performer: { uid: string; name: string },
  changeNote = '',
): Promise<void> {
  const now     = new Date().toISOString();
  const current = await getPlan(plan.code);
  const nextVer = (current?.version ?? 0) + 1;

  const updated: PlanDefinition = {
    ...plan,
    version:    nextVer,
    updatedAt:  now,
    updatedBy:  performer.uid,
    changeNote,
    createdAt:  current?.createdAt ?? now,
    createdBy:  current?.createdBy ?? performer.uid,
  };

  // Write the updated plan
  await setDoc(doc(db, 'subscription_plans', plan.code), updated);

  // Snapshot this version immutably
  await addDoc(collection(db, 'subscription_plan_versions'), {
    planCode:   plan.code,
    version:    nextVer,
    snapshot:   updated,
    changedBy:  performer.uid,
    changedAt:  now,
    changeNote: changeNote || `Version ${nextVer}`,
  });
}

export async function archivePlan(
  code: string,
  performer: { uid: string; name: string },
): Promise<void> {
  const plan = await getPlan(code);
  if (!plan) throw new Error(`Plan ${code} not found`);
  await upsertPlan({ ...plan, status: 'archived', publishedToWeb: false }, performer, 'Archived');
}

export async function getPlanVersions(code: string): Promise<PlanVersion[]> {
  const snap = await getDocs(
    query(collection(db, 'subscription_plan_versions'), where('planCode', '==', code))
  );
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as PlanVersion))
    .sort((a, b) => b.version - a.version);
}

/** Seed default plans to Firestore if no plans exist yet. */
export async function seedDefaultPlansIfEmpty(performer: { uid: string; name: string }): Promise<boolean> {
  const snap = await getDocs(collection(db, 'subscription_plans'));
  if (!snap.empty) return false; // already seeded
  for (const plan of DEFAULT_PLANS) {
    await upsertPlan(plan, performer, 'Initial platform seed');
  }
  return true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatPrice(plan: PlanDefinition, cycle: 'monthly' | 'annual' = 'monthly'): string {
  if (plan.baseMonthly === 0 && plan.code !== 'TRIAL') return 'Custom';
  if (plan.code === 'TRIAL') return 'Free';
  const amount = cycle === 'monthly' ? plan.baseMonthly : Math.round(plan.baseAnnual / 12);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
}

export function annualSavingsPct(plan: PlanDefinition): number {
  if (!plan.baseMonthly || !plan.baseAnnual) return 0;
  const monthlyEquiv = plan.baseMonthly * 12;
  return Math.round((1 - plan.baseAnnual / monthlyEquiv) * 100);
}
