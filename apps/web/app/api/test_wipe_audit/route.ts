export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export async function GET() {
  const db = getAdminFirestore();
  const snap = await db.collection('audit_logs').get();
  const batch = db.batch();
  for (const d of snap.docs) batch.delete(d.ref);
  await batch.commit();
  return NextResponse.json({ wiped: snap.size });
}
