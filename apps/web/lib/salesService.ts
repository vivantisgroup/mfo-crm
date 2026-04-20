/**
 * salesService.ts
 *
 * Provides schemas, API integrations, and utilities for the Enterprise Sales CRM
 * configured for Wealth Management / Multi-Family Offices.
 *
 * Collections:
 *   tenants/{id}/sales_opportunities
 *   tenants/{id}/sales_pipelines (dynamic stage configuration)
 */

import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';

const db = getFirestore(firebaseApp);

export type OpportunityStageType = 'inbound' | 'prospecting' | 'meeting' | 'proposal' | 'kyc_onboarding' | 'won' | 'lost';

export interface PipelineStage {
  id: string;
  name: string;
  type: OpportunityStageType;
  probability: number;      // 0 to 100
  order: number;
  color: string;
}

export interface OpportunityRecord {
  id: string;
  tenantId: string;
  title: string;          // e.g. "Smith Family Onboarding" or "Acme Tech PE Co-Invest"
  
  // Pipeline
  pipelineId?: string;    // If supporting multiple pipelines (e.g. Capital Raising vs Family Onboarding)
  stageId: string;
  stageName: string;
  probability: number;    // Denormalized from stage
  
  // Value
  expectedAum: number;
  expectedRevenue: number;
  currency: string;
  
  // Contacts
  primaryContactId?: string;
  primaryContactName?: string;
  referredByContactId?: string;    // Critical for MFOs: existing family member referrals
  
  // Dates
  expectedCloseDate?: string;
  actualCloseDate?: string;
  createdAt: string;
  updatedAt: string;
  
  // Assignment
  ownerId?: string;
  
  // Custom metadata (e.g. lost reason)
  metadata?: Record<string, string | number | boolean>;
}

/** Default Pipeline configuration if none exists for the tenant */
export const DEFAULT_MFO_PIPELINE: PipelineStage[] = [
  { id: 'stg_1', name: 'New Lead', type: 'inbound', probability: 5, order: 1, color: '#94a3b8' },
  { id: 'stg_2', name: 'Prospecting', type: 'prospecting', probability: 10, order: 2, color: '#38bdf8' },
  { id: 'stg_3', name: 'Initial Meeting', type: 'meeting', probability: 25, order: 3, color: '#facc15' },
  { id: 'stg_4', name: 'Proposal Sent', type: 'proposal', probability: 50, order: 4, color: '#fb923c' },
  { id: 'stg_5', name: 'KYC & Onboarding', type: 'kyc_onboarding', probability: 80, order: 5, color: '#ec4899' },
  { id: 'stg_6', name: 'Closed Won', type: 'won', probability: 100, order: 6, color: '#22c55e' },
  { id: 'stg_7', name: 'Closed Lost', type: 'lost', probability: 0, order: 7, color: '#ef4444' }
];

export async function getPipelineStages(tenantId: string): Promise<PipelineStage[]> {
  const snap = await getDocs(collection(db, 'tenants', tenantId, 'sales_pipelines'));
  if (snap.empty) {
    // Return defaults if not configured
    return DEFAULT_MFO_PIPELINE;
  }
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as PipelineStage)).sort((a,b) => a.order - b.order);
}

export async function initializePipelineStages(tenantId: string, stages: PipelineStage[] = DEFAULT_MFO_PIPELINE): Promise<void> {
  const batchRequests = stages.map(stg => {
    return setDoc(doc(db, 'tenants', tenantId, 'sales_pipelines', stg.id), stg);
  });
  await Promise.all(batchRequests);
}

export async function getOpportunities(tenantId: string): Promise<OpportunityRecord[]> {
  const q = query(
    collection(db, 'tenants', tenantId, 'sales_opportunities'),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as OpportunityRecord));
}

export async function createOpportunity(tenantId: string, data: Omit<OpportunityRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = collection(db, 'tenants', tenantId, 'sales_opportunities');
  const payload = {
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const docRef = await addDoc(ref, payload);
  return docRef.id;
}

export async function updateOpportunityStage(tenantId: string, opportunityId: string, targetStage: PipelineStage): Promise<void> {
  const ref = doc(db, 'tenants', tenantId, 'sales_opportunities', opportunityId);
  await updateDoc(ref, {
    stageId: targetStage.id,
    stageName: targetStage.name,
    probability: targetStage.probability,
    updatedAt: new Date().toISOString(),
    ...(targetStage.type === 'won' || targetStage.type === 'lost' ? { actualCloseDate: new Date().toISOString() } : {})
  });

  // Core CRM Integration: Automatically trigger Family Onboarding if WON
  if (targetStage.type === 'won') {
     const snap = await getDoc(ref);
     if (snap.exists()) {
        const oppData = snap.data() as OpportunityRecord;
        if (!oppData.metadata?.convertedToFamily) {
           await convertLeadToFamily(tenantId, oppData);
        }
     }
  }
}

/**
 * Automates the transition from a Prospect Opportunity to a Core FamilyRecord.
 * This integrates deeply with the rest of the MFO-CRM (creating statement trackers, etc).
 */
export async function convertLeadToFamily(tenantId: string, opportunity: OpportunityRecord): Promise<string> {
  const familyRef = collection(db, 'tenants', tenantId, 'families');
  
  const payload = {
    canonicalName: opportunity.title.replace(' Onboarding', '').replace(' Opportunity', ''),
    status: 'onboarding',
    totalAumUsd: opportunity.expectedAum || 0,
    primaryContactId: opportunity.primaryContactId || null,
    sourceOpportunityId: opportunity.id, // Linking back
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const newDoc = await addDoc(familyRef, payload);

  // Update the opportunity to mark it as converted
  const opRef = doc(db, 'tenants', tenantId, 'sales_opportunities', opportunity.id);
  await updateDoc(opRef, {
    'metadata.convertedToFamily': true,
    'metadata.familyId': newDoc.id,
    updatedAt: new Date().toISOString()
  });

  console.log(`[Sales Integration] Successfully converted Opportunity ${opportunity.id} to FamilyRecord ${newDoc.id}`);
  return newDoc.id;
}
