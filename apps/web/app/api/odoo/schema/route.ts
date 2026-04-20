import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { url, session_id, model } = await req.json();

    if (!url || !session_id || !model) {
      return NextResponse.json({ error: 'Missing required Odoo schema mapping parameters' }, { status: 400 });
    }

    const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const fetchUrl = `${cleanUrl}/web/dataset/call_kw`;

    const payload = {
      jsonrpc: '2.0',
      params: {
        model,
        method: 'fields_get',
        args: [],
        kwargs: {
          attributes: ['string', 'help', 'type', 'selection']
        },
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
      return NextResponse.json({ error: data.error.data?.message || 'Odoo Schema Fetch failed' }, { status: 400 });
    }

    // data.result is an object where keys are field names and values are field metadata
    const fieldsHash = data.result || {};
    
    // Convert to array format for easier UI consumption:
    // [{ id: 'name', label: 'Name', type: 'char', ... }]
    const fieldsList = Object.entries(fieldsHash).map(([fieldKey, fieldData]: [string, any]) => ({
      id: fieldKey,
      label: fieldData.string || fieldKey,
      type: fieldData.type || 'unknown',
      selection: fieldData.selection || null,
      help: fieldData.help || '',
    }));

    // Sort alphabetically by label for ease of use in UI
    fieldsList.sort((a, b) => a.label.localeCompare(b.label));

    return NextResponse.json({
      fields: fieldsList,
      count: fieldsList.length
    });
  } catch (error: any) {
    console.error('Odoo Schema Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
