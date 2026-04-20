import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { msTenantId, clientId, clientSecret, serviceAccountEmail, folderId, driveType, siteUrl } = await request.json();

    if (!msTenantId || !clientId || !clientSecret) {
      return NextResponse.json({ error: 'Missing required Microsoft credentials.' }, { status: 400 });
    }
    
    const safeTenantId = msTenantId.trim();
    const safeClientId = clientId.trim();
    const safeClientSecret = clientSecret.trim();
    
    if (driveType === 'user' && !serviceAccountEmail) {
       return NextResponse.json({ error: 'Missing Service Account Email for User Drive query.' }, { status: 400 });
    }
    
    if (driveType === 'site' && !siteUrl) {
       return NextResponse.json({ error: 'Missing SharePoint Site URL for Site Drive query.' }, { status: 400 });
    }

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
      const maskedSecret = safeClientSecret.length > 8 ? `${safeClientSecret.substring(0, 4)}...${safeClientSecret.slice(-4)}` : '***';
      const baseErr = tokenData.error_description || tokenData.error || 'Failed to authenticate with Microsoft Entra ID';
      return NextResponse.json({ error: `${baseErr} \n[DEBUG: App ID '${safeClientId}', Secret '${maskedSecret}']` }, { status: 401 });
    }

    const accessToken = tokenData.access_token;
    let graphUrl = '';
    
    // 2. Fetch Items
    if (driveType === 'site') {
       // Extract SharePoint components
       let hostname, sitePath;
       try {
          const urlObj = new URL(siteUrl);
          hostname = urlObj.hostname;
          sitePath = urlObj.pathname;
          if (sitePath.endsWith('/')) sitePath = sitePath.slice(0, -1);
       } catch (e) {
          return NextResponse.json({ error: 'Invalid SharePoint Site URL format. Use full format like https://tenant.sharepoint.com/sites/MySite' }, { status: 400 });
       }
       
       // Resolve Site ID
       const siteInfoRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}?$select=id`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
       });
       if (!siteInfoRes.ok) {
          return NextResponse.json({ error: 'Could not resolve SharePoint Site. Verify the URL exists and the App has Sites.ReadWrite.All permission.' }, { status: 404 });
       }
       const siteInfo = await siteInfoRes.json();
       const siteId = siteInfo.id;
       
       if (folderId && folderId !== 'root') {
          graphUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${folderId}/children`;
       } else {
          graphUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root/children`;
       }
       
    } else {
       // User Drive Logic
       if (folderId && folderId !== 'root') {
         graphUrl = `https://graph.microsoft.com/v1.0/users/${serviceAccountEmail}/drive/items/${folderId}/children`;
       } else {
         graphUrl = `https://graph.microsoft.com/v1.0/users/${serviceAccountEmail}/drive/root/children`;
       }
    }

    // We remove $select because Microsoft Graph strips annotations like @microsoft.graph.downloadUrl if we use an incomplete $select
    const graphResponse = await fetch(`${graphUrl}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const graphData = await graphResponse.json();

    if (!graphResponse.ok) {
      if (graphResponse.status === 404) {
         return NextResponse.json({ error: `Service Account drive not found or folder does not exist. Ensure '${serviceAccountEmail}' is a valid user with a OneDrive provisioned.` }, { status: 404 });
      }
      return NextResponse.json({ error: graphData.error?.message || 'Failed to fetch folders from Microsoft Graph' }, { status: graphResponse.status });
    }

    // Return all items (files and folders)
    const items = (graphData.value || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        isFolder: !!item.folder,
        parentPath: item.parentReference?.path ? decodeURIComponent(item.parentReference.path.replace('/drive/root:', '')) : '/',
        itemCount: item.folder?.childCount || 0,
        size: item.size || 0,
        lastModifiedDateTime: item.lastModifiedDateTime,
        webUrl: item.webUrl,
        downloadUrl: item['@microsoft.graph.downloadUrl'] || null
    }));
    
    // Sort folders first, then files alphabetically
    items.sort((a: any, b: any) => {
       if (a.isFolder === b.isFolder) return a.name.localeCompare(b.name);
       return a.isFolder ? -1 : 1;
    });

    return NextResponse.json({ items });

  } catch (error: any) {
    console.error('[API/OneDrive Explorer] Error:', error);
    return NextResponse.json({ error: 'Internal server error while exploring OneDrive' }, { status: 500 });
  }
}
