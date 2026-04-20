import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { executeAiRequest } from '@/lib/tenantAiConfig';
import { getSystemPrompt } from '@/lib/promptService';


export async function POST(req: Request) {
  try {
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const formData = await req.formData();
    const pdfFile = formData.get('pdf') as File;
    const tenantId = formData.get('tenantId') as string;
    const region = formData.get('region') as string;
    const provider = formData.get('provider') as string;

    if (!pdfFile || !tenantId) {
      return NextResponse.json({ error: 'Missing PDF file or tenantId' }, { status: 400 });
    }

    const db = getFirestore();
    const tSnap = await db.collection('tenants').doc(tenantId).get();
    const aiKeys = tSnap.data()?.aiKeys || {};

    const arrayBuffer = await pdfFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfParseModule = require('pdf-parse');
    const pdfParse = pdfParseModule.default || pdfParseModule;
    if (typeof pdfParse !== 'function') throw new Error('pdf-parse resolution failed');
    const parsedPdf = await pdfParse(buffer);
    const rawText = parsedPdf.text;

    const systemPrompt = await getSystemPrompt(tenantId, 'kickstart-accounting');

    let output = '{}';
    
    try {
      output = await executeAiRequest({
        tenantId,
        userId: decodedToken.uid,
        documentLanguage: region || 'Unknown', 
        systemPrompt,
        userPrompt: `TEXTO EXTRAÍDO DO PDF (${region || 'Brasil'}):\n${rawText.slice(0, 30000)}`,
        overrideProvider: provider, // If user forced a provider on UI
        jsonMode: true
      });
    } catch (e: any) {
      throw new Error(`AI Execution failed: ${e.message}`);
    }

    const cleaned = output.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.chartOfAccounts || !parsed.ledgerEntries) {
      throw new Error('AI Schema format error');
    }

    const batch = db.batch();
    
    parsed.chartOfAccounts.forEach((acc: any) => {
      const coaRef = db.collection(`tenants/${tenantId}/chart_of_accounts`).doc();
      batch.set(coaRef, {
        code: acc.code,
        name: acc.name,
        type: acc.type,
        isGroup: acc.isGroup,
        createdAt: new Date()
      });
    });

    parsed.ledgerEntries.forEach((entry: any) => {
      const ledgerRef = db.collection(`tenants/${tenantId}/ledger_entries`).doc();
      batch.set(ledgerRef, {
        ...entry,
        type: 'auto_kickstart',
        createdAt: new Date(),
        createdBy: decodedToken.uid
      });
    });

    await batch.commit();

    return NextResponse.json({ success: true, count: parsed.ledgerEntries.length });
  } catch (error: any) {
    console.error('Kickstart AI Error:', error);
    return NextResponse.json(
      { error: 'Failed to process AI Kickstart', details: error.message },
      { status: 500 }
    );
  }
}
