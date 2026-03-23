/**
 * /api/oauth/google/start/route.ts
 *
 * Initiates Google OAuth 2.0 PKCE Authorization Code flow.
 *
 * Required environment variables:
 *   NEXT_PUBLIC_APP_URL      – canonical app URL
 *   GOOGLE_CLIENT_ID         – Google Cloud OAuth 2.0 Client ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes, createHash } from 'crypto';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
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
  if (!CLIENT_ID) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID not configured' }, { status: 503 });
  }

  const returnTo  = req.nextUrl.searchParams.get('returnTo') ?? '/settings?section=mail';
  const verifier  = base64UrlEncode(randomBytes(32));
  const challenge = base64UrlEncode(
    Buffer.from(createHash('sha256').update(verifier).digest('hex'), 'hex')
  );
  const state = base64UrlEncode(randomBytes(16));

  const store = await cookies();
  store.set('g_pkce_verifier', verifier, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  store.set('g_oauth_state',   state,    { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  store.set('g_return_to',     returnTo, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });

  const params = new URLSearchParams({
    client_id:             CLIENT_ID,
    redirect_uri:          REDIRECT,
    response_type:         'code',
    scope:                 SCOPES,
    state,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    access_type:           'offline',
    prompt:                'consent select_account',
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
