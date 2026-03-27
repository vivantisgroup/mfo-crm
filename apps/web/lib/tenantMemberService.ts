/**
 * tenantMemberService.ts
 *
 * Manages tenant membership: who has access to what tenant and with what role.
 *
 * Firestore schema:
 *   tenants/{tenantId}/members/{uid}   ← per-tenant role assignment (source of truth)
 *   users/{uid}.tenantIds              ← denormalized list (fast auth lookups)
 *   tenant_invitations/{inviteId}      ← pending email invitations
 *   audit_logs/{id}                    ← every membership change audited
 *
 * Design principles:
 *   - The `members` sub-collection is the single source of truth
 *   - `users/{uid}.tenantIds` is a denormalised read-cache for fast auth
 *   - Invitations use signed tokens (stored in Firestore, expire after 7 days)
 *   - All changes are immutably audited
 */

import { firebaseApp } from '@mfo-crm/config';
import {
  getFirestore,
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, writeBatch, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import type { PlatformRole, UserProfile, TenantRecord } from './platformService';
import { createNotification } from './notificationService';

const db = getFirestore(firebaseApp);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TenantMember {
  uid:         string;
  tenantId:    string;
  email:       string;
  displayName: string;
  role:        PlatformRole;
  status:      'active' | 'suspended' | 'invited';
  joinedAt:    string;
  invitedBy?:  string;   // uid of the inviter
  lastSeenAt?: string;
  photoURL?:   string;
}

export interface TenantInvitation {
  id:          string;
  tenantId:    string;
  tenantName:  string;
  email:       string;
  role:        PlatformRole;
  token:       string;   // random secure token
  invitedBy:   string;   // uid
  invitedByName: string;
  status:      'pending' | 'accepted' | 'expired' | 'revoked';
  createdAt:   string;
  expiresAt:   string;   // 7 days after createdAt
  acceptedAt?: string;
}

export const ROLE_LABELS: Record<PlatformRole, string> = {
  saas_master_admin:          '🔐 SaaS Master Admin',
  tenant_admin:               '👑 Tenant Admin',
  relationship_manager:       '💼 Relationship Manager',
  cio:                        '📊 CIO',
  controller:                 '💰 Controller',
  compliance_officer:         '⚖️ Compliance Officer',
  report_viewer:              '👁 Report Viewer',
  external_advisor:           '🤝 External Advisor',
  sales_operations:           '📈 Sales Operations',
  business_manager:           '🏢 Business Manager',
  sales_manager:              '🏆 Sales Manager',
  revenue_manager:            '💹 Revenue Manager',
  account_executive:          '💼 Account Executive',
  sdr:                        '📞 SDR',
  customer_success_manager:   '🤝 Customer Success Manager',
};

export const ROLE_DESCRIPTIONS: Record<PlatformRole, string> = {
  saas_master_admin:          'Full platform control — all tenants and configuration',
  tenant_admin:               'Full access to one tenant: users, settings, all data',
  relationship_manager:       'Manage families, tasks, documents, reporting',
  cio:                        'Portfolio management, investments, performance',
  controller:                 'Financial data, billing, treasury operations',
  compliance_officer:         'KYC/AML, audit logs, suitability assessments',
  report_viewer:              'Read-only access to reports and dashboards',
  external_advisor:           'Limited access to specific client portfolios',
  sales_operations:           'Manage sales pipeline, opportunities, CRM activities, and revenue reporting',
  business_manager:           'Cross-functional oversight of operations, team performance, and business analytics',
  sales_manager:              'Lead a regional or global sales team — full CRM, pipeline oversight, team management',
  revenue_manager:            'Revenue operations: forecasting, quota management, deal desk, and analytics',
  account_executive:          'Own an opportunity pipeline — demos, proposals, closings, and account handoff',
  sdr:                        'Sales Development Rep — lead generation, cold outreach, and qualification',
  customer_success_manager:   'Post-sale health, onboarding, renewals, and expansion revenue',
};

const TENANT_ROLES: PlatformRole[] = [
  'tenant_admin', 'relationship_manager', 'cio',
  'controller', 'compliance_officer', 'report_viewer', 'external_advisor',
  'sales_operations', 'business_manager',
  'sales_manager', 'revenue_manager', 'account_executive', 'sdr', 'customer_success_manager',
];

export { TENANT_ROLES };

// ─── Member CRUD ──────────────────────────────────────────────────────────────

export async function getTenantMembers(tenantId: string): Promise<TenantMember[]> {
  const snap = await getDocs(collection(db, 'tenants', tenantId, 'members'));
  return snap.docs
    .map(d => d.data() as TenantMember)
    .sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''));
}

