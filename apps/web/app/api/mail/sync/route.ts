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
import { communicationService, CommunicationRecord } from '@/lib/communicationService';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

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
  contactName?: string;
  type?:      'family' | 'org';
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
    const primaryEmail = extractStr(f, 'email') || extractStr(f, 'primaryEmail');
    if (primaryEmail) map.set(primaryEmail.toLowerCase(), { familyId: famId, familyName: famName, type: 'family' });

    const contacts = await fsList(idToken, `tenants/${tenantId}/families/${famId}/contacts`);
    for (const ct of contacts) {
      const c   = ct.fields ?? {};
      const ctId    = ct.name?.split('/').pop() ?? '';
      const ctEmail = extractStr(c, 'email') || extractStr(c, 'primaryEmail');
      if (ctEmail) {
        map.set(ctEmail.toLowerCase(), { familyId: famId, familyName: famName, contactId: ctId, type: 'family' });
      }
    }
  }

  // Pre-load org names for robust mapping even if the org has no email
  const orgNamesMap = new Map<string, string>();
  
  // Load platform organizations
  const orgs = await fsList(idToken, `platform_orgs`);
  for (const org of orgs) {
    const o = org.fields ?? {};
    const orgId   = org.name?.split('/').pop() ?? '';
    const orgName = extractStr(o, 'name');
    orgNamesMap.set(orgId, orgName || 'Unknown Org');
    
    const primaryEmail = extractStr(o, 'email') || extractStr(o, 'primaryEmail');
    if (primaryEmail) map.set(primaryEmail.toLowerCase(), { familyId: orgId, familyName: orgName, type: 'org' });
  }

  // Load platform contacts and link to orgs
  const pContacts = await fsList(idToken, `platform_contacts`);
  for (const ct of pContacts) {
    const c   = ct.fields ?? {};
    const ctId    = ct.name?.split('/').pop() ?? '';
    const ctName  = extractStr(c, 'name');
    const orgId   = extractStr(c, 'orgId');
    const ctEmail = extractStr(c, 'email') || extractStr(c, 'primaryEmail');
    
    if (ctEmail) {
      const orgName = orgNamesMap.get(orgId) || 'Unknown Org';
      map.set(ctEmail.toLowerCase(), { familyId: orgId, familyName: orgName, contactId: ctId, contactName: ctName, type: 'org' });
    }
  }

  return map;
}

// ─── Get existing email IDs to deduplicate ────────────────────────────────────

async function getExistingMessageIds(tenantId: string): Promise<Set<string>> {
  const db = getAdminFirestore();
  const snap = await db.collection('communications')
    .where('tenant_id', '==', tenantId)
    .where('provider', '==', 'google')
    .limit(500)
    .get();
    
  const ids = new Set<string>();
  snap.forEach((doc: any) => {
    const msgId = doc.data().provider_message_id;
    if (msgId) ids.add(msgId);
  });
  return ids;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  console.log('[API ROUTE HIT] /api/mail/sync');
  try {
    const body       = await req.json();
    const uid        = body.uid        as string;
    const idToken    = body.idToken    as string;
    const tenantId   = body.tenantId   as string | undefined;
    const maxResults = body.maxResults as number ?? 50;
    const forceRepair= body.forceRepair=== true;

    if (!uid || !idToken) {
      return NextResponse.json({ error: 'uid and idToken required' }, { status: 400 });
    }

    // 1. Get valid (possibly refreshed) Google access token
    const accessToken = await getValidGoogleToken(uid, idToken);

    // 2. Build contact → family map for auto-linking
    const contactMap = tenantId ? await buildContactEmailMap(idToken, tenantId) : new Map();

    // 3. Get existing message IDs to avoid duplicates
    const existingIds = tenantId 
      ? await getExistingMessageIds(tenantId) 
      : new Set<string>();

    // 4. Fetch message list from Gmail — inbox and sent as SEPARATE queries
    //    (Gmail's labelIds param is an AND filter, so INBOX+SENT matches nothing useful)
    async function fetchGmailList(label: string, max: number): Promise<{ id: string; threadId: string }[]> {
      const url  = `${GMAIL}/users/me/messages?maxResults=${max}&labelIds=${label}`;
      const res  = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) {
        const err = await res.text();
        console.warn(`[mail/sync] Gmail ${label} list failed: ${err}`);
        return [];
      }
      const data = await res.json();
      return data.messages ?? [];
    }

    const half     = Math.ceil(maxResults / 2);
    const [inboxMsgs, sentMsgs] = await Promise.all([
      fetchGmailList('INBOX', half),
      fetchGmailList('SENT',  half),
    ]);

    // Merge and deduplicate by message ID
    const seen    = new Set<string>();
    const messages: { id: string }[] = [];
    for (const m of [...inboxMsgs, ...sentMsgs]) {
      if (!seen.has(m.id)) { seen.add(m.id); messages.push(m); }
    }

    let newEmails    = 0;
    let newActivities = 0;
    const errors: string[] = [];

    // 5. Fetch each message detail and write to Firestore
    for (const msg of messages) {
      if (!forceRepair && existingIds.has(msg.id)) continue;

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

        // Determine if it has attachments
        let hasAttachments = false;
        function walk(part: any) {
          if (!part || hasAttachments) return;
          if (part.filename && part.filename.trim() !== '') {
             hasAttachments = true;
             return;
          }
          for (const child of part.parts ?? []) walk(child);
        }
        walk(detail.payload);

        // Dispatch the email directly into the canonical Communication Layer
        const record: CommunicationRecord = {
          id: `gmail_${msg.id}`,
          tenant_id: tenantId || 'default',
          provider: 'google',
          type: 'email',
          direction,
          subject,
          body: detail.snippet ?? '', // Default to snippet if body extraction is complex
          snippet,
          from: fromEmail,
          to: toEmails,
          timestamp: receivedAt,
          thread_id: detail.threadId || msg.id,
          provider_message_id: msg.id,
          crm_entity_links: match ? [
            { type: match.type || 'family', id: match.familyId, name: match.familyName },
            ...(match.contactId ? [{ type: 'contact', id: match.contactId, name: match.contactName || match.familyName }] : [])
          ] : []
        };
        
        await communicationService.ingestMessage(record);
        newEmails++;

        if (!existingIds.has(msg.id)) existingIds.add(msg.id);
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
