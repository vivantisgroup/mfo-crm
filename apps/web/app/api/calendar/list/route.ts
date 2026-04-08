import { NextRequest, NextResponse } from 'next/server';
import { getValidMicrosoftToken } from '@/lib/microsoftTokenRefresh';
import { getValidGoogleToken } from '@/lib/googleTokenRefresh';

/**
 * GET /api/calendar/list
 * Unifies event fetching for Microsoft 365 and Google Workspace in a single route.
 */
export async function GET(req: NextRequest) {
  try {
    const uid = req.nextUrl.searchParams.get('uid');
    const idToken = req.nextUrl.searchParams.get('idToken');
    const provider = req.nextUrl.searchParams.get('provider'); // 'microsoft' or 'google'

    if (!uid || !idToken || !provider) {
      return NextResponse.json({ error: 'uid, idToken, and provider are required' }, { status: 400 });
    }

    if (provider === 'microsoft') {
      const accessToken = await getValidMicrosoftToken(uid, idToken);
      // Fetch upcoming events for the next month
      const startDateTime = new Date().toISOString();
      let endDateTime = new Date();
      endDateTime.setDate(endDateTime.getDate() + 30);
      
      const res = await fetch(`https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime.toISOString()}&$top=100&$orderby=start/dateTime`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!res.ok) throw new Error(`Microsoft failed: ${await res.text()}`);
      
      const data = await res.json();
      const events = (data.value || []).map((ev: any) => ({
        id: ev.id,
        title: ev.subject,
        start: new Date(ev.start.dateTime),
        end: new Date(ev.end.dateTime),
        isOnlineMeeting: ev.isOnlineMeeting,
        onlineMeetingUrl: ev.onlineMeeting?.joinUrl,
        provider: 'microsoft'
      }));

      return NextResponse.json({ events });

    } else if (provider === 'google') {
      const accessToken = await getValidGoogleToken(uid, idToken);
      const timeMin = new Date().toISOString();
      let endDateTime = new Date();
      endDateTime.setDate(endDateTime.getDate() + 30);

      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${endDateTime.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=100`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!res.ok) throw new Error(`Google failed: ${await res.text()}`);

      const data = await res.json();
      const events = (data.items || []).map((ev: any) => ({
        id: ev.id,
        title: ev.summary || 'Busy',
        start: ev.start.dateTime ? new Date(ev.start.dateTime) : new Date(ev.start.date),
        end: ev.end.dateTime ? new Date(ev.end.dateTime) : new Date(ev.end.date),
        isOnlineMeeting: !!ev.hangoutLink,
        onlineMeetingUrl: ev.hangoutLink,
        provider: 'google'
      }));

      return NextResponse.json({ events });
    } else {
       return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[calendar/list]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
