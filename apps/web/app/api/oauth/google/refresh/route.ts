/**
 * POST /api/oauth/google/refresh
 *
 * Server-side Google token refresh.
 * Body: { uid: string; idToken: string }
 * Returns: { accessToken: string; expiresAt: number }
 *
 * Can be called by the client to pre-emptively refresh a token
 * or by cron jobs for background refresh.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidGoogleToken, googleOAuthConfigured } from '@/lib/googleTokenRefresh';

export async function POST(req: NextRequest) {
  const { ok, missing } = await googleOAuthConfigured();
  if (!ok) {
    return NextResponse.json(
      { error: `Google OAuth not configured. Missing: ${missing.join(', ')}` },
      { status: 503 },
    );
  }

  try {
    const body     = await req.json().catch(() => ({}));
    const uid      = body.uid     as string | undefined;
    const idToken  = body.idToken as string | undefined;

    if (!uid || !idToken) {
      return NextResponse.json({ error: 'uid and idToken are required' }, { status: 400 });
    }

    const accessToken = await getValidGoogleToken(uid, idToken);
    return NextResponse.json({ accessToken, refreshed: true });
  } catch (err: any) {
    console.error('[/api/oauth/google/refresh]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
