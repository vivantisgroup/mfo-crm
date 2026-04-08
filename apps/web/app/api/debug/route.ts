import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export async function GET() {
  const db = getAdminFirestore();
  const uid = 'o4NIJOEmmwVQgVqdNJ1JoDqHRk33';
  
  await db.collection('users').doc(uid).update({ role: 'tenant_admin' });

  return NextResponse.json({ success: true, patchedUid: uid, role: 'tenant_admin' });
}
