import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const col = searchParams.get('collection');
  const id  = searchParams.get('id');
  if (!col || !id) return NextResponse.json({ error: 'collection and id required' }, { status: 400 });

  try {
    const db   = getAdminFirestore();
    const snap = await db.collection(col).doc(id).get();
    if (!snap.exists) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    return NextResponse.json({ id: snap.id, ...snap.data() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const col = searchParams.get('collection');
  const id  = searchParams.get('id');
  if (!col || !id) return NextResponse.json({ error: 'collection and id required' }, { status: 400 });

  try {
    const db   = getAdminFirestore();
    const body = await req.json();
    await db.collection(col).doc(id).update({ ...body, updatedAt: new Date().toISOString() });

    // Audit the edit
    await db.collection('audit_logs').add({
      tenantId: 'master', userId: 'catalog_explorer', userName: 'Catalog Explorer',
      action: 'CATALOG_EDIT', resourceId: id, resourceType: col,
      resourceName: `${col}/${id}`, status: 'success', ipAddress: 'server',
      userAgent: 'Catalog Explorer UI', occurredAt: new Date().toISOString(),
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const col = searchParams.get('collection');
  const id  = searchParams.get('id');
  if (!col || !id) return NextResponse.json({ error: 'collection and id required' }, { status: 400 });

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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
