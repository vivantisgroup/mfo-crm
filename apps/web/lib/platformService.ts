/**
 * platformService.ts
 *
 * All Firestore reads/writes for the platform bootstrap, user management,
 * and tenant management live here. This is the single authoritative layer
 * between the UI and the database.
 *
 * Firestore schema
 * ─────────────────────────────────────────────────────────────
 *  platform/config                    ← singleton: is the platform initialized?
 *  users/{uid}                        ← user profiles + roles
 *  tenants/{tenantId}                 ← tenant records
 *  tenants/{tenantId}/members/{uid}   ← per-tenant role assignment
 *  audit_logs/{id}                    ← immutable audit trail
 */

import { firebaseApp } from '@mfo-crm/config';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  writeBatch,
  addDoc,
  updateDoc,
  deleteDoc,
  arrayRemove,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';

// Single db instance — always from the same firebase/firestore version as the helpers above
const db = getFirestore(firebaseApp);

// ─── Exported types ────────────────────────────────────────────────────────────

export type PlatformRole =
  | 'saas_master_admin'
  | 'tenant_admin'
  | 'relationship_manager'
  | 'cio'
  | 'controller'
  | 'compliance_officer'
  | 'report_viewer'
  | 'external_advisor';

export interface PlatformConfig {
  initialized:    boolean;
  initializedAt?: string;
  initializedBy?: string; // uid of first SaaS Master Admin
  platformName:   string;
  version:        string;
}

export interface UserProfile {
  uid:           string;
  email:         string;
  displayName:   string;
  role:          PlatformRole;
  /** null for saas_master_admin — they own the whole platform */
  tenantId:      string | null;
  /** additional tenants this user can access */
  tenantIds:     string[];
  mfaEnabled:    boolean;
  mfaEnrolledAt?: string;
  status:        'active' | 'invited' | 'suspended';
  createdAt:     string;
  updatedAt?:    string;
  lastLoginAt?:  string;
  photoURL?:     string;
}


export interface TenantRecord {
  id:          string;
  name:        string;
  plan:        'trial' | 'standard' | 'enterprise';
  status:      'active' | 'suspended' | 'trial';
  isInternal:  boolean;
  brandColor:  string;
  createdAt:   string;
  createdBy:   string; // uid
  expiresAt?:  string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowISO() { return new Date().toISOString(); }

// ─── Platform config ──────────────────────────────────────────────────────────

const PLATFORM_CONFIG_REF = () => doc(db, 'platform', 'config');

export async function getPlatformConfig(): Promise<PlatformConfig | null> {
  const snap = await getDoc(PLATFORM_CONFIG_REF());
  if (!snap.exists()) return null;
  return snap.data() as PlatformConfig;
}

export async function isPlatformInitialized(): Promise<boolean> {
  const cfg = await getPlatformConfig();
  return cfg?.initialized === true;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => d.data() as UserProfile);
}




export async function getSaasMasterAdmins(): Promise<UserProfile[]> {
  const q    = query(collection(db, 'users'), where('role', '==', 'saas_master_admin'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as UserProfile);
}

/** Get all users that belong to a specific tenant */
export async function getTenantUsers(tenantId: string): Promise<UserProfile[]> {
  const q    = query(collection(db, 'users'), where('tenantIds', 'array-contains', tenantId));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as UserProfile);
}

/** Update any field on a user profile. Only SaaS Master Admins can change roles. */
export async function updateUserProfile(
  uid:    string,
  patch:  Partial<Omit<UserProfile, 'uid' | 'createdAt'>>,
): Promise<void> {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { ...patch, updatedAt: nowISO() });
}

/** Touch lastLoginAt on every sign-in */
export async function touchLastLogin(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { lastLoginAt: nowISO() });
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export async function getAllTenants(): Promise<TenantRecord[]> {
  const snap = await getDocs(collection(db, 'tenants'));
  return snap.docs.map(d => d.data() as TenantRecord);
}

export async function getTenant(id: string): Promise<TenantRecord | null> {
  const snap = await getDoc(doc(db, 'tenants', id));
  if (!snap.exists()) return null;
  return snap.data() as TenantRecord;
}

/**
 * Fetch all tenants accessible to a given user profile.
 * A user may have multiple tenantIds (e.g. SaaS Master Admin + client tenants).
 */
export async function getTenantsForUser(profile: UserProfile): Promise<TenantRecord[]> {
  const ids = Array.from(new Set([
    ...(profile.tenantIds ?? []),
    ...(profile.tenantId ? [profile.tenantId] : []),
  ]));
  if (ids.length === 0) return [];
  const results = await Promise.all(ids.map(id => getTenant(id)));
  return results.filter((t): t is TenantRecord => t !== null);
}

