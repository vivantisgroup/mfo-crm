/**
 * /api/oauth/microsoft/start/route.ts
 *
 * Initiates Microsoft OAuth 2.0 PKCE flow.
 * Generates code_verifier, code_challenge, and state, stores them in an
 * httpOnly cookie, then redirects to Microsoft's authorization endpoint.
 *
 * Required environment variables:
 *   NEXT_PUBLIC_APP_URL          – canonical app URL, e.g. https://app.mfonexus.com
 *   MICROSOFT_CLIENT_ID          – Azure App Registration Application (client) ID
 *   MICROSOFT_TENANT_ID          – Azure tenant ID, or "common" for multi-tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes, createHash } from 'crypto';

const CLIENT_ID  = process.env.MICROSOFT_CLIENT_ID  ?? '';
const TENANT_ID  = process.env.MICROSOFT_TENANT_ID  ?? 'common';
const APP_URL    = process.env.NEXT_PUBLIC_APP_URL   ?? 'http://localhost:3000';
const REDIRECT   = `${APP_URL}/api/oauth/microsoft/callback`;

const SCOPES = [
  'openid', 'profile', 'email', 'offline_access',
  'Mail.Read', 'Mail.Send', 'Calendars.ReadWrite',
].join(' ');

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function GET(req: NextRequest) {
  if (!CLIENT_ID) {
    return NextResponse.json({ error: 'MICROSOFT_CLIENT_ID not configured' }, { status: 503 });
  }

  const returnTo   = req.nextUrl.searchParams.get('returnTo') ?? '/settings?section=mail';
  const verifier   = base64UrlEncode(randomBytes(32));
  const challenge  = base64UrlEncode(
    Buffer.from(createHash('sha256').update(verifier).digest('hex'), 'hex')
  );
  const state = base64UrlEncode(randomBytes(16));

  // Store in short-lived cookies (10 min TTL)
  const store = await cookies();
  store.set('ms_pkce_verifier', verifier, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  store.set('ms_oauth_state',   state,    { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  store.set('ms_return_to',     returnTo, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });

  const params = new URLSearchParams({
    client_id:             CLIENT_ID,
    response_type:         'code',
    redirect_uri:          REDIRECT,
    scope:                 SCOPES,
    state,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    prompt:                'select_account',
  });

  return NextResponse.redirect(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?${params}`
  );
}
