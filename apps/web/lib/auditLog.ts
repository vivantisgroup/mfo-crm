import type { AuditLogEntry } from './types';

// ─── In-memory + localStorage store ──────────────────────────────────────────
// This is the PRIMARY audit store. It always works, needs no network,
// and is never blocked by Firestore security rules.
// Firestore is attempted ONLY when we can confirm the user is authenticated.

const LS_KEY = 'mfo_audit_log';
const MAX_LOCAL_ENTRIES = 500;

function localStore(record: AuditLogEntry) {
  if (typeof localStorage === 'undefined') return;
  try {
    const existing: AuditLogEntry[] = JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
    const updated = [record, ...existing].slice(0, MAX_LOCAL_ENTRIES);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  } catch {
    // localStorage quota exceeded or private-mode block — silently skip
  }
}

/** Read the full local audit trail (newest first). */
export function loadLocalAuditLog(): AuditLogEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

// ─── Firestore helper ─────────────────────────────────────────────────────────
// We only try writing to Firestore if Firebase Auth already has a current user
// with a valid ID token. That prevents the "Missing or insufficient permissions"
// console error that Firebase SDK emits before our catch block runs.

async function tryFirestoreWrite(record: AuditLogEntry): Promise<void> {
  try {
    // 1. Check auth — skip entirely if no logged-in user
    const { getAuth }     = await import('firebase/auth');
    const { firebaseApp } = await import('@mfo-crm/config');
    const { getFirestore, collection, addDoc } = await import('firebase/firestore');

    const auth = getAuth(firebaseApp);
    const currentUser = auth.currentUser;
    if (!currentUser) return; // not authenticated → no Firestore attempt

    // 2. Refresh token to confirm it's still valid
    await currentUser.getIdToken(/* forceRefresh */ false);

    // 3. Write using the same version of Firestore as the rest of the app
    const db = getFirestore(firebaseApp);
    await addDoc(collection(db, 'audit_logs'), record);
  } catch {
    // Silently discard — local store is the source of truth.
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

let _seq = 0;

/**
 * Records an audit log entry for compliance and security.
 * Answers: WHO · WHEN · WHAT · WHERE.
 *
 * Strategy (in order):
 *   1. Write to localStorage (always, instant, zero network)
 *   2. Attempt Firestore only when user is authenticated (suppresses permission errors)
 *
 * NEVER throws — a log failure must never crash the calling action.
 */
export async function logAction(
  entry: Omit<AuditLogEntry, 'id' | 'occurredAt'>,
): Promise<void> {
  const record: AuditLogEntry = {
    ...entry,
    id:         `al-${Date.now()}-${(++_seq).toString(36)}`,
    occurredAt: new Date().toISOString(),
    ipAddress:  entry.ipAddress  ?? (typeof window !== 'undefined' ? 'client' : 'server'),
    userAgent:  entry.userAgent  ?? (typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'),
  };

  // ── 1. Local store (primary) ───────────────────────────────────────────────
  localStore(record);

  // ── 2. Dev console (useful during development) ────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    console.debug(
      `[Audit] ${record.userName} · ${record.action} · ${record.resourceType}/${record.resourceId}`,
    );
  }

  // ── 3. Firestore (best-effort, auth-gated to suppress permission errors) ──
  //    Fire-and-forget — we do NOT await so the caller is never blocked.
  void tryFirestoreWrite(record);
}

/** Convenience hook-style accessor */
export function useAudit() {
  return { log: logAction };
}
