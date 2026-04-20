/**
 * marketingService.ts
 *
 * Provides schemas, API integrations, and utilities for the Enterprise Marketing Module
 * configured for Wealth Management / Multi-Family Offices.
 *
 * Collections:
 *   tenants/{id}/marketing_campaigns
 *   tenants/{id}/marketing_events
 */

import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, query, orderBy, where } from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';

const db = getFirestore(firebaseApp);

export type CampaignType = 'newsletter' | 'webinar' | 'social' | 'print' | 'affiliate';
export type CampaignStatus = 'draft' | 'active' | 'completed' | 'paused';

export interface CampaignRecord {
  id: string;
  tenantId: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  
  // Basic Financials
  budgetAllocated: number;  // Originally assigned budget
  budgetSent: number;       // Actual spent budget
  
  // Pipeline & Conversion Metrics
  impressions?: number;
  clicks?: number;
  expectedLeads: number;
  actualLeadsGenerated: number;
  opportunitiesGenerated?: number;
  clientsConverted?: number;
  
  // Advanced ROI Metrics
  expectedRevenue?: number;
  actualRevenueAttributed?: number;
  
  startDate?: string;
  endDate?: string;
  
  // Integration
  expenseId?: string;    // Links to Accounting expense module
  
  createdAt: string;
  updatedAt: string;
}

export type EventStatus = 'planning' | 'invitations_sent' | 'completed' | 'cancelled';

export interface MarketingBudgetPlan {
  id: string;
  tenantId: string;
  year: number;
  totalBudget: number;
  allocations: {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
  };
  channels: {
    digital: number;
    events: number;
    sponsorship: number;
    print: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface EventRecord {
  id: string;
  tenantId: string;
  title: string;          // e.g. "Annual CIO Summit" or "Private Equity Gala"
  status: EventStatus;
  
  location?: string;
  eventDate: string;
  
  // Attendee tracking
  maxCapacity: number;
  registeredCount: number;
  attendedCount: number;
  
  // Financials & Integration
  budget: number;
  actualCost: number;
  expenseId?: string;     // Links to Accounting expense module
  
  createdAt: string;
  updatedAt: string;
}

export interface EventAttendee {
  id: string;             // Subcollection doc inside the event
  contactId?: string;     // Null if they are a raw prospect, populated if they exist in contacts_crm
  name: string;
  email: string;
  organization?: string;
  
  status: 'invited' | 'registered' | 'waitlisted' | 'attended' | 'no_show';
  dietaryRequirements?: string;
  
  createdAt: string;
  updatedAt: string;
}

export async function getCampaigns(tenantId: string): Promise<CampaignRecord[]> {
  const q = query(
    collection(db, 'tenants', tenantId, 'marketing_campaigns'),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CampaignRecord));
}

export async function createCampaign(tenantId: string, data: Omit<CampaignRecord, 'id' | 'createdAt' | 'updatedAt' | 'actualLeadsGenerated'>): Promise<string> {
  const ref = collection(db, 'tenants', tenantId, 'marketing_campaigns');
  const payload = {
    ...data,
    actualLeadsGenerated: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const docRef = await addDoc(ref, payload);
  return docRef.id;
}

export async function getEvents(tenantId: string): Promise<EventRecord[]> {
  const q = query(
    collection(db, 'tenants', tenantId, 'marketing_events'),
    orderBy('eventDate', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as EventRecord));
}

export async function createEvent(tenantId: string, data: Omit<EventRecord, 'id' | 'createdAt' | 'updatedAt' | 'registeredCount' | 'attendedCount'>): Promise<string> {
  const ref = collection(db, 'tenants', tenantId, 'marketing_events');
  const payload = {
    ...data,
    registeredCount: 0,
    attendedCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const docRef = await addDoc(ref, payload);
  return docRef.id;
}

export async function getBudgetPlan(tenantId: string, year: number): Promise<MarketingBudgetPlan | null> {
  const ref = doc(db, 'tenants', tenantId, 'marketing_budgets', `${year}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as MarketingBudgetPlan;
}

export async function saveBudgetPlan(tenantId: string, plan: Partial<MarketingBudgetPlan> & { year: number }): Promise<void> {
  const ref = doc(db, 'tenants', tenantId, 'marketing_budgets', `${plan.year}`);
  const payload = {
    ...plan,
    tenantId,
    updatedAt: new Date().toISOString()
  };
  
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    payload.createdAt = new Date().toISOString();
  }
  
  await setDoc(ref, payload, { merge: true });
}
