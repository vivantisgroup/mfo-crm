/**
 * msGraphAppConfig.ts
 * 
 * Authenticates the system as a global background Application (Client Credentials Flow)
 * rather than acting on behalf of a specific logged-in user.
 * 
 * Used for tenant-wide operations like listening to all channels and chats.
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';

export async function getGraphAppToken(): Promise<string> {
  let clientId = process.env.MICROSOFT_CLIENT_ID ?? '';
  let clientSecret = process.env.MICROSOFT_CLIENT_SECRET ?? '';
  let tenantId = process.env.MICROSOFT_TENANT_ID ?? 'common';

  try {
    const db = getAdminFirestore();
    const docSnap = await db.doc('system/integrations').get();
    const microsoft = docSnap.data()?.microsoft;
    
    if (microsoft?.enabled && microsoft?.appId && microsoft?.clientSecret) {
      clientId = microsoft.appId;
      clientSecret = microsoft.clientSecret;
      tenantId = microsoft.tenantId || tenantId;
    }
  } catch (e) {
    console.warn('[msGraphAppConfig] Could not fetch system/integrations from Firestore, falling back to ENV.');
  }

  if (!clientId || !clientSecret) {
    throw new Error('MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET must be configured for Application flows.');
  }

  const endpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const payload = new URLSearchParams({
    client_id: clientId,
    scope: 'https://graph.microsoft.com/.default',
    client_secret: clientSecret,
    grant_type: 'client_credentials'
  });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload.toString()
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[msGraphAppConfig] Failed to fetch application token:', text);
    throw new Error('Failed to retrieve MS Graph Application Token.');
  }

  const data = await res.json();
  return data.access_token;
}
