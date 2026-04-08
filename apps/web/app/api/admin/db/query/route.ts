import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';

const DOC_ID_KEYED: Record<string, boolean> = {
  tenants: true,
  subscriptions: true,
  user_mfa_secrets: true,
};

const ALLOWED_COLLECTIONS = [
  'users', 'tenants', 'tenant_invitations', 'user_mfa_secrets',
  'platform_orgs', 'platform_contacts', 'platform_opportunities',
  'platform_crm_activities', 'platform_sales_teams',
  'subscription_plans', 'subscription_plan_versions', 'subscription_events',
  'subscriptions', 'invoices', 'renewals',
  'audit_logs', 'opportunities', 'activities', 'tenant_groups', 'object_acls',
  'platform_backups'
];

async function verifyAccess(req: NextRequest): Promise<{ uid: string, tenantId: string | null, isMasterAdmin: boolean } | NextResponse> {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminAuth = getAdminAuth();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    
    // Check if master admin
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
    const { collectionName, tenantId, limitCount = 50 } = body;

    if (!collectionName || !ALLOWED_COLLECTIONS.includes(collectionName)) {
      return NextResponse.json({ error: 'Invalid or missing collectionName' }, { status: 400 });
    }

    if (!tenantId && !isMasterAdmin) {
      return NextResponse.json({ error: 'TenantId required for non-super admins' }, { status: 403 });
    }

    if (!isMasterAdmin) {
       // verify they are a member of the tenant requested
       const adminDb = getAdminFirestore();
       const memberSnap = await adminDb.collection('tenants').doc(tenantId).collection('members').doc(uid).get();
       if (!memberSnap.exists || memberSnap.data()?.role !== 'firm_admin') {
          return NextResponse.json({ error: 'Forbidden. Requires firm_admin role.' }, { status: 403 });
       }
    }

    const db = getAdminFirestore();
    const ref = db.collection(collectionName);
    let snap;

    if (!tenantId) {
      // Super admin querying entire collection
      snap = await ref.limit(limitCount).get();
    } else if (DOC_ID_KEYED[collectionName]) {
      const docSnap = await ref.doc(tenantId).get();
      snap = { docs: docSnap.exists ? [docSnap] : [] };
    } else {
      snap = await ref.where('tenantId', '==', tenantId).limit(limitCount).get();
    }

    const docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ docs, collection: collectionName });
  } catch (err: any) {
    console.error('[DB Query API Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
