import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { getValidMicrosoftToken } from '@/lib/microsoftTokenRefresh';
import { getValidGoogleToken } from '@/lib/googleTokenRefresh';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { tenantId, envelopeId, userEmail, userId, signers, reason } = payload;

    if (!tenantId || !envelopeId || !userId || !signers) {
      return NextResponse.json({ error: 'Missing core envelope parameters for resend' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const envRef = db.collection('tenants').doc(tenantId).collection('envelopes').doc(envelopeId);
    const envSnap = await envRef.get();

    if (!envSnap.exists) {
      return NextResponse.json({ error: 'Envelope not found' }, { status: 404 });
    }

    const envelope = envSnap.data()!;
    const draftTitle = envelope.title || 'Untitled Document';
    const composeSubject = `[Resent] Signature Requested: ${draftTitle}`;
    const composeBody = `Hello,\n\nYou have been requested to review and sign a confidential document (${envelope.fileName}) via MFO-CRM.\n\nPlease click the button below to natively review and hash your signature on the cloud.\n\nThank you.`;
    const fallbackText = composeBody.replace(/<[^>]+>/g, '');

    // Update the envelope securely with the new signers array
    await envRef.update({
      signers: signers,
      updatedAt: new Date().toISOString()
    });

    // Write Audit Trail Event
    await db.collection('tenants').doc(tenantId).collection('envelopes').doc(envelopeId).collection('audit_trail').add({
      type: 'resent',
      metadata: { reason: reason || 'Sender requested immediate manual dispatch and overwrite', updatedSigners: signers.length },
      clientInfo: { email: userEmail, system: 'MFO-CRM Resender Node' },
      timestamp: new Date().toISOString()
    });

    // Dispatch Emails (Using the same hybrid logic from dispatch/route.ts)
    // Only dispatch to signers that are STILL pending!
    const pendingSigners = signers.filter((s: any) => s.status === 'pending');
    let smtpSent = false;

    const dispatchPromises = pendingSigners.filter((r: any) => r.email).map(async (rec: any) => {
      const signUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sign/${tenantId}/${envelopeId}?email=${encodeURIComponent(rec.email)}`;
      const compiledHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2>Signature Request </h2>
          <p>${composeBody.replace(/\n/g, '<br/>')}</p>
          <div style="margin: 30px 0;">
            <a href="${signUrl}" style="background-color: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Review and Sign Document</a>
          </div>
          <p style="font-size: 12px; color: #666; border-top: 1px solid #eaeaea; padding-top: 16px;">
            Secured by MFO Native Sign Engine<br/>
            Document Reference: ${envelopeId}
          </p>
        </div>
      `;

      // Attempt MS Graph
      try {
        const msToken = await getValidMicrosoftToken(userId, undefined, tenantId);
        if (msToken) {
          const msRes = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
            method: 'POST',
            headers: { Authorization: `Bearer ${msToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: {
                subject: composeSubject,
                body: { contentType: "HTML", content: compiledHtml },
                toRecipients: [{ emailAddress: { address: rec.email } }]
              },
              saveToSentItems: "true"
            })
          });
          if (msRes.ok) return true; 
          else {
              const errBody = await msRes.text();
              console.error("[Graph Mail Dispatch Error Status]", msRes.status, errBody);
          }
        } else {
            console.warn("[Graph Mail Bypass] getValidMicrosoftToken returned falsey, likely user never linked Microsoft.");
        }
      } catch (e: any) {
         console.error("[Graph Mail Throw Error]: ", e);
      }

      // Fallback to SMTP
      const tenantSnap = await db.collection('tenants').doc(tenantId).get();
      const smtpConfig = tenantSnap.data()?.smtpConfig || {};

      const host = smtpConfig.host || process.env.SMTP_HOST;
      const port = Number(smtpConfig.port || process.env.SMTP_PORT || 587);
      const user = smtpConfig.user || process.env.SMTP_USER;
      const pass = smtpConfig.pass || process.env.SMTP_PASS;
      const secure = smtpConfig.secure !== undefined ? !!smtpConfig.secure : (process.env.SMTP_SECURE === 'true');

      if (host && user && pass) {
        // @ts-ignore
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.default.createTransport({ host, port, secure, auth: { user, pass } });
        const fromEmail = process.env.SMTP_FROM ?? `"MFO Trust Engine" <${user}>`;

        await transporter.sendMail({
          from: fromEmail,
          to: rec.email,
          subject: composeSubject,
          html: compiledHtml,
          text: fallbackText,
        }).catch((err: any) => console.error(`Failed to dispatch SMTP to ${rec.email}:`, err));
        
        return true;
      }
      return false;
    });

    await Promise.allSettled(dispatchPromises);
    smtpSent = true;

    return NextResponse.json({ success: true, envelopeId, smtpSent, pendingSignersDispatched: pendingSigners.length });

  } catch (error: any) {
    console.error('[Signatures Resend API] Absolute Error:', error);
    return NextResponse.json({ error: error.message || 'Dispatch failed via Node architecture.' }, { status: 500 });
  }
}
