import { getAdminFirestore } from '@/lib/firebaseAdmin';

export interface GraphClientConfig {
  accessToken: string;
  siteId: string | null;
  serviceAccountEmail: string | null;
  driveType: 'user' | 'site';
  rootFolder: string;
}

export async function getTenantGraphConfig(tenantId: string): Promise<GraphClientConfig | null> {
  const db = getAdminFirestore();
  const doc = await db.collection('tenants').doc(tenantId).get();
  
  if (!doc.exists) return null;
  
  const data = doc.data();
  const storage = data?.storageIntegrations;
  
  if (!storage || !storage.credentials) return null;
  
  const creds = storage.credentials;
  
  // 1. Fetch Entra ID Token
  const tokenResponse = await fetch(`https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to acquire MS Graph Access Token');
  }
  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;
  
  let siteId = null;
  
  // 2. Resolve Site ID if DriveType is Site
  if (creds.driveType === 'site' && creds.siteUrl) {
    try {
      const urlObj = new URL(creds.siteUrl);
      const hostname = urlObj.hostname;
      let sitePath = urlObj.pathname;
      if (sitePath.endsWith('/')) sitePath = sitePath.slice(0, -1);
      
      const siteRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}?$select=id`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (siteRes.ok) {
         const siteBody = await siteRes.json();
         siteId = siteBody.id;
      }
    } catch(e) {
      console.warn('Failed to resolve Graph Site ID', e);
    }
  }
  
  return {
    accessToken,
    siteId,
    serviceAccountEmail: creds.serviceAccount || null,
    driveType: creds.driveType || 'user',
    rootFolder: storage.rootFolder || 'MFO-CRM-Data'
  };
}

/**
 * Derives the exact Graph Endpoint base URL for a specific contextual folder.
 * Example entityPath: /employees/uuid-123
 */
export function buildGraphItemUrl(config: GraphClientConfig, entityPath: string): string {
    const cleanPath = entityPath.startsWith('/') ? entityPath.substring(1) : entityPath;
    const fullPath = `${config.rootFolder}/${cleanPath}`;
    
    if (config.driveType === 'site' && config.siteId) {
        return `https://graph.microsoft.com/v1.0/sites/${config.siteId}/drive/root:/${fullPath}`;
    } else {
        return `https://graph.microsoft.com/v1.0/users/${config.serviceAccountEmail}/drive/root:/${fullPath}`;
    }
}
