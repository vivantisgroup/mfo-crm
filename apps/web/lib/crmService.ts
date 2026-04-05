/**
 * crmService.ts
 *
 * Platform Sales CRM — Organizations, Contacts, Opportunities, Activities, Sales Teams.
 * Purpose: manages the SaaS business's own sales & customer success processes.
 *
 * Firestore:
 *   platform_orgs/{orgId}               — customer organizations
 *   platform_contacts/{contactId}       — contacts within an org
 *   platform_opportunities/{id}         — deal records (linked to org)
 *   platform_crm_activities/{id}        — activity/communication log
 *   platform_sales_teams/{id}           — sales team org chart
 */

import { firebaseApp } from '@mfo-crm/config';
import {
  getFirestore,
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy,
} from 'firebase/firestore';

const db = getFirestore(firebaseApp);

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrgType = 'client' | 'prospect' | 'supplier' | 'partner';
// Note: DealStage is kept as general string to support dynamic stages, with specific values used historically as fallbacks.
export type DealStage   = string | 'lead' | 'qualification' | 'demo' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
export type OrgSize     = 'boutique' | 'small' | 'mid' | 'large' | 'enterprise';
export type SalesRegion = 'latam' | 'emea' | 'apac' | 'north_america' | 'global';
export type ActivityType      = 'call' | 'email' | 'meeting' | 'demo' | 'note' | 'linkedin' | 'other';
export type ActivityDirection = 'inbound' | 'outbound' | 'internal';

