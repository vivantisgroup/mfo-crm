import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { credential } from 'firebase-admin';
import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { getSystemPrompt } from '@/lib/promptService';

export async function POST(req: Request) {
  try {
    if (!getApps().length) {
      if (process.env.FIREBASE_ADMIN_SDK_JSON) {
        const config = typeof process.env.FIREBASE_ADMIN_SDK_JSON === 'string' 
          ? JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON) 
          : process.env.FIREBASE_ADMIN_SDK_JSON;
        initializeApp({ credential: credential.cert(config) });
      } else {
        initializeApp({
          credential: credential.cert({
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
    try {
      await getAuth().verifyIdToken(token);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { rawText, tenantId, provider } = await req.json();

    if (!rawText || !tenantId) {
      return NextResponse.json({ error: 'Missing rawText or tenantId' }, { status: 400 });
    }

    const systemPrompt = await getSystemPrompt(tenantId, 'committee-inference');

    let output = '{}';
    const db = getFirestore();
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
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });
      output = chatCompletion.choices[0]?.message?.content || '{}';
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
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });
      output = chatCompletion.choices[0]?.message?.content || '{}';
    } else {
      return NextResponse.json({ error: 'Unsupported Engine', details: `The provider '${provider}' is not supported.` }, { status: 501 });
    }

    const cleaned = output.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error('Committee AI Error:', error);
    return NextResponse.json(
      { error: 'Failed to process AI inference', details: error.message },
      { status: 500 }
    );
  }
}
