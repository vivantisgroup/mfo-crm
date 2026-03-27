import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export interface ConsistencyIssue {
  id:          string;
  collection:  string;
  docId:       string;
  field:       string;
  severity:    'critical' | 'warning' | 'info';
  issueType:   string;
  title:       string;
  description: string;
  howToFix:    string;
  canAutoFix:  boolean;
}

const VALID_ROLES = [
  'saas_master_admin', 'tenant_admin', 'business_manager', 'sales_manager',
  'revenue_manager', 'account_executive', 'sdr', 'customer_success_manager',
  'sales_operations', 'relationship_manager', 'cio', 'controller',
  'compliance_officer', 'report_viewer', 'external_advisor',
];

// =============================================================================
// POST — run consistency checks (Admin SDK — bypasses Firestore rules)
// =============================================================================
export async function POST(_req: NextRequest) {
  try {
    const db     = getAdminFirestore();
    const issues: ConsistencyIssue[] = [];
    let idx = 0;

    const KNOWN_COLLECTIONS = [
      'users', 'tenants', 'tenant_invitations', 'user_mfa_secrets',
      'audit_logs', 'platform_backups', 'platform_config', 'platform_notifications',
      'platform_orgs', 'platform_contacts', 'platform_opportunities',
      'platform_crm_activities', 'platform_sales_teams', 'object_acls',
      'subscription_plans', 'subscription_plan_versions', 'subscription_events',
      'subscriptions', 'invoices', 'renewals', 'email_templates', 'roles',
      'opportunities', 'activities', 'tenant_groups',
      'copilot_sessions', 'suitability_tokens', 'suitability_responses', 'notifications',
      'support_tickets', 'expenses'
    ];

    // ── Orphaned Collection checks ──────────────────────────────────────────
    const liveCollections = await db.listCollections();
    for (const c of liveCollections) {
      if (!KNOWN_COLLECTIONS.includes(c.id)) {
        issues.push({
          id: `issue_${idx++}`, collection: c.id, docId: 'collection',
          field: 'schema', severity: 'warning', issueType: 'unknown_collection',
          title: `Unknown Collection: ${c.id}`,
          description: `The collection "${c.id}" exists in the database but is not part of the active MFO schema.`,
          howToFix: 'No auto-fix available. Manually review and delete if confirmed obsolete using the Database Explorer.',
          canAutoFix: false,
        });
      }
    }

    const [usersSnap, tenantsSnap, mfaSnap, auditSnap] = await Promise.all([
      db.collection('users').limit(500).get(),
      db.collection('tenants').limit(200).get(),
      db.collection('user_mfa_secrets').limit(500).get(),
      db.collection('audit_logs').limit(200).get(),
    ]);

    const userIds   = new Set(usersSnap.docs.map((d: any) => d.id));
    const tenantIds = new Set(tenantsSnap.docs.map((d: any) => d.id));
    const mfaIds    = new Set(mfaSnap.docs.map((d: any) => d.id));

    // ── User checks ──────────────────────────────────────────────────────────
    for (const uDoc of usersSnap.docs) {
      const u = uDoc.data() as any;

      if (u.role && !VALID_ROLES.includes(u.role)) {
        issues.push({
          id: `issue_${idx++}`, collection: 'users', docId: uDoc.id,
          field: 'role', severity: 'critical', issueType: 'invalid_role',
          title: `Invalid role "${u.role}"`,
          description: `User ${u.email ?? uDoc.id} has unrecognized role "${u.role}".`,
          howToFix: 'Will reset role to "report_viewer".',
          canAutoFix: true,
        });
      }

      for (const tid of [...(u.tenantIds ?? []), u.tenantId].filter(Boolean)) {
        if (tid !== 'master' && !tenantIds.has(tid)) {
          issues.push({
            id: `issue_${idx++}`, collection: 'users', docId: uDoc.id,
            field: 'tenantIds', severity: 'warning', issueType: 'orphaned_tenant_ref',
            title: `Orphaned tenant ref "${tid}"`,
            description: `User ${u.email ?? uDoc.id} references non-existent tenant "${tid}".`,
            howToFix: 'Will remove stale tenant ID from tenantIds array.',
            canAutoFix: true,
          });
        }
      }

      if (u.mfaEnabled && !mfaIds.has(uDoc.id)) {
        issues.push({
          id: `issue_${idx++}`, collection: 'users', docId: uDoc.id,
          field: 'mfaEnabled', severity: 'warning', issueType: 'mfa_secret_missing',
          title: 'MFA enabled but secret missing',
          description: `User ${u.email ?? uDoc.id} has mfaEnabled=true but no TOTP secret.`,
          howToFix: 'Will reset mfaEnabled to false — user will re-enroll on next login.',
          canAutoFix: true,
        });
      }

      if (!u.email) {
        issues.push({
          id: `issue_${idx++}`, collection: 'users', docId: uDoc.id,
          field: 'email', severity: 'critical', issueType: 'missing_email',
          title: 'User has no email',
          description: `User "${uDoc.id}" is missing an email address.`,
          howToFix: 'Cannot auto-fix — requires manual review.',
          canAutoFix: false,
        });
      }
    }

    // ── Tenant checks ────────────────────────────────────────────────────────
    for (const tDoc of tenantsSnap.docs) {
      const t = tDoc.data() as any;
      if (!t.name || t.name.trim() === '') {
        issues.push({
          id: `issue_${idx++}`, collection: 'tenants', docId: tDoc.id,
          field: 'name', severity: 'critical', issueType: 'missing_name',
          title: 'Tenant has no name',
          description: `Tenant "${tDoc.id}" is missing a name.`,
          howToFix: 'Will set name to tenant ID as fallback.',
          canAutoFix: true,
        });
      }
      if (!t.status || !['active', 'suspended', 'trial'].includes(t.status)) {
        issues.push({
          id: `issue_${idx++}`, collection: 'tenants', docId: tDoc.id,
          field: 'status', severity: 'warning', issueType: 'invalid_status',
          title: `Invalid tenant status "${t.status ?? '(none)'}"`,
          description: `Tenant "${t.name ?? tDoc.id}" has status "${t.status}" which is not valid.`,
          howToFix: 'Will set status to "trial".',
          canAutoFix: true,
        });
      }
    }

    // ── Orphaned MFA secrets ─────────────────────────────────────────────────
    for (const mDoc of mfaSnap.docs) {
      if (!userIds.has(mDoc.id)) {
        issues.push({
          id: `issue_${idx++}`, collection: 'user_mfa_secrets', docId: mDoc.id,
          field: '', severity: 'info', issueType: 'orphaned_mfa_secret',
          title: 'Orphaned MFA secret',
          description: `MFA secret exists for UID "${mDoc.id}" but the user document is gone.`,
          howToFix: 'Will delete the orphaned secret.',
          canAutoFix: true,
        });
      }
    }

    // ── Audit log integrity ──────────────────────────────────────────────────
    for (const aDoc of auditSnap.docs) {
      const a = aDoc.data() as any;
      if (!a.userId || !a.action) {
        issues.push({
          id: `issue_${idx++}`, collection: 'audit_logs', docId: aDoc.id,
          field: 'userId', severity: 'info', issueType: 'incomplete_audit_log',
          title: 'Incomplete audit log entry',
          description: `Audit log "${aDoc.id}" is missing userId or action fields.`,
          howToFix: 'Will delete the malformed entry.',
          canAutoFix: true,
        });
      }
    }

    return NextResponse.json({ issues, checkedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('[consistency] check error:', err);
    return NextResponse.json({ error: err.message ?? 'Check failed' }, { status: 500 });
  }
}

// =============================================================================
// PATCH — apply a specific fix
// =============================================================================
export async function PATCH(req: NextRequest) {
  try {
    const db = getAdminFirestore();
    const body = await req.json() as { issueId: string; issue: ConsistencyIssue };
    const { issue } = body;
    if (!issue) return NextResponse.json({ error: 'issue required' }, { status: 400 });

    const now = new Date().toISOString();

    switch (issue.issueType) {
      case 'invalid_role':
        await db.collection('users').doc(issue.docId).update({ role: 'report_viewer', updatedAt: now });
        break;
      case 'orphaned_tenant_ref': {
        // Read the current tenantIds and remove the bad one
        const uSnap = await db.collection('users').doc(issue.docId).get();
        if (uSnap.exists) {
          const u = uSnap.data() as any;
          const orphanTid = issue.title.match(/"([^"]+)"/)?.[1];
          if (orphanTid) {
            const newIds = (u.tenantIds ?? []).filter((t: string) => t !== orphanTid);
            await db.collection('users').doc(issue.docId).update({
              tenantIds: newIds,
              tenantId: u.tenantId === orphanTid ? null : u.tenantId,
              updatedAt: now,
            });
          }
        }
        break;
      }
      case 'mfa_secret_missing':
        await db.collection('users').doc(issue.docId).update({ mfaEnabled: false, mfaEnrolledAt: null, updatedAt: now });
        break;
      case 'missing_name':
        await db.collection('tenants').doc(issue.docId).update({ name: issue.docId, updatedAt: now });
        break;
      case 'invalid_status':
        await db.collection('tenants').doc(issue.docId).update({ status: 'trial', updatedAt: now });
        break;
      case 'orphaned_mfa_secret':
        await db.collection('user_mfa_secrets').doc(issue.docId).delete();
        break;
      case 'incomplete_audit_log':
        await db.collection('audit_logs').doc(issue.docId).delete();
        break;
      default:
        return NextResponse.json({ error: 'Unknown fix type' }, { status: 400 });
    }

    // Audit the fix
    await db.collection('audit_logs').add({
      tenantId: 'master', userId: 'consistency_inspector', userName: 'Consistency Inspector',
      action: 'CONSISTENCY_FIX', resourceId: issue.docId, resourceType: issue.collection,
      resourceName: `${issue.collection}/${issue.docId} — ${issue.issueType}`,
      status: 'success', ipAddress: 'server', userAgent: 'Consistency Inspector UI',
      occurredAt: now,
    }).catch(() => {});

    return NextResponse.json({ fixed: true, issueId: issue.id });
  } catch (err: any) {
    console.error('[consistency] fix error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
