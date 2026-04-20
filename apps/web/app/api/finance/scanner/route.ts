import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Determine the market from the URL query params or body.
    const url = new URL(request.url);
    const market = url.searchParams.get('market') || 'brazil';

    // Protect against arbitrary targets
    const allowedMarkets = ['brazil', 'america', 'global', 'crypto'];
    const safeMarket = allowedMarkets.includes(market) ? market : 'brazil';
    
    let targetUrl = `https://scanner.tradingview.com/${safeMarket}/scan`;
    
    // TradingView crypto scanner is global/scan but maybe crypto is different?
    // "crypto/scan" doesn't exist, it's usually "crypto/scan"
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`TradingView API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('TradingView Proxy Error:', error);
    return NextResponse.json(
      { error: 'Failed to access TradingView scanner', details: error.message },
      { status: 500 }
    );
  }
}
