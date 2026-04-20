import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { url, session_id, model, domain = [], fields = [], limit = 0 } = await req.json();

    if (!url || !session_id || !model) {
      return NextResponse.json({ error: 'Missing required Odoo mapping parameters' }, { status: 400 });
    }

    const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const fetchUrl = `${cleanUrl}/web/dataset/call_kw`;

    const kwargs: any = {};
    if (fields && fields.length > 0) kwargs.fields = fields;
    if (limit > 0) kwargs.limit = limit;

    const payload = {
      jsonrpc: '2.0',
      params: {
        model,
        method: 'search_read',
        args: [domain],
        kwargs,
      },
    };

    const odooRes = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${session_id}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await odooRes.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.data?.message || 'Odoo Fetch failed' }, { status: 400 });
    }

    return NextResponse.json({
      records: data.result || [],
      count: data.result?.length || 0
    });
  } catch (error: any) {
    console.error('Odoo Fetch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
