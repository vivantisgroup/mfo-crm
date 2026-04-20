import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, props: { params: Promise<{ tenantId: string }> }) {
  try {
    const params = await props.params;
    const { tenantId } = params;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const docSnap = await db.collection('tenants').doc(tenantId).get();
    
    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const data = docSnap.data();
    
    // Extract only public safe branding fields
    return NextResponse.json({
       logo: data?.branding?.logoFull || data?.logoUrl || data?.logo || data?.settings?.logo || null,
       name: data?.name || data?.companyName || 'MFO-CRM Tenant',
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
