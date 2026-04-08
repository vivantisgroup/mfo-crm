import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { communicationService } from '@/lib/communicationService';

// Microsoft Graph API Webhook endpoint handler
// Push Notification URL for new Messages
export async function POST(req: Request) {
  try {
    const db = getAdminFirestore();
    
    // Graph sends a validation token when creating a subscription
    const url = new URL(req.url);
    const validationToken = url.searchParams.get('validationToken');
    if (validationToken) {
       // Must return plain text 200 OK to validate subscription
       return new NextResponse(validationToken, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    const payload = await req.json();

    // Microsoft Graph sends { value: [ { resourceData: { id, chat, body... } } ] }
    if (payload.value && Array.isArray(payload.value)) {
       for (const notification of payload.value) {
          const { resourceData, subscriptionId } = notification;

          // Process the incoming message via hook
          if (resourceData) {
             const messageId = resourceData.id;
             const chatId = resourceData.chatId || resourceData.channelIdentity?.channelId || 'default-crm-chat';
             
             // System usually receives inbound here unless we broadcast our own messages back
             const isMe = false; 

             // Since we're in sandbox, we don't strict-map tenant from subId. 
             // We push it to sandbox-tenant so everyone sees it for testing.
             // In prod: look up the tenantId from subscriptionId mapping.
             const tenantId = 'master'; // fallback to master in sandbox

             const normalizedMessage = communicationService.normalizeTeamsMessage(resourceData, tenantId, isMe);
             await communicationService.ingestMessage(normalizedMessage);
             
             // Fallback logging for audit
             await db.collection('webhooks_teams_log').doc(messageId).set(normalizedMessage);
          }
       }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Teams Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
