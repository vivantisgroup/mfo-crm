import { NextRequest, NextResponse } from 'next/server';
import { getGraphAppToken } from '@/lib/msGraphAppConfig';
import { getValidMicrosoftToken } from '@/lib/microsoftTokenRefresh';
import { communicationService } from '@/lib/communicationService';

/**
 * POST /api/teams/send
 * Forwards an outbound chat or channel message securely to the Microsoft Graph
 * using the global Application (Client Credentials) context.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uid, idToken, chatId, teamId, channelId, message } = body;

    if (!uid || !idToken || !message) {
      return NextResponse.json({ error: 'uid, idToken, and message are required' }, { status: 400 });
    }

    if (!chatId && (!teamId || !channelId)) {
      return NextResponse.json({ error: 'Either chatId, or both teamId and channelId are required' }, { status: 400 });
    }

    // Use Delegated Auth to post "as the user" to bypass MS Graph ChannelMessage Application restrictions
    const userToken = await getValidMicrosoftToken(uid, idToken);

    // Determine target URL based on whether evaluating a Chat or Channel
    const endpoint = chatId 
      ? `https://graph.microsoft.com/v1.0/chats/${chatId}/messages`
      : `https://graph.microsoft.com/v1.0/teams/${teamId}/channels/${channelId}/messages`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${userToken}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        body: { content: message } 
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Graph API rejection: ${err}`);
    }

    const data = await res.json();
    
    // Instantly log to Firestore so the UI updates without waiting for webhook
    try {
      const { getAdminFirestore } = await import('@/lib/firebaseAdmin');
      const db = getAdminFirestore();
      
      const userSnap = await db.doc(`users/${uid}`).get();
      const tenantId = userSnap?.data()?.tenantId || 'master';

      // Ensure data object has exactly what it needs for normalize function
      const msgData = {
          ...data,
          chatId: data.chatId || data.channelIdentity?.channelId || chatId || 'default-crm-chat',
          from: { user: { displayName: data.from?.user?.displayName || 'Me' } },
          body: { content: data.body?.content || message },
      };

      const normalizedMsg = communicationService.normalizeTeamsMessage(msgData, tenantId, true);
      await communicationService.ingestMessage(normalizedMsg);

    } catch (e) {
      console.warn('[teams/send] Could not save outbound message to Firestore:', e);
    }

    return NextResponse.json({ success: true, message: data });
  } catch (error: any) {
    console.error('[teams/send] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
