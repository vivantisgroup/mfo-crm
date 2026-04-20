import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';

const db = getFirestore(firebaseApp);

function interpolate(template: string, context: Record<string, any>): string {
  if (typeof template !== 'string') return template;
  return template.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
    const value = path.split('.').reduce((acc: any, part: string) => acc && acc[part], context);
    return value !== undefined ? String(value) : '';
  });
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId, automationId, inputs, userRoles } = await req.json();

    if (!tenantId || !automationId) {
      return NextResponse.json({ error: 'Missing tenantId or automationId' }, { status: 400 });
    }

    const rolesArray = Array.isArray(userRoles) ? userRoles : [];

    // Load Automation Flow
    const flowRef = doc(db, 'tenants', tenantId, 'automations', automationId);
    const flowSnap = await getDoc(flowRef);
    if (!flowSnap.exists()) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }
    const flow = flowSnap.data();

    // The state Context that accumulates throughout sequential steps
    const context: Record<string, any> = {
      inputs: inputs || {},
      steps: {}
    };

    // Sequential Execution Loop
    for (const step of flow.steps || []) {
      if (step.type === 'api_connector') {
        const connRef = doc(db, 'tenants', tenantId, 'connectors', step.target);
        const connSnap = await getDoc(connRef);
        if (!connSnap.exists()) {
           throw new Error(`Connector ${step.target} not found for step ${step.id}`);
        }
        const conn = connSnap.data();

        // Interpret dynamic parameters
        const evaluatedParams: Record<string, string> = {};
        if (step.params) {
          for (const [k, v] of Object.entries(step.params)) {
            evaluatedParams[k] = interpolate(v as string, context);
          }
        }

        // Parse Dynamic Query URL Variables
        let parsedUrl = conn.url;
        for (const [key, val] of Object.entries(evaluatedParams)) {
            parsedUrl = parsedUrl.replace(`{{${key}}}`, String(val));
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };

        // Load Vault Secrets
        if (conn.vaultId) {
          const vaultRef = doc(db, 'tenants', tenantId, 'vault', conn.vaultId);
          const vaultSnap = await getDoc(vaultRef);
          if (vaultSnap.exists()) {
            const vault = vaultSnap.data();
            
            // RBAC Vault Enforcement
            if (vault.allowedRoles && vault.allowedRoles.length > 0) {
               const hasRole = vault.allowedRoles.some((role: string) => rolesArray.includes(role));
               if (!hasRole) {
                  throw new Error(`Step ${step.id} blocked: Executing user lacks required clearance to utilize secure vault credential '${vault.name}'.`);
               }
            }

            if (vault.type === 'bearer') headers['Authorization'] = `Bearer ${vault.token}`;
            else if (vault.type === 'oauth2') headers['Authorization'] = `Bearer ${vault.token}`;
            else if (vault.type === 'basic') headers['Authorization'] = `Basic ${Buffer.from(vault.token).toString('base64')}`;
            else if (vault.type === 'apikey') headers['x-api-key'] = vault.token;
            else if (vault.type === 'custom_header') headers[vault.headerName || 'x-custom-auth'] = vault.token;
          }
        }

        // Execute API Request
        const response = await fetch(parsedUrl, {
          method: conn.method,
          headers
        });

        if (!response.ok) {
           throw new Error(`Step ${step.id} failed: API responded with ${response.status} - ${await response.text()}`);
        }

        const data = await response.json();
        
        // Save the result into the runtime context so subsequent steps can use {{steps.step_id.data...}}
        context.steps[step.id] = data;
      }
    }

    // Attempt to return the specific mapped output, otherwise return the entire context state
    let finalOutput = context;
    if (flow.outputKey) {
        finalOutput = flow.outputKey.split('.').reduce((acc: any, part: string) => acc && acc[part], context) || context;
    }

    return NextResponse.json({ 
       success: true, 
       data: finalOutput
    });

  } catch (err: any) {
    return NextResponse.json({ error: 'Automation Execution Error', message: err.message }, { status: 500 });
  }
}
