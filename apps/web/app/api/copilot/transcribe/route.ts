/**
 * /api/copilot/transcribe/route.ts
 *
 * Server-side audio transcription endpoint for the Sales Co-Pilot.
 *
 * Accepts:  FormData { audio: Blob (audio/webm), language: string }
 * Returns:  { text: string }
 *
 * Uses Groq's Whisper API (whisper-large-v3-turbo) — fast, accurate,
 * supports 99 languages. Falls back to empty string when key is absent.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime     = 'nodejs';
export const maxDuration = 30;

const GROQ_API_KEY   = process.env.GROQ_API_KEY   ?? '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY  ?? '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY  ?? '';

/**
 * Transcribe via Groq Whisper (fastest option — typically <500ms for 3s chunks).
 */
async function transcribeWithGroq(audioBlob: Blob, language: string): Promise<string> {
  const form = new FormData();
  form.append('file', audioBlob, 'audio.webm');
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', language);
  form.append('response_format', 'json');

  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method:  'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body:    form,
  });

  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`Groq Whisper ${r.status}: ${errText}`);
  }

  const data = await r.json();
  return (data.text ?? '').trim();
}

/**
 * Transcribe via OpenAI Whisper — fallback if Groq is unavailable.
 */
async function transcribeWithOpenAI(audioBlob: Blob, language: string): Promise<string> {
  const form = new FormData();
  form.append('file', audioBlob, 'audio.webm');
  form.append('model', 'whisper-1');
  form.append('language', language);
  form.append('response_format', 'json');

  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method:  'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body:    form,
  });

  if (!r.ok) throw new Error(`OpenAI Whisper ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return (data.text ?? '').trim();
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const form     = await req.formData();
    const audio    = form.get('audio') as Blob | null;
    const language = (form.get('language') as string | null) ?? 'en';

    if (!audio || audio.size < 500) {
      // Too small to contain speech — return empty silently
      return NextResponse.json({ text: '' });
    }

    let text = '';

    // Try providers in priority order
    if (GROQ_API_KEY) {
      try {
        text = await transcribeWithGroq(audio, language);
      } catch (e: any) {
        console.warn('[copilot/transcribe] Groq failed, trying OpenAI:', e.message);
        if (OPENAI_API_KEY) {
          text = await transcribeWithOpenAI(audio, language);
        }
      }
    } else if (OPENAI_API_KEY) {
      text = await transcribeWithOpenAI(audio, language);
    } else {
      // No API key configured — return indicator so UI can show prompt
      console.warn('[copilot/transcribe] No transcription API key configured. Set GROQ_API_KEY or OPENAI_API_KEY.');
      return NextResponse.json({ text: '', noApiKey: true });
    }

    return NextResponse.json({ text });
  } catch (e: any) {
    console.error('[POST /api/copilot/transcribe]', e);
    return NextResponse.json({ error: e.message ?? 'Transcription failed' }, { status: 500 });
  }
}
