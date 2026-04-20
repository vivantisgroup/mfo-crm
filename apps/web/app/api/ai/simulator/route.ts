import { NextResponse } from 'next/server';
import { executeAiRequest } from '@/lib/tenantAiConfig';

export async function POST(request: Request) {
  try {
    const { clientContext, tenantId } = await request.json();

    if (!tenantId || !clientContext) {
      return NextResponse.json({ error: 'Missing tenantId or clientContext' }, { status: 400 });
    }

    const systemPrompt = `Você atua como o Chief Investment Officer (CIO) e Wealth Planner Sênior de um Multi-Family Office de elite. Gere o output exclusivamente no formato JSON requisitado, sem formatações adicionais ou markdown.`;
    
    const userPrompt = `
Analise os dados fornecidos deste cliente e crie uma estratégia de Wealth Management rigorosa, assertiva e realista.
Baseie-se nas leis fiscais, geopolíticas e de mercado esperadas para 2026 (Ex: Fim do NHR em Portugal, ITCMD no Brasil, PFIC e Estate Tax nos EUA).

Obrigatório: Forneça exata e obrigatoriamente 3 cenários estratégicos (Agressivo, Moderado e Conservador).
Seja muito exato, profissional, evite platitudes. Dê recomendações claras de alocação de ativos e blindagem/distribuição.

O esquema JSON de resposta deve ser EXATAMENTE (sem aspas adicionais no topo):
{
  "generalGuideline": "<string>",
  "sCenários": [
    {
      "name": "Conservador | Moderado | Agressivo",
      "assetAllocation": "<string>",
      "taxAndSuccessionStrategy": "<string>",
      "expectedNominalReturn": "<string>"
    }
  ]
}

Dados do Cliente:
${clientContext}
`;

    const aiResponseText = await executeAiRequest({
      tenantId,
      systemPrompt,
      userPrompt,
      overrideProvider: "Google Gemini", // Prioritize Gemini since the old prompt was built for it, with fallback
      jsonMode: true
    });

    let parsedResponse;
    try {
      const cleanedText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedResponse = JSON.parse(cleanedText);
    } catch (e) {
      console.error('Failed to parse AI response for simulator:', aiResponseText);
      return NextResponse.json({ error: 'Failed to process AI response JSON format.', raw: aiResponseText }, { status: 502 });
    }

    return NextResponse.json(parsedResponse);
  } catch (error: any) {
    console.error('Error in /api/ai/simulator:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
