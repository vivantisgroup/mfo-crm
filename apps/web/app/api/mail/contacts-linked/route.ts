import { NextRequest, NextResponse } from 'next/server';

// ─── GET /api/mail/contacts-linked?uid=&idToken=&email=&tenantId= ─────────────
// Returns email_log activity records where the given email address appears
// as sender or recipient. Used by Contact detail "Linked Emails" tab.

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;

async function fsList(idToken: string, path: string, pageSize = 50) {
  const url = `${FIRESTORE_BASE}/${path}?pageSize=${pageSize}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents ?? [];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const uid      = searchParams.get('uid');
    const idToken  = searchParams.get('idToken');
    const email    = searchParams.get('email');

    if (!uid || !idToken || !email) {
      return NextResponse.json({ error: 'uid, idToken, and email are required' }, { status: 400 });
    }

    // Fetch all email_logs for this user
    const logs = await fsList(idToken, `users/${uid}/email_logs`, 200);

    // Filter to those where the contact email appears
    const matched = logs
      .map((doc: any) => {
        const f = doc.fields ?? {};
        const fromEmail = f.fromEmail?.stringValue ?? '';
        const toRaw     = f.toEmail?.stringValue ?? f.to?.stringValue ?? '';
        // Search in both from and to
        const matches   = fromEmail.toLowerCase().includes(email.toLowerCase())
          || toRaw.toLowerCase().includes(email.toLowerCase());
        if (!matches) return null;
        return {
          id:        doc.name?.split('/').pop(),
          subject:   f.subject?.stringValue   ?? '(no subject)',
          fromName:  f.fromName?.stringValue  ?? '',
          fromEmail: f.fromEmail?.stringValue ?? '',
          snippet:   f.snippet?.stringValue   ?? '',
          createdAt: f.receivedAt?.stringValue ?? f.createdAt?.stringValue ?? '',
          labelIds:  f.labelIds?.arrayValue?.values?.map((v: any) => v.stringValue) ?? [],
        };
      })
      .filter(Boolean)
      .slice(0, 50);

    return NextResponse.json({ emails: matched });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
