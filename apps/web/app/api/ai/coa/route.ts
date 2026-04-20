import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import { credential } from 'firebase-admin';
import Groq from 'groq-sdk';
import OpenAI from 'openai';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
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

    // Role-Based Access Control
    const claims = await getAuth().getUser(decodedToken.uid).then(u => u.customClaims || {});
    // If the token itself has the claims, we can use decodedToken.role, else customClaims.role
    const role = (decodedToken as any).role || claims.role;
    if (role !== 'ai_prompt_admin' && role !== 'tenant_admin' && role !== 'saas_master_admin') {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges.' }, { status: 403 });
    }

    const { prompt, tenantId, provider = 'openai' } = await req.json();

    if (!prompt || !tenantId) {
      return NextResponse.json({ error: 'Missing prompt or tenantId' }, { status: 400 });
    }

    if (!getApps().length) {
      initializeApp({
        credential: credential.cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }

    const db = getFirestore();

    // Fetch the BYOK config
    const tSnap = await db.collection('tenants').doc(tenantId).get();
    const aiKeys = tSnap.data()?.aiKeys || {};

    // Fetch the Current Chart of Accounts
    const coaSnap = await db.collection('tenants').doc(tenantId).collection('chart_of_accounts').orderBy('code').get();
    const currentCOA = coaSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const configSnap = await db.collection('tenants').doc(tenantId).collection('config').doc('accounting').get();
    const isBrazil = configSnap.exists ? configSnap.data()?.region === 'Brasil' : tSnap.data()?.country === 'BR';
    const langModifier = isBrazil ? 'Portuguese (Brazil)' : 'English (US GAAP)';

    const { getSystemPrompt } = await import('@/lib/promptService');
    const systemPromptContext = { 
      language: req.headers.get('accept-language')?.split(',')[0] || 'en-US'
    };
    const basePrompt = await getSystemPrompt(tenantId, 'coa', systemPromptContext);

    const systemPrompt = basePrompt + `
Your mission is to reorganize, append, or redesign the Chart of Accounts provided below according to the user's instructions.
All generated labels and 'name' fields MUST be in ${langModifier}.

CURRENT CHART OF ACCOUNTS:
${JSON.stringify(currentCOA, null, 2)}

RULES FOR RESTRUCTURING:
1. You may change 'code', 'name', 'type', 'isGroup', and 'parentId'.
2. You MUST preserve the exact 'id' property of any existing account you modify. DO NOT drop existing accounts, because legacy ledger entries depend on their existence.
3. If the user asks you to add new accounts, append them as new JSON objects with NO 'id' property.
4. If the user asks you to reorganize, change the 'code' structure logically (e.g., 1.1.2, 5.2.1) and set 'parentId' to match the root nodes.
5. Allowed types: 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'. These are invariant structural keys, do not translate them!

You MUST reply with a STRICT JSON containing a root "accounts" array with EXACTLY this structure:
{
  "accounts": [
    { "id": "existing-doc-id-here", "code": "1", "name": "${isBrazil ? 'Ativo' : 'Assets'}", "type": "ASSET", "isGroup": true },
    { "code": "1.1.4", "name": "${isBrazil ? 'Nova Conta Bancária' : 'New Bank Account'}", "type": "ASSET", "isGroup": false, "parentId": "1.1" }
  ]
}

CRITICAL: return ONLY the JSON object. Do not output markdown code blocks formatting or anything else. The database injection mechanism depends strictly on valid JSON.`;

    let output = '{}';

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
          { role: 'user', content: prompt }
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
          { role: 'user', content: prompt }
        ],
        model: 'llama3-70b-8192',
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });
      output = chatCompletion.choices[0]?.message?.content || '{}';
    } else {
      return NextResponse.json({ error: 'Unsupported Engine' }, { status: 501 });
    }

    const cleaned = output.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.accounts || !Array.isArray(parsed.accounts)) {
      return NextResponse.json({ error: 'AI failed to format schema correctly.' }, { status: 500 });
    }

    // Process array inside a Firebase Batch
    const batch = db.batch();
    let updatedCount = 0;
    let addedCount = 0;

    for (const acc of parsed.accounts) {
      if (acc.id) {
        // Document update
        const ref = db.collection('tenants').doc(tenantId).collection('chart_of_accounts').doc(acc.id);
        const { id, ...data } = acc;
        batch.update(ref, data);
        updatedCount++;
      } else {
        // Document creation
        const ref = db.collection('tenants').doc(tenantId).collection('chart_of_accounts').doc();
        batch.set(ref, acc);
        addedCount++;
      }
    }

    await batch.commit();

    return NextResponse.json({ success: true, updatedCount, addedCount });

  } catch (error: any) {
    console.error('[AI COA Architecture API] Absolute Error:', error);
    return NextResponse.json({ error: error.message || 'Dispatch failed on Node architecture.' }, { status: 500 });
  }
}
