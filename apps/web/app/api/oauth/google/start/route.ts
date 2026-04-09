/**
 * /api/oauth/google/start/route.ts
 *
 * Initiates Google OAuth 2.0 Authorization Code flow (confidential client).
 *
 * NOTE: This is a server-side confidential client that uses client_secret.
 * PKCE is intentionally omitted — Google's policy rejects combining
 * code_challenge with client_secret (updated 2024/2025 policy).
 * The client_secret stored in env vars is the security guarantee here.
 *
 * Required environment variables:
 *   NEXT_PUBLIC_APP_URL  – canonical app URL
 *   GOOGLE_CLIENT_ID     – Google Cloud OAuth 2.0 Client ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { getGoogleOAuthConfig } from '@/lib/googleTokenRefresh';

const APP_URL   = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const REDIRECT  = `${APP_URL}/api/oauth/google/callback`;

const SCOPES = [
  'openid', 'email', 'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/calendar',
].join(' ');

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function GET(req: NextRequest) {
  const { clientId } = await getGoogleOAuthConfig();
  if (!clientId) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID not configured' }, { status: 503 });
  }

  const returnTo = req.nextUrl.searchParams.get('returnTo') ?? '/settings?section=mail';
  const uid      = req.nextUrl.searchParams.get('uid') ?? '';
  const state    = base64UrlEncode(randomBytes(32));

  const store = await cookies();
  store.set('g_oauth_state',  state,    { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  store.set('g_return_to',    returnTo, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  if (uid) {
    store.set('firebase_uid', uid,      { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  }

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  REDIRECT,
    response_type: 'code',
    scope:         SCOPES,
    state,
    access_type:   'offline',
    prompt:        'consent select_account',
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
