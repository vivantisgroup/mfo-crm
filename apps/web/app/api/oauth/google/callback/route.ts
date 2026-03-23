/**
 * /api/oauth/google/callback/route.ts
 *
 * Google OAuth callback — validates PKCE + state,
 * exchanges code, fetches profile, persists to Firestore.
 *
 * Required env vars (addition to start route):
 *   GOOGLE_CLIENT_SECRET   – OAuth 2.0 client secret from Google Cloud
 *   FIREBASE_ADMIN_SDK_JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     ?? '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
const APP_URL       = process.env.NEXT_PUBLIC_APP_URL  ?? 'http://localhost:3000';
const REDIRECT_URI  = `${APP_URL}/api/oauth/google/callback`;

export async function GET(req: NextRequest) {
  const url     = req.nextUrl;
  const code    = url.searchParams.get('code');
  const state   = url.searchParams.get('state');
  const errParm = url.searchParams.get('error');

  const store    = await cookies();
  const expected = store.get('g_oauth_state')?.value;
  const verifier = store.get('g_pkce_verifier')?.value;
  const returnTo = store.get('g_return_to')?.value ?? '/settings?section=mail';

  store.delete('g_oauth_state');
  store.delete('g_pkce_verifier');
  store.delete('g_return_to');

  if (errParm) {
    return NextResponse.redirect(`${APP_URL}${returnTo}&oauth_error=${encodeURIComponent(errParm)}`);
  }

  if (!code || !state || state !== expected || !verifier) {
    return NextResponse.redirect(`${APP_URL}${returnTo}&oauth_error=invalid_state`);
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
      code_verifier: verifier,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error('[google/callback] token exchange failed:', err);
    return NextResponse.redirect(`${APP_URL}${returnTo}&oauth_error=token_exchange_failed`);
  }

  const tokens = await tokenRes.json();

  // Fetch user profile
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = profileRes.ok ? await profileRes.json() : {};
  const connectedEmail = profile.email ?? 'unknown';

  const uid = store.get('firebase_uid')?.value;
  if (!uid) {
    return NextResponse.redirect(`${APP_URL}${returnTo}&oauth_error=not_authenticated`);
  }

  const adminDb = getAdminFirestore();
  await adminDb.doc(`users/${uid}/integrations/google`).set({
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
    _accessToken:    tokens.access_token,
    _refreshToken:   tokens.refresh_token ?? null,
    _expiresAt:      Date.now() + (tokens.expires_in ?? 3600) * 1000,
  }, { merge: true });

  return NextResponse.redirect(`${APP_URL}${returnTo}&oauth_success=google`);
}
