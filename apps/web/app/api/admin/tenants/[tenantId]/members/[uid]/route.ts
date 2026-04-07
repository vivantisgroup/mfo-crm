import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, getAdminAuth, hasAdminWriteAccess } from '@/lib/firebaseAdmin';

/**
 * DELETE /api/admin/tenants/[tenantId]/members/[uid]
 * Forcefully removes a user from a tenant using Admin SDK to prevent client-side desyncs.
 * 
 * Body: { idToken: string }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; uid: string }> }
) {
  try {
    const { tenantId, uid: targetUid } = await params;
    const body = await req.json();
    const idToken = body.idToken;

    if (!idToken || !targetUid || !tenantId) {
      return NextResponse.json({ error: 'idToken, targetUid, and tenantId are required.' }, { status: 400 });
    }

    const adminSdkConfigured = !!process.env.FIREBASE_ADMIN_SDK_JSON;
    const projectId = process.env.NEXT_PUBLIC_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID;

    if (!adminSdkConfigured || !hasAdminWriteAccess()) {
      // Degraded fallback: attempt normal REST
      const urlMembers = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/tenants/${tenantId}/members/${targetUid}`;
      await fetch(urlMembers, { method: 'DELETE', headers: { Authorization: `Bearer ${idToken}` } });
      
      // Attempt to load the user's global profile to check for orphaned status
      const urlUser = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${targetUid}`;
      const userRes = await fetch(urlUser, { headers: { Authorization: `Bearer ${idToken}` } });
      if (userRes.ok) {
        const userData = await userRes.json();
        const tIdsRaw = userData.fields?.tenantIds?.arrayValue?.values || [];
        const tIds = tIdsRaw.map((v: any) => v.stringValue);
        const isLastTenant = tIds.length === 1 && tIds[0] === tenantId;
        
        if (isLastTenant) {
           await fetch(urlUser, { method: 'DELETE', headers: { Authorization: `Bearer ${idToken}` } });
           // Cannot easily delete from Auth via REST without the TARGET's idToken.
        } else {
           // We technically cannot easily patch an arrayRemove using REST from edge. 
           // This fallback is only for non-Admin SDK environments, which are minimal dev sandboxes.
        }
      }
      return NextResponse.json({ success: true, method: 'rest_partial' });
    }

    // ─── Native Admin SDK Flow ───────────────────────────────────────────────────────────
    const adminDb = getAdminFirestore();
    const adminAuth = getAdminAuth();

    // 1. Verify caller has permissions (is saas_master_admin or tenant_admin)
    // We simply verify they have a valid token since this is an admin route,
    // but ideally we decode the token.
    const decodedVal = await adminAuth.verifyIdToken(idToken);
    
    // Check if the user is a saas_master_admin
    const callerSnap = await adminDb.collection('users').doc(decodedVal.uid).get();
    const isSaas = callerSnap.data()?.role === 'saas_master_admin';
    
    // Check if the user is a tenant admin
    const callerMemberSnap = await adminDb.collection('tenants').doc(tenantId).collection('members').doc(decodedVal.uid).get();
    const isTenantAdmin = callerMemberSnap.data()?.role === 'tenant_admin';

    if (!isSaas && !isTenantAdmin) {
      return NextResponse.json({ error: 'Permission denied: Caller must be SaaS Master Admin or Tenant Admin.' }, { status: 403 });
    }

    // 2. Safely read the target user document
    const userRef = adminDb.collection('users').doc(targetUid);
    const userSnap = await userRef.get();
    const tenantIds: string[] = userSnap.data()?.tenantIds ?? [];
    const isLastTenant = tenantIds.length === 0 || (tenantIds.length === 1 && tenantIds[0] === tenantId);

    // 3. Prepare an explicit atomic batch on the server
    const batch = adminDb.batch();

    // Always delete from the members subcollection
    const memberRef = adminDb.collection('tenants').doc(tenantId).collection('members').doc(targetUid);
    batch.delete(memberRef);

    if (isLastTenant) {
      // The user is orphaned. Remove entirely from /users and Firebase Auth.
      batch.delete(userRef);
    } else if (userSnap.exists) {
      // The user remains in other tenants. Remove just this tenantId.
      const FieldValue = (await import('firebase-admin/firestore')).FieldValue;
      batch.update(userRef, {
        tenantIds: FieldValue.arrayRemove(tenantId),
        updatedAt: new Date().toISOString()
      });
    }

    await batch.commit();

    // Finally, if it was the last tenant, sweep Firebase Auth
    if (isLastTenant) {
      try {
        await adminAuth.deleteUser(targetUid);
      } catch (authErr: any) {
        // We log it, but the DB batch already succeeded, so we treat this as a soft-fail.
        console.error('[DELETE /api/admin/tenants/.../members] Failed to delete from Auth:', authErr);
      }
    }

    return NextResponse.json({ success: true, method: 'admin' });
  } catch (e: any) {
    console.error('[DELETE /api/admin/tenants/.../members]', e.message);
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}
