import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { PDFParse } from 'pdf-parse';
import { HybridExtractionEngine } from '@/lib/hybridExtractionEngine';

function initFirebaseAdmin() {
  if (!getApps().length) {
    if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      initializeApp({
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      console.warn('[Queue Worker] Missing Firebase Admin SDK credentials in environment.');
      initializeApp(); // Fallback to default app if running in a managed environment
    }
  }
}

export async function POST(req: NextRequest) {
  initFirebaseAdmin();
  try {
    const { tenantId, documentUrl } = await req.json();
    if (!tenantId || !documentUrl) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

    console.log(`[Queue Worker] Processing Document for Tenant ${tenantId}: ${documentUrl}`);

    // 1. Download document from Microsoft Graph URL (Presigned/Auth token applied internally)
    // Normally you'd pass a bearer token here
    // const fileRes = await fetch(documentUrl, { headers: { Authorization: `Bearer ${msalToken}` }});
    // const buffer = new Uint8Array(await fileRes.arrayBuffer());
    
    // MOCK BUFFER (we will mock the raw text to test the integration)
    // const parser = new PDFParse({ data: buffer });
    // await parser.load();
    // const pdfData = await parser.getText();
    const pdfData = { text: "MOCK PDF TEXT: 15/10/2026 PAGAMENTO FORNEC R$ -1500,00\\n20/10/2026 RECEBIMENTO R$ 5000,00" };

    // 2. Pass into Hybrid Engine
    const engine = new HybridExtractionEngine();
    const transactions = await engine.extract(pdfData.text);

    console.log(`[Queue Worker] Extracted ${transactions.length} transactions via ${transactions[0]?.extractedVia || 'Unknown'}.`);

    // 3. Output to Firestore as "draft" Expenses for Human-in-the-loop review
    const db = getFirestore();
    const batch = db.batch();
    const expensesRef = db.collection(`tenants/${tenantId}/expenses`);

    for (const trx of transactions) {
      const docRef = expensesRef.doc();
      batch.set(docRef, {
        title: `Auto-Processed: ${trx.description}`,
        amount: trx.amount,
        baseAmountUsd: trx.baseAmountUsd, // Converted via ECB logic
        category: 'Uncategorized (Queue Extraction)',
        status: 'draft', // Human-in-the-loop triggers here
        date: trx.date,
        source: `Cloud Task - MS Graph Link: ${documentUrl}`,
        confidence: trx.confidence,
        extractedVia: trx.extractedVia,
        createdAt: new Date().toISOString()
      });
    }

    await batch.commit();
    console.log(`[Queue Worker] Committed ${transactions.length} drafts to the Approvals Kanban for ${tenantId}.`);

    return NextResponse.json({ success: true, processedCount: transactions.length });

  } catch (error: any) {
    console.error('[Queue Worker] Error processing document:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
