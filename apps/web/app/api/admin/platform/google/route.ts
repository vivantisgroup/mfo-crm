import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID ?? 'mfo-crm';

/**
 * Builds a Firestore REST API URL for a given document path.
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

/** Read system/integrations/google via Admin SDK, falling back to REST if needed. */
async function readGoogleConfig() {
  // ── Attempt 1: Admin SDK ──────────────────────────────────────────────────────
  try {
    const { getAdminFirestore } = await import('@/lib/firebaseAdmin');
    const db      = getAdminFirestore();
    const docSnap = await db.doc('system/integrations').get();
    const goog    = docSnap.data()?.google || {};
    return {
      enabled:      !!goog.enabled,
      clientId:     goog.clientId || '',
      clientSecret: goog.clientSecret || '',
    };
  } catch (adminErr: any) {
    console.warn('[admin/platform/google GET] Admin SDK failed, trying REST:', String(adminErr?.message).substring(0, 120));
  }

  // ── Attempt 2: Firestore REST (using Google ADC token) ────────────────────────
  try {
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
        const fields = doc.fields?.google?.mapValue?.fields ?? {};
        return {
          enabled:      extractBool(fields, 'enabled'),
          clientId:     extractString(fields, 'clientId'),
          clientSecret: extractString(fields, 'clientSecret'),
        };
      }
    }
  } catch {}

  // ── Fallback ──────────────────────────────────────────────────────────────────
  console.warn('[admin/platform/google GET] All read paths failed. Returning empty config.');
  return { enabled: false, clientId: '', clientSecret: '', _unavailable: true };
}

/** Write system/integrations/google via Admin SDK. */
async function writeGoogleConfig(config: {
  enabled: boolean; clientId: string; clientSecret: string;
}) {
  try {
    const { getAdminFirestore } = await import('@/lib/firebaseAdmin');
    const db = getAdminFirestore();
    await db.doc('system/integrations').set({ google: config }, { merge: true });
    return true;
  } catch (adminErr: any) {
    console.warn('[admin/platform/google POST] Admin SDK write failed:', String(adminErr?.message).substring(0, 120));
  }

  try {
    const { forceReinitializeAdmin, getAdminFirestore } = await import('@/lib/firebaseAdmin');
    await forceReinitializeAdmin();
    const db = getAdminFirestore();
    await db.doc('system/integrations').set({ google: config }, { merge: true });
    return true;
  } catch (reInitErr: any) {
    console.warn('[admin/platform/google POST] Admin SDK reInit failed:', String(reInitErr?.message).substring(0, 120));
  }

  return false;
}

export async function GET(_req: NextRequest) {
  try {
    const data = await readGoogleConfig();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[admin/platform/google GET] Unhandled error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { enabled, clientId, clientSecret } = await req.json();
    const success = await writeGoogleConfig({ enabled, clientId, clientSecret });
    if (!success) {
      return NextResponse.json({
        error: 'Could not write to Firestore. Admin SDK unavailable and no fallback succeeded.',
        _writeFailedPayload: { enabled, clientId, clientSecret },
      }, { status: 503 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[admin/platform/google POST] Unhandled error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