export async function getTenantMember(tenantId: string, uid: string): Promise<TenantMember | null> {
  const snap = await getDoc(doc(db, 'tenants', tenantId, 'members', uid));
  return snap.exists() ? snap.data() as TenantMember : null;
}

/**
 * Add an existing user (by uid) to a tenant.
 * Atomically writes the member doc + updates users.tenantIds.
 */
export async function addMemberToTenant(
  tenantId:    string,
  tenantName:  string,
  targetUser:  Pick<UserProfile, 'uid' | 'email' | 'displayName' | 'tenantIds'>,
  role:        PlatformRole,
  performer:   { uid: string; name: string },
): Promise<void> {
  const now = new Date().toISOString();
  const batch = writeBatch(db);

  // Write to members sub-collection
  const memberRef = doc(db, 'tenants', tenantId, 'members', targetUser.uid);
  const member: TenantMember = {
    uid:         targetUser.uid,
    tenantId,
    email:       targetUser.email,
    displayName: targetUser.displayName,
    role,
    status:      'active',
    joinedAt:    now,
    invitedBy:   performer.uid,
  };
  batch.set(memberRef, member);

  // Denormalize: add tenantId to user's tenantIds array using merge so this
  // is safe even if the user doc was just created by the admin and fields may be missing.
  const userRef = doc(db, 'users', targetUser.uid);
  batch.set(userRef, {
    tenantIds: arrayUnion(tenantId),
    // If user has no primary tenant yet, set this as primary
    ...(targetUser.tenantIds.length === 0 ? { tenantId } : {}),
    updatedAt: now,
  }, { merge: true });

  await batch.commit();

  // Audit
  await audit(tenantId, performer, 'MEMBER_ADDED', targetUser.uid, 'user',
    `${targetUser.displayName} added to ${tenantName} as ${ROLE_LABELS[role]}`);
}

/**
 * Add a new user directly using their email as a placeholder UID.
 * This satisfies the requirement that "a never seen user can be added directly".
 */
export async function addPlaceholderMember(
  tenantId:    string,
  tenantName:  string,
  email:       string,
  role:        PlatformRole,
  performer:   { uid: string; name: string },
): Promise<void> {
  const now = new Date().toISOString();
  const batch = writeBatch(db);

  // We assign a special uid format to recognize placeholders.
  // email base64 encoding prevents invalid document ID characters.
  const b64email = typeof btoa === 'function' ? btoa(email) : Buffer.from(email).toString('base64');
  const tempUid = 'invite_' + b64email.replace(/=/g, '');

  // 1. Create UserProfile in users collection
  const userRef = doc(db, 'users', tempUid);
  batch.set(userRef, {
    uid:         tempUid,
    email:       email,
    displayName: email.split('@')[0],
    role:        role,          // use the requested role, not a hardcoded base
    mfaEnabled:  false,
    status:      'invited',
    createdAt:   now,
    tenantId:    tenantId,      // ← primary tenant (was missing — kritical fix!)
    tenantIds:   [tenantId],    // static array on create (arrayUnion only works on update)
  }, { merge: true });

  // 2. Add to members collection
  const memberRef = doc(db, 'tenants', tenantId, 'members', tempUid);
  const member: TenantMember = {
    uid:         tempUid,
    tenantId,
    email:       email,
    displayName: email.split('@')[0],
    role,
    status:      'invited',
    joinedAt:    now,
    invitedBy:   performer.uid,
  };
  batch.set(memberRef, member);

  await batch.commit();

  await audit(tenantId, performer, 'MEMBER_ADDED_PLACEHOLDER', tempUid, 'user',
    `Placeholder member ${email} added to ${tenantName} as ${ROLE_LABELS[role]}`);
}

