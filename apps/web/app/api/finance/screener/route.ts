import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
  }

  try {
    // Perform a search for the ticker
    const result = await yahooFinance.search(query);
    const quotes = result.quotes || [];
    
    // Filter out non-equity/ETF/MutualFund items if desired, or return limited results
    const filtered = quotes.filter(q => q.isYahooFinance).slice(0, 10);
    
    if (filtered.length === 0) {
       return NextResponse.json({ results: [] });
    }

    // Get detailed quotes for the matched symbols
    const symbols = filtered.map(q => q.symbol);
    const details = await yahooFinance.quote(symbols);
    
    // Handle both single object or array return from quote() based on symbols array length
    const detailedList = Array.isArray(details) ? details : [details];

    const results = detailedList.map(detail => ({
      symbol: detail.symbol,
      shortName: detail.shortName || detail.longName || detail.symbol,
      price: detail.regularMarketPrice || 0,
      change: detail.regularMarketChange || 0,
      changePercent: detail.regularMarketChangePercent || 0,
      type: detail.quoteType || 'Unknown',
      exchange: detail.exchange || 'Unknown',
      currency: detail.currency || 'USD',
      marketCap: detail.marketCap || null,
      volume: detail.regularMarketVolume || null,
      fiftyTwoWeekHigh: detail.fiftyTwoWeekHigh || null,
      fiftyTwoWeekLow: detail.fiftyTwoWeekLow || null,
      trailingPE: detail.trailingPE || null,
      dividendYield: detail.dividendYield || detail.trailingAnnualDividendYield || null
    }));

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Yahoo Finance API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
