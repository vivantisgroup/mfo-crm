/**
 * GET /api/mail/thread/:threadId
 *
 * Fetches all messages in a thread (Google or Microsoft) and returns decoded bodies.
 * Query params: uid, idToken, provider
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidGoogleToken } from '@/lib/googleTokenRefresh';
import { getValidMicrosoftToken } from '@/lib/microsoftTokenRefresh';

export const dynamic = 'force-dynamic';

const GMAIL = 'https://gmail.googleapis.com/gmail/v1';

function decodeBase64(str: string): string {
  if (!str) return '';
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(b64, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

function extractBody(payload: any): { html: string; text: string; attachments: any[] } {
  let html = '';
  let text = '';
  const attachments: any[] = [];

  function walk(part: any) {
    if (!part) return;
    const mime = part.mimeType?.toLowerCase() || '';
    if (mime === 'text/html'  && (!part.filename) && part.body?.data) {
      if (html) html += '<br/>';
      html += decodeBase64(part.body.data);
    }
    if (mime === 'text/plain' && (!part.filename) && part.body?.data) {
      if (text) text += '\n\n';
      text += decodeBase64(part.body.data);
    }
    
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

function getHeader(headers: any[], name: string): string {
  return headers?.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function extractEmails(raw: string): string[] {
  return (raw.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g)) ?? [];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    const uid      = req.nextUrl.searchParams.get('uid')     ?? '';
    const idToken  = req.nextUrl.searchParams.get('idToken') ?? '';
    const provider = req.nextUrl.searchParams.get('provider') ?? 'google';
    const tenantId = req.nextUrl.searchParams.get('tenantId') ?? '';

    if (!uid || !idToken || !threadId || !tenantId) {
      return NextResponse.json({ error: 'uid, idToken, threadId, tenantId required' }, { status: 400 });
    }

    if (provider === 'microsoft') {
        const accessToken = await getValidMicrosoftToken(uid, idToken, tenantId);
        
        // Use $filter on conversationId to fetch the thread messages.
        const queryParams = new URLSearchParams({
          $filter: `conversationId eq '${threadId}'`,
          $top: '100'
        });
        const url = `https://graph.microsoft.com/v1.0/me/messages?${queryParams.toString()}`;
        const res = await fetch(url, {
           headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (!res.ok) {
           const errText = await res.text();
           return NextResponse.json({ error: `MS Graph thread fetch failed: ${errText}` }, { status: res.status });
        }
        
        const data = await res.json();
        let threadMsgs = data.value || [];

        // Sort locally since $orderby with $filter=conversationId is an InefficientFilter
        threadMsgs.sort((a: any, b: any) => new Date(a.receivedDateTime).getTime() - new Date(b.receivedDateTime).getTime());

        // If filtering by conversationId yields empty array, it means threadId was just a single message ID
        if (threadMsgs.length === 0) {
           const fallbackRes = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${threadId}`, {
               headers: { Authorization: `Bearer ${accessToken}` }
           });
           if (!fallbackRes.ok) {
               const errText = await fallbackRes.text();
               return NextResponse.json({ error: `MS Graph fallback fetch failed: ${errText}` }, { status: fallbackRes.status });
           }
           threadMsgs = [await fallbackRes.json()];
        }
        
        // Wait, for Microsoft Graph we need attachments. They require a separate call per message if hasAttachments is true.
        const messages = await Promise.all(threadMsgs.map(async (msg: any) => {
           let attachments: any[] = [];
           if (msg.hasAttachments) {
              const attRes = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${msg.id}/attachments`, {
                  headers: { Authorization: `Bearer ${accessToken}` }
              });
              if (attRes.ok) {
                  const attData = await attRes.json();
                  attachments = (attData.value || []).map((a: any) => ({
                     id: a.id,
                     name: a.name,
                     mimeType: a.contentType || 'application/octet-stream',
                     size: a.size || 0,
                     inlineData: a.contentBytes
                  }));
              }
           }
           
           const fromEmail = msg.from?.emailAddress?.address || '';
           const toEmails = (msg.toRecipients || []).map((t: any) => t.emailAddress?.address).filter(Boolean);
           return {
              id: msg.id,
              threadId: msg.conversationId || msg.id,
              labelIds: [],
              subject: msg.subject,
              from: msg.from?.emailAddress?.name ? `${msg.from.emailAddress.name} <${fromEmail}>` : fromEmail,
              to: msg.toRecipients?.map((t: any) => t.emailAddress?.address).join(', '),
              cc: msg.ccRecipients?.map((t: any) => t.emailAddress?.address).join(', '),
              date: new Date(msg.receivedDateTime).toUTCString(),
              snippet: msg.bodyPreview || '',
              isUnread: !msg.isRead,
              isStarred: msg.flag?.flagStatus === 'flagged',
              isSent: false,
              fromEmails: [fromEmail],
              toEmails: toEmails,
              html: msg.body?.contentType?.toLowerCase() === 'html' ? msg.body.content : '',
              text: msg.body?.contentType?.toLowerCase() !== 'html' ? msg.body.content : '',
              attachments,
              internalDate: msg.receivedDateTime,
           };
        }));
        
        return NextResponse.json({ threadId, messages });
    }

    if (provider === 'google') {
      const accessToken = await getValidGoogleToken(tenantId, uid, idToken);

      const res = await fetch(`${GMAIL}/users/me/threads/${threadId}?format=full`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `Gmail thread fetch failed: ${err}` }, { status: 502 });
      }

      const thread = await res.json();

      const messages = (thread.messages ?? []).map((msg: any) => {
      const headers  = msg.payload?.headers ?? [];
      const labelIds = msg.labelIds ?? [];
      const { html, text, attachments } = extractBody(msg.payload);

      return {
        id:         msg.id,
        threadId:   msg.threadId,
        labelIds,
        subject:    getHeader(headers, 'Subject'),
        from:       getHeader(headers, 'From'),
        to:         getHeader(headers, 'To'),
        cc:         getHeader(headers, 'Cc'),
        date:       getHeader(headers, 'Date'),
        messageId:  getHeader(headers, 'Message-ID'),
        inReplyTo:  getHeader(headers, 'In-Reply-To'),
        snippet:    msg.snippet ?? '',
        isUnread:   labelIds.includes('UNREAD'),
        isStarred:  labelIds.includes('STARRED'),
        isSent:     labelIds.includes('SENT'),
        fromEmails: extractEmails(getHeader(headers, 'From')),
        toEmails:   extractEmails(getHeader(headers, 'To')),
        html,
        text,
        attachments,
        internalDate: msg.internalDate,
      };
    });

      return NextResponse.json({ threadId, messages });
    }

    return NextResponse.json({ error: `Unsupported or disconnected thread provider: ${provider}` }, { status: 400 });
  } catch (err: any) {
    console.warn(`[mail/thread] ${err.name}:`, err.message);
    return NextResponse.json({ error: err.message ?? 'failed' }, { status: 500 });
  }
}
