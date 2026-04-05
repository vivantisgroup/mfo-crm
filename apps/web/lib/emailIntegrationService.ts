/**
 * emailIntegrationService.ts
 *
 * Production-ready service for per-user email & calendar integrations.
 *
 * Firestore schema
 * ─────────────────────────────────────────────────────────────────
 *  users/{uid}/integrations/{provider}   ← connection record
 *  users/{uid}/email_logs/{id}           ← synced email headers (metadata only, no body storage)
 *  activities/{id}                        ← CRM activity entries (shared with rest of CRM)
 *
 * OAuth flow
 * ─────────────────────────────────────────────────────────────────
 * Both Microsoft and Google use PKCE Authorization Code flow.
 * The actual OAuth redirect is handled server-side by Next.js API routes
 * (/api/oauth/microsoft/start, /api/oauth/google/start) which handle:
 *   1. Generating state + code_verifier, storing in session
 *   2. Redirecting to provider
 *   3. Exchanging code for tokens (/api/oauth/{provider}/callback)
 *   4. Writing the connection record to Firestore
 *   5. Redirecting back to /settings?section=mail
 *
 * The UI calls this service only to READ state and trigger disconnect / manual sync.
 */

import { firebaseApp } from '@mfo-crm/config';
import {
  getFirestore, collection, doc, getDoc, setDoc, updateDoc,
  deleteDoc, addDoc, getDocs, query, orderBy, limit,
  serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { logAction } from './auditLog';

const db = getFirestore(firebaseApp);

// ─── Types ────────────────────────────────────────────────────────────────────

export type MailProvider = 'microsoft' | 'google';
export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'expired';

export interface MailConnectionRecord {
  provider:        MailProvider;
  status:          ConnectionStatus;
  connectedEmail:  string;
  connectedAt:     string;           // ISO
  lastSyncAt?:     string;           // ISO
  lastSyncResult?: 'ok' | 'error';
  errorMessage?:   string;
  scopes:          string[];          // e.g. ['Mail.Read', 'Calendars.Read']
  // Sync settings (user-configurable)
  syncDirection:   'inbound' | 'outbound' | 'both';
  autoLogToCrm:    boolean;
  syncWindowDays:  number;           // 7 | 14 | 30 | 60 | 90
  // Stats
  emailsSynced?:   number;
  calEventsSynced?: number;
}

export interface EmailLogEntry {
  id:           string;
  uid:          string;
  provider:     MailProvider;
  messageId:    string;              // provider message ID (stable)
  subject:      string;
  fromEmail:    string;
  fromName:     string;
  toEmails:     string[];
  receivedAt:   string;             // ISO
  direction:    'inbound' | 'outbound';
  linkedFamilyId?: string;
  linkedFamilyName?: string;
  linkedContactId?: string;
  loggedToCrm:  boolean;
  loggedAt?:    string;
  crmActivityId?: string;
  snippet?:     string;             // truncated preview (no body stored)
}

export interface SyncResult {
  newEmails:     number;
  newActivities: number;
  errors:        string[];
  lastSyncAt:    string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function integrationRef(uid: string, provider: MailProvider) {
  return doc(db, 'users', uid, 'integrations', provider);
}

function emailLogsRef(uid: string) {
  return collection(db, 'users', uid, 'email_logs');
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/** Load one provider's connection record. Returns null if never connected. */
export async function getMailConnection(
  uid:      string,
  provider: MailProvider,
): Promise<MailConnectionRecord | null> {
  const snap = await getDoc(integrationRef(uid, provider));
  if (!snap.exists()) return null;
  return snap.data() as MailConnectionRecord;
}

/** Load all provider records for a user. */
export async function getAllMailConnections(uid: string): Promise<Partial<Record<MailProvider, MailConnectionRecord>>> {
  const providers: MailProvider[] = ['microsoft', 'google'];
  const result: Partial<Record<MailProvider, MailConnectionRecord>> = {};
  await Promise.all(
    providers.map(async p => {
      const rec = await getMailConnection(uid, p);
      if (rec) result[p] = rec;
    })
  );
  return result;
}

/** Get recent email log entries for this user. */
export async function getRecentEmailLogs(
  uid:   string,
  count: number = 20,
): Promise<EmailLogEntry[]> {
  const q = query(emailLogsRef(uid), orderBy('receivedAt', 'desc'), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as EmailLogEntry));
}

// ─── OAuth launch ─────────────────────────────────────────────────────────────

/**
 * Kick off OAuth authorization.
 * Returns the URL of the Next.js API route that will handle the redirect.
 * In production this uses PKCE so no secret is exposed client-side.
 */
export function buildOAuthStartUrl(
  provider: MailProvider,
  returnTo: string = '/settings?section=mail',
  uid?: string,
): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const params = new URLSearchParams({ returnTo });
  if (uid) params.set('uid', uid);
  return `${base}/api/oauth/${provider}/start?${params}`;
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/**
 * Called by the OAuth callback API route after tokens are exchanged.
 * Writes the initial connection record to Firestore.
 */
export async function saveMailConnection(
  uid:    string,
  record: Omit<MailConnectionRecord, 'connectedAt'>,
): Promise<void> {
  await setDoc(integrationRef(uid, record.provider), {
    ...record,
    connectedAt: new Date().toISOString(),
  }, { merge: true });
}

/** Update only the sync settings for an existing connection. */
export async function updateSyncSettings(
  uid:      string,
  provider: MailProvider,
  patch: Pick<MailConnectionRecord, 'syncDirection' | 'autoLogToCrm' | 'syncWindowDays'>,
): Promise<void> {
  await updateDoc(integrationRef(uid, provider), {
    syncDirection:  patch.syncDirection,
    autoLogToCrm:   patch.autoLogToCrm,
    syncWindowDays: patch.syncWindowDays,
  });
  logAction({
    tenantId: uid, userId: uid, userName: '',
    action: 'MAIL_SYNC_SETTINGS_UPDATED',
    resourceId: provider, resourceType: 'mail_integration',
    resourceName: `Sync settings updated for ${provider}`, status: 'success',
  });
}

/**
 * Disconnect a provider.
 * Removes the Firestore record (tokens are already revoked server-side via /api/oauth/:provider/revoke).
 */
export async function disconnectMailProvider(
  uid:      string,
  provider: MailProvider,
  actorName: string,
): Promise<void> {
  // Call server-side revoke endpoint first (fire and forget — with strict 4s timeout)
  try {
    await Promise.race([
      fetch(`/api/oauth/${provider}/revoke`, { method: 'POST' }),
      new Promise(r => setTimeout(r, 4000))
    ]);
  } catch { /* best-effort */ }

  await deleteDoc(integrationRef(uid, provider));

  logAction({
    tenantId: uid, userId: uid, userName: actorName,
    action: 'MAIL_DISCONNECTED',
    resourceId: provider, resourceType: 'mail_integration',
    resourceName: `${provider} mail integration disconnected`, status: 'success',
  });
}

/**
 * Trigger a manual sync on the server side.
 * Returns a SyncResult summary.
 */
export async function triggerManualSync(
  uid:      string,
  provider: MailProvider,
  idToken:  string,
): Promise<SyncResult> {
  const tenant = typeof localStorage !== 'undefined'
    ? JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}')
    : {};

  const res = await fetch('/api/mail/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, idToken, provider, tenantId: tenant?.id }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Sync request failed');
  }

  const result: SyncResult = await res.json();

  // Persist last sync time in Firestore (client SDK write is fine here)
  try {
    await updateDoc(integrationRef(uid, provider), {
      lastSyncAt: result.lastSyncAt,
      lastSyncResult: result.errors.length > 0 ? 'error' : 'ok',
      emailsSynced: result.newEmails,
    });
  } catch { /* non-critical */ }

  return result;
}

