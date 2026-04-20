import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { credential } from 'firebase-admin';
import Groq from 'groq-sdk';
import OpenAI from 'openai';

export async function GET(req: Request) {
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

    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    let uid = '';
    
    if (token) {
      const adminAuth = getAuth();
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;
    }

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) return NextResponse.json({ error: 'Tenant ID required.' }, { status: 400 });



    const db = getFirestore();
    const tSnap = await db.collection('tenants').doc(tenantId).get();
    const aiKeys = tSnap.data()?.aiKeys || {};

    const available: {id: string, label: string}[] = [];

    // Evaluate BYOK Keys
    if (aiKeys['OpenAI']?.some((k:any) => k.saved || k.value)) available.push({ id: 'openai', label: 'Brain: GPT-4 Omni (OpenAI)' });
    else if (process.env.OPENAI_API_KEY) available.push({ id: 'openai', label: 'Brain: GPT-4 Omni (OpenAI)' });

    if (aiKeys['Groq']?.some((k:any) => k.saved || k.value)) available.push({ id: 'groq', label: 'Brain: Llama-3-70B (Groq)' });
    else if (process.env.GROQ_API_KEY) available.push({ id: 'groq', label: 'Brain: Llama-3-70B (Groq)' });
    
    if (aiKeys['Google Gemini']?.some((k:any) => k.saved || k.value)) available.push({ id: 'gemini', label: 'Brain: Gemini 2.0 (Google)' });
    if (aiKeys['Anthropic / Claude']?.some((k:any) => k.saved || k.value)) available.push({ id: 'anthropic', label: 'Brain: Claude 3.5 (Anthropic)' });

    const seen = new Set();
    const deduplicated = available.filter(el => {
      const duplicate = seen.has(el.id);
      seen.add(el.id);
      return !duplicate;
    });

    return NextResponse.json({ providers: deduplicated });
  } catch (err: any) {
    console.error('GET /api/ai/accounting error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

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
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { rawText, tenantId, isReconciliation, bankId, provider, systemPromptOverride } = await req.json();

    if (!rawText || !tenantId) {
      return NextResponse.json({ error: 'Missing rawText or tenantId' }, { status: 400 });
    }



    // Fetch Dynamic COA for the Tenant
    const db = getFirestore();
    const coaSnap = await db.collection(`tenants/${tenantId}/chart_of_accounts`).orderBy('code').get();
    
    // If empty, the frontend should have seeded it, but fallback to strings just in case.
    let coaList = 'Nenhum plano de contas customizado encontrado. Use sua melhor dedução com contas padrão.';
    let availableAccountNames: string[] = [];

    if (!coaSnap.empty) {
      const groups: Record<string, string[]> = {};
      coaSnap.docs.forEach(d => {
        const data = d.data();
        if (data.isGroup) return; // We only post to leaf accounts
        if (!groups[data.type]) groups[data.type] = [];
        groups[data.type].push(`"${data.name}"`);
        availableAccountNames.push(data.name);
      });
      
      const lines = Object.entries(groups).map(([type, names]) => `- ${type}: ${names.join(', ')}`);
      coaList = lines.join('\n');
    }

    let systemPromptBase = '';
    const { getSystemPrompt } = await import('@/lib/promptService');
    const systemPromptContext = { 
      language: req.headers.get('accept-language')?.split(',')[0] || 'pt-BR',
      documentContext: isReconciliation ? 'Contabilidade/Extrato Bancário' : 'Classificação Contábil'
    };

    if (systemPromptOverride) {
      systemPromptBase = systemPromptOverride;
    } else {
      systemPromptBase = await getSystemPrompt(tenantId, 'account-classifier', systemPromptContext);
    }
    
    let systemPrompt = '';
    
    if (systemPromptOverride) {
      systemPrompt = systemPromptBase.replace('[CHART_OF_ACCOUNTS_INJECTED_HERE]', coaList);
    } else if (isReconciliation) {
      systemPrompt = systemPromptBase + `\n\nA sua missão é analisar linhas de um Extrato Bancário e realizar a conciliação definindo a contra-partida exata para cada transação.\nVocê receberá linhas do extrato (data, descrição, valor).\nComo é um extrato bancário, UMA DAS PONTAS JÁ É O BANCO. \n\nPLANO DE CONTAS (USAR APENAS ESTAS CONTAS P/ A CONTRA-PARTIDA):\n${coaList}\n\nREGRAS DE CONCILIAÇÃO BANCÁRIA (EXTRATO):\n- Se o valor do extrato for POSITIVO (entrada de dinheiro no banco), o Banco foi DEBITADO. Logo, a conta que você escolher será a creditAccount (ex: Receitas).\n- Se o valor do extrato for NEGATIVO (saída de dinheiro do banco), o Banco foi CREDITADO. Logo, a conta que você escolher será a debitAccount (ex: Despesas).\n- Coloque "Banco" na ponta correta para cada lançamento baseado no sinal do valor.\n- O valor absoluto sem sinal deve ir para "amount".\n\nVocê DEVE responder ESTRITAMENTE num JSON contendo um array "entries", onde cada entry tem a seguinte interface:\n{\n  date: string; // Formato YYYY-MM-DD retirado do extrato\n  description: string; // Resumo limpo da transação\n  amount: number; // Valor numérico ABSOLUTO\n  debitAccount: string; // Uma das contas exatas do plano de contas\n  creditAccount: string; // Uma das contas exatas do plano de contas\n}\nRetorne APENAS o JSON válido.`;
    } else {
      systemPrompt = systemPromptBase + `\n\nO MFO possui operações no Brasil e no exterior, prestando serviços de gestão patrimonial, consultoria (advisory), estruturação financeira e licenciamento de software (SaaS) para outros consultores.\n\n### SEU OBJETIVO\nSempre que receber os dados de uma transação ou fechamento de câmbio, você deve:\n1. Identificar a natureza da operação (Receita, Despesa, Movimentação de Ativo/Passivo).\n2. Classificar a transação na conta contábil correta.\n3. Em caso de recebimentos internacionais, separar o valor principal da receita, os custos da operação (Spread/IOF) e alocar a Variação Cambial (Ativa ou Passiva).\n\n### PLANO DE CONTAS AUTORIZADO\nUtilize EXCLUSIVAMENTE as seguintes contas para a classificação:\n${coaList !== 'Nenhum plano de contas customizado encontrado. Use sua melhor dedução com contas padrão.' ? coaList : '- Ativo: Banco, Caixa, Contas a Receber, Investimentos\\n- Passivo: Contas a Pagar, Impostos a Recolher, Salários a Pagar\\n- Patrimônio Líquido: Capital Social, Lucros Acumulados\\n- Receita: Receita de Serviços, Receita Financeira\\n- Despesa: Despesas Administrativas, Despesas com Pessoal, Impostos (ISS/IRPJ)\\n'}\n\n### REGRAS DE CLASSIFICAÇÃO PARA CÂMBIO (ATENÇÃO PLENA)\n- A Receita de Serviço Internacional é travada no valor da PTAX do dia da EMISSÃO.\n- Qualquer valor recebido A MAIS na liquidação NÃO é receita de serviço; deve ser lançado como Variação Cambial Ativa (Receita).\n- Qualquer valor recebido A MENOS deve ser lançado como Variação Cambial Passiva (Despesa).\n- Custos descontados pelo banco devem ir para Tarifas Bancárias/IOF.\n- Regra de Partidas Dobradas: Ativo Sobe (Débito) / Despesa (Débito). Passivo, Receita, PL Sobem (Crédito).\n\nVocê DEVE responder ESTRITAMENTE num JSON contendo um array "entries":\n{\n  "entries": [\n    {\n      "date": "2026-04-14",\n      "description": "Pagamento Invoice 101 - Serviços de Advisory + Variação",\n      "amount": 50000.00,\n      "debitAccount": "O nome da conta exata do plano",\n      "creditAccount": "O nome da conta exata do plano"\n    }\n  ]\n}\n\n- "amount" MUST be an absolute positive number.\n- If the operation involves multiple splits (e.g. Principal Receita + Variação Cambial + IOF), you must return MULTIPLE ENTRIES in the array.\nCRITICAL: return ONLY the valid JSON object. Do not output anything else.`;
    }

    let output = '{}';
    const tSnap = await db.collection('tenants').doc(tenantId).get();
    const aiKeys = tSnap.data()?.aiKeys || {};

    if (provider === 'openai') {
      const tenantKey = aiKeys['OpenAI']?.find((k: any) => k.id === 'openai_api_key')?.value;
      const finalKey = tenantKey || process.env.OPENAI_API_KEY;
      if (!finalKey) {
        return NextResponse.json({ error: 'Failed to process AI inference', details: 'The OPENAI_API_KEY is not configured in this Tenant\'s BYOK Admin Panel.' }, { status: 400 });
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
        return NextResponse.json({ error: 'Failed to process AI inference', details: 'The GROQ_API_KEY is not configured in this Tenant\'s BYOK Admin Panel.' }, { status: 400 });
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
      return NextResponse.json({ error: 'Unsupported Engine', details: `The provider '${provider}' is mapped in your Tenant configuration, but the MFO-CRM Node server does not have the SDK dependencies to execute Inference on it yet.` }, { status: 501 });
    }

    const cleaned = output.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.entries || !Array.isArray(parsed.entries)) {
      return NextResponse.json({ error: 'AI failed to format schema correctly.' }, { status: 500 });
    }

    return NextResponse.json({ entries: parsed.entries });

  } catch (error: any) {
    console.error('Accounting AI Error:', error);
    return NextResponse.json(
      { error: 'Failed to process AI inference', details: error.message },
      { status: 500 }
    );
  }
}
