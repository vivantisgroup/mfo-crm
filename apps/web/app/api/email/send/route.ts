import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accountId, to, subject, htmlBody, attachments } = body;

    const db = getAdminFirestore();

    // ─── Nodemailer SMTP Dispatch (HTML & Attachments Fix) ──────────────────
    let smtpSent = false;
    let fallbackText = '';

    if (htmlBody) {
       fallbackText = htmlBody.replace(/<[^>]+>/g, '');
    }

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
        from: process.env.SMTP_FROM ?? `"MFO Nexus Server" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html: htmlBody,         // Ensure rich HTML structures render
        text: fallbackText,     // Provide raw text fallback
        attachments: Array.isArray(attachments) ? attachments : [], // Pass active buffers/streams
      });
      smtpSent = true;
    } else {
      console.warn('[Email Send API] SMTP variables not defined in environment. Message dropped to local log cache.');
    }

    // Native Database Persistence for UI
    const sentMsg = {
      tenantId: 'master', 
      accountId: accountId || 'local',
      folder: 'sent',
      subject: subject,
      snippet: fallbackText.substring(0, 100),
      sender: { email: process.env.SMTP_USER || 'system@mfonexus.com', name: 'MFO Nexus User' },
      recipients: [{ email: to, name: to, type: 'to' }],
      bodyHtml: htmlBody || '',
      bodyText: fallbackText,
      isRead: true,
      hasAttachments: Array.isArray(attachments) && attachments.length > 0,
      receivedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    
    const docRef = await db.collection('email_messages').add(sentMsg);

    return NextResponse.json({ 
      success: true, 
      messageId: docRef.id,
      smtpSent,
      note: smtpSent ? 'Message dispatched externally via Nodemailer and archived.' : 'SMTP bypassed. Local cache trace only.'
    });

  } catch (error: any) {
    console.error('[Email Send API] Error:', error);
    return NextResponse.json({ error: error.message || 'Send failed systemwide.' }, { status: 500 });
  }
}
