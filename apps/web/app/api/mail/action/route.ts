/**
 * POST /api/mail/action
 *
 * Applies a Gmail label modification to one or more messages.
 * Body: { uid, idToken, messageIds: string[], action: ActionType }
 *
 * Supported actions:
 *   archive    – remove INBOX label
 *   star       – add STARRED label
 *   unstar     – remove STARRED label
 *   trash      – add TRASH, remove INBOX
 *   markRead   – remove UNREAD label
 *   markUnread – add UNREAD label
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidGoogleToken } from '@/lib/googleTokenRefresh';

const GMAIL = 'https://gmail.googleapis.com/gmail/v1';

type ActionType = 'archive' | 'star' | 'unstar' | 'trash' | 'markRead' | 'markUnread';

const ACTION_MAP: Record<ActionType, { addLabelIds?: string[]; removeLabelIds?: string[] }> = {
  archive:    { removeLabelIds: ['INBOX'] },
  star:       { addLabelIds: ['STARRED'] },
  unstar:     { removeLabelIds: ['STARRED'] },
  trash:      { addLabelIds: ['TRASH'], removeLabelIds: ['INBOX'] },
  markRead:   { removeLabelIds: ['UNREAD'] },
  markUnread: { addLabelIds: ['UNREAD'] },
};

export async function POST(req: NextRequest) {
  try {
    const { uid, idToken, messageIds, action } = await req.json() as {
      uid: string;
      idToken: string;
      messageIds: string[];
      action: ActionType;
    };

    if (!uid || !idToken || !messageIds?.length || !action) {
      return NextResponse.json({ error: 'uid, idToken, messageIds, action required' }, { status: 400 });
    }

    const labelMod = ACTION_MAP[action];
    if (!labelMod) {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const accessToken = await getValidGoogleToken(uid, idToken);

    // Apply the label modification to each message
    const results = await Promise.allSettled(
      messageIds.map(msgId =>
        fetch(`${GMAIL}/users/me/messages/${msgId}/modify`, {
          method:  'POST',
          headers: {
            Authorization:  `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(labelMod),
        })
      )
    );

    const errors = results
      .filter(r => r.status === 'rejected')
      .map((r: any) => r.reason?.message ?? 'unknown error');

    return NextResponse.json({
      ok:          errors.length === 0,
      applied:     results.length - errors.length,
      errors,
    });
  } catch (err: any) {
    console.error('[mail/action] error:', err);
    return NextResponse.json({ error: err.message ?? 'action failed' }, { status: 500 });
  }
}