export async function createTenant(
  tenantData: Omit<TenantRecord, 'createdAt'>,
): Promise<void> {
  const ref = doc(db, 'tenants', tenantData.id);
  await setDoc(ref, { ...tenantData, createdAt: nowISO() });
}


// ─── Platform bootstrap ───────────────────────────────────────────────────────

/**
 * Called when the very first user registers on a fresh platform.
 * Creates:
 *   1. platform/config — marks platform as initialized
 *   2. tenants/master — the internal HQ tenant
 *   3. users/{uid}   — the first user as saas_master_admin
 */
export async function bootstrapPlatform(
  firebaseUser: FirebaseUser,
  displayName:  string,
): Promise<UserProfile> {
  const batch = writeBatch(db);
  const now   = nowISO();

  // 1. Master tenant
  const MASTER_TENANT_ID = 'master';
  const masterTenant: TenantRecord = {
    id:         MASTER_TENANT_ID,
    name:       'Platform HQ',
    plan:       'enterprise',
    status:     'active',
    isInternal: true,
    brandColor: '#6366f1',
    createdAt:  now,
    createdBy:  firebaseUser.uid,
  };
  batch.set(doc(db, 'tenants', MASTER_TENANT_ID), masterTenant);

  // 2. User profile
  const profile: UserProfile = {
    uid:         firebaseUser.uid,
    email:       firebaseUser.email!,
    displayName: displayName || firebaseUser.email!.split('@')[0],
    role:        'saas_master_admin',
    tenantId:    MASTER_TENANT_ID,
    tenantIds:   [MASTER_TENANT_ID],
    mfaEnabled:  false,
    status:      'active',
    createdAt:   now,
    lastLoginAt: now,
  };
  batch.set(doc(db, 'users', firebaseUser.uid), profile);

  // 3. Platform config
  const platformCfg: PlatformConfig = {
    initialized:   true,
    initializedAt: now,
    initializedBy: firebaseUser.uid,
    platformName:  'MFO Nexus',
    version:       '2.0.0',
  };
  batch.set(doc(db, 'platform', 'config'), platformCfg);

  await batch.commit();

  // Audit
  await addDoc(collection(db, 'audit_logs'), {
    tenantId:     MASTER_TENANT_ID,
    userId:       firebaseUser.uid,
    userName:     profile.displayName,
    action:       'PLATFORM_INITIALIZED',
    resourceId:   'platform',
    resourceType: 'platform',
    resourceName: 'Platform bootstrap — first SaaS Master Admin registered',
    status:       'success',
    ipAddress:    'client',
    userAgent:    typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    occurredAt:   now,
  });

  return profile;
}

/**
 * Called for every sign-in after the platform is initialized.
 * Creates the user profile on their first sign-in if it doesn't
 * already exist (e.g. invited via email).
 */
export async function ensureUserProfile(
  firebaseUser: FirebaseUser,
  displayName?: string,
): Promise<UserProfile> {
  const existing = await getUserProfile(firebaseUser.uid);
  if (existing) {
    await touchLastLogin(firebaseUser.uid);
    return { ...existing, lastLoginAt: nowISO() };
  }

  // New sign-up — they weren't bootstraped and weren't invited natively
  // But maybe they were pre-provisioned via an email invite!
  const qObj = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
  const snap = await getDocs(qObj);
  const placeholderDoc = snap.docs.find(d => d.id.startsWith('invite_') || d.data().status === 'invited');

  if (placeholderDoc) {
    const placeholder = placeholderDoc.data() as UserProfile;
    const batch = writeBatch(db);
    const now = nowISO();

    const newProfile: UserProfile = {
      ...placeholder,
      uid:         firebaseUser.uid,
      displayName: displayName || placeholder.displayName || firebaseUser.email!.split('@')[0],
      status:      'active',
      lastLoginAt: now,
      updatedAt:   now,
    };
    batch.set(doc(db, 'users', firebaseUser.uid), newProfile);

    // Migrate tenant memberships
    for (const tenantId of placeholder.tenantIds ?? []) {
      const oldMemberRef = doc(db, 'tenants', tenantId, 'members', placeholder.uid);
      const oldMemberSnap = await getDoc(oldMemberRef);
      if (oldMemberSnap.exists()) {
        const memberData = oldMemberSnap.data();
        batch.set(doc(db, 'tenants', tenantId, 'members', firebaseUser.uid), {
          ...memberData,
          uid: firebaseUser.uid,
          status: 'active',
          displayName: newProfile.displayName,
          updatedAt: now,
        });
        batch.delete(oldMemberRef);
      }
    }

    // Delete placeholder user
    batch.delete(placeholderDoc.ref);
    await batch.commit();
    return newProfile;
  }

  // Completely new user without any placeholder
  const profile: UserProfile = {
    uid:         firebaseUser.uid,
    email:       firebaseUser.email!,
    displayName: displayName || firebaseUser.email!.split('@')[0],
    role:        'report_viewer',   // least privilege default
    tenantId:    null,
    tenantIds:   [],
    mfaEnabled:  false,
    status:      'active',
    createdAt:   nowISO(),
    lastLoginAt: nowISO(),
  };
  await setDoc(doc(db, 'users', firebaseUser.uid), profile);
  return profile;
}

