import { NextRequest, NextResponse } from 'next/server';
import { executeAiRequest } from '@/lib/tenantAiConfig';
import { getSystemPrompt } from '@/lib/promptService';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { prompt, tenantId, history } = await req.json();
    if (!prompt) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });

    const sys = await getSystemPrompt(tenantId, 'ai-wizard');

    let raw = '';

    let userId = '';
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
       try {
         const { getAuth } = await import('firebase-admin/auth');
         const dtoken = await getAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
         userId = dtoken.uid;
       } catch(e) {}
    }

    try {
      raw = await executeAiRequest({
        tenantId,
        userId,
        systemPrompt: sys,
        userPrompt: prompt,
        history,
        jsonMode: true
      });
    } catch (e: any) {
      console.warn("AI Execution failed, using fallback mock", e.message);
      // Fallback mock if no API keys are found locally
      raw = JSON.stringify({
         openapi: "3.0.0",
         info: { title: "Generated Mock API: " + prompt.substring(0, 15) },
         servers: [{ url: "https://mock.api.com" }],
         paths: {
            "/v1/generated": {
               get: { summary: `Read ${prompt}`, operationId: "read_generated" },
               post: { summary: `Write ${prompt}`, operationId: "write_generated" }
            }
         }
      });
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const cleaned = jsonMatch ? jsonMatch[0].trim() : raw.trim();
    return NextResponse.json({ swagger: cleaned });

  } catch (err: any) {
    console.error('[AI Wizard error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
