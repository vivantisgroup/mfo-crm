import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export async function GET(_req: NextRequest) {
  try {
    const db = getAdminFirestore();
    const snap = await db
      .collection('platform_backups')
      .orderBy('exportedAt', 'desc')
      .limit(50)
      .get();
    const backups = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ backups });
  } catch (err: any) {
    console.error('[backup/history] error:', err);
    return NextResponse.json({ error: err.message ?? 'Failed to load history' }, { status: 500 });
  }
}
