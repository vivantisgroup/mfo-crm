import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Admin initialized lazily
function getAdminDb() {
  if (!getApps().length) {
    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (key) {
      const serviceAccount = JSON.parse(key);
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      initializeApp();
    }
  }
  return getFirestore();
}

export async function POST(request: NextRequest) {
  try {
    const { tenantId, category, count = 5 } = await request.json();
    
    if (!tenantId || !category) {
      return NextResponse.json({ error: 'Missing tenantId or category' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    const prompt = `Você é um Advogado Tributarista Sênior e Especialista em Wealth Management no Brasil.
Seu objetivo é escrever ${count} artigos aprofundados sobre a categoria: "${category}".

Requisitos:
- Os artigos devem ser formatados como um array JSON estrito no seguinte modelo:
[
  {
    "title": "...",
    "content": "...",
    "tags": ["tag1", "tag2"]
  }
]
- O "content" deve conter Parágrafos marcados separados por quebras de linha (\\n), usando "### " para subtítulos.
- Cite as leis brasileiras importantes (ex: Lei 14.754/2023 sobre Offshore/Fundos Exclusivos, Código Civil, etc) se a categoria for de impostos/sucessão.
- Seja absurdamente técnico, como um MFO falando para bilionários.
- "content" com no mínimo 6 parágrafos.
Nenhuma resposta em markdown fora do array JSON. Estritamente json array.`;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    let articlesGenerated = JSON.parse(text);

    const db = getAdminDb();
    const batch = db.batch();
    const articlesRef = db.collection('tenants').doc(tenantId).collection('articles');

    articlesGenerated.forEach((art: any) => {
      const docRef = articlesRef.doc();
      batch.set(docRef, {
        title: art.title,
        content: art.content,
        tags: art.tags || [],
        category: category,
        isAiGenerated: true,
        sourceUrl: 'https://planalto.gov.br', // Mock
        createdAt: new Date().toISOString()
      });
    });

    await batch.commit();

    return NextResponse.json({ success: true, count: articlesGenerated.length });
  } catch (error: any) {
    console.error('Seeder Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
