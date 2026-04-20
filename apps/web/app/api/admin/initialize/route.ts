/**
 * /api/admin/initialize/route.ts
 *
 * One-time platform bootstrap. Called from the /setup page.
 *
 * GET  — Returns whether the platform is already initialized.
 * POST — Bootstraps the platform using dual-mode execution:
 *   • MODE A (Admin SDK)   — when FIREBASE_ADMIN_SDK_JSON is a valid service account JSON.
 *   • MODE B (REST API)    — when no service account is available (local dev without credentials).
 *     Uses Firebase Auth REST API to create the user + Firestore REST API with an ID token
 *     to write documents. Works because Firestore rules allow setup-mode writes when
 *     `platform/config` doesn't exist yet.
 *
 * Firestore rules required (already in place):
 *   /platform/config         — allow create if !exists(platform/config)
 *   /tenants/{id}            — allow create if !exists(platform/config)
 *   /tenants/{id}/members/*  — allow create if !exists(platform/config)
 *   /users/{uid}             — allow create if !exists(platform/config)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, getAdminAuth, hasAdminWriteAccess } from '@/lib/firebaseAdmin';

// ─── Collections to wipe on initialization ────────────────────────────────────

// Top-level single-doc collections
const WIPE_TOP_LEVEL = [
  'platform',                              // ← wipe first so Firestore rules allow re-create
  'audit_logs', 'platform_backups', 'notifications',
  'tenant_invitations', 'copilot_sessions', 'suitability_tokens',
  'suitability_responses', 'subscription_events',
  'object_acls', 'subscriptions', 'subscription_plans',
  'platform_orgs', 'platform_contacts', 'mfa_codes'
];

// Subcollections under /tenants/{tenantId}
const WIPE_TENANT_SUBCOLLECTIONS = [
  'crm_contacts', 'crm_opportunities', 'crm_activities', 'crm_pipelines',
  'platform_orgs', 'platform_contacts', 'platform_opportunities',
  'platform_crm_activities', 'platform_sales_teams',
  'support_tickets', 'expenses', 'renewals', 'invoices', 'activities', 'opportunities',
  'communications', 'members', 'email_templates', 'tenant_groups'
];

// ─── Seed data ────────────────────────────────────────────────────────────────

const ALL_ROLES = [
  { id: 'saas_master_admin',       name: 'SaaS Master Admin',       description: 'Full platform access. Can manage all tenants, billing, and infrastructure.', level: 100, color: '#6366f1', icon: '🏛️', group: 'Platform' },
  { id: 'tenant_admin',            name: 'Tenant Admin',            description: 'Full access to their tenant: users, settings, CRM, billing.',                 level: 80,  color: '#8b5cf6', icon: '🏢', group: 'Tenant' },
  { id: 'business_manager',        name: 'Business Manager',        description: 'Manages business operations. CRM read/write, reports, task management.',       level: 70,  color: '#a78bfa', icon: '💼', group: 'Platform Sales' },
  { id: 'sales_manager',           name: 'Sales Manager',           description: 'Leads the sales team. Full CRM access, quota management, pipeline oversight.',  level: 65,  color: '#7c3aed', icon: '📊', group: 'Platform Sales' },
  { id: 'revenue_manager',         name: 'Revenue Manager',         description: 'Owns revenue targets. Manages pricing, renewals, and billing escalations.',    level: 65,  color: '#6d28d9', icon: '💰', group: 'Platform Sales' },
  { id: 'account_executive',       name: 'Account Executive',       description: 'Closes deals. Owns opportunities, contacts, and account relationship.',         level: 60,  color: '#5b21b6', icon: '🤝', group: 'Platform Sales' },
  { id: 'sdr',                     name: 'SDR',                     description: 'Sources and qualifies leads. Early-stage pipeline management.',                  level: 55,  color: '#4c1d95', icon: '📞', group: 'Platform Sales' },
  { id: 'customer_success_manager',name: 'Customer Success Manager',description: 'Drives retention and expansion. Manages onboarding and health scores.',         level: 60,  color: '#7c3aed', icon: '🌟', group: 'Platform Sales' },
  { id: 'sales_operations',        name: 'Sales Operations',        description: 'CRM admin, process optimization, reporting, and tooling.',                       level: 58,  color: '#6d28d9', icon: '⚙️', group: 'Platform Sales' },
  { id: 'relationship_manager',    name: 'Relationship Manager',    description: 'Client-facing. Manages family/advisor relationships within a tenant.',           level: 50,  color: '#0ea5e9', icon: '🤝', group: 'Tenant' },
  { id: 'cio',                     name: 'CIO / Investment Officer', description: 'Manages investment strategies and portfolio analytics.',                        level: 50,  color: '#0284c7', icon: '📈', group: 'Tenant' },
  { id: 'controller',              name: 'Controller',              description: 'Financial oversight: billing, expense tracking, accounting reconciliation.',     level: 50,  color: '#0369a1', icon: '🧾', group: 'Tenant' },
  { id: 'compliance_officer',      name: 'Compliance Officer',      description: 'Manages regulatory compliance, audit trails, and risk assessments.',             level: 50,  color: '#0c4a6e', icon: '⚖️', group: 'Tenant' },
  { id: 'ai_officer',              name: 'AI Officer',              description: 'Manages AI Keys and system prompts for the tenant.',                             level: 75,  color: '#10b981', icon: '🤖', group: 'Tenant' },
  { id: 'report_viewer',           name: 'Report Viewer',           description: 'Read-only access to reports and dashboards within their tenant.',                level: 20,  color: '#64748b', icon: '📋', group: 'Tenant' },
  { id: 'external_advisor',        name: 'External Advisor',        description: 'Limited read-only view of permitted client data.',                               level: 10,  color: '#94a3b8', icon: '👁️', group: 'External' },
];

const EMAIL_TEMPLATE_STUBS = [
  { key: 'member_invite',       name: 'Member Invitation',        subject_en: 'You have been invited to join {{platformName}}',         subject_pt: 'Você foi convidado para {{platformName}}',              body_en: 'Hello {{name}},\n\nYou have been invited to join {{tenantName}} on {{platformName}}.\n\nClick the link below to accept your invitation and create your account:\n{{inviteLink}}\n\nThis link expires in 48 hours.\n\nBest regards,\nThe {{platformName}} Team', body_pt: 'Olá {{name}},\n\nVocê foi convidado para {{tenantName}} no {{platformName}}.\n\nClique no link abaixo para aceitar seu convite:\n{{inviteLink}}\n\nEste link expira em 48 hours.\n\nAtenciosamente,\nEquipe {{platformName}}' },
  { key: 'password_reset',      name: 'Password Reset',           subject_en: 'Reset your {{platformName}} password',                   subject_pt: 'Redefinir sua senha do {{platformName}}',               body_en: 'Hello {{name}},\n\nClick the link below to reset your password:\n{{resetLink}}\n\nThis link expires in 1 hour.\n\nBest regards,\nThe {{platformName}} Team', body_pt: 'Olá {{name}},\n\nClique no link abaixo para redefinir sua senha:\n{{resetLink}}\n\nAtenciosamente,\nEquipe {{platformName}}' },
  { key: 'role_changed',        name: 'Role Changed Notification',subject_en: 'Your role on {{platformName}} has been updated',          subject_pt: 'Sua função no {{platformName}} foi atualizada',         body_en: 'Hello {{name}},\n\nYour role has been updated to: {{newRole}}\n\nBest regards,\nThe {{platformName}} Team', body_pt: 'Olá {{name}},\n\nSua função foi atualizada para: {{newRole}}\n\nAtenciosamente,\nEquipe {{platformName}}' },
  { key: 'mfa_enrolled',        name: 'MFA Enrollment Confirmed', subject_en: '2-Factor Authentication enabled on your account',        subject_pt: 'Autenticação de 2 Fatores ativada na sua conta',        body_en: 'Hello {{name}},\n\n2FA has been successfully enabled.\n\nBest regards,\nThe {{platformName}} Team', body_pt: 'Olá {{name}},\n\n2FA foi ativado com sucesso.\n\nAtenciosamente,\nEquipe {{platformName}}' },
  { key: 'trial_expiring',      name: 'Trial Expiring Soon',      subject_en: 'Your {{platformName}} trial expires in {{days}} days',   subject_pt: 'Seu período de teste expira em {{days}} dias',          body_en: 'Hello {{name}},\n\nYour trial expires in {{days}} days. Upgrade to continue.\n\nBest regards,\nThe {{platformName}} Team', body_pt: 'Olá {{name}},\n\nSeu trial expira em {{days}} dias. Faça upgrade.\n\nAtenciosamente,\nEquipe {{platformName}}' },
  { key: 'subscription_renewed',name: 'Subscription Renewed',     subject_en: 'Your {{platformName}} subscription has been renewed',    subject_pt: 'Sua assinatura do {{platformName}} foi renovada',       body_en: 'Hello {{name}},\n\nYour subscription has been renewed.\n\nBest regards,\nThe {{platformName}} Team', body_pt: 'Olá {{name}},\n\nSua assinatura foi renovada.\n\nAtenciosamente,\nEquipe {{platformName}}' },
];

// ─── GET: check initialization status ─────────────────────────────────────────

export const runtime = 'nodejs';

export async function GET() {
  // Try Admin SDK first (fast path)
  if (hasAdminWriteAccess()) {
    try {
      const db = getAdminFirestore();
      const configSnap = await db.collection('platform').doc('config').get();
      let initialized = configSnap.exists && configSnap.data()?.initialized === true;
      let adminCount = 0;
      if (initialized) {
        adminCount = (await db.collection('tenants').doc('master').collection('members').where('role', '==', 'saas_master_admin').limit(1).get()).size;
        if (adminCount === 0) initialized = false;
      }
      return NextResponse.json({ initialized, adminCount });
    } catch { /* fall through to REST */ }
  }

  // Fall back to Firestore REST (no credentials needed — platform/config is publicly readable)
  try {
    const projectId = process.env.NEXT_PUBLIC_PROJECT_ID ?? 'mfo-crm';
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/platform/config`;
    const res = await fetch(url);
    if (res.status === 404) return NextResponse.json({ initialized: false, adminCount: 0 });
    if (res.ok) {
      const data = await res.json();
      const initialized = data.fields?.initialized?.booleanValue === true;
      return NextResponse.json({ initialized, adminCount: initialized ? 1 : 0 });
    }
    return NextResponse.json({ initialized: false, adminCount: 0 });
  } catch (err: any) {
    return NextResponse.json({ initialized: false, adminCount: 0, sdkError: err.message });
  }
}

// ─── Wipe helpers ─────────────────────────────────────────────────────────────

/**
 * Wipe via REST API (fallback). Cannot use recursive delete, so we manually
 * delete known lists and iterate through all tenants to clear their subcollections.
 */
async function wipeCollectionsViaRest(projectId: string, idToken: string): Promise<{ wiped: number; errors: string[] }> {
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  let wiped = 0;
  const errors: string[] = [];

  const deleteCollection = async (colPath: string) => {
    let pageToken: string | undefined;
    do {
      const listUrl = `${base}/${colPath}?pageSize=100${pageToken ? `&pageToken=${pageToken}` : ''}`;
      const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${idToken}` } });
      if (!listRes.ok) break; 
      const listData = await listRes.json();
      pageToken = listData.nextPageToken;

      const docs: Array<{ name: string }> = listData.documents ?? [];
      for (const doc of docs) {
        const delRes = await fetch(`https://firestore.googleapis.com/v1/${doc.name}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${idToken}` },
        });
        if (delRes.ok) wiped++;
        else errors.push(`delete ${doc.name}: ${delRes.status}`);
      }
    } while (pageToken);
  };

  // 0. Explicitly delete platform/config to force the Firestore rules into
  // isSetupMode() = true. The wipe iterate-delete fails to list the collection
  // if we don't break the lock first.
  const explicitDel = await fetch(`${base}/platform/config`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${idToken}` },
  });
  console.log('[initialize] Explicit DELETE /platform/config status:', explicitDel.status);
  if (!explicitDel.ok) {
    const errText = await explicitDel.text();
    console.error('[initialize] Explicit DELETE failed:', errText);
  }

  // 1. Wipe simple top-level collections
  for (const col of WIPE_TOP_LEVEL) {
    await deleteCollection(col);
  }
  // 2. Wipe users
  await deleteCollection('users');

  // 3. For tenants, we must first wipe known subcollections for each tenant, then the tenant itself.
  try {
    const listUrl = `${base}/tenants?pageSize=100`;
    const res = await fetch(listUrl, { headers: { Authorization: `Bearer ${idToken}` } });
    if (res.ok) {
      const data = await res.json();
      const docs: Array<{ name: string }> = data.documents ?? [];
      for (const tDoc of docs) {
        // extract tenantId from name: projects/P/databases/(default)/documents/tenants/T
        const tenantId = tDoc.name.split('/').pop()!;
        for (const subcol of WIPE_TENANT_SUBCOLLECTIONS) {
          await deleteCollection(`tenants/${tenantId}/${subcol}`);
        }
      }
    }
  } catch { /* ignore */ }

  // Now wipe the tenants collection itself
  await deleteCollection('tenants');

  return { wiped, errors };
}

/**
 * Wipe via Admin SDK (fastest). Uses recursiveDelete to obliterate
 * tenants and users along with all nested subcollections cleanly.
 */
async function wipeCollectionsViaAdminSdk(db: any): Promise<{ wiped: number }> {
  let wiped = 0;
  
  // Wipe top-level simple collections
  for (const col of WIPE_TOP_LEVEL) {
    try {
      let snapshot = await db.collection(col).limit(500).get();
      while (!snapshot.empty) {
        const batch = db.batch();
        snapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
        await batch.commit();
        wiped += snapshot.size;
        snapshot = await db.collection(col).limit(500).get();
      }
    } catch { /* ignore */ }
  }

  // Wipe all tenants (and their subcollections) via recursiveDelete
  try {
    const tenants = await db.collection('tenants').get();
    for (const doc of tenants.docs) {
      await db.recursiveDelete(doc.ref);
      wiped++; // roughly counting the top-level doc
    }
  } catch { /* ignore */ }

  // Wipe all users via recursiveDelete
  try {
    const users = await db.collection('users').get();
    for (const doc of users.docs) {
      await db.recursiveDelete(doc.ref);
      wiped++;
    }
  } catch { /* ignore */ }

  return { wiped };
}

// ─── Firestore REST helpers ────────────────────────────────────────────────────

function toFirestoreFields(data: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined)  { fields[k] = { nullValue: null }; }
    else if (typeof v === 'string')     { fields[k] = { stringValue: v }; }
    else if (typeof v === 'boolean')    { fields[k] = { booleanValue: v }; }
    else if (typeof v === 'number')     { fields[k] = { integerValue: String(v) }; }
    else if (Array.isArray(v))          { fields[k] = { arrayValue: { values: v.map((item: any) => ({ stringValue: String(item) })) } }; }
    else if (typeof v === 'object')     {
      fields[k] = { mapValue: { fields: toFirestoreFields(v) } };
    }
  }
  return fields;
}

async function firestoreWrite(
  projectId: string, collection: string, docId: string,
  data: Record<string, any>, idToken: string
): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) {
    const textBody = await res.text();
    console.error(`[firestoreWrite] Error on /${collection}/${docId}:`, res.status, textBody);
    let errObj: any = {};
    try { errObj = JSON.parse(textBody); } catch {}
    throw new Error(`Firestore write /${collection}/${docId} failed: ${errObj?.error?.message ?? res.statusText}`);
  }
}

async function firestoreWriteSubcollection(
  projectId: string, path: string, data: Record<string, any>, idToken: string
): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Firestore write /${path} failed: ${err?.error?.message ?? res.statusText}`);
  }
}

