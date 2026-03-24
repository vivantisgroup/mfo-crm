/**
 * POST /api/mail/sync/route.ts
 *
 * Syncs Gmail messages for the authenticated user.
 * - Fetches up to 50 messages from Gmail API (inbox + sent)
 * - Deduplicates by gmailMessageId
 * - Auto-links emails to known CRM contacts/families by email address
 * - Creates CRM activity entries for matched emails
 * - Writes email metadata to users/{uid}/email_logs
 *
 * Request body:
 *   { uid: string; idToken: string; tenantId?: string; maxResults?: number }
 *
 * No Admin SDK required — uses Firestore REST API with Firebase ID token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidGoogleToken } from '@/lib/googleTokenRefresh';

const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID ?? 'mfo-crm';

// ─── Firestore REST ───────────────────────────────────────────────────────────

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

function extractStr(fields: any, key: string) {
  return fields?.[key]?.stringValue ?? '';
}

/** Write a Firestore document via REST (PATCH = upsert). */
async function fsWrite(idToken: string, path: string, data: Record<string, any>) {
  const res = await fetch(fsUrl(path), {
    method:  'PATCH',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields: toFsFields(data) }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firestore write failed at ${path}: ${body}`);
  }
  return res.json();
}

/** List documents in a Firestore collection via REST. */
async function fsList(idToken: string, path: string, pageSize = 200): Promise<any[]> {
  const url = `${fsUrl(path)}?pageSize=${pageSize}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) return [];
  const json = await res.json();
  return json.documents ?? [];
}

// ─── Gmail API helpers ────────────────────────────────────────────────────────

const GMAIL = 'https://gmail.googleapis.com/gmail/v1';

function gmailHeader(headers: any[], name: string): string {
  return headers?.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function extractEmails(headerValue: string): string[] {
  // Extract email addresses from "Name <email>, Name2 <email2>" format
  const matches = headerValue.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g);
  return matches ?? [];
}

function decodeBase64(str: string): string {
  if (!str) return '';
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

function getSnippet(body: any, fallbackSnippet: string): string {
  // Try to extract plain text snippet from message parts
  const parts = body?.parts ?? [];
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      const text = decodeBase64(part.body.data);
      return text.slice(0, 300).replace(/\s+/g, ' ').trim();
    }
  }
  return fallbackSnippet?.slice(0, 300) ?? '';
}

// ─── Contact matching ─────────────────────────────────────────────────────────

interface ContactMatch {
  familyId:   string;
  familyName: string;
  contactId?: string;
}

async function buildContactEmailMap(idToken: string, tenantId: string): Promise<Map<string, ContactMatch>> {
  const map = new Map<string, ContactMatch>();
  if (!tenantId) return map;

  // Load families
  const families = await fsList(idToken, `tenants/${tenantId}/families`);
  for (const fam of families) {
    const f = fam.fields ?? {};
    const famId   = fam.name?.split('/').pop() ?? '';
    const famName = extractStr(f, 'name') || extractStr(f, 'familyName');
    // Family primary email
    const primaryEmail = extractStr(f, 'email') || extractStr(f, 'primaryEmail');
    if (primaryEmail) map.set(primaryEmail.toLowerCase(), { familyId: famId, familyName: famName });

    // Load contacts for this family
    const contacts = await fsList(idToken, `tenants/${tenantId}/families/${famId}/contacts`);
    for (const ct of contacts) {
      const c   = ct.fields ?? {};
      const ctId    = ct.name?.split('/').pop() ?? '';
      const ctEmail = extractStr(c, 'email') || extractStr(c, 'primaryEmail');
      if (ctEmail) {
        map.set(ctEmail.toLowerCase(), { familyId: famId, familyName: famName, contactId: ctId });
      }
    }
  }

  return map;
}

// ─── Get existing email IDs to deduplicate ────────────────────────────────────

