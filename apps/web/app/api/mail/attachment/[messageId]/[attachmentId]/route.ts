import { NextRequest, NextResponse } from 'next/server';
import { getValidGoogleToken } from '@/lib/googleTokenRefresh';

const GMAIL = 'https://gmail.googleapis.com/gmail/v1';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string; attachmentId: string }> }
) {
  try {
    const { messageId, attachmentId } = await params;
    
    // Extract search params
    const searchParams = req.nextUrl.searchParams;
    const uid      = searchParams.get('uid');
    const idToken  = searchParams.get('idToken');
    const name     = searchParams.get('name') || 'attachment';
    const mimeType = searchParams.get('mimeType') || 'application/octet-stream';

    if (!uid || !idToken || !messageId || !attachmentId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Get fresh access token
    const accessToken = await getValidGoogleToken(uid, idToken);

    // Fetch attachment from Gmail API
    const res = await fetch(`${GMAIL}/users/me/messages/${messageId}/attachments/${attachmentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Gmail attachment fetch failed: ${err}` }, { status: res.status });
    }

    const data = await res.json();
    
    // Gmail returns attachment data in base64url format
    if (!data.data) {
      return NextResponse.json({ error: 'Attachment data is empty' }, { status: 404 });
    }

    // Decode base64url to raw Buffer
    const base64 = data.data.replace(/-/g, '+').replace(/_/g, '/');
    const buffer = Buffer.from(base64, 'base64');

    // Return as downloadable file
    return new NextResponse(new Uint8Array(buffer) as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`,
        'Cache-Control': 'public, max-age=86400',
        'Content-Length': buffer.length.toString(),
      },
    });

  } catch (err: any) {
    console.error('[mail/attachment] error:', err);
    return NextResponse.json({ error: err.message ?? 'failed' }, { status: 500 });
  }
}
