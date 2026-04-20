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
  collectionGroup,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  query,
  where,
  writeBatch,
  addDoc,
  updateDoc,
  deleteDoc,
  arrayRemove,
  arrayUnion,
  increment,
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
  | 'external_advisor'
  | 'sales_operations'
  | 'business_manager'
  | 'sales_manager'
  | 'revenue_manager'
  | 'account_executive'
  | 'sdr'
  | 'customer_success_manager'
  | 'data_analyst'
  | 'data_designer'
  | 'app_designer'
  | 'integration_architect'
  | 'security_officer'
  | 'ai_officer';

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
  /** true = user must change their password before proceeding (temp password was set by admin) */
  mustChangePassword?: boolean;
  /** true = user must complete TOTP authenticator enrollment before accessing the dashboard */
  mfaEnrollRequired?: boolean;
  /** ISO 639-1 language code for email templates: 'en' | 'pt' | 'es' | 'fr' | 'de' */
  preferredLanguage?: string;
  /** Organizational department (e.g. "Sales", "Engineering", "Operations", "Finance") */
  department?:   string;
  /** Job title within the department */
  jobTitle?:     string;
  /** Direct phone / mobile */
  phone?:        string;
  createdAt:     string;
  updatedAt?:    string;
  lastLoginAt?:  string;
  lastActivityAt?: string;
  loginCount?:   number;
  photoURL?:     string;
}



export interface TenantRecord {
  id:               string;
  name:             string;
  plan:             'trial' | 'standard' | 'enterprise';
  status:           'active' | 'suspended' | 'trial';
  isInternal:       boolean;
  brandColor:       string;
  createdAt:        string;
  createdBy:        string; // uid
  expiresAt?:       string;
  /** If true, users must complete email-OTP MFA after selecting this tenant */
  mfaRequired?:     boolean;
  /** Global UX property controlling the assistant name (e.g. Joule, Canoe, Masttro) */
  aiAssistantName?: string;

  // ── AI Platform Billing Configurations ─────────────────────────────────────────
  /** Unique account number given by Platform for AI usage billing tracking */
  aiAccountNumber?: string;
  /** Whether the tenant uses Platform AI integration rather than their own custom keys */
  usesPlatformAi?:  boolean;

  // ── Multi-Vertical Architecture ──────────────────────────────────────────────
  /** Industry vertical that drives available modules, roles, and nav */
  industryVertical?: import('./verticalRegistry').IndustryVerticalId;
  /** Optional free-form sub-type label (e.g. "Cardiology Clinic") */
  businessType?:     string;
  /** Explicit list of enabled module IDs; defaults from vertical registry */
  modulesEnabled?:   string[];
  /** ISO 3166-1 alpha-2 country code (drives compliance defaults) */
  country?:          string;
  /** IANA timezone (e.g. "America/Sao_Paulo") */
  timezone?:         string;
  /** ISO 4217 primary currency (e.g. "BRL") */
  currencyCode?:     string;
  /** Short description of the business */
  description?:      string;

  // ── CRM Association ───────────────────────────────────────────────────────────
  /** Linked CRM Organization ID (platform_orgs/{id}) */
  crmOrgId?:          string;
  /** Display name of the linked org (denormalized for quick display) */
  crmOrgName?:        string;
  /** Linked primary CRM Contact ID */
  crmContactId?:      string;
  /** Display name of the linked contact */
  crmContactName?:    string;

  // ── Security & Authentication ────────────────────────────────────────────────
  mfaConfig?: {
    mfaMode?: string;
    mfaEnforced?: boolean;
    allowedMethods?: string[];
  };
  
