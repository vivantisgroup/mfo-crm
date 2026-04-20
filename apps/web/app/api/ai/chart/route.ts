import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'dummy_key'
});

export async function POST(req: Request) {
  try {
    const { getSystemPrompt } = await import('@/lib/promptService');
    const systemPromptContext = { 
      language: req.headers.get('accept-language')?.split(',')[0] || 'en-US'
    };
    // Note: chart/route.ts needs tenantId, which currently might not be passed. We'll extract it defaulting to empty string.
    const { prompt, schema, theme = 'emerald', tenantId = '' } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
    }

    const basePrompt = await getSystemPrompt(tenantId, 'chart', systemPromptContext);

    const systemPrompt = basePrompt + `\n\nYour objective is to generate ONLY a valid JSON object representing the "option" configuration for an Apache ECharts instance, based on the user's analytical request.

USER PROMPT: "${prompt}"

AVAILABLE DATA SCHEMA CONTEXT (You should use this context mapping to decide which mock data properties or structure the user's data would look like):
${JSON.stringify(schema, null, 2)}

THEME PREFERENCE: "${theme}" (Integrate dark/light colors or appropriate shades for this theme).

Follow these STRICT rules:
1. Return ONLY the raw JSON object. Do NOT wrap it in cross-ticks (e.g. \`\`\`json). Do NOT include any introductory or concluding text. Be completely silent except for the JSON.
2. Produce an enterprise-quality visualization mimicking Tableau or Vaya dashboards (rich tooltips, smooth animations, legends, dataZoom if applicable, shadows, styling).
3. The dataset should use hardcoded dummy data arrays matching the logic requested, so it immediately renders in the preview canvas.
4. Ensure text colors, background colors, and border colors contrast nicely according to standard hex codes.
5. Provide a valid 'xAxis', 'yAxis', 'series', 'tooltip', and 'legend'. If it's a Pie/Sunburst/Map, configure it correctly without axes.

Example structure:
{
  "title": { "text": "...", "subtext": "..." },
  "tooltip": { "trigger": "axis" },
  "legend": { "data": [...] },
  "xAxis": { "type": "category", "data": [...] },
  "yAxis": { "type": "value" },
  "series": [ { "name": "...", "type": "line", "data": [...] } ]
}`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
      model: 'llama3-70b-8192',
      temperature: 0.2, // Low temperature for consistent JSON
      response_format: { type: "json_object" }
    });

    let generatedText = completion.choices[0]?.message?.content || '{}';
    // Clean potential markdown ticks if groq ignored rules
    generatedText = generatedText.replace(/^```json\n/g, '').replace(/^```\n/g, '').replace(/```$/g, '');
    
    let jsonOption;
    try {
      jsonOption = JSON.parse(generatedText);
    } catch (e: any) {
      console.warn("AI generated invalid JSON payload.", generatedText);
      return NextResponse.json({ error: 'AI failed to generate valid JSON.', details: e.message }, { status: 500 });
    }

    return NextResponse.json({ option: jsonOption });
  } catch (error: any) {
    console.error('Enterprise AI Builder Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
