import { NextRequest, NextResponse } from 'next/server';
import { executeAiRequest } from '@/lib/tenantAiConfig';

export async function POST(req: NextRequest) {
  try {
    const { tenantId, marketType } = await req.json();

    if (!tenantId || !marketType) {
      return NextResponse.json({ error: 'TenantId and marketType are required' }, { status: 400 });
    }

    let searchTargets = '';
    
    if (marketType === 'onshore' || marketType === 'Onshore') {
      searchTargets = 'Itaú, Bradesco, BTG Pactual, and XP Investimentos';
    } else {
      searchTargets = 'JPMorgan, UBS, Morgan Stanley, BlackRock, and Citibank';
    }

    const systemPrompt = `You are an elite macroeconomic analyst for a Multi-Family Office Investment Committee.
Your task is to search for and synthesize the LATEST market analyses and asset allocation recommendations from the following institutions: ${searchTargets}.

CRITICAL REQUIREMENTS:
1. Base your consensus on CURRENT reports (find the latest available data).
2. If you retrieve specific bond information or fixed-income assets, you MUST include the ISIN Code and provide exact, direct URLs to the sources (do not use generic homepage links).
3. Synthesize the views and assign a consensus position (Positivo, Neutro, Negativo) for the major asset classes.
4. Output must be valid JSON ONLY, no markdown formatting.

Format your JSON exactly like this:
{
  "deliberationText": "<p><strong>Macro Scenario & Consensus:</strong> [Your detailed synthesis here, including linkable HTML tags for your sources e.g. <a href='...' target='_blank'>XP Report</a>. Include ISIN codes for bonds mentioned.]</p>",
  "allocationData": [
    {
       "market": "${marketType}",
       "assetClass": "Renda Fixa",
       "category": "Pós-fixada",
       "position": "Positivo",
       "comment": "Tese consolidada..."
    },
    // add more rows as appropriate for ${marketType}
  ]
}`;

    const userPrompt = `Generate the latest ${marketType} market consensus based on ${searchTargets}. Combine their views into the specified JSON format.`;

    let userId = '';
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
       try {
         const { getAuth } = await import('firebase-admin/auth');
         const dtoken = await getAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
         userId = dtoken.uid;
       } catch(e) {}
    }

    const answer = await executeAiRequest({
      tenantId,
      userId,
      systemPrompt,
      userPrompt,
      jsonMode: true,
      enableSearch: true,
      overrideProvider: 'Google Gemini' // Enforce Gemini since it supports Google Search tools in our config
    });

    const parsed = JSON.parse(answer);
    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error('Consensus AI failed:', error);
    return NextResponse.json({ error: error.message || 'AI Consensus failed' }, { status: 500 });
  }
}
