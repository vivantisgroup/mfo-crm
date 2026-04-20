import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';
import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { getSystemPrompt } from '@/lib/promptService';

export async function POST(req: Request) {
  try {

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    try {
      await getAdminAuth().verifyIdToken(token);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { rawText, tenantId, provider } = await req.json();

    if (!rawText || !tenantId) {
      return NextResponse.json({ error: 'Missing rawText or tenantId' }, { status: 400 });
    }

    const systemPrompt = await getSystemPrompt(tenantId, 'macro-scenario-generator');

    let output = '';
    const db = getAdminFirestore();
    const tSnap = await db.collection('tenants').doc(tenantId).get();
    const aiKeys = tSnap.data()?.aiKeys || {};

    if (provider === 'openai') {
      const tenantKey = aiKeys['OpenAI']?.find((k: any) => k.id === 'openai_api_key')?.value;
      const finalKey = tenantKey || process.env.OPENAI_API_KEY;
      if (!finalKey) {
        return NextResponse.json({ error: 'Failed to process AI inference', details: 'The OPENAI_API_KEY is not configured.' }, { status: 400 });
      }
      const openai = new OpenAI({ apiKey: finalKey });
      const chatCompletion = await openai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: rawText }
        ],
        model: 'gpt-4o',
        temperature: 0.3,
      });
      output = chatCompletion.choices[0]?.message?.content || '';
    } else if (provider === 'groq') {
      const tenantKey = aiKeys['Groq']?.find((k: any) => k.id === 'groq_api_key')?.value;
      const finalKey = tenantKey || process.env.GROQ_API_KEY;
      if (!finalKey) {
        return NextResponse.json({ error: 'Failed to process AI inference', details: 'The GROQ_API_KEY is not configured.' }, { status: 400 });
      }
      const groq = new Groq({ apiKey: finalKey });
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: rawText }
        ],
        model: 'llama3-70b-8192',
        temperature: 0.3,
      });
      output = chatCompletion.choices[0]?.message?.content || '';
    } else {
      return NextResponse.json({ error: 'Unsupported Engine', details: `The provider '${provider}' is not supported.` }, { status: 501 });
    }

    return NextResponse.json({ thesis: output });

  } catch (error: any) {
    console.error('Macro AI Error:', error);
    return NextResponse.json(
      { error: 'Failed to process AI inference', details: error.message },
      { status: 500 }
    );
  }
}
