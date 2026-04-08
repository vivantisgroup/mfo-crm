import { NextRequest, NextResponse } from 'next/server';
import { getValidGoogleToken } from '@/lib/googleTokenRefresh';
import { getValidMicrosoftToken } from '@/lib/microsoftTokenRefresh';

export const dynamic = 'force-dynamic';

function decodeBase64(str: string): string {
  if (!str) return '';
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(b64, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

function extractGoogleBody(payload: any): { html: string; text: string; attachments: any[] } {
  let html = '';
  let text = '';
  const attachments: any[] = [];

  function walk(part: any) {
    if (!part) return;
    if (part.mimeType === 'text/html'  && !part.filename && part.body?.data) html = decodeBase64(part.body.data);
    if (part.mimeType === 'text/plain' && !part.filename && part.body?.data) text = decodeBase64(part.body.data);
    
    if (part.filename && part.filename.trim().length > 0) {
      attachments.push({
        id: part.body?.attachmentId || part.partId || `inline-${part.filename}`,
        name: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body?.size || (part.body?.data ? part.body.data.length : 0),
        inlineData: part.body?.data || undefined,
      });
    }
    for (const child of part.parts ?? []) walk(child);
  }

  walk(payload);
  return { html, text, attachments };
}

export async function GET(req: NextRequest) {
  try {
    const uid      = req.nextUrl.searchParams.get('uid')     ?? '';
    const idToken  = req.nextUrl.searchParams.get('idToken') ?? '';
    const messageId = req.nextUrl.searchParams.get('messageId') ?? '';
    const provider = req.nextUrl.searchParams.get('provider') ?? '';

    if (!uid || !idToken || !messageId || !provider) {
      return NextResponse.json({ error: 'uid, idToken, messageId, provider required' }, { status: 400 });
    }

    if (provider === 'microsoft') {
      const accessToken = await getValidMicrosoftToken(uid, idToken);
      const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=subject,body,hasAttachments&$expand=attachments($select=id,name,contentType,size)`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!res.ok) return NextResponse.json({ error: 'Microsoft fetch failed' }, { status: 502 });
      
      const data = await res.json();
      return NextResponse.json({
        html: data.body?.content || '',
        text: data.body?.content || '',
        attachments: (data.attachments || []).map((a: any) => ({
           id: a.id, name: a.name, mimeType: a.contentType, size: a.size
        }))
      });

    } else if (provider === 'google') {
      const accessToken = await getValidGoogleToken(uid, idToken);
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) return NextResponse.json({ error: 'Google fetch failed' }, { status: 502 });

      const data = await res.json();
      const ext = extractGoogleBody(data.payload);
      return NextResponse.json({
        html: ext.html, text: ext.text, attachments: ext.attachments
      });
    } else {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'failed' }, { status: 500 });
  }
}