export interface OrgAddress {
  street: string;
  number: string;
  complement?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface ContactAddress {
  id: string;
  street: string;
  number: string;
  complement?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  isPrimary: boolean;
}

export interface ContactPhone {
  id: string;
  type: 'Tel' | 'Cel' | 'WhatsApp';
  value: string;
  isPrimary: boolean;
}

export interface ContactEmail {
  id: string;
  value: string;
  isPrimary: boolean;
}

export interface ContactRelationship {
  id: string;
  name: string;
  type: string;
  crmContactId?: string;
  isNoCrm: boolean;
}

export interface ContactIdentification {
  id: string;
  idType: string;
  value: string;
  issueDate?: string;
  expirationDate?: string;
  country?: string;
}

export interface PlatformOrg {
  id:           string;
  name:         string;
  orgType?:     OrgType;
  website?:     string;
  country:      string;
  region:       SalesRegion;
  size:         OrgSize;
  estAumUsd:    number;
  stage:        DealStage;
  assignedTo:   string;
  assignedToUid?:string;
  tags:         string[];
  notes:        string;
  logoUrl?:     string;
  tenantIds:    string[];
  phone?:       string;
  whatsapp?:    string;
  invoiceAddress?: string;
  shippingAddress?: string;
  primaryAddress?: OrgAddress;
  industry?:    string;
  createdAt:    string;
  createdBy:    string;
  updatedAt:    string;
}

export interface PlatformContact {
  id:           string;
  orgId:        string;
  name:         string;
  email:        string;
  phone?:       string;
  role:         string;
  isPrimary:    boolean;
  notes:        string;
  tags?:        string[];
  whatsapp?:    string;
  birthday?:    string;
  preferredName?: string;
  preferredContactMethod?: 'email' | 'phone' | 'whatsapp';
  primaryTag?:  string;
  linkedInUrl?: string;
  logoUrl?:     string;
  createdAt:    string;
  createdBy:    string;
  updatedAt:    string;
  // Complex Objects
  addresses?:        ContactAddress[];
  phones?:           ContactPhone[];
  emails?:           ContactEmail[];
  relationships?:    ContactRelationship[];
  identifications?:  ContactIdentification[];
  linkedUserUid?:    string;
}

export interface Opportunity {
  id:               string;
  orgId:            string;
  orgName:          string;
  title:            string;
  stage:            DealStage;
  valueUsd:         number;          // ARR or contract value
  probability:      number;          // 0–100
  closeDate:        string;          // ISO date string
  /** uid of the assigned platform user (sales rep / AE / etc.) */
  assignedToUid?:   string;
  /** Display name of the assigned user */
  assignedToName?:  string;
  /** Department of the assignee at assignment time (for reporting) */
  assignedToDept?:  string;
  /** Legacy plain-text owner — kept for backward compat */
  ownerId?:         string;
  ownerName?:       string;
  region:           SalesRegion;
  products:         string[];        // e.g. ['Enterprise Plan', 'AddOn: Data Export']
  notes:            string;
  lostReason?:      string;
  contactId?:       string;
  contactName?:     string;
  createdAt:        string;
  createdBy:        string;
  updatedAt:        string;
}


export interface CrmActivity {
  id:            string;
  orgId:         string;
  orgName:       string;
  opportunityId?: string;
  type:          ActivityType;
  direction:     ActivityDirection;
  subject:       string;
  body:          string;
  contactId?:    string;
  contactName?:  string;
  performedByUid:   string;
  performedByName:  string;
  scheduledAt:   string;       // ISO datetime
  completedAt?:  string;
  outcome?:      string;       // e.g. "Positive", "Follow-up scheduled", "No answer"
  createdAt:     string;
  updatedAt:     string;
}

export interface SalesTeam {
  id:           string;
  name:         string;
  orgType?:     OrgType;
  region:      SalesRegion;
  managerId:   string;
  managerName: string;
  memberIds:   string[];
  memberNames: string[];
  description: string;
  quota:       number;          // ARR quota in USD
  createdAt:   string;
  updatedAt:   string;
  commissionPlanText?: string;
}

export type AccountPlanPeriod = 'quarterly' | 'monthly' | 'semi_annual' | 'annual';

export interface AccountPlanRevision {
  timestamp: string;
  field: string;
  oldVal: any;
  newVal: any;
  userUid: string;
  userName: string;
}

export interface AccountPlan {
  id: string;
  orgId: string;
  version: number;
  isCurrent: boolean;
  period: AccountPlanPeriod;
  title?: string;
  executiveSummary: string;
  goals: string;
  reviewerUid?: string;
  reviewerName?: string;
  reviewDate?: string;
  revisions?: AccountPlanRevision[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

// ─── Platform Users (for assignee dropdowns) ─────────────────────────────────

/** Sales-related roles that can be assigned to opportunities */
export const SALES_ROLES = [
  'sales_manager', 'revenue_manager', 'account_executive', 'sdr',
  'customer_success_manager', 'business_manager', 'sales_operations',
  'saas_master_admin',
] as const;

export interface SalesUser {
  uid:         string;
  displayName: string;
  email:       string;
  role:        string;
  department?: string;
  jobTitle?:   string;
}

/** Fetch all active platform users who are in sales-adjacent roles */
export async function getPlatformSalesUsers(): Promise<SalesUser[]> {
  const { getFirestore, collection, getDocs } = await import('firebase/firestore');
  const { firebaseApp } = await import('@mfo-crm/config');
  const _db = getFirestore(firebaseApp);
  const snap = await getDocs(collection(_db, 'users'));
  return snap.docs
    .map(d => d.data() as any)
    .filter(u => u.status !== 'suspended' && (SALES_ROLES as readonly string[]).includes(u.role))
    .map(u => ({
      uid:         u.uid,
      displayName: u.displayName ?? u.email,
      email:       u.email,
      role:        u.role,
      department:  u.department,
      jobTitle:    u.jobTitle,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
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
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) payload[k] = v;
  }
  const ref = await addDoc(collection(db, 'platform_orgs'), {
    ...payload, orgType: data.orgType ?? 'client', region: data.region ?? 'global', tenantIds: data.tenantIds ?? [],
    createdAt: now, createdBy: performer.uid, updatedAt: now,
  });
  await updateDoc(ref, { id: ref.id });
  return { ...data, id: ref.id, tenantIds: data.tenantIds ?? [], region: data.region ?? 'global', createdAt: now, updatedAt: now } as PlatformOrg;
}

export async function updateOrg(id: string, patch: Partial<PlatformOrg>): Promise<void> {
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) payload[k] = v;
  }
  await updateDoc(doc(db, 'platform_orgs', id), { ...payload, updatedAt: new Date().toISOString() });
}

export async function linkTenantToOrg(orgId: string, tenantId: string): Promise<void> {
  const org = await getOrg(orgId);
  if (!org) throw new Error(`Org ${orgId} not found`);
  if (org.tenantIds.includes(tenantId)) return;
  await updateDoc(doc(db, 'platform_orgs', orgId), {
    tenantIds: [...org.tenantIds, tenantId],
    updatedAt: new Date().toISOString(),
  });
}

export async function unlinkTenantFromOrg(orgId: string, tenantId: string): Promise<void> {
  const org = await getOrg(orgId);
  if (!org) return;
  await updateDoc(doc(db, 'platform_orgs', orgId), {
    tenantIds: org.tenantIds.filter(t => t !== tenantId),
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteOrg(id: string): Promise<void> {
  await deleteDoc(doc(db, 'platform_orgs', id));
}

// ─── Account Plans CRUD ───────────────────────────────────────────────────────

export async function getAccountPlansForOrg(orgId: string): Promise<AccountPlan[]> {
  const snap = await getDocs(query(collection(db, 'platform_org_account_plans'), where('orgId', '==', orgId)));
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as AccountPlan))
    .sort((a, b) => b.version - a.version);
}

export async function createAccountPlan(
  orgId: string,
  payload: Pick<AccountPlan, 'period' | 'executiveSummary' | 'goals'> & { title?: string },
  performer: { uid: string }
): Promise<AccountPlan> {
  const plans = await getAccountPlansForOrg(orgId);
  const now = new Date().toISOString();
  
  // Archive active plans
  const activePlans = plans.filter(p => p.isCurrent);
  for (const p of activePlans) {
    await updateDoc(doc(db, 'platform_org_account_plans', p.id), { isCurrent: false, updatedAt: now });
  }

  const nextVersion = plans.length > 0 ? Math.max(...plans.map(p => p.version)) + 1 : 1;
  const newPlanData = {
    ...payload,
    orgId,
    version: nextVersion,
    isCurrent: true,
    revisions: [],
    createdAt: now,
    createdBy: performer.uid,
    updatedAt: now,
  };
  const ref = await addDoc(collection(db, 'platform_org_account_plans'), newPlanData);
  await updateDoc(ref, { id: ref.id });
  return { ...newPlanData, id: ref.id } as AccountPlan;
}

export async function updateAccountPlan(id: string, patch: Partial<AccountPlan>, performer?: { uid: string; displayName?: string; email?: string }): Promise<void> {
  const ref = doc(db, 'platform_org_account_plans', id);
  if (!performer) {
    // Basic patch without tracking
    await updateDoc(ref, { ...patch, updatedAt: new Date().toISOString() });
    return;
  }

  // Need to track delta
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const current = snap.data() as AccountPlan;
  const revisions = current.revisions || [];
  
  const skipFields = ['updatedAt', 'reviewerUid', 'reviewerName', 'reviewDate'];
  for (const [key, newVal] of Object.entries(patch)) {
    if (skipFields.includes(key)) continue;
    const oldVal = (current as any)[key];
    if (oldVal !== newVal) {
       revisions.push({
         timestamp: new Date().toISOString(),
         field: key,
         oldVal: oldVal ?? null,
         newVal: newVal ?? null,
         userUid: performer.uid,
         userName: performer.displayName || performer.email || 'User',
       });
    }
  }

  await updateDoc(ref, { 
    ...patch, 
    revisions,
    updatedAt: new Date().toISOString() 
  });
}

// ─── Contact CRUD ─────────────────────────────────────────────────────────────

export async function getAllContacts(): Promise<PlatformContact[]> {
  const snap = await getDocs(collection(db, 'platform_contacts'));
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as PlatformContact))
    .sort((a, b) => a.name.localeCompare(b.name));
}

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
  const payload: Record<string, unknown> = {};
  
