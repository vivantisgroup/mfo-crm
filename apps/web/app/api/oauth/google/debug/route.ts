/**
 * GET /api/oauth/google/debug
 * Returns OAuth configuration status without exposing secrets.
 * Keep this endpoint — it's useful for diagnosing Vercel env issues.
 */
import { NextResponse } from 'next/server';
import { googleOAuthConfigured } from '@/lib/googleTokenRefresh';

const APP_URL  = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';

export async function GET() {
  const { ok, missing } = googleOAuthConfigured();
  return NextResponse.json({
    configured:       ok,
    missing_vars:     missing,
    client_id_set:    !!CLIENT_ID,
    client_id_prefix: CLIENT_ID ? CLIENT_ID.slice(0, 16) + '…' : '(not set)',
    redirect_uri:     `${APP_URL}/api/oauth/google/callback`,
    app_url:          APP_URL,
  });
}
