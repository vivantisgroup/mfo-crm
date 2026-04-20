import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';
import { getTenantGraphConfig, buildGraphItemUrl } from '@/lib/msGraphProxy';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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

    const formData = await req.formData();
    const tenantId = formData.get('tenantId') as string;
    const entityType = formData.get('entityType') as string;
    const entityId = formData.get('entityId') as string;
    const file = formData.get('file') as File;

    if (!tenantId || !entityType || !entityId || !file) {
      return NextResponse.json({ error: 'Missing parameters or file data' }, { status: 400 });
    }

    const config = await getTenantGraphConfig(tenantId);
    if (!config) {
      return NextResponse.json({ error: 'Storage Not Configured for this Tenant.' }, { status: 404 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Build API Endpoint (Graph automatically creates missing parent folders if you PUT to item path)
    const baseUrl = buildGraphItemUrl(config, `${entityType}/${entityId}`);
    // sanitize filename
    const safeFilename = encodeURIComponent(file.name);
    const uploadUrl = `${baseUrl}/${safeFilename}:/content`;
    
    const uploadRes = await fetch(uploadUrl, {
       method: 'PUT',
       headers: { 
         Authorization: `Bearer ${config.accessToken}`,
         'Content-Type': file.type || 'application/octet-stream'
       },
       body: buffer
    });

    if (!uploadRes.ok) {
       const errBody = await uploadRes.json();
       return NextResponse.json({ error: errBody.error?.message || 'Graph API Upload Error' }, { status: uploadRes.status });
    }

    const graphData = await uploadRes.json();

    // AUDIT LOG
    try {
       const db = getAdminFirestore();
       await db.collection('tenants').doc(tenantId).collection('audit_logs').add({
         action: 'FILE_UPLOAD',
         uid: decoded.uid,
         entityType,
         entityId,
         filename: file.name,
         fileSize: file.size,
         timestamp: new Date().toISOString(),
         graphId: graphData.id
       });
    } catch(auditError) {
       console.error('Audit Log failed, but upload succeeded:', auditError);
    }

    return NextResponse.json({ success: true, file: graphData });

  } catch (error: any) {
    console.error('[API/Storage Upload] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
