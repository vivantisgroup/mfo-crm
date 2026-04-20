import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { logAiUsage } from '@/lib/aiBillingService';

/**
 * lib/tenantAiConfig.ts
 *
 * Secure internal helper to retrieve aggregated AI keys for a given tenant.
 */

export async function getAiKeysByTenant(tenantId: string): Promise<Record<string, string>> {
  if (!tenantId) return {};
  try {
    const adminDb = getAdminFirestore();
    const tenantSnap = await adminDb.collection('tenants').doc(tenantId).get();
    
    if (!tenantSnap.exists) return {};
    const tenantData = tenantSnap.data() || {};
    
    // ── AI Platform Account Override ──
    if (tenantData.usesPlatformAi && tenantData.aiAccountNumber) {
       const platformAccSnap = await adminDb.collection('platform_ai_accounts').doc(tenantData.aiAccountNumber).get();
       if (platformAccSnap.exists) {
          const accData = platformAccSnap.data() || {};
          const resolvedKeys: Record<string, string> = {};
          if (accData.openai_api_key) resolvedKeys['openai_api_key'] = accData.openai_api_key;
          if (accData.groq_api_key) resolvedKeys['groq_api_key'] = accData.groq_api_key;
          if (accData.anthropic_api_key) resolvedKeys['anthropic_api_key'] = accData.anthropic_api_key;
          if (accData.gemini_api_key) resolvedKeys['gemini_api_key'] = accData.gemini_api_key;
          // Merge in platform default environment variables if explicitly missing
          if (!resolvedKeys['openai_api_key'] && process.env.OPENAI_API_KEY) resolvedKeys['openai_api_key'] = process.env.OPENAI_API_KEY;
          if (!resolvedKeys['groq_api_key'] && process.env.GROQ_API_KEY) resolvedKeys['groq_api_key'] = process.env.GROQ_API_KEY;
          
          // Inject an intercept flag so tracking knows
          resolvedKeys['__usesPlatformAi'] = 'true';
          resolvedKeys['__aiAccountNumber'] = tenantData.aiAccountNumber;

          return resolvedKeys;
       }
    }
    
    const aiKeys = tenantData.aiKeys || {};
    const resolvedKeys: Record<string, string> = {};

    for (const [key, value] of Object.entries(aiKeys)) {
      if (Array.isArray(value)) {
        for (const keyDef of value) {
          if (keyDef.id && keyDef.value && keyDef.saved) {
            resolvedKeys[keyDef.id] = keyDef.value;
          }
        }
      } else if (typeof value === 'string') {
        resolvedKeys[key] = value;
      }
    }
    return resolvedKeys;
  } catch (err) {
    console.warn('[getAiKeysByTenant] Failed to fetch tenant AI keys', err);
    return {};
  }
}

export async function getAiProviderPriority(tenantId: string): Promise<string[]> {
  if (!tenantId) return [];
  try {
    const adminDb = getAdminFirestore();
    const snap = await adminDb.collection('tenants').doc(tenantId).get();
    return snap.data()?.aiProviderPriority || ['OpenAI', 'Groq', 'Anthropic / Claude', 'Google Gemini'];
  } catch(e) {
    return ['OpenAI', 'Groq', 'Anthropic / Claude', 'Google Gemini'];
  }
}

export async function getAiKeysBySession(sessionId: string): Promise<Record<string, string>> {
  if (!sessionId) return {};
  try {
    const adminDb = getAdminFirestore();
    const sessionSnap = await adminDb.collection('copilot_sessions').doc(sessionId).get();
    
    if (!sessionSnap.exists) return {};
    
    const tenantId = sessionSnap.data()?.tenantId;
    if (!tenantId) return {};

    return await getAiKeysByTenant(tenantId);
  } catch (err) {
    console.warn('[getAiKeysBySession] Failed to fetch session keys', err);
    return {};
  }
}

export interface AiRequestOptions {
  tenantId: string;
  userId?: string;
  documentLanguage?: string;
  systemPrompt: string;
  userPrompt: string;
  history?: { role: string; content: string }[];
  overrideProvider?: string; // e.g. "Groq", "OpenAI"
  jsonMode?: boolean;
  enableSearch?: boolean;
}

