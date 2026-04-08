import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export async function GET() {
  const db = getAdminFirestore();
  const snap = await db.collection('communications').get();
  
  if (snap.empty) {
    return NextResponse.json({ message: 'No mock records found' });
  }

  const batch = db.batch();
  snap.forEach((doc: any) => batch.delete(doc.ref));
  await batch.commit();

  return NextResponse.json({ message: `Deleted ${snap.size} mock records from production timeline.` });
}