  if (data.email) {
    const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', data.email.toLowerCase())));
    if (!userSnap.empty) {
       data.linkedUserUid = userSnap.docs[0].data().uid;
    }
  }

  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) payload[k] = v;
  }
  const ref = await addDoc(collection(db, 'platform_contacts'), {
    ...payload, createdAt: now, createdBy: performer.uid, updatedAt: now,
  });
  await updateDoc(ref, { id: ref.id });
  return { ...data, id: ref.id, createdAt: now, updatedAt: now } as PlatformContact;
}

export async function updateContact(id: string, patch: Partial<PlatformContact>): Promise<void> {
  const payload: Record<string, unknown> = {};
  
  if (patch.email) {
    const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', patch.email.toLowerCase())));
    if (!userSnap.empty) {
       payload.linkedUserUid = userSnap.docs[0].data().uid;
    }
  }

  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) payload[k] = v;
  }
  await updateDoc(doc(db, 'platform_contacts', id), {
    ...payload, updatedAt: new Date().toISOString(),
  });
}

export async function deleteContact(id: string): Promise<void> {
  await deleteDoc(doc(db, 'platform_contacts', id));
}

// ─── Opportunity CRUD ─────────────────────────────────────────────────────────

export async function getAllOpportunities(): Promise<Opportunity[]> {
  const snap = await getDocs(collection(db, 'platform_opportunities'));
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as Opportunity))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getOpportunitiesForOrg(orgId: string): Promise<Opportunity[]> {
  const snap = await getDocs(
    query(collection(db, 'platform_opportunities'), where('orgId', '==', orgId))
  );
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as Opportunity))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createOpportunity(
  data: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>,
  performer: { uid: string },
): Promise<Opportunity> {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, 'platform_opportunities'), {
    ...data, createdAt: now, createdBy: performer.uid, updatedAt: now,
  });
  await updateDoc(ref, { id: ref.id });
  return { ...data, id: ref.id, createdAt: now, updatedAt: now } as Opportunity;
}

