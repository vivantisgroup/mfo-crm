import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '@mfo-crm/config';

const storage = getStorage(firebaseApp);

export interface AttachmentData {
  name: string;
  url: string;
  size: number;
  type: string;
}

/**
 * Uploads a file to Firebase Storage under the tenant's attachments directory.
 */
export async function uploadAttachment(tenantId: string, file: File): Promise<AttachmentData> {
  const ext = file.name.split('.').pop() ?? 'bin';
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `attachments/${tenantId}/${timestamp}_${safeName}`;
  const ref = storageRef(storage, path);
  
  await uploadBytes(ref, file, { contentType: file.type });
  const url = await getDownloadURL(ref);

  return {
    name: file.name,
    url,
    size: file.size,
    type: file.type
  };
}

/**
 * Convenience method to upload multiple files in parallel.
 */
export async function uploadMultipleAttachments(tenantId: string, files: File[]): Promise<AttachmentData[]> {
  const promises = files.map(file => uploadAttachment(tenantId, file));
  return await Promise.all(promises);
}

/**
 * Uploads a file specifically to a Family Group's root mounting directory.
 * Path format: clientes/{tenantId}/{familyCode}-{familyPseudonym}/{timestamp}_{safeName}
 */
export async function uploadFamilyAttachment(
  tenantId: string, 
  familyCode: string, 
  familyPseudonym: string, 
  file: File,
  subfolder?: string
): Promise<AttachmentData> {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const safePseudonym = (familyPseudonym || 'Desconhecido').replace(/[^a-zA-Z0-9-]/g, '_');
  
  let path = `clientes/${tenantId}/${familyCode}-${safePseudonym}`;
  if (subfolder) path += `/${subfolder}`;
  path += `/${timestamp}_${safeName}`;
  
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file, { contentType: file.type });
  const url = await getDownloadURL(ref);

  return {
    name: file.name,
    url,
    size: file.size,
    type: file.type
  };
}
