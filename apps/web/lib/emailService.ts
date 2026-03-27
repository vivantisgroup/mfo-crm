/**
 * Database Schema (Firebase/Firestore) for Email Integration
 *
 * Designed to cache email metadata out of the OAuth API responses 
 * and seamlessly link them into CRM records for immediate querying.
 *
 * COLLECTIONS:
 * 1. email_accounts: stores connected OAuth accounts (tokens are encrypted or restricted).
 * 2. email_messages: stores individual email components synced from the providers.
 */
import { firebaseApp } from '@mfo-crm/config';
import { getFirestore, collection, query, where, orderBy, getDocs } from 'firebase/firestore';

const db = getFirestore(firebaseApp);

export interface EmailAccount {
  id?: string;
  tenantId: string;
  userId: string;
  provider: 'google' | 'microsoft' | 'nylas';
  emailAddress: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  lastSyncAt: number;
  status: 'active' | 'needs_reauth' | 'disconnected';
  createdAt: string;
}

export interface EmailMessage {
  id?: string;
  tenantId: string;
  accountId: string;      // maps to EmailAccount.id
  threadId: string;       // grouping threads (Gsuite ThreadId or Graph ConversationId)
  crmContactId?: string;  // Explicit link to a CRM contact
  folder: 'inbox' | 'sent' | 'drafts' | 'archive' | 'trash';
  subject: string;
  snippet: string;
  sender: { name: string; email: string };
  recipients: { name: string; email: string; type: 'to' | 'cc' | 'bcc' }[];
  bodyHtml: string;       // NOTE: Cleaned and sanitized on insert
  bodyText: string;
  isRead: boolean;
  hasAttachments: boolean;
  attachments?: { filename: string; contentType: string; size: number; url: string }[];
  receivedAt: string;     // ISO Date Time
  createdAt: string;      // ISO Date Time locally ingested
}

// ─── Query Helpers ──────────────────────────────────────────────────────────

/**
 * Returns the timeline of all synced emails relating to a specific CRM Contact.
 * Relies on matching the Contact ID natively.
 */
export async function getEmailsForContact(tenantId: string, contactId: string): Promise<EmailMessage[]> {
  const q = query(
    collection(db, 'email_messages'),
    where('tenantId', '==', tenantId),
    where('crmContactId', '==', contactId),
    orderBy('receivedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as EmailMessage));
}

/**
 * Grabs the active inbox view for a connected email account.
 */
export async function getInboxView(accountId: string): Promise<EmailMessage[]> {
  const q = query(
    collection(db, 'email_messages'),
    where('accountId', '==', accountId),
    where('folder', '==', 'inbox'),
    orderBy('receivedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as EmailMessage));
}
