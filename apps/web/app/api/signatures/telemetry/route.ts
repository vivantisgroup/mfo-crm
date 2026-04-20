import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { tenantId, envelopeId, type, metadata, clientInfo } = await req.json();
    if (!tenantId || !envelopeId || !type) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const eventRef = db.collection('tenants')
      .doc(tenantId)
      .collection('envelopes')
      .doc(envelopeId)
      .collection('audit_trail')
      .doc();

    const ip = req.headers.get('x-forwarded-for') || (req as any).ip || 'Unknown IP';
    const userAgent = req.headers.get('user-agent') || 'Unknown Browser';

    await eventRef.set({
      type, // 'opened', 'viewed_page', 'consent_accepted'
      metadata: metadata || {},
      clientInfo: {
        ...clientInfo,
        ip,
        userAgent,
      },
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({ ok: true, eventId: eventRef.id });
  } catch (err: any) {
    console.error('Audit Trail Telemetry Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
