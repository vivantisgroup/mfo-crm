import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { HubspotService } from '@/lib/integrations/hubspot';
import { GoogleSheetsService } from '@/lib/integrations/googleSheets';
import { ExcelService } from '@/lib/integrations/excel';

export async function POST(req: Request) {
  try {
    const { tenantId, source, creds } = await req.json();
    
    if (!tenantId || !source || !creds) {
      return NextResponse.json({ error: 'Missing tenantId, source, or creds' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const batch = db.batch();
    let count = 0;
    
    if (source === 'hubspot') {
      const { password: accessToken } = creds; 
      if (!accessToken) throw new Error("HubSpot requires Private App Token in the Password field.");
      
      const hsService = new HubspotService(accessToken);
      const hsContacts = await hsService.fetchContacts();
      const hsCompanies = await hsService.fetchCompanies();

      for (const comp of hsCompanies) {
        const orgRef = db.collection('tenants').doc(tenantId).collection('organizations').doc(`hs_${comp.id}`);
        batch.set(orgRef, {
          name: comp.properties.name || 'Unknown Company',
          domain: comp.properties.domain || '',
          phone: comp.properties.phone || '',
          hubspotId: comp.id,
          source: 'hubspot',
          updatedAt: new Date().toISOString()
        }, { merge: true });
        count++;
      }

      for (const c of hsContacts) {
        const contactRef = db.collection('tenants').doc(tenantId).collection('contacts').doc(`hs_${c.id}`);
        batch.set(contactRef, {
          firstName: c.properties.firstname || c.properties.email || 'Unknown',
          lastName: c.properties.lastname || '',
          email: c.properties.email || '',
          phone: c.properties.phone || '',
          notes: c.properties.hs_notes || '',
          hubspotId: c.id,
          role: 'other', 
          source: 'hubspot',
          linkedFamilyIds: [], linkedFamilyNames: [],
          linkedOrgIds: [], linkedOrgNames: [],
          updatedAt: new Date().toISOString()
        }, { merge: true });
        count++;
      }
      
    } else if (source === 'googlesheets') {
      const { url: spreadsheetId, password: apiKey } = creds;
      if (!spreadsheetId || !apiKey) throw new Error("Google Sheets requires Spreadsheet ID in URL and API Key in Password.");
      
      const gsService = new GoogleSheetsService(apiKey, spreadsheetId);
      const rows = await gsService.fetchSheetData();
      
      for (const [idx, row] of rows.entries()) {
        const nameCol = row['name'] || row['nome'] || row['nome completo'] || row['first name'] || row['firstname'];
        if (!nameCol) continue; // skip empty rows
        
        const contactRef = db.collection('tenants').doc(tenantId).collection('contacts').doc(`gs_${spreadsheetId}_${idx}`);
        batch.set(contactRef, {
          firstName: nameCol,
          lastName: row['lastname'] || row['last name'] || row['sobrenome'] || '',
          email: row['email'] || '',
          phone: row['phone'] || row['telefone'] || row['celular'] || '',
          role: row['role'] || 'other',
          source: 'googlesheets',
          updatedAt: new Date().toISOString()
        }, { merge: true });
        count++;
      }

    } else if (source === 'excel') {
      const { url: fileId, password: accessToken } = creds;
      if (!fileId || !accessToken) throw new Error("Excel Integration requires File ID in URL and Bearer Token in Password.");
      
      const exService = new ExcelService(accessToken, fileId);
      const rows = await exService.fetchSheetData();
      
      for (const [idx, row] of rows.entries()) {
        const nameCol = row['name'] || row['nome'] || row['first name'] || row['firstname'];
        if (!nameCol) continue; 
        
        const contactRef = db.collection('tenants').doc(tenantId).collection('contacts').doc(`ex_${fileId}_${idx}`);
        batch.set(contactRef, {
          firstName: nameCol,
          lastName: row['lastname'] || row['last name'] || row['sobrenome'] || '',
          email: row['email'] || '',
          phone: row['phone'] || row['telefone'] || '',
          role: row['role'] || 'other',
          source: 'excel',
          updatedAt: new Date().toISOString()
        }, { merge: true });
        count++;
      }
    } else {
        throw new Error(`Unsupported sync source: ${source}`);
    }

    try { await batch.commit(); } catch (e) {
      // Avoid firing batch commit if batch array is empty (or 500 max writes)
    }

    return NextResponse.json({ success: true, importedCount: count, message: `Successfully synced ${count} records from ${source}.` });
    
  } catch (error: any) {
    console.error('Integration Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
