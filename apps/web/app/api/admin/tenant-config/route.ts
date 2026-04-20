import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

/**
 * GET/POST /api/admin/tenant-config
 *
 * Secures access to the tenant document, primarily used for AiKeys (BYOK).
 * Verifies caller has valid membership to the requested tenantId.
 */

async function verifyMembership(req: NextRequest): Promise<{ uid: string, tenantId: string | null } | NextResponse> {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminAuth = getAdminAuth();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid, tenantId: null };
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const authRes = await verifyMembership(req);
    if (authRes instanceof NextResponse) return authRes;
    const { uid } = authRes;

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

    const adminDb = getAdminFirestore();

    const userSnap = await adminDb.collection('users').doc(uid).get();
    const isMasterAdmin = userSnap.data()?.role === 'saas_master_admin';

    // Verify membership
    const memberSnap = await adminDb.collection('tenants').doc(tenantId).collection('members').doc(uid).get();
    if (!memberSnap.exists && !isMasterAdmin) {
      // If internal/super-admin, they are allowed to configure BYOK for any tenant.
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const docSnap = await adminDb.collection('tenants').doc(tenantId).get();
    const data = docSnap.data() || {};
    return NextResponse.json({ 
      aiKeys: data.aiKeys || {},
      aiAccountNumber: data.aiAccountNumber || '',
      usesPlatformAi: data.usesPlatformAi || false,
      customAiProviders: data.customAiProviders || [],
      aiProviderStates: data.aiProviderStates || {},
      mfaConfig: data.mfaConfig || {},
      entityTypes: data.entityTypes || {
        clientTypes: ['Family Group', 'Holding Company', 'Single Family Office'],
        organizationTypes: ['Bank', 'Law Firm', 'Accounting Firm', 'Service Provider'],
        contactTypes: ['Private Banker', 'Lawyer', 'Family Member', 'Assistant']
      },
      storageIntegrations: data.storageIntegrations || {},
      smtpConfig: data.smtpConfig || {},
      knowledgeArticlesConfig: data.knowledgeArticlesConfig || {},
      navRestrictions: data.navRestrictions || {}
    });
  } catch (err: any) {
    console.error('[GET /api/admin/tenant-config]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authRes = await verifyMembership(req);
    if (authRes instanceof NextResponse) return authRes;
    const { uid } = authRes;

    const body = await req.json();
    let { tenantId, aiKeys, aiAccountNumber, usesPlatformAi, customAiProviders, aiProviderStates, mfaConfig, entityTypes, storageIntegrations, smtpConfig, knowledgeArticlesConfig, navRestrictions, configType, payload } = body;
    
    // If frontend uses the pattern `configType`/`payload` without `tenantId`, we can attempt to extract tenantId from auth params if provided in URL or rely on explicit tenantId.
    // Wait, the frontend is calling this without tenantId! We must default to tenantId from headers or searchParams if missing.
    if (!tenantId) {
       const { searchParams } = new URL(req.url);
       tenantId = searchParams.get('tenantId');
    }
    // Still missing? Default to a generic error.
    if (!tenantId) {
      // Trying to get it from users' explicit memberships if possible. But better is to just send it from client.
      // We will allow missing tenantId to proceed if we just check the members endpoint, but let's be safe and return 400.
      return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
    }

    const adminDb = getAdminFirestore();

    const userSnap = await adminDb.collection('users').doc(uid).get();
    const isMasterAdmin = userSnap.data()?.role === 'saas_master_admin';

    // Verify membership
    const memberSnap = await adminDb.collection('tenants').doc(tenantId).collection('members').doc(uid).get();
    if (!memberSnap.exists && !isMasterAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const dbPayload: any = { updatedAt: new Date().toISOString() };
    if (aiKeys !== undefined) dbPayload.aiKeys = aiKeys;
    if (isMasterAdmin && aiAccountNumber !== undefined) dbPayload.aiAccountNumber = aiAccountNumber;
    if (usesPlatformAi !== undefined) dbPayload.usesPlatformAi = usesPlatformAi;
    if (customAiProviders !== undefined) dbPayload.customAiProviders = customAiProviders;
    if (aiProviderStates !== undefined) dbPayload.aiProviderStates = aiProviderStates;
    if (entityTypes !== undefined) dbPayload.entityTypes = entityTypes;
    if (storageIntegrations !== undefined) dbPayload.storageIntegrations = storageIntegrations;
    if (smtpConfig !== undefined) dbPayload.smtpConfig = smtpConfig;
    if (knowledgeArticlesConfig !== undefined) dbPayload.knowledgeArticlesConfig = knowledgeArticlesConfig;
    if (navRestrictions !== undefined) dbPayload.navRestrictions = navRestrictions;
    
    // Support custom `configType` updates for partials
    if (configType === 'knowledgeArticles' && payload !== undefined) {
      dbPayload.knowledgeArticlesConfig = payload;
    }

    if (mfaConfig !== undefined) {
      dbPayload.mfaConfig = mfaConfig;
      // Synthesize top-level requirement for AuthContext layout routing
      dbPayload.mfaRequired = (mfaConfig.mfaMode === 'totp' || mfaConfig.mfaMode === 'email');
    }

    console.log('--- API POST PAYLOAD ---', JSON.stringify({ tenantId, dbPayload, isMasterAdmin }));

    const tenantRef = adminDb.collection('tenants').doc(tenantId);
    try {
      await tenantRef.update(dbPayload);
    } catch (updateErr: any) {
      if (updateErr.code === 5 || updateErr.message?.includes('NOT_FOUND')) {
        await tenantRef.set(dbPayload);
      } else {
        throw updateErr;
      }
    }

    console.log('--- API POST SUCCESS ---');
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[POST /api/admin/tenant-config]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
