"use server";

/**
 * lib/usersAdmin.ts
 *
 * Server-side user management helpers — delegates to /api/admin/users
 * so that the Firebase API key is available in the correct server context.
 *
 * No service account / Admin SDK required.
 */

import { getAuth } from 'firebase/auth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getCallerIdToken(): Promise<string> {
  // Dynamically import firebase/auth to avoid bundling issues in server actions
  const { getAuth: _getAuth } = await import('firebase/auth');
  const { firebaseApp } = await import('@mfo-crm/config');
  const auth = _getAuth(firebaseApp);
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated — please refresh the page.');
  return token;
}

// ─── Create user ──────────────────────────────────────────────────────────────

export async function adminCreateFirebaseUser(
  email:       string,
  displayName: string,
): Promise<{
  success:      boolean;
  userRecord?:  { uid: string; email: string; displayName: string };
  isNew?:       boolean;
  error?:       string;
  tempPassword?: string;
}> {
  try {
    const idToken = await getCallerIdToken();

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
      success:     true,
      userRecord:  { uid: data.uid, email: data.email, displayName: data.displayName },
      isNew:       data.isNew,
      tempPassword: data.tempPassword,
    };
  } catch (error: any) {
    console.error('[adminCreateFirebaseUser]', error);
    return { success: false, error: error.message };
  }
}

// ─── Send password-reset / invite email ───────────────────────────────────────

export async function adminGeneratePasswordResetLink(
  email: string,
): Promise<{ success: boolean; link?: string; error?: string }> {
  try {
    const idToken = await getCallerIdToken();

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