export async function executeAiRequest(opts: AiRequestOptions): Promise<string> {
  const { tenantId, userId, documentLanguage, systemPrompt, userPrompt, history = [], overrideProvider, jsonMode, enableSearch } = opts;
  const keys = await getAiKeysByTenant(tenantId);
  const priority = await getAiProviderPriority(tenantId);

  let finalSystemPrompt = systemPrompt;
  try {
     const adminDb = getAdminFirestore();
     const tSnap = await adminDb.collection('tenants').doc(tenantId).get();
     let tenantLang = 'the primary regional language configured for this tenant workspace';
     if (tSnap.exists) {
        const d = tSnap.data() || {};
        tenantLang = d.defaultLanguage || d.country || d.region || tenantLang;
     }

     let userLang = '';
     if (userId) {
        const uSnap = await adminDb.collection('users').doc(userId).get();
        if (uSnap.exists && uSnap.data()?.preferredLanguage) {
            userLang = uSnap.data()?.preferredLanguage;
        }
     }

     const langDirective = `\n\n[CRITICAL GLOBAL DIRECTIVE - LANGUAGE & REGIONAL CONTEXT]\n1. Base Context: Your output MUST perfectly respect the primary language and regional idioms of this environment: "${tenantLang}".\n2. User Preference: ${userLang ? `The user expects output in: "${userLang}". You MUST respect this over the base language if it's contextually appropriate.` : `None specified.`}\n3. Document Context: ${documentLanguage ? `You are interacting with a document written in "${documentLanguage}". Ensure terminology and context align with the document's natural language.` : `Not applicable.`}\n4. Resolution: Document context > User Preference > Base Environment. Output dynamically according to these constraints unless told otherwise by the local prompt.\n`;

     finalSystemPrompt = finalSystemPrompt + langDirective;
  } catch(e) {
     console.warn('Failed to resolve language policy context:', e);
  }

  // Determine order to try
  // If overrideProvider is set, prioritize it but still fallback to the tenant's priority list, then defaults.
  let orderToTry = overrideProvider ? [overrideProvider, ...priority] : priority;
  
  // Also push defaults defensively at the end just in case the priority array is missing something
  const defaults = ['OpenAI', 'Groq', 'Google Gemini', 'Anthropic / Claude'];
  orderToTry = [...orderToTry, ...defaults].filter((v, i, a) => a.indexOf(v) === i);

  const errors: string[] = [];

  // Iterate over providers in priority order
  for (const provider of orderToTry) {
     if (provider === 'OpenAI' && (keys['openai_api_key'] || process.env.OPENAI_API_KEY)) {
         try {
             const res = await _callOpenAI(finalSystemPrompt, userPrompt, keys['openai_api_key'] || process.env.OPENAI_API_KEY!, history, jsonMode);
             if (keys['__usesPlatformAi']) await logAiUsage(tenantId, keys['__aiAccountNumber'], 'OpenAI', 'gpt-4o', res.usage.prompt_tokens, res.usage.completion_tokens);
             return res.content;
         } catch (e: any) {
             console.warn(`[executeAiRequest] OpenAI failed: ${e.message}`);
             errors.push(`OpenAI: ${e.message}`);
         }
     }
     if (provider.toLowerCase().includes('groq') && (keys['groq_api_key'] || process.env.GROQ_API_KEY)) {
         try {
             const res = await _callGroq(finalSystemPrompt, userPrompt, keys['groq_api_key'] || process.env.GROQ_API_KEY!, history, jsonMode);
             if (keys['__usesPlatformAi']) await logAiUsage(tenantId, keys['__aiAccountNumber'], 'Groq', 'llama-3.3-70b-versatile', res.usage.prompt_tokens, res.usage.completion_tokens);
             return res.content;
         } catch (e: any) {
             console.warn(`[executeAiRequest] Groq failed: ${e.message}`);
             errors.push(`Groq: ${e.message}`);
         }
     }
     if (provider.toLowerCase().includes('gemini') && (keys['gemini_api_key'] || process.env.GEMINI_API_KEY)) {
         try {
             const res = await _callGemini(finalSystemPrompt, userPrompt, keys['gemini_api_key'] || process.env.GEMINI_API_KEY!, history, jsonMode, enableSearch);
             if (keys['__usesPlatformAi']) await logAiUsage(tenantId, keys['__aiAccountNumber'], 'Gemini', 'gemini-1.5-flash', res.usage.prompt_tokens, res.usage.completion_tokens);
             return res.content;
         } catch (e: any) {
             console.warn(`[executeAiRequest] Gemini failed: ${e.message}`);
             errors.push(`Gemini: ${e.message}`);
         }
     }
  }

  throw new Error(`No valid AI provider succeeded. Errors: ${errors.join(' | ') || 'No configured keys found.'}`);
}

interface CallResult {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

async function _callOpenAI(system: string, user: string, apiKey: string, history: any[], jsonMode?: boolean): Promise<CallResult> {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model:       'gpt-4o',
      temperature: 0.1,
      response_format: jsonMode ? { type: 'json_object' } : undefined,
      messages: [
        { role: 'system', content: system },
        ...history,
        { role: 'user',   content: user },
      ],
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return { 
    content: d.choices?.[0]?.message?.content ?? '',
    usage: d.usage || { prompt_tokens: 0, completion_tokens: 0 }
  };
}

async function _callGroq(system: string, user: string, apiKey: string, history: any[], jsonMode?: boolean): Promise<CallResult> {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model:       'llama-3.3-70b-versatile',
      temperature: 0.1,
      response_format: jsonMode ? { type: 'json_object' } : undefined,
      messages: [
        { role: 'system', content: system },
        ...history,
        { role: 'user',   content: user },
      ],
    }),
  });
  if (!r.ok) throw new Error(`Groq ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return { 
    content: d.choices?.[0]?.message?.content ?? '',
    usage: d.usage || { prompt_tokens: 0, completion_tokens: 0 }
  };
}

async function _callGemini(system: string, user: string, apiKey: string, history: any[], jsonMode?: boolean, enableSearch?: boolean): Promise<CallResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const mappedHistory = history.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] }));
  
  const bodyPayload: any = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [
         ...mappedHistory,
         { role: 'user', parts: [{ text: user }] }
      ],
      generationConfig: { responseMimeType: jsonMode ? 'application/json' : 'text/plain', temperature: 0.1 },
  };

  if (enableSearch) {
      bodyPayload.tools = [{ googleSearch: {} }];
  }

  const r   = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyPayload),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const d = await r.json();
  const content = d.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const usageMetadata = d.usageMetadata || {};
  return {
    content,
    usage: {
       prompt_tokens: usageMetadata.promptTokenCount || 0,
       completion_tokens: usageMetadata.candidatesTokenCount || 0
    }
  };
}
