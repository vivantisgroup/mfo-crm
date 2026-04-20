import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const envelopeId = searchParams.get('envelopeId');
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const db = getAdminFirestore();
    
    // 1. Fetch Tenant Branding
    const tenantSnap = await db.collection('tenants').doc(tenantId).get();
    let logo = null;
    let tenantName = 'MFO-CRM Tenant';
    
    if (tenantSnap.exists) {
      const data = tenantSnap.data();
      logo = data?.branding?.logoFull || data?.logoUrl || data?.logo || data?.settings?.logo || null;
      tenantName = data?.name || data?.companyName || tenantName;
    }

    // 2. Fetch Sender info if envelopeId is provided
    let senderName = 'MFO-CRM Trust Engine';
    let senderEmail = '';
    
    if (envelopeId) {
       const envSnap = await db.collection('tenants').doc(tenantId).collection('envelopes').doc(envelopeId).get();
       if (envSnap.exists) {
          const envData = envSnap.data();
          if (envData?.createdBy) {
             const userSnap = await db.collection('users').doc(envData.createdBy).get();
             if (userSnap.exists) {
                const uData = userSnap.data();
                senderName = uData?.name || uData?.displayName || senderName;
                senderEmail = uData?.email || uData?.workEmail || '';
             }
          }
       }
    }
    
    return NextResponse.json({
       logo,
       tenantName,
       senderName,
       senderEmail
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
