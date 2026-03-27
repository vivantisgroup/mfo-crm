/**
 * POST /api/mail/send
 *
 * Sends an email via the user's connected Gmail account.
 * Logs the sent email as a CRM activity if tenantId + familyId provided.
 *
 * Request body:
 *   uid:       string;
 *   idToken:   string;
 *   to:        string;          // recipient email
 *   subject:   string;
 *   body:      string;          // plain text
 *   tenantId?: string;
 *   familyId?: string;
 *   familyName?: string;
 *   replyToMessageId?: string;  // Gmail thread ID for replies
 *   attachments?: { name: string; type: string; data: string }[]; // Base64 data chunks
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidGoogleToken } from '@/lib/googleTokenRefresh';

const GMAIL      = 'https://gmail.googleapis.com/gmail/v1';
const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID ?? 'mfo-crm';

function fsUrl(path: string) {
  return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
}

function toFsValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean')  return { booleanValue: val };
  if (typeof val === 'number')   return { integerValue: String(val) };
  if (typeof val === 'string')   return { stringValue: val };
  if (Array.isArray(val))        return { arrayValue: { values: val.map(toFsValue) } };
  if (typeof val === 'object')   return { mapValue: { fields: Object.fromEntries(Object.entries(val).map(([k, v]) => [k, toFsValue(v)])) } };
  return { stringValue: String(val) };
}

function toFsFields(obj: Record<string, any>) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toFsValue(v)]));
}

/** Encode an email message in RFC 2822 format as base64url. */
function encodeEmail(opts: {
  to: string;
  from: string;
  subject: string;
  body: string;
  replyToMessageId?: string;
  attachments?: { name: string; type: string; data: string }[];
}): string {
  const boundary = `----=_Part_${Math.random().toString(36).slice(2)}`;
  
  const lines = [
    `To: ${opts.to}`,
    `From: ${opts.from}`,
    `Subject: ${opts.subject}`,
    'MIME-Version: 1.0',
  ];

  if (opts.replyToMessageId) {
    lines.push(`In-Reply-To: ${opts.replyToMessageId}`);
    lines.push(`References: ${opts.replyToMessageId}`);
  }

  if (!opts.attachments || opts.attachments.length === 0) {
    // Simple text email
    lines.push('Content-Type: text/plain; charset=UTF-8');
    lines.push('', opts.body);
  } else {
    // Multipart email with attachments
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    lines.push('');
    
    // Body part
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/plain; charset=UTF-8');
    lines.push('');
    lines.push(opts.body);
    lines.push('');

    // Attachments
    for (const att of opts.attachments) {
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: ${att.type}; name="${att.name}"`);
      lines.push(`Content-Disposition: attachment; filename="${att.name}"`);
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('');
      // The base64 data must be split into chunks of 76 characters to be RFC compliant, 
      // but Gmail API generally accepts single-line base64 blocks too.
      // We'll trust the client strips the 'data:mime/type;base64,' prefix.
      lines.push(att.data);
      lines.push('');
    }

    // End boundary
    lines.push(`--${boundary}--`);
  }

  const raw = lines.join('\r\n');
  return Buffer.from(raw, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function POST(req: NextRequest) {
  try {
    const {
      uid, idToken, to, subject, body,
      tenantId, familyId, familyName,
      replyToMessageId, attachments
    } = await req.json();

    if (!uid || !idToken || !to || !subject || !body) {
      return NextResponse.json({ error: 'uid, idToken, to, subject, body required' }, { status: 400 });
    }

    // 1. Get user's Gmail address (sender)
    const accessToken = await getValidGoogleToken(uid, idToken);

    const profileRes = await fetch(`${GMAIL}/users/me/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile   = await profileRes.json();
    const fromEmail = profile.emailAddress ?? '';

    // 2. Compose and send email via Gmail API
    const raw       = encodeEmail({ to, from: fromEmail, subject, body, replyToMessageId, attachments });
    const sendRes   = await fetch(`${GMAIL}/users/me/messages/send`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!sendRes.ok) {
      const err = await sendRes.text();
      return NextResponse.json({ error: `Gmail send failed: ${err}` }, { status: 502 });
    }

    const sent = await sendRes.json();

    // 3. Log sent email to email_logs
    const logId   = `gmail_${sent.id}`;
    const sentAt  = new Date().toISOString();
    const snippet = body.slice(0, 300).replace(/\s+/g, ' ').trim();

    const logData = {
      uid,
      provider:         'google',
      gmailMessageId:   sent.id,
      messageId:        sent.id,
      subject,
      fromEmail,
      fromName:         fromEmail,
      toEmails:         [to],
      receivedAt:       sentAt,
      direction:        'outbound',
      snippet,
      loggedToCrm:      !!(tenantId && familyId),
      linkedFamilyId:   familyId   ?? null,
      linkedFamilyName: familyName ?? null,
      source:           'gmail_send',
      syncedAt:         sentAt,
    };

    await fetch(fsUrl(`users/${uid}/email_logs/${logId}`), {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fields: toFsFields(logData) }),
    });

    // 4. Create CRM activity if linked to a family
    if (tenantId && familyId && familyName) {
      const actId   = `email_${sent.id}`;
      const actData = {
        tenantId,
        linkedFamilyId:   familyId,
        linkedFamilyName: familyName,
        activityType: 'email',
        type:         'email',
        direction:    'outbound',
        subject,
        fromEmail,
        fromName:     fromEmail,
        toEmails:     [to],
        snippet,
        provider:     'google',
        gmailMessageId: sent.id,
        occurredAt:   sentAt,
        source:       'gmail_send',
        createdAt:    sentAt,
        sentiment:    'neutral',
      };

      await fetch(fsUrl(`tenants/${tenantId}/activities/${actId}`), {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ fields: toFsFields(actData) }),
      });
    }

    return NextResponse.json({ messageId: sent.id, sentAt, ok: true });
  } catch (err: any) {
    console.error('[mail/send] error:', err);
    return NextResponse.json({ error: err.message ?? 'send failed' }, { status: 500 });
  }
}