export async function updateOpportunity(id: string, patch: Partial<Opportunity>): Promise<void> {
  await updateDoc(doc(db, 'platform_opportunities', id), { ...patch, updatedAt: new Date().toISOString() });
}

export async function deleteOpportunity(id: string): Promise<void> {
  await deleteDoc(doc(db, 'platform_opportunities', id));
}

// ─── Activity CRUD ────────────────────────────────────────────────────────────

export async function getAllActivities(): Promise<CrmActivity[]> {
  const snap = await getDocs(collection(db, 'platform_crm_activities'));
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as CrmActivity))
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
}

export async function getActivitiesForOrg(orgId: string): Promise<CrmActivity[]> {
  const snap = await getDocs(
    query(collection(db, 'platform_crm_activities'), where('orgId', '==', orgId))
  );
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as CrmActivity))
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
}

export async function createActivity(
  data: Omit<CrmActivity, 'id' | 'createdAt' | 'updatedAt'>,
  performer: { uid: string },
): Promise<CrmActivity> {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, 'platform_crm_activities'), {
    ...data, createdAt: now, updatedAt: now,
  });
  await updateDoc(ref, { id: ref.id });
  return { ...data, id: ref.id, createdAt: now, updatedAt: now } as CrmActivity;
}

export async function updateActivity(id: string, patch: Partial<CrmActivity>): Promise<void> {
  await updateDoc(doc(db, 'platform_crm_activities', id), { ...patch, updatedAt: new Date().toISOString() });
}

// ─── Sales Team CRUD ──────────────────────────────────────────────────────────

export async function getSalesTeams(): Promise<SalesTeam[]> {
  const snap = await getDocs(collection(db, 'platform_sales_teams'));
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as SalesTeam))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createSalesTeam(
  data: Omit<SalesTeam, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<SalesTeam> {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, 'platform_sales_teams'), { ...data, createdAt: now, updatedAt: now });
  await updateDoc(ref, { id: ref.id });
  return { ...data, id: ref.id, createdAt: now, updatedAt: now } as SalesTeam;
}

export async function updateSalesTeam(id: string, patch: Partial<SalesTeam>): Promise<void> {
  await updateDoc(doc(db, 'platform_sales_teams', id), { ...patch, updatedAt: new Date().toISOString() });
}

