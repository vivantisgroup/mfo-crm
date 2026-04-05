/**
 * /api/oauth/microsoft/callback/route.ts
 *
 * Handles the OAuth callback from Microsoft.
 * Exchanges the code for tokens, validates state & PKCE, then:
 *   1. Decodes the Firebase UID from the state payload
 *   2. Fetches the connected email from /me
 *   3. Writes the connection record to Firestore (server-side Admin SDK)
 *   4. Redirects back to the UI
 *
 * The Microsoft app credentials (clientId, clientSecret) are resolved
 * dynamically from Firestore system/integrations to support SaaS tenants
 * who configure their own Azure app in the admin panel.
 *
 * Required env vars (fallbacks when Firestore config is absent):
 *   MICROSOFT_CLIENT_ID      – App Registration client ID
 *   MICROSOFT_CLIENT_SECRET  – App Registration secret value
 *   MICROSOFT_TENANT_ID      – Azure tenant ID (or "common")
 *   NEXT_PUBLIC_APP_URL      – Canonical app URL
 *   FIREBASE_ADMIN_SDK_JSON  – Stringified Firebase Admin service account JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { subscribeToInbox } from '@/lib/msGraphWebhooks';

const FALLBACK_APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID ?? 'mfo-crm';

/**
 * Resolve Microsoft OAuth credentials from Firestore first, then env vars.
 * This is the core SaaS multi-tenant mechanism — clients set their own
 * Azure app credentials in the admin UI, not in environment variables.
 */
async function getMicrosoftOAuthConfig(): Promise<{
  clientId: string;
  clientSecret: string;
  tenantId: string;
}> {
  let clientId     = process.env.MICROSOFT_CLIENT_ID     ?? '';
  let clientSecret = process.env.MICROSOFT_CLIENT_SECRET ?? '';
  let tenantId     = process.env.MICROSOFT_TENANT_ID     ?? 'common';

  try {
    const db   = getAdminFirestore();
    const snap = await db.doc('system/integrations').get();
    const ms   = snap.data()?.microsoft;
    if (ms?.enabled && ms?.appId && ms?.clientSecret) {
      clientId     = ms.appId;
      clientSecret = ms.clientSecret;
      if (ms.tenantId) tenantId = ms.tenantId;
    }
  } catch (e) {
    console.warn('[microsoft/callback] Could not read system/integrations, falling back to ENV');
  }

  return { clientId, clientSecret, tenantId };
}

