/**
 * groupService.ts
 *
 * Manages user groups within tenants.
 *
 * Model:
 *   A Group belongs to a tenant and:
 *   - Has a base role (inherits that role's default permissions)
 *   - Has additional explicit permissions on top of the role
 *   - Has a list of member UIDs
 *
 * Firestore schema:
 *   tenant_groups/{groupId}            ← group record
 *   tenant_groups/{groupId}/members/{uid} ← membership records
 *   audit_logs/{id}                    ← every change audited
 */

import { firebaseApp } from '@mfo-crm/config';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc,
  deleteDoc, updateDoc, writeBatch, query, where,
} from 'firebase/firestore';
import type { PlatformRole } from './platformService';
import type { Permission } from './rbacService';

const db = getFirestore(firebaseApp);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TenantGroup {
  id:                   string;
  tenantId:             string;
  name:                 string;
  description:          string;
  /** Color in hex — used for avatar/badge in UI */
  color:                string;
  /** Emoji icon */
  icon:                 string;
  /** Base role — group inherits this role's default permissions */
  roleId:               PlatformRole;
  /** Additional permissions beyond the base role */
  additionalPermissions: Permission[];
  /** Permissions explicitly denied for this group */
  deniedPermissions:    Permission[];
  /** Scope — can restrict which resource types members can see */
  objectScope?:         GroupObjectScope;
  memberCount:          number;
  createdAt:            string;
  createdBy:            string;
  updatedAt?:           string;
}

export interface GroupObjectScope {
  /** If set, members can only see families listed here (empty = all) */
  familyIds?:    string[];
  /** If set, members can only see portfolios listed here */
  portfolioIds?: string[];
}

export interface GroupMember {
  uid:         string;
  groupId:     string;
  tenantId:    string;
  displayName: string;
  email:       string;
  joinedAt:    string;
  joinedBy:    string;
}

// ─── Group CRUD ───────────────────────────────────────────────────────────────

export async function getTenantGroups(tenantId: string): Promise<TenantGroup[]> {
  const q    = query(collection(db, 'tenant_groups'), where('tenantId', '==', tenantId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as TenantGroup))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getGroup(groupId: string): Promise<TenantGroup | null> {
  const snap = await getDoc(doc(db, 'tenant_groups', groupId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as TenantGroup) : null;
}

export async function createGroup(
  data:      Omit<TenantGroup, 'id' | 'memberCount' | 'createdAt'>,
  performer: { uid: string; name: string },
): Promise<TenantGroup> {
  const now  = new Date().toISOString();
  const ref  = await addDoc(collection(db, 'tenant_groups'), {
    ...data,
    memberCount: 0,
    createdAt:   now,
    createdBy:   performer.uid,
  });
  const group: TenantGroup = { ...data, id: ref.id, memberCount: 0, createdAt: now };
  await _audit(data.tenantId, performer, 'GROUP_CREATED', ref.id, 'group',
    `Group "${data.name}" created in tenant ${data.tenantId}`);
  return group;
}

export async function updateGroup(
  groupId:   string,
  patch:     Partial<Omit<TenantGroup, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>,
  performer: { uid: string; name: string },
): Promise<void> {
  const now = new Date().toISOString();
  const ref = doc(db, 'tenant_groups', groupId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Group not found');
  await updateDoc(ref, { ...patch, updatedAt: now });
  await _audit(snap.data().tenantId, performer, 'GROUP_UPDATED', groupId, 'group',
    `Group "${snap.data().name}" updated`);
}

export async function deleteGroup(
  groupId:   string,
  performer: { uid: string; name: string },
): Promise<void> {
  const snap = await getDoc(doc(db, 'tenant_groups', groupId));
  if (!snap.exists()) return;
  const data = snap.data() as TenantGroup;

  // Delete all member docs
  const membersSnap = await getDocs(collection(db, 'tenant_groups', groupId, 'members'));
  const batch = writeBatch(db);
  membersSnap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db, 'tenant_groups', groupId));
  await batch.commit();

  await _audit(data.tenantId, performer, 'GROUP_DELETED', groupId, 'group',
    `Group "${data.name}" permanently deleted`);
}

// ─── Group Membership ─────────────────────────────────────────────────────────

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const snap = await getDocs(collection(db, 'tenant_groups', groupId, 'members'));
  return snap.docs.map(d => d.data() as GroupMember)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function addMemberToGroup(
  groupId:      string,
  tenantId:     string,
  member:       Pick<GroupMember, 'uid' | 'displayName' | 'email'>,
  performer:    { uid: string; name: string },
): Promise<void> {
  const now = new Date().toISOString();
  const memberRef = doc(db, 'tenant_groups', groupId, 'members', member.uid);
  const memberDoc: GroupMember = {
    uid:         member.uid,
    groupId,
    tenantId,
    displayName: member.displayName,
    email:       member.email,
    joinedAt:    now,
    joinedBy:    performer.uid,
  };
  await setDoc(memberRef, memberDoc);
  // Update memberCount
  const groupRef  = doc(db, 'tenant_groups', groupId);
  const groupSnap = await getDoc(groupRef);
  if (groupSnap.exists()) {
    await updateDoc(groupRef, { memberCount: (groupSnap.data().memberCount ?? 0) + 1 });
  }
  await _audit(tenantId, performer, 'GROUP_MEMBER_ADDED', member.uid, 'user',
    `${member.displayName} added to group ${groupId}`);
}

export async function removeMemberFromGroup(
  groupId:   string,
  tenantId:  string,
  uid:       string,
  name:      string,
  performer: { uid: string; name: string },
): Promise<void> {
  await deleteDoc(doc(db, 'tenant_groups', groupId, 'members', uid));
  const groupRef  = doc(db, 'tenant_groups', groupId);
  const groupSnap = await getDoc(groupRef);
  if (groupSnap.exists()) {
    const current = groupSnap.data().memberCount ?? 1;
    await updateDoc(groupRef, { memberCount: Math.max(0, current - 1) });
  }
  await _audit(tenantId, performer, 'GROUP_MEMBER_REMOVED', uid, 'user',
    `${name} removed from group ${groupId}`);
}

/** Get all groups a user belongs to within a tenant */
export async function getGroupsForUser(
  uid:      string,
  tenantId: string,
): Promise<TenantGroup[]> {
  // Query all groups in this tenant, then check membership
  const groups = await getTenantGroups(tenantId);
  const results: TenantGroup[] = [];
  for (const group of groups) {
    const memberSnap = await getDoc(doc(db, 'tenant_groups', group.id, 'members', uid));
    if (memberSnap.exists()) results.push(group);
  }
  return results;
}

// ─── Audit helper ─────────────────────────────────────────────────────────────

async function _audit(
  tenantId:  string,
  performer: { uid: string; name: string },
  action:    string,
  resourceId:   string,
  resourceType: string,
  description:  string,
): Promise<void> {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      tenantId,
      userId:       performer.uid,
      userName:     performer.name,
      action, resourceId, resourceType,
      resourceName: description,
      status: 'success', ipAddress: 'client',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      occurredAt: new Date().toISOString(),
    });
  } catch { /* non-critical */ }
}
