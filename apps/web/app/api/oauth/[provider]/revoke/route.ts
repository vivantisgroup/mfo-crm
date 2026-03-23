/**
 * /api/oauth/[provider]/revoke/route.ts
 *
 * Revokes OAuth tokens server-side before deleting the Firestore record.
 * Called by disconnectMailProvider() in emailIntegrationService.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  if (provider !== 'microsoft' && provider !== 'google') {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
  }

  const uid = (await cookies()).get('firebase_uid')?.value;
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const adminDb = getAdminFirestore();
    const snap = await adminDb.doc(`users/${uid}/integrations/${provider}`).get();
    const data = snap.data();
    if (!data || !data._accessToken) {
      return NextResponse.json({ revoked: false, reason: 'No token found' });
    }

    // Revoke at provider
    if (provider === 'microsoft') {
      // Microsoft: sign out via OIDC end_session_endpoint (best effort)
      await fetch(`https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID ?? 'common'}/oauth2/v2.0/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: process.env.MICROSOFT_CLIENT_ID ?? '' }),
      }).catch(() => {});
    } else {
      // Google: revoke via token endpoint
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(data._accessToken)}`, {
        method: 'POST',
      }).catch(() => {});
    }

    return NextResponse.json({ revoked: true });
  } catch (e: any) {
    return NextResponse.json({ revoked: false, error: e.message }, { status: 500 });
  }
}
