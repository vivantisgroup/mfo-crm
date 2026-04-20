import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { url, session_id } = await req.json();

    if (!url || !session_id) {
      return NextResponse.json({ error: 'Missing required Odoo mapping parameters (url, session_id)' }, { status: 400 });
    }

    const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const fetchUrl = `${cleanUrl}/web/dataset/call_kw`;

    // 1. Fetch available persistent models (ir.model)
    const modelsPayload = {
      jsonrpc: '2.0',
      params: {
        model: 'ir.model',
        method: 'search_read',
        args: [
          [
            ['transient', '=', false],
            // Hardcode limit initially or filter out "ir.*", "base.*"?
            // We want to avoid loading ~900 ir.* models if possible. Let's filter out some purely technical ones:
            ['model', 'not like', 'ir.%'],
            ['model', 'not like', 'base.%'],
            ['model', 'not like', 'mail.%'],
            ['model', 'not like', 'bus.%'],
            ['model', 'not like', 'report.%']
          ]
        ],
        kwargs: {
          fields: ['model', 'name'],
          limit: 300, // safety limit to prevent massive payloads
        },
      },
    };

    const modelsRes = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${session_id}`,
      },
      body: JSON.stringify(modelsPayload),
    });

    const modelsData = await modelsRes.json();
    if (modelsData.error) {
       console.log('Model fetch error:', modelsData.error);
       return NextResponse.json({ error: modelsData.error.data?.message || 'Failed to fetch Odoo models' }, { status: 400 });
    }

    const persistentModels = modelsData.result || [];
    const modelNames = persistentModels.map((m: any) => m.model);

    // 2. Fetch relations (many2one, one2many, many2many) for those models
    const fieldsPayload = {
      jsonrpc: '2.0',
      params: {
        model: 'ir.model.fields',
        method: 'search_read',
        args: [
          [
            ['ttype', 'in', ['many2one', 'one2many', 'many2many']],
            ['model', 'in', modelNames], // Only fields belonging to the models we just fetched
            ['relation', '!=', false]    // Must have a relation target
          ]
        ],
        kwargs: {
          fields: ['model', 'name', 'relation', 'ttype', 'field_description'],
          limit: 2000,
        },
      },
    };

    const fieldsRes = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${session_id}`,
      },
      body: JSON.stringify(fieldsPayload),
    });

    const fieldsData = await fieldsRes.json();
    if (fieldsData.error) {
       console.log('Fields fetch error:', fieldsData.error);
       return NextResponse.json({ error: fieldsData.error.data?.message || 'Failed to fetch Odoo relations' }, { status: 400 });
    }

    const relations = fieldsData.result || [];

    // Filter relations to only include those where the TARGET model is also in our persistent list, 
    // to avoid diagram nodes pointing into the void.
    const validRelations = relations.filter((r: any) => r.relation && modelNames.includes(r.relation));

    return NextResponse.json({
      models: persistentModels,
      relations: validRelations,
      count: persistentModels.length
    });

  } catch (error: any) {
    console.error('Odoo Models Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
