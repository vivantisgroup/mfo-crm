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
    const { action, collectionName, recordId, payload, tenantId } = body;

    // Permissions Strategy:
    // This is the Explorer API. Master Admins can edit anything.
    // Firm Admins can edit anything inside their tenant (which means we must verify tenantId matches their membership).
    if (!collectionName || !recordId || !action) {
      return NextResponse.json({ error: 'Missing required parameters (action, collectionName, recordId)' }, { status: 400 });
    }

    const adminDb = getAdminFirestore();

    // Verify firm admin
    if (!isMasterAdmin) {
       if (!tenantId) return NextResponse.json({ error: 'Firm Admins must provide tenantId context.' }, { status: 400 });
       const memberSnap = await adminDb.collection('tenants').doc(tenantId).collection('members').doc(uid).get();
       if (!memberSnap.exists || memberSnap.data()?.role !== 'firm_admin') {
          return NextResponse.json({ error: 'Forbidden. Requires firm_admin role.' }, { status: 403 });
       }
       
       // Force tenant context on record modification
       if (payload && payload.tenantId && payload.tenantId !== tenantId) {
           return NextResponse.json({ error: 'Cannot re-assign record to another tenant.' }, { status: 403 });
       }
    }

    const docRef = adminDb.collection(collectionName).doc(recordId);
    
    // --- EVALUATING ACTION ---

    if (action === 'INSPECT') {
       // Search for generic references depending on collection
       const dependencies = {
          recordId,
          collection: collectionName,
          references: [] as any[]
       };
       
       if (collectionName === 'tenants') {
         // See if users refer to this tenant
         const usersSnap = await adminDb.collection('users').where('tenantIds', 'array-contains', recordId).get();
         usersSnap.forEach((d: any) => dependencies.references.push({ collection: 'users', id: d.id, description: 'Has tenant in tenantIds array' }));
       }
       if (collectionName === 'users') {
         // See if any tenants have them as member
         const tenantsSnap = await adminDb.collection('tenants').get();
         for (const t of tenantsSnap.docs) {
            const memRef = await t.ref.collection('members').doc(recordId).get();
            if (memRef.exists) dependencies.references.push({ collection: `tenants/${t.id}/members`, id: recordId, description: 'Exists as member' });
         }
       }
       return NextResponse.json({ dependencies });
    }

    if (action === 'UPDATE') {
       if (!payload || typeof payload !== 'object') {
           return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
       }
       // Hard replace fields (shallow) or use set merge true depending on UI.
       // The UI sends the entire object. We can just set it.
       await docRef.set(payload);
       return NextResponse.json({ success: true });
    }

    if (action === 'DELETE') {
       // Automatic Referential Cascades (for Force Delete)
       // NOTE: A production grade system would do complex cascading here. 
       // For this tool, we execute the delete, but we warn the user to run Inspect first.
       
       if (collectionName === 'users') {
           // Cascade remove from any `tenantIds` arrays they belong to? 
           // Master admin should handle that. We just delete the base document for now.
       }
       
       await docRef.delete();
       return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });

  } catch (err: any) {
    console.error('[DB Modify API Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
