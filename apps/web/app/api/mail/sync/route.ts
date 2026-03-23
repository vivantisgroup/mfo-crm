/**
 * /api/mail/sync/route.ts
 *
 * Triggers a server-side email sync for a given provider.
 * Uses the stored refresh token to fetch new emails from the provider,
 * writes email metadata to Firestore, and optionally auto-logs to CRM activities.
 *
 * POST body: { provider: 'microsoft' | 'google' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const uid = (await cookies()).get('firebase_uid')?.value;
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { provider } = await req.json() as { provider: string };
  if (provider !== 'microsoft' && provider !== 'google') {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
  }

  const adminDb = getAdminFirestore();
  const connSnap = await adminDb.doc(`users/${uid}/integrations/${provider}`).get();
  const conn = connSnap.data();

  if (!conn || conn.status !== 'connected') {
    return NextResponse.json({ error: 'Provider not connected' }, { status: 400 });
  }

  // Refresh token if needed
  let accessToken = conn._accessToken as string;
  if (Date.now() > (conn._expiresAt as number) - 60_000) {
    accessToken = await refreshAccessToken(provider, conn._refreshToken as string);
    await connSnap.ref.update({
      _accessToken: accessToken,
      _expiresAt:   Date.now() + 3500 * 1000,
    });
  }

  const syncWindowDays = (conn.syncWindowDays as number) ?? 30;
  const since = new Date(Date.now() - syncWindowDays * 86_400_000).toISOString();
  const newEmails: Array<Record<string, unknown>> = [];
  const errors: string[] = [];

  try {
    if (provider === 'microsoft') {
      const fetched = await fetchMicrosoftEmails(accessToken, since, conn.syncDirection as string);
      newEmails.push(...fetched);
    } else {
      const fetched = await fetchGoogleEmails(accessToken, since, conn.syncDirection as string);
      newEmails.push(...fetched);
    }
  } catch (e: any) {
    errors.push(e.message ?? 'Fetch failed');
  }

  // Write email log entries (dedup by messageId)
  const logsRef = adminDb.collection(`users/${uid}/email_logs`);
  let written = 0;
  for (const email of newEmails) {
    const existing = await logsRef.where('messageId', '==', email.messageId).limit(1).get();
    if (existing.empty) {
      await logsRef.add({
        uid,
        provider,
        loggedToCrm: conn.autoLogToCrm,
        ...email,
      });
      written++;
    }
  }

  const now = new Date().toISOString();
  await connSnap.ref.update({
    lastSyncAt:     now,
    lastSyncResult: errors.length ? 'error' : 'ok',
    emailsSynced:   (conn.emailsSynced ?? 0) + written,
  });

  return NextResponse.json({ newEmails: written, errors, lastSyncAt: now });
}

// ─── Provider-specific fetchers ────────────────────────────────────────────────

async function refreshAccessToken(provider: string, refreshToken: string): Promise<string> {
  if (provider === 'microsoft') {
    const res = await fetch(
      `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID ?? 'common'}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     process.env.MICROSOFT_CLIENT_ID     ?? '',
          client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
          grant_type:    'refresh_token',
          refresh_token: refreshToken,
        }),
      }
    );
    const data = await res.json();
    return data.access_token;
  } else {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID     ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    const data = await res.json();
    return data.access_token;
  }
}

async function fetchMicrosoftEmails(
  token:     string,
  since:     string,
  direction: string,
): Promise<Array<Record<string, unknown>>> {
  const filter = `receivedDateTime ge ${since}`;
  const select = 'id,subject,from,toRecipients,receivedDateTime,bodyPreview';
  const top    = 50;

  const inbound: Array<Record<string, unknown>> = [];

  if (direction === 'inbound' || direction === 'both') {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$filter=${encodeURIComponent(filter)}&$select=${select}&$top=${top}&$orderby=receivedDateTime desc`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = res.ok ? await res.json() : { value: [] };
    for (const m of (data.value ?? [])) {
      inbound.push({
        messageId:   m.id,
        subject:     m.subject ?? '(No subject)',
        fromEmail:   m.from?.emailAddress?.address ?? '',
        fromName:    m.from?.emailAddress?.name ?? '',
        toEmails:    (m.toRecipients ?? []).map((r: any) => r.emailAddress?.address),
        receivedAt:  m.receivedDateTime,
        direction:   'inbound',
        snippet:     (m.bodyPreview ?? '').slice(0, 280),
        loggedToCrm: false,
      });
    }
  }

  if (direction === 'outbound' || direction === 'both') {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/mailFolders/SentItems/messages?$filter=${encodeURIComponent(filter)}&$select=${select}&$top=${top}&$orderby=receivedDateTime desc`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = res.ok ? await res.json() : { value: [] };
    for (const m of (data.value ?? [])) {
      inbound.push({
        messageId:   m.id,
        subject:     m.subject ?? '(No subject)',
        fromEmail:   m.from?.emailAddress?.address ?? '',
        fromName:    m.from?.emailAddress?.name ?? '',
        toEmails:    (m.toRecipients ?? []).map((r: any) => r.emailAddress?.address),
        receivedAt:  m.receivedDateTime,
        direction:   'outbound',
        snippet:     (m.bodyPreview ?? '').slice(0, 280),
        loggedToCrm: false,
      });
    }
  }

  return inbound;
}

async function fetchGoogleEmails(
  token:     string,
  since:     string,
  direction: string,
): Promise<Array<Record<string, unknown>>> {
  const sinceMs = new Date(since).getTime();
  const sinceEpochSec = Math.floor(sinceMs / 1000);

  const queries: { q: string; dir: string }[] = [];
  if (direction === 'inbound' || direction === 'both') {
    queries.push({ q: `in:inbox after:${sinceEpochSec}`, dir: 'inbound' });
  }
  if (direction === 'outbound' || direction === 'both') {
    queries.push({ q: `in:sent after:${sinceEpochSec}`, dir: 'outbound' });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const { q, dir } of queries) {
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!listRes.ok) continue;
    const listData = await listRes.json();

    for (const msg of (listData.messages ?? []).slice(0, 25)) {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!detailRes.ok) continue;
      const detail = await detailRes.json();

      const headers: Array<{ name: string; value: string }> = detail.payload?.headers ?? [];
      const get = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

      const from    = get('From');
      const fromMatch = from.match(/^(?:"?(.+?)"?\s*<(.+?)>|(.+))$/);
      const fromName  = fromMatch?.[1] ?? fromMatch?.[3] ?? from;
      const fromEmail = fromMatch?.[2] ?? fromMatch?.[3] ?? from;

      results.push({
        messageId:   msg.id,
        subject:     get('Subject') || '(No subject)',
        fromEmail,
        fromName,
        toEmails:    get('To').split(',').map((s: string) => s.trim()),
        receivedAt:  new Date(parseInt(detail.internalDate ?? '0')).toISOString(),
        direction:   dir,
        snippet:     (detail.snippet ?? '').slice(0, 280),
        loggedToCrm: false,
      });
    }
  }

  return results;
}
