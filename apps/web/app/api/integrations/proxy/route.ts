// @ts-nocheck - force cache evict
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';

// For simplicity in this demo, initializing admin or just standard client
// In a true environment, middleware verifying auth headers is needed.
const db = getFirestore(firebaseApp);

export async function POST(req: NextRequest) {
  try {
    const { tenantId, connectorId, dynamicContext, testConnector, testVaultOverride, userRoles } = await req.json();

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    const rolesArray = Array.isArray(userRoles) ? userRoles : [];

    let conn: any;
    if (testConnector) {
      conn = testConnector;
    } else {
      if (!connectorId) {
        return NextResponse.json({ error: 'Missing connectorId' }, { status: 400 });
      }
      // Load Connector
      const connRef = doc(db, 'tenants', tenantId, 'connectors', connectorId);
      const connSnap = await getDoc(connRef);
      if (!connSnap.exists()) {
        return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
      }
      conn = connSnap.data();
    }

    // Parse Dynamic Query URL Variables
    let parsedUrl = conn.url;
    if (dynamicContext && typeof dynamicContext === 'object') {
       for (const [key, val] of Object.entries(dynamicContext)) {
          parsedUrl = parsedUrl.replace(`{{${key}}}`, String(val));
       }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Load Secrets if necessary
    let vault: any = null;
    
    if (testVaultOverride) {
       vault = testVaultOverride;
    } else if (conn.vaultId) {
      const vaultRef = doc(db, 'tenants', tenantId, 'vault', conn.vaultId);
      const vaultSnap = await getDoc(vaultRef);
      if (vaultSnap.exists()) {
        vault = vaultSnap.data();

        // RBAC Vault Enforcement
        if (vault.allowedRoles && vault.allowedRoles.length > 0) {
           const hasRole = vault.allowedRoles.some((role: string) => rolesArray.includes(role));
           if (!hasRole) {
              return NextResponse.json({ error: 'Vault Integration Error', message: 'Executing user lacks clearance' }, { status: 403 });
           }
        }
      }
    }
    
    if (vault?.type === 'bearer') {
       headers['Authorization'] = `Bearer ${vault.token}`;
    } else if (vault?.type === 'oauth2') {
       headers['Authorization'] = `Bearer ${vault.token}`; // V1 simplification for oauth2 payload
    } else if (vault?.type === 'basic') {
       headers['Authorization'] = `Basic ${Buffer.from(vault.token || '').toString('base64')}`;
    } else if (vault?.type === 'apikey') {
       headers['x-api-key'] = vault.token || '';
    } else if (vault?.type === 'custom_header') {
       headers[vault.headerName || 'x-custom-auth'] = vault.token || '';
    } else if (vault?.type === 'dynamic' && Array.isArray(vault?.arguments)) {
       for (const arg of vault.arguments) {
          if (arg.placement === 'header') {
              headers[arg.key] = arg.value;
          } else if (arg.placement === 'query') {
              const separator = parsedUrl.includes('?') ? '&' : '?';
              parsedUrl = `${parsedUrl}${separator}${encodeURIComponent(arg.key)}=${encodeURIComponent(arg.value)}`;
          }
       }
    }

    // Execute Request securely from the backend
    const response = await fetch(parsedUrl, {
      method: conn.method,
      headers
    });

    if (!response.ok) {
       return NextResponse.json({ error: `API error ${response.status}`, details: await response.text() }, { status: 502 });
    }

    const data = await response.json();

    // Map the payload path if provided
    let extractedData = data;
    if (conn.dataPath) {
      // E.g., dataPath: "items" or "[1]"
      const paths = conn.dataPath.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
      for (const p of paths) {
        if (extractedData && extractedData[p] !== undefined) {
           extractedData = extractedData[p];
        } else {
           extractedData = null;
           break;
        }
      }
    }

    // Ensure we force it into an array
    if (!Array.isArray(extractedData)) {
       extractedData = [extractedData].filter(Boolean);
    }

    // Map label and value
    const mappings = extractedData.map((item: any) => ({
      label: conn.labelField && item[conn.labelField] ? item[conn.labelField] : JSON.stringify(item),
      value: conn.valueField && item[conn.valueField] ? item[conn.valueField] : JSON.stringify(item),
      raw: item
    }));

    return NextResponse.json({ 
       success: true, 
       data: mappings,
       _debug: { parsedUrl, mappedFormatAssumed: !!conn.labelField } 
    });

  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error', message: err.message }, { status: 500 });
  }
}