// ─── POST: bootstrap the platform ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    platformName   = 'MFO Nexus',
    adminEmail,
    adminPassword,
    adminName,
    force          = false,
  } = body;

  if (!adminEmail || !adminPassword || !adminName) {
    return NextResponse.json({ error: 'adminEmail, adminPassword, adminName are required' }, { status: 400 });
  }

  const projectId = process.env.NEXT_PUBLIC_PROJECT_ID ?? 'mfo-crm';
  const apiKey    = process.env.NEXT_PUBLIC_FB_API_KEY ?? '';
  const now       = new Date().toISOString();

  // ════════════════════════════════════════════════════════════════════════════
  // MODE A — Admin SDK (preferred: full power, bypasses Firestore rules)
  // ════════════════════════════════════════════════════════════════════════════
  if (hasAdminWriteAccess()) {
    let db: any, auth: any;
    try {
      db   = getAdminFirestore();
      auth = getAdminAuth();
      // Quick check that credentials actually work
      await db.collection('platform').doc('config').get();
    } catch (sdkErr: any) {
      // Credentials present but broken — fall through to MODE B
      console.warn('[initialize] Admin SDK present but unusable, falling back to REST API:', sdkErr.message);
      db = null; auth = null;
    }

    if (db && auth) {
      try {
        // Guard: already initialized? (allow force-reinit but warn)
        const configSnap = await db.collection('platform').doc('config').get();
        let initialized = configSnap.exists && configSnap.data()?.initialized;
        if (initialized) {
          const adminCount = (await db.collection('tenants').doc('master').collection('members').where('role', '==', 'saas_master_admin').limit(1).get()).size;
          if (adminCount === 0) initialized = false;
        }

        if (initialized && !force) {
          return NextResponse.json({ error: 'Platform is already initialized. Use force=true to re-initialize.' }, { status: 409 });
        }

        // ── Wipe all operational data ─────────────────────────────────────────
        console.log('[initialize] Wiping operational collections via Admin SDK...');
        const { wiped } = await wipeCollectionsViaAdminSdk(db);
        console.log(`[initialize] Wiped ${wiped} documents.`);

        // Create/update Firebase Auth user
        let uid: string;
        const existing = await auth.getUserByEmail(adminEmail).catch(() => null);
        if (existing) {
          uid = existing.uid;
          await auth.updateUser(uid, { displayName: adminName, password: adminPassword });
        } else {
          const created = await auth.createUser({ email: adminEmail, password: adminPassword, displayName: adminName });
          uid = created.uid;
        }

        const batch = db.batch();
        _seedBatch(batch, db, uid, adminEmail, adminName, platformName, now);
        await batch.commit();
        await db.collection('audit_logs').add({
          tenantId: 'master', userId: uid, userName: adminName,
          action: 'PLATFORM_INITIALIZED', resourceType: 'platform', resourceId: 'config',
          resourceName: 'Platform Configuration', status: 'success',
          ipAddress: 'setup-wizard', userAgent: 'Platform Setup Wizard', occurredAt: now,
        });

        return NextResponse.json({ success: true, uid, mode: 'admin-sdk', wiped, message: `Platform initialized. ${adminEmail} is now the SaaS Master Admin.` });
      } catch (err: any) {
        console.error('[initialize] Admin SDK mode failed:', err.message);
        // Fall through to REST mode
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MODE B — Firebase REST API (no service account required)
  // Works because Firestore rules allow setup-mode writes when platform/config
  // does not yet exist. The admin user signs in to get an ID token.
  // ════════════════════════════════════════════════════════════════════════════
  if (!apiKey) {
    return NextResponse.json({
      error: 'NEXT_PUBLIC_FB_API_KEY is not set. Cannot initialize via REST API fallback.',
    }, { status: 503 });
  }

  try {
    // ── Check if already initialized via REST (no auth needed) ──────────────
    const configUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/platform/config`;
    const configCheck = await fetch(configUrl);
    if (configCheck.ok && !force) {
      const configData = await configCheck.json();
      if (configData.fields?.initialized?.booleanValue === true) {
        return NextResponse.json({ error: 'Platform is already initialized.' }, { status: 409 });
      }
    }

    // ── Step 1: Create or sign in the Firebase Auth user ─────────────────────
    let uid: string;
    let idToken: string;

    // Try creating first
    const createRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword, displayName: adminName, returnSecureToken: true }),
      }
    );
    const createData = await createRes.json();

    if (createData.idToken) {
      uid      = createData.localId;
      idToken  = createData.idToken;
    } else if (createData.error?.message?.includes('EMAIL_EXISTS')) {
      // User already exists — sign in
      const signInRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: adminEmail, password: adminPassword, returnSecureToken: true }),
        }
      );
      const signInData = await signInRes.json();
      if (!signInData.idToken) {
        return NextResponse.json({ error: `Sign-in failed: ${signInData.error?.message ?? 'Unknown error'}` }, { status: 401 });
      }
      uid     = signInData.localId;
      idToken = signInData.idToken;
    } else {
      return NextResponse.json({ error: `User creation failed: ${createData.error?.message ?? 'Unknown error'}` }, { status: 500 });
    }

    // ── Step 2: Wipe all operational data ────────────────────────────────────
    // Uses the admin user's ID token so Firestore rules allow the deletes.
    console.log('[initialize] Wiping operational collections via REST API...');
    const { wiped, errors: wipeErrors } = await wipeCollectionsViaRest(projectId, idToken);
    console.log(`[initialize] REST wipe: ${wiped} docs deleted, ${wipeErrors.length} errors`);
    if (wipeErrors.length > 0) console.warn('[initialize] Wipe errors (non-fatal):', wipeErrors.slice(0, 5));

    // ── Step 3: Write all Firestore documents via REST using ID token ─────────
    // NOTE: platform/config is intentionally written LAST, because once it
    // exists with initialized=true, the 'isSetupMode()' Firestore rule
    // evaluates to false, locking the rest of the writes out.
    // platform/notifications
    await firestoreWrite(projectId, 'platform', 'notifications', {
      emailFrom: `noreply@${adminEmail.split('@')[1]}`,
      emailFromName: platformName, enableSendgrid: false, enableSmtp: false, updatedAt: now,
    }, idToken);

    // tenants/master
    await firestoreWrite(projectId, 'tenants', 'master', {
      id: 'master', name: platformName, status: 'active',
      isInternal: true, brandColor: '#6366f1', createdBy: uid,
      industryVertical: 'generic', contactName: adminName, contactEmail: adminEmail,
      plan: 'enterprise', currency: 'USD', createdAt: now, updatedAt: now,
    }, idToken);

    // users/{uid}
    await firestoreWrite(projectId, 'users', uid, {
      uid, email: adminEmail, displayName: adminName, name: adminName,
      role: 'saas_master_admin', tenantId: 'master', tenantIds: ['master'],
      status: 'active', mfaEnabled: false, mfaEnrollRequired: false,
      preferredLanguage: 'en', department: 'Platform Administration',
      jobTitle: 'SaaS Master Admin', createdAt: now, updatedAt: now,
    }, idToken);

    // tenants/master/members/{uid}
    await firestoreWriteSubcollection(projectId, `tenants/master/members/${uid}`, {
      uid, email: adminEmail, name: adminName,
      role: 'saas_master_admin', status: 'active', joinedAt: now,
    }, idToken);

    // roles
    for (const role of ALL_ROLES) {
      await firestoreWrite(projectId, 'roles', role.id, { ...role, createdAt: now, updatedAt: now, isSystem: true }, idToken);
    }

    // email_templates
    for (const tmpl of EMAIL_TEMPLATE_STUBS) {
      await firestoreWrite(projectId, 'email_templates', tmpl.key, { ...tmpl, createdAt: now, updatedAt: now, isSystem: true }, idToken);
    }

    // audit_logs (best-effort)
    try {
      const logUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/audit_logs`;
      await fetch(logUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ fields: toFirestoreFields({
          tenantId: 'master', userId: uid, userName: adminName,
          action: 'PLATFORM_INITIALIZED', resourceType: 'platform', resourceId: 'config',
          resourceName: 'Platform Configuration', status: 'success',
          ipAddress: 'setup-wizard', userAgent: 'Platform Setup Wizard', occurredAt: now,
        }) }),
      });
    } catch { /* non-fatal */ }

    // ── Step 4: Write platform/config to FINALIZE and LOCK the database ──────
    // This immediately drops isSetupMode() to false everywhere in Firestore.
    await firestoreWrite(projectId, 'platform', 'config', {
      initialized: true, initializedAt: now, initializedBy: uid,
      platformName, version: '2.0.0',
      features: { mfa: true, demoData: true, catalogExplorer: true, backups: true, multiVertical: true },
    }, idToken);

    return NextResponse.json({
      success: true, uid, mode: 'rest-api', wiped,
      message: `Platform initialized via REST API. ${adminEmail} is now the SaaS Master Admin.`,
    });

  } catch (err: any) {
    console.error('[initialize] REST API mode failed:', err.message);
    return NextResponse.json({ error: err.message ?? 'Initialization failed' }, { status: 500 });
  }
}

