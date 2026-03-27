/**
 * POST /api/auth/ensure-profile
 *
 * Server-side login helper that uses Admin SDK to:
 *   1. Verify the Firebase ID token
 *   2. Ensure users/{uid} exists with correct tenantIds
 *   3. Migrate any placeholder profile (users/invite_<b64email>) to the real UID
 *   4. Ensure tenants/{id}/members/{uid} exists for each tenant
 *   5. Return the complete profile + tenant records to the client
 *
 * By doing all reads/writes here (Admin SDK bypasses Firestore security rules),
 * the client login flow is immune to Firestore rule misconfigurations.
 *
 * Body:    { idToken: string }
 * Returns: { profile: UserProfile, tenants: TenantRecord[] }
 *        | { profile: null, warning: string }  (if Admin SDK unavailable)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

/** Verify the idToken using Admin SDK or fall back to REST lookup. */
async function verifyToken(idToken: string): Promise<{ uid: string; email: string; name: string }> {
  try {
    const adminAuth = getAdminAuth();
    const decoded   = await adminAuth.verifyIdToken(idToken);
    return {
      uid:   decoded.uid,
      email: decoded.email ?? '',
      name:  decoded.name  ?? (decoded.email ?? '').split('@')[0],
    };
  } catch {
    // Admin SDK not configured — fall back to REST token lookup
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
                ?? process.env.FIREBASE_API_KEY
                ?? '';
    if (!apiKey) throw new Error('No Firebase API key available for token verification.');

    const r = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }) },
    );
    if (!r.ok) throw new Error('Token verification failed via REST.');
    const d = await r.json();
    const u = d.users?.[0];
    if (!u) throw new Error('User not found in token lookup.');
    return { uid: u.localId, email: u.email ?? '', name: u.displayName ?? (u.email ?? '').split('@')[0] };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken) return NextResponse.json({ error: 'idToken required' }, { status: 400 });

    let uid: string, email: string, name: string;
    try {
      ({ uid, email, name } = await verifyToken(idToken));
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }

    try {
      const adminDb = getAdminFirestore();
      const now = new Date().toISOString();

      // ── 1. Read user profile at real UID ────────────────────────────────────
      const profileRef  = adminDb.collection('users').doc(uid);
      const profileSnap = await profileRef.get();
      let existing      = profileSnap.exists ? profileSnap.data() as Record<string, any> : null;

      // ── 2. Placeholder migration ─────────────────────────────────────────────
      // When an admin adds a user before they've signed in, a placeholder profile
      // is stored under a fake UID: "invite_<base64(email)>". The Admin SDK can
      // find it by email without hitting Firestore security rules.
      if ((!existing || (existing.tenantIds ?? []).length === 0) && email) {
        try {
          const placeholderQuery = await adminDb
            .collection('users')
            .where('email', '==', email)
            .get();

          const placeholderDoc = placeholderQuery.docs.find((d: any) => d.id !== uid);

          if (placeholderDoc && (placeholderDoc.data().tenantIds ?? []).length > 0) {
            const placeholder = placeholderDoc.data() as Record<string, any>;
            const tenantIds: string[] = placeholder.tenantIds ?? [];
            const tenantId: string | null = placeholder.tenantId ?? tenantIds[0] ?? null;

            console.log(`[ensure-profile] Migrating placeholder ${placeholderDoc.id} → ${uid}`);

            // Build the merged real profile
            const merged = {
              uid,
              email:       email || placeholder.email || '',
              displayName: name  || placeholder.displayName || email.split('@')[0],
              role:        placeholder.role        ?? 'report_viewer',
              mfaEnabled:  placeholder.mfaEnabled  ?? false,
              status:      'active',
              tenantId,
              tenantIds,
              createdAt:   placeholder.createdAt   ?? now,
              updatedAt:   now,
              lastLoginAt: now,
            };

            // Write real profile and migrate member docs in a batch
            const batch = adminDb.batch();
            batch.set(profileRef, merged, { merge: true });

            for (const tid of tenantIds) {
              const realMemberRef = adminDb.collection('tenants').doc(tid).collection('members').doc(uid);
              const oldMemberRef  = adminDb.collection('tenants').doc(tid).collection('members').doc(placeholderDoc.id);

              const oldMemberSnap = await oldMemberRef.get();
              const memberData = oldMemberSnap.exists ? oldMemberSnap.data()! : {};

              // Write member doc at real UID
              batch.set(realMemberRef, {
                ...memberData,
                uid,
                tenantId:    tid,
                email:       merged.email,
                displayName: merged.displayName,
                role:        merged.role,
                status:      'active',
                joinedAt:    (memberData as any).joinedAt ?? now,
                invitedBy:   (memberData as any).invitedBy ?? 'system',
                updatedAt:   now,
              });

              // Delete the old placeholder member doc
              if (oldMemberSnap.exists) {
                batch.delete(oldMemberRef);
              }
            }

            // Delete the old placeholder user profile
            batch.delete(placeholderDoc.ref);

            await batch.commit();

            // Use the merged profile going forward
            existing = merged;
            console.log(`[ensure-profile] Migration complete for ${uid} (${email}), tenants: ${tenantIds.join(', ')}`);
          }
        } catch (migrateErr: any) {
          // Non-fatal: log and fall through to normal upsert
          console.warn('[ensure-profile] Placeholder migration failed:', migrateErr.message);
        }
      }

      // ── 3. Build / upsert profile ────────────────────────────────────────────
      // Only default to 'master' for the very first platform bootstrap user.
      // For all other new users: leave tenantIds empty so they get the
      // "no workspace" error instead of accidentally gaining master access.
      const tenantIds: string[] = (existing?.tenantIds ?? []).length > 0
        ? existing!.tenantIds
        : [];

      const profile = {
        uid,
        email:       email || existing?.email || '',
        displayName: name  || existing?.displayName || email.split('@')[0],
        role:        existing?.role        ?? 'report_viewer',
        mfaEnabled:  existing?.mfaEnabled  ?? false,
        status:      existing?.status      ?? 'active',
        tenantId:    existing?.tenantId    ?? (tenantIds[0] ?? null),
        tenantIds,
        createdAt:   existing?.createdAt   ?? now,
        updatedAt:   now,
        lastLoginAt: now,
      };

      // Upsert: always bring profile up to date
      await profileRef.set(profile, { merge: true });

      // ── 4. Ensure member docs exist ──────────────────────────────────────────
      if (tenantIds.length > 0) {
        await Promise.all(tenantIds.map(async (tenantId) => {
          const memberRef  = adminDb.collection('tenants').doc(tenantId).collection('members').doc(uid);
          const memberSnap = await memberRef.get();
          if (!memberSnap.exists) {
            await memberRef.set({
              uid, tenantId,
              email:       profile.email,
              displayName: profile.displayName,
              role:        profile.role,
              status:      'active',
              joinedAt:    now,
              invitedBy:   'system',
            });
          }
        }));
      }

      // ── 5. Read tenant records ───────────────────────────────────────────────
      const tenantDocs = tenantIds.length > 0
        ? await Promise.all(tenantIds.map(tid => adminDb.collection('tenants').doc(tid).get()))
        : [];
      const tenants = tenantDocs
        .filter(s => s.exists)
        .map(s => ({ id: s.id, ...s.data() }));

      return NextResponse.json({ profile, tenants });

    } catch (fsErr: any) {
      // Admin Firestore not available — return a signal so client falls back
      console.warn('[ensure-profile] Admin Firestore unavailable:', fsErr.message);
      return NextResponse.json(
        { profile: null, tenants: [], warning: 'Admin SDK Firestore unavailable — using client fallback.' },
      );
    }

  } catch (e: any) {
    console.error('[ensure-profile]', e.message);
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}