/**
 * Log a single email to the CRM activity feed manually (from email log view).
 */
export async function logEmailToCrm(
    uid:    string,
    entry:  EmailLogEntry,
    records: Array<{ id: string, name: string }>
  ): Promise<string[]> {
    const activityIds: string[] = [];
    
    // 1. Post an activity for each selected CRM record
    for (const record of records) {
      const activityRef = await addDoc(collection(db, 'activities'), {
        tenantId: '',        // filled server-side
        familyId: record.id,
        familyName: record.name,
        type: 'email',
        direction: entry.direction,
        subject: entry.subject,
        fromEmail: entry.fromEmail,
        fromName: entry.fromName,
        toEmails: entry.toEmails,
        snippet: entry.snippet ?? '',
        provider: entry.provider,
        messageId: entry.messageId,
        loggedBy: uid,
        createdAt: new Date().toISOString(),
      });
      activityIds.push(activityRef.id);
    }

    // 2. Update the source email log document with the linked records
    if (entry.id) {
       try {
         const logRef = doc(db, 'users', uid, 'email_logs', entry.id);
         await updateDoc(logRef, {
            linkedRecordIds: records.map(r => r.id),
            linkedRecordNames: records.map(r => r.name),
            tagIds: records.map(r => r.id) // Fallback migration mapping
         });
       } catch (err) {
         console.error('Failed to update email log entry with linked records:', err);
       }
    }

    return activityIds;
  }

// ─── Connection test ──────────────────────────────────────────────────────────

export interface ConnectionTestResult {
  ok:             boolean;
  latency:        number;   // ms
  details:        string;
  needsReconnect?: boolean; // set by client when token expiry is detected
}

export async function testMailConnection(
  provider: MailProvider,
  uid:      string,
  idToken:  string,
): Promise<ConnectionTestResult> {
  const start = Date.now();
  try {
    const res = await fetch('/api/mail/test', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ provider, uid, idToken }),
    });
    const data = await res.json().catch(() => ({}));
    return {
      ok:      res.ok,
      latency: Date.now() - start,
      details: res.ok
        ? (data.details ?? 'Connection successful')
        : (data.error  ?? data.details ?? `HTTP ${res.status}`),
    };
  } catch (e: any) {
    return { ok: false, latency: Date.now() - start, details: e.message };
  }
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export const PROVIDER_META: Record<MailProvider, {
  icon: string; name: string; description: string;
  scopes: string[]; docsUrl: string;
}> = {
  microsoft: {
    icon: '🟦',
    name: 'Microsoft 365 (Outlook)',
    description: 'OAuth 2.0 PKCE · Exchange Online · Microsoft Graph API',
    scopes: ['Mail.Read', 'Mail.Send', 'Calendars.ReadWrite', 'offline_access'],
    docsUrl: 'https://learn.microsoft.com/en-us/graph/api/overview',
  },
  google: {
    icon: '🔴',
    name: 'Google Workspace (Gmail)',
    description: 'OAuth 2.0 PKCE · Gmail API · Google Calendar API',
    scopes: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/calendar'],
    docsUrl: 'https://developers.google.com/gmail/api',
  },
};

export function formatLastSync(iso?: string): string {
  if (!iso) return 'Never';
  const ago = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (ago < 1) return 'Just now';
  if (ago < 60) return `${ago} minute${ago > 1 ? 's' : ''} ago`;
  const h = Math.floor(ago / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString();
}
