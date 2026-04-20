import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminFirestore();

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const adminUid = decodedToken.uid;

    const { targetUid, targetEmail, tenantId, action } = await req.json();

    if (!targetUid || !tenantId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify admin is actually part of this tenant as an admin/owner
    // Or check if they have specific roles.
    const memberDoc = await adminDb.collection('tenants').doc(tenantId).collection('members').doc(adminUid).get();
    
    if (!memberDoc.exists) {
      return NextResponse.json({ error: 'Caller is not a member of the tenant' }, { status: 403 });
    }

    const memberData = memberDoc.data();
    if (memberData?.role !== 'tenant_admin' && memberData?.role !== 'owner' && memberData?.canImpersonate !== true) {
      return NextResponse.json({ error: 'Insufficient permissions to impersonate users' }, { status: 403 });
    }

    if (action === 'revert') {
      // Revert logic simply creates a token for the admin again, removing the impersonator claim
      // But standard login works. It's usually better to just re-login. We'll return a token.
      const customToken = await adminAuth.createCustomToken(adminUid, {
        tenant: tenantId,
      });

      await adminDb.collection('audit_logs').add({
        action: 'impersonation_reverted',
        performerId: adminUid,
        targetId: adminUid,
        tenantId,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json({ customToken });
    }

    // Impersonation logic
    // Create custom token for target user, adding custom claim that this is an impersonated session
    const customToken = await adminAuth.createCustomToken(targetUid, {
      impersonatorId: adminUid,
      tenant: tenantId,
      isImpersonating: true
    });

    // Log the event immutably
    await adminDb.collection('audit_logs').add({
      action: 'impersonation_started',
      performerId: adminUid,
      targetId: targetUid,
      targetEmail: targetEmail || '',
      tenantId,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ customToken });

  } catch (error: any) {
    console.error('Impersonation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