async function getExistingMessageIds(idToken: string, uid: string): Promise<Set<string>> {
  const logs = await fsList(idToken, `users/${uid}/email_logs`, 500);
  const ids  = new Set<string>();
  for (const log of logs) {
    const msgId = log.fields?.gmailMessageId?.stringValue;
    if (msgId) ids.add(msgId);
  }
  return ids;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body       = await req.json();
    const uid        = body.uid        as string;
    const idToken    = body.idToken    as string;
    const tenantId   = body.tenantId   as string | undefined;
    const maxResults = body.maxResults as number ?? 50;

    if (!uid || !idToken) {
      return NextResponse.json({ error: 'uid and idToken required' }, { status: 400 });
    }

    // 1. Get valid (possibly refreshed) Google access token
    const accessToken = await getValidGoogleToken(uid, idToken);

    // 2. Build contact → family map for auto-linking
    const contactMap = tenantId ? await buildContactEmailMap(idToken, tenantId) : new Map();

    // 3. Get existing message IDs to avoid duplicates
    const existingIds = await getExistingMessageIds(idToken, uid);

    // 4. Fetch message list from Gmail (inbox + sent combined via label filter)
    const listUrl = `${GMAIL}/users/me/messages?maxResults=${maxResults}&labelIds=INBOX&labelIds=SENT`;
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listRes.ok) {
      const err = await listRes.text();
      return NextResponse.json({ error: `Gmail list failed: ${err}` }, { status: 502 });
    }

    const listData = await listRes.json();
    const messages = listData.messages ?? [];

    let newEmails    = 0;
    let newActivities = 0;
    const errors: string[] = [];

    // 5. Fetch each message detail and write to Firestore
    for (const msg of messages) {
      if (existingIds.has(msg.id)) continue;

      try {
        const detailRes = await fetch(
          `${GMAIL}/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!detailRes.ok) continue;

        const detail   = await detailRes.json();
        const headers  = detail.payload?.headers ?? [];
        const labelIds = detail.labelIds ?? [];

        const subject    = gmailHeader(headers, 'Subject') || '(no subject)';
        const fromRaw    = gmailHeader(headers, 'From');
        const toRaw      = gmailHeader(headers, 'To');
        const dateStr    = gmailHeader(headers, 'Date');
        const messageId  = gmailHeader(headers, 'Message-ID') || msg.id;

        const fromEmails = extractEmails(fromRaw);
        const toEmails   = extractEmails(toRaw);
        const fromEmail  = fromEmails[0] ?? '';
        const fromName   = fromRaw.replace(/<.*>/, '').trim().replace(/"/g, '') || fromEmail;
        const direction  = labelIds.includes('SENT') ? 'outbound' : 'inbound';
        const snippet    = getSnippet(detail.payload, detail.snippet ?? '');
        const receivedAt = dateStr
          ? new Date(dateStr).toISOString()
          : new Date(Number(detail.internalDate)).toISOString();

        // Try to match to a CRM contact/family
        const searchEmails = direction === 'inbound' ? fromEmails : toEmails;
        let match: ContactMatch | undefined;
        for (const e of searchEmails) {
          match = contactMap.get(e.toLowerCase());
          if (match) break;
        }

        // Write email log entry
        const logId  = `gmail_${msg.id}`;
        const logData = {
          uid,
          provider:     'google',
          gmailMessageId: msg.id,
          messageId,
          subject,
          fromEmail,
          fromName,
          toEmails,
          receivedAt,
          direction,
          snippet,
          loggedToCrm:      !!match,
          linkedFamilyId:   match?.familyId   ?? null,
          linkedFamilyName: match?.familyName ?? null,
          linkedContactId:  match?.contactId  ?? null,
          source:           'gmail_sync',
          syncedAt:         new Date().toISOString(),
        };

        await fsWrite(idToken, `users/${uid}/email_logs/${logId}`, logData);
        newEmails++;

        // If matched to a family + tenantId, create CRM activity
        if (match && tenantId) {
          const actId   = `email_${msg.id}`;
          const actData = {
            tenantId,
            familyId:         match.familyId,
            familyName:       match.familyName,
            linkedContactId:  match.contactId ?? null,
            activityType:     'email',
            type:             'email',
            direction,
            subject,
            fromEmail,
            fromName,
            toEmails,
            snippet,
            provider:         'google',
            gmailMessageId:   msg.id,
            occurredAt:       receivedAt,
            source:           'gmail_sync',
            createdAt:        new Date().toISOString(),
            sentiment:        'neutral',
          };
          await fsWrite(idToken, `tenants/${tenantId}/activities/${actId}`, actData);
          newActivities++;
        }

        existingIds.add(msg.id);
      } catch (e: any) {
        errors.push(`msg ${msg.id}: ${e.message}`);
      }
    }

    // 6. Update last sync timestamp (using explicit updateMask so we don't wipe tokens)
    const updatePayload = {
      lastSyncAt:     new Date().toISOString(),
      lastSyncResult: errors.length > 0 ? 'error' : 'ok',
      emailsSynced:   newEmails,
    };
    await fetch(`${fsUrl(`users/${uid}/integrations/google`)}?updateMask.fieldPaths=lastSyncAt&updateMask.fieldPaths=lastSyncResult&updateMask.fieldPaths=emailsSynced`, {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/integrations/google`,
        fields: toFsFields(updatePayload)
      }),
    });

    return NextResponse.json({
      newEmails,
      newActivities,
      errors,
      lastSyncAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[mail/sync] error:', err);
    return NextResponse.json({ error: err.message ?? 'sync failed' }, { status: 500 });
  }
}
