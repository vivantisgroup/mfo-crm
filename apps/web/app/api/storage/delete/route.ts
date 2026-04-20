import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';
import { getTenantGraphConfig } from '@/lib/msGraphProxy';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminAuth = getAdminAuth();
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const fileId = searchParams.get('fileId');
    const entityType = searchParams.get('entityType') || 'Unknown';
    const entityId = searchParams.get('entityId') || 'Unknown';
    
    if (!tenantId || !fileId) {
      return NextResponse.json({ error: 'Missing tenantId or fileId' }, { status: 400 });
    }

    const config = await getTenantGraphConfig(tenantId);
    if (!config) {
      return NextResponse.json({ error: 'Storage Not Configured for this Tenant.' }, { status: 404 });
    }

    // Determine the base Graph API endpoint for the item
    // Instead of using path building, Graph allows deleting directly by ID
    let deleteUrl = '';
    if (config.driveType === 'site' && config.siteId) {
       deleteUrl = `https://graph.microsoft.com/v1.0/sites/${config.siteId}/drive/items/${fileId}`;
    } else {
       deleteUrl = `https://graph.microsoft.com/v1.0/users/${config.serviceAccountEmail}/drive/items/${fileId}`;
    }
    
    const delRes = await fetch(deleteUrl, {
       method: 'DELETE',
       headers: { Authorization: `Bearer ${config.accessToken}` }
    });

    if (!delRes.ok) {
       const errBody = await delRes.json();
       return NextResponse.json({ error: errBody.error?.message || 'Graph API Delete Error' }, { status: delRes.status });
    }

    // AUDIT LOG
    try {
       const db = getAdminFirestore();
       await db.collection('tenants').doc(tenantId).collection('audit_logs').add({
         action: 'FILE_DELETE',
         uid: decoded.uid,
         entityType,
         entityId,
         fileId,
         timestamp: new Date().toISOString(),
       });
    } catch(auditError) {
       console.error('Audit Log failed, but delete succeeded:', auditError);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[API/Storage Delete] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
