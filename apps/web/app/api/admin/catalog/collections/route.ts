import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

// Definitive collection list — kept in sync with the schema
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

export async function GET(req: NextRequest) {
  try {
    const db = getAdminFirestore();
    const { searchParams } = new URL(req.url);
    const col     = searchParams.get('collection');
    const limitN  = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
    const startId = searchParams.get('startAfter') ?? null;

    // ── Index mode: list all collections with doc counts ────────────────────
    if (!col) {
      const liveCollections = await db.listCollections();
      const liveNames = liveCollections.map((c: any) => c.id);
      
      const allNames = Array.from(new Set([...KNOWN_COLLECTIONS, ...liveNames]));

      const result = await Promise.all(
        allNames.map(async (name) => {
          try {
            // Use Admin SDK limit(1) peek
            const snap = await db.collection(name).limit(1).get();
            return {
              name,
              exists: liveNames.includes(name) || !snap.empty,
              hasData: !snap.empty,
              isKnown: KNOWN_COLLECTIONS.includes(name)
            };
          } catch {
            return { name, exists: false, hasData: false, isKnown: KNOWN_COLLECTIONS.includes(name) };
          }
        }),
      );
      return NextResponse.json({ collections: result });
    }

    // Validate the collection name (allow anything that's known or dynamically exists)
    if (!KNOWN_COLLECTIONS.includes(col)) {
      const live = await db.listCollections();
      if (!live.map((c: any) => c.id).includes(col)) {
        return NextResponse.json({ error: `Unknown collection: ${col}` }, { status: 400 });
      }
    }

    // ── Document browse mode ────────────────────────────────────────────────
    let ref: any = db.collection(col).limit(limitN);

    if (startId) {
      const startSnap = await db.collection(col).doc(startId).get();
      if (startSnap.exists) {
        ref = db.collection(col).startAfter(startSnap).limit(limitN);
      }
    }

    const snap = await ref.get();
    const docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ documents: docs, hasMore: docs.length === limitN });

  } catch (err: any) {
    console.error('[catalog/collections] error:', err);
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 });
  }
}