export async function deleteSalesTeam(id: string): Promise<void> {
  await deleteDoc(doc(db, 'platform_sales_teams', id));
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

const now = () => new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const daysAhead = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const SAMPLE_ORGS: Omit<PlatformOrg, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Andrade Family Office',     country: 'Brazil',    region: 'latam',         size: 'mid',        estAumUsd: 280_000_000, stage: 'proposal',      assignedTo: 'Alexandra Torres', tags: ['enterprise','brazil','hot'],     notes: 'Very interested in Enterprise.',    tenantIds: [], createdBy: 'system', orgType: 'client' },
  { name: 'PL Wealth Solutions',       country: 'Singapore', region: 'apac',          size: 'small',      estAumUsd:  95_000_000, stage: 'qualification', assignedTo: 'Carlos Mendes',    tags: ['growth','asia','warm'],          notes: 'Evaluating 3 platforms.',           tenantIds: [], createdBy: 'system', orgType: 'client' },
  { name: 'Dupont Patrimoine',         country: 'France',    region: 'emea',          size: 'large',      estAumUsd: 420_000_000, stage: 'closed_won',   assignedTo: 'Carlos Mendes',    tags: ['enterprise','europe','referral'],notes: 'Closed! Enterprise annual.',        tenantIds: [], createdBy: 'system', orgType: 'client' },
  { name: 'GL Investimentos',          country: 'Brazil',    region: 'latam',         size: 'mid',        estAumUsd: 110_000_000, stage: 'negotiation',   assignedTo: 'Alexandra Torres', tags: ['growth','brazil','hot'],         notes: 'Negotiating on seat count.',        tenantIds: [], createdBy: 'system', orgType: 'client' },
  { name: 'Whitmore Wealthcare',       country: 'UK',        region: 'emea',          size: 'mid',        estAumUsd: 175_000_000, stage: 'demo',          assignedTo: 'Carlos Mendes',    tags: ['growth','europe','warm'],        notes: 'Asked about GDPR & OneDrive.',      tenantIds: [], createdBy: 'system', orgType: 'client' },
  { name: 'Lagos Capital Group',       country: 'Nigeria',   region: 'emea',          size: 'boutique',   estAumUsd:  22_000_000, stage: 'lead',          assignedTo: 'Alexandra Torres', tags: ['starter','africa'],              notes: 'Inbound lead.',                     tenantIds: [], createdBy: 'system', orgType: 'client' },
  { name: 'Costa Gestão Patrimonial', country: 'Brazil',    region: 'latam',         size: 'boutique',   estAumUsd:  18_000_000, stage: 'qualification', assignedTo: 'Alexandra Torres', tags: ['starter','brazil'],              notes: 'Small boutique, 2 advisors.',       tenantIds: [], createdBy: 'system', orgType: 'client' },
  { name: 'Meridian Capital Partners', country: 'USA',       region: 'north_america', size: 'large',      estAumUsd: 650_000_000, stage: 'proposal',      assignedTo: 'James Rivera',     tags: ['enterprise','usa','hot'],        notes: 'Strong interest in API integration.',tenantIds:[], createdBy: 'system' },
  { name: 'Asia Pacific Trustees',     country: 'Hong Kong', region: 'apac',          size: 'enterprise', estAumUsd:1_200_000_000,stage: 'demo',          assignedTo: 'Sarah Chen',       tags: ['enterprise','apac','strategic'],notes: 'Largest deal in pipeline.',         tenantIds: [], createdBy: 'system', orgType: 'client' },
  { name: 'Nordic Wealth Group',       country: 'Sweden',    region: 'emea',          size: 'mid',        estAumUsd: 340_000_000, stage: 'negotiation',   assignedTo: 'Carlos Mendes',    tags: ['enterprise','europe','warm'],   notes: 'Price-sensitive, wants 3yr deal.',  tenantIds: [], createdBy: 'system', orgType: 'client' },
];

const SAMPLE_CONTACTS: (Omit<PlatformContact, 'id' | 'createdAt' | 'updatedAt' | 'orgId'>)[] = [
  { name: 'Felipe Andrade',     email: 'f.andrade@af.com.br',        phone: '+55 11 99988-7766', role: 'Founding Partner', isPrimary: true,  notes: 'Key decision maker.', createdBy: 'system' },
  { name: 'Patricia Lim',       email: 'p.lim@plwealth.sg',          phone: '+65 9123 4567',     role: 'CIO',              isPrimary: true,  notes: '',                    createdBy: 'system' },
  { name: 'Marie-Claire Dupont',email: 'mcdupont@dupont.fr',         phone: '+33 1 42 60 00 00', role: 'CEO',              isPrimary: true,  notes: '',                    createdBy: 'system' },
  { name: 'Gustavo Leite',      email: 'g.leite@glinvest.com.br',    phone: '+55 21 99777-5544', role: 'Managing Partner', isPrimary: true,  notes: '',                    createdBy: 'system' },
  { name: 'James Whitmore',     email: 'j.whitmore@whitmorewc.com',  phone: '+44 20 7946 0958',  role: 'CEO',              isPrimary: true,  notes: '',                    createdBy: 'system' },
  { name: 'Robert Okafor',      email: 'r.okafor@lagoscap.com',      phone: '+234 1 270 3555',   role: 'Founding Partner', isPrimary: true,  notes: '',                    createdBy: 'system' },
  { name: 'Ana Costa',          email: 'a.costa@costgp.com.br',      phone: '+55 11 3344-2200',  role: 'Director',         isPrimary: true,  notes: '',                    createdBy: 'system' },
  { name: 'David Stern',        email: 'd.stern@meridiancap.com',     phone: '+1 202 555 0176',   role: 'CIO',              isPrimary: true,  notes: '',                    createdBy: 'system' },
  { name: 'Mei Lin',            email: 'mei.lin@aptrustees.com.hk',  phone: '+852 2345 6789',    role: 'CEO',              isPrimary: true,  notes: 'Prefers demos in CET.',createdBy: 'system' },
  { name: 'Erik Johansson',     email: 'e.johansson@nordicwg.se',    phone: '+46 8 123 456 78',  role: 'CFO',              isPrimary: true,  notes: '',                    createdBy: 'system' },
];

