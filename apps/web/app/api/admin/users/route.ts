/**
 * POST /api/admin/users
 *
 * Creates a new Firebase Auth user via the Identity Toolkit REST API.
 * Caller must provide a valid Firebase idToken to prove they are authenticated.
 *
 * Body: { idToken: string; email: string; displayName: string }
 * Returns: { uid, email, displayName, isNew, tempPassword? }
 */

import { NextRequest, NextResponse } from 'next/server';

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

/** Verify that the caller is a genuine Firebase-authenticated user. */
async function verifyIdToken(idToken: string): Promise<{ uid: string } | null> {
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

    // Verify caller is authenticated
    const caller = await verifyIdToken(idToken);
    if (!caller) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    // Generate a secure random temp password
    const tempPassword =
      Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(36)).join('').slice(0, 16) + 'Aa1!';

    let uid:   string;
    let isNew: boolean;

    try {
      // Attempt to create new user
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
        // User already exists — we can't retrieve their uid without Admin SDK
        // Use a stable deterministic placeholder; ensureUserProfile reconciles on login
        uid   = `pending_${email.replace(/[^a-z0-9]/gi, '_')}`;
        isNew = false;
      } else {
        throw err;
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
 * POST /api/admin/users/reset-link
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
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

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