  // ── Navigation Restrictions ──────────────────────────────────────────────────
  navRestrictions?: Record<string, string[]>;
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowISO() { return new Date().toISOString(); }

// ─── Platform config ──────────────────────────────────────────────────────────

const PLATFORM_CONFIG_REF = () => doc(db, 'platform', 'config');

export async function getPlatformConfig(): Promise<PlatformConfig | null> {
  const snap = await getDocFromServer(PLATFORM_CONFIG_REF());
  if (!snap.exists()) return null;
  return snap.data() as PlatformConfig;
}

export async function isPlatformInitialized(): Promise<boolean> {
  const cfg = await getPlatformConfig();
  return cfg?.initialized === true;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDocFromServer(doc(db, 'users', uid));
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

/**
 * Add a tenantId to the user's tenantIds array (arrayUnion — idempotent).
 * Call this BEFORE getTenant() when switching tenants so Firestore rules
 * can confirm membership via userTenantIds().hasAny([tenantId]).
 */
export async function addTenantToUser(
  uid:      string,
  tenantId: string,
): Promise<void> {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, {
    tenantIds:  arrayUnion(tenantId),
    tenantId,
    updatedAt:  nowISO(),
  });
}

/** Suspend a user platform-wide (sets status: 'suspended'). */
export async function suspendUser(
  uid:       string,
  userName:  string,
  performer: { uid: string; name: string },
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { status: 'suspended', updatedAt: nowISO() });
  await addDoc(collection(db, 'audit_logs'), {
    tenantId: 'master', userId: performer.uid, userName: performer.name,
    action: 'USER_SUSPENDED', resourceId: uid, resourceType: 'user',
    resourceName: `User "${userName}" (${uid}) suspended by ${performer.name}`,
    status: 'success', ipAddress: 'client',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    occurredAt: nowISO(),
  });
}

/** Reactivate a suspended user. */
export async function reactivateUser(
  uid:       string,
  userName:  string,
  performer: { uid: string; name: string },
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { status: 'active', updatedAt: nowISO() });
  await addDoc(collection(db, 'audit_logs'), {
    tenantId: 'master', userId: performer.uid, userName: performer.name,
    action: 'USER_REACTIVATED', resourceId: uid, resourceType: 'user',
    resourceName: `User "${userName}" (${uid}) reactivated by ${performer.name}`,
    status: 'success', ipAddress: 'client',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    occurredAt: nowISO(),
  });
}

/**
 * Permanently delete a user from the platform.
 * Removes: users/{uid}, all tenants/{*}/members/{uid} docs,
 * strips uid from users.tenantIds arrays (already removed by member delete batch).
 * Does NOT delete Firebase Auth user — caller must handle that via Admin SDK.
 */
export async function deleteUser(
  uid:       string,
  userName:  string,
  performer: { uid: string; name: string },
): Promise<void> {
  const now = nowISO();

  // 1. Get the user's tenantIds to delete member docs
  const userSnap = await getDoc(doc(db, 'users', uid));
  const tenantIds: string[] = userSnap.exists()
    ? (userSnap.data() as UserProfile).tenantIds ?? []
    : [];

  // 2. Delete member sub-collection docs across all tenants
  if (tenantIds.length > 0) {
    const CHUNK = 490;
    const chunks: string[][] = [];
    for (let i = 0; i < tenantIds.length; i += CHUNK) chunks.push(tenantIds.slice(i, i + CHUNK));
    for (const chunk of chunks) {
      const b = writeBatch(db);
      chunk.forEach(tid => b.delete(doc(db, 'tenants', tid, 'members', uid)));
      await b.commit();
    }
  }

  // 3. Delete the user document
  await deleteDoc(doc(db, 'users', uid));

  // 4. Audit
  await addDoc(collection(db, 'audit_logs'), {
    tenantId: 'master', userId: performer.uid, userName: performer.name,
    action: 'USER_DELETED', resourceId: uid, resourceType: 'user',
    resourceName: `User "${userName}" (${uid}) permanently deleted by ${performer.name}`,
    status: 'success', ipAddress: 'client',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    occurredAt: now,
  });
}

/** Touch lastLoginAt on every sign-in — intentionally non-throwing. */
export async function touchLastLogin(uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), { 
      lastLoginAt: nowISO(),
      lastActivityAt: nowISO(),
      loginCount: increment(1)
    });
  } catch (e: any) {
    // Permission-denied or not-found are non-fatal here — the session still succeeds.
    console.warn('[touchLastLogin] non-fatal:', e?.code ?? e?.message);
  }
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export async function getAllTenants(): Promise<TenantRecord[]> {
  const snap = await getDocs(collection(db, 'tenants'));
  return snap.docs.map(d => d.data() as TenantRecord);
}

