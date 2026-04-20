/**
 * userProfileService.ts
 *
 * Full-featured, production-ready user profile service.
 * All data is persisted in Firestore under users/{uid}.
 * NEVER uses mock data.
 */

import { firebaseApp } from '@mfo-crm/config';
import {
  getFirestore, doc, getDoc, updateDoc, setDoc,
} from 'firebase/firestore';
import {
  getAuth, updateProfile as fbUpdateProfile,
  updateEmail as fbUpdateEmail, sendEmailVerification,
} from 'firebase/auth';
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject,
} from 'firebase/storage';

const db      = getFirestore(firebaseApp);
const auth    = getAuth(firebaseApp);
const storage = getStorage(firebaseApp);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfileData {
  uid:          string;
  displayName:  string;
  email:        string;
  phone:        string;
  jobTitle:     string;
  department:   string;
  timezone:     string;   // IANA identifier, e.g. "America/Sao_Paulo"
  language:     string;   // ISO 639-1, e.g. "en" | "pt"
  dateFormat:   string;   // e.g. "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD"
  numberFormat: string;   // e.g. "1.234,56" | "1,234.56"
  currency:     string;   // e.g. "BRL" | "USD"
  photoURL:     string | null;
  signatureImageURL?: string | null;
  address?:     string;
  useCustomAddressForSignature?: boolean;
  mfaEnabled:   boolean;
  createdAt:    string;
  updatedAt:    string;
  lastLoginAt?: string;
  // notification prefs
  notifEmail:      boolean;
  notifInApp:      boolean;
  notifTaskAssign: boolean;
  notifMentions:   boolean;
  notifDigest:     'none' | 'daily' | 'weekly';
}

export type ProfilePatch = Partial<Omit<UserProfileData, 'uid' | 'createdAt' | 'mfaEnabled' | 'lastLoginAt'>>;

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getUserProfileData(uid: string): Promise<UserProfileData | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfileData;
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Update editable profile fields.
 * Also syncs displayName and photoURL to Firebase Auth profile.
 */
export async function saveUserProfile(
  uid:   string,
  patch: ProfilePatch,
): Promise<void> {
  const now = new Date().toISOString();
  const ref = doc(db, 'users', uid);

  // Upsert (create if profile doc doesn't exist yet)
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { uid, ...patch, createdAt: now, updatedAt: now });
  } else {
    await updateDoc(ref, { ...patch, updatedAt: now });
  }

  // Sync to Firebase Auth user record
  const fbUser = auth.currentUser;
  if (fbUser) {
    const authPatch: { displayName?: string; photoURL?: string | null } = {};
    if (patch.displayName !== undefined) authPatch.displayName = patch.displayName;
    if (patch.photoURL    !== undefined) authPatch.photoURL    = patch.photoURL;
    if (Object.keys(authPatch).length > 0) {
      await fbUpdateProfile(fbUser, authPatch);
    }

    // Email change requires verification
    if (patch.email && patch.email !== fbUser.email) {
      await fbUpdateEmail(fbUser, patch.email);
      await sendEmailVerification(fbUser);
    }
  }
}

/**
 * Upload a new avatar image and update both Firestore + Auth profile.
 * Returns the download URL.
 */
export async function uploadAvatar(uid: string, file: File): Promise<string> {
  const ext  = file.name.split('.').pop() ?? 'jpg';
  const path = `avatars/${uid}/avatar.${ext}`;
  const ref  = storageRef(storage, path);
  await uploadBytes(ref, file, { contentType: file.type });
  const url = await getDownloadURL(ref);

  // Persist to Firestore + Firebase Auth
  await saveUserProfile(uid, { photoURL: url });

  return url;
}

/**
 * Upload a new digital signature image and update the Firestore profile.
 * Returns the download URL.
 */
export async function uploadSignatureImage(uid: string, file: File): Promise<string> {
  const ext  = file.name.split('.').pop() ?? 'png';
  const path = `signatures/${uid}/signature.${ext}`;
  const ref  = storageRef(storage, path);
  await uploadBytes(ref, file, { contentType: file.type });
  const url = await getDownloadURL(ref);

  await saveUserProfile(uid, { signatureImageURL: url });

  return url;
}

/**
 * Remove the avatar and reset to null.
 */
export async function removeAvatar(uid: string): Promise<void> {
  try {
    const path = `avatars/${uid}/avatar.jpg`;
    await deleteObject(storageRef(storage, path));
  } catch { /* no avatar to delete */ }

  await saveUserProfile(uid, { photoURL: null });
}

/**
 * Build a default profile object for a new user.
 */
export function buildDefaultProfile(
  uid:         string,
  displayName: string,
  email:       string,
): UserProfileData {
  const now = new Date().toISOString();
  let timezone = 'UTC';
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* */ }

  return {
    uid,
    displayName,
    email,
    phone:        '',
    jobTitle:     '',
    department:   '',
    timezone,
    language:     'en',
    dateFormat:   'DD/MM/YYYY',
    numberFormat: '1.234,56',
    currency:     'USD',
    photoURL:     null,
    signatureImageURL: null,
    address:      '',
    useCustomAddressForSignature: false,
    mfaEnabled:   false,
    createdAt:    now,
    updatedAt:    now,
    notifEmail:      true,
    notifInApp:      true,
    notifTaskAssign: true,
    notifMentions:   true,
    notifDigest:     'daily',
  };
}
