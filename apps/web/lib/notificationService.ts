/**
 * notificationService.ts
 *
 * In-app notification system for per-user alerts.
 * Stored at:  users/{uid}/notifications/{id}
 *
 * Triggers:
 *   - role_change  → fired by updateMemberRole()
 *   - status_change → fired by setMemberStatus()
 *   - welcome      → fired by addMemberToTenant()
 *   - system       → platform-generated alerts
 */

import { firebaseApp } from '@mfo-crm/config';
import {
  getFirestore,
  collection, doc, addDoc, updateDoc, getDocs, query,
  where, orderBy, onSnapshot, writeBatch, Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

const db = getFirestore(firebaseApp);

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType = 'role_change' | 'status_change' | 'welcome' | 'system';

export interface AppNotification {
  id:        string;
  uid:       string;           // recipient uid
  type:      NotificationType;
  title:     string;
  message:   string;
  read:      boolean;
  link?:     string;           // optional deep link
  createdAt: string;
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function createNotification(
  recipientUid: string,
  type:         NotificationType,
  title:        string,
  message:      string,
  link?:        string,
): Promise<void> {
  const now = new Date().toISOString();
  await addDoc(collection(db, 'users', recipientUid, 'notifications'), {
    uid: recipientUid, type, title, message, read: false, link: link ?? null, createdAt: now,
  });
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getNotifications(uid: string): Promise<AppNotification[]> {
  const snap = await getDocs(
    query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification));
}

// ─── Real-time listener ────────────────────────────────────────────────────────

export function subscribeToNotifications(
  uid:      string,
  callback: (notifications: AppNotification[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc')),
    snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification)));
    },
    () => callback([]),   // on error, empty list
  );
}

// ─── Mark read ────────────────────────────────────────────────────────────────

export async function markNotificationRead(uid: string, notifId: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'notifications', notifId), { read: true });
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  const snap = await getDocs(
    query(collection(db, 'users', uid, 'notifications'), where('read', '==', false))
  );
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
}
