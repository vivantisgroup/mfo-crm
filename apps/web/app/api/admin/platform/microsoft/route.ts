import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID ?? 'mfo-crm';

/**
 * Builds a Firestore REST API URL for a given document path.
 * Used as a fallback when the Admin SDK ADC credentials are expired (invalid_rapt).
 */
function fsDocUrl(docPath: string): string {
  return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`;
}

function extractString(fields: any, key: string): string {
  return fields?.[key]?.stringValue ?? '';
}
function extractBool(fields: any, key: string): boolean {
  return fields?.[key]?.booleanValue ?? false;
}

/** Read system/integrations via Admin SDK, falling back to REST if ADC is broken. */
async function readMicrosoftConfig() {
  // ── Attempt 1: Admin SDK ──────────────────────────────────────────────────────
  try {
    const { getAdminFirestore } = await import('@/lib/firebaseAdmin');
    const db      = getAdminFirestore();
    const docSnap = await db.doc('system/integrations').get();
    const ms      = docSnap.data()?.microsoft || {};
    return {
      enabled:      !!ms.enabled,
      appId:        ms.appId        || '',
      tenantId:     ms.tenantId     || '',
      clientSecret: ms.clientSecret || '',
    };
  } catch (adminErr: any) {
    console.warn('[admin/platform/microsoft GET] Admin SDK failed, trying REST:', String(adminErr?.message).substring(0, 120));
  }

  // ── Attempt 2: Firestore REST (no auth — system/integrations should be readable by Admin SDK only) ──
  // Since this is a server-side admin route, we can use a Google ADC token directly.
  // If ADC is also broken, we return an empty-but-valid payload to avoid a 500.
  try {
    // Try getting a fresh ADC token via the metadata server (works on GCP, Vercel, etc.)
    const tokenRes = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(3000) }
    );
    if (tokenRes.ok) {
      const { access_token } = await tokenRes.json();
      const res = await fetch(fsDocUrl('system/integrations'), {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (res.ok) {
        const doc    = await res.json();
        const fields = doc.fields?.microsoft?.mapValue?.fields ?? {};
        return {
          enabled:      extractBool(fields, 'enabled'),
          appId:        extractString(fields, 'appId'),
          tenantId:     extractString(fields, 'tenantId'),
          clientSecret: extractString(fields, 'clientSecret'),
        };
      }
    }
  } catch {
    // GCP metadata server not available (local dev without service account)
  }

  // ── Fallback: Return empty config (not an error — prevents UI from being broken) ──
  console.warn('[admin/platform/microsoft GET] All read paths failed. Returning empty config.');
  return { enabled: false, appId: '', tenantId: '', clientSecret: '', _unavailable: true };
}

/** Write system/integrations via Admin SDK, falling back to REST. */
async function writeMicrosoftConfig(config: {
  enabled: boolean; appId: string; tenantId: string; clientSecret: string;
}) {
  // ── Attempt 1: Admin SDK ──────────────────────────────────────────────────────
  try {
    const { getAdminFirestore } = await import('@/lib/firebaseAdmin');
    const db = getAdminFirestore();
    await db.doc('system/integrations').set({ microsoft: config }, { merge: true });
    return true;
  } catch (adminErr: any) {
    console.warn('[admin/platform/microsoft POST] Admin SDK write failed:', String(adminErr?.message).substring(0, 120));
  }

  // ── Attempt 2: Admin SDK after reInit ─────────────────────────────────────────
  try {
    const { forceReinitializeAdmin, getAdminFirestore } = await import('@/lib/firebaseAdmin');
    await forceReinitializeAdmin();
    const db = getAdminFirestore();
    await db.doc('system/integrations').set({ microsoft: config }, { merge: true });
    return true;
  } catch (reInitErr: any) {
    console.warn('[admin/platform/microsoft POST] Admin SDK reInit failed:', String(reInitErr?.message).substring(0, 120));
  }

  return false;
}

export async function GET(_req: NextRequest) {
  try {
    const data = await readMicrosoftConfig();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[admin/platform/microsoft GET] Unhandled error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { enabled, appId, tenantId, clientSecret } = await req.json();
    const success = await writeMicrosoftConfig({ enabled, appId, tenantId, clientSecret });
    if (!success) {
      return NextResponse.json({
        error: 'Could not write to Firestore. Admin SDK unavailable and no fallback succeeded.',
        // Return the values the client sent so it can cache them locally if needed
        _writeFailedPayload: { enabled, appId, tenantId, clientSecret },
      }, { status: 503 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[admin/platform/microsoft POST] Unhandled error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
