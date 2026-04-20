import { NextRequest, NextResponse } from 'next/server';
import { executeAiRequest } from '@/lib/tenantAiConfig';
import { getSystemPrompt } from '@/lib/promptService';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { tenantId, htmlContent, prompt, selection, contextRecord } = await req.json();

    if (!tenantId || !prompt) {
      return NextResponse.json({ error: 'Missing tenantId or prompt' }, { status: 400 });
    }

    const db = getAdminFirestore();

    let businessContext = "";
    
    // If we have a specific record context, let's inject it so AI is 'aware' of where it is running
    if (contextRecord && contextRecord.id && contextRecord.type) {
      try {
        const snap = await db.collection('tenants').doc(tenantId).collection(contextRecord.type).doc(contextRecord.id).get();
        if (snap.exists) {
          const data = snap.data();
          // Remove deep nested or huge objects to save tokens, keep surface context
          const cleanData = Object.fromEntries(
            Object.entries(data || {}).filter(([k, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || Array.isArray(v))
          );
          businessContext = `Business Context (Active Record - ${contextRecord.type}): ${JSON.stringify(cleanData)}`;
        }
      } catch (err) {
        console.warn('Failed to fetch context record for AI:', err);
      }
    }

    const baseSystemPrompt = await getSystemPrompt(tenantId, 'editor-magic');
    const systemPrompt = `${baseSystemPrompt}
${businessContext ? `\nCRITICAL CONTEXT:\nYou are currently operating inside this record:\n${businessContext}\nUse this context to enhance your understanding and generation if the user asks for summaries or new information.\n` : ''}`;

    const userPromptText = `
User Prompt (Instruction):
${prompt}

${selection ? `Selected Text Focus:\n${selection}\n` : ''}

Current HTML Content:
${htmlContent || '<p></p>'}

Return the full updated HTML:`;

    let answerHtml = htmlContent;
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
      answerHtml = await executeAiRequest({
        tenantId,
        userId,
        systemPrompt,
        userPrompt: userPromptText
      });
    } catch (aiErr: any) {
      return NextResponse.json({ html: htmlContent, error: aiErr.message });
    }
    
    // Clean up if it still included markdown
    if (answerHtml.startsWith('```html')) {
        answerHtml = answerHtml.replace(/^```html\n?/, '').replace(/\n?```$/, '');
    } else if (answerHtml.startsWith('```')) {
        answerHtml = answerHtml.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    return NextResponse.json({ html: answerHtml });

  } catch (error: any) {
    console.error('Editor Magic AI failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
