import { NextRequest, NextResponse } from 'next/server';
import { getAiKeysByTenant } from '@/lib/tenantAiConfig';

export const runtime = 'nodejs';
export const maxDuration = 30;

async function callOpenAI(system: string, user: string, apiKey: string): Promise<string> {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model:       'gpt-4o',
      temperature: 0.1,
      max_tokens:  800,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.choices?.[0]?.message?.content ?? '';
}

async function callGroq(system: string, user: string, apiKey: string): Promise<string> {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model:       'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens:  800,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
    }),
  });
  if (!r.ok) throw new Error(`Groq ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.choices?.[0]?.message?.content ?? '';
}

async function callGemini(system: string, user: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const r   = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${system}\n\n${user}` }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 800 },
    }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { prompt, tenantId } = await req.json();
    if (!prompt) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });

    const sys = `You are an elite Enterprise Cloud Security Architect.
The user wants to configure a credential in our Secure API Vault for a specific external service (e.g., Stripe, Google OAuth2, Slack, Banking APIs).
Analyze their request and return a strict JSON schema that maps exactly what fields need to be injected to successfully authenticate with that specific service.

Return JSON EXACTLY matching this structure:
{
  "type": "<one of: bearer|basic|apikey|custom_header|dynamic>",
  "headerName": "<if custom_header or apikey uses non-standard header>",
  "arguments": [
    {
      "key": "<name of the parameter, e.g. client_id, x-api-key, Authorization>",
      "value": "",
      "placement": "<one of: header|query>"
    }
  ]
}

- Always leave "value" as an empty string (the user will paste their secure keys later).
- If the service requires multiple pieces (e.g. Client ID and Client Secret), always set type to "dynamic" and provide both in the arguments array.
- Make the "key" descriptive so the user knows exactly what credential piece to paste into "value".
- Strip all markdown block formatting (like \`\`\`json). Output pure unformatted JSON starting with {.`;

    const tenantKeys = tenantId ? await getAiKeysByTenant(tenantId) : {};
    
    // Resolve prioritized keys
    const openAIApiKey = tenantKeys['openai_api_key'] || process.env.OPENAI_API_KEY || '';
    const groqKey = tenantKeys['groq_api_key'] || process.env.GROQ_API_KEY || '';
    const geminiKey = tenantKeys['gemini_api_key'] || process.env.GEMINI_API_KEY || '';
    
    let raw = '';
    if (openAIApiKey) {
        raw = await callOpenAI(sys, prompt, openAIApiKey);
    } else if (groqKey) {
        raw = await callGroq(sys, prompt, groqKey);
    } else if (geminiKey) {
        raw = await callGemini(sys, prompt, geminiKey);
    } else {
        // Fallback mock if no API keys are found locally
        raw = JSON.stringify({
           type: "dynamic",
           arguments: [
              { key: "API_SECRET", value: "", placement: "header" },
              { key: "clientId", value: "", placement: "query" }
           ]
        });
    }

    const cleaned = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
    return NextResponse.json({ schema: cleaned });

  } catch (err: any) {
    console.error('[Vault AI Wizard error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
