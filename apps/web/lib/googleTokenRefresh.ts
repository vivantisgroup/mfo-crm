/**
 * lib/googleTokenRefresh.ts
 *
 * Server-only Google OAuth token refresh helper.
 * Imported ONLY by API routes (/api/mail/sync, /api/mail/test, /api/oauth/google/refresh).
 * Never imported by client components.
 *
 * Reads/refreshes/persists the Google access token via Firestore REST API.
 * Requires env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (server-only, no NEXT_PUBLIC_).
 */

const PROJECT_ID    = process.env.NEXT_PUBLIC_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID ?? 'mfo-crm';
const TOKEN_URL     = 'https://oauth2.googleapis.com/token';

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

// ─── Configuration Manager ──────────────────────────────────────────────────────

export async function getGoogleOAuthConfig(): Promise<{ clientId: string; clientSecret: string }> {
  let clientId     = process.env.GOOGLE_CLIENT_ID     || '';
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

  try {
    const { getAdminFirestore } = await import('@/lib/firebaseAdmin');
    const db = getAdminFirestore();
    const docSnap = await db.doc('system/integrations').get();
    const goog = docSnap.data()?.google;
    if (goog && goog.enabled) {
      if (goog.clientId) clientId = goog.clientId;
      if (goog.clientSecret) clientSecret = goog.clientSecret;
    }
  } catch (err: any) {
    console.warn('[getGoogleOAuthConfig] Admin SDK config read failed (falling back to env if available):', err.message);
  }

  return { clientId, clientSecret };
}

function assertGoogleCredentials(clientId: string, clientSecret: string): void {
  if (!clientId || !clientSecret) {
    throw new Error(
      `Google OAuth not configured. Save credentials in Platform Settings -> Communications, or set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET environment variables.`
    );
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface GoogleTokenInfo {
  accessToken:  string;
  refreshToken: string;
  expiresAt:    number;
  uid:          string;
}

/**
 * Read the integration record, refresh the access token if expired (within 5 min),
 * persist the new token to Firestore, and return the valid access token.
 *
 * @param uid       Firebase UID of the user
 * @param idToken   Firebase ID token (for Firestore REST auth)
 */
export async function getValidGoogleToken(uid: string, idToken: string, tenantId?: string): Promise<string> {
  const effectiveTenant = tenantId || 'platform';
  
  // 0. Fetch config and guard
  const { clientId, clientSecret } = await getGoogleOAuthConfig();
  assertGoogleCredentials(clientId, clientSecret);

  const docRes = await fetch(fsUrl(`tenants/${effectiveTenant}/members/${uid}/integrations/google`), {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!docRes.ok) {
    throw new Error(`Failed to read Google integration record: HTTP ${docRes.status}. The user may not have connected their Google account yet.`);
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

  // 3. No refresh token — user must re-connect
  if (!refreshToken) {
    throw new Error(
      'Google access token expired and no refresh token is stored. ' +
      'Please disconnect and re-connect your Google account.'
    );
  }

  // 4. Refresh the access token via Google's token endpoint
  const refreshRes = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });

  if (!refreshRes.ok) {
    const errText = await refreshRes.text();
    let parsed: any = {};
    try { parsed = JSON.parse(errText); } catch {}
    // Surface actionable error for the most common refresh failures
    const desc = parsed.error_description ?? parsed.error ?? errText;
    throw new Error(`Token refresh failed: ${desc}`);
  }

  const refreshed      = await refreshRes.json();
  const newAccessToken = refreshed.access_token as string;
  const newExpiresAt   = Date.now() + (refreshed.expires_in ?? 3600) * 1000;

  if (!newAccessToken) {
    throw new Error('Google returned an empty access token — please re-connect your Google account.');
  }

  // 5. Persist refreshed token back to Firestore (field-level update — never wipes refresh_token)
  const patchRes = await fetch(
    `${fsUrl(`tenants/${effectiveTenant}/members/${uid}/integrations/google`)}?updateMask.fieldPaths=_accessToken&updateMask.fieldPaths=_expiresAt`,
    {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: toFsFields({ _accessToken: newAccessToken, _expiresAt: newExpiresAt }),
      }),
    }
  );

  if (!patchRes.ok) {
    // Non-fatal — we have the token, log the failure but still return it
    const body = await patchRes.text().catch(() => '');
    console.warn(`[getValidGoogleToken] Failed to persist refreshed token: ${patchRes.status} ${body}`);
  }

  return newAccessToken;
}

// ─── Config check utility (used by /api/oauth/google/debug) ──────────────────

export async function googleOAuthConfigured(): Promise<{ ok: boolean; missing: string[]; source: string }> {
  try {
    const { getAdminFirestore } = await import('@/lib/firebaseAdmin');
    const db = getAdminFirestore();
    const docSnap = await db.doc('system/integrations').get();
    const goog = docSnap.data()?.google;
    if (goog && goog.enabled && goog.clientId && goog.clientSecret) {
      return { ok: true, missing: [], source: 'database' };
    }
  } catch {}

  const missing: string[] = [];
  if (!process.env.GOOGLE_CLIENT_ID)     missing.push('GOOGLE_CLIENT_ID');
  if (!process.env.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET');
  return { ok: missing.length === 0, missing, source: 'env' };
}
