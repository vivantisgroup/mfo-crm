import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { tenantId, envelopeId, email } = await req.json();
    if (!tenantId || !envelopeId || !email) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const envRef = db.collection('tenants').doc(tenantId).collection('envelopes').doc(envelopeId);
    
    const envDoc = await envRef.get();
    if (!envDoc.exists) return NextResponse.json({ error: 'Envelope not found' }, { status: 404 });
    const envelope = envDoc.data() || {};
    const senderId = envelope.createdBy;

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await envRef.collection('otps').doc(email).set({ code: otp, expiresAt: expiresAt.toISOString(), attempts: 0 });

    const htmlBody = `<div style="font-family: sans-serif;"><h2>Secure Document OTP</h2><p>Your one-time passcode to view the encrypted envelope is: <strong style="font-size:24px;">${otp}</strong></p><p>This code expires in 15 minutes.</p></div>`;
    const subject = `Your Secure Signing OTP: ${otp}`;
    let oauthSent = false;

    if (senderId) {
      if (!oauthSent) {
        try {
          const { getValidMicrosoftToken } = await import('@/lib/microsoftTokenRefresh');
          const msToken = await getValidMicrosoftToken(senderId, '', tenantId);
          if (msToken) {
            const msRes = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
              method: 'POST',
              headers: { Authorization: `Bearer ${msToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: { subject, body: { contentType: "HTML", content: htmlBody }, toRecipients: [{ emailAddress: { address: email } }] },
                saveToSentItems: "true"
              })
            });
            if (msRes.ok) oauthSent = true;
          }
        } catch (e) { /* ignore */ }
      }

      if (!oauthSent) {
        try {
          const { getValidGoogleToken } = await import('@/lib/googleTokenRefresh');
          const gToken = await getValidGoogleToken(senderId, '', tenantId);
          if (gToken) {
            const bareEmail = `To: ${email}\nSubject: ${subject}\nContent-Type: text/html; charset=utf-8\n\n${htmlBody}`;
            const gRes = await fetch('https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media', {
               method: 'POST',
               headers: { Authorization: `Bearer ${gToken}`, 'Content-Type': 'message/rfc822' },
               body: bareEmail
            });
            if (gRes.ok) oauthSent = true;
          }
        } catch (e) { /* ignore */ }
      }
    }

    if (!oauthSent) {
      const tenantSnap = await db.collection('tenants').doc(tenantId).get();
      const smtpConfig = tenantSnap.data()?.smtpConfig || {};

      const host = smtpConfig.host || process.env.SMTP_HOST;
      const port = Number(smtpConfig.port || process.env.SMTP_PORT || 587);
      const user = smtpConfig.user || process.env.SMTP_USER;
      const pass = smtpConfig.pass || process.env.SMTP_PASS;
      const secure = smtpConfig.secure !== undefined ? !!smtpConfig.secure : (process.env.SMTP_SECURE === 'true');

      if (host && user && pass) {
        // @ts-ignore
        // @ts-ignore
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.default.createTransport({ host, port, secure, auth: { user, pass } });
        const fromEmail = process.env.SMTP_FROM ?? `"MFO Trust Engine" <${user}>`;

        await transporter.sendMail({
          from: fromEmail,
          to: email,
          subject,
          html: htmlBody
        }).catch((err: any) => console.error("Failed to route OTP email externally:", err));
      } else {
        console.warn('--- DEV FALLBACK OTP LOG ---');
        console.warn(`No SMTP configured! Email: ${email} -> Code: ${otp}`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
