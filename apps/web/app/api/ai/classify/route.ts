import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAiKeysByTenant } from '@/lib/tenantAiConfig';

const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID ?? 'mfo-crm';

import { getAdminFirestore } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { uid, tenantId, thread } = await req.json();

    if (!thread) {
      return NextResponse.json({ error: 'Thread data required' }, { status: 400 });
    }

    const db = getAdminFirestore();

    // 1. Fetch DB Context
    // Pull active clients/orgs
    const orgsSnap = await db.collection('platform_orgs').get();
    const clients = orgsSnap.docs.map((d: any) => ({
       id: d.id,
       name: d.data().name || '',
       type: 'org'
    }));
    
    // Pull active contacts
    const contactsSnap = await db.collection('platform_contacts').get();
    const contacts = contactsSnap.docs.map((d: any) => ({
       id: d.id,
       name: d.data().name || `${d.data().firstName} ${d.data().lastName}`.trim() || '',
       type: 'contact',
       orgId: d.data().orgId
    }));
    
    const allEntities = [...clients, ...contacts];

    // Pull open tasks for the tenant
    const tasksSnap = await db.collection('tenants').doc(tenantId).collection('tasks').where('status', '==', 'open').get();
    const openTasks = tasksSnap.docs
       .map((t: any) => ({
          id: t.id,
          title: t.data().title || '',
          description: t.data().description || ''
       }));

    // 2. Synthesize Context for AI
    const systemPrompt = `Você é um Analista de Dados e Gestor de Relacionamento Nível Sênior para um CRM de Family Office.
Sua missão é classificar emails recebidos ou enviados.

DADOS DO EMAIL:
Assunto: ${thread?.subject || 'Sem Assunto'}
Remetente: ${thread?.fromEmail || thread?.fromName || 'Desconhecido'}
Corpo: ${thread?.snippet || thread?.body || 'Vazio'}

BANCO DE DADOS (CONTEXTO DO TENANT):
Clientes/Empresas Registradas:
${allEntities.map((c: any) => `- ID: ${c.id} | Nome: ${c.name} | Tipo: ${c.type}`).join('\n')}

Tarefas em Aberto:
${openTasks.map((t: any) => `- ID: ${t.id} | Título: ${t.title}`).join('\n')}

DIRETRIZES:
1. Veja se o email se refere a alguma empresa/cliente/contato registrado. Considere menções indiretas.
2. Veja se o email tem a ver com alguma Tarefa em Aberto do tenant.
3. Se envolver uma demanda que não está nas tarefas, sugira criar uma "Nova Tarefa" (activity).
4. Retorne APENAS um JSON válido seguindo esta estrutura, sem crases na resposta:
{
  "suggested_entities": [ { "id": "uuid", "type": "org", "name": "Nome", "reason": "Aparece no CC" } ],
  "suggested_open_tasks": [ { "taskId": "uuid", "reason": "O assunto match com C" } ],
  "suggested_new_action": { "type": "task", "title": "Título sugerido", "summary": "Resumo executivo do email" } // Ou null
}`;

    // 3. Fallback Determinístico vs API Probabilística
    const aiKeys = await getAiKeysByTenant(tenantId);
    const apiKey = aiKeys['openai_api_key'] || aiKeys['OpenAI'] || process.env.OPENAI_API_KEY;
    
    if (apiKey) {
      try {
        const openai = new OpenAI({ apiKey });
        const comp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: systemPrompt }],
          response_format: { type: "json_object" }
        });
        
        const answer = comp.choices[0].message.content;
        const json = JSON.parse(answer || '{}');
        return NextResponse.json(json);
      } catch (err: any) {
        console.error('OpenAI Error:', err);
        // Fallback to deterministic if API request fails
      }
    }

    // ==========================================
    // 4. DETERMINISTIC FALLBACK EXECUTION
    // ==========================================
    // Se não tiver chave da OpenAI (ou se a chamada falhou), faremos Regex simples (Dumb AI)
    const suggested_entities: any[] = [];
    const fullText = `${thread?.subject || ''} ${thread?.snippet || ''} ${thread?.body || ''}`.toLowerCase();

    // Check Orgs simply if their exact name is in the body/subject
    for (const c of allEntities) {
       if (c.name && c.name.length > 3 && fullText.includes(c.name.toLowerCase())) {
          suggested_entities.push({
             id: c.id,
             type: c.type,
             name: c.name,
             reason: `O nome "${c.name}" foi detectado no conteúdo.`
          });
       }
    }

    // Se houver anexo "Invoice Transparenza", a regex pegaria "Transparenza", cobrindo o requisito de anexos.
    
    // Action heuristics
    const actionWords = ['comprar', 'vender', 'pagar', 'verificar', 'aprovar', 'revisar', 'urgente', 'importante', 'buy', 'sell', 'pay', 'approve', 'urgent'];
    const hasAction = actionWords.some(w => fullText.includes(w));

    const fallbackResponse = {
       suggested_entities,
       suggested_open_tasks: [],
       suggested_new_action: hasAction || suggested_entities.length > 0 ? {
          type: "task",
          title: hasAction ? `Demanda: ${thread?.subject || 'Nova Ação'}` : `Revisar comunicação sobre ${suggested_entities[0].name}`,
          summary: `Identificada intenção ou demanda no texto ("${hasAction ? 'Ação detectada' : 'Entidade detectada'}"). Criação de tarefa recomendada.`
       } : null
    };

    return NextResponse.json(fallbackResponse);

  } catch (error: any) {
    console.error('Classify failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
