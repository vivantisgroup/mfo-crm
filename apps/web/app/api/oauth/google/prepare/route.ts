/**
 * POST /api/oauth/google/prepare
 *
 * Accepts the user's Firebase ID token from the client, stores it in an
 * httpOnly cookie, then returns the Google OAuth authorization URL.
 *
 * This avoids passing the ID token in a GET query param (which would appear
 * in server logs). The ID token is used in the callback to write to Firestore
 * via the REST API, eliminating the need for a Firebase Admin service-account key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { getGoogleOAuthConfig } from '@/lib/googleTokenRefresh';

const APP_URL   = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const REDIRECT  = `${APP_URL}/api/oauth/google/callback`;

const SCOPES = [
  'openid', 'email', 'profile',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/calendar',
].join(' ');

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function POST(req: NextRequest) {
  const { clientId } = await getGoogleOAuthConfig();
  if (!clientId) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID not configured' }, { status: 503 });
  }

  let idToken: string;
  let returnTo: string;
  let uid: string;
  let tenantId: string;

  try {
    const body = await req.json();
    idToken  = body.idToken  ?? '';
    returnTo = body.returnTo ?? '/settings?section=mail';
    uid      = body.uid      ?? '';
    tenantId = body.tenantId ?? '';
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!idToken || !uid || !tenantId) {
    return NextResponse.json({ error: 'idToken, uid, and tenantId are required' }, { status: 400 });
  }

  const state = base64UrlEncode(randomBytes(32));

  const store = await cookies();
  store.set('g_oauth_state',  state,    { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  store.set('g_return_to',    returnTo, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  store.set('firebase_uid',   uid,      { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  store.set('oauth_tenant_id', tenantId, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  store.set('firebase_token', idToken,  { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  REDIRECT,
    response_type: 'code',
    scope:         SCOPES,
    state,
    access_type:   'offline',
    prompt:        'consent',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  return NextResponse.json({ authUrl });
}
