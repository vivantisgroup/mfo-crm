import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAiKeysByTenant } from '@/lib/tenantAiConfig';
import type { WidgetDefinition } from '@/lib/reportsService';

// Ensure the Edge Runtime or Node runtime can read process.env
// The prompt is very strict to ensure type compliance with WidgetDefinition
const SYSTEM_PROMPT = `You are an elite, highly intelligent Graphic Designer and Analytics Engineer for the top-tier MFO-CRM Enterprise Business Intelligence module.
Your job is to read user prompts and design stunning, highly effective, interconnected ECharts visualizations. 
You must return ONLY a valid JSON object containing a "widgets" array of WidgetDefinition objects.

Available Data Sources: 'families', 'contacts', 'activities', 'tasks', 'calendar', 'portfolio', 'documents', 'estate', 'governance', 'compliance', 'suitability', 'concierge', 'crm_opportunities'.
Available Chart Types: 
- Comparisons: 'bar', 'bar_stacked', 'bar_horizontal', 'waterfall'
- Trends: 'line', 'area', 'candlestick'
- Proportions: 'pie', 'doughnut', 'rose', 'treemap', 'sunburst'
- Relationships: 'scatter', 'bubble', 'radar'
- Process & Health: 'funnel', 'heatmap', 'gauge'

Available Themes: 'emerald', 'slate', 'blue', 'purple', 'rose', 'amber'. Pick themes matching sentiment (e.g. emerald/green for money or success, rose/red for risk/alerts, blue/slate for standard tracking).

Widget Sizing Constraints:
- w (width span): 1 to 4 (A standard multi-column layout is w=1 or 2, hero components w=3 or 4).
- h (height span): 1 to 4 (default 2).

Advanced Formatting:
Provide advanced configurations inside the object!
- 'isStacked': true (for waterfalls or comparative metrics)
- 'smoothCurve': true (for elegant lines/areas)
- 'showLabels': true/false (true for pies, gauges, single bars, false for scatters)
- 'showLegend': true/false
- 'kpiTarget': number (ONLY used to set Max scale of 'gauge'. For percentages use 100, for revenue use logical max boundaries)

Design Rules:
1. Do NOT just build a single basic chart. If the user asks for a "dashboard", build an overlapping array of 3 to 6 widgets creating a comprehensive Fiori Layout narrative.
2. For single requests, give them the most state-of-the-art visual possible. Map hierarchal requests to 'sunburst' or 'treemap'. Map KPI single numbers to 'gauge' or 'pie' with \`showLabels: true\`.
3. Give incredibly concise, sharp titles avoiding redundancy.

Schema per widget:
{
  "id": "must start with wid_ and be unique random 8 chars",
  "type": "ChartType",
  "dataSource": "data source string",
  "title": "string",
  "theme": "string",
  "w": number,
  "h": number,
  "isStacked": boolean,
  "smoothCurve": boolean,
  "showLabels": boolean,
  "showLegend": boolean,
  "kpiTarget": number
}

Output ONLY valid JSON like: { "widgets": [ ... array ... ] }`;

export async function POST(req: NextRequest) {
  try {
    const { tenantId, prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
    }

    const aiKeys = await getAiKeysByTenant(tenantId);
    const apiKey = aiKeys['openai_api_key'] || aiKeys['OpenAI'] || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ 
        error: "OpenAI API Key is not configured for your organization." 
      }, { status: 401 });
    }

    const openai = new OpenAI({ apiKey });

    const { getSystemPrompt } = await import('@/lib/promptService');
    const systemPromptContext = { 
      language: req.headers.get('accept-language')?.split(',')[0] || 'en-US'
    };
    const basePrompt = await getSystemPrompt(tenantId, 'reports-builder', systemPromptContext);

    const systemPromptText = basePrompt + `
Your job is to read user prompts and design stunning, highly effective, interconnected ECharts visualizations. 
You must return ONLY a valid JSON object containing a "widgets" array of WidgetDefinition objects.

Available Data Sources: 'families', 'contacts', 'activities', 'tasks', 'calendar', 'portfolio', 'documents', 'estate', 'governance', 'compliance', 'suitability', 'concierge', 'crm_opportunities'.
Available Chart Types: 
- Comparisons: 'bar', 'bar_stacked', 'bar_horizontal', 'waterfall'
- Trends: 'line', 'area', 'candlestick'
- Proportions: 'pie', 'doughnut', 'rose', 'treemap', 'sunburst'
- Relationships: 'scatter', 'bubble', 'radar'
- Process & Health: 'funnel', 'heatmap', 'gauge'

Available Themes: 'emerald', 'slate', 'blue', 'purple', 'rose', 'amber'. Pick themes matching sentiment (e.g. emerald/green for money or success, rose/red for risk/alerts, blue/slate for standard tracking).

Widget Sizing Constraints:
- w (width span): 1 to 4 (A standard multi-column layout is w=1 or 2, hero components w=3 or 4).
- h (height span): 1 to 4 (default 2).

Advanced Formatting:
Provide advanced configurations inside the object!
- 'isStacked': true (for waterfalls or comparative metrics)
- 'smoothCurve': true (for elegant lines/areas)
- 'showLabels': true/false (true for pies, gauges, single bars, false for scatters)
- 'showLegend': true/false
- 'kpiTarget': number (ONLY used to set Max scale of 'gauge'. For percentages use 100, for revenue use logical max boundaries)

Design Rules:
1. Do NOT just build a single basic chart. If the user asks for a "dashboard", build an overlapping array of 3 to 6 widgets creating a comprehensive Fiori Layout narrative.
2. For single requests, give them the most state-of-the-art visual possible. Map hierarchal requests to 'sunburst' or 'treemap'. Map KPI single numbers to 'gauge' or 'pie' with \`showLabels: true\`.
3. Give incredibly concise, sharp titles avoiding redundancy.

Schema per widget:
{
  "id": "must start with wid_ and be unique random 8 chars",
  "type": "ChartType",
  "dataSource": "data source string",
  "title": "string",
  "theme": "string",
  "w": number,
  "h": number,
  "isStacked": boolean,
  "smoothCurve": boolean,
  "showLabels": boolean,
  "showLegend": boolean,
  "kpiTarget": number
}

Output ONLY valid JSON like: { "widgets": [ ... array ... ] }`;

    const comp = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Cost efficient model for JSON mapping
      messages: [
        { role: "system", content: systemPromptText },
        { role: "user", content: `Please build a dashboard or chart for the following request: ${prompt}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5
    });

    const answer = comp.choices[0].message.content || '{"widgets": []}';
    let data;
    try {
      data = JSON.parse(answer);
    } catch(e) {
      data = { widgets: [] };
    }

    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Copilot failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
