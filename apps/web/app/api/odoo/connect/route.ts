import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { url, db, username, password } = await req.json();

    if (!url || !db || !username || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const authUrl = `${cleanUrl}/web/session/authenticate`;

    const payload = {
      jsonrpc: '2.0',
      params: {
        db: db,
        login: username,
        password: password,
      },
    };

    const odooRes = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const setCookieHeader = odooRes.headers.get('set-cookie') || '';
    const sidMatch = setCookieHeader.match(/session_id=([^;]+)/);
    const sessionId = sidMatch ? sidMatch[1] : null;

    const data = await odooRes.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.data?.message || 'Authentication failed' }, { status: 401 });
    }

    if (!data.result || !data.result.uid) {
      return NextResponse.json({ error: 'Invalid credentials or database' }, { status: 401 });
    }

    // Return the uid and the session_id so the client can hold it for subsequent requests
    return NextResponse.json({
      uid: data.result.uid,
      session_id: data.result.session_id || sessionId,
      name: data.result.name,
      company: data.result.user_companies?.current_company?.[1] || 'Odoo SaaS',
      server_version: data.result.server_version
    });
  } catch (error: any) {
    console.error('Odoo Connect Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
