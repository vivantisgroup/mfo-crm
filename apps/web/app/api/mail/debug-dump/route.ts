import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    fs.writeFileSync('c:\\MFO-CRM\\debug_attachments_frontend.json', JSON.stringify(data, null, 2));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false });
  }
}
