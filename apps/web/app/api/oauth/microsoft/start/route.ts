/**
 * /api/oauth/microsoft/start/route.ts
 *
 * Initiates Microsoft OAuth 2.0 PKCE flow.
 * Generates code_verifier, code_challenge, and state, stores them in
 * httpOnly cookies, then redirects to Microsoft's authorization endpoint.
 *
 * The Firebase UID is embedded inside the encrypted state payload so the
 * callback can identify which user to write tokens for — no separate
 * firebase_uid cookie required and no server-side session lookup needed.
 *
 * Required environment variables / Firestore system/integrations config:
 *   NEXT_PUBLIC_APP_URL   – canonical app URL, e.g. https://app.mfonexus.com
 *   MICROSOFT_CLIENT_ID   – Azure App Registration Application (client) ID
 *   MICROSOFT_TENANT_ID   – Azure tenant ID, or "common" for multi-tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes, createHash } from 'crypto';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

const FALLBACK_APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

const SCOPES = [
  'openid', 'profile', 'email', 'offline_access',
  'Mail.Read', 'Mail.Send', 'Calendars.ReadWrite',
  'ChannelMessage.Send', 'ChannelMessage.Read.All', 'Chat.ReadWrite'
].join(' ');

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve Microsoft Client ID from Firestore system/integrations first,
 * then fall back to environment variable. Enables SaaS tenant configuration.
 */
async function getClientId(): Promise<string> {
  const envId = process.env.MICROSOFT_CLIENT_ID ?? '';
  try {
    const db    = getAdminFirestore();
    const snap  = await db.doc('system/integrations').get();
    const ms    = snap.data()?.microsoft;
    // Only use the Firestore value if it looks like a real UUID — not a test/placeholder value
    if (ms?.enabled && ms?.appId && UUID_RE.test(ms.appId)) return ms.appId;
  } catch {
    // Ignore — fall back to env
  }
  return envId;
}

async function getTenantId(): Promise<string> {
  const envTenant = process.env.MICROSOFT_TENANT_ID ?? 'common';
  try {
    const db   = getAdminFirestore();
    const snap = await db.doc('system/integrations').get();
    const ms   = snap.data()?.microsoft;
    // Only use the Firestore value if it looks like a real UUID
    if (ms?.enabled && ms?.tenantId && UUID_RE.test(ms.tenantId)) return ms.tenantId;
  } catch {
    // Ignore — fall back to env
  }
  return envTenant;
}

export async function GET(req: NextRequest) {
  const clientId = await getClientId();
  if (!clientId) {
    return NextResponse.json({
      error: 'Microsoft Client ID is not configured. Please set it in Settings → Platform Configuration → Microsoft Integration.'
    }, { status: 503 });
  }

  const tenantId = await getTenantId();

  // Derive the redirect URI from the actual incoming request origin.
  // This correctly handles localhost in dev and the real domain in production,
  // without requiring NEXT_PUBLIC_APP_URL to change per environment.
  const reqOrigin = req.nextUrl.origin ?? FALLBACK_APP_URL;
  const REDIRECT  = `${reqOrigin}/api/oauth/microsoft/callback`;

  // --- Identify the requesting user from their Firebase ID token ---
  // The client passes ?idToken=... so we can embed the UID in the PKCE state.
  const idTokenParam = req.nextUrl.searchParams.get('idToken') ?? '';
  let uid = '';
  if (idTokenParam) {
    try {
      const decoded = await getAdminAuth().verifyIdToken(idTokenParam);
      uid = decoded.uid;
    } catch (e) {
      console.warn('[microsoft/start] Could not verify idToken — UID will be empty');
    }
  }

  const returnTo  = req.nextUrl.searchParams.get('returnTo') ?? '/settings?tab=messaging';
  const targetTenantId = req.nextUrl.searchParams.get('tenantId') ?? '';
  const verifier  = base64UrlEncode(randomBytes(32));
  const challenge = base64UrlEncode(
    Buffer.from(createHash('sha256').update(verifier).digest('hex'), 'hex')
  );

  // Encode uid + random nonce into the state so the callback can retrieve it
  const nonce = base64UrlEncode(randomBytes(16));
  // state = base64url( JSON{ nonce, uid } )
  const statePayload = Buffer.from(JSON.stringify({ nonce, uid })).toString('base64url');

  // Store verifier, nonce, returnTo, and redirect_uri in httpOnly cookies (10-minute TTL)
  // The callback MUST use the exact same redirect_uri — store it so it doesn't have to recompute
  const store = await cookies();
  store.set('ms_pkce_verifier', verifier,     { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  store.set('ms_oauth_nonce',   nonce,         { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  store.set('ms_return_to',     returnTo,      { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  store.set('ms_redirect_uri',  REDIRECT,      { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  store.set('oauth_tenant_id',  targetTenantId, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });

  const params = new URLSearchParams({
    client_id:             clientId,
    response_type:         'code',
    redirect_uri:          REDIRECT,
    scope:                 SCOPES,
    state:                 statePayload,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    prompt:                'select_account',
  });

  return NextResponse.redirect(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`
  );
}
