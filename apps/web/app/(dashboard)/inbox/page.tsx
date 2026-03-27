'use client';

/**
 * /inbox — Full 3-pane Email Client
 *
 * Pane 1 (left)   — FolderNav: folder list + CRM labels
 * Pane 2 (center) — ThreadList: thread rows from email_logs + Gmail
 * Pane 3 (right)  — ReadingPane: full decoded thread body
 *
 * Existing backend is preserved:
 *  • /api/mail/sync  — syncs Gmail → email_logs (called from FolderNav)
 *  • /api/mail/send  — sends via Gmail API (called from Composer)
 *  • /api/mail/thread/:id — new: fetches full thread (called from ReadingPane)
 *  • /api/mail/action    — new: archive/star/trash/markRead
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  getFirestore, collection, query, orderBy, onSnapshot,
} from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';
import { getAuth } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

import { FolderNav, type FolderKey } from './components/FolderNav';
import { ThreadList, type ThreadSummary } from './components/ThreadList';
import { ReadingPane } from './components/ReadingPane';
import { Composer } from './components/Composer';
import type { GmailLabel } from '@/app/api/mail/labels/route';
import type { CrmLinkTarget } from '@/app/api/mail/link/route';

const db = getFirestore(firebaseApp);

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailLog {
  id:                string;
  subject:           string;
  fromEmail:         string;
  fromName:          string;
  toEmails:          string[];
  snippet:           string;
  direction:         'inbound' | 'outbound';
  receivedAt:        string;
  linkedFamilyId?:   string;
  linkedFamilyName?: string;
  loggedToCrm:       boolean;
  gmailMessageId?:   string;
  labelIds?:         string[];
  crmLinks?:         CrmLinkTarget[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emailLogToThread(e: EmailLog): ThreadSummary {
  const labelIds = e.labelIds ?? [];
  return {
    id:              e.id,
    gmailThreadId:   e.gmailMessageId,
    subject:         e.subject,
    fromEmail:       e.fromEmail,
    fromName:        e.fromName,
    snippet:         e.snippet,
    receivedAt:      e.receivedAt,
    direction:       e.direction,
    isUnread:        labelIds.includes('UNREAD'),
    isStarred:       labelIds.includes('STARRED'),
    linkedFamilyId:  e.linkedFamilyId,
    linkedFamilyName:e.linkedFamilyName,
    messageCount:    1,
  };
}

function filterThreads(emails: EmailLog[], folder: FolderKey): EmailLog[] {
  const labels = (e: EmailLog) => e.labelIds ?? [];
  switch (folder) {
    case 'INBOX':    return emails.filter(e => labels(e).includes('INBOX')   && !labels(e).includes('TRASH'));
    case 'SENT':     return emails.filter(e => labels(e).includes('SENT')    && !labels(e).includes('TRASH'));
    case 'STARRED':  return emails.filter(e => labels(e).includes('STARRED'));
    case 'IMPORTANT':return emails.filter(e => labels(e).includes('IMPORTANT'));
    case 'DRAFT':    return emails.filter(e => labels(e).includes('DRAFT'));
    case 'TRASH':    return emails.filter(e => labels(e).includes('TRASH'));
    case 'SPAM':     return emails.filter(e => labels(e).includes('SPAM'));
    // Legacy lower-case keys (before Gmail labels fetched)
    case 'inbox':    return emails.filter(e => e.direction === 'inbound'  && !labels(e).includes('TRASH'));
    case 'sent':     return emails.filter(e => e.direction === 'outbound' && !labels(e).includes('TRASH'));
    case 'starred':  return emails.filter(e => labels(e).includes('STARRED'));
    case 'trash':    return emails.filter(e => labels(e).includes('TRASH'));
    // CRM smart labels
    case 'unlinked': return emails.filter(e => !e.crmLinks?.length && !e.linkedFamilyId);
    case 'all':      return emails;
    // User-defined Gmail label ID (e.g. 'Label_123456')
    default:         return emails.filter(e => labels(e).includes(folder));
  }
}

// ─── Connection Banners ───────────────────────────────────────────────────────

function AlertBanner({ type, uid, returnTo }: { type: 'not_connected' | 'no_token'; uid: string; returnTo: string }) {
  const router  = useRouter();
  const [busy, setBusy] = useState(false);

  async function reconnect() {
    setBusy(true);
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      const res = await fetch('/api/oauth/google/prepare', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ idToken, uid, returnTo }),
      });
      const { authUrl } = await res.json();
      window.location.href = authUrl;
    } catch (e: any) {
      alert(e.message);
      setBusy(false);
    }
  }

  if (type === 'not_connected') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', background: '#6366f108', border: '1px solid #6366f133', borderRadius: 10, margin: '12px 16px' }}>
        <AlertTriangle size={16} color="#f59e0b" />
        <div style={{ flex: 1, fontSize: 13 }}>Gmail not connected — <span style={{ color: 'var(--text-secondary)' }}>go to Settings to connect your Google account.</span></div>
        <button className="btn btn-secondary btn-sm" style={{ fontSize: 12 }} onClick={() => router.push('/settings?section=mail')}>
          Connect →
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', background: '#f59e0b08', border: '1px solid #f59e0b33', borderRadius: 10, margin: '12px 16px' }}>
      <AlertTriangle size={16} color="#f59e0b" />
      <div style={{ flex: 1, fontSize: 13 }}>
        <strong>Gmail token expired</strong> — <span style={{ color: 'var(--text-secondary)' }}>re-connect your Google account to resume syncing.</span>
      </div>
      <button className="btn btn-secondary btn-sm" style={{ fontSize: 12 }} onClick={reconnect} disabled={busy}>
        {busy ? '⏳…' : '🔑 Re-connect'}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const { user } = useAuth();

  const [emails,         setEmails]         = useState<EmailLog[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [syncing,        setSyncing]        = useState(false);
  const [syncMsg,        setSyncMsg]        = useState<string | null>(null);
  const [folder,         setFolder]         = useState<FolderKey>('INBOX');
  const [selected,       setSelected]       = useState<ThreadSummary | undefined>();
  const [composer,       setComposer]       = useState<{ to?: string; subject?: string; replyId?: string; threadId?: string } | null>(null);
  const [connHealth,     setConnHealth]     = useState<'unknown' | 'ok' | 'no_token' | 'not_connected'>('unknown');
  const [labels,         setLabels]         = useState<GmailLabel[]>([]);
  const [labelsLoading,  setLabelsLoading]  = useState(false);
  const [tenantId,       setTenantId]       = useState('');
  const [syncCount,      setSyncCount]      = useState(50);   // messages to fetch per sync
  const [searchQuery,    setSearchQuery]    = useState('');   // client-side search filter

  // Resolve active tenant ID
  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}');
      if (t?.id) setTenantId(t.id);
    } catch { /* ignore */ }
  }, []);

  // ── Realtime email_logs listener (replaces getDocs — updates instantly) ────
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    const q    = query(collection(db, 'users', user.uid, 'email_logs'), orderBy('receivedAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEmails(snap.docs.map(d => ({ id: d.id, ...d.data() } as EmailLog)));
        setLoading(false);
      },
      (err) => {
        console.error('[inbox] email_logs snapshot error:', err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user?.uid]);

  // ── Check Google integration health + auto-sync on first mount ───────────
  const hasSyncedOnMountRef = useRef(false);
  const checkHealth = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const idToken    = await getAuth().currentUser?.getIdToken();
      if (!idToken) { setConnHealth('not_connected'); return; }
      const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID ?? 'mfo-crm';
      const res        = await fetch(
        `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${user.uid}/integrations/google`,
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
      if (res.status === 404) { setConnHealth('not_connected'); return; }
      if (!res.ok)            { setConnHealth('unknown');       return; }
      const doc    = await res.json();
      const fields = doc.fields ?? {};
      const status = fields.status?.stringValue ?? '';
      if (status !== 'connected') { setConnHealth('not_connected'); return; }
      const refreshToken = fields._refreshToken?.stringValue ?? '';
      const accessToken  = fields._accessToken?.stringValue  ?? '';
      const expiresAt    = Number(fields._expiresAt?.integerValue ?? 0);
      const ok = (refreshToken.length > 0) || (accessToken.length > 0 && expiresAt > Date.now());
      setConnHealth(ok ? 'ok' : 'no_token');
    } catch { setConnHealth('unknown'); }
  }, [user?.uid]);

  // Health check runs on mount; auto-sync triggered by connHealth effect
  useEffect(() => { checkHealth(); }, [checkHealth]);

  // ── Fetch Gmail labels ────────────────────────────────────────────────────
  const fetchLabels = useCallback(async () => {
    if (!user?.uid) return;
    setLabelsLoading(true);
    try {
      const idToken = await getAuth().currentUser?.getIdToken() ?? '';
      const params  = new URLSearchParams({ uid: user.uid, idToken });
      const res     = await fetch(`/api/mail/labels?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLabels(data.labels ?? []);
      }
    } catch (e) { console.error('[inbox] fetchLabels:', e); }
    finally { setLabelsLoading(false); }
  }, [user?.uid]);

  // Auto-sync + fetch labels on first mount when Gmail is connected
  useEffect(() => {
    if (connHealth === 'ok' && !hasSyncedOnMountRef.current) {
      hasSyncedOnMountRef.current = true;
      handleSync();
      fetchLabels();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connHealth]);

  // ── Gmail sync ─────────────────────────────────────────────────────────────
  async function handleSync(maxResults?: number) {
    if (!user?.uid || syncing) return;
    if (connHealth === 'not_connected') {
      setSyncMsg('❌ Gmail is not connected. Go to Settings → Integrations.');
      return;
    }
    const count = maxResults ?? syncCount;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      const tenant  = JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}');
      const res = await fetch('/api/mail/sync', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uid: user.uid, idToken, tenantId: tenant?.id, maxResults: count }),
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMsg(`✅ Synced ${data.newEmails} new emails (last ${count}) — ${data.newActivities} linked to CRM`);
        await checkHealth();
        await fetchLabels();
      } else {
        setSyncMsg(`❌ ${data.error}`);
        if (data.error?.includes('refresh token') || data.error?.includes('re-connect')) setConnHealth('no_token');
      }
    } catch (e: any) {
      setSyncMsg(`❌ ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }

  // ── Mail action (archive, star, trash, markRead…) ─────────────────────────
  async function handleAction(messageIds: string[], action: string) {
    if (!user?.uid) return;
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      await fetch('/api/mail/action', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uid: user.uid, idToken, messageIds, action }),
      });
      // onSnapshot listener auto-updates the email list
    } catch (e) { console.error(e); }
  }

  // ── CRM link handler ───────────────────────────────────────────────────────
  function handleLinksChange(emailLogId: string, newLinks: import('@/app/api/mail/link/route').CrmLinkTarget[]) {
    setEmails(prev => prev.map(e => e.id === emailLogId ? { ...e, crmLinks: newLinks } : e));
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const byFolder  = filterThreads(emails, folder);
  const filtered  = searchQuery.trim()
    ? byFolder.filter(e => {
        const q = searchQuery.toLowerCase();
        return e.subject?.toLowerCase().includes(q)
          || e.fromName?.toLowerCase().includes(q)
          || e.fromEmail?.toLowerCase().includes(q)
          || e.snippet?.toLowerCase().includes(q);
      })
    : byFolder;
  const threads   = filtered.map(emailLogToThread);

  // Resolve folder display name (show Gmail label name if available)
  const activeLabelName = labels.find(l => l.id === folder)?.displayName
    ?? (folder === 'unlinked' ? 'Needs Linking' : folder === 'all' ? 'All Mail' : folder);

  const counts: Partial<Record<FolderKey, number>> = {
    INBOX:    emails.filter(e => (e.labelIds ?? []).includes('INBOX')   && !(e.labelIds ?? []).includes('TRASH')).length,
    SENT:     emails.filter(e => (e.labelIds ?? []).includes('SENT')    && !(e.labelIds ?? []).includes('TRASH')).length,
    STARRED:  emails.filter(e => (e.labelIds ?? []).includes('STARRED')).length,
    TRASH:    emails.filter(e => (e.labelIds ?? []).includes('TRASH')).length,
    unlinked: emails.filter(e => !e.crmLinks?.length && !e.linkedFamilyId).length,
    all:      emails.length,
  };

  const defaultEmpty = connHealth === 'not_connected'
    ? 'Connect Gmail in Settings to start syncing.'
    : 'No emails in this folder — click Sync Gmail to fetch messages.';
  const emptyMessage = ({
    INBOX:    connHealth === 'not_connected' ? 'Connect Gmail in Settings to start syncing.' : 'Your inbox is empty — click Sync Gmail.',
    SENT:     'No sent messages yet.',
    STARRED:  'No starred emails.',
    DRAFT:    'No drafts.',
    IMPORTANT:'No important emails.',
    TRASH:    'Trash is empty.',
    SPAM:     'Spam folder is empty.',
    unlinked: 'All emails are linked to CRM. Great work! 🎉',
    all:      'No emails yet. Click Sync Gmail above.',
  } as Record<string, string>)[folder] ?? defaultEmpty;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - var(--header-height))', overflow: 'hidden' }}>

      {/* ── Pane 1: Folder nav ────────────────────────────────────────────── */}
      <FolderNav
        active={folder}
        counts={counts}
        syncing={syncing}
        labels={labels}
        labelsLoading={labelsLoading}
        syncCount={syncCount}
        onSyncCountChange={setSyncCount}
        onSelect={f => { setFolder(f); setSelected(undefined); setSearchQuery(''); }}
        onSync={() => handleSync()}
        onLoadMore={() => handleSync(syncCount * 2)}
        onCompose={() => setComposer({})}
      />

      {/* ── Center + Right wrapper ────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Banner area */}
        {connHealth === 'not_connected' && user?.uid && (
          <AlertBanner type="not_connected" uid={user.uid} returnTo="/inbox" />
        )}
        {connHealth === 'no_token' && user?.uid && (
          <AlertBanner type="no_token" uid={user.uid} returnTo="/inbox" />
        )}
        {syncMsg && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 18px', margin: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: syncMsg.startsWith('✅') ? '#22c55e12' : '#ef444412',
            color:      syncMsg.startsWith('✅') ? '#22c55e'   : '#ef4444',
            border:    `1px solid ${syncMsg.startsWith('✅') ? '#22c55e33' : '#ef444433'}`,
          }}>
            <span>{syncMsg}</span>
            <button onClick={() => setSyncMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit' }}>✕</button>
          </div>
        )}

        {/* ── Pane 2 + 3 split ───────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

          {/* Thread list */}
          <div style={{ width: 360, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Search bar + folder header */}
            <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{activeLabelName}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {searchQuery ? `${filtered.length} of ${byFolder.length}` : filtered.length} thread{filtered.length !== 1 ? 's' : ''}
                </div>
              </div>
              {/* Search input */}
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none', display: 'flex' }}>
                  🔍
                </span>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search emails…"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '7px 28px 7px 32px',
                    borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--bg-canvas)', color: 'inherit',
                    fontSize: 13, outline: 'none',
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 14, padding: 2, lineHeight: 1 }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <ThreadList
              threads={threads}
              loading={loading}
              selected={selected?.id}
              onSelect={t => setSelected(t)}
              onAction={handleAction}
              emptyMessage={searchQuery ? `No emails matching “${searchQuery}”` : emptyMessage}
            />
          </div>

          {/* Reading pane */}
          <ReadingPane
            thread={selected}
            uid={user?.uid ?? ''}
            tenantId={tenantId}
            emailLogId={selected?.id}
            initialLinks={selected ? (emails.find(e => e.id === selected.id)?.crmLinks ?? []) : []}
            onReply={(to, subject, messageId, threadId) =>
              setComposer({ to, subject, replyId: messageId, threadId })
            }
            onAction={handleAction}
            onLinksChange={handleLinksChange}
          />
        </div>
      </div>

      {/* Composer */}
      {composer !== null && (
        <Composer
          initialTo={composer.to}
          initialSubject={composer.subject}
          replyToId={composer.replyId}
          threadId={composer.threadId}
          onClose={() => setComposer(null)}
          onSent={() => { /* onSnapshot auto-refreshes the thread list */ }}
        />
      )}
    </div>
  );
}
