import { firebaseApp } from '@mfo-crm/config';
import {
  getFirestore,
  collection,
  query,
  limit,
  getDocs,
  DocumentData,
  QuerySnapshot
} from 'firebase/firestore';

const db = getFirestore(firebaseApp);

/**
 * Service for checking schema dependencies and querying dynamically
 * within the System Catalog.
 */

/**
 * Checks if ANY document in a given tenant's dynamic collection
 * has a specific field populated. Used for "Safe Deletion" validation.
 */
export async function checkFieldHasData(
  tenantId: string,
  collectionId: string,
  fieldId: string
): Promise<boolean> {
  if (!tenantId || !collectionId || !fieldId) return false;

  try {
    const colRef = collection(db, 'tenants', tenantId, 'dynamic_data', collectionId, 'records');
    // We only need to check a few documents to determine if the field is in use.
    // Instead of querying all documents, we can fetch a sample, but since
    // we want to be safe, we must find at least ONE document with this field.
    // Firestore lacks `where(field, '!=', null)`, so we fetch a small batch 
    // and check locally, or just rely on the definition. 
    // To be perfectly accurate across large sets, one should use a Cloud Function,
    // but for the explorer we will scan up to 100 documents.
    const q = query(colRef, limit(100));
    const snapshot: QuerySnapshot<DocumentData> = await getDocs(q);

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data[fieldId] !== undefined && data[fieldId] !== null && data[fieldId] !== '') {
        return true; // Found data! Unsafe to delete.
      }
    }
    
    return false; // No data found in the sample
  } catch (error) {
    console.error('Failed to check field dependencies:', error);
    // Be conservative: if we can't check, assume it's unsafe.
    return true; 
  }
}

/**
 * Fetches documents for a specific dynamic collection.
 */
export async function fetchCollectionData(
  tenantId: string,
  collectionId: string,
  fetchLimit: number = 50
): Promise<any[]> {
  if (!tenantId || !collectionId) return [];

  try {
    const colRef = collection(db, 'tenants', tenantId, 'dynamic_data', collectionId, 'records');
    const q = query(colRef, limit(fetchLimit));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      _id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error(`Failed to fetch data for collection ${collectionId}:`, error);
    return [];
  }
}
