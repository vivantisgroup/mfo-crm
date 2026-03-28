import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';

/**
 * GET/POST /api/admin/tenant-config
 *
 * Secures access to the tenant document, primarily used for AiKeys (BYOK).
 * Verifies caller has valid membership to the requested tenantId.
 */

async function verifyMembership(req: NextRequest): Promise<{ uid: string, tenantId: string | null } | NextResponse> {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminAuth = getAdminAuth();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid, tenantId: null };
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const authRes = await verifyMembership(req);
    if (authRes instanceof NextResponse) return authRes;
    const { uid } = authRes;

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

    const adminDb = getAdminFirestore();

    const userSnap = await adminDb.collection('users').doc(uid).get();
    const isMasterAdmin = userSnap.data()?.role === 'saas_master_admin';

    // Verify membership
    const memberSnap = await adminDb.collection('tenants').doc(tenantId).collection('members').doc(uid).get();
    if (!memberSnap.exists && !isMasterAdmin) {
      // If internal/super-admin, they are allowed to configure BYOK for any tenant.
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const docSnap = await adminDb.collection('tenants').doc(tenantId).get();
    const data = docSnap.data() || {};
    return NextResponse.json({ 
      aiKeys: data.aiKeys || {},
      mfaConfig: data.mfaConfig || {},
      entityTypes: data.entityTypes || {
        clientTypes: ['Family Group', 'Holding Company', 'Single Family Office'],
        organizationTypes: ['Bank', 'Law Firm', 'Accounting Firm', 'Service Provider'],
        contactTypes: ['Private Banker', 'Lawyer', 'Family Member', 'Assistant']
      }
    });
  } catch (err: any) {
    console.error('[GET /api/admin/tenant-config]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authRes = await verifyMembership(req);
    if (authRes instanceof NextResponse) return authRes;
    const { uid } = authRes;

    const body = await req.json();
    const { tenantId, aiKeys, mfaConfig, entityTypes } = body;
    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

    const adminDb = getAdminFirestore();

    const userSnap = await adminDb.collection('users').doc(uid).get();
    const isMasterAdmin = userSnap.data()?.role === 'saas_master_admin';

    // Verify membership
    const memberSnap = await adminDb.collection('tenants').doc(tenantId).collection('members').doc(uid).get();
    if (!memberSnap.exists && !isMasterAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload: any = { updatedAt: new Date().toISOString() };
    if (aiKeys !== undefined) payload.aiKeys = aiKeys;
    if (entityTypes !== undefined) payload.entityTypes = entityTypes;
    if (mfaConfig !== undefined) {
      payload.mfaConfig = mfaConfig;
      // Synthesize top-level requirement for AuthContext layout routing
      payload.mfaRequired = (mfaConfig.mfaMode === 'totp' || mfaConfig.mfaMode === 'email');
    }

    await adminDb.collection('tenants').doc(tenantId).set(
      payload,
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[POST /api/admin/tenant-config]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
