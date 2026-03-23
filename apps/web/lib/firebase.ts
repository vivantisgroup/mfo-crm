import { firebaseApp } from '@mfo-crm/config';
import { getFirestore, collection, getDocs, setDoc, doc, query, where, writeBatch } from 'firebase/firestore';
export const db = getFirestore(firebaseApp);
import { Activity } from './types';
import { buildSeedManifest } from './demoSeed';

// ==========================================
// 1. SEED DATABASE — uses demoSeed manifest
// ==========================================
// Pushes ALL mock data to Firestore for a given tenant.
// Any new feature added to demoSeed.ts is automatically included.

export interface SeedProgress {
  collection: string;
  label: string;
  records: number;
  status: 'pending' | 'seeding' | 'done' | 'error';
  error?: string;
}

/** Seed all collections from the manifest for a tenant (batch-write per collection) */
export async function seedFirestore(
  tenantId: string,
  onProgress?: (p: SeedProgress) => void,
): Promise<{ seededCollections: number; seededRecords: number }> {
  if (!db) throw new Error('Firestore not initialized');

  const manifest = buildSeedManifest();
  let seededCollections = 0;
  let seededRecords     = 0;

  for (const col of manifest) {
    const progress: SeedProgress = {
      collection: col.name,
      label:      col.label,
      records:    col.data.length,
      status:     'seeding',
    };
    onProgress?.(progress);

    try {
      const batch = writeBatch(db);
      for (const record of col.data) {
        const docId = String((record as any)[col.idField ?? 'id'] ?? Math.random().toString(36).slice(2));
        const ref = doc(collection(db, `tenants/${tenantId}/${col.name}`), docId);
        batch.set(ref, { ...(record as object), tenantId });
      }
      await batch.commit();
      seededCollections++;
      seededRecords += col.data.length;
      onProgress?.({ ...progress, status: 'done' });
    } catch (err: any) {
      onProgress?.({ ...progress, status: 'error', error: err?.message });
      console.error(`[seed] Error on ${col.name}:`, err);
    }
  }

  console.log(`[seed] Done. ${seededCollections} collections, ${seededRecords} records → tenant ${tenantId}`);
  return { seededCollections, seededRecords };
}

/** Delete ALL seeded data for a tenant (purge demo) */
export async function purgeFirestoreTenant(tenantId: string): Promise<void> {
  if (!db) return;
  const manifest = buildSeedManifest();
  for (const col of manifest) {
    const snap = await getDocs(collection(db, `tenants/${tenantId}/${col.name}`));
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}

// ==========================================
// 2. QUERY FUNCTIONS (LIVE DB)
// ==========================================

export async function getLiveActivities(tenantId: string): Promise<Activity[]> {
  if (!db) throw new Error('Firestore not initialized');

  const q        = query(collection(db, `tenants/${tenantId}/activities`));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return [];

  const activities: Activity[] = [];
  snapshot.forEach(d => activities.push({ id: d.id, ...d.data() } as Activity));
  return activities.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

export async function checkTenantHasData(tenantId: string): Promise<boolean> {
  if (!db) return false;
  const snap = await getDocs(query(collection(db, `tenants/${tenantId}/activities`)));
  return !snap.empty;
}
