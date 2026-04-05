import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, forceReinitializeAdmin, getAdminAuth } from '@/lib/firebaseAdmin';

async function verifyAccess(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const adminDb = getAdminFirestore();
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    const role = userSnap.data()?.role;
    if (role !== 'saas_master_admin' && role !== 'firm_admin') {
      return NextResponse.json({ error: 'Forbidden. Requires saas_master_admin or firm_admin.' }, { status: 403 });
    }
    return null; // OK
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const col = searchParams.get('collection');
  const id  = searchParams.get('id');
  if (!col || !id) return NextResponse.json({ error: 'collection and id required' }, { status: 400 });

  const authRes = await verifyAccess(req);
  if (authRes) return authRes;

  try {
    const db   = getAdminFirestore();
    const snap = await db.collection(col).doc(id).get();
    if (!snap.exists) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    return NextResponse.json({ id: snap.id, ...snap.data() });
  } catch (err: any) {
    if (err.message?.includes('invalid_grant') || err.message?.includes('invalid_rapt')) {
      await forceReinitializeAdmin();
      return NextResponse.json({ error: 'Auth token expired and was forcefully reloaded. Please repeat your action.' }, { status: 503 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const col = searchParams.get('collection');
  const id  = searchParams.get('id');
  if (!col || !id) return NextResponse.json({ error: 'collection and id required' }, { status: 400 });

  const authRes = await verifyAccess(req);
  if (authRes) return authRes;

  try {
    const db   = getAdminFirestore();
    const body = await req.json();
    await db.collection(col).doc(id).set({ ...body, updatedAt: new Date().toISOString() }, { merge: true });

    // Audit the edit
    await db.collection('audit_logs').add({
      tenantId: 'master', userId: 'catalog_explorer', userName: 'Catalog Explorer',
      action: 'CATALOG_EDIT', resourceId: id, resourceType: col,
      resourceName: `${col}/${id}`, status: 'success', ipAddress: 'server',
      userAgent: 'Catalog Explorer UI', occurredAt: new Date().toISOString(),
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message?.includes('invalid_grant') || err.message?.includes('invalid_rapt')) {
      await forceReinitializeAdmin();
      return NextResponse.json({ error: 'Auth token expired and was forcefully reloaded. Please repeat your action.' }, { status: 503 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const col = searchParams.get('collection');
  const id  = searchParams.get('id');
  if (!col || !id) return NextResponse.json({ error: 'collection and id required' }, { status: 400 });

  const authRes = await verifyAccess(req);
  if (authRes) return authRes;

  try {
    const db = getAdminFirestore();
    await db.collection(col).doc(id).delete();

    await db.collection('audit_logs').add({
      tenantId: 'master', userId: 'catalog_explorer', userName: 'Catalog Explorer',
      action: 'CATALOG_DELETE', resourceId: id, resourceType: col,
      resourceName: `${col}/${id}`, status: 'success', ipAddress: 'server',
      userAgent: 'Catalog Explorer UI', occurredAt: new Date().toISOString(),
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message?.includes('invalid_grant') || err.message?.includes('invalid_rapt')) {
      await forceReinitializeAdmin();
      return NextResponse.json({ error: 'Auth token expired and was forcefully reloaded. Please repeat your action.' }, { status: 503 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
