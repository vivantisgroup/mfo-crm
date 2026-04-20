import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { getTenantGraphConfig, buildGraphItemUrl } from '@/lib/msGraphProxy';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
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
    const entityType = searchParams.get('entityType'); // e.g. 'employees'
    const entityId = searchParams.get('entityId');     // e.g. 'marcelo123'
    
    if (!tenantId || !entityType || !entityId) {
      return NextResponse.json({ error: 'Missing tenantId, entityType, or entityId' }, { status: 400 });
    }

    // Role check logic would go here based on decoded.uid + tenantId.
    // For now, if they have an active token and request their tenant, allow proxy.

    const config = await getTenantGraphConfig(tenantId);
    if (!config) {
      return NextResponse.json({ error: 'Storage Not Configured for this Tenant.' }, { status: 404 });
    }

    const baseUrl = buildGraphItemUrl(config, `${entityType}/${entityId}`);
    
    // Attempt to list children
    const listRes = await fetch(`${baseUrl}:/children?$select=id,name,folder,file,size,lastModifiedDateTime,@microsoft.graph.downloadUrl`, {
       headers: { Authorization: `Bearer ${config.accessToken}` }
    });

    if (!listRes.ok) {
       const errBody = await listRes.json();
       const errorMessage = errBody.error?.message || '';
       
       // Graph returns 404 or specifically 'Resource not found' bad requests when dealing with un-initialized folders
       if (listRes.status === 404 || errorMessage.toLowerCase().includes('not found')) {
         return NextResponse.json({ files: [] });
       }
       
       return NextResponse.json({ error: errorMessage || 'Graph API Error' }, { status: listRes.status });
    }

    const data = await listRes.json();
    return NextResponse.json({ files: data.value || [] });

  } catch (error: any) {
    console.error('[API/Storage List] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
