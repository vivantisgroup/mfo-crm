import { NextRequest, NextResponse } from 'next/server';
import { getValidMicrosoftToken } from '@/lib/microsoftTokenRefresh';
import { getValidGoogleToken } from '@/lib/googleTokenRefresh';

/**
 * PATCH /api/calendar/update
 * Unified update endpoint for MS Graph & Google Calendar.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventId, uid, idToken, provider, subject, start, end, attendees, createOnlineMeeting } = body;

    if (!eventId || !uid || !idToken || !provider || !subject || !start || !end) {
      return NextResponse.json({ error: 'Missing required scheduling fields' }, { status: 400 });
    }

    if (provider === 'microsoft') {
      const accessToken = await getValidMicrosoftToken(uid, idToken);

      const payload: any = {
        subject,
        start: { dateTime: new Date(start).toISOString(), timeZone: 'UTC' },
        end: { dateTime: new Date(end).toISOString(), timeZone: 'UTC' },
      };

      if (createOnlineMeeting !== undefined) {
         payload.isOnlineMeeting = !!createOnlineMeeting;
         if (createOnlineMeeting) {
            payload.onlineMeetingProvider = 'teamsForBusiness';
         }
      }

      if (attendees) {
        payload.attendees = attendees.map((email: string) => ({
          emailAddress: { address: email },
          type: 'required'
        }));
      }

      const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
        method: 'PATCH',
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

      if (attendees) {
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

      // PATCH keeps other existing fields intact for Google Calendar
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?conferenceDataVersion=1&sendUpdates=all`, {
        method: 'PATCH',
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
    console.error('[calendar/update]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
