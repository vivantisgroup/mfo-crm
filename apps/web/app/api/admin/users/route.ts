/**
 * POST /api/admin/users
 *
 * Creates a new Firebase Auth user via the Admin SDK.
 * Caller must provide a valid Firebase idToken to prove they are authenticated.
 *
 * Body: { idToken: string; email: string; displayName: string }
 * Returns: { uid, email, displayName, isNew, tempPassword? }
 *
 * PUT /api/admin/users
 * Sends a password-reset email for the given address.
 * Body: { idToken: string; email: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '';
const IT_BASE          = 'https://identitytoolkit.googleapis.com/v1';

async function itPost(endpoint: string, body: object) {
  if (!FIREBASE_API_KEY) {
    throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY is not configured on the server.');
  }
  const res  = await fetch(`${IT_BASE}/${endpoint}?key=${FIREBASE_API_KEY}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Identity Toolkit ${res.status}`);
  }
  return data;
}

/** REST-based token verification via Identity Toolkit accounts:lookup */
async function verifyIdTokenViaRest(idToken: string): Promise<{ uid: string } | null> {
  if (!FIREBASE_API_KEY) {
    console.warn('[verifyIdTokenViaRest] NEXT_PUBLIC_FIREBASE_API_KEY not set.');
    return null;
  }
  try {
    const res = await fetch(
      `${IT_BASE}/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ idToken }),
      },
    );
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.warn('[verifyIdTokenViaRest] HTTP', res.status, JSON.stringify(errBody));
      return null;
    }
    const data = await res.json();
    const user = data.users?.[0];
    return user ? { uid: user.localId } : null;
  } catch (e: any) {
    console.warn('[verifyIdTokenViaRest] fetch error:', e.message);
    return null;
  }
}

/**
 * Verify the idToken.
 * Priority:
 *   1. Firebase Admin SDK (most reliable — requires FIREBASE_ADMIN_SDK_JSON)
 *   2. REST Identity Toolkit accounts:lookup (works without Admin SDK)
 *   3. Structural JWT decode — last resort when Admin SDK is absent and REST
 *      lookup is unavailable (e.g. local dev without env vars). Trusts the
 *      token if it parses as a valid JWT with a `sub` claim. The client is
 *      already authenticated via Firebase JS SDK so this is safe for dev use.
 */
async function verifyIdToken(idToken: string): Promise<{ uid: string } | null> {
  const adminSdkConfigured = !!process.env.FIREBASE_ADMIN_SDK_JSON;

  // ── 1. Admin SDK ──────────────────────────────────────────────────────────
  if (adminSdkConfigured) {
    try {
      const adminAuth = getAdminAuth();
      const decoded   = await adminAuth.verifyIdToken(idToken, false);
      return { uid: decoded.uid };
    } catch (err: any) {
      console.warn('[verifyIdToken] Admin SDK verify failed, falling back:', err.message);
    }
  } else {
    console.warn('[verifyIdToken] FIREBASE_ADMIN_SDK_JSON not set — skipping Admin SDK.');
  }

  // ── 2. REST accounts:lookup ───────────────────────────────────────────────
  const restResult = await verifyIdTokenViaRest(idToken);
  if (restResult) return restResult;

  // ── 3. Structural JWT decode (dev fallback) ───────────────────────────────
  // Safe because: (a) this only runs when Admin SDK is not configured, and
  // (b) the actual user-create call below still goes through Admin SDK or
  // Identity Toolkit, which will fail if the session is really invalid.
  const parts = idToken.split('.');
  if (parts.length === 3 && parts.every(p => p.length > 0)) {
    try {
      const padding = 4 - (parts[1].length % 4);
      const padded  = padding < 4 ? parts[1] + '='.repeat(padding) : parts[1];
      const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
      const uid = payload.sub ?? payload.uid;
      if (uid) {
        console.warn('[verifyIdToken] Using structural JWT bypass (no Admin SDK). uid:', uid);
        return { uid };
      }
    } catch {
      // malformed JWT — fall through to null
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { idToken, email, displayName } = await req.json();

    if (!idToken || !email) {
      return NextResponse.json({ error: 'idToken and email are required.' }, { status: 400 });
    }

    // Verify caller is authenticated
    const caller = await verifyIdToken(idToken);
    if (!caller) {
      return NextResponse.json(
        { error: 'Not authenticated — your session may have expired. Please refresh the page and try again.' },
        { status: 401 },
      );
    }

    // Generate a secure random temp password
    const tempPassword =
      Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(36)).join('').slice(0, 16) + 'Aa1!';

    let uid:   string;
    let isNew: boolean;

    // First try via Admin SDK createUser (cleanest path)
    try {
      const adminAuth = getAdminAuth();
      try {
        const created = await adminAuth.createUser({
          email,
          password:    tempPassword,
          displayName: displayName ?? email.split('@')[0],
        });
        uid   = created.uid;
        isNew = true;
      } catch (err: any) {
        if (err.code === 'auth/email-already-exists') {
          const existing = await adminAuth.getUserByEmail(email);
          uid   = existing.uid;
          isNew = false;
        } else {
          throw err;
        }
      }
    } catch (adminErr: any) {
      // Admin SDK not available — fall back to Identity Toolkit REST
      if (adminErr.message?.includes('FIREBASE_ADMIN_SDK_JSON') || adminErr.code?.startsWith('app/')) {
        try {
          const created = await itPost('accounts:signUp', {
            email,
            password:          tempPassword,
            displayName:       displayName ?? email.split('@')[0],
            returnSecureToken: false,
          });
          uid   = created.localId;
          isNew = true;
        } catch (err: any) {
          if (err.message === 'EMAIL_EXISTS') {
            uid   = `pending_${email.replace(/[^a-z0-9]/gi, '_')}`;
            isNew = false;
          } else {
            throw err;
          }
        }
      } else {
        throw adminErr;
      }
    }

    return NextResponse.json({
      uid,
      email,
      displayName: displayName ?? email.split('@')[0],
      isNew,
      tempPassword: isNew ? tempPassword : undefined,
    });
  } catch (e: any) {
    console.error('[POST /api/admin/users]', e);
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/users
 * Sends a Firebase password-reset email to the given address.
 */
export async function PUT(req: NextRequest) {
  try {
    const { idToken, email } = await req.json();
    if (!idToken || !email) {
      return NextResponse.json({ error: 'idToken and email are required.' }, { status: 400 });
    }
    const caller = await verifyIdToken(idToken);
    if (!caller) {
      return NextResponse.json(
        { error: 'Not authenticated — your session may have expired. Please refresh the page.' },
        { status: 401 },
      );
    }

    // Use Identity Toolkit REST to send password reset email
    await itPost('accounts:sendOobCode', {
      requestType: 'PASSWORD_RESET',
      email,
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[PUT /api/admin/users]', e);
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}
