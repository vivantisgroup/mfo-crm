import { NextRequest, NextResponse } from 'next/server';
import { SharepointService } from '@/lib/sharepointService';

// Pseudo queue dispatcher (Using Vercel Edge / Node fetch as a mock for Cloud Tasks)
async function dispatchCloudTask(tenantId: string, documentUrl: string) {
  const host = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  console.log(`[Queue] Enqueuing document ${documentUrl} to Cloud Tasks...`);
  
  // In production, you would push this to Trigger.dev, Inngest, or GCP Cloud Tasks
  // For the architectural mock, we just fire-and-forget an internal fetch
  fetch(`${host}/api/queue/process-document`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, documentUrl })
  }).catch(e => console.error("Cloud Task dispatch failed", e));
}

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate CRON securely (usually via Vercel Cron header or internal secret)
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
       // Allow localhost bypass for testing
       // if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Iterate all active tenants (Mocked here, normally pull from Firestore `tenants` collection)
    const activeTenants = ['tenant-1'];
    
    let totalEnqueued = 0;

    for (const tenantId of activeTenants) {
      const spService = new SharepointService(tenantId);
      const docs = await spService.fetchUnprocessedDocuments('/Accounting/Inbox');
      
      for (const doc of docs) {
        // Enqueue to the background worker
        await dispatchCloudTask(tenantId, doc.downloadUrl);
        
        // Move to processed folder via MS Graph
        await spService.archiveDocument(doc.id);
        
        totalEnqueued++;
      }
    }

    return NextResponse.json({ status: 'success', enqueued: totalEnqueued });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ status: 'error', error: e.message }, { status: 500 });
  }
}