const SAMPLE_TEAMS: Omit<SalesTeam, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'LATAM Sales',         region: 'latam',         managerId: 'system', managerName: 'Alexandra Torres', memberIds: [], memberNames: ['Alexandra Torres', 'Bruno Silva'],     description: 'Covers Brazil, Mexico, Colombia, Argentina', quota: 2_000_000 },
  { name: 'EMEA Sales',          region: 'emea',          managerId: 'system', managerName: 'Carlos Mendes',    memberIds: [], memberNames: ['Carlos Mendes', 'Sophie Martin'],      description: 'Europe, Middle East, Africa',                quota: 3_500_000 },
  { name: 'APAC Sales',          region: 'apac',          managerId: 'system', managerName: 'Sarah Chen',       memberIds: [], memberNames: ['Sarah Chen', 'Kevin Tan'],             description: 'Asia Pacific, including ANZ',                quota: 2_800_000 },
  { name: 'North America Sales', region: 'north_america', managerId: 'system', managerName: 'James Rivera',     memberIds: [], memberNames: ['James Rivera', 'Maria Gonzalez'],     description: 'USA, Canada',                                quota: 4_000_000 },
  { name: 'Global Enterprise',   region: 'global',        managerId: 'system', managerName: 'CEO (Sales)',      memberIds: [], memberNames: ['CEO (Sales)'],                        description: 'Strategic enterprise accounts >$1B AUM',     quota: 5_000_000 },
];

