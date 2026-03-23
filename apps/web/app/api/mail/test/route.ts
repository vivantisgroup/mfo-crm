/**
 * /api/mail/test/route.ts
 *
 * Tests an existing mail connection by making a lightweight API call.
 * POST body: { provider: 'microsoft' | 'google' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  const uid = (await cookies()).get('firebase_uid')?.value;
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { provider } = await req.json() as { provider: string };

  const adminDb = getAdminFirestore();
  const connSnap = await adminDb.doc(`users/${uid}/integrations/${provider}`).get();
  const conn = connSnap.data();

  if (!conn || conn.status !== 'connected') {
    return NextResponse.json({ ok: false, error: 'Not connected' }, { status: 400 });
  }

  const token = conn._accessToken as string;
  const start = Date.now();

  try {
    let res: Response;
    if (provider === 'microsoft') {
      res = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,displayName', {
        headers: { Authorization: `Bearer ${token}` },
      });
    } else {
      res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    if (res.ok) {
      const data = await res.json();
      const latency = Date.now() - start;
      const email = data.mail ?? data.emailAddress ?? data.email ?? 'unknown';
      return NextResponse.json({
        ok:      true,
        latency,
        details: `✅ Connected as ${email} · ${latency}ms round-trip`,
      });
    } else {
      return NextResponse.json({
        ok:      false,
        latency: Date.now() - start,
        details: `Token rejected by provider (HTTP ${res.status}) — try reconnecting`,
      });
    }
  } catch (e: any) {
    return NextResponse.json({
      ok:      false,
      latency: Date.now() - start,
      details: `Network error: ${e.message}`,
    }, { status: 502 });
  }
}
