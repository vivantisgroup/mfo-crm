/**
 * /api/oauth/google/callback/route.ts
 *
 * Google OAuth callback — validates state, exchanges code for tokens,
 * fetches Google profile, and persists the connection to Firestore
 * via the Firestore REST API (no Admin SDK / service-account key required).
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   NEXT_PUBLIC_APP_URL
 *   NEXT_PUBLIC_PROJECT_ID  (Firebase project ID — used for Firestore REST URL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getGoogleOAuthConfig } from '@/lib/googleTokenRefresh';

const APP_URL       = process.env.NEXT_PUBLIC_APP_URL     ?? 'http://localhost:3000';
const PROJECT_ID    = process.env.NEXT_PUBLIC_PROJECT_ID  ?? 'mfo-crm';
const REDIRECT_URI  = `${APP_URL}/api/oauth/google/callback`;


// ─── Firestore REST helpers ───────────────────────────────────────────────────

/** Convert a plain JS value to a Firestore REST API value object. */
function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean')  return { booleanValue: val };
  if (typeof val === 'number')   return { integerValue: String(val) };
  if (typeof val === 'string')   return { stringValue: val };
  if (Array.isArray(val))        return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === 'object')   return { mapValue: { fields: toFirestoreFields(val) } };
  return { stringValue: String(val) };
}

function toFirestoreFields(obj: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, toFirestoreValue(v)])
  );
}

/**
 * Write a document to Firestore using the REST API with the user's
 * Firebase ID token (no Admin SDK needed).
 */
async function writeFirestoreDoc(
  idToken:  string,
  docPath:  string,
  data:     Record<string, any>,
): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`;
  const res = await fetch(url, {
    method:  'PATCH',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ 
      name: `projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`,
      fields: toFirestoreFields(data) 
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firestore write failed (${res.status}): ${body}`);
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const url     = req.nextUrl;
  const code    = url.searchParams.get('code');
  const state   = url.searchParams.get('state');
  const errParm = url.searchParams.get('error');

  const store    = await cookies();
  const expected = store.get('g_oauth_state')?.value;
  const returnTo = store.get('g_return_to')?.value ?? '/settings?section=mail';

  // Clean up state cookies immediately
  store.delete('g_oauth_state');
  store.delete('g_return_to');

  if (errParm) {
    return NextResponse.redirect(`${APP_URL}${returnTo}&oauth_error=${encodeURIComponent(errParm)}`);
  }

  if (!code || !state || state !== expected) {
    return NextResponse.redirect(`${APP_URL}${returnTo}&oauth_error=invalid_state`);
  }

  try {
    const separator = returnTo.includes('?') ? '&' : '?';

    const { clientId, clientSecret } = await getGoogleOAuthConfig();

    // 1. Exchange code for Google tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('[google/callback] token exchange failed:', err);
      return NextResponse.redirect(`${APP_URL}${returnTo}${separator}oauth_error=token_exchange_failed`);
    }

    const tokens = await tokenRes.json();

    // 2. Fetch Google user profile
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile        = profileRes.ok ? await profileRes.json() : {};
    const connectedEmail = profile.email ?? 'unknown';

    // 3. Read and clean auth cookies
    const uid      = store.get('firebase_uid')?.value;
    const idToken  = store.get('firebase_token')?.value;
    const tenantId = store.get('oauth_tenant_id')?.value;
    store.delete('firebase_uid');
    store.delete('firebase_token');
    store.delete('oauth_tenant_id');

    if (!uid || !idToken || !tenantId) {
      return NextResponse.redirect(`${APP_URL}${returnTo}${separator}oauth_error=not_authenticated_or_no_tenant`);
    }

    // 4a. If Google didn't return a refresh_token (normal on repeat consent),
    //     read & preserve the existing one from Firestore so we never overwrite with null.
    //     Google only sends refresh_token on the VERY FIRST authorization (or after revoke).
    let refreshTokenToStore = tokens.refresh_token ?? null;
    if (!refreshTokenToStore) {
      try {
        const existing = await fetch(
          `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/tenants/${tenantId}/members/${uid}/integrations/google`,
          { headers: { Authorization: `Bearer ${idToken}` } }
        );
        if (existing.ok) {
          const doc = await existing.json();
          refreshTokenToStore = doc.fields?._refreshToken?.stringValue ?? null;
        }
      } catch {
        // ignore — we'll store null and user will need to revoke+reconnect
      }
    }

    // 4c. Setup Google Pub/Sub Webhook Watch
    let initialHistoryId = null;
    try {
      const watchRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          labelIds: ['INBOX', 'SENT'],
          topicName: `projects/${PROJECT_ID}/topics/gmail-sync-topic`,
        }),
      });
      if (watchRes.ok) {
        const watchData = await watchRes.json();
        initialHistoryId = watchData.historyId;
      } else {
        console.warn('[google/callback] Gmail watch failed. Make sure Pub/Sub topic privileges are set.', await watchRes.text());
      }
    } catch (err) {
      console.error('[google/callback] Failed to invoke Gmail watch:', err);
    }

    // 4b. Persist integration record via Firestore REST API (no Admin SDK required)
    await writeFirestoreDoc(idToken, `tenants/${tenantId}/members/${uid}/integrations/google`, {
      provider:        'google',
      status:          'connected',
      connectedEmail,
      connectedAt:     new Date().toISOString(),
      lastSyncAt:      null,
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/calendar',
      ],
      syncDirection:   'both',
      autoLogToCrm:    true,
      syncWindowDays:  30,
      latestHistoryId: initialHistoryId,
      _accessToken:    tokens.access_token,
      _refreshToken:   refreshTokenToStore,
      _expiresAt:      Date.now() + (tokens.expires_in ?? 3600) * 1000,
    });

    return NextResponse.redirect(`${APP_URL}${returnTo}${separator}oauth_success=google`);
  } catch (err: any) {
    console.error('[google/callback] fatal error:', err?.message ?? err);
    // Best effort on separator if we caught early
    const sep = returnTo.includes('?') ? '&' : '?';
    return NextResponse.redirect(
      `${APP_URL}${returnTo}${sep}oauth_error=${encodeURIComponent(err?.message ?? 'server_error')}`
    );
  }
}
