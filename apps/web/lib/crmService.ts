/**
 * crmService.ts
 *
 * Platform Sales CRM — Organizations and Contacts.
 * Purpose: associates Platform customers (Orgs + Contacts) with tenants/subscriptions.
 *
 * Firestore:
 *   platform_orgs/{orgId}               — customer organizations
 *   platform_contacts/{contactId}       — contacts within an org
 *
 * An Org can have many Contacts and many Tenants (subscriptions).
 * A Tenant references one Org and one Contact.
 */

import { firebaseApp } from '@mfo-crm/config';
import {
  getFirestore,
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy,
} from 'firebase/firestore';

const db = getFirestore(firebaseApp);

// ─── Types ────────────────────────────────────────────────────────────────────

export type DealStage = 'lead' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
export type OrgSize   = 'boutique' | 'small' | 'mid' | 'large' | 'enterprise';

export interface PlatformOrg {
  id:           string;
  name:         string;          // e.g. "Andrade Family Office"
  website?:     string;
  country:      string;
  size:         OrgSize;
  estAumUsd:    number;          // estimated AUM
  stage:        DealStage;
  assignedTo:   string;          // sales rep name/id
  tags:         string[];
  notes:        string;
  // CRM linking
  tenantIds:    string[];        // subscription tenantIds linked to this org
  // Audit
  createdAt:    string;
  createdBy:    string;
  updatedAt:    string;
}

export interface PlatformContact {
  id:           string;
  orgId:        string;          // parent org
  name:         string;
  email:        string;
  phone?:       string;
  role:         string;          // e.g. "CIO", "CEO", "Founding Partner"
  isPrimary:    boolean;         // primary billing/admin contact
  notes:        string;
  // Audit
  createdAt:    string;
  createdBy:    string;
  updatedAt:    string;
}

// ─── Organization CRUD ────────────────────────────────────────────────────────

export async function getOrg(id: string): Promise<PlatformOrg | null> {
  const snap = await getDoc(doc(db, 'platform_orgs', id));
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as PlatformOrg) : null;
}

export async function getAllOrgs(): Promise<PlatformOrg[]> {
  const snap = await getDocs(query(collection(db, 'platform_orgs')));
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as PlatformOrg))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createOrg(
  data: Omit<PlatformOrg, 'id' | 'createdAt' | 'updatedAt'>,
  performer: { uid: string },
): Promise<PlatformOrg> {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, 'platform_orgs'), {
    ...data, tenantIds: data.tenantIds ?? [],
    createdAt: now, createdBy: performer.uid, updatedAt: now,
  });
  // Write id into the document so subsequent reads always carry it
  await updateDoc(ref, { id: ref.id });
  return { ...data, id: ref.id, tenantIds: data.tenantIds ?? [], createdAt: now, updatedAt: now } as PlatformOrg;
}

export async function updateOrg(
  id: string,
  patch: Partial<PlatformOrg>,
): Promise<void> {
  await updateDoc(doc(db, 'platform_orgs', id), { ...patch, updatedAt: new Date().toISOString() });
}

/** Link a tenantId to this org (idempotent). */
export async function linkTenantToOrg(orgId: string, tenantId: string): Promise<void> {
  const org = await getOrg(orgId);
  if (!org) throw new Error(`Org ${orgId} not found`);
  if (org.tenantIds.includes(tenantId)) return; // already linked
  await updateDoc(doc(db, 'platform_orgs', orgId), {
    tenantIds: [...org.tenantIds, tenantId],
    updatedAt: new Date().toISOString(),
  });
}

/** Unlink a tenantId from this org. */
export async function unlinkTenantFromOrg(orgId: string, tenantId: string): Promise<void> {
  const org = await getOrg(orgId);
  if (!org) return;
  await updateDoc(doc(db, 'platform_orgs', orgId), {
    tenantIds: org.tenantIds.filter(t => t !== tenantId),
    updatedAt: new Date().toISOString(),
  });
}

// ─── Contact CRUD ─────────────────────────────────────────────────────────────

export async function getContactsForOrg(orgId: string): Promise<PlatformContact[]> {
  const snap = await getDocs(
    query(collection(db, 'platform_contacts'), where('orgId', '==', orgId))
  );
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as PlatformContact))
    .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0) || a.name.localeCompare(b.name));
}

export async function createContact(
  data: Omit<PlatformContact, 'id' | 'createdAt' | 'updatedAt'>,
  performer: { uid: string },
): Promise<PlatformContact> {
  const now = new Date().toISOString();
  // Strip undefined optional fields so Firestore doesn't reject them
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) payload[k] = v;
  }
  const ref = await addDoc(collection(db, 'platform_contacts'), {
    ...payload, createdAt: now, createdBy: performer.uid, updatedAt: now,
  });
  // Store id in the document for consistent reads
  await updateDoc(ref, { id: ref.id });
  return { ...data, id: ref.id, createdAt: now, updatedAt: now } as PlatformContact;
}

export async function updateContact(id: string, patch: Partial<PlatformContact>): Promise<void> {
  // id arg was missing from the doc() call — fixed
  await updateDoc(doc(db, 'platform_contacts', id), {
    ...patch, updatedAt: new Date().toISOString(),
  });
}

// ─── Seed sample orgs/contacts if Firestore is empty ─────────────────────────