/**
 * Remove a user from a tenant.
 * Atomically deletes the member doc + removes tenantId from users.tenantIds.
 */
export async function removeMemberFromTenant(
  tenantId:   string,
  tenantName: string,
  targetUid:  string,
  targetName: string,
  performer:  { uid: string; name: string },
): Promise<void> {
  const now = new Date().toISOString();
  const batch = writeBatch(db);

  batch.delete(doc(db, 'tenants', tenantId, 'members', targetUid));
  batch.update(doc(db, 'users', targetUid), {
    tenantIds: arrayRemove(tenantId),
    updatedAt: now,
  });

  await batch.commit();
  await audit(tenantId, performer, 'MEMBER_REMOVED', targetUid, 'user',
    `${targetName} removed from ${tenantName}`);
}

/**
 * Update a member's role within a tenant.
 */
export async function updateMemberRole(
  tenantId:   string,
  tenantName: string,
  targetUid:  string,
  targetName: string,
  newRole:    PlatformRole,
  oldRole:    PlatformRole,
  performer:  { uid: string; name: string },
): Promise<void> {
  const now = new Date().toISOString();
  const batch = writeBatch(db);

  // Update member record in tenant
  batch.update(doc(db, 'tenants', tenantId, 'members', targetUid), {
    role: newRole, updatedAt: now,
  });

  // ← Also update the user's top-level profile so AuthContext live listener picks it up
  batch.update(doc(db, 'users', targetUid), {
    role: newRole, updatedAt: now,
  });

  await batch.commit();

  // Audit log
  await audit(tenantId, performer, 'MEMBER_ROLE_CHANGED', targetUid, 'user',
    `${targetName}'s role changed from ${ROLE_LABELS[oldRole]} to ${ROLE_LABELS[newRole]} in ${tenantName}`);

  // In-app notification for the affected user
  await createNotification(
    targetUid,
    'role_change',
    '🔄 Your role has been updated',
    `Your role in ${tenantName} has been changed from ${ROLE_LABELS[oldRole]} to ${ROLE_LABELS[newRole]}.`,
    '/settings/profile',
  ).catch(() => {}); // non-blocking — don't fail the role change if this errors
}

/**
 * Suspend / reactivate a member (non-destructive, keeps the record).
 */
export async function setMemberStatus(
  tenantId:   string,
  targetUid:  string,
  targetName: string,
  status:     'active' | 'suspended',
  performer:  { uid: string; name: string },
): Promise<void> {
  await updateDoc(doc(db, 'tenants', tenantId, 'members', targetUid), {
    status, updatedAt: new Date().toISOString(),
  });
  await audit(tenantId, performer, status === 'suspended' ? 'MEMBER_SUSPENDED' : 'MEMBER_REACTIVATED',
    targetUid, 'user', `${targetName} ${status === 'suspended' ? 'suspended from' : 'reactivated in'} tenant`);
}

// ─── Invitations ──────────────────────────────────────────────────────────────

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create an email invitation for a user not yet on the platform.
 * Returns the invitation record (caller may use it to build the invite link).
 */
export async function createInvitation(
  tenantId:      string,
  tenantName:    string,
  email:         string,
  role:          PlatformRole,
  performer:     { uid: string; name: string },
): Promise<TenantInvitation> {
  const now     = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const token   = generateToken();

  const inv: Omit<TenantInvitation, 'id'> = {
    tenantId, tenantName, email, role, token,
    invitedBy:     performer.uid,
    invitedByName: performer.name,
    status:        'pending',
    createdAt:     now.toISOString(),
    expiresAt:     expires.toISOString(),
  };

  const ref = await addDoc(collection(db, 'tenant_invitations'), inv);
  await audit(tenantId, performer, 'MEMBER_INVITED', email, 'invitation',
    `Invitation sent to ${email} for ${tenantName} as ${ROLE_LABELS[role]}`);

  return { ...inv, id: ref.id };
}

