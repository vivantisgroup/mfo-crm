import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const { messages, tenantId } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
       return NextResponse.json({ error: 'Missing Gemini API Key' }, { status: 500 });
    }

    // Try to fetch context from knowledge base (Optional grounding)
    let context = '';
    try {
      if (tenantId) {
        const adminDb = getAdminFirestore();
        const articlesSnapshot = await adminDb
          .collection('tenants')
          .doc(tenantId)
          .collection('articles')
          .limit(10)
          .get();
        
        if (!articlesSnapshot.empty) {
          context = 'Knowledge Base Context:\\n' + articlesSnapshot.docs.map((doc: any) => {
            const data = doc.data();
            return `Title: ${data.title}\\Content: ${data.content?.substring(0, 500)}...\\Tags: ${data.tags?.join(', ')}`;
          }).join('\\n\\n');
        }
      }
    } catch (dbError) {
      console.error('Error fetching context:', dbError);
    }

    const systemInstruction = `You are a sophisticated AI agent for the MFO-CRM (Multi-Family Office) platform. Your name is "MFO Advisory Copilot".
You assist wealth managers, advisors, and family office staff.
You should act professionally, concisely, and with deep expertise in wealth management, Brazilian tax, offshore structuring, trusts, inheritance, and philanthropy.
CRITICAL CONSTRAINT: Do NOT hallucinate. Do not provide legal or financial advice unless it is explicitly grounded in the platform's knowledge base. If you do not know something, state clearly that you do not have sufficient information within the Knowledge Base.

${context}`;

    const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-pro',
        systemInstruction
    });

    const chatHistory = messages.slice(0, -1).map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({ history: chatHistory });
    const latestMessage = messages[messages.length - 1].content;
    const result = await chat.sendMessage(latestMessage);

    return NextResponse.json({ response: result.response.text() });
  } catch (error: any) {
    console.error('Agent API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
