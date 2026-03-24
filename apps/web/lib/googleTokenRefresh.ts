/**
 * lib/googleTokenRefresh.ts
 *
 * Transparent Google OAuth token refresh.
 * Called before any Gmail/Calendar API call to ensure a valid access token.
 * Reads the integration record, refreshes if needed, writes back to Firestore.
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID ?? 'mfo-crm';
const TOKEN_URL  = 'https://oauth2.googleapis.com/token';

// ─── Firestore REST helpers ───────────────────────────────────────────────────

function fsUrl(path: string) {
  return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
}

function extractString(fields: any, key: string): string {
  return fields?.[key]?.stringValue ?? '';
}

function extractNumber(fields: any, key: string): number {
  return Number(fields?.[key]?.integerValue ?? fields?.[key]?.doubleValue ?? 0);
}

function toFsValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean')  return { booleanValue: val };
  if (typeof val === 'number')   return { integerValue: String(val) };
  if (typeof val === 'string')   return { stringValue: val };
  if (Array.isArray(val))        return { arrayValue: { values: val.map(toFsValue) } };
  if (typeof val === 'object')   return { mapValue: { fields: Object.fromEntries(Object.entries(val).map(([k, v]) => [k, toFsValue(v)])) } };
  return { stringValue: String(val) };
}

function toFsFields(obj: Record<string, any>) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toFsValue(v)]));
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface GoogleTokenInfo {
  accessToken:  string;
  refreshToken: string;
  expiresAt:    number;
  uid:          string;
  idToken:      string; // Firebase ID token — used for Firestore REST auth
}

/**
 * Read the integration record, refresh the access token if expired (within 5 min),
 * persist the new token to Firestore, and return the valid access token.
 *
 * @param uid       Firebase UID of the user
 * @param idToken   Firebase ID token (for Firestore REST auth)
 */
export async function getValidGoogleToken(uid: string, idToken: string): Promise<string> {
  // 1. Read integration record from Firestore
  const docRes = await fetch(fsUrl(`users/${uid}/integrations/google`), {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!docRes.ok) {
    throw new Error(`Failed to read Google integration: ${docRes.status}`);
  }

  const doc    = await docRes.json();
  const fields = doc.fields ?? {};

  const accessToken  = extractString(fields, '_accessToken');
  const refreshToken = extractString(fields, '_refreshToken');
  const expiresAt    = extractNumber(fields, '_expiresAt');

  // 2. If token is still valid (more than 5 min remaining), return as-is
  if (accessToken && expiresAt > Date.now() + 5 * 60 * 1000) {
    return accessToken;
  }

  if (!refreshToken) {
    const fieldKeys = Object.keys(fields).join(',');
    throw new Error(`No refresh token. (keys_in_doc: ${fieldKeys}, at: ${accessToken ? 'yes' : 'no'}, exp: ${expiresAt}, now: ${Date.now()}) User must re-connect Google.`);
  }

  // 3. Refresh the access token
  const refreshRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID     ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });

  if (!refreshRes.ok) {
    const err = await refreshRes.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  const refreshed     = await refreshRes.json();
  const newAccessToken = refreshed.access_token;
  const newExpiresAt   = Date.now() + (refreshed.expires_in ?? 3600) * 1000;

  // 4. Persist refreshed token back to Firestore
  await fetch(`${fsUrl(`users/${uid}/integrations/google`)}?updateMask.fieldPaths=_accessToken&updateMask.fieldPaths=_expiresAt`, {
    method:  'PATCH',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: toFsFields({ _accessToken: newAccessToken, _expiresAt: newExpiresAt }),
    }),
  });

  return newAccessToken;
}
