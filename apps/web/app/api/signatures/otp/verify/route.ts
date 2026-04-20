import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { tenantId, envelopeId, email, code } = await req.json();
    if (!tenantId || !envelopeId || !email || !code) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const envRef = db.collection('tenants').doc(tenantId).collection('envelopes').doc(envelopeId);
    const otpRef = envRef.collection('otps').doc(email);
    const otpDoc = await otpRef.get();

    if (!otpDoc.exists) {
      return NextResponse.json({ error: 'No active OTP found. Please request a new code.' }, { status: 404 });
    }

    const otpData = otpDoc.data()!;

    if (new Date(otpData.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'OTP has expired. Please request a new code.' }, { status: 400 });
    }

    if (otpData.attempts >= 3) {
      return NextResponse.json({ error: 'Too many failed attempts. Envelope locked.' }, { status: 403 });
    }

    if (otpData.code !== code) {
      await otpRef.update({ attempts: otpData.attempts + 1 });
      return NextResponse.json({ error: 'Invalid PIN.' }, { status: 400 });
    }

    // Success - We mark the signer OTP as verified inside the main document array
    const envDoc = await envRef.get();
    const envelope = envDoc.data()!;
    const updatedSigners = (envelope.signers || []).map((s: any) => {
       if (s.email === email) return { ...s, otpVerified: true };
       return s;
    });

    await envRef.update({ signers: updatedSigners });

    // Clean up used OTP
    await otpRef.delete();

    // Log telemetry
    await envRef.collection('audit_trail').add({
      type: 'otp_verified',
      metadata: { email },
      clientInfo: {
        ip: req.headers.get('x-forwarded-for') || (req as any).ip || 'Unknown IP',
        userAgent: req.headers.get('user-agent') || 'Unknown Browser'
      },
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
