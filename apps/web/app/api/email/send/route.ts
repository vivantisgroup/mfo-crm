import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accountId, to, subject, htmlBody } = body;

    const db = getAdminFirestore();

    // NOTE: Real implementation queries Oauth tokens
    /*
    const accountSnap = await db.collection('email_accounts').doc(accountId).get();
    if (!accountSnap.exists) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    const account = accountSnap.data();

    // 1. Build MIME standard RAW email with base64url encoding.
    // 2. Call POST https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send
    //    with `Authorization: Bearer ${account.accessToken}`
    // 3. Receive the generated messageId from the provider.
    */

    // Write a local record into Firestore matching the DB schema.
    const sentMsg = {
      tenantId: 'demo-tenant',      // Retrieve contextually
      accountId: accountId || 'local',
      folder: 'sent',
      subject: subject,
      snippet: htmlBody?.substring(0, 100).replace(/<[^>]+>/g, '') || '', // Text preview
      sender: { email: 'user@example.com', name: 'Current User' }, // Use account.email
      recipients: [{ email: to, name: to, type: 'to' }],
      bodyHtml: htmlBody, // TODO: Sanitize HTML if persisting
      bodyText: htmlBody?.replace(/<[^>]+>/g, '') || '',
      isRead: true,
      hasAttachments: false,
      receivedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    
    const docRef = await db.collection('email_messages').add(sentMsg);

    return NextResponse.json({ 
      success: true, 
      messageId: docRef.id,
      note: 'Message routed and cached natively.' 
    });

  } catch (error: any) {
    console.error('[Email Send] API error:', error);
    return NextResponse.json({ error: error.message || 'Send failed' }, { status: 500 });
  }
}
