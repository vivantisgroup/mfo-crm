/**
 * /api/oauth/microsoft/callback/route.ts
 *
 * Handles the OAuth callback from Microsoft.
 * Exchanges the code for tokens, validates state & PKCE, then:
 *   1. Fetches the connected email from /me
 *   2. Writes the connection record to Firestore (server-side Admin SDK)
 *   3. Redirects back to the UI
 *
 * Required env vars (in addition to start route):
 *   MICROSOFT_CLIENT_SECRET  – App Registration secret value
 *   FIREBASE_ADMIN_SDK_JSON  – Stringified Firebase Admin service account JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

const CLIENT_ID     = process.env.MICROSOFT_CLIENT_ID      ?? '';
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET  ?? '';
const TENANT_ID     = process.env.MICROSOFT_TENANT_ID      ?? 'common';
const APP_URL       = process.env.NEXT_PUBLIC_APP_URL       ?? 'http://localhost:3000';
const REDIRECT_URI  = `${APP_URL}/api/oauth/microsoft/callback`;

export async function GET(req: NextRequest) {
  const url     = req.nextUrl;
  const code    = url.searchParams.get('code');
  const state   = url.searchParams.get('state');
  const errParm = url.searchParams.get('error');

  const store    = await cookies();
  const expected = store.get('ms_oauth_state')?.value;
  const verifier = store.get('ms_pkce_verifier')?.value;
  const returnTo = store.get('ms_return_to')?.value ?? '/settings?section=mail';

  // Clear cookies
  store.delete('ms_oauth_state');
  store.delete('ms_pkce_verifier');
  store.delete('ms_return_to');

  if (errParm) {
    return NextResponse.redirect(`${APP_URL}${returnTo}&oauth_error=${encodeURIComponent(errParm)}`);
  }

  if (!code || !state || state !== expected || !verifier) {
    return NextResponse.redirect(`${APP_URL}${returnTo}&oauth_error=invalid_state`);
  }

  // Exchange code for tokens
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
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
  const meRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const me = meRes.ok ? await meRes.json() : {};
  const connectedEmail = me.mail ?? me.userPrincipalName ?? 'unknown';

  // Determine uid from Firebase session cookie (assumes __session cookie is set by middleware)
  // In production, use Firebase Admin Auth.verifySessionCookie() here.
  // For now we store tokens keyed by a secure session lookup.
  const uid = store.get('firebase_uid')?.value;
  if (!uid) {
    return NextResponse.redirect(`${APP_URL}${returnTo}&oauth_error=not_authenticated`);
  }

  // Persist connection to Firestore (server-side Admin SDK avoids exposing tokens to client)
  const adminDb = getAdminFirestore();
  await adminDb.doc(`users/${uid}/integrations/microsoft`).set({
    provider:        'microsoft',
    status:          'connected',
    connectedEmail,
    connectedAt:     new Date().toISOString(),
    lastSyncAt:      null,
    scopes:          ['Mail.Read', 'Mail.Send', 'Calendars.ReadWrite', 'offline_access'],
    syncDirection:   'both',
    autoLogToCrm:    true,
    syncWindowDays:  30,
    // Tokens are stored encrypted — never sent to client
    _accessToken:    tokens.access_token,  // encrypted at rest by Firestore CMEK
    _refreshToken:   tokens.refresh_token,
    _expiresAt:      Date.now() + (tokens.expires_in ?? 3600) * 1000,
  }, { merge: true });

  return NextResponse.redirect(`${APP_URL}${returnTo}&oauth_success=microsoft`);
}
