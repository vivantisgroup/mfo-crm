/**
 * GET /api/admin/my-tenants
 *
 * Returns the list of tenant IDs the authenticated user belongs to,
 * by querying tenants/{tenantId}/members/{uid} across all tenants.
 *
 * Uses the Firebase Admin SDK (bypasses Firestore security rules) so
 * this works even when the user's tenantIds array is empty.
 * Used as a fallback in finishAuth when tenantIds is empty.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';

export async function GET(req: NextRequest) {
  try {
    // Verify the caller's Firebase ID token
    const authHeader = req.headers.get('authorization') ?? '';
    const token      = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    let decoded: { uid: string };
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const uid     = decoded.uid;
    const adminDb = getAdminFirestore();

    // 1. Get all tenants
    const tenantsSnap = await adminDb.collection('tenants').get();
    const tenantIds: string[] = [];

    // 2. Check membership in each tenant's members sub-collection
    const checks = tenantsSnap.docs.map(async (tDoc: any) => {
      const memberSnap = await adminDb
        .collection('tenants').doc(tDoc.id)
        .collection('members').doc(uid)
        .get();
      if (memberSnap.exists) tenantIds.push(tDoc.id);
    });
    await Promise.all(checks);

    // 3. Self-heal the user's tenantIds array if empty
    if (tenantIds.length > 0) {
      const userRef  = adminDb.collection('users').doc(uid);
      const userSnap = await userRef.get();
      const existing: string[] = userSnap.exists ? (userSnap.data()?.tenantIds ?? []) : [];
      if (existing.length === 0) {
        await userRef.set(
          {
            tenantIds: tenantIds,
            tenantId:  userSnap.data()?.tenantId ?? tenantIds[0],
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    }

    return NextResponse.json({ tenantIds });
  } catch (err: any) {
    console.error('[GET /api/admin/my-tenants]', err);
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  }
}
