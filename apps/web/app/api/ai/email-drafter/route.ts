import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAiKeysByTenant } from '@/lib/tenantAiConfig';

export async function POST(req: NextRequest) {
  try {
    const { tenantId, topic, style, tone, length, orgName, title, value } = await req.json();

    if (!topic || !orgName) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const aiKeys = await getAiKeysByTenant(tenantId);
    const apiKey = aiKeys['openai_api_key'] || aiKeys['OpenAI'] || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ 
        error: "OpenAI API Key is not configured for your organization." 
      }, { status: 401 });
    }

    const openai = new OpenAI({ apiKey });
    
    // Construct lengths mapping
    const lengthMap: Record<string, string> = {
      short: 'concise, about 1-2 short paragraphs.',
      medium: 'about 3 paragraphs, giving enough detail but keeping it readable.',
      long: 'comprehensive and detailed, expanding on points across 4-5 paragraphs.'
    };

    const promptText = `Draft a Professional B2B Email.
Topic: ${topic}
Recipient Organization: ${orgName}
Related Opportunity: ${title} ($${value.toLocaleString()})

Parameters:
Style: ${style} (e.g., Casual = relaxed but professional; Formal = deferential and strict business)
Tone: ${tone} (e.g., Submissive = very polite, asking for permission; Assertive = confident, dictating next steps)
Length: ${lengthMap[length] || lengthMap['medium']}

Do NOT include subject lines, just write the body of the email directly. Do NOT include placeholders like [Your Name] or [Company Name], just write it in a way that minimizes placeholders or leaves it generic but ready to send.`;

    const { getSystemPrompt } = await import('@/lib/promptService');
    const systemPromptContext = { 
      language: req.headers.get('accept-language')?.split(',')[0] || 'en-US'
    };
    const systemPrompt = await getSystemPrompt(tenantId, 'email-drafter', systemPromptContext);

    const comp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: promptText }
      ],
      temperature: 0.7
    });

    const draft = comp.choices[0].message.content?.trim() || '';

    return NextResponse.json({ draft });

  } catch (error: any) {
    console.error('Email Drafter failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
