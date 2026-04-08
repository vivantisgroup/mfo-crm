import { collection, query, orderBy, getDocs, addDoc, doc, updateDoc, deleteDoc, where, limit } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from './firebase';

export type TagColor = 'slate' | 'gray' | 'zinc' | 'neutral' | 'stone' | 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'green' | 'emerald' | 'teal' | 'cyan' | 'sky' | 'blue' | 'indigo' | 'violet' | 'purple' | 'fuchsia' | 'pink' | 'rose';

export interface Tag {
  id: string;
  name: string;
  color: TagColor;
  createdBy?: string;
  searchKey?: string;
  createdAt?: string;
}

// ─── Local Mock Fallbacks ────────────────────────────────────────────────────────

const MOCK_TAGS: Tag[] = [
  { id: 'tag-1', name: 'Ford', color: 'blue' },
  { id: 'tag-2', name: 'Team A', color: 'indigo' },
  { id: 'tag-3', name: 'VIP Client', color: 'amber' },
  { id: 'tag-4', name: 'Compliance', color: 'rose' },
  { id: 'tag-5', name: 'Legal', color: 'emerald' },
];

export async function getAllTags(tenantId?: string): Promise<Tag[]> {
  if (!tenantId) return [];
  try {
    const q = query(collection(db, `tenant_tags/${tenantId}/tags`), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    if (snap.empty) return [];
    
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Tag));
  } catch (err) {
    console.warn("Falling back to empty tags array (firestore not initialized/offline)", err);
    return [];
  }
}

export async function createTag(name: string, color: TagColor, tenantId: string): Promise<Tag> {
  const searchKey = name.trim().toLowerCase();
  const colPath = `tenant_tags/${tenantId}/tags`;
  
  try {
    const q = query(collection(db, colPath), where('searchKey', '==', searchKey), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const existing = snap.docs[0];
      return { id: existing.id, ...existing.data() } as Tag;
    }
  } catch (e) {
    // offline or index not ready, proceed to just add or fallback
  }

  const newTag = { 
    name: name.trim(), 
    color,
    searchKey,
    tenantId,
    createdBy: getAuth().currentUser?.uid || 'system',
    createdAt: new Date().toISOString()
  };
  const docRef = await addDoc(collection(db, colPath), newTag);
  return { id: docRef.id, ...newTag };
}

export async function updateTag(id: string, updates: Partial<Tag>, tenantId: string): Promise<void> {
  const ref = doc(db, `tenant_tags/${tenantId}/tags`, id);
  await updateDoc(ref, updates);
}

export async function deleteTag(id: string, tenantId: string): Promise<void> {
  const ref = doc(db, `tenant_tags/${tenantId}/tags`, id);
  await deleteDoc(ref);
}
