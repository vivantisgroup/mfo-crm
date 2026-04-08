import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { getGraphAppToken } from '@/lib/msGraphAppConfig';
import { provisionGlobalTeamsWebhooks } from '@/lib/msGraphWebhooks';

/**
 * /api/admin/webhooks/provision-teams
 * 
 * Admin endpoint to trigger a global subscription to all Teams and Channels using Application Credentials.
 * In a production scenario, this should be protected by an Admin API key or similar.
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    // Ensure basic protect layer (sandbox fallback)
    if (authHeader !== `Bearer ${process.env.ADMIN_API_KEY || 'sandbox-admin-key'}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const appToken = await getGraphAppToken();
    const result = await provisionGlobalTeamsWebhooks(appToken);

    // Save global state in Firestore
    const db = getAdminFirestore();
    await db.doc('system/integrations/microsoft_teams/global_webhook').set({
      ...result,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error('Provisioning Global Teams Webhook Failed', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
