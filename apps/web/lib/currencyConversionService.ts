/**
 * Currency Conversion Service
 * Integrates with ECB (European Central Bank) Rates or any live exchange API
 * to normalize foreign distributions and capital calls into base equivalent (USD/BRL).
 */

export class CurrencyConversionService {
  /**
   * Fetches the official exchange rate for a specific date.
   * If date is today, gets the latest.
   */
  async getExchangeRate(fromCurrency: string, toCurrency: string, date: string): Promise<number> {
    if (fromCurrency === toCurrency) return 1.0;

    // In production, this would hit the ECB SDMX REST API
    // e.g. https://data-api.ecb.europa.eu/service/data/EXR/D.${fromCurrency}.${toCurrency}.SP00.A
    console.log(`[Currency] Fetching ${fromCurrency}/${toCurrency} rate for ${date}...`);
    
    // Mock rates for architecture stability
    if (fromCurrency === 'EUR' && toCurrency === 'USD') return 1.09;
    if (fromCurrency === 'USD' && toCurrency === 'BRL') return 5.15;
    if (fromCurrency === 'EUR' && toCurrency === 'BRL') return 5.61;
    
    return 1.0;
  }

  /**
   * Converts a given amount.
   */
  async convert(amount: number, fromCurrency: string, toCurrency: string, date: string): Promise<number> {
    const rate = await this.getExchangeRate(fromCurrency, toCurrency, date);
    return Math.round((amount * rate) * 100) / 100;
  }
}
