import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const adminDb = getAdminFirestore();
    const snap = await adminDb.collection('tenants').doc('master').get();
    return NextResponse.json(snap.data() || {});
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