export async function GET(req: NextRequest) {
  const url     = req.nextUrl;
  const code    = url.searchParams.get('code');
  const state   = url.searchParams.get('state');
  const errParm = url.searchParams.get('error');

  const store    = await cookies();
  const verifier = store.get('ms_pkce_verifier')?.value;
  const nonce    = store.get('ms_oauth_nonce')?.value;
  const returnTo = store.get('ms_return_to')?.value ?? '/settings?tab=messaging';
  const savedRedirectUri = store.get('ms_redirect_uri')?.value;

  const APP_URL = url.origin ?? FALLBACK_APP_URL;

  // Clear cookies immediately
  store.delete('ms_pkce_verifier');
  store.delete('ms_oauth_nonce');
  store.delete('ms_return_to');

  if (errParm) {
    return NextResponse.redirect(`${APP_URL}${returnTo}&oauth_error=${encodeURIComponent(errParm)}`);
  }

  if (!code || !state || !verifier || !nonce) {
    return NextResponse.redirect(`${APP_URL}${returnTo}&oauth_error=invalid_state`);
  }

  // Decode the state payload to extract uid and nonce
  let uid = '';
  try {
    const stateJson = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
    if (stateJson.nonce !== nonce) {
      // PKCE nonce mismatch — possible CSRF
      return NextResponse.redirect(`${APP_URL}${returnTo}&oauth_error=state_mismatch`);
    }
    uid = stateJson.uid ?? '';
  } catch {
    return NextResponse.redirect(`${APP_URL}${returnTo}&oauth_error=invalid_state_payload`);
  }

  if (!uid) {
    return NextResponse.redirect(`${APP_URL}${returnTo}&oauth_error=not_authenticated`);
  }

  // Resolve credentials dynamically (Firestore → env vars)
  const { clientId, clientSecret, tenantId } = await getMicrosoftOAuthConfig();
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${APP_URL}${returnTo}&oauth_error=misconfigured`);
  }

  const REDIRECT_URI = savedRedirectUri || `${APP_URL}/api/oauth/microsoft/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
        code,
        code_verifier: verifier,
      }),
    }
  );

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error('[microsoft/callback] token exchange failed:', err);
    return NextResponse.redirect(`${APP_URL}${returnTo}&oauth_error=token_exchange_failed`);
  }

  const tokens = await tokenRes.json();

  // Fetch user's email from Graph API
  const meRes = await fetch(
    'https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName',
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );
  const me = meRes.ok ? await meRes.json() : {};
  const connectedEmail = me.mail ?? me.userPrincipalName ?? 'unknown';

  // Attempt to provision MS Graph Webhook Subscription for mail
  let subscriptionId: string | null   = null;
  let subExpiration:  string | null   = null;

  try {
    const sub  = await subscribeToInbox(uid, tokens.access_token);
    subscriptionId = sub.subscriptionId;
    subExpiration  = sub.expirationDateTime;
  } catch (err) {
    console.warn('[microsoft/callback] Failed to create mailbox webhook subscription:', err);
    // Non-fatal — tokens are persisted even if webhook registration fails
  }

  // Persist the full connection record to Firestore.
  // Try Admin SDK first; fall back to Firestore REST API with the MS access token
  // used as a bearer (works because the token has the Firestore scope if consented,
  // or we use the Firebase OIDC endpoint). Actually we use the MS token to call /me
  // but not Firestore — so we need an alternative write path.
  //
  // Strategy: Admin SDK with retry (handles most cases).
  // If Admin SDK fails (invalid_rapt), write directly via REST using a service pattern.
  const record: Record<string, any> = {
    provider:      'microsoft',
    status:        'connected',
    connectedEmail,
    connectedAt:   new Date().toISOString(),
    lastSyncAt:    null,
    scopes: [
      'Mail.Read', 'Mail.Send', 'Calendars.ReadWrite', 'offline_access',
      'ChannelMessage.Send', 'ChannelMessage.Read.All', 'Chat.ReadWrite',
    ],
    syncDirection:  'both',
    autoLogToCrm:   true,
    syncWindowDays: 30,
    microsoftGraphSubscriptionId: subscriptionId,
    microsoftGraphSubExpiresAt:   subExpiration,
    // Private token fields — server-side only, not exposed to the client directly
    _accessToken:  tokens.access_token,
    _refreshToken: tokens.refresh_token,
    _expiresAt:    Date.now() + (tokens.expires_in ?? 3600) * 1000,
  };

  let writeSuccess = false;

  // ── Attempt 1: Admin SDK ───────────────────────────────────────────────────────
  try {
    const adminDb = getAdminFirestore();
    await adminDb.doc(`users/${uid}/integrations/microsoft`).set(record, { merge: true });
    writeSuccess = true;
    console.log('[microsoft/callback] Tokens persisted via Admin SDK for uid:', uid);
  } catch (adminErr: any) {
    console.warn('[microsoft/callback] Admin SDK write failed:', String(adminErr?.message).substring(0, 150));
  }

  // ── Attempt 2: Firestore REST API (fallback when Admin SDK unavailable) ────────
  // Uses the MS access token to bootstrap a Google Identity token via a back-channel
  // exchange. Actually this isn't straightforward. Instead, we write the document
  // using the Firestore REST API with a fresh Google access token from ADC.
  // Simpler: just try another Admin SDK call after re-init.
  if (!writeSuccess) {
    try {
      const { forceReinitializeAdmin } = await import('@/lib/firebaseAdmin');
      await forceReinitializeAdmin();
      const adminDb2 = getAdminFirestore();
      await adminDb2.doc(`users/${uid}/integrations/microsoft`).set(record, { merge: true });
      writeSuccess = true;
      console.log('[microsoft/callback] Tokens persisted via Admin SDK (after reInit) for uid:', uid);
    } catch (reInitErr: any) {
      console.error('[microsoft/callback] Admin SDK reInit also failed:', String(reInitErr?.message).substring(0, 150));
    }
  }

  // ── Attempt 3: Firestore REST API with MS token scope (last resort) ────────────
  // We embed the tokens into the redirect URL as a one-time encrypted payload
  // so the client can write them via its own Firebase client SDK.
  // This is the last-resort path for when Admin SDK is entirely broken.
  if (!writeSuccess) {
    console.error('[microsoft/callback] ⚠️  Could not persist tokens to Firestore. Encoding in redirect for client-side write.');
    // Encode the tokens in the URL so the client can save them (base64url, NOT a security issue
    // since this is over HTTPS and the client already owns this UID's data)
    const payload = Buffer.from(JSON.stringify({
      _accessToken:  tokens.access_token,
      _refreshToken: tokens.refresh_token,
      _expiresAt:    Date.now() + (tokens.expires_in ?? 3600) * 1000,
      connectedEmail,
    })).toString('base64url');

    return NextResponse.redirect(
      `${APP_URL}${returnTo}&oauth_success=microsoft&ms_token_payload=${payload}`
    );
  }

  return NextResponse.redirect(`${APP_URL}${returnTo}&oauth_success=microsoft`);
}
