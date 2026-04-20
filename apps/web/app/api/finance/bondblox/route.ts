import { NextResponse } from 'next/server';

/**
 * BondbloX In-Memory Cache implementation.
 * Avoiding Firestore I/O while fetching ~3000 elements fast.
 */
const g = global as any;
if (!g.bondbloxCache) {
  g.bondbloxCache = { timestamp: 0, data: [] };
}

const CACHE_TTL_MS = 120 * 1000; // 2 minutes

async function fetchAndParseBondblox() {
  try {
    const res = await fetch('https://bondblox.com/trade-bonds/listed-bonds', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html'
      },
      next: { revalidate: 60 } // Also hints Next.js cache
    });

    if (!res.ok) throw new Error(`BondbloX returned ${res.status}`);

    const html = await res.text();
    const searchString = '<script id="__NEXT_DATA__" type="application/json">';
    const startIdx = html.indexOf(searchString);
    if (startIdx === -1) throw new Error("Could not find __NEXT_DATA__ payload.");

    const payloadStart = startIdx + searchString.length;
    const endIdx = html.indexOf('</script>', payloadStart);
    const jsonStr = html.substring(payloadStart, endIdx);

    const data = JSON.parse(jsonStr);
    const bondsRaw = data?.props?.pageProps?.result || data?.props?.pageProps?.fractionalBonds || data?.props?.pageProps?.bonds || [];

    const parsedBonds: any[] = [];
    for (const b of bondsRaw) {
      parsedBonds.push({
          id: b.is,
          symbol: b.ibn || b.is,
          name: b.isn || b.ibn || b.grn,
          coupon: parseFloat(b.cpn) || 0,
          maturity: b.mat ? new Date(b.mat).toISOString().split('T')[0] : 'N/A',
          rating: (b.rat || 'Unrated').replace('Fitch: ', '').replace('Moody: ', ''),
          country: b.icn || b.ctr || 'N/A',
          sector: b.ind || 'N/A',
          currency: b.cur || 'USD',
          minDenomination: b.mnd || b.min || 1000,
          exchange: 'BondbloX',
          seniority: b.snr || 'N/A',
          registrationType: b.rgt || 'N/A',
          issueDate: b.idt ? new Date(b.idt).toISOString().split('T')[0] : 'N/A',
          issuePrice: b.ipr || null,
          amountIssued: b.ais || null,
          amountOutstanding: b.aos || null,
          lastPrice: b.cps || b.lpr || null,
          bidPrice: b.gbp || b.bps || null,
          askPrice: b.gap || b.sps || null,
          lastYield: b.cys || b.ly || null,
          bidYield: b.gby || b.bys || null,
          askYield: b.gay || b.sys || null,
          link: b.is ? `https://bondblox.com/trade-bonds/listed-bonds/${b.is}` : 'https://bondblox.com/trade-bonds',
          status: b.sus || b.act || 'act',
          callable: b.cal || 'N/A',
          perpetual: b.per || 'N/A',
          nextCallDate: b.ncd || b.ncl || 'N/A',
          nextCallPrice: b.ncp || 'N/A',
          couponType: b.ctp || 'N/A',
          redemptionValue: b.rdv || 'N/A',
          couponFrequency: b.cfq || 'N/A',
          dayCountFraction: b.dct || 'N/A',
          greenBond: b.grn || 'N/A',
          multiples: b.mtl || 'N/A',
          minOrder: b.min || 'N/A',
          lastUpdated: new Date().toISOString()
      });
    }

    return parsedBonds;
  } catch (error) {
    console.error("BondbloX Parse Error:", error);
    return null;
  }
}


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').toLowerCase();
  
  // Advanced filters
  const minYtm = parseFloat(searchParams.get('minYtm') || '0');
  const minCoupon = parseFloat(searchParams.get('minCoupon') || '0');
  const maxDenom = parseInt(searchParams.get('maxDenom') || '0', 10);
  const sector = (searchParams.get('sector') || '').toLowerCase();
  const risk = (searchParams.get('risk') || '').toLowerCase();
  const ratingExact = (searchParams.get('rating') || '').toUpperCase();
  const country = (searchParams.get('country') || '').toLowerCase();
  const maturityBucket = searchParams.get('maturity') || '';
  const isMetadataRequest = searchParams.get('metadata') === 'true';
  const perpetual = searchParams.get('perpetual') === 'true';
  const callable = searchParams.get('callable') === 'true';

  try {
    // 1. Resolve Memory Cache Check
    const now = Date.now();
    if (!g.bondbloxCache.data || g.bondbloxCache.data.length === 0 || now - g.bondbloxCache.timestamp > CACHE_TTL_MS) {
       console.log('[BondbloX Proxy] Cache MISS or Stale. Fetching fresh payload...');
       const freshData = await fetchAndParseBondblox();
       if (freshData && freshData.length > 0) {
          g.bondbloxCache = {
             timestamp: now,
             data: freshData
          };
       } else if (g.bondbloxCache.data.length === 0) {
          throw new Error('Failed to fetch initial BondbloX payload.');
       } else {
          console.warn('[BondbloX Proxy] Fetch failed, returning stale cache as fallback.');
       }
    }

    const allBonds = g.bondbloxCache.data;

    // 2. Metadata interception
    if (isMetadataRequest) {
      const sectors = Array.from(new Set(allBonds.map((b: any) => b.sector).filter(Boolean))).sort();
      const countries = Array.from(new Set(allBonds.map((b: any) => b.country).filter(Boolean))).sort();
      return NextResponse.json({ sectors, countries });
    }

    // 3. Filter purely in-memory
    const results = allBonds.filter((b: any) => {
       // Search query
       if (query) {
         const match = (b.symbol && b.symbol.toLowerCase().includes(query)) ||
                       (b.name && b.name.toLowerCase().includes(query)) ||
                       (b.id && b.id.toLowerCase().includes(query)) ||
                       (b.guarantor && b.guarantor.toLowerCase().includes(query));
         if (!match) return false;
       }

       // Core metrics
       const ytm = parseFloat(b.lastYield || b.bidYield || b.askYield || '0');
       if (minYtm > 0 && ytm < minYtm) return false;

       const coupon = parseFloat(b.coupon || '0');
       if (minCoupon > 0 && coupon < minCoupon) return false;

       if (maxDenom > 0 && b.minDenomination && b.minDenomination > maxDenom) return false;
       if (sector && b.sector && !b.sector.toLowerCase().includes(sector)) return false;
       if (country && b.country && !b.country.toLowerCase().includes(country)) return false;

       // Toggle flags
       if (perpetual && b.perpetual !== 'Y') return false;
       if (callable && b.callable !== 'Y') return false;

       // Risk buckets
       if (risk) {
         let r = (b.rating || 'Unrated').toUpperCase();
         const isLow = r.includes('AAA') || r.includes('AA') || r === 'A+' || r === 'A' || r === 'A-';
         const isMedium = r.includes('BBB'); 
         const isUnrated = r === 'UNRATED' || r === 'NR' || r === 'UR' || r === 'N/A';
         const isHigh = !isLow && !isMedium && !isUnrated; 

         if (risk === 'low' && !isLow) return false;
         if (risk === 'medium' && !isMedium) return false;
         if (risk === 'high' && !isHigh) return false;
         if (risk === 'unrated' && !isUnrated) return false;
       }

       if (ratingExact) {
            if (ratingExact === 'UNRATED' && (b.rating === 'N/A' || !b.rating)) {
               // allow
            } else if (b.rating !== ratingExact) {
               return false;
            }
       }

       // Maturity Buckets
       if (maturityBucket) {
         if (b.maturity && b.maturity !== 'N/A') {
           const matYrs = (new Date(b.maturity).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365.25);
           if (maturityBucket === '<2' && (matYrs > 2 || matYrs < 0)) return false;
           if (maturityBucket === '<5' && (matYrs > 5 || matYrs < 0)) return false;
           if (maturityBucket === '<10' && (matYrs > 10 || matYrs < 0)) return false;
           if (maturityBucket === '>10' && matYrs <= 10) return false;
         } else if (b.perpetual !== 'Y') {
           return false;
         }
       }

       return true;
    });

    // 4. Map to Screener UI format
    const mapped = results.map((b: any) => ({
      id: b.id,
      symbol: b.symbol,
      issuer: b.name,
      shortName: b.name,
      price: b.lastPrice || b.bidPrice || b.askPrice || null,
      change: 0,
      changePercent: 0,
      currency: b.currency,
      type: 'Fractional Bond',
      rating: b.rating,
      ytm: b.lastYield || b.bidYield || b.askYield || null,
      bidPrice: b.bidPrice,
      askPrice: b.askPrice,
      bidYield: b.bidYield,
      askYield: b.askYield,
      coupon: b.coupon,
      maturity: b.maturity?.split('T')[0] || b.maturity,
      minDenomination: b.minDenomination,
      exchange: b.exchange,
      sector: b.sector,
      country: b.country,
      seniority: b.seniority,
      registrationType: b.registrationType,
      issueDate: b.issueDate,
      issuePrice: b.issuePrice,
      link: b.link,
      amountOutstanding: b.amountOutstanding,
      amountIssued: b.amountIssued,
      status: b.status,
      callable: b.callable,
      perpetual: b.perpetual,
      nextCallDate: b.nextCallDate?.split('T')[0] || b.nextCallDate,
      nextCallPrice: b.nextCallPrice,
      couponType: b.couponType,
      redemptionValue: b.redemptionValue,
      couponFrequency: b.couponFrequency,
      dayCountFraction: b.dayCountFraction,
      greenBond: b.greenBond,
      multiples: b.multiples,
      minOrder: b.minOrder,
      lastUpdated: b.lastUpdated
    }));

    // Return capped mapping to prevent giant JSONs returning on empty searches
    return NextResponse.json({ results: mapped.slice(0, 100), totalCached: allBonds.length });
  } catch (error: any) {
    console.error('BondbloX In-Memory Query Error:', error);
    return NextResponse.json({ error: error.message || 'Internal proxy error', results: [] }, { status: 500 });
  }
}
