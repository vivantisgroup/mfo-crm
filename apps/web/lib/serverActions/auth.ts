"use server";

import { prisma } from "@/lib/prisma";
import type { UserProfile, TenantRecord } from "@/lib/platformService";
import { UserRole } from "@prisma/client";
import { getAdminFirestore } from "@/lib/firebaseAdmin";

export async function getUserByEmailAction(email: string) {
  return await prisma.user.findUnique({ where: { email } });
}

export async function getUserProfileAndTenants(uid: string, email: string, displayName: string): Promise<{ profile: UserProfile, tenants: TenantRecord[] }> {
  let user = await prisma.user.findUnique({
    where: { id: uid },
    include: { tenantMemberships: { include: { tenant: true } } }
  });

  if (!user) {
    const existingByEmail = await prisma.user.findUnique({
      where: { email }
    });

    if (existingByEmail) {
      user = await prisma.user.update({
        where: { email },
        data: { id: uid },
        include: { tenantMemberships: { include: { tenant: true } } }
      });
    } else {
      user = await prisma.user.create({
        data: {
          id: uid,
          email,
          displayName: displayName || email.split("@")[0],
          status: "active",
        },
        include: { tenantMemberships: { include: { tenant: true } } }
      });
    }
  }

  // Determine roles (simplified)
  let role: UserProfile['role'] = 'relationship_manager';
  
  // Find "master" tenant membership if exists
  const masterMembership = user.tenantMemberships.find(m => m.tenantId === "master");
  if (masterMembership) {
      role = 'saas_master_admin';
  }

  // 2. Map to legacy UserProfile shape for AuthContext
  const profile: UserProfile = {
    uid: user.id,
    email: user.email,
    displayName: user.displayName,
    role,
    tenantId: user.tenantMemberships.length > 0 ? user.tenantMemberships[0].tenantId : null,
    tenantIds: user.tenantMemberships.map(m => m.tenantId),
    mfaEnabled: user.mfaEnabled,
    status: user.status as any,
    createdAt: user.createdAt.toISOString(),
  };

  // 3. Map Tenants to legacy TenantRecord shape
  const tenants: TenantRecord[] = user.tenantMemberships.map(m => {
    const t = m.tenant;
    const settings = t.settings as any || {};
    return {
      id: t.id,
      name: t.name,
      plan: settings.plan || 'standard',
      status: (t.status as any) || 'active',
      isInternal: settings.isInternal || false,
      brandColor: t.brandColor || '#000000',
      createdAt: t.createdAt.toISOString(),
      createdBy: "system",
      mfaConfig: settings.mfaConfig,
      mfaRequired: settings.mfaRequired,
    };
  });

  return { profile, tenants };
}

export async function switchTenantAction(uid: string, tenantId: string): Promise<void> {
  const adminDb = getAdminFirestore();
  const now = new Date().toISOString();

  // 1. Get the user and memberships from Postgres
  const user = await prisma.user.findUnique({
    where: { id: uid },
    include: { tenantMemberships: true }
  });

  if (!user) throw new Error('User not found');

  const tenantIds = user.tenantMemberships.map(m => m.tenantId);
  if (!tenantIds.includes(tenantId)) {
    // If they aren't a member in Postgres yet, add them
    await prisma.tenantMember.upsert({
      where: { tenantId_userId: { tenantId, userId: uid } },
      update: {},
      create: {
        tenantId,
        userId: uid,
        role: 'report_viewer',
      }
    });
    tenantIds.push(tenantId);
  }

  // 2. Update the Firestore user profile document
  const profileRef = adminDb.collection('users').doc(uid);
  await profileRef.set({
    tenantId,
    tenantIds,
    updatedAt: now,
  }, { merge: true });

  // 3. Ensure the member document exists in Firestore under the new tenant
  const memberRef = adminDb.collection('tenants').doc(tenantId).collection('members').doc(uid);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) {
    // Determine the role for this tenant membership
    const membership = user.tenantMemberships.find(m => m.tenantId === tenantId);
    let role = membership?.role || 'report_viewer';
    if (tenantIds.includes('master') && user.tenantMemberships.find(m => m.tenantId === 'master')?.role === 'saas_master_admin') {
      role = 'saas_master_admin';
    }
    await memberRef.set({
      uid,
      tenantId,
      email: user.email,
      displayName: user.displayName,
      role,
      status: 'active',
      joinedAt: now,
      invitedBy: 'system',
    });
  }
}