export async function seedCrmIfEmpty(performer: { uid: string }): Promise<boolean> {
  const snap = await getDocs(collection(db, 'platform_orgs'));
  if (!snap.empty) return false;
  const ts = new Date().toISOString();
  const orgIds: string[] = [];
  for (let i = 0; i < SAMPLE_ORGS.length; i++) {
    const ref = await addDoc(collection(db, 'platform_orgs'), { ...SAMPLE_ORGS[i], createdAt: ts, updatedAt: ts });
    await updateDoc(ref, { id: ref.id });
    orgIds.push(ref.id);
    const contact = { ...SAMPLE_CONTACTS[i], orgId: ref.id };
    const cref = await addDoc(collection(db, 'platform_contacts'), { ...contact, createdAt: ts, updatedAt: ts });
    await updateDoc(cref, { id: cref.id });
  }
  // Seed opportunities
  const oppSeeds: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>[] = [
    { orgId: orgIds[0], orgName: 'Andrade Family Office',     title: 'Enterprise Annual — Andrade',     stage: 'proposal',      valueUsd: 120_000, probability: 70, closeDate: daysAhead(30), ownerId: 'system', ownerName: 'Alexandra Torres', region: 'latam',         products: ['Enterprise Plan'],             notes: '',       createdBy: 'system' },
    { orgId: orgIds[1], orgName: 'PL Wealth Solutions',       title: 'Growth Tier — PL Wealth',         stage: 'qualification', valueUsd:  48_000, probability: 40, closeDate: daysAhead(60), ownerId: 'system', ownerName: 'Carlos Mendes',    region: 'apac',          products: ['Growth Plan'],                 notes: '',       createdBy: 'system' },
    { orgId: orgIds[2], orgName: 'Dupont Patrimoine',         title: 'Enterprise + Support — Dupont',   stage: 'closed_won',   valueUsd: 180_000, probability:100, closeDate: daysAgo(10),   ownerId: 'system', ownerName: 'Carlos Mendes',    region: 'emea',          products: ['Enterprise Plan', 'Premium Support'], notes: 'Won!', createdBy: 'system' },
    { orgId: orgIds[3], orgName: 'GL Investimentos',          title: 'Growth 20 Seats — GL',            stage: 'negotiation',   valueUsd:  72_000, probability: 80, closeDate: daysAhead(14), ownerId: 'system', ownerName: 'Alexandra Torres', region: 'latam',         products: ['Growth Plan'],                 notes: 'Seat discount request', createdBy: 'system' },
    { orgId: orgIds[7], orgName: 'Meridian Capital Partners', title: 'Enterprise API Bundle — Meridian', stage: 'proposal',      valueUsd: 250_000, probability: 65, closeDate: daysAhead(45), ownerId: 'system', ownerName: 'James Rivera',     region: 'north_america', products: ['Enterprise Plan', 'API Access'], notes: '', createdBy: 'system' },
    { orgId: orgIds[8], orgName: 'Asia Pacific Trustees',     title: 'Strategic Enterprise — APT',      stage: 'demo',          valueUsd: 600_000, probability: 50, closeDate: daysAhead(90), ownerId: 'system', ownerName: 'Sarah Chen',       region: 'apac',          products: ['Enterprise Plan', 'White Label'], notes: 'Largest deal', createdBy: 'system' },
  ];
  for (const opp of oppSeeds) {
    const oref = await addDoc(collection(db, 'platform_opportunities'), { ...opp, createdAt: ts, updatedAt: ts });
    await updateDoc(oref, { id: oref.id });
  }
  // Seed activities
  const actSeeds: Omit<CrmActivity, 'id' | 'createdAt' | 'updatedAt'>[] = [
    { orgId: orgIds[0], orgName: 'Andrade Family Office', type: 'call',    direction: 'outbound', subject: 'Discovery Call — Felipe Andrade',       body: 'Discussed enterprise needs and integration requirements.', performedByUid: 'system', performedByName: 'Alexandra Torres', scheduledAt: daysAgo(5),  completedAt: daysAgo(5),  outcome: 'Positive — moving to proposal' },
    { orgId: orgIds[1], orgName: 'PL Wealth Solutions',   type: 'email',   direction: 'outbound', subject: 'Platform Introduction — PL Wealth',     body: 'Sent product overview and pricing sheet.',                   performedByUid: 'system', performedByName: 'Carlos Mendes',    scheduledAt: daysAgo(12), completedAt: daysAgo(12), outcome: 'Awaiting reply' },
    { orgId: orgIds[4], orgName: 'Whitmore Wealthcare',   type: 'demo',    direction: 'outbound', subject: 'Product Demo — Whitmore',               body: 'Full platform walkthrough. Strong interest in co-pilot.',     performedByUid: 'system', performedByName: 'Carlos Mendes',    scheduledAt: daysAgo(3),  completedAt: daysAgo(3),  outcome: 'Positive — GDPR docs requested' },
    { orgId: orgIds[3], orgName: 'GL Investimentos',      type: 'meeting', direction: 'outbound', subject: 'Negotiation Meeting — GL Investimentos', body: 'Discussed seat pricing and 2-year contract.',                 performedByUid: 'system', performedByName: 'Alexandra Torres', scheduledAt: daysAgo(1),  completedAt: daysAgo(1),  outcome: 'Counter-proposal sent' },
    { orgId: orgIds[7], orgName: 'Meridian Capital',      type: 'call',    direction: 'inbound',  subject: 'Inbound Call — Meridian API question',  body: 'David Stern called about API rate limits and sandbox.',       performedByUid: 'system', performedByName: 'James Rivera',     scheduledAt: daysAgo(7),  completedAt: daysAgo(7),  outcome: 'Technical docs sent' },
  ];
  for (const act of actSeeds) {
    const aref = await addDoc(collection(db, 'platform_crm_activities'), { ...act, createdAt: ts, updatedAt: ts });
    await updateDoc(aref, { id: aref.id });
  }
  // Seed teams
  for (const team of SAMPLE_TEAMS) {
    const tref = await addDoc(collection(db, 'platform_sales_teams'), { ...team, createdAt: ts, updatedAt: ts });
    await updateDoc(tref, { id: tref.id });
  }
  return true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const ORG_SIZE_LABELS: Record<OrgSize, string> = {
  boutique: 'Boutique (<$50M)', small: 'Small ($50–$200M)',
  mid: 'Mid ($200M–$1B)', large: 'Large ($1–$5B)', enterprise: 'Enterprise (>$5B)',
};

export const REGION_LABELS: Record<SalesRegion, string> = {
  latam: '🌎 LATAM', emea: '🌍 EMEA', apac: '🌏 APAC',
  north_america: '🗽 North America', global: '🌐 Global',
};

export const REGION_COLORS: Record<SalesRegion, string> = {
  latam: '#22c55e', emea: '#6366f1', apac: '#f59e0b',
  north_america: '#22d3ee', global: '#a78bfa',
};

// ─── Dynamic Pipeline Settings ────────────────────────────────────────────────

export interface PipelineStageConfig {
  id: string;          // Maps to DealStage
  label: string;       // Custom label
  color: string;       // Custom color
  probability: number; // 0-100
}

export const DEFAULT_PIPELINE_STAGES: PipelineStageConfig[] = [
  { id: 'lead', label: 'Lead / Prospect', color: '#64748b', probability: 10 },
  { id: 'qualification', label: '1 - Qualification', color: '#6366f1', probability: 25 },
  { id: 'demo', label: '2 - Strategy & Demo', color: '#8b5cf6', probability: 50 },
  { id: 'proposal', label: '3 - Proposal Sent', color: '#f59e0b', probability: 75 },
  { id: 'negotiation', label: '4 - Negotiation', color: '#22d3ee', probability: 90 },
  { id: 'closed_won', label: 'Closed (Won)', color: '#22c55e', probability: 100 },
  { id: 'closed_lost', label: 'Closed (Lost)', color: '#ef4444', probability: 0 },
];

export async function getTenantPipelineStages(tenantId: string): Promise<PipelineStageConfig[]> {
  const snap = await getDoc(doc(db, 'tenants', tenantId, 'settings', 'crm_pipeline'));
  if (!snap.exists()) return DEFAULT_PIPELINE_STAGES;
  const config = snap.data();
  return config.stages && config.stages.length > 0 ? config.stages : DEFAULT_PIPELINE_STAGES;
}

export async function updateTenantPipelineStages(tenantId: string, stages: PipelineStageConfig[]): Promise<void> {
  const ref = doc(db, 'tenants', tenantId, 'settings', 'crm_pipeline');
  await setDoc(ref, { stages, updatedAt: new Date().toISOString() }, { merge: true });
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const STAGE_COLORS: Record<DealStage, string> = {
  lead: '#64748b', qualification: '#6366f1', demo: '#8b5cf6',
  proposal: '#f59e0b', negotiation: '#22d3ee', closed_won: '#22c55e', closed_lost: '#ef4444',
};
export const STAGE_LABELS: Record<DealStage, string> = {
  lead: '🔵 Lead', qualification: '💜 Qualifying', demo: '🖥 Demo',
  proposal: '🟡 Proposal', negotiation: '🔵 Negotiation',
  closed_won: '✅ Closed Won', closed_lost: '❌ Closed Lost',
};
export const STAGES: DealStage[] = ['lead', 'qualification', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

export const ACTIVITY_ICONS: Record<ActivityType, string> = {
  call: '📞', email: '✉️', meeting: '🤝', demo: '🖥', note: '📝', linkedin: '💼', other: '📌',
};
export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  call: 'Call', email: 'Email', meeting: 'Meeting', demo: 'Demo', note: 'Note', linkedin: 'LinkedIn', other: 'Other',
};
export const ACTIVITY_TYPES: ActivityType[] = ['call', 'email', 'meeting', 'demo', 'note', 'linkedin', 'other'];

export const PRODUCT_OPTIONS = [
  'Starter Plan', 'Growth Plan', 'Enterprise Plan',
  'White Label', 'API Access', 'Premium Support', 'Data Export AddOn',
];

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  client: 'Client',
  prospect: 'Prospect',
  supplier: 'Vendor',
  partner: 'Partner',
};
