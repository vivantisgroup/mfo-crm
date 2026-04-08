import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

// Helper for MS Graph
async function sendTeamsMessage(accessToken: string, chatId: string, content: string) {
  const res = await fetch(`https://graph.microsoft.com/v1.0/chats/${chatId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      body: { content, contentType: 'text' }
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph API Error: ${err}`);
  }
  return res.json();
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    
    // 1. Handle Microsoft Graph Webhook Validation Subscription
    const validationToken = url.searchParams.get('validationToken');
    if (validationToken) {
      // Return 200 with plain text validationToken to verify webhook
      return new NextResponse(validationToken, { status: 200, headers: { 'Content-Type': 'text/plain' }});
    }

    // Parse Body
    const body = await req.json();

    const db = getAdminFirestore();

    // 2. Handle Reply action from Frontend CRM `<TeamsChatPane />`
    if (body.action === 'reply' && body.userId && body.threadId && body.text) {
      
      // Get User's Microsoft Integration Tokens
      const msDoc = await db.collection('users').doc(body.userId).collection('integrations').doc('microsoft').get();
      if (!msDoc.exists || msDoc.data()?.status !== 'connected') {
        return NextResponse.json({ error: 'Microsoft integration not connected' }, { status: 403 });
      }
      
      const msData = msDoc.data() as any;
      const accessToken = msData._accessToken; // in a real app, you would refresh the token using _refreshToken if expired

      const chatId = body.threadId; 

      // Send to Graph API
      await sendTeamsMessage(accessToken, chatId, body.text);

      // Save a local copy in CRM communications immediately for optimistic consistency
      await db.collection('tenants').doc(body.tenantId).collection('communications').add({
        type: 'chat',
        provider: 'teams',
        provider_message_id: chatId,
        subject: 'Teams Reply',
        body: body.text,
        timestamp: new Date().toISOString(),
        direction: 'outbound',
        from: msData.connectedEmail || 'CRM User',
        crm_entity_links: []
      });

      return NextResponse.json({ success: true });
    }

    // 3. Handle incoming Microsoft Graph Webhook Payload (Passive Sync)
    // Structure: { value: [ { resource: "chats/{id}/messages/{messageid}", resourceData: { ... } } ] }
    if (body.value && Array.isArray(body.value)) {
      for (const notification of body.value) {
        // e.g. "chats/19:abc.../messages/123"
        const resource = notification.resource;
        console.log('[Teams Webhook] Received notification for:', resource);
        
        // Em um ambiente real de produção:
        // 1. Fariamos um GET para o resource usando o token de app corporativo ou de um admin.
        // 2. Com a mensagem, verifaríamos o remetente (Email/UPN).
        // 3. Fariamos a query na coleção de `contacts` e `families` via e-mail.
        // 4. Se houvesse match, salvaríamos um Document em `communications` (como email tracking log).
        
        // Exemplo simplificado de como seria a gravação após a extração mimetizada:
        /*
        await db.collection('tenants').doc('mfo-system').collection('communications').add({
           type: 'chat',
           provider: 'teams',
           provider_message_id: notification.resourceData.id,
           subject: 'Via Teams Graph Webhook',
           body: 'Conteúdo capturado do Graph API...',
           timestamp: new Date().toISOString(),
           direction: 'inbound',
           from: 'cliente@exemplo.com'
        });
        */
      }
      return NextResponse.json({ success: true, processed: body.value.length });
    }

    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  } catch (err: any) {
    console.error('[Teams Webhook API] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
