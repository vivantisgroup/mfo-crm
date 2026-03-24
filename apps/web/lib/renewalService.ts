/**
 * renewalService.ts
 *
 * Manages the subscription renewal lifecycle for MFO Nexus.
 *
 * Firestore schema:
 *   renewals/{id}       — renewal records linked to tenants
 *   opportunities/{id}  — CRM opportunity records linked to renewals
 *
 * A renewal is created ~90 days before a subscription's currentPeriodEnd.
 * When created, a matching "Opportunity" is also created so the sales team
 * can track and action the renewal through the CRM pipeline.
 */

import { firebaseApp } from '@mfo-crm/config';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';

const db = getFirestore(firebaseApp);

// ─── Types ────────────────────────────────────────────────────────────────────

export type RenewalStatus =
  | 'pending'   // Created, not yet contacted
  | 'sent'      // Renewal proposal sent to client
  | 'accepted'  // Client confirmed renewal
  | 'declined'  // Client declined (churn risk)
  | 'expired'   // Passed due date without resolution
  | 'completed'; // Processed — subscription renewed in system

export type RenewalRisk = 'low' | 'medium' | 'high';

export interface RenewalRecord {
  id:              string;
  tenantId:        string;
  tenantName:      string;
  planId:          string;
  planName:        string;
  billingCycle:    'monthly' | 'annual';
  // Dates
  periodEnd:       string;  // ISO — current subscription end date
  renewalDueDate:  string;  // ISO — when renewal action is needed (periodEnd - 30d)
  // Revenue
  currentMrr:      number;
  proposedMrr?:    number;  // if plan change is proposed
  // Status
  status:          RenewalStatus;
  risk:            RenewalRisk;
  riskReason?:     string;
  // CRM linkage
  opportunityId?:  string;
  assignedTo?:     string;  // user uid
  assignedName?:   string;
  // Notes
  notes?:          string;
  lastContactDate?: string;
  // Audit
  createdAt:       string;
  createdBy:       string;
  updatedAt?:      string;
  updatedBy?:      string;
}

export interface RenewalOpportunity {
  id?:          string;
  renewalId:    string;
  tenantId:     string;
  tenantName:   string;
  title:        string;           // e.g. "Annual Renewal — Apex Wealth Partners"
  stage:        OpportunityStage;
  value:        number;           // Expected ARR/MRR
  closeDate:    string;           // ISO — expected close = periodEnd
  assignedTo?:  string;
  assignedName?: string;
  notes?:       string;
  createdAt:    string;
  createdBy:    string;
  updatedAt?:   string;
}

export type OpportunityStage =
  | 'Qualification'
  | 'Proposal Sent'
  | 'Negotiation'
  | 'Closed Won'
  | 'Closed Lost';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

function isoFromDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function daysBetween(a: string, b: string = new Date().toISOString()): number {
  return Math.ceil((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

export function inferRisk(renewal: Omit<RenewalRecord, 'id' | 'risk'>): RenewalRisk {
  const daysLeft = daysBetween(renewal.periodEnd);
  if (renewal.status === 'declined') return 'high';
  if (daysLeft < 14) return 'high';
  if (daysLeft < 30) return 'medium';
  return 'low';
}

export function renewalDaysLeft(renewal: RenewalRecord): number {
  return Math.max(0, daysBetween(renewal.periodEnd));
}

export function formatRenewalDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createRenewal(
  data: Omit<RenewalRecord, 'id' | 'createdAt' | 'risk'>,
  performer: { uid: string; name: string },
): Promise<RenewalRecord> {
  const now = new Date().toISOString();
  const risk = inferRisk(data);

  const payload: Omit<RenewalRecord, 'id'> = stripUndefined({
    ...data,
    risk,
    status: data.status ?? 'pending',
    createdAt: now,
    createdBy: performer.uid,
  }) as Omit<RenewalRecord, 'id'>;

  const ref = await addDoc(collection(db, 'renewals'), payload);
  const renewal: RenewalRecord = { ...payload, id: ref.id };

  // Auto-create a linked Opportunity in the CRM pipeline
  const opp: Omit<RenewalOpportunity, 'id'> = {
    renewalId:   renewal.id,
    tenantId:    renewal.tenantId,
    tenantName:  renewal.tenantName,
    title:       `${renewal.billingCycle === 'annual' ? 'Annual' : 'Monthly'} Renewal — ${renewal.tenantName}`,
    stage:       'Qualification',
    value:       renewal.billingCycle === 'annual' ? renewal.currentMrr * 12 : renewal.currentMrr,
    closeDate:   renewal.periodEnd,
    assignedTo:  renewal.assignedTo,
    assignedName: renewal.assignedName,
    notes:       `Auto-created from renewal record. Subscription ends ${formatRenewalDate(renewal.periodEnd)}.`,
    createdAt:   now,
    createdBy:   performer.uid,
  };

  const oppRef = await addDoc(collection(db, 'opportunities'), stripUndefined(opp));

  // Link opportunity back to renewal
  await updateDoc(doc(db, 'renewals', renewal.id), { opportunityId: oppRef.id });
  renewal.opportunityId = oppRef.id;

  return renewal;
}

export async function getRenewal(id: string): Promise<RenewalRecord | null> {
  const snap = await getDoc(doc(db, 'renewals', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } as RenewalRecord : null;
}

export async function listRenewals(filters?: {
  status?: RenewalStatus;
  tenantId?: string;
}): Promise<RenewalRecord[]> {
  let q = query(collection(db, 'renewals'), orderBy('periodEnd', 'asc'));

  if (filters?.status) {
    q = query(collection(db, 'renewals'), where('status', '==', filters.status), orderBy('periodEnd', 'asc'));
  }
  if (filters?.tenantId) {
    q = query(collection(db, 'renewals'), where('tenantId', '==', filters.tenantId), orderBy('periodEnd', 'asc'));
  }

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as RenewalRecord));
}

export async function getRenewalsDueSoon(daysAhead: number = 30): Promise<RenewalRecord[]> {
  const all = await listRenewals();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);
  return all.filter(r => {
    if (['completed', 'declined', 'expired'].includes(r.status)) return false;
    return new Date(r.periodEnd) <= cutoff;
  });
}

export async function updateRenewalStatus(
  id: string,
  status: RenewalStatus,
  performer: { uid: string; name: string },
  notes?: string,
): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(doc(db, 'renewals', id), stripUndefined({
    status,
    notes,
    lastContactDate: ['sent', 'accepted', 'declined'].includes(status) ? now : undefined,
    updatedAt: now,
    updatedBy: performer.uid,
  }));

  // Mirror status to linked Opportunity stage
  const renewal = await getRenewal(id);
  if (renewal?.opportunityId) {
    const stage: OpportunityStage =
      status === 'sent'      ? 'Proposal Sent'  :
      status === 'accepted'  ? 'Closed Won'     :
      status === 'declined'  ? 'Closed Lost'    :
      status === 'completed' ? 'Closed Won'     :
                               'Qualification';
    await updateDoc(doc(db, 'opportunities', renewal.opportunityId), {
      stage, updatedAt: now,
    });
  }
}

export async function updateRenewalAssignment(
  id: string,
  assignedTo: string,
  assignedName: string,
  performer: { uid: string; name: string },
): Promise<void> {
  await updateDoc(doc(db, 'renewals', id), {
    assignedTo, assignedName,
    updatedAt: new Date().toISOString(),
    updatedBy: performer.uid,
  });
}

export async function linkOpportunity(
  renewalId: string,
  opportunityId: string,
): Promise<void> {
  await updateDoc(doc(db, 'renewals', renewalId), { opportunityId });
}

