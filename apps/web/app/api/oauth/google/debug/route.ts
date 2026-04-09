/**
 * GET /api/oauth/google/debug
 * Returns OAuth configuration status without exposing secrets.
 * Keep this endpoint — it's useful for diagnosing Vercel env issues.
 */
import { NextResponse } from 'next/server';
import { googleOAuthConfigured, getGoogleOAuthConfig } from '@/lib/googleTokenRefresh';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function GET() {
  const { ok, missing, source } = await googleOAuthConfigured();
  const { clientId } = await getGoogleOAuthConfig();
  
  return NextResponse.json({
    configured:       ok,
    source,
    missing_vars:     missing,
    client_id_set:    !!clientId,
    client_id_prefix: clientId ? clientId.slice(0, 16) + '…' : '(not set)',
    redirect_uri:     `${APP_URL}/api/oauth/google/callback`,
    app_url:          APP_URL,
  });
}
