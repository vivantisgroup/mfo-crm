import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { msTenantId, clientId, clientSecret, serviceAccountEmail, folderId, driveType, siteUrl, newFolderName } = await request.json();

    if (!msTenantId || !clientId || !clientSecret || !newFolderName) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }
    
    const safeTenantId = msTenantId.trim();
    const safeClientId = clientId.trim();
    const safeClientSecret = clientSecret.trim();

    // 1. Get Access Token via Client Credentials Flow
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${safeTenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: safeClientId,
        client_secret: safeClientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      return NextResponse.json({ error: 'Failed to authenticate with Microsoft Entra ID' }, { status: 401 });
    }

    const accessToken = tokenData.access_token;
    let graphUrl = '';
    
    // 2. Fetch Items
    if (driveType === 'site') {
       let hostname, sitePath;
       try {
          const urlObj = new URL(siteUrl);
          hostname = urlObj.hostname;
          sitePath = urlObj.pathname;
          if (sitePath.endsWith('/')) sitePath = sitePath.slice(0, -1);
       } catch (e) {
          return NextResponse.json({ error: 'Invalid SharePoint Site URL' }, { status: 400 });
       }
       
       const siteInfoRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}?$select=id`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
       });
       if (!siteInfoRes.ok) {
          return NextResponse.json({ error: 'Could not resolve SharePoint Site.' }, { status: 404 });
       }
       const siteInfo = await siteInfoRes.json();
       const siteId = siteInfo.id;
       
       if (folderId && folderId !== 'root') {
          graphUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${folderId}/children`;
       } else {
          graphUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root/children`;
       }
       
    } else {
       if (folderId && folderId !== 'root') {
         graphUrl = `https://graph.microsoft.com/v1.0/users/${serviceAccountEmail}/drive/items/${folderId}/children`;
       } else {
         graphUrl = `https://graph.microsoft.com/v1.0/users/${serviceAccountEmail}/drive/root/children`;
       }
    }

    const graphResponse = await fetch(graphUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
         name: newFolderName.trim(),
         folder: {},
         "@microsoft.graph.conflictBehavior": "rename"
      })
    });

    const graphData = await graphResponse.json();

    if (!graphResponse.ok) {
      return NextResponse.json({ error: graphData.error?.message || 'Failed to create folder in Microsoft Graph' }, { status: graphResponse.status });
    }

    const formattedItem = {
        id: graphData.id,
        name: graphData.name,
        isFolder: !!graphData.folder,
        parentPath: graphData.parentReference?.path ? decodeURIComponent(graphData.parentReference.path.replace('/drive/root:', '')) : '/',
        itemCount: graphData.folder?.childCount || 0,
        size: graphData.size || 0,
        lastModifiedDateTime: graphData.lastModifiedDateTime,
        webUrl: graphData.webUrl
    };

    return NextResponse.json({ success: true, item: formattedItem });

  } catch (error: any) {
    console.error('[API/OneDrive Explorer] Error:', error);
    return NextResponse.json({ error: 'Internal server error while creating folder' }, { status: 500 });
  }
}
