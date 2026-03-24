/**
 * TEMPORARY DEBUG ENDPOINT — remove after investigation
 * GET /api/oauth/google/debug
 * Returns the exact OAuth URL that would be sent to Google (no redirect).
 */
import { NextResponse } from 'next/server';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '(not set)';
const APP_URL   = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const REDIRECT  = `${APP_URL}/api/oauth/google/callback`;

const SCOPES = [
  'openid', 'email', 'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/calendar',
].join(' ');

export async function GET() {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT,
    response_type: 'code',
    scope:         SCOPES,
    state:         'DEBUG_STATE',
    access_type:   'offline',
    prompt:        'consent select_account',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  return NextResponse.json({
    client_id_set:    CLIENT_ID !== '(not set)',
    client_id_prefix: CLIENT_ID.slice(0, 12) + '...',
    redirect_uri:     REDIRECT,
    scopes:           SCOPES.split(' '),
    full_auth_url:    authUrl,
    app_url_env:      APP_URL,
  }, { status: 200 });
}
