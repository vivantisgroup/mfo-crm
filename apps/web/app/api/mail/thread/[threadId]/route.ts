/**
 * GET /api/mail/thread/:threadId
 *
 * Fetches all messages in a Gmail thread and returns decoded bodies.
 * Query params: uid, idToken
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidGoogleToken } from '@/lib/googleTokenRefresh';

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

function extractBody(payload: any): { html: string; text: string } {
  let html = '';
  let text = '';

  function walk(part: any) {
    if (!part) return;
    if (part.mimeType === 'text/html'  && part.body?.data) html  = decodeBase64(part.body.data);
    if (part.mimeType === 'text/plain' && part.body?.data) text  = decodeBase64(part.body.data);
    for (const child of part.parts ?? []) walk(child);
  }

  walk(payload);
  return { html, text };
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

    if (!uid || !idToken || !threadId) {
      return NextResponse.json({ error: 'uid, idToken, threadId required' }, { status: 400 });
    }

    const accessToken = await getValidGoogleToken(uid, idToken);

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
      const { html, text } = extractBody(msg.payload);

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
        internalDate: msg.internalDate,
      };
    });

    return NextResponse.json({ threadId, messages });
  } catch (err: any) {
    console.error('[mail/thread] error:', err);
    return NextResponse.json({ error: err.message ?? 'failed' }, { status: 500 });
  }
}