/**
 * Grant saas_master_admin role to another user.
 * Callers must verify the _current_ user is already a saas_master_admin
 * before calling this (the Firestore rule enforces it server-side too).
 */
export async function grantSaasMasterAdmin(
  targetUid:     string,
  grantedByUid:  string,
  grantedByName: string,
): Promise<void> {
  await updateDoc(doc(db, 'users', targetUid), {
    role:        'saas_master_admin',
    tenantId:    'master',
    tenantIds:   ['master'],
    updatedAt:   nowISO(),
  });

  await addDoc(collection(db, 'audit_logs'), {
    tenantId:     'master',
    userId:       grantedByUid,
    userName:     grantedByName,
    action:       'SAAS_MASTER_ADMIN_GRANTED',
    resourceId:   targetUid,
    resourceType: 'user',
    resourceName: `SaaS Master Admin granted to ${targetUid}`,
    status:       'success',
    ipAddress:    'client',
    userAgent:    typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    occurredAt:   nowISO(),
  });
}

// ─── Tenant Deletion ──────────────────────────────────────────────────────────

/**
 * Permanently delete a tenant.
 *
 * Steps (all within a Firestore batch where possible):
 *   1. Delete all members sub-collection docs              → tenants/{id}/members/*
 *   2. Remove tenantId from each affected user's tenantIds → users/{uid}
 *   3. Delete the tenant document itself                   → tenants/{id}
 *   4. Write an immutable TENANT_DELETED audit log entry
 *
 * Note: Does NOT delete subscription records, invoices, or Firestore sub-collections
 * beyond `members`. Those can be cleaned up separately or retained for audit purposes.
 * Firestore batches are capped at 500 writes; for large tenants the members pass
 * is chunked automatically.
 */
export async function deleteTenant(
  tenantId:      string,
  tenantName:    string,
  performer:     { uid: string; name: string },
): Promise<void> {
  const now = nowISO();

  // 1. Fetch all members
  const membersSnap = await getDocs(collection(db, 'tenants', tenantId, 'members'));
  const memberDocs  = membersSnap.docs;

  // 2. Fetch all users that have this tenantId in their tenantIds array
  const usersSnap = await getDocs(
    query(collection(db, 'users'), where('tenantIds', 'array-contains', tenantId))
  );

  // 3. Chunk into batches of 490 (Firestore limit is 500 per batch)
  const CHUNK = 490;
  const allWrites: (() => Promise<void>)[] = [];

  // Chunk member deletes
  for (let i = 0; i < memberDocs.length; i += CHUNK) {
    const chunk = memberDocs.slice(i, i + CHUNK);
    allWrites.push(async () => {
      const b = writeBatch(db);
      chunk.forEach(d => b.delete(d.ref));
      await b.commit();
    });
  }

  // Chunk user profile updates (strip tenantId)
  const userDocs = usersSnap.docs;
  for (let i = 0; i < userDocs.length; i += CHUNK) {
    const chunk = userDocs.slice(i, i + CHUNK);
    allWrites.push(async () => {
      const b = writeBatch(db);
      chunk.forEach(d => {
        const data = d.data() as UserProfile;
        b.update(d.ref, {
          tenantIds: arrayRemove(tenantId),
          // If this was their primary tenant, clear it
          ...(data.tenantId === tenantId ? { tenantId: null } : {}),
          updatedAt: now,
        });
      });
      await b.commit();
    });
  }

  // Execute all chunks sequentially
  for (const write of allWrites) {
    await write();
  }

  // 4. Delete the tenant document itself
  await deleteDoc(doc(db, 'tenants', tenantId));
  await deleteDoc(doc(db, 'subscriptions', tenantId));

  // 5. Write audit log (to master tenant, since the tenant is gone)
  await addDoc(collection(db, 'audit_logs'), {
    tenantId:     'master',
    userId:       performer.uid,
    userName:     performer.name,
    action:       'TENANT_DELETED',
    resourceId:   tenantId,
    resourceType: 'tenant',
    resourceName: `Tenant "${tenantName}" (${tenantId}) permanently deleted by ${performer.name}`,
    status:       'success',
    ipAddress:    'client',
    userAgent:    typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    occurredAt:   now,
  });
}

