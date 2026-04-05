import { NextRequest, NextResponse } from 'next/server';

const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID ?? 'mfo-crm';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function fsUpdate(idToken: string, path: string, data: Record<string, any>) {
  const toFsValue = (val: any): any => {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'boolean')  return { booleanValue: val };
    if (typeof val === 'number')   return { doubleValue: val };
    if (typeof val === 'string')   return { stringValue: val };
    if (Array.isArray(val)) return { arrayValue: { values: val.map(toFsValue) } };
    if (typeof val === 'object') {
      const fields: any = {};
      for (const [k, v] of Object.entries(val)) fields[k] = toFsValue(v);
      return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
  };
  
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toFsValue(v)]));
  const updateMask = Object.keys(data).map(k => `updateMask.fieldPaths=${k}`).join('&');
  const url = `${FIRESTORE_BASE}/${path}?${updateMask}`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
     const t = await res.text();
     throw new Error(`Firestore update failed: ${res.status} ${t}`);
  }
  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const { uid, idToken, tenantId, emailLogId, links } = await req.json();

    if (!uid || !idToken || !tenantId || !emailLogId || !Array.isArray(links)) {
      return NextResponse.json({ error: 'uid, idToken, tenantId, emailLogId, links required' }, { status: 400 });
    }

    // Support both direct admin library or REST fallback. For production stability we can use fsUpdate.
    // Replace the legacy email_logs path with the global unified communications collection.
    const crm_entity_ids = links.map(l => l.id);

    await fsUpdate(idToken, `communications/${emailLogId}`, {
      crm_entity_links: links,
      crm_entity_ids: crm_entity_ids,
      linkedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Record linking error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
