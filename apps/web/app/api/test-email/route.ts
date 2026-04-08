import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';

export async function GET() {
  const adminAuth = getAdminAuth();
  const link = await adminAuth.generatePasswordResetLink('test@example.com', {
    url: 'http://localhost:3000'
  });
  return NextResponse.json({ success: true, link });
}
