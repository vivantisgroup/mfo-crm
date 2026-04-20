import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAllPrompts, updateSystemPrompt, getPromptHistory, clearPromptHistory } from '@/lib/promptService';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

async function verifyAuth(req: NextRequest) {
  if (!getApps().length) {
    if (process.env.FIREBASE_ADMIN_SDK_JSON) {
      const config = typeof process.env.FIREBASE_ADMIN_SDK_JSON === 'string' 
        ? JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON) 
        : process.env.FIREBASE_ADMIN_SDK_JSON;
      initializeApp({ credential: cert(config) });
    } else {
      initializeApp({
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await getAuth().verifyIdToken(token);
  return decodedToken;
}

export async function GET(req: NextRequest) {
  try {
    const decodedToken = await verifyAuth(req);
    const tenantId = req.nextUrl.searchParams.get('tenantId');
    const promptId = req.nextUrl.searchParams.get('promptId');
    const action = req.nextUrl.searchParams.get('action');
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    // Optional: verify User belongs to tenantId as admin
    const db = getAdminFirestore();
    const snap = await db.collection('tenants').doc(tenantId).collection('members').doc(decodedToken.uid).get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (action === 'history' && promptId) {
      const history = await getPromptHistory(tenantId, promptId);
      return NextResponse.json({ history });
    }

    const prompts = await getAllPrompts(tenantId);
    return NextResponse.json({ prompts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const decodedToken = await verifyAuth(req);
    const { tenantId, promptId, customPrompt, action } = await req.json();

    if (!tenantId || !promptId) {
      return NextResponse.json({ error: 'Missing tenantId or promptId' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const snap = await db.collection('tenants').doc(tenantId).collection('members').doc(decodedToken.uid).get();
    if (!snap.exists || !['tenant_admin', 'ai_officer', 'saas_master_admin'].includes(snap.data()?.role)) {
      return NextResponse.json({ error: 'Forbidden. Admin/AI Officer access required.' }, { status: 403 });
    }

    if (action === 'clearHistory') {
      await clearPromptHistory(tenantId, promptId);
      return NextResponse.json({ success: true, message: 'History cleared' });
    }

    const userEmail = decodedToken.email || 'Unknown User';
    await updateSystemPrompt(tenantId, promptId, customPrompt, userEmail);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
