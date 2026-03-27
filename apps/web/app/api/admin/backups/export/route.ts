import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

/**
 * Collections where the tenant relationship is the document ID itself,
 * not a `tenantId` field. When doing a per-tenant backup we fetch by doc ID.
 */
const DOC_ID_KEYED: Record<string, boolean> = {
  tenants: true,
  subscriptions: true,
  user_mfa_secrets: true,
};

/**
 * Top-level collections to include in every backup.
 * Kept in sync with firestore.rules and catalog/collections route.
 */
const PLATFORM_COLLECTIONS = [
  // Core entity collections
  'users', 'tenants', 'tenant_invitations', 'user_mfa_secrets',
  // Platform CRM
  'platform_orgs', 'platform_contacts', 'platform_opportunities',
  'platform_crm_activities', 'platform_sales_teams',
  // Billing / subscriptions
  'subscription_plans', 'subscription_plan_versions', 'subscription_events',
  'subscriptions', 'invoices', 'renewals',
  // Ops
  'audit_logs', 'opportunities', 'activities', 'tenant_groups', 'object_acls',
  // Platform meta (exclude platform_backups from its own backup to avoid recursion)
];

async function exportCollection(
  db: any,
  colName: string,
  tenantId?: string,
): Promise<{ docs: any[]; error?: string }> {
  try {
    const ref = db.collection(colName);

    if (!tenantId) {
      // Full platform backup — export entire collection
      const snap = await ref.limit(5000).get();
      return { docs: snap.docs.map((d: any) => ({ _id: d.id, ...d.data() })) };
    }

    // Per-tenant backup
    if (DOC_ID_KEYED[colName]) {
      // The tenant IS identified by document ID, not a `tenantId` field
      const snap = await ref.doc(tenantId).get();
      if (!snap.exists) return { docs: [] };
      return { docs: [{ _id: snap.id, ...snap.data() }] };
    }

    // Normal collection — query by tenantId field
    const snap = await ref.where('tenantId', '==', tenantId).limit(5000).get();
    return { docs: snap.docs.map((d: any) => ({ _id: d.id, ...d.data() })) };
  } catch (e: any) {
    return { docs: [], error: e.message };
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getAdminFirestore();
    const body = await req.json().catch(() => ({}));
    const tenantId: string | undefined = body.tenantId;
    const label = tenantId ? `tenant_${tenantId}` : 'platform_full';

    const backup: Record<string, any[]> = {};
    const errors: string[] = [];

    for (const col of PLATFORM_COLLECTIONS) {
      const { docs, error } = await exportCollection(db, col, tenantId);
      backup[col] = docs;
      if (error) errors.push(`${col}: ${error}`);
    }

    const totalDocuments = Object.values(backup).reduce((a, b) => a + b.length, 0);
    const exportedAt = new Date().toISOString();

    const meta = {
      exportedAt,
      label,
      type:                tenantId ? 'tenant' : 'platform_full',
      tenantId:            tenantId ?? null,
      collectionsExported: PLATFORM_COLLECTIONS.length,
      totalDocuments,
      skippedCollections:  errors,
      status:              errors.length === 0 ? 'completed' : 'completed_with_errors',
    };

    // Save backup record (Admin SDK — bypasses Firestore rules)
    const backupRef = db.collection('platform_backups').doc();
    await backupRef.set({
      ...meta,
      sizeEstimate: JSON.stringify(backup).length,
    });

    return NextResponse.json({ meta, backup, backupDocId: backupRef.id });
  } catch (err: any) {
    console.error('[backup/export] fatal error:', err);
    return NextResponse.json(
      { error: err.message ?? 'Backup failed' },
      { status: 500 },
    );
  }
}
