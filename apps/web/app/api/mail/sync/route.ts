/**
 * POST /api/mail/sync/route.ts
 *
 * Syncs messages for the authenticated user for Google Workspace (Gmail) or Microsoft 365 (Outlook).
 * - Fetches up to 50 messages from the respective API
 * - Deduplicates by provider message ID
 * - Auto-links emails to known CRM contacts/families by email address
 * - Creates CRM activity entries for matched emails
 * - Writes email metadata to users/{uid}/email_logs (via communications collection)
 *
 * Request body:
 *   { uid: string; idToken: string; provider: 'google' | 'microsoft'; tenantId?: string; maxResults?: number }
 *
 * No Admin SDK required — uses Firestore REST API with Firebase ID token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidGoogleToken } from '@/lib/googleTokenRefresh';
import { getValidMicrosoftToken } from '@/lib/microsoftTokenRefresh';
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

/** List documents in a Firestore collection via REST. */
async function fsList(idToken: string, path: string, pageSize = 200): Promise<any[]> {
  const url = `${fsUrl(path)}?pageSize=${pageSize}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) return [];
  const json = await res.json();
  return json.documents ?? [];
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

  // Pre-load org names for robust mapping
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

async function getExistingMessageIds(tenantId: string, provider: string): Promise<Set<string>> {
  const db = getAdminFirestore();
  const snap = await db.collection('communications')
    .where('tenant_id', '==', tenantId)
    .where('provider', '==', provider)
    .limit(500)
    .get();
    
  const ids = new Set<string>();
  snap.forEach((doc: any) => {
    const msgId = doc.data().provider_message_id;
    if (msgId) ids.add(msgId);
  });
  return ids;
}

// ─── Google Helpers ─────────────────────────────────────────────────────────────

const GMAIL = 'https://gmail.googleapis.com/gmail/v1';

function gmailHeader(headers: any[], name: string): string {
  return headers?.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function extractEmails(headerValue: string): string[] {
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
  const parts = body?.parts ?? [];
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      const text = decodeBase64(part.body.data);
      return text.slice(0, 300).replace(/\s+/g, ' ').trim();
    }
  }
  return fallbackSnippet?.slice(0, 300) ?? '';
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  console.log('[API ROUTE HIT] /api/mail/sync');
  try {
    const body       = await req.json();
    const uid        = body.uid        as string;
    const idToken    = body.idToken    as string;
    const provider   = body.provider   as 'google' | 'microsoft' ?? 'google'; // Added provider extraction!
    const tenantId   = body.tenantId   as string | undefined;
    const maxResults = body.maxResults as number ?? 50;
    const forceRepair= body.forceRepair=== true;

    if (!uid || !idToken || !tenantId) {
      return NextResponse.json({ error: 'uid, idToken, and tenantId required' }, { status: 400 });
    }

    let accessToken = '';
    try {
      if (provider === 'microsoft') {
        accessToken = await getValidMicrosoftToken(uid, idToken, tenantId);
      } else {
        accessToken = await getValidGoogleToken(uid, idToken, tenantId);
      }
    } catch (err: any) {
       console.error(`Token refresh failed for ${provider}`, err);
       return NextResponse.json({ error: `Sync failed: Failed to read ${provider} integration record or refresh token. The user may not have connected their account yet.` }, { status: 404 });
    }

    const contactMap = await buildContactEmailMap(idToken, tenantId);

    // 3. Get existing message IDs to avoid duplicates
    const existingIds = await getExistingMessageIds(tenantId, provider);

    const db = getAdminFirestore();

    let newEmails    = 0;
    let newActivities = 0;
    const errors: string[] = [];

    // 4. Provider-specific fetch and index implementation
    // =======================================================
    if (provider === 'google') {
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

        const seen    = new Set<string>();
        const messages: { id: string }[] = [];
        for (const m of [...inboxMsgs, ...sentMsgs]) {
          if (!seen.has(m.id)) { seen.add(m.id); messages.push(m); }
        }

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
            
            const fromEmails = extractEmails(fromRaw);
            const toEmails   = extractEmails(toRaw);
            const fromEmail  = fromEmails[0] ?? '';
            const fromName   = fromRaw.replace(/<.*>/, '').trim().replace(/"/g, '') || fromEmail;
            const direction  = labelIds.includes('SENT') ? 'outbound' : 'inbound';
            const snippet    = getSnippet(detail.payload, detail.snippet ?? '');
            const receivedAt = dateStr
              ? new Date(dateStr).toISOString()
              : new Date(Number(detail.internalDate)).toISOString();

            const searchEmails = direction === 'inbound' ? fromEmails : toEmails;
            let match: ContactMatch | undefined;
            for (const e of searchEmails) {
              match = contactMap.get(e.toLowerCase());
              if (match) break;
            }

            const record: CommunicationRecord = {
              id: `gmail_${msg.id}`,
              tenant_id: tenantId || 'default',
              provider: 'google',
              type: 'email',
              direction,
              subject,
              body: detail.snippet ?? '',
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
            
            // Replicate to email_logs for Inbox pane
            await db.collection('tenants').doc(tenantId).collection('members').doc(uid).collection('email_logs').doc(record.id).set({
              provider: 'google',
              subject: record.subject,
              fromEmail: record.from,
              fromName: fromName,
              toEmails: record.to,
              snippet: record.snippet,
              direction: record.direction,
              receivedAt: record.timestamp,
              gmailMessageId: msg.id,
              labelIds: labelIds,
              hasAttachments: (detail.payload?.parts?.some((p: any) => p.filename && p.filename.length > 0)) ? true : false,
              loggedToCrm: match ? true : false,
            }, { merge: true });

            newEmails++;

            if (!existingIds.has(msg.id)) existingIds.add(msg.id);
          } catch (e: any) {
            errors.push(`msg ${msg.id}: ${e.message}`);
          }
        }
    } 
    else if (provider === 'microsoft') {
        const url = `https://graph.microsoft.com/v1.0/me/messages?$select=id,conversationId,subject,from,toRecipients,receivedDateTime,bodyPreview,isDraft&$filter=isDraft eq false&$top=${maxResults}&$orderby=receivedDateTime desc`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.ok) {
           const errText = await res.text();
           throw new Error(`MS Graph API failed: ${errText}`);
        }
        
        const msData = await res.json();
        const messages = msData.value ?? [];
        
        // We also need to determine user's own email to decide inbound/outbound
        const meRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', { headers: { Authorization: `Bearer ${accessToken}` } });
        const meData = meRes.ok ? await meRes.json() : {};
        const myEmail = (meData.mail || meData.userPrincipalName || '').toLowerCase();

        for (const msg of messages) {
           if (!forceRepair && existingIds.has(msg.id)) continue;
           try {
              const subject = msg.subject || '(no subject)';
              const fromEmail = msg.from?.emailAddress?.address || '';
              const fromName = msg.from?.emailAddress?.name || fromEmail;
              const toEmails = (msg.toRecipients || []).map((t: any) => t.emailAddress?.address).filter(Boolean);
              
              // Assume if sender is me, it's outbound, otherwise inbound.
              const direction = (fromEmail.toLowerCase() === myEmail) ? 'outbound' : 'inbound';
              const receivedAt = new Date(msg.receivedDateTime).toISOString();
              const snippet = msg.bodyPreview || '';

              const searchEmails = direction === 'inbound' ? [fromEmail] : toEmails;
              let match: ContactMatch | undefined;
              for (const e of searchEmails) {
                match = contactMap.get(e.toLowerCase());
                if (match) break;
              }

              const record: CommunicationRecord = {
                id: `ms_${msg.id}`,
                tenant_id: tenantId || 'default',
                provider: 'microsoft',
                type: 'email',
                direction,
                subject,
                body: msg.bodyPreview || '',
                snippet,
                from: fromEmail,
                to: toEmails,
                timestamp: receivedAt,
                thread_id: msg.conversationId || msg.id,
                provider_message_id: msg.id,
                crm_entity_links: match ? [
                  { type: match.type || 'family', id: match.familyId, name: match.familyName },
                  ...(match.contactId ? [{ type: 'contact', id: match.contactId, name: match.contactName || match.familyName }] : [])
                ] : []
              };
              
              await communicationService.ingestMessage(record);
              
              await db.collection('tenants').doc(tenantId).collection('members').doc(uid).collection('email_logs').doc(record.id).set({
                provider: 'microsoft',
                subject: record.subject,
                fromEmail: record.from,
                fromName: fromName,
                toEmails: record.to,
                snippet: record.snippet,
                direction: record.direction,
                receivedAt: record.timestamp,
                gmailMessageId: msg.id, // we map MS msg id here for legacy compatibility
                labelIds: ['INBOX'], // fallback label if no specific folder mapping is yet developed
                hasAttachments: msg.hasAttachments || false,
                loggedToCrm: match ? true : false,
              }, { merge: true });

              newEmails++;
  
              if (!existingIds.has(msg.id)) existingIds.add(msg.id);
           } catch (e: any) {
              errors.push(`msg ${msg.id}: ${e.message}`);
           }
        }
    }


    // 5. Update last sync timestamp
    const updatePayload = {
      lastSyncAt:     new Date().toISOString(),
      lastSyncResult: errors.length > 0 ? 'error' : 'ok',
      emailsSynced:   newEmails,
    };
    await fetch(`${fsUrl(`tenants/${tenantId}/members/${uid}/integrations/${provider}`)}?updateMask.fieldPaths=lastSyncAt&updateMask.fieldPaths=lastSyncResult&updateMask.fieldPaths=emailsSynced`, {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `projects/${PROJECT_ID}/databases/(default)/documents/tenants/${tenantId}/members/${uid}/integrations/${provider}`,
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
