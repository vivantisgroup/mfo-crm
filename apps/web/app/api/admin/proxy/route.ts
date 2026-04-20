import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new NextResponse('Missing target URL', { status: 400 });
  }

  try {
    const res = await fetch(targetUrl);
    
    if (!res.ok) {
      return new NextResponse(`Failed to fetch from target: ${res.statusText}`, { status: res.status });
    }

    const headers = new Headers();
    const contentType = res.headers.get('content-type');
    const contentLength = res.headers.get('content-length');
    
    if (contentType) headers.set('Content-Type', contentType);
    if (contentLength) headers.set('Content-Length', contentLength);

    // Provide permissive headers for iframe embedding
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('X-Frame-Options', 'ALLOWALL');

    return new NextResponse(res.body, {
      status: 200,
      headers
    });
  } catch (error) {
    console.error('[API Proxy] Error:', error);
    return new NextResponse('Internal Proxy Error', { status: 500 });
  }
}
