/**
 * /api/mail/test/route.ts
 *
 * Tests an existing mail connection by making a lightweight API call
 * to the provider (Gmail profile or MS Graph /me).
 *
 * No Admin SDK — uses uid + idToken from POST body, reads the stored
 * access token from Firestore via REST API, refreshes if expired.
 *
 * POST body: { provider: 'microsoft' | 'google', uid: string, idToken: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidGoogleToken }       from '@/lib/googleTokenRefresh';
import { getValidMicrosoftToken }    from '@/lib/microsoftTokenRefresh';

const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID ?? 'mfo-crm';

/** Read a Firestore document via REST API using the user's ID token. */
async function readFirestoreDoc(idToken: string, path: string): Promise<any | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
  const res  = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) return null;
  const body = await res.json();
  if (body.error) return null;

  /** Unwrap a Firestore REST value object to a plain JS value. */
  function unwrap(v: any): any {
    if (!v) return null;
    if ('stringValue'    in v) return v.stringValue;
    if ('integerValue'   in v) return Number(v.integerValue);
    if ('doubleValue'    in v) return Number(v.doubleValue);
    if ('booleanValue'   in v) return v.booleanValue;
    if ('nullValue'      in v) return null;
    if ('mapValue'       in v) {
      const m: any = {};
      for (const [k, val] of Object.entries<any>(v.mapValue.fields ?? {})) m[k] = unwrap(val);
      return m;
    }
    if ('arrayValue'     in v) return (v.arrayValue.values ?? []).map(unwrap);
    return null;
  }

  const fields = body.fields ?? {};
  const doc: any = {};
  for (const [k, val] of Object.entries<any>(fields)) doc[k] = unwrap(val);
  return doc;
}

export async function POST(req: NextRequest) {
  // 1. Parse body
  const body = await req.json().catch(() => ({})) as {
    provider?: string;
    uid?:      string;
    idToken?:  string;
  };

  const { provider, uid, idToken, tenantId } = body as { provider: string, uid: string, idToken: string, tenantId: string };
  if (!uid || !idToken || !tenantId) {
    return NextResponse.json({ ok: false, error: 'uid, idToken, tenantId required' }, { status: 400 });
  }
  if (!provider || !['google', 'microsoft'].includes(provider)) {
    return NextResponse.json({ ok: false, error: 'Invalid provider' }, { status: 400 });
  }

  const start = Date.now();

  try {
    let accessToken: string;

    if (provider === 'google') {
      // Use the token refresh helper — refreshes if expired
      try {
        accessToken = await getValidGoogleToken(uid, idToken, tenantId);
      } catch (e: any) {
        return NextResponse.json({
          ok:      false,
          latency: Date.now() - start,
          details: `Token error: ${e.message}. Please re-connect your Google account.`,
        });
      }

      // Test: call Gmail profile endpoint
      const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (gmailRes.ok) {
        const data    = await gmailRes.json();
        const latency = Date.now() - start;
        return NextResponse.json({
          ok:      true,
          latency,
          details: `✅ Connected as ${data.emailAddress} · ${latency}ms round-trip`,
        });
      } else {
        const errText = await gmailRes.text().catch(() => '');
        return NextResponse.json({
          ok:      false,
          latency: Date.now() - start,
          details: `Gmail API rejected the token (HTTP ${gmailRes.status}) — try re-connecting. ${errText}`.trim(),
        });
      }

    } else {
      // Microsoft — use refresh helper
      try {
        accessToken = await getValidMicrosoftToken(uid, idToken, tenantId);
      } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message || 'Not connected', latency: Date.now() - start });
      }

      const msRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,displayName', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (msRes.ok) {
        const data    = await msRes.json();
        const latency = Date.now() - start;
        return NextResponse.json({
          ok:      true,
          latency,
          details: `✅ Connected as ${data.mail ?? data.displayName} · ${latency}ms round-trip`,
        });
      } else {
        return NextResponse.json({
          ok:      false,
          latency: Date.now() - start,
          details: `Microsoft Graph rejected the token (HTTP ${msRes.status}) — try re-connecting.`,
        });
      }
    }

  } catch (e: any) {
    return NextResponse.json({
      ok:      false,
      latency: Date.now() - start,
      details: `Network error: ${e.message}`,
    }, { status: 502 });
  }
}
