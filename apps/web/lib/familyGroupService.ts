import { collection, doc, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Family } from './types';

// ─── Family Group (Grupo Familiar) ──────────────────────────────────────────

export async function getFamilies(tenantId: string): Promise<Family[]> {
  const q = query(
    collection(db, `tenants/${tenantId}/families`),
    orderBy('name', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(skipIdHack => ({ id: skipIdHack.id, ...skipIdHack.data() } as Family));
}

export async function getFamilyById(tenantId: string, familyId: string): Promise<Family | null> {
  const d = await getDoc(doc(db, `tenants/${tenantId}/families/${familyId}`));
  if (!d.exists()) return null;
  return { id: d.id, ...d.data() } as Family;
}

export async function addFamily(tenantId: string, data: Omit<Family, 'id'>): Promise<Family> {
  // Add creation logic including the code format logic (001-RKI, etc.)
  // Though code should ideally be passed in or generated here.
  const colRef = collection(db, `tenants/${tenantId}/families`);
  
  // Basic counter for code generation (naive approach just based on collection size)
  // Real implementation probably needs a transaction or counter document.
  if (!data.code) {
    const snap = await getDocs(colRef);
    const count = snap.size + 1;
    const prefix = count.toString().padStart(3, '0');
    // Assuming name is split or something to get initials if not provided:
    const initials = data.name.substring(0, 3).toUpperCase().padEnd(3, 'X');
    data.code = `${prefix}-${initials}`;
  }

  const docRef = await addDoc(colRef, data);
  return { id: docRef.id, ...data };
}

export async function updateFamily(tenantId: string, familyId: string, data: Partial<Family>): Promise<void> {
  const dRef = doc(db, `tenants/${tenantId}/families`, familyId);
  await updateDoc(dRef, data);
}

export async function deleteFamily(tenantId: string, familyId: string): Promise<void> {
  await deleteDoc(doc(db, `tenants/${tenantId}/families`, familyId));
}

