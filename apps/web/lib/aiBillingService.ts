import { firebaseApp } from '@mfo-crm/config';
import { getFirestore, doc, getDoc, runTransaction } from 'firebase/firestore';

/**
 * Log AI Consumption to the Platform's Ledger
 * This is invoked by executeAiRequest if usesPlatformAi is enabled.
 * It tracks usage per tenant and AI Account Number.
 */
export async function logAiUsage(
  tenantId: string,
  aiAccountNumber: string,
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  if (!tenantId || !aiAccountNumber) return;

  const db = getFirestore(firebaseApp);

  const nowDate = new Date();
  const yearMonth = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}`;

  const ledgerRef = doc(db, 'ai_usage_ledger', tenantId, 'monthly', yearMonth);

  // We are storing per-model rates to estimate cost. 
  // In a true production app, these would be configurable, but we'll use industry standard pass-through models.
  // We use per 1k token rates.
  const rates: Record<string, { input: number, output: number }> = {
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'llama-3.3-70b-versatile': { input: 0.00059, output: 0.00079 },
    'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
    'gemini-1.5-pro': { input: 0.0035, output: 0.0105 },
    'claude-3-5-sonnet': { input: 0.003, output: 0.015 }
  };

  const currentRate = rates[model] || { input: 0.001, output: 0.002 }; // fallback

  const inputCost = (inputTokens / 1000) * currentRate.input;
  const outputCost = (outputTokens / 1000) * currentRate.output;
  const totalCost = inputCost + outputCost;

  try {
    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(ledgerRef);
      if (!docSnap.exists()) {
        transaction.set(ledgerRef, {
          tenantId,
          aiAccountNumber,
          yearMonth,
          totalEstimatedCost: totalCost,
          totalInputTokens: inputTokens,
          totalOutputTokens: outputTokens,
          models: {
            [model]: {
              inputTokens: inputTokens,
              outputTokens: outputTokens,
              cost: totalCost
            }
          },
          lastUpdated: new Date().toISOString()
        });
      } else {
        const data = docSnap.data()!;
        const models = data.models || {};
        const modelData = models[model] || { inputTokens: 0, outputTokens: 0, cost: 0 };
        
        modelData.inputTokens += inputTokens;
        modelData.outputTokens += outputTokens;
        modelData.cost += totalCost;

        models[model] = modelData;

        transaction.update(ledgerRef, {
          totalEstimatedCost: (data.totalEstimatedCost || 0) + totalCost,
          totalInputTokens: (data.totalInputTokens || 0) + inputTokens,
          totalOutputTokens: (data.totalOutputTokens || 0) + outputTokens,
          models: models,
          lastUpdated: new Date().toISOString()
        });
      }
    });

    // Also push a global metric roll-up if needed, but for billing per tenant, this is enough.
  } catch (err) {
    console.error(`[logAiUsage] Failed to log AI usage for tenant ${tenantId}`, err);
  }
}

/**
 * Fetch the accumulated charges for the currently pending period (the last month, or current month).
 */
export async function getPendingAiCharges(tenantId: string, periodStart: string, periodEnd: string): Promise<number> {
  const db = getFirestore(firebaseApp);

  // In a robust implementation, we would query the specific days by traversing a daily log.
  // For this MV, we will grab the monthly doc that encompasses the periodEnd date.
  const endDate = new Date(periodEnd);
  const yearMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;

  const docRef = doc(db, 'ai_usage_ledger', tenantId, 'monthly', yearMonth);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return 0;
  }

  // We could mark it as BILLED so we don't double charge if we invoice multiple times.
  // For simplicity, we just return the currently accumulated cost. In real implementation, returning it would trigger a reset or log the invoice mapping.
  
  const data = docSnap.data()!;
  
  // By default we add a 10% platform markup to the pure API costs to cover proxying infra.
  const markupPercentage = 0.10; 
  const passThroughCost = data.totalEstimatedCost || 0;
  
  return passThroughCost * (1 + markupPercentage);
}