export async function deleteRenewal(id: string): Promise<void> {
  // Soft-delete: mark as expired
  await updateDoc(doc(db, 'renewals', id), {
    status:    'expired',
    updatedAt: new Date().toISOString(),
  });
}

// ─── Opportunity reads ────────────────────────────────────────────────────────

export async function listOpportunities(): Promise<RenewalOpportunity[]> {
  const snap = await getDocs(collection(db, 'opportunities'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as RenewalOpportunity));
}

export async function updateOpportunityStage(
  id: string,
  stage: OpportunityStage,
): Promise<void> {
  await updateDoc(doc(db, 'opportunities', id), {
    stage, updatedAt: new Date().toISOString(),
  });
}

// ─── Mock data generator (for demo mode) ─────────────────────────────────────

export function getMockRenewals(): RenewalRecord[] {
  const now = new Date();
  const future = (days: number) => {
    const d = new Date(now); d.setDate(d.getDate() + days); return d.toISOString();
  };
  return [
    {
      id: 'ren-001', tenantId: 't-001', tenantName: 'Vivants Multi-Family Office',
      planId: 'enterprise', planName: 'Enterprise', billingCycle: 'annual',
      periodEnd: future(8), renewalDueDate: future(-22),
      currentMrr: 3490, status: 'sent', risk: 'high',
      riskReason: 'Due in 8 days — awaiting client confirmation',
      opportunityId: 'opp-001', assignedTo: 'uid-1', assignedName: 'Marcelo García',
      createdAt: future(-82), createdBy: 'system',
    },
    {
      id: 'ren-002', tenantId: 't-004', tenantName: 'Legacy Trust Group',
      planId: 'enterprise', planName: 'Enterprise', billingCycle: 'annual',
      periodEnd: future(21), renewalDueDate: future(-9),
      currentMrr: 3490, status: 'pending', risk: 'medium',
      opportunityId: 'opp-002', assignedTo: 'uid-2', assignedName: 'Ana Rodrigues',
      createdAt: future(-70), createdBy: 'system',
    },
    {
      id: 'ren-003', tenantId: 't-002', tenantName: 'Apex Wealth Partners',
      planId: 'growth', planName: 'Growth', billingCycle: 'annual',
      periodEnd: future(45), renewalDueDate: future(15),
      currentMrr: 1290, proposedMrr: 1999, status: 'pending', risk: 'low',
      riskReason: 'Upsell opportunity — client requesting Professional features',
      opportunityId: 'opp-003', assignedTo: 'uid-1', assignedName: 'Marcelo García',
      createdAt: future(-45), createdBy: 'system',
    },
    {
      id: 'ren-004', tenantId: 't-003', tenantName: 'Summit Capital',
      planId: 'growth', planName: 'Growth', billingCycle: 'annual',
      periodEnd: future(60), renewalDueDate: future(30),
      currentMrr: 1290, status: 'pending', risk: 'low',
      opportunityId: 'opp-004',
      createdAt: future(-30), createdBy: 'system',
    },
    {
      id: 'ren-005', tenantId: 't-006', tenantName: 'Meridian Wealth',
      planId: 'growth', planName: 'Growth', billingCycle: 'annual',
      periodEnd: future(75), renewalDueDate: future(45),
      currentMrr: 1290, status: 'pending', risk: 'low',
      opportunityId: 'opp-005',
      createdAt: future(-15), createdBy: 'system',
    },
    {
      id: 'ren-006', tenantId: 't-007', tenantName: 'Pacific Family Office',
      planId: 'starter', planName: 'Starter', billingCycle: 'monthly',
      periodEnd: future(-5), renewalDueDate: future(-35),
      currentMrr: 490, status: 'declined', risk: 'high',
      riskReason: 'Client cited pricing concerns — escalate to leadership',
      opportunityId: 'opp-006', assignedTo: 'uid-2', assignedName: 'Ana Rodrigues',
      createdAt: future(-90), createdBy: 'system',
    },
  ];
}
