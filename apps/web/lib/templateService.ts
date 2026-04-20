import { db } from '@mfo-crm/config';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';

export type TemplateType = 'invoice' | 'authorization_letter' | 'other';

export interface DocumentTemplate {
  id: string;
  tenantId: string;
  name: string;
  type: TemplateType;
  htmlContent: string;
  schema?: string; // e.g. JSON array of required merge fields
  description?: string;
  createdAt: string;
  updatedAt: string;
  lastEditedBy: string;
}

export async function getTemplates(tenantId: string): Promise<DocumentTemplate[]> {
  const q = query(
    collection(db, `tenants/${tenantId}/templates`),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DocumentTemplate));
}

export async function getTemplate(tenantId: string, templateId: string): Promise<DocumentTemplate | null> {
  const docRef = doc(db, `tenants/${tenantId}/templates`, templateId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as DocumentTemplate;
}

export async function saveTemplate(tenantId: string, template: Partial<DocumentTemplate> & { name: string, type: TemplateType }, performerUid: string): Promise<string> {
  const isNew = !template.id;
  const id = template.id || doc(collection(db, 'dummy')).id;
  
  const payload: any = {
    ...template,
    tenantId,
    updatedAt: new Date().toISOString(),
    lastEditedBy: performerUid,
  };

  if (isNew) {
    payload.createdAt = new Date().toISOString();
  } else {
    // avoid accidentally overwriting createdAt if not provided in Partial
    delete payload.createdAt; 
  }

  const docRef = doc(db, `tenants/${tenantId}/templates`, id);
  await setDoc(docRef, payload, { merge: true });
  return id;
}

export async function deleteTemplate(tenantId: string, templateId: string): Promise<void> {
  const docRef = doc(db, `tenants/${tenantId}/templates`, templateId);
  await deleteDoc(docRef);
}
