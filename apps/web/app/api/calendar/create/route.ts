import { NextRequest, NextResponse } from 'next/server';
import { getValidMicrosoftToken } from '@/lib/microsoftTokenRefresh';
import { getValidGoogleToken } from '@/lib/googleTokenRefresh';

/**
 * POST /api/calendar/create
 * Unifies event creation for Microsoft 365 and Google Workspace in a single route.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uid, idToken, provider, subject, start, end, attendees, createOnlineMeeting } = body;

    if (!uid || !idToken || !provider || !subject || !start || !end) {
      return NextResponse.json({ error: 'Missing required schedule fields' }, { status: 400 });
    }

    if (provider === 'microsoft') {
      const accessToken = await getValidMicrosoftToken(uid, idToken);

      const payload: any = {
        subject,
        start: { dateTime: new Date(start).toISOString(), timeZone: 'UTC' },
        end: { dateTime: new Date(end).toISOString(), timeZone: 'UTC' },
        isOnlineMeeting: !!createOnlineMeeting,
      };

      if (createOnlineMeeting) {
        payload.onlineMeetingProvider = 'teamsForBusiness';
      }

      if (attendees && attendees.length > 0) {
        payload.attendees = attendees.map((email: string) => ({
          emailAddress: { address: email },
          type: 'required'
        }));
      }

      const res = await fetch(`https://graph.microsoft.com/v1.0/me/events`, {
        method: 'POST',
        headers: { 
           Authorization: `Bearer ${accessToken}`,
           'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`Microsoft failed: ${await res.text()}`);
      
      const data = await res.json();
      return NextResponse.json({ success: true, eventId: data.id, meetingUrl: data.onlineMeeting?.joinUrl });

    } else if (provider === 'google') {
      const accessToken = await getValidGoogleToken(uid, idToken);

      const payload: any = {
        summary: subject,
        start: { dateTime: new Date(start).toISOString() },
        end: { dateTime: new Date(end).toISOString() },
      };

      if (attendees && attendees.length > 0) {
        payload.attendees = attendees.map((email: string) => ({ email }));
      }

      if (createOnlineMeeting) {
        payload.conferenceData = {
          createRequest: {
             requestId: `crm-${Date.now()}`,
             conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        };
      }

      // We need to pass conferenceDataVersion=1 to generate Meet links
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`, {
        method: 'POST',
        headers: { 
           Authorization: `Bearer ${accessToken}`,
           'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`Google failed: ${await res.text()}`);

      const data = await res.json();
      return NextResponse.json({ success: true, eventId: data.id, meetingUrl: data.hangoutLink });

    } else {
       return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[calendar/create]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
