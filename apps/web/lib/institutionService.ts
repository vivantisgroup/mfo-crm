import { db } from '@mfo-crm/config';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, where, orderBy, getDoc as getFirestoreDoc } from 'firebase/firestore';

export interface FinancialInstitution {
  id: string;
  tenantId: string;
  name: string;
  type: 'bank' | 'custodian' | 'broker' | 'trust_company';
  isReceivingBank: boolean; // Indicates if this is the MFO's internal receiving bank for fees
  isIntermediary: boolean;  // Commonly used as an intermediary bank
  bicSwift: string;
  country: string;
  createdAt: string;
  updatedAt: string;
}

export interface InternalBankAccount {
  id: string;
  institutionId: string;
  tenantId: string;
  name: string;
  currency: string;
  accountName: string; // Name on the account
  accountNumber: string;
  routingNumber: string; // ABA
  iban: string;
  swiftOveride?: string; // If this specific branch has a different SWIFT
  notes: string;
  isDefaultReceiving: boolean; // Flag to easily identify the default account to pull
}

export async function getInstitutions(tenantId: string): Promise<FinancialInstitution[]> {
  const q = query(
    collection(db, `tenants/${tenantId}/institutions`),
    orderBy('name', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as FinancialInstitution));
}

export async function saveInstitution(tenantId: string, inst: Partial<FinancialInstitution> & { name: string, type: string }): Promise<string> {
  const isNew = !inst.id;
  const id = inst.id || doc(collection(db, 'dummy')).id;
  
  const payload: any = {
    ...inst,
    tenantId,
    updatedAt: new Date().toISOString(),
  };

  if (isNew) {
    payload.createdAt = new Date().toISOString();
  }

  const docRef = doc(db, `tenants/${tenantId}/institutions`, id);
  await setDoc(docRef, payload, { merge: true });
  return id;
}

export async function deleteInstitution(tenantId: string, instId: string): Promise<void> {
  await deleteDoc(doc(db, `tenants/${tenantId}/institutions`, instId));
}

// ---- Accounts ----

export async function getInstitutionAccounts(tenantId: string, institutionId: string): Promise<InternalBankAccount[]> {
  const q = query(
    collection(db, `tenants/${tenantId}/institutions/${institutionId}/accounts`),
    orderBy('name', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as InternalBankAccount));
}

export async function getAllInstitutionAccounts(tenantId: string): Promise<InternalBankAccount[]> {
  // Assuming a subcollection group query is not set up, we just traverse.
  // In production, an `accounts` root collection or a collectionGroup query might be better if there are thousands.
  // For an MFO, there are usually < 50 receiving accounts, so we can fetch per institution.
  const institutions = await getInstitutions(tenantId);
  let allAccounts: InternalBankAccount[] = [];
  for (const inst of institutions) {
    const accs = await getInstitutionAccounts(tenantId, inst.id);
    allAccounts = allAccounts.concat(accs);
  }
  return allAccounts;
}

export async function saveInstitutionAccount(tenantId: string, institutionId: string, acc: Partial<InternalBankAccount> & { name: string }): Promise<string> {
  const id = acc.id || doc(collection(db, 'dummy')).id;
  
  const payload: any = {
    ...acc,
    tenantId,
    institutionId,
  };

  const docRef = doc(db, `tenants/${tenantId}/institutions/${institutionId}/accounts`, id);
  await setDoc(docRef, payload, { merge: true });
  return id;
}

export async function deleteInstitutionAccount(tenantId: string, institutionId: string, accountId: string): Promise<void> {
  await deleteDoc(doc(db, `tenants/${tenantId}/institutions/${institutionId}/accounts`, accountId));
}
