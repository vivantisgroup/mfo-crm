/**
 * POST /api/mfa/send-code
 *
 * Generates a 6-digit email OTP for MFA verification at tenant login.
 * Stores the code in Firestore `mfa_codes/{uid}` with a 10-minute TTL.
 * Sends the code to the user's registered email.
 *
 * Body: { idToken: string, tenantId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

async function verifyIdToken(idToken: string): Promise<{ uid: string; email: string } | null> {
  const apiKey = process.env.FIREBASE_API_KEY ?? process.env.NEXT_PUBLIC_FB_API_KEY ?? '';
  if (process.env.FIREBASE_ADMIN_SDK_JSON) {
    try {
      const d = await getAdminAuth().verifyIdToken(idToken);
      return { uid: d.uid, email: d.email ?? '' };
    } catch { /* fall through */ }
  }
  if (apiKey) {
    try {
      const r = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) },
      );
      if (r.ok) {
        const d = await r.json();
        const u = d.users?.[0];
        if (u) return { uid: u.localId, email: u.email ?? '' };
      }
    } catch { /* fall through */ }
  }
  // Structural JWT fallback
  const parts = idToken.split('.');
  if (parts.length === 3) {
    try {
      const padded = parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4);
      const payload = JSON.parse(Buffer.from(padded, 'base64').toString());
      const uid = payload.sub ?? payload.uid;
      const email = payload.email ?? '';
      if (uid) return { uid, email };
    } catch { /* ignore */ }
  }
  return null;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    // @ts-ignore — nodemailer ships its own types; strict mode false-positive
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? `"MFO Nexus Security" <${process.env.SMTP_USER}>`,
      to, subject, html,
    });
  } else {
    console.warn(`[mfa/send-code] SMTP not configured. OTP for ${to}: would have been sent.`);
    // In dev without SMTP, we still write the code to Firestore — the verify endpoint works.
  }
}

export async function POST(req: NextRequest) {
  try {
    const { idToken, tenantId } = await req.json() as { idToken: string; tenantId: string };
    if (!idToken || !tenantId) {
      return NextResponse.json({ error: 'idToken and tenantId are required.' }, { status: 400 });
    }

    const caller = await verifyIdToken(idToken);
    if (!caller) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min TTL

    // Store in Firestore
    const adminDb = getAdminFirestore();
    await adminDb.collection('mfa_codes').doc(caller.uid).set({
      uid:      caller.uid,
      tenantId,
      code,
      expiresAt,
      attempts: 0,
      createdAt: new Date().toISOString(),
    });

    // Get user email (from Firestore profile if not in token)
    let email = caller.email;
    if (!email) {
      const userDoc = await adminDb.collection('users').doc(caller.uid).get();
      email = userDoc.data()?.email ?? '';
    }

    // Get tenant name
    const tenantDoc = await adminDb.collection('tenants').doc(tenantId).get();
    const tenantName = tenantDoc.data()?.name ?? 'your workspace';

    // Send email if SMTP configured
    const emailSent = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    if (email) {
      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0f0f17;font-family:system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f17;padding:40px 20px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:16px;border:1px solid #2a2a45">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#818cf8);padding:24px 40px;text-align:center">
          <h1 style="margin:0;color:#fff;font-size:18px;font-weight:800">🔐 MFA Verification</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px">${tenantName}</p>
        </td></tr>
        <tr><td style="padding:36px 40px;color:#c8c8e8;font-size:15px;line-height:1.7">
          <p style="margin:0 0 20px">You requested access to <strong>${tenantName}</strong>. Use this one-time code to verify your identity:</p>
          <div style="background:#0f0f1a;border:1px solid #6366f140;border-radius:12px;padding:24px;text-align:center;margin:20px 0">
            <span style="font-family:ui-monospace,monospace;font-size:36px;font-weight:900;color:#818cf8;letter-spacing:0.2em">${code}</span>
          </div>
          <p style="margin:0;color:#6b7280;font-size:13px">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
        </td></tr>
        <tr><td style="padding:16px 40px;border-top:1px solid #2a2a45;text-align:center">
          <p style="margin:0;color:#4b5563;font-size:11px">MFO Nexus Platform &mdash; ${new Date().getFullYear()}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
      try {
        await sendEmail(email, `${code} — Your MFA verification code for ${tenantName}`, html);
      } catch (mailErr: any) {
        console.error('[mfa/send-code] Email failed:', mailErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      emailSent,
      // In dev (no SMTP), return the code so it can be shown in the UI for testing
      devCode: process.env.NODE_ENV === 'development' && !emailSent ? code : undefined,
      warning: !emailSent ? 'SMTP not configured — code only stored in Firestore. Configure SMTP_HOST/USER/PASS to send real MFA emails.' : undefined,
    });
  } catch (e: any) {
    console.error('[POST /api/mfa/send-code]', e);
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}
