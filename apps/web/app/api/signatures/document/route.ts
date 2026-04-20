import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get('url');
    if (!url) return new NextResponse('Missing URL parameter', { status: 400 });

    let buffer: ArrayBuffer | Buffer | null = null;

    // Detect Private Firebase URLs and use Admin SDK to bypass 403 (even if token is present but expired)
    if (url.includes('firebasestorage.googleapis.com')) {
      try {
         const { getAdminStorage } = await import('@/lib/firebaseAdmin');
         const bucketMatch = url.match(/\/b\/([^\/]+)\/o\//);
         const bucketName = bucketMatch ? bucketMatch[1] : null;
         const pathMatch = url.split('/o/')[1]?.split('?')[0];
         
         if (bucketName && pathMatch) {
            const file = getAdminStorage().bucket(bucketName).file(decodeURIComponent(pathMatch));
            const [fileBuffer] = await file.download();
            buffer = fileBuffer;
         }
      } catch(e: any) {
         console.warn('[pdf-proxy] Admin SDK proxy download failed, falling back to HTTP:', e.message);
      }
    }

    if (!buffer) {
       const res = await fetch(url);
       if (!res.ok) {
         console.error('[pdf-proxy] Fetch failed:', res.status, res.statusText);
         return new NextResponse('Upstream Fetch failed', { status: res.status });
       }
       buffer = await res.arrayBuffer();
    }
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3153600'
      }
    });
  } catch (err: any) {
    console.error('[pdf-proxy] Proxy error:', err);
    return new NextResponse('Internal Proxy Error', { status: 500 });
  }
}
