import { getAdminFirestore } from '@/lib/firebaseAdmin';

/**
 * lib/tenantAiConfig.ts
 *
 * Secure internal helper to retrieve aggregated AI keys for a given tenant.
 * Can be resolved either via the user's Firebase token, or via a trusted
 * session document (e.g., copilot_sessions).
 */

export async function getAiKeysByTenant(tenantId: string): Promise<Record<string, string>> {
  if (!tenantId) return {};
  try {
    const adminDb = getAdminFirestore();
    const tenantSnap = await adminDb.collection('tenants').doc(tenantId).get();
    
    if (!tenantSnap.exists) return {};
    
    const aiKeys = tenantSnap.data()?.aiKeys || {};
    const resolvedKeys: Record<string, string> = {};

    // aiKeys shape: { "OpenAI": [{id: 'openai_api_key', value: 'sk-...', saved: true}], "Groq": [...] }
    // Or legacy flat shape: { openai_api_key: 'sk-...', groq_api_key: 'gsk_...' }
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
