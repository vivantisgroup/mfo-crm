/**
 * /api/copilot/analyze/route.ts
 *
 * AI analysis pipeline for the Sales Co-Pilot.
 *
 * Receives a TranscriptChunk + SessionContext, calls:
 *   1. Groq (llama-3.3-70b) via raw fetch — if GROQ_API_KEY is set
 *   2. Gemini (1.5-flash)   via raw fetch — if GEMINI_API_KEY is set
 *   3. Rule-based demo mode              — if neither key is configured
 *
 * Writes intent + flashcard + methodology state patches to Firestore.
 * Uses Admin SDK so security rules do NOT block writes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type {
  AnalyzeRequest, AnalyzeResponse, IntentLabel,
  FlashcardType, IntentResult, Flashcard,
} from '@/lib/copilot/copilot.types';
import { getAiKeysBySession } from '@/lib/tenantAiConfig';

export const runtime     = 'nodejs';
export const maxDuration = 30;

// ─── AI Provider (raw fetch — no SDK dependency) ──────────────────────────────

async function callGroq(system: string, user: string, apiKey: string): Promise<string> {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model:       'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens:  600,
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
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 600 },
    }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildSystemPrompt(req: AnalyzeRequest): string {
  const { context } = req;
  const methods: Record<string, string> = {
    MEDDIC:     'Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion',
    SPIN:       'Situation, Problem, Implication, Need-Payoff',
    Challenger: 'Teach, Tailor, Take Control',
    Custom:     context.customMethodology?.join(', ') ?? 'custom stages',
  };
  return `You are an elite AI Sales Co-Pilot embedded in a real-time live sales call.

CONTEXT:
- Industry: ${context.industry}
- Product: ${context.productName}
- Target Persona: ${context.targetPersona}
- Sales Methodology: ${context.methodology} (${methods[context.methodology] ?? ''})
- Language: ${context.language}

YOUR JOB: Analyze the new transcript chunk and return a strict JSON object (no markdown):
{
  "intent": {
    "label": "<one of: objection|buying_signal|discovery|pain_expressed|budget_mentioned|competitor_mentioned|timeline_mentioned|stakeholder_mentioned|closing_signal|neutral>",
    "confidence": <0.0-1.0>,
    "reasoning": "<one sentence>",
    "updatedFields": ["<meddic/spin/challenger field name if advanced>"]
  },
  "flashcard": null | {
    "type": "<objection_handler|value_statement|discovery_prompt|competitor_counter|closing_move|insight>",
    "headline": "<≤8 words, bold and specific>",
    "body": "<1-3 sentences: what the seller should say now>",
    "priority": "high" | "normal"
  }
}

Generate a flashcard only when there is actionable buyer signal. Objections and buying signals are always high priority. Be concise — the seller is on an active call.`;
}

function buildUserPrompt(req: AnalyzeRequest): string {
  const ctx = [...req.recentChunks.slice(-4), req.chunk]
    .map(c => `[${c.speaker.toUpperCase()}]: ${c.text}`)
    .join('\n');
  return `RECENT TRANSCRIPT:\n${ctx || '(start of call)'}\n\nAnalyze the LAST line from [${req.chunk.speaker.toUpperCase()}].`;
}

// ─── Rule-based demo fallback (when no API key) ───────────────────────────────

function buildDemoResponse(req: AnalyzeRequest): { label: IntentLabel; confidence: number; reasoning: string; updatedFields: string[]; flashcard: { type: FlashcardType; headline: string; body: string; priority: 'high' | 'normal' } | null } {
  const text = req.chunk.text.toLowerCase();
  const { productName, targetPersona, industry } = req.context;

  if (text.includes('cost') || text.includes('price') || text.includes('expensive') || text.includes('budget') || text.includes('fee')) {
    return {
      label: 'budget_mentioned', confidence: 0.87, reasoning: 'Prospect raised cost/budget concern.',
      updatedFields: ['identifyPain', 'metrics'],
      flashcard: { type: 'value_statement', headline: 'Anchor on ROI, not sticker price', priority: 'high',
        body: `Clients in ${industry} typically consolidate 3-5 point solutions by adopting ${productName}. The efficiency gain alone — typically 40% reduction in reporting overhead — more than offsets the subscription cost in the first year.` },
    };
  }
  if (text.includes('competitor') || text.includes('using') || text.includes('current solution') || text.includes('already have')) {
    return {
      label: 'competitor_mentioned', confidence: 0.84, reasoning: 'Prospect mentioned an existing or competing solution.',
      updatedFields: ['decisionCriteria'],
      flashcard: { type: 'competitor_counter', headline: 'Probe depth of current solution', priority: 'high',
        body: `Many ${targetPersona} clients we work with started with a similar setup. The inflection point is usually when complexity scales — multiple entities, custodians, or advisors. Where do you see that friction today?` },
    };
  }
  if (text.includes('interested') || text.includes('sounds good') || text.includes('next step') || text.includes('when') || text.includes('timeline') || text.includes('move forward')) {
    return {
      label: 'buying_signal', confidence: 0.91, reasoning: 'Prospect signaled interest or forward momentum.',
      updatedFields: ['decisionProcess', 'champion'],
      flashcard: { type: 'closing_move', headline: 'Lock in the next concrete step', priority: 'high',
        body: `I'd love to schedule a technical deep-dive with your team. I'll send a calendar invite — does Thursday or Friday work for a 45-minute session? Who else should be in the room?` },
    };
  }
  if (text.includes('pain') || text.includes('problem') || text.includes('challenge') || text.includes('struggle') || text.includes('difficult') || text.includes('frustrat')) {
    return {
      label: 'pain_expressed', confidence: 0.89, reasoning: 'Prospect articulated a pain point or challenge.',
      updatedFields: ['identifyPain'],
      flashcard: { type: 'discovery_prompt', headline: 'Quantify the impact of this pain', priority: 'high',
        body: `How long has this been a challenge, and what has it cost you in terms of time or missed opportunity? Understanding the full scope helps us show you exactly where we reduce that burden.` },
    };
  }
  if (text.includes('?') || text.includes('how') || text.includes('what') || text.includes('tell me') || text.includes('explain')) {
    return {
      label: 'discovery', confidence: 0.78, reasoning: 'Prospect is asking discovery questions.',
      updatedFields: ['situation'],
      flashcard: null,
    };
  }

  return { label: 'neutral', confidence: 0.65, reasoning: 'No strong signal detected.', updatedFields: [], flashcard: null };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: AnalyzeRequest = await req.json();
    if (!body.chunk?.chunkId || !body.context?.sessionId) {
      return NextResponse.json({ error: 'chunk and context are required.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    let rawData: ReturnType<typeof buildDemoResponse>;

    // Resolve Tenant AI Keys securely
    const aiKeys = await getAiKeysBySession(body.context.sessionId);
    const groqKey = aiKeys['groq_api_key'] || process.env.GROQ_API_KEY || '';
    const geminiKey = aiKeys['gemini_api_key'] || process.env.GEMINI_API_KEY || '';

    // Try AI providers in order
    if (groqKey || geminiKey) {
      try {
        const sys  = buildSystemPrompt(body);
        const user = buildUserPrompt(body);
        const raw  = groqKey ? await callGroq(sys, user, groqKey) : await callGemini(sys, user, geminiKey);
        const parsed = JSON.parse(raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim());
        rawData = {
          label:         parsed.intent?.label          ?? 'neutral',
          confidence:    parsed.intent?.confidence     ?? 0.5,
          reasoning:     parsed.intent?.reasoning      ?? '',
          updatedFields: parsed.intent?.updatedFields  ?? [],
          flashcard:     parsed.flashcard ?? null,
        };
      } catch (aiErr: any) {
        console.warn('[copilot/analyze] AI call failed, using demo:', aiErr.message);
        rawData = buildDemoResponse(body);
      }
    } else {
      rawData = buildDemoResponse(body);
    }

    // Build typed objects
    const intent: IntentResult = {
      sessionId:     body.context.sessionId,
      chunkId:       body.chunk.chunkId,
      label:         rawData.label as IntentLabel,
      confidence:    rawData.confidence,
      reasoning:     rawData.reasoning,
      updatedFields: rawData.updatedFields,
      createdAt:     now,
    };

    let flashcard: Flashcard | null = null;
    if (rawData.flashcard) {
      flashcard = {
        sessionId: body.context.sessionId,
        cardId:    uuidv4(),
        type:      rawData.flashcard.type as FlashcardType,
        trigger:   body.chunk.text,
        headline:  rawData.flashcard.headline,
        body:      rawData.flashcard.body,
        dismissed: false,
        createdAt: now,
        priority:  rawData.flashcard.priority,
      };
    }

    // Write to Firestore via Admin SDK (bypasses security rules)
    try {
      const adminDb = getAdminFirestore();
      const sid     = body.context.sessionId;
      const writes: Promise<unknown>[] = [
        adminDb.collection('copilot_sessions').doc(sid)
          .collection('intents').doc(body.chunk.chunkId).set(intent),
      ];
      if (flashcard) {
        writes.push(
          adminDb.collection('copilot_sessions').doc(sid)
            .collection('flashcards').doc(flashcard.cardId).set(flashcard),
        );
      }
      if (intent.updatedFields.length > 0) {
        const method     = body.context.methodology.toLowerCase().replace(' ', '_');
        const statePatch: Record<string, unknown> = { updatedAt: now };
        for (const field of intent.updatedFields) {
          statePatch[`${field}.covered`]   = true;
          statePatch[`${field}.score`]     = Math.min(100, 55 + Math.round(intent.confidence * 40));
          statePatch[`${field}.evidence`]  = body.chunk.text.slice(0, 200);
          statePatch[`${field}.updatedAt`] = now;
        }
        writes.push(
          adminDb.collection('copilot_sessions').doc(sid)
            .collection(`${method}_state`).doc('current')
            .set(statePatch, { merge: true }),
        );
      }
      await Promise.all(writes);
    } catch (fsErr: any) {
      console.warn('[copilot/analyze] Firestore write skipped (Admin SDK not available locally):', fsErr.message);
    }

    return NextResponse.json({ intent, flashcard, statePatches: {} } satisfies AnalyzeResponse);
  } catch (e: any) {
    console.error('[POST /api/copilot/analyze]', e);
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}
