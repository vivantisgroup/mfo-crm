import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export interface CommitteeParticipant {
  id: string; // userId if internal, or just string
  name: string;
  initials: string;
}

export interface AllocationRow {
  id: string;
  market?: 'Onshore' | 'Global';
  assetClass: string;
  category: string;
  position: 'Positivo' | 'Neutro' | 'Negativo';
  comment: string;
}

export interface CommitteeMinute {
  id?: string;
  tenantId: string;
  date: string; // ISO string
  title: string;
  summary: string;
  status: 'Draft' | 'Aprovada' | 'Revisão';
  participants: CommitteeParticipant[];
  deliberationText?: string; // Rich Text HTML
  allocationData: AllocationRow[]; // The House View snapshot matrix
  createdAt?: any;
  updatedAt?: any;
}

const COLLECTION_NAME = 'committeeMinutes';

/**
 * Fetch all committee minutes for a tenant
 */
export async function getCommitteeMinutes(tenantId: string): Promise<CommitteeMinute[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('tenantId', '==', tenantId),
      orderBy('date', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as CommitteeMinute[];
  } catch (error) {
    console.error('Error fetching committee minutes:', error);
    return [];
  }
}

/**
 * Fetch a single committee minute
 */
export async function getCommitteeMinute(minuteId: string): Promise<CommitteeMinute | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, minuteId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as CommitteeMinute;
    }
    return null;
  } catch (error) {
    console.error('Error fetching committee minute:', error);
    return null;
  }
}

/**
 * Create or update a committee minute
 */
export async function saveCommitteeMinute(minute: CommitteeMinute): Promise<string> {
  try {
    if (minute.id) {
      const docRef = doc(db, COLLECTION_NAME, minute.id);
      await updateDoc(docRef, {
        ...minute,
        updatedAt: serverTimestamp(),
      });
      return minute.id;
    } else {
      const { id, ...minuteData } = minute; // remove id if undefined
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...minuteData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    }
  } catch (error) {
    console.error('Error saving committee minute:', error);
    throw error;
  }
}

/**
 * Delete a committee minute
 */
export async function deleteCommitteeMinute(minuteId: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, minuteId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting committee minute:', error);
    throw error;
  }
}
