import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getAdminFirestore();
    const tenants = await db.collection('tenants').get();
    let log = `Found ${tenants.size} tenants.\n`;

    for (const t of tenants.docs) {
      const tenantId = t.id;
      log += `Processing tenant ${tenantId}...\n`;
      
      const orgs = await db.collection(`tenants/${tenantId}/organizations`).get();
      let updated = 0;
      
      const teamsColl = await db.collection(`tenants/${tenantId}/serviceTeams`).get();
      const teams = teamsColl.docs.map((d: any) => ({ id: d.id, ...d.data() }));

      for (const org of orgs.docs) {
        const data = org.data();
        const updates: any = {};
        
        if (data.assignedRmId && !data.serviceTeamId) {
          let matchingTeam = teams.find((team: any) => 
             (team.members && team.members.some((m: any) => m.uid === data.assignedRmId))
          );
          if (matchingTeam) {
             updates.serviceTeamId = matchingTeam.id;
             updates.serviceTeamName = matchingTeam.name;
          } else {
             log += `Org ${org.id} (${data.name}) has RM ${data.assignedRmId} but no matching team found.\n`;
          }
        }
        
        if (Object.keys(updates).length > 0) {
          await org.ref.update(updates);
          log += `Updated org ${org.id} (${data.name}) with team ${updates.serviceTeamName}\n`;
          updated++;
        }
      }
      log += `Updated ${updated} organizations in tenant ${tenantId}.\n`;
    }
    return NextResponse.json({ success: true, log });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
