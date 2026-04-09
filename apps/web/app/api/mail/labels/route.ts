/**
 * GET /api/mail/labels
 *
 * Returns the authenticated user's full Gmail label list:
 *  - System labels (INBOX, SENT, STARRED, TRASH, SPAM, IMPORTANT, DRAFT, UNREAD)
 *  - All user-defined labels (custom folders)
 *
 * Query params: uid, idToken
 * Response: { labels: GmailLabel[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidGoogleToken } from '@/lib/googleTokenRefresh';

const GMAIL = 'https://gmail.googleapis.com/gmail/v1';

export interface GmailLabel {
  id:               string;
  name:             string;
  type:             'system' | 'user';
  messagesTotal:    number;
  messagesUnread:   number;
  // Derived
  displayName:      string;   // human-readable (e.g. "Inbox" not "INBOX")
  parent?:          string;   // label id of parent for nested labels
  depth:            number;   // nesting depth (0 = top-level)
}

// Map Gmail system label IDs to friendly names
const SYSTEM_NAMES: Record<string, string> = {
  INBOX:     'Inbox',
  SENT:      'Sent',
  STARRED:   'Starred',
  IMPORTANT: 'Important',
  TRASH:     'Trash',
  SPAM:      'Spam',
  DRAFT:     'Drafts',
  UNREAD:    'Unread',
  CATEGORY_PERSONAL:    'Personal',
  CATEGORY_SOCIAL:      'Social',
  CATEGORY_PROMOTIONS:  'Promotions',
  CATEGORY_UPDATES:     'Updates',
  CATEGORY_FORUMS:      'Forums',
};

// Ordered list for system label display
const SYSTEM_ORDER = [
  'INBOX', 'STARRED', 'IMPORTANT', 'SENT', 'DRAFT',
  'SPAM', 'TRASH',
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const uid      = searchParams.get('uid')     ?? '';
  const idToken  = searchParams.get('idToken') ?? '';
  const tenantId = searchParams.get('tenantId') ?? '';

  if (!uid || !idToken || !tenantId) {
    return NextResponse.json({ error: 'uid, idToken, and tenantId required' }, { status: 400 });
  }

  try {
    const accessToken = await getValidGoogleToken(tenantId, uid, idToken);

    const res = await fetch(
      `${GMAIL}/users/me/labels?fields=labels(id,name,type,messagesUnread,messagesTotal)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Gmail labels failed: ${err}` }, { status: 502 });
    }

    const data   = await res.json();
    const raw: Array<{ id: string; name: string; type: string; messagesUnread?: number; messagesTotal?: number }> =
      data.labels ?? [];

    // Separate system vs user labels
    const system = raw
      .filter(l => l.type === 'system' && SYSTEM_NAMES[l.id])
      .sort((a, b) => {
        const ai = SYSTEM_ORDER.indexOf(a.id);
        const bi = SYSTEM_ORDER.indexOf(b.id);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });

    const user = raw
      .filter(l => l.type === 'user')
      .sort((a, b) => a.name.localeCompare(b.name));

    const toLabel = (l: typeof raw[0]): GmailLabel => {
      const parts = l.name.split('/');
      return {
        id:             l.id,
        name:           l.name,
        type:           l.type as 'system' | 'user',
        messagesTotal:  l.messagesTotal  ?? 0,
        messagesUnread: l.messagesUnread ?? 0,
        displayName:    SYSTEM_NAMES[l.id] ?? parts[parts.length - 1],
        parent:         parts.length > 1 ? parts.slice(0, -1).join('/') : undefined,
        depth:          parts.length - 1,
      };
    };

    const labels: GmailLabel[] = [
      ...system.map(toLabel),
      ...user.map(toLabel),
    ];

    return NextResponse.json({ labels });
  } catch (err: any) {
    console.error('[mail/labels] error:', err);
    return NextResponse.json({ error: err.message ?? 'Failed to fetch labels' }, { status: 500 });
  }
}
