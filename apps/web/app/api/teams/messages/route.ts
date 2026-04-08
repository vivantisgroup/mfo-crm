import { NextRequest, NextResponse } from 'next/server';

const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID ?? 'mfo-crm';

/**
 * POST /api/teams/messages
 *
 * Fetches messages for a Microsoft Teams channel or chat.
 *
 * The client reads the Microsoft access token directly from Firestore (using the
 * client SDK) and passes it in the request body. This avoids any dependency on the
 * Firebase Admin SDK for the hot path, which can fail with invalid_rapt in local dev.
 *
 * Supports multi-user scenarios: the CRM login user (system@vivantisgroup.com) can
 * have a different Microsoft Teams account (marcelo.gavazzi@transparenza-advisors.com)
 * configured in Settings. The tokens are stored under the CRM UID, and the Microsoft
 * identity is whatever account the user authorized via OAuth.
 *
 * Body:
 *   uid           - Firebase UID of the CRM user
 *   teamId?       - MS Teams group ID
 *   channelId?    - MS Teams channel ID
 *   chatId?       - MS Teams chat ID
 *   msAccessToken?  - Valid MS access token read from Firestore by the client (preferred path)
 *   refreshToken?   - MS refresh token when access token is expired (server refreshes it)
 *   idToken?        - Firebase ID token (used only for writing refreshed tokens back)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      uid,
      teamId,
      channelId,
      chatId,
      msAccessToken: clientProvidedToken,
      refreshToken,
      idToken,
    } = body;

    if (!uid) {
      return NextResponse.json({ error: 'uid is required' }, { status: 400 });
    }

    if (!chatId && (!teamId || !channelId)) {
      return NextResponse.json(
        { error: 'Either chatId, or both teamId and channelId are required' },
        { status: 400 }
      );
    }

    let userToken = clientProvidedToken as string | undefined;

    // ── Path 1: Client provided a valid access token (no server DB lookup needed) ──
    // This is the preferred path. Client reads from Firestore directly and passes
    // the token here. No Admin SDK required.

    // ── Path 2: Token expired — client passes refreshToken, server refreshes it ──
    if (!userToken && refreshToken) {
      userToken = await refreshMicrosoftToken(refreshToken, uid, idToken);
    }

    // ── Path 3: Fallback — try Admin SDK (may fail in local dev with invalid_rapt) ──
    if (!userToken) {
      try {
        const { getValidMicrosoftToken } = await import('@/lib/microsoftTokenRefresh');
        userToken = await getValidMicrosoftToken(uid, idToken);
      } catch (e: any) {
        console.warn('[teams/messages] All token paths failed:', String(e?.message).substring(0, 150));
      }
    }

    if (!userToken) {
      console.warn('[teams/messages] No Microsoft access token could be resolved for uid:', uid);
      return NextResponse.json({
        messages: [],
        error: 'No Microsoft access token available. Please re-authorize Teams in Settings → Messaging Sync.',
      });
    }

    // ── Call Microsoft Graph API ──────────────────────────────────────────────────
    if (chatId?.startsWith('mock-') || teamId?.startsWith('mock-')) {
      return NextResponse.json({ messages: [] });
    }

    const endpoint = chatId
      ? `https://graph.microsoft.com/v1.0/chats/${chatId}/messages?$top=50`
      : `https://graph.microsoft.com/v1.0/teams/${teamId}/channels/${channelId}/messages?$top=50`;

    const messagesRes = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    if (!messagesRes.ok) {
      const errBody = await messagesRes.text();
      console.warn('[teams/messages] Graph API error:', messagesRes.status, errBody.substring(0, 300));
      return NextResponse.json({
        messages: [],
        error: `Graph API error ${messagesRes.status}: ${errBody.substring(0, 200)}`,
      });
    }

    const msgsData = await messagesRes.json();
    return NextResponse.json({
      messages: (msgsData.value || []).reverse(), // oldest first for chat flow
    });
  } catch (err: any) {
    console.error('[teams/messages] Unhandled error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Refreshes a Microsoft OAuth token using the refresh token.
 * Resolves Microsoft app credentials dynamically (Firestore system/integrations → env vars).
 * Persists the new token back to Firestore so the next client read is fresh.
 */
async function refreshMicrosoftToken(
  refreshToken: string,
  uid: string,
  idToken?: string
): Promise<string | undefined> {
  // Resolve Microsoft app credentials
  let clientId     = process.env.MICROSOFT_CLIENT_ID     ?? '';
  let clientSecret = process.env.MICROSOFT_CLIENT_SECRET ?? '';
  let tenantId     = process.env.MICROSOFT_TENANT_ID     ?? 'common';

  try {
    const { getAdminFirestore } = await import('@/lib/firebaseAdmin');
    const db   = getAdminFirestore();
    const snap = await db.doc('system/integrations').get();
    const ms   = snap.data()?.microsoft;
    if (ms?.enabled && ms?.appId && ms?.clientSecret) {
      clientId     = ms.appId;
      clientSecret = ms.clientSecret;
      if (ms.tenantId) tenantId = ms.tenantId;
    }
  } catch {
    // Admin SDK unavailable — fall back to env vars (already set above)
  }

  if (!clientId || !clientSecret) return undefined;

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const res = await fetch(tokenUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });

  if (!res.ok) {
    console.warn('[teams/messages] Token refresh failed:', res.status);
    return undefined;
  }

  const data           = await res.json();
  const newAccessToken = data.access_token as string;
  const newRefresh     = data.refresh_token || refreshToken;
  const newExpiresAt   = Date.now() + (data.expires_in ?? 3600) * 1000;

  if (!newAccessToken) return undefined;

  // Persist the refreshed token so the client gets fresh values next time.
  // Try Admin SDK first; fall back to Firestore REST API with the user's idToken.
  const fields = {
    _accessToken:  { stringValue:  newAccessToken },
    _refreshToken: { stringValue:  newRefresh     },
    _expiresAt:    { integerValue: String(newExpiresAt) },
  };

  try {
    const { getAdminFirestore } = await import('@/lib/firebaseAdmin');
    const db = getAdminFirestore();
    await db.doc(`users/${uid}/integrations/microsoft`).set(
      { _accessToken: newAccessToken, _refreshToken: newRefresh, _expiresAt: newExpiresAt },
      { merge: true }
    );
  } catch {
    // Admin SDK failed — try REST API
    if (idToken) {
      const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/integrations/microsoft` +
        `?updateMask.fieldPaths=_accessToken&updateMask.fieldPaths=_refreshToken&updateMask.fieldPaths=_expiresAt`;
      await fetch(url, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      }).catch(() => { /* best-effort */ });
    }
  }

  return newAccessToken;
}

// Keep GET returning a helpful error
export async function GET() {
  return NextResponse.json(
    { error: 'Use POST. Send { uid, teamId, channelId, msAccessToken } in the request body.' },
    { status: 405 }
  );
}
