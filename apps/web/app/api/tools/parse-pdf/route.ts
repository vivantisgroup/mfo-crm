import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    
    // Complete Webpack ESM Interop Bypass
    const pdfParseModule = await eval(`import('pdf-parse')`);
    const PDFParse = pdfParseModule.PDFParse;
    
    // PDFParse 2.4.5+ uses a class-based ESM structure
    const parser = new PDFParse({ data: buffer });
    await parser.load();
    
    const data = await parser.getText();

    return NextResponse.json({ text: data.text });
  } catch (err: any) {
    console.error('[parse-pdf]', err);
    return NextResponse.json({ error: err.message || 'Error processing PDF', stack: err.stack }, { status: 500 });
  }
}

