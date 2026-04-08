import { NextRequest, NextResponse } from 'next/server';
import { getValidMicrosoftToken } from '@/lib/microsoftTokenRefresh';
import { getValidGoogleToken } from '@/lib/googleTokenRefresh';

/**
 * POST /api/mail/folder
 * Provisions a new remote mail folder natively on the connected Microsoft Exchange or Google Workspace server.
 */
export async function POST(req: NextRequest) {
  try {
    const { uid, idToken, provider, folderName } = await req.json();

    if (!uid || !idToken || !provider || !folderName) {
      return NextResponse.json({ error: 'uid, idToken, provider, and folderName are required' }, { status: 400 });
    }

    if (provider === 'microsoft') {
      const accessToken = await getValidMicrosoftToken(uid, idToken);
      
      const res = await fetch(`https://graph.microsoft.com/v1.0/me/mailFolders`, {
        method: 'POST',
        headers: { 
           Authorization: `Bearer ${accessToken}`,
           'Content-Type': 'application/json'
        },
        body: JSON.stringify({
           displayName: folderName,
           isHidden: false
        })
      });

      if (!res.ok) throw new Error(`Microsoft Graph failed to create folder: ${await res.text()}`);
      const data = await res.json();
      return NextResponse.json({ success: true, folderId: data.id, displayName: data.displayName });

    } else if (provider === 'google') {
      const accessToken = await getValidGoogleToken(uid, idToken);

      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/labels`, {
        method: 'POST',
        headers: { 
           Authorization: `Bearer ${accessToken}`,
           'Content-Type': 'application/json'
        },
        body: JSON.stringify({
           name: folderName,
           labelListVisibility: 'labelShow',
           messageListVisibility: 'show'
        })
      });

      if (!res.ok) throw new Error(`Google Workspace failed to create label: ${await res.text()}`);
      const data = await res.json();
      return NextResponse.json({ success: true, folderId: data.id, displayName: data.name });

    } else {
       return NextResponse.json({ error: 'Unsupported provider mapped.' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[mail/folder]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
