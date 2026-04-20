import Groq from 'groq-sdk';
import { CurrencyConversionService } from './currencyConversionService';

export interface ExtractedTransaction {
  date: string;
  description: string;
  amount: number;
  currency: string;
  baseAmountUsd?: number;
  extractedVia: 'REGEX' | 'AI';
  confidence: number;
}

const currencyEngine = new CurrencyConversionService();

function getGroqClient() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not defined. Cannot use AI fallback.');
  }
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

export class HybridExtractionEngine {
  
  /**
   * Main entrypoint. Pushes a raw PDF text chunk through the cascade.
   */
  async extract(rawText: string): Promise<ExtractedTransaction[]> {
    console.log('[HybridExtractionEngine] Starting Extraction Cascade...');
    
    // 1. Try Regex Patterns (100% Accuracy, 0 Cost)
    const regexResults = this.applyRegexTemplates(rawText);
    
    if (regexResults.length > 0) {
      console.log(`[HybridExtractionEngine] Matched ${regexResults.length} items using REGEX.`);
      return await this.normalizeCurrencies(regexResults);
    }
    
    // 2. If Regex fails (Unrecognized format), fallback to LLM
    console.log('[HybridExtractionEngine] REGEX failed to map. Deploying AI Fallback.');
    const aiResults = await this.applyAIFallback(rawText);
    
    return await this.normalizeCurrencies(aiResults);
  }

  private applyRegexTemplates(text: string): ExtractedTransaction[] {
    const results: ExtractedTransaction[] = [];
    
    // Example: Typical Brazilian Bank Statement Line (DD/MM/YYYY DESC AMOUNT)
    // "15/10/2026 PAGAMENTO FORNEC R$ -1500,00"
    const brBankRegex = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+R\$\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})/g;
    let match;
    
    while ((match = brBankRegex.exec(text)) !== null) {
      const dateRaw = match[1]; // 15/10/2026
      const desc = match[2].trim();
      const amountStr = match[3].replace(/\./g, '').replace(',', '.'); // convert 1.500,00 to 1500.00
      
      const parts = dateRaw.split('/');
      const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      
      results.push({
        date: isoDate,
        description: desc,
        amount: parseFloat(amountStr),
        currency: 'BRL',
        extractedVia: 'REGEX',
        confidence: 1.0
      });
    }

    return results;
  }

  private async applyAIFallback(text: string): Promise<ExtractedTransaction[]> {
    const systemPrompt = `You are a financial document parser. Extract transactions from this raw unstructured OCR dump.
Return STRICT JSON in the format:
{ "transactions": [ { "date": "YYYY-MM-DD", "description": "string", "amount": 100.50, "currency": "USD" } ] }
If the document is a capital call instead of a bank statement, parse the total due amount as a negative transaction.
`;
    
    try {
      const groq = getGroqClient();
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: text }],
        model: 'llama3-70b-8192',
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
      if (!parsed.transactions) return [];

      return parsed.transactions.map((t: any) => ({
        ...t,
        extractedVia: 'AI',
        confidence: 0.9
      }));
    } catch (e) {
      console.error('[HybridExtractionEngine] LLM extraction failed', e);
      return [];
    }
  }

  private async normalizeCurrencies(transactions: ExtractedTransaction[]): Promise<ExtractedTransaction[]> {
    const normalized = [];
    for (const t of transactions) {
      const baseAmount = await currencyEngine.convert(t.amount, t.currency, 'USD', t.date);
      normalized.push({ ...t, baseAmountUsd: baseAmount });
    }
    return normalized;
  }
}
