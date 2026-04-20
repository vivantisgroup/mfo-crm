import admin from 'firebase-admin';
// @ts-ignore
import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

const credJson = process.env.FIREBASE_ADMIN_SDK_JSON;
if (!credJson) throw new Error("No FIREBASE_ADMIN_SDK_JSON found");

let cred;
try {
  const fixed = credJson.replace(/\\\\n/g, '\\n').replace(/\r/g, '');
  cred = JSON.parse(fixed);
  if (typeof cred.private_key === 'string') {
    cred.private_key = cred.private_key.replace(/\\n/g, '\n');
  }
} catch (e) {
  console.log("Fallback base64");
  cred = JSON.parse(Buffer.from(credJson, 'base64').toString());
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(cred),
    projectId: process.env.NEXT_PUBLIC_PROJECT_ID || 'mfo-crm'
  });
}

const db = admin.firestore();

async function run() {
  const tenants = await db.collection('tenants').get();
  console.log(`Found ${tenants.size} tenants.`);

  for (const t of tenants.docs) {
    const tenantId = t.id;
    console.log(`Processing tenant ${tenantId}...`);
    
    const orgs = await db.collection(`tenants/${tenantId}/organizations`).get();
    
    let updated = 0;
    for (const org of orgs.docs) {
      const data = org.data();
      const updates: any = {};
      
      if (data.assignedRmId && !data.serviceTeamId) {
        const teamsColl = await db.collection(`tenants/${tenantId}/serviceTeams`).get();
        const teams = teamsColl.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        
        let matchingTeam = teams.find((team: any) => 
           (team.managerId === data.assignedRmId) || 
           (team.members && team.members.some((m: any) => m.uid === data.assignedRmId))
        );

        if (matchingTeam) {
           updates.serviceTeamId = matchingTeam.id;
           updates.serviceTeamName = matchingTeam.name;
        } else {
           console.log(`Org ${org.id} (${data.name}) has RM ${data.assignedRmId} but no matching team found.`);
        }
      }
      
      if (Object.keys(updates).length > 0) {
        await org.ref.update(updates);
        console.log(`Updated org ${org.id} (${data.name}) with team ${updates.serviceTeamName}`);
        updated++;
      }
    }
    console.log(`Updated ${updated} organizations in tenant ${tenantId}.`);
  }
}

run().then(() => {
  console.log('Migration complete.');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
