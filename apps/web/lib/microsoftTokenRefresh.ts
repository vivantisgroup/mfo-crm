/**
 * lib/microsoftTokenRefresh.ts
 *
 * Server-only Microsoft OAuth token refresh helper.
 * Imported ONLY by API routes. Never imported by client components.
 *
 * Strategy:
 *   1. Try Firebase Admin SDK (fastest, safest, no encoding issues)
 *   2. If Admin SDK fails (e.g. invalid_rapt ADC expiry in local dev),
 *      fall back to Firestore REST API using the user's idToken.
 *
 * Microsoft OAuth credentials are resolved dynamically:
 *   Priority: Firestore system/integrations > environment variables
 *   This enables SaaS multi-tenant deployments where clients configure
 *   their own Azure app registration in the admin panel.
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID ?? 'mfo-crm';

// ─── Firestore REST API helpers (fallback when Admin SDK is unavailable) ───────

function fsDocUrl(path: string) {
  return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
}

function extractStringFromField(field: any): string {
  return field?.stringValue ?? '';
}

function extractNumberFromField(field: any): number {
  return Number(field?.integerValue ?? field?.doubleValue ?? 0);
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

// ─── Credential resolution ────────────────────────────────────────────────────

/**
 * Resolves the active Microsoft OAuth credentials.
 * Priority: Firestore system/integrations > environment variables.
 * Works with both Admin SDK and a plain idToken for Firestore access.
 */
async function getMicrosoftCredentials(idToken?: string): Promise<{
  clientId: string;
  clientSecret: string;
  tenantId: string;
  tokenUrl: string;
}> {
  let clientId     = process.env.MICROSOFT_CLIENT_ID     ?? '';
  let clientSecret = process.env.MICROSOFT_CLIENT_SECRET ?? '';
  let tenantId     = process.env.MICROSOFT_TENANT_ID     ?? 'common';

  // Try Admin SDK first
  try {
    const { getAdminFirestore } = await import('@/lib/firebaseAdmin');
    const db   = getAdminFirestore();
    const snap = await db.doc('system/integrations').get();
    const ms   = snap.data()?.microsoft;
    if (ms?.enabled && ms?.appId && ms?.clientSecret) {
      clientId     = ms.appId;
      clientSecret = ms.clientSecret;
      if (ms.tenantId) tenantId = ms.tenantId;
    }
  } catch {
    // Admin SDK failed — try Firestore REST API with idToken
    if (idToken) {
      try {
        const res = await fetch(fsDocUrl('system/integrations'), {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (res.ok) {
          const doc = await res.json();
          const ms  = doc.fields?.microsoft?.mapValue?.fields ?? doc.fields?.microsoft;
          if (ms) {
            const fsClientId     = extractStringFromField(ms?.appId);
            const fsClientSecret = extractStringFromField(ms?.clientSecret);
            const fsTenantId     = extractStringFromField(ms?.tenantId);
            const enabled        = ms?.enabled?.booleanValue ?? false;
            if (enabled && fsClientId && fsClientSecret) {
              clientId     = fsClientId;
              clientSecret = fsClientSecret;
              if (fsTenantId) tenantId = fsTenantId;
            }
          }
        }
      } catch {
        console.warn('[microsoftTokenRefresh] Could not fetch system/integrations via REST API either.');
      }
    }
  }

  if (!clientId || !clientSecret) {
    throw new Error(
      'Microsoft OAuth is not configured. ' +
      'Please set your Azure App credentials in Settings → Platform Configuration → Microsoft Integration, ' +
      'or provide MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET environment variables.'
    );
  }

  return {
    clientId,
    clientSecret,
    tenantId,
    tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
  };
}

// ─── Token record readers ──────────────────────────────────────────────────────

interface TokenRecord {
  accessToken:  string;
  refreshToken: string;
  expiresAt:    number;
}

/** Read token record via Firebase Admin SDK */
async function readTokenViaAdmin(uid: string): Promise<TokenRecord> {
  const { getAdminFirestore, forceReinitializeAdmin } = await import('@/lib/firebaseAdmin');
  
  // Retry once on ADC rotation errors (invalid_rapt / invalid_grant)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const db   = getAdminFirestore();
      const snap = await db.doc(`users/${uid}/integrations/microsoft`).get();
      if (!snap.exists) {
        throw new Error(
          `No Microsoft integration found for user ${uid}. ` +
          'Please connect your Microsoft account in Settings → Messaging Sync.'
        );
      }
      const d = snap.data()!;
      return {
        accessToken:  (d._accessToken  as string) ?? '',
        refreshToken: (d._refreshToken as string) ?? '',
        expiresAt:    (d._expiresAt    as number) ?? 0,
      };
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      const isAdcRotation =
        msg.includes('invalid_rapt')   ||
        msg.includes('invalid_grant')  ||
        msg.includes('UNKNOWN')        ||
        msg.includes('metadata from plugin');
      if (isAdcRotation && attempt === 0) {
        console.warn('[microsoftTokenRefresh] Admin SDK ADC rotation detected, reinitialising...', msg.substring(0, 150));
        await forceReinitializeAdmin();
        continue;
      }
      throw err; // propagate on second attempt or non-ADC errors
    }
  }
  throw new Error('Admin SDK failed after reinitialisation.');
}