const SAMPLE_ORGS: Omit<PlatformOrg, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Andrade Family Office', country: 'Brazil', size: 'mid', estAumUsd: 280_000_000, stage: 'proposal', assignedTo: 'Alexandra Torres', tags: ['enterprise', 'brazil', 'hot'], notes: 'Very interested in Enterprise.', tenantIds: [], createdBy: 'system' },
  { name: 'PL Wealth Solutions', country: 'Singapore', size: 'small', estAumUsd: 95_000_000, stage: 'qualification', assignedTo: 'Carlos Mendes', tags: ['growth', 'asia', 'warm'], notes: 'Evaluating 3 platforms.', tenantIds: [], createdBy: 'system' },
  { name: 'Dupont Patrimoine', country: 'France', size: 'large', estAumUsd: 420_000_000, stage: 'closed_won', assignedTo: 'Carlos Mendes', tags: ['enterprise', 'europe', 'referral'], notes: 'Closed! Enterprise annual.', tenantIds: [], createdBy: 'system' },
  { name: 'GL Investimentos', country: 'Brazil', size: 'mid', estAumUsd: 110_000_000, stage: 'negotiation', assignedTo: 'Alexandra Torres', tags: ['growth', 'brazil', 'hot'], notes: 'Negotiating on seat count.', tenantIds: [], createdBy: 'system' },
  { name: 'Whitmore Wealthcare', country: 'UK', size: 'mid', estAumUsd: 175_000_000, stage: 'proposal', assignedTo: 'Carlos Mendes', tags: ['growth', 'europe', 'warm'], notes: 'Asked about GDPR & OneDrive.', tenantIds: [], createdBy: 'system' },
  { name: 'Lagos Capital Group', country: 'Nigeria', size: 'boutique', estAumUsd: 22_000_000, stage: 'lead', assignedTo: 'Alexandra Torres', tags: ['starter', 'africa'], notes: 'Inbound lead.', tenantIds: [], createdBy: 'system' },
  { name: 'Costa Gestão Patrimonial', country: 'Brazil', size: 'boutique', estAumUsd: 18_000_000, stage: 'qualification', assignedTo: 'Alexandra Torres', tags: ['starter', 'brazil'], notes: 'Small boutique, 2 advisors.', tenantIds: [], createdBy: 'system' },
];

const SAMPLE_CONTACTS: Omit<PlatformContact, 'id' | 'createdAt' | 'updatedAt' | 'orgId'>[] = [
  { name: 'Felipe Andrade', email: 'f.andrade@af.com.br', phone: '+55 11 99988-7766', role: 'Founding Partner', isPrimary: true, notes: 'Key decision maker.', createdBy: 'system' },
  { name: 'Patricia Lim', email: 'p.lim@plwealth.sg', role: 'CIO', isPrimary: true, notes: '', createdBy: 'system' },
  { name: 'Marie-Claire Dupont', email: 'mcdupont@dupont.fr', role: 'CEO', isPrimary: true, notes: '', createdBy: 'system' },
  { name: 'Gustavo Leite', email: 'g.leite@glinvest.com.br', role: 'Managing Partner', isPrimary: true, notes: '', createdBy: 'system' },
  { name: 'James Whitmore', email: 'j.whitmore@whitmorewc.com', role: 'CEO', isPrimary: true, notes: '', createdBy: 'system' },
  { name: 'Robert Okafor', email: 'r.okafor@lagoscap.com', role: 'Founding Partner', isPrimary: true, notes: '', createdBy: 'system' },
  { name: 'Ana Costa', email: 'a.costa@costgp.com.br', role: 'Director', isPrimary: true, notes: '', createdBy: 'system' },
];

export async function seedCrmIfEmpty(performer: { uid: string }): Promise<boolean> {
  const snap = await getDocs(collection(db, 'platform_orgs'));
  if (!snap.empty) return false;
  const now  = new Date().toISOString();
  for (let i = 0; i < SAMPLE_ORGS.length; i++) {
    const ref = await addDoc(collection(db, 'platform_orgs'), { ...SAMPLE_ORGS[i], createdAt: now, updatedAt: now });
    const contact = { ...SAMPLE_CONTACTS[i], orgId: ref.id };
    await addDoc(collection(db, 'platform_contacts'), { ...contact, createdAt: now, updatedAt: now });
  }
  return true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const ORG_SIZE_LABELS: Record<OrgSize, string> = {
  boutique: 'Boutique (<$50M)', small: 'Small ($50–$200M)',
  mid: 'Mid ($200M–$1B)', large: 'Large ($1–$5B)', enterprise: 'Enterprise (>$5B)',
};

export const STAGE_COLORS: Record<DealStage, string> = {
  lead: '#64748b', qualification: '#6366f1', proposal: '#f59e0b',
  negotiation: '#22d3ee', closed_won: '#22c55e', closed_lost: '#ef4444',
};
export const STAGE_LABELS: Record<DealStage, string> = {
  lead: '🔵 Lead', qualification: '💜 Qualifying', proposal: '🟡 Proposal',
  negotiation: '🔵 Negotiation', closed_won: '✅ Closed Won', closed_lost: '❌ Closed Lost',
};
export const STAGES: DealStage[] = ['lead', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
