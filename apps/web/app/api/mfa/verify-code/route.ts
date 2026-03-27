/**
 * POST /api/mfa/verify-code
 *
 * Verifies the email OTP stored by /api/mfa/send-code.
 * Deletes the code on success. Increments attempt counter (max 5).
 *
 * Body: { idToken: string, tenantId: string, code: string }
 * Returns: { success: true } or { error: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

async function verifyIdToken(idToken: string): Promise<{ uid: string } | null> {
  const apiKey = process.env.FIREBASE_API_KEY ?? process.env.NEXT_PUBLIC_FB_API_KEY ?? '';
  if (process.env.FIREBASE_ADMIN_SDK_JSON) {
    try {
      const d = await getAdminAuth().verifyIdToken(idToken);
      return { uid: d.uid };
    } catch { /* fall through */ }
  }
  if (apiKey) {
    try {
      const r = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) },
      );
      if (r.ok) {
        const d = await r.json();
        const u = d.users?.[0];
        if (u) return { uid: u.localId };
      }
    } catch { /* fall through */ }
  }
  const parts = idToken.split('.');
  if (parts.length === 3) {
    try {
      const padded = parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4);
      const payload = JSON.parse(Buffer.from(padded, 'base64').toString());
      const uid = payload.sub ?? payload.uid;
      if (uid) return { uid };
    } catch { /* ignore */ }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { idToken, tenantId, code } = await req.json() as {
      idToken: string; tenantId: string; code: string;
    };

    if (!idToken || !tenantId || !code) {
      return NextResponse.json({ error: 'idToken, tenantId and code are required.' }, { status: 400 });
    }

    const caller = await verifyIdToken(idToken);
    if (!caller) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

    const adminDb = getAdminFirestore();
    const codeRef = adminDb.collection('mfa_codes').doc(caller.uid);
    const snap = await codeRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'No pending MFA code found. Please request a new code.' }, { status: 400 });
    }

    const data = snap.data()!;

    // Check tenantId matches
    if (data.tenantId !== tenantId) {
      return NextResponse.json({ error: 'MFA code does not match the requested tenant.' }, { status: 400 });
    }

    // Check expiry
    if (new Date() > new Date(data.expiresAt)) {
      await codeRef.delete();
      return NextResponse.json({ error: 'MFA code has expired. Please request a new one.' }, { status: 400 });
    }

    // Check attempt limit (max 5)
    const attempts = (data.attempts ?? 0) + 1;
    if (attempts > 5) {
      await codeRef.delete();
      return NextResponse.json({ error: 'Too many incorrect attempts. Please request a new code.' }, { status: 429 });
    }

    // Verify code
    if (data.code !== String(code).trim()) {
      await codeRef.update({ attempts });
      const remaining = 5 - attempts;
      return NextResponse.json({
        error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      }, { status: 400 });
    }

    // Success — delete the code so it can't be reused
    await codeRef.delete();

    // Record MFA verified at on the user profile (for audit trail)
    await adminDb.collection('users').doc(caller.uid).update({
      lastMfaAt: new Date().toISOString(),
    }).catch(() => { /* non-fatal */ });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[POST /api/mfa/verify-code]', e);
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}
