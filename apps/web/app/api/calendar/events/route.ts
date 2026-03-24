/**
 * GET /api/calendar/events
 *
 * Fetches Google Calendar events for a date range and returns them as JSON.
 * Used by the Calendar page to render live events alongside CRM data.
 *
 * Query params:
 *   uid, idToken, timeMin (ISO), timeMax (ISO), maxResults (default 100)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidGoogleToken } from '@/lib/googleTokenRefresh';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const uid      = searchParams.get('uid')     ?? '';
    const idToken  = searchParams.get('idToken') ?? '';
    const timeMin  = searchParams.get('timeMin') ?? new Date(Date.now() - 30 * 86400000).toISOString();
    const timeMax  = searchParams.get('timeMax') ?? new Date(Date.now() + 90 * 86400000).toISOString();
    const maxResults = Number(searchParams.get('maxResults') ?? '100');

    if (!uid || !idToken) {
      return NextResponse.json({ error: 'uid and idToken required' }, { status: 400 });
    }

    const accessToken = await getValidGoogleToken(uid, idToken);

    const url = new URL(`${CALENDAR_API}/calendars/primary/events`);
    url.searchParams.set('timeMin',     timeMin);
    url.searchParams.set('timeMax',     timeMax);
    url.searchParams.set('maxResults',  String(maxResults));
    url.searchParams.set('singleEvents','true');
    url.searchParams.set('orderBy',     'startTime');

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Calendar API failed: ${err}` }, { status: 502 });
    }

    const data   = await res.json();
    const events = (data.items ?? []).map((ev: any) => ({
      id:          ev.id,
      title:       ev.summary ?? '(no title)',
      description: ev.description ?? '',
      start:       ev.start?.dateTime ?? ev.start?.date ?? '',
      end:         ev.end?.dateTime   ?? ev.end?.date   ?? '',
      allDay:      !ev.start?.dateTime,
      location:    ev.location ?? '',
      attendees:   (ev.attendees ?? []).map((a: any) => ({ email: a.email, name: a.displayName ?? '', status: a.responseStatus })),
      htmlLink:    ev.htmlLink ?? '',
      status:      ev.status ?? 'confirmed',
      source:      'google_calendar',
    }));

    return NextResponse.json({ events, total: events.length });
  } catch (err: any) {
    console.error('[calendar/events] error:', err);
    return NextResponse.json({ error: err.message ?? 'fetch failed' }, { status: 500 });
  }
}