export async function getTenant(id: string): Promise<TenantRecord | null> {
  // Guard: Firebase doc() calls .indexOf('/') on the id — reject anything that
  // isn't a non-empty string to avoid the cryptic "n.indexOf is not a function" error.
  if (!id || typeof id !== 'string') {
    console.warn('[getTenant] called with invalid id:', id);
    return null;
  }
  const snap = await getDoc(doc(db, 'tenants', id));
  if (!snap.exists()) return null;
  return snap.data() as TenantRecord;
}

/**
 * Fetch all tenants accessible to a given user profile.
 * A user may have multiple tenantIds (e.g. SaaS Master Admin + client tenants).
 */
export async function getTenantsForUser(
  profile: UserProfile,
  uid?: string,
): Promise<TenantRecord[]> {
  const ids = Array.from(new Set([
    ...(profile.tenantIds ?? []),
    ...(profile.tenantId ? [profile.tenantId] : []),
  ]));

  if (profile.role === 'saas_master_admin' && !ids.includes('master')) {
    ids.push('master');
  }

  if (ids.length > 0) {
    const results = await Promise.all(
      ids.map(id => getTenant(id).catch(err => {
        console.warn('[getTenantsForUser] getTenant failed for', id, err?.code ?? err?.message);
        return null;
      })),
    );
    const found = results.filter((t): t is TenantRecord => t !== null);
    if (found.length > 0) return found;
    // All tenant reads failed (rules denied) — fall through to collectionGroup
  }

  // ── Fallback: tenantIds is empty (race condition / write failure) ─────────────
  // Query the members collection group across ALL tenants to find where this user
  // actually belongs.  This works without knowing which tenantIds to check, and is
  // secured by the Firestore rule: /{path=**}/members/{uid} allow read if uid == request.auth.uid
  const resolvedUid = uid ?? profile.uid;
  if (!resolvedUid) return [];

  try {
    const memberSnaps = await getDocs(
      query(collectionGroup(db, 'members'), where('uid', '==', resolvedUid)),
    );
    if (memberSnaps.empty) return [];

    const tenantIds = Array.from(new Set(
      memberSnaps.docs.map(d => (d.data() as { tenantId?: string }).tenantId).filter((id): id is string => !!id),
    ));
    const results = await Promise.all(tenantIds.map(id => getTenant(id).catch(() => null)));
    return results.filter((t): t is TenantRecord => t !== null);
  } catch (err) {
    console.warn('[getTenantsForUser] collectionGroup fallback failed:', err);
    return [];
  }
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
 * already exist, and merges any admin-provisioned profile that was
 * written under a different UID (e.g. via the Identity Toolkit REST
 * accounts:signUp fallback which returns a different UID if the email
 * already existed in Firebase Auth).
 */
export async function ensureUserProfile(
  firebaseUser: FirebaseUser,
  displayName?: string,
): Promise<UserProfile> {
  const existing = await getUserProfile(firebaseUser.uid);

  // Helper: find any OTHER profile for this email (admin-provisioned at wrong UID)
  async function findProvisionedProfile(): Promise<{ doc: any; data: UserProfile } | null> {
    if (!firebaseUser.email) return null;
    const snap = await getDocs(
      query(collection(db, 'users'), where('email', '==', firebaseUser.email)),
    );
    const other = snap.docs.find(d => d.id !== firebaseUser.uid);
    if (!other) return null;
    return { doc: other, data: other.data() as UserProfile };
  }

  // Helper: migrate a provisioned profile to the real UID
  async function migrateProfile(
    provisioned: UserProfile,
    provisionedRef: any,
  ): Promise<UserProfile> {
    const batch = writeBatch(db);
    const now = nowISO();

    const merged: UserProfile = {
      ...provisioned,
      uid:         firebaseUser.uid,
      displayName: displayName || provisioned.displayName || firebaseUser.email!.split('@')[0],
      status:      'active',
      lastLoginAt: now,
      updatedAt:   now,
    };
    batch.set(doc(db, 'users', firebaseUser.uid), merged);

    // Migrate tenant member docs to real UID.
    // Reads of OLD member docs may fail with permission-denied when provisioned.uid != auth.uid
    // and the user isn't an admin. Handle that gracefully: always write the member doc at
    // the real UID (using provisioned data as fallback), and best-effort delete the old one.
    for (const tenantId of provisioned.tenantIds ?? []) {
      try {
        const oldMemberRef = doc(db, 'tenants', tenantId, 'members', provisioned.uid);
        const oldMemberSnap = await getDoc(oldMemberRef);
        if (oldMemberSnap.exists()) {
          const memberData = oldMemberSnap.data();
          batch.set(doc(db, 'tenants', tenantId, 'members', firebaseUser.uid), {
            ...memberData,
            uid:         firebaseUser.uid,
            status:      'active',
            displayName: merged.displayName,
            updatedAt:   now,
          });
          // Only delete the old doc if we found it and the UIDs are different
          if (provisioned.uid !== firebaseUser.uid) {
            batch.delete(oldMemberRef);
          }
        } else {
          // Old doc doesn't exist (e.g. Admin SDK write failed) — create a fresh one
          batch.set(doc(db, 'tenants', tenantId, 'members', firebaseUser.uid), {
            uid:         firebaseUser.uid,
            tenantId,
            email:       firebaseUser.email ?? provisioned.email,
            displayName: merged.displayName,
            role:        provisioned.role ?? 'report_viewer',
            status:      'active',
            joinedAt:    now,
            invitedBy:   'system',
            updatedAt:   now,
          });
        }
      } catch {
        // Permission-denied reading old member doc — write a fresh one at the real UID
        // using the provisioned profile data. This is safe: worst case a duplicate is created.
        try {
          batch.set(doc(db, 'tenants', tenantId, 'members', firebaseUser.uid), {
            uid:         firebaseUser.uid,
            tenantId,
            email:       firebaseUser.email ?? provisioned.email,
            displayName: merged.displayName,
            role:        provisioned.role ?? 'report_viewer',
            status:      'active',
            joinedAt:    now,
            invitedBy:   'system',
            updatedAt:   now,
          });
        } catch { /* member write also failed — will be healed by Fix Workspace button */ }
      }
    }

    // Remove the stale provisioned profile
    batch.delete(provisionedRef);

    await batch.commit();
    return merged;
  }

  // ── Case 1: Profile already exists at real UID ─────────────────────────────
  if (existing) {
    // Self-healing: if the user's profile is empty/stranded (which happened if the initial migration batch failed),
    // we safely attempt to re-find and migrate the provisioned profile. 
    // This previously crashed before the firestore.rules were updated, but is now permitted by the email list rule.
    if (!existing.tenantIds || existing.tenantIds.length === 0) {
      try {
        const provisioned = await findProvisionedProfile();
        if (provisioned) {
          return await migrateProfile(provisioned.data, provisioned.doc.ref);
        }
      } catch (err) {
        console.warn('[ensureUserProfile] Failed to recover stranded provisioned profile:', err);
      }
    }

    await touchLastLogin(firebaseUser.uid);
    return { ...existing, lastLoginAt: nowISO() };
  }

  // ── Case 2: No profile at real UID — look for provisioned/placeholder ─────
  try {
    const provisioned = await findProvisionedProfile();
    if (provisioned) {
      return migrateProfile(provisioned.data, provisioned.doc.ref);
    }
  } catch { /* non-fatal — fall through to fresh create */ }

  // ── Case 3: Completely new user ───────────────────────────────────────────
  const profile: UserProfile = {
    uid:         firebaseUser.uid,
    email:       firebaseUser.email!,
    displayName: displayName || firebaseUser.email!.split('@')[0],
    role:        'report_viewer',
    tenantId:    null,
    tenantIds:   [],
    mfaEnabled:  false,
    status:      'active',
    createdAt:   nowISO(),
    lastLoginAt: nowISO(),
    lastActivityAt: nowISO(),
    loginCount:  1,
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

// ─── Tenant Update ────────────────────────────────────────────────────────────

export async function updateTenant(
  tenantId: string,
  patch: Partial<TenantRecord>,
): Promise<void> {
  // Firestore rejects undefined values — strip them before writing
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) clean[k] = v;
  }
  clean.updatedAt = nowISO();
  await updateDoc(doc(db, 'tenants', tenantId), clean);
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

