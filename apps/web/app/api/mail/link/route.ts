/**
 * POST /api/mail/link
 *
 * Links an email_log document to one or more CRM records.
 * Also writes back-reference activity entries to the CRM.
 *
 * Body: { uid, idToken, emailLogId, links: CrmLinkTarget[], tenantId }
 *
 * Each CrmLinkTarget:
 *   { type, id, name, tenantId }
 *   type = 'contact' | 'family' | 'org' | 'ticket' | 'activity' | 'task'
 *
 * Action:
 *   1. PATCH users/{uid}/email_logs/{emailLogId}  → set crmLinks array
 *   2. For each unique tenantId in links → write activity back-ref
 */

import { NextRequest, NextResponse } from 'next/server';

export interface CrmLinkTarget {
  type:     'contact' | 'family' | 'org' | 'ticket' | 'activity' | 'task';
  id:       string;
  name:     string;
  tenantId: string;
}

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

async function fsWrite(idToken: string, path: string, data: Record<string, any>, updateMask?: string[]) {
  let url = fsUrl(path);
  if (updateMask?.length) {
    url += '?' + updateMask.map(f => `updateMask.fieldPaths=${f}`).join('&');
  }
  const res = await fetch(url, {
    method:  'PATCH',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields: toFsFields(data) }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firestore write /${path} failed: ${body}`);
  }
  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const uid:        string           = body.uid;
    const idToken:    string           = body.idToken;
    const emailLogId: string           = body.emailLogId;
    const links:      CrmLinkTarget[]  = body.links ?? [];
    const tenantId:   string           = body.tenantId ?? '';

    if (!uid || !idToken || !emailLogId) {
      return NextResponse.json({ error: 'uid, idToken, emailLogId required' }, { status: 400 });
    }

    // 1. Update email_log with crmLinks array
    await fsWrite(
      idToken,
      `users/${uid}/email_logs/${emailLogId}`,
      { crmLinks: links, linkedToCrm: links.length > 0, updatedAt: new Date().toISOString() },
      ['crmLinks', 'linkedToCrm', 'updatedAt'],
    );

    // 2. Read the email_log to get subject/from for activity back-references
    let subject = '(email)';
    let fromEmail = '';
    let snippet = '';
    let receivedAt = new Date().toISOString();
    try {
      const logRes = await fetch(fsUrl(`users/${uid}/email_logs/${emailLogId}`), {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (logRes.ok) {
        const doc = await logRes.json();
        const f   = doc.fields ?? {};
        subject   = f.subject?.stringValue   ?? subject;
        fromEmail = f.fromEmail?.stringValue  ?? fromEmail;
        snippet   = f.snippet?.stringValue    ?? '';
        receivedAt = f.receivedAt?.stringValue ?? receivedAt;
      }
    } catch { /* non-fatal */ }

    // 3. Write back-reference activity for each CRM link
    const errors: string[] = [];
    for (const link of links) {
      const tId = link.tenantId || tenantId;
      if (!tId) continue;

      try {
        const actId = `email_link_${emailLogId}_${link.type}_${link.id}`;
        const actData: Record<string, any> = {
          tenantId:      tId,
          activityType:  'email',
          type:          'email',
          direction:     'inbound',
          subject,
          fromEmail,
          snippet,
          source:        'email_link',
          emailLogId,
          linkedRecordType: link.type,
          linkedRecordId:   link.id,
          linkedRecordName: link.name,
          occurredAt:    receivedAt,
          createdAt:     new Date().toISOString(),
        };

        // Add type-specific fields for direct navigation
        if (link.type === 'family')  actData.familyId   = link.id;
        if (link.type === 'contact') actData.contactId  = link.id;
        if (link.type === 'org')     actData.orgId      = link.id;
        if (link.type === 'ticket')  actData.ticketId   = link.id;

        await fsWrite(idToken, `tenants/${tId}/activities/${actId}`, actData);
      } catch (e: any) {
        errors.push(`link ${link.type}/${link.id}: ${e.message}`);
      }
    }

    return NextResponse.json({ ok: true, linked: links.length, errors });
  } catch (err: any) {
    console.error('[mail/link] error:', err);
    return NextResponse.json({ error: err.message ?? 'link failed' }, { status: 500 });
  }
}

/**
 * DELETE /api/mail/link — Remove a specific CRM link from an email_log
 * Body: { uid, idToken, emailLogId, links: CrmLinkTarget[] }  (pass the NEW full array)
 */
export async function DELETE(req: NextRequest) {
  // Reuse POST logic — caller passes the updated (filtered) links array
  return POST(req);
}
