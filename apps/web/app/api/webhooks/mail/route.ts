import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { WEBHOOK_SECRET } from '@/lib/msGraphWebhooks';
import { communicationService } from '@/lib/communicationService';

/**
 * Validates the Microsoft Graph Webhook registration request.
 * Required endpoint that MS Graph pings before turning the webhook ON.
 */
export async function POST(req: NextRequest) {
  try {
    const adminDb = getAdminFirestore();
    const url = new URL(req.url);
    const validationToken = url.searchParams.get('validationToken');

    // 1. MS GRAPH Initial Validation Handshake
    if (validationToken) {
      return new NextResponse(validationToken, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    const bodyText = await req.text();
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
       return NextResponse.json({ error: 'invalid json' }, { status: 400 });
    }

    // 2. GOOGLE PUB/SUB Handler
    if (body.message && body.message.data) {
      const buff = Buffer.from(body.message.data, 'base64');
      const payload = JSON.parse(buff.toString('utf-8'));
      
      const emailAddress = payload.emailAddress;
      const historyId = payload.historyId;

      console.log(`[Webhook] Google Push for ${emailAddress} - History ID: ${historyId}`);

      const usersSnap = await adminDb.collection('users').where('email', '==', emailAddress).limit(1).get();
      if (!usersSnap.empty) {
        const uid = usersSnap.docs[0].id;
        // In a full implementation, we queue a delta-sync job for 'uid'
        await adminDb.doc(`users/${uid}/integrations/google`).set({
          pendingSync: true,
          latestHistoryId: historyId,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      return NextResponse.json({ status: 'ok' });
    }

    // 3. MICROSOFT GRAPH Event Handler
    if (body.value && Array.isArray(body.value)) {
      for (const notification of body.value) {
        if (notification.clientState !== WEBHOOK_SECRET) {
          console.warn(`[Webhook] Invalid client state token from Microsoft: ${notification.clientState}`);
          continue;
        }

        const changeType = notification.changeType; // 'created' | 'updated' | 'deleted'
        const resourceId = notification.resourceData?.id; // The unique mail message ID
        const subId = notification.subscriptionId;

        console.log(`[Webhook] MS Graph Event - Type: ${changeType}, MsgId: ${resourceId}, Sub: ${subId}`);

        const integrations = await adminDb.collectionGroup('integrations').where('microsoftGraphSubscriptionId', '==', subId).limit(1).get();
        if (integrations.empty) {
           console.warn(`[Webhook] No user found for subscription ${subId}`);
           continue;
        }

        const integrationDoc = integrations.docs[0];
        const uid = integrationDoc.ref.parent.parent?.id;

        const userSnap = uid ? await adminDb.doc(`users/${uid}`).get() : null;
        let tenantId = uid || 'sandbox-tenant';
        if (userSnap?.exists) {
            tenantId = userSnap.data()?.tenantId || tenantId;
        }

        if (uid) {
           if (changeType === 'deleted') {
              // Delete the document in our unified timeline schema
              await adminDb.collection('communications').doc(`msg_${resourceId}`).set({ direction: 'inbound', deletedLocally: true }, { merge: true });
           } else {
              // Fetch from MS Graph!
              try {
                 const { getValidMicrosoftToken } = await import('@/lib/microsoftTokenRefresh');
                 const token = await getValidMicrosoftToken(uid);
                 const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${resourceId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                 });
                 if (res.ok) {
                    const email = await res.json();
                    
                    const isOutbound = email.from?.emailAddress?.address?.toLowerCase() === integrationDoc.data().connectedEmail?.toLowerCase();

                    const normalizedMsg = communicationService.normalizeGraphEmail(email, tenantId, isOutbound);
                    await communicationService.ingestMessage(normalizedMsg);
                 }
              } catch (e) {
                 console.warn(`[Webhook] Could not fetch email msg-${resourceId} via token refresh:`, e);
              }
              // Still trigger delta-sync flag for other async polling
              await integrationDoc.ref.set({ pendingSync: true, updatedAt: new Date().toISOString() }, { merge: true });
           }
        }
      }

      return new NextResponse('Accepted', { status: 202 });
    }

    return NextResponse.json({ error: 'unknown payload type' }, { status: 400 });

  } catch (error) {
    console.error('[Webhook] Mail route crash:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
