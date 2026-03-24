/**
 * lib/usersAdmin.ts
 *
 * Client-callable helpers that delegate to /api/admin/users.
 *
 * idToken must be obtained on the CLIENT (auth.currentUser?.getIdToken())
 * and passed in — the server cannot access Firebase Auth session state.
 */

// ─── Create user ──────────────────────────────────────────────────────────────

export async function adminCreateFirebaseUser(
  email:       string,
  displayName: string,
  idToken:     string,
): Promise<{
  success:      boolean;
  userRecord?:  { uid: string; email: string; displayName: string };
  isNew?:       boolean;
  error?:       string;
  tempPassword?: string;
}> {
  try {
    const res = await fetch('/api/admin/users', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ idToken, email, displayName }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error ?? `Server error ${res.status}` };
    }

    return {
      success:      true,
      userRecord:   { uid: data.uid, email: data.email, displayName: data.displayName },
      isNew:        data.isNew,
      tempPassword: data.tempPassword,
    };
  } catch (error: any) {
    console.error('[adminCreateFirebaseUser]', error);
    return { success: false, error: error.message };
  }
}

// ─── Send password-reset / invite email ───────────────────────────────────────

export async function adminGeneratePasswordResetLink(
  email:    string,
  idToken:  string,
): Promise<{ success: boolean; link?: string; error?: string }> {
  try {
    const res = await fetch('/api/admin/users', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ idToken, email }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error ?? `Server error ${res.status}` };
    }

    return { success: true };
  } catch (error: any) {
    console.error('[adminGeneratePasswordResetLink]', error);
    return { success: false, error: error.message };
  }
}
