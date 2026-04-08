import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';

async function verifyAccess(req: NextRequest): Promise<{ uid: string, tenantId: string | null, isMasterAdmin: boolean } | NextResponse> {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminAuth = getAdminAuth();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    
    const adminDb = getAdminFirestore();
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    const isMasterAdmin = userSnap.data()?.role === 'saas_master_admin';
    
    return { uid: decoded.uid, tenantId: null, isMasterAdmin };
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authRes = await verifyAccess(req);
    if (authRes instanceof NextResponse) return authRes;
    const { isMasterAdmin, uid } = authRes;

    const body = await req.json().catch(() => ({}));
    const { tenantId } = body;

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const adminDb = getAdminFirestore();

    if (!isMasterAdmin) {
       const memberSnap = await adminDb.collection('tenants').doc(tenantId).collection('members').doc(uid).get();
       if (!memberSnap.exists || memberSnap.data()?.role !== 'firm_admin') {
          return NextResponse.json({ error: 'Forbidden. Requires firm_admin role.' }, { status: 403 });
       }
    }

    const report = {
       passed: 0,
       warnings: [] as string[],
       errors: [] as string[],
       scannedEntities: 0,
       scanSteps: [] as string[]
    };

    // 1. Scan Users referencing this tenant
    report.scanSteps.push(`Scanning 'users' collection for arrays containing tenantId: ${tenantId}`);
    const usersSnap = await adminDb.collection('users').where('tenantIds', 'array-contains', tenantId).get();
    report.scannedEntities += usersSnap.size;
    report.scanSteps.push(`Found ${usersSnap.size} users referencing this tenant. Verifying membership documents...`);

    for (const doc of usersSnap.docs) {
      // Validate that they exist in `tenants/{tenantId}/members`
      const memRef = await adminDb.collection('tenants').doc(tenantId).collection('members').doc(doc.id).get();
      if (!memRef.exists) {
        report.errors.push(`User ${doc.id} references tenant ${tenantId} but is missing in members subcollection.`);
      } else {
        report.passed++;
      }
    }

    // 2. Validate Tenant Configuration
    report.scanSteps.push(`Validating core tenant document configuration...`);
    const tenantDoc = await adminDb.collection('tenants').doc(tenantId).get();
    report.scannedEntities++;
    if (!tenantDoc.exists) {
        report.errors.push(`Tenant doc ${tenantId} missing entirely.`);
    } else {
       const data = tenantDoc.data() || {};
       if (!data.status) report.warnings.push(`Tenant ${tenantId} missing status field.`);
       else report.passed++;
    }

    report.scanSteps.push(`Scan complete. Passed assertions: ${report.passed}. Errors: ${report.errors.length}.`);

    // Return Consistency Report
    return NextResponse.json({ report });
  } catch (err: any) {
    console.error('[DB Consistency API Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
