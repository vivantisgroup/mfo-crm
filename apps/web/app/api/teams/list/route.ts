import { NextRequest, NextResponse } from 'next/server';
import { getGraphAppToken } from '@/lib/msGraphAppConfig';

/**
 * GET /api/teams/list
 * Fetches the tenant's Teams and associated channels via Microsoft Graph API
 * using Global Application Permissions.
 */
export async function GET(req: NextRequest) {
  let appToken = '';
  try {
    appToken = await getGraphAppToken();
  } catch (e) {
    console.warn('[teams/list] Missing or invalid Microsoft application credentials.');
  }

  try {
    let teamsRes: Response | null = null;
    let teams = [];

    if (appToken) {
      // 1. Fetch Global Teams (All groups provisioned as Teams). Requires ConsistencyLevel header for array filter!
      teamsRes = await fetch("https://graph.microsoft.com/v1.0/groups?$filter=resourceProvisioningOptions/Any(x:x eq 'Team')", {
        headers: { 
          Authorization: `Bearer ${appToken}`,
          'ConsistencyLevel': 'eventual'
        }
      });
    }
    if (!teamsRes || !teamsRes.ok) {
      const err = teamsRes ? await teamsRes.text() : 'No App Token Available';
      console.warn(`[teams/list] Failed to fetch Teams via App Token: ${err}. Falling back to mock scope.`);
      teams = [
        { id: 'mock-team-1', displayName: 'Mock Team - Architecture Sync', description: `[DEBUG] Server Error string: ${err.substring(0, 150)}` }
      ];
    } else {
      const teamsData = await teamsRes.json();
      teams = teamsData.value || [];
    }

    // 2. Map over Teams and fetch Channels for each
    const workstream = await Promise.all(teams.map(async (team: any) => {
      let channelsList = [];
      try {
        let channelsRes: Response | null = null;
        if (appToken && !team.id.startsWith('mock-')) {
          channelsRes = await fetch(`https://graph.microsoft.com/v1.0/teams/${team.id}/channels`, {
            headers: { Authorization: `Bearer ${appToken}` }
          });
        }
        
        if (channelsRes && channelsRes.ok) {
           const channelsData = await channelsRes.json();
           channelsList = channelsData.value || [];
        } else if (team.id.startsWith('mock-')) {
           channelsList = [
             { id: 'mock-channel-1', displayName: 'General', description: 'General Discussion' },
             { id: 'mock-channel-2', displayName: 'Client Onboarding', description: 'Internal sync' }
           ];
        }
      } catch (e) {
        console.warn(`Failed to fetch channels for team ${team.id}`);
      }

      return {
        id: team.id,
        displayName: team.displayName,
        description: team.description,
        channels: channelsList.map((ch: any) => ({
          id: ch.id,
          displayName: ch.displayName,
          description: ch.description,
        }))
      };
    }));

    return NextResponse.json({ teams: workstream });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