export async function getInvitationsForTenant(tenantId: string): Promise<TenantInvitation[]> {
  const snap = await getDocs(
    query(collection(db, 'tenant_invitations'), where('tenantId', '==', tenantId))
  );
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as TenantInvitation))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function revokeInvitation(
  inviteId:  string,
  performer: { uid: string; name: string },
  tenantId:  string,
): Promise<void> {
  await updateDoc(doc(db, 'tenant_invitations', inviteId), {
    status: 'revoked', revokedAt: new Date().toISOString(), revokedBy: performer.uid,
  });
  await audit(tenantId, performer, 'INVITATION_REVOKED', inviteId, 'invitation', 'Invitation revoked');
}

export async function getInvitationByToken(inviteId: string, token: string): Promise<TenantInvitation | null> {
  const snap = await getDoc(doc(db, 'tenant_invitations', inviteId));
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<TenantInvitation, 'id'>;
  if (data.token !== token) return null;
  return { id: snap.id, ...data };
}

export async function acceptInvitation(
  invite: TenantInvitation,
  user: Pick<UserProfile, 'uid' | 'email' | 'displayName' | 'tenantIds'>,
): Promise<void> {
  const now = new Date().toISOString();
  const batch = writeBatch(db);

  // 1. Mark invitation as accepted
  batch.update(doc(db, 'tenant_invitations', invite.id), {
    status: 'accepted',
    acceptedAt: now,
  });

  // 2. Add member to tenant doc
  const memberRef = doc(db, 'tenants', invite.tenantId, 'members', user.uid);
  const member: TenantMember = {
    uid:         user.uid,
    tenantId:    invite.tenantId,
    email:       user.email,
    displayName: user.displayName,
    role:        invite.role,
    status:      'active',
    joinedAt:    now,
    invitedBy:   invite.invitedBy,
  };
  batch.set(memberRef, member);

  // 3. Update user.tenantIds
  const userRef = doc(db, 'users', user.uid);
  batch.update(userRef, {
    tenantIds: arrayUnion(invite.tenantId),
    ...(user.tenantIds.length === 0 ? { tenantId: invite.tenantId } : {}),
    updatedAt: now,
  });

  await batch.commit();
}

// ─── Cross-tenant lookup (for tenant selector on login) ───────────────────────

/**
 * Lookup all tenants where this user has a member document.
 * This is the authoritative method — the members sub-collection is the truth.
 * We query using the denormalized tenantIds[] on the user doc for efficiency
 * (Firestore doesn't support cross-collection queries).
 */
export async function getAuthorizedTenants(
  profile: Pick<UserProfile, 'uid' | 'tenantId' | 'tenantIds'>,
): Promise<{ tenantId: string; role: PlatformRole; status: TenantMember['status'] }[]> {
  const ids = Array.from(new Set([
    ...(profile.tenantIds ?? []),
    ...(profile.tenantId ? [profile.tenantId] : []),
  ]));
  if (ids.length === 0) return [];

  const results = await Promise.all(
    ids.map(async tenantId => {
      try {
        const memberSnap = await getDoc(doc(db, 'tenants', tenantId, 'members', profile.uid));
        if (memberSnap.exists()) {
          const m = memberSnap.data() as TenantMember;
          return { tenantId, role: m.role, status: m.status };
        }
      } catch {}
      // Fallback: return with default role if member doc not found (e.g. master admin)
      return { tenantId, role: 'report_viewer' as PlatformRole, status: 'active' as const };
    })
  );
  return results;
}

// ─── Audit helper ──────────────────────────────────────────────────────────────

async function audit(
  tenantId:     string,
  performer:    { uid: string; name: string },
  action:       string,
  resourceId:   string,
  resourceType: string,
  description:  string,
): Promise<void> {
  await addDoc(collection(db, 'audit_logs'), {
    tenantId,
    userId:       performer.uid,
    userName:     performer.name,
    action,
    resourceId,
    resourceType,
    resourceName: description,
    status:       'success',
    ipAddress:    'client',
    userAgent:    typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    occurredAt:   new Date().toISOString(),
  });
}
