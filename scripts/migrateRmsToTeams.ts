import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

// Run with: npx tsx scripts/migrateRmsToTeams.ts
const serviceAccount = JSON.parse(fs.readFileSync('./apps/web/serviceAccountKey.json', 'utf8'));

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

async function run() {
  const tenants = await db.collection('tenants').get();
  console.log(`Found ${tenants.size} tenants.`);

  for (const t of tenants.docs) {
    const tenantId = t.id;
    console.log(`Processing tenant ${tenantId}...`);
    
    // Process families (organizations with orgType = family or similar)
    // ClientPage uses 'organizations' collection for family profiles.
    const orgs = await db.collection(`tenants/${tenantId}/organizations`).get();
    
    let updated = 0;
    for (const org of orgs.docs) {
      const data = org.data();
      const updates: any = {};
      
      // If there's an assignedRmId but no serviceTeamId, we might want to create a default Service Team 
      // for that RM and assign it. However, if there are no teams yet, we skip or just notify.
      if (data.assignedRmId && !data.serviceTeamId) {
        // Find if a Service Team exists where this RM is the manager or member
        const teamsColl = await db.collection(`tenants/${tenantId}/service_teams`).get();
        const teams = teamsColl.docs.map(d => ({ id: d.id, ...d.data() }));
        
        let matchingTeam = teams.find(team => 
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
