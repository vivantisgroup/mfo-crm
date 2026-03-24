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

/** Verify the idToken — Admin SDK first, REST fallback if anything fails */
async function verifyIdToken(idToken: string): Promise<{ uid: string } | null> {
  // Try Admin SDK first
  try {
    const adminAuth = getAdminAuth();
    const decoded   = await adminAuth.verifyIdToken(idToken, false); // don't check revocation for speed
    return { uid: decoded.uid };
  } catch (err: any) {
    // Always fall back to REST — covers misconfigured creds, network blips, revocation checks
    console.warn('[verifyIdToken] Admin SDK failed, trying REST fallback:', err.message);
  }

  // REST fallback
  return verifyIdTokenViaRest(idToken);
}

/** REST-based token verification via Identity Toolkit accounts:lookup */
async function verifyIdTokenViaRest(idToken: string): Promise<{ uid: string } | null> {
  if (!FIREBASE_API_KEY) return null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ idToken }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const user = data.users?.[0];
    return user ? { uid: user.localId } : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { idToken, email, displayName } = await req.json();

    if (!idToken || !email) {
      return NextResponse.json({ error: 'idToken and email are required.' }, { status: 400 });
    }

    // Verify caller is authenticated via Admin SDK
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
          // Fetch the existing user's real UID via Admin SDK
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

    // Use Admin SDK to generate a password reset link, then send via Identity Toolkit
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
