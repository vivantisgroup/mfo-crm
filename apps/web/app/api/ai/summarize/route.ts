import { NextRequest, NextResponse } from 'next/server';
import { executeAiRequest } from '@/lib/tenantAiConfig';
import { getSystemPrompt } from '@/lib/promptService';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { tenantId, textToSummarize } = await req.json();

    if (!textToSummarize) {
      return NextResponse.json({ error: 'Nenhum texto fornecido para resumir.' }, { status: 400 });
    }

    const db = getAdminFirestore();

    // Fetch open tasks and activities for context
    const tasksSnap = await db.collection('tenants').doc(tenantId).collection('tasks').where('status', '==', 'open').get();
    const tasks = tasksSnap.docs.map((t: any) => ({ id: t.id, title: t.data().title }));
    
    // Attempt to fetch open activities (assuming status==open or just the latest 10)
    const actsSnap = await db.collection('tenants').doc(tenantId).collection('activities').limit(10).get();
    const activities = actsSnap.docs.map((a: any) => ({ id: a.id, title: a.data().title }));

    const basePrompt = await getSystemPrompt(tenantId, 'summarize-email');
    const systemPrompt = `${basePrompt}

Também identifique se este e-mail tem relação com alguma destas Tarefas ou Atividades ativas do Tenant:
Tarefas Abertas:
${tasks.map((t: any) => `- ID: ${t.id} | Título: ${t.title}`).join('\n')}

Atividades Recentes:
${activities.map((a: any) => `- ID: ${a.id} | Título: ${a.title}`).join('\n')}

IMPORTANTE: Você deve retornar APENAS um JSON válido seguindo exatamente este formato (sem markdown wrappers):
{
  "summary": "**Assunto:** [Extrair do texto]\\n**Quem:** [Remetente]\\n**Quando:** [Data/Hora]\\n\\n**Resumo:**\\n[Sua sumarização dos pontos principais]\\n\\n**Próximos Passos:**\\n[Sua sugestão de próximos passos. Se não houver, escreva N/A]",
  "suggested_record_id": "uuid, se encontrou forte correspondência com alguma das tarefas/atividades acima, ou null",
  "suggested_record_type": "task | activity | ticket | null",
  "suggested_action": "update | create"
}`;

    const userPrompt = `Por favor, resuma a seguinte comunicação:\n\n${textToSummarize}`;

    let answer = '{}';

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
      answer = await executeAiRequest({
        tenantId,
        userId,
        systemPrompt,
        userPrompt,
        jsonMode: true
      });
    } catch (e: any) {
      return NextResponse.json({ summary: `A Inteligência Artificial falhou: ${e.message}` });
    }
    const json = JSON.parse(answer);

    return NextResponse.json(json);

  } catch (error: any) {
    console.error('Summarize failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
