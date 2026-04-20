import { NextResponse } from 'next/server';
import { executeAiRequest } from '@/lib/tenantAiConfig';

export async function POST(request: Request) {
  try {
    const { action, currentAge, retirementAge, lifeExpectancy, currentWealth, monthlyContribution, desiredMonthlyIncome, tenantId } = await request.json();

    if (action === 'calibrate') {
      const prompt = `Como CIO institucional de um Multi-Family Office no Brasil, analise as seguintes premissas de planejamento previdenciário e de longevidade para um cliente de Wealth Management:
Idade Atual: ${currentAge}
Idade de Aposentadoria Alvo: ${retirementAge}
Expectativa de Vida: ${lifeExpectancy}
AUM Inicial: R$ ${currentWealth}
Aporte Mensal: R$ ${monthlyContribution}
Saque Mensal Esperado: R$ ${desiredMonthlyIncome}

Determine estimativas macroeconômicas realistas para o longo prazo (Brasil e Global mix):
1. Taxa de Retorno Real projetada (anualizada em %)
2. Taxa média de inflação (IPCA + spread global em %)

NÃO HÁ TEXTO, DEVOLVA APENAS UM JSON NO SEGUINTE FORMATO ESTRITO:
{
  "realReturnRate": 4.5,
  "inflationRate": 3.8
}`;

      const aiResponseText = await executeAiRequest({
        tenantId,
        systemPrompt: "You are a financial planning AI.",
        userPrompt: prompt,
        overrideProvider: "Google Gemini",
        jsonMode: true
      });
      
      let parsedResponse;
      try {
        const cleanedText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedResponse = JSON.parse(cleanedText);
      } catch (e) {
        console.error('Failed to parse AI response for longevity:', aiResponseText);
        parsedResponse = {
          realReturnRate: 4.8,
          inflationRate: 3.5
        }; // Fallback
      }

      return NextResponse.json(parsedResponse);
    }
    
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in /api/ai/longevity:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