// ─── Admin SDK batch helper ───────────────────────────────────────────────────

function _seedBatch(
  batch: any, db: any,
  uid: string, adminEmail: string, adminName: string, platformName: string, now: string
) {
  batch.set(db.collection('tenants').doc('master'), {
    id: 'master', name: platformName, status: 'active',
    isInternal: true, brandColor: '#6366f1', createdBy: uid,
    industryVertical: 'generic', contactName: adminName, contactEmail: adminEmail,
    plan: 'enterprise', currency: 'USD', createdAt: now, updatedAt: now,
  });
  batch.set(db.collection('users').doc(uid), {
    uid, email: adminEmail, displayName: adminName, name: adminName,
    role: 'saas_master_admin', tenantId: 'master', tenantIds: ['master'],
    status: 'active', mfaEnabled: false, mfaEnrollRequired: false,
    preferredLanguage: 'en', department: 'Platform Administration',
    jobTitle: 'SaaS Master Admin', createdAt: now, updatedAt: now,
  });
  batch.set(db.collection('tenants').doc('master').collection('members').doc(uid), {
    uid, email: adminEmail, name: adminName, role: 'saas_master_admin', status: 'active', joinedAt: now,
  });
  batch.set(db.collection('platform').doc('config'), {
    initialized: true, initializedAt: now, initializedBy: uid, platformName, version: '2.0.0',
    features: { mfa: true, demoData: true, catalogExplorer: true, backups: true, multiVertical: true },
  });
  batch.set(db.collection('platform').doc('notifications'), {
    emailFrom: `noreply@${adminEmail.split('@')[1]}`,
    emailFromName: platformName, enableSendgrid: false, enableSmtp: false, updatedAt: now,
  });
  for (const role of ALL_ROLES) {
    batch.set(db.collection('roles').doc(role.id), { ...role, createdAt: now, updatedAt: now, isSystem: true });
  }
  for (const tmpl of EMAIL_TEMPLATE_STUBS) {
    batch.set(db.collection('email_templates').doc(tmpl.key), { ...tmpl, createdAt: now, updatedAt: now, isSystem: true });
  }
}