/** Read token record via Firestore REST API (fallback) */
async function readTokenViaRest(uid: string, idToken: string): Promise<TokenRecord> {
  const url = fsDocUrl(`users/${uid}/integrations/microsoft`);
  console.log('[microsoftTokenRefresh] REST fallback URL:', url.replace(/firestore.*documents\//, 'fs://'));
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error('[microsoftTokenRefresh] REST read failed:', res.status, errText.substring(0, 500));
    throw new Error(`Firestore REST read failed (${res.status}): ${errText.substring(0, 200)}`);
  }
  const doc    = await res.json();
  const fields = doc.fields ?? {};
  console.log('[microsoftTokenRefresh] REST fields found:', Object.keys(fields).join(', '));
  return {
    accessToken:  extractStringFromField(fields._accessToken),
    refreshToken: extractStringFromField(fields._refreshToken),
    expiresAt:    extractNumberFromField(fields._expiresAt),
  };
}

/** Write refreshed tokens back (Admin SDK preferred, REST fallback) */
async function writeTokenViaAdmin(uid: string, accessToken: string, refreshToken: string, expiresAt: number): Promise<void> {
  try {
    const { getAdminFirestore } = await import('@/lib/firebaseAdmin');
    const db = getAdminFirestore();
    await db.doc(`users/${uid}/integrations/microsoft`).set(
      { _accessToken: accessToken, _expiresAt: expiresAt, _refreshToken: refreshToken },
      { merge: true }
    );
  } catch {
    // Silently swallow write errors — the next request will refresh again
    console.warn('[microsoftTokenRefresh] Could not persist refreshed token via Admin SDK.');
  }
}

async function writeTokenViaRest(uid: string, idToken: string, accessToken: string, refreshToken: string, expiresAt: number): Promise<void> {
  try {
    await fetch(
      `${fsDocUrl(`users/${uid}/integrations/microsoft`)}?updateMask.fieldPaths=_accessToken&updateMask.fieldPaths=_expiresAt&updateMask.fieldPaths=_refreshToken`,
      {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: toFsFields({ _accessToken: accessToken, _expiresAt: expiresAt, _refreshToken: refreshToken }),
        }),
      }
    );
  } catch {
    console.warn('[microsoftTokenRefresh] Could not persist refreshed token via REST API.');
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns a valid Microsoft access token for the given user.
 *
 * Dual-path design:
 *   1. Admin SDK → fast, no encoding issues, resilient with retry
 *   2. Firestore REST API with idToken → fallback for local dev ADC failures
 *
 * @param uid     Firebase UID of the user
 * @param idToken Firebase ID token (used as REST fallback when Admin SDK unavailable)
 */
export async function getValidMicrosoftToken(uid: string, idToken?: string): Promise<string> {
  let record: TokenRecord;
  let useAdmin = true;

  // ── Step 1: Read the stored token record ──────────────────────────────────
  try {
    record = await readTokenViaAdmin(uid);
  } catch (adminErr: any) {
    const isAdcErr =
      String(adminErr?.message ?? adminErr).includes('invalid_rapt') ||
      String(adminErr?.message ?? adminErr).includes('invalid_grant') ||
      String(adminErr?.message ?? adminErr).includes('metadata from plugin');

    if (isAdcErr && idToken) {
      console.warn('[microsoftTokenRefresh] Admin SDK unavailable (ADC), falling back to Firestore REST API');
      useAdmin = false;
      try {
        record = await readTokenViaRest(uid, idToken);
      } catch (restErr: any) {
        throw new Error(
          `Microsoft token read failed (both Admin SDK and REST API). ` +
          `Admin: ${String(adminErr?.message).substring(0, 100)} | ` +
          `REST: ${String(restErr?.message).substring(0, 100)}`
        );
      }
    } else {
      throw adminErr;
    }
  }

  // ── Step 2: Return cached token if still valid ────────────────────────────
  if (record.accessToken && record.expiresAt > Date.now() + 5 * 60 * 1000) {
    return record.accessToken;
  }

  // ── Step 3: Refresh if expired ────────────────────────────────────────────
  if (!record.refreshToken) {
    throw new Error(
      'Microsoft access token expired and no refresh token is stored. ' +
      'Please re-authorize the Microsoft integration in Settings → Messaging Sync.'
    );
  }

  const creds = await getMicrosoftCredentials(idToken);

  const refreshRes = await fetch(creds.tokenUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: record.refreshToken,
      grant_type:    'refresh_token',
    }),
  });

  if (!refreshRes.ok) {
    const errText = await refreshRes.text();
    throw new Error(`Token refresh failed: ${errText}`);
  }

  const refreshed      = await refreshRes.json();
  const newAccessToken = refreshed.access_token as string;
  const newRefresh     = refreshed.refresh_token || record.refreshToken;
  const newExpiresAt   = Date.now() + (refreshed.expires_in ?? 3600) * 1000;

  if (!newAccessToken) throw new Error('Microsoft returned an empty access token on refresh.');

  // ── Step 4: Persist the refreshed tokens ──────────────────────────────────
  if (useAdmin) {
    await writeTokenViaAdmin(uid, newAccessToken, newRefresh, newExpiresAt);
  } else if (idToken) {
    await writeTokenViaRest(uid, idToken, newAccessToken, newRefresh, newExpiresAt);
  }

  return newAccessToken;
}
