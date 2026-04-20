import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';

export interface ServiceTeamMember {
  uid: string;
  name: string;
  email: string;
  role: 'lead_advisor' | 'economist' | 'concierge' | 'operations' | 'analyst';
  photoURL?: string;
}

export interface ServiceTeam {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  members: ServiceTeamMember[];
  
  metrics?: {
    avgResolutionTimeHours?: number;
    activeTasks?: number;
    csatScore?: number;
  };

  createdAt: string;
  updatedAt: string;
}

export const TEAM_ROLES = [
  'lead_advisor', 'economist', 'concierge', 'operations', 'analyst'
] as const;

export const TEAM_ROLE_LABELS: Record<string, string> = {
  lead_advisor: 'Lead Advisor',
  economist: 'Economist',
  concierge: 'Concierge / Assistant',
  operations: 'Operations',
  analyst: 'Analyst',
};

// ─── Fetch Teams ─────────────────────────────────────────────────────────────

export async function getServiceTeams(tenantId: string): Promise<ServiceTeam[]> {
  if (!tenantId) return [];
  const db = getFirestore();
  const q = query(collection(db, 'tenants', tenantId, 'serviceTeams'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceTeam));
}

// ─── Create or Update Team ───────────────────────────────────────────────────

export async function saveServiceTeam(tenantId: string, team: Partial<ServiceTeam> & { id?: string }): Promise<string> {
  if (!tenantId) throw new Error('Tenant ID required');
  const db = getFirestore();
  
  const teamId = team.id || doc(collection(db, 'tenants', tenantId, 'serviceTeams')).id;
  const ref = doc(db, 'tenants', tenantId, 'serviceTeams', teamId);
  
  const existing = await getDoc(ref);
  const now = new Date().toISOString();
  
  const payload: any = {
    ...team,
    tenantId,
    updatedAt: now,
  };

  if (!existing.exists()) {
    payload.createdAt = now;
    payload.metrics = { activeTasks: 0 };
    await setDoc(ref, payload);
  } else {
    await updateDoc(ref, payload);
  }

  return teamId;
}

// ─── Delete Team ─────────────────────────────────────────────────────────────

export async function deleteServiceTeam(tenantId: string, teamId: string): Promise<void> {
  if (!tenantId || !teamId) throw new Error('Missing requirements');
  const db = getFirestore();
  const ref = doc(db, 'tenants', tenantId, 'serviceTeams', teamId);
  await deleteDoc(ref);
}
