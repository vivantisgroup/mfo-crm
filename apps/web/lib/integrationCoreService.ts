import { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';

const db = getFirestore(firebaseApp);

export interface VaultCredential {
  id: string; // Alias like 'world_bank_token', 'stripe_key'
  name: string; // Human readable name
  type: 'bearer' | 'basic' | 'apikey' | 'oauth2' | 'custom_header' | 'dynamic';
  token?: string; // The sensitive string, optional for dynamic
  
  // Custom headers or key-value placements
  headerName?: string; // e.g. 'x-my-org-auth'
  arguments?: { key: string; value: string; placement: 'header' | 'query' }[];
  
  allowedRoles?: string[]; // RBAC limits usage to specified roles. Empty = global
  createdAt: string;
}

export interface IntegrationConnector {
  id: string; // e.g., 'get_world_bank'
  name: string; // human readable
  description?: string; // AI generated description of data bounds
  usage?: string; // Developer notes on exact structural usage
  tags?: string[]; // Data Governance Tags (e.g. ['Financial Portfolios', 'Dashboard'])
  category?: string; // 'Banking', 'Marketing', etc.
  logoUrl?: string; // App-store visual identifier
  url: string; // e.g. 'https://api.worldbank.org/v2/country?format=json'
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  vaultId?: string; // Optional reference to VaultCredential.id
  dataPath?: string; // e.g. '[1]' to extract the items array from the root
  labelField?: string; // e.g. 'name'
  valueField?: string; // e.g. 'id'
}

export async function getVaultCredentials(tenantId: string): Promise<VaultCredential[]> {
  const snapshot = await getDocs(collection(db, 'tenants', tenantId, 'vault'));
  return snapshot.docs.map(doc => doc.data() as VaultCredential);
}

export async function saveVaultCredential(tenantId: string, cred: VaultCredential): Promise<void> {
  await setDoc(doc(db, 'tenants', tenantId, 'vault', cred.id), cred, { merge: true });
}

export async function deleteVaultCredential(tenantId: string, credId: string): Promise<void> {
  await deleteDoc(doc(db, 'tenants', tenantId, 'vault', credId));
}

export async function getConnectors(tenantId: string): Promise<IntegrationConnector[]> {
  const snapshot = await getDocs(collection(db, 'tenants', tenantId, 'connectors'));
  return snapshot.docs.map(doc => doc.data() as IntegrationConnector);
}

export async function saveConnector(tenantId: string, conn: IntegrationConnector): Promise<void> {
  await setDoc(doc(db, 'tenants', tenantId, 'connectors', conn.id), conn, { merge: true });
}

export async function deleteConnector(tenantId: string, connId: string): Promise<void> {
  await deleteDoc(doc(db, 'tenants', tenantId, 'connectors', connId));
}
