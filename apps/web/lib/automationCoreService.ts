import { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';

const db = getFirestore(firebaseApp);

export interface AutomationStep {
  id: string; // e.g. 'fetch_prices'
  type: 'api_connector'; // future expansion: 'crm_action'
  target: string; // the connectorId
  params: Record<string, string>; // Maps connector payload dynamically
}

export interface AutomationFlow {
  id: string; // e.g. 'slack_webhook_alert'
  name: string; // 'Post Alert to Slack'
  category?: string; // 'Operations', 'Finance', etc.
  description: string;
  icon: string; // lucide name
  color: string; // hex
  inputs: { key: string; label: string }[];
  steps: AutomationStep[];
  outputKey?: string; // what context variable to return at the end
  createdAt: string;
}

export async function getAutomations(tenantId: string): Promise<AutomationFlow[]> {
  const snapshot = await getDocs(collection(db, 'tenants', tenantId, 'automations'));
  return snapshot.docs.map(doc => doc.data() as AutomationFlow);
}

export async function saveAutomation(tenantId: string, flow: AutomationFlow): Promise<void> {
  await setDoc(doc(db, 'tenants', tenantId, 'automations', flow.id), flow, { merge: true });
}

export async function deleteAutomation(tenantId: string, flowId: string): Promise<void> {
  await deleteDoc(doc(db, 'tenants', tenantId, 'automations', flowId));
}
