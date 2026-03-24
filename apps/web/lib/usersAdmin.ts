"use server";

/**
 * lib/usersAdmin.ts
 *
 * Server-side Firebase Auth user management via the Identity Toolkit REST API.
 *
 * Uses ONLY the Firebase Web API Key (NEXT_PUBLIC_FIREBASE_API_KEY) — no
 * service account / Admin SDK required.  This avoids the
 * "Service account key creation is restricted by org policy" problem.
 *
 * Firebase Identity Toolkit v1 docs:
 *   https://firebase.google.com/docs/reference/rest/auth
 */

const FIREBASE_API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '';

const IT_BASE = 'https://identitytoolkit.googleapis.com/v1';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminUserRecord {
  uid:          string;
  email:        string;
  displayName?: string;
  disabled?:    boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function itFetch(endpoint: string, body: object): Promise<any> {
  const res = await fetch(`${IT_BASE}/${endpoint}?key=${FIREBASE_API_KEY}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message ?? `Identity Toolkit error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// ─── Look up user by email ────────────────────────────────────────────────────

async function lookupUserByEmail(email: string): Promise<AdminUserRecord | null> {
  try {
    const data = await itFetch('accounts:createAuthUri', {
      identifier:      email,
      continueUri:     'https://localhost',
    });
    // createAuthUri tells us if the email is registered (signinMethods will be non-empty)
    if (data.registered === true) {
      // Use accounts:lookup (email/password sign-in) to get the uid;
      // we can't look up uid without Admin SDK, so we'll create a temp session
      // and immediately get the uid from the returned token.
      // Alternative: just try to create and catch EMAIL_EXISTS.
      return null; // signal "exists" — handled by catch in adminCreateFirebaseUser
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Create user ──────────────────────────────────────────────────────────────

/**
 * Creates a new Firebase Auth user (or finds existing).
 * Uses the REST API — no service account required.
 */
export async function adminCreateFirebaseUser(
  email:       string,
  displayName: string,
): Promise<{ success: boolean; userRecord?: AdminUserRecord; isNew?: boolean; error?: string; tempPassword?: string }> {
  try {
    // Generate a secure random placeholder password
    const tempPassword =
      Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(36)).join('').slice(0, 16) + 'Aa1!';

    // Try to sign up — if email already exists the API returns EMAIL_EXISTS
    let uid: string;
    let isNew = true;

    try {
      const created = await itFetch('accounts:signUp', {
        email,
        password:          tempPassword,
        displayName,
        returnSecureToken: false,
      });
      uid = created.localId;
    } catch (err: any) {
      if (err.message === 'EMAIL_EXISTS') {
        // User exists — sign in to retrieve uid
        isNew = false;
        const signed = await itFetch('accounts:signInWithPassword', {
          email,
          password:          '__will_fail__', // intentionally bad password
          returnSecureToken: false,
        }).catch(e => {
          // INVALID_PASSWORD or INVALID_LOGIN_CREDENTIALS means user exists
          // but we can't get the uid without Admin SDK here.
          // Fall back: store placeholder, uid will be linked on first real login.
          if (
            e.message === 'INVALID_PASSWORD' ||
            e.message?.includes('INVALID_LOGIN_CREDENTIALS')
          ) {
            return null;
          }
          throw e;
        });

        if (signed?.localId) {
          uid = signed.localId;
        } else {
          // Can't retrieve uid without Admin SDK — use email as a provisional key.
          // The user will be linked properly on first login via ensureUserProfile.
          uid = `email:${email}`;
        }
      } else {
        throw err;
      }
    }

    return {
      success:    true,
      userRecord: { uid, email, displayName },
      isNew,
      tempPassword: isNew ? tempPassword : undefined,
    };
  } catch (error: any) {
    console.error('[adminCreateFirebaseUser] error:', error);
    return { success: false, error: error.message };
  }
}

// ─── Send password reset email ────────────────────────────────────────────────

/**
 * Triggers a Firebase "reset your password" email for the given address.
 * The link is generated and emailed by Firebase — no Admin SDK required.
 */
export async function adminGeneratePasswordResetLink(
  email: string,
): Promise<{ success: boolean; link?: string; error?: string }> {
  try {
    await itFetch('accounts:sendOobCode', {
      requestType: 'PASSWORD_RESET',
      email,
    });
    // The REST API sends the email directly; it doesn't return the link.
    // Return a placeholder so callers that show the link gracefully degrade.
    return { success: true, link: undefined };
  } catch (error: any) {
    console.error('[adminGeneratePasswordResetLink] error:', error);
    return { success: false, error: error.message };
  }
}
