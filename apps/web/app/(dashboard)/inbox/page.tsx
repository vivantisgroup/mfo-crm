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
import { Tag, getAllTags } from '@/lib/tagService';

type CrmLinkTarget = any;

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
  provider?:         string;
  labelIds?:         string[];
  crmLinks?:         CrmLinkTarget[];
  tags?:             any[];
  hasAttachments?:   boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emailLogToThread(e: EmailLog): ThreadSummary {
  const labelIds = e.labelIds ?? [];
  let providerStr = e.provider;
  if (!providerStr) {
    if (e.id.startsWith('ms_')) providerStr = 'microsoft';
    else if (e.id.startsWith('gmail_')) providerStr = 'google';
    else providerStr = 'google';
  }
  
  return {
    id:              e.id,
    provider:        providerStr,
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
    crmLinks:        e.crmLinks || [],
    tags:            e.tags || [],
    messageCount:    1,
    hasAttachments:  e.hasAttachments || false,
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
  const { user, tenant } = useAuth();

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
  const [globalTags,     setGlobalTags]     = useState<Tag[]>([]);

  // ── Boxed UI Extensibility State ────────────────────────────────
  const [navWidth, setNavWidth] = useState(210);
  const [listWidth, setListWidth] = useState(360);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [isResizingNav, setIsResizingNav] = useState(false);
  const [isResizingList, setIsResizingList] = useState(false);

  // Drag physics
  const startResizeNav = (e: React.MouseEvent) => {
    e.preventDefault(); setIsResizingNav(true);
    const startX = e.clientX; const startW = navWidth;
    const onMove = (me: MouseEvent) => setNavWidth(Math.max(160, Math.min(320, startW + (me.clientX - startX))));
    const onUp = () => { setIsResizingNav(false); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  };
  const startResizeList = (e: React.MouseEvent) => {
    e.preventDefault(); setIsResizingList(true);
    const startX = e.clientX; const startW = listWidth;
    const onMove = (me: MouseEvent) => setListWidth(Math.max(280, Math.min(600, startW + (me.clientX - startX))));
    const onUp = () => { setIsResizingList(false); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  };

  // Fetch Tags and Tenant ID
  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}');
      if (t?.id) setTenantId(t.id);
    } catch { /* ignore */ }
    getAllTags().then(setGlobalTags).catch(console.error);
  }, []);

  // ── Realtime email_logs listener (replaces getDocs — updates instantly) ────
  useEffect(() => {
    if (!user?.uid || !tenant?.id) return;
    setLoading(true);
    const q    = query(collection(db, 'tenants', tenant.id, 'members', user.uid, 'email_logs'), orderBy('receivedAt', 'desc'));
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
  }, [user?.uid, tenant?.id]);

  // ── Check Google integration health + auto-sync on first mount ───────────
  const hasSyncedOnMountRef = useRef(false);
  const checkHealth = useCallback(async () => {
    if (!user?.uid || !tenant?.id) return;
    try {
      const idToken    = await getAuth().currentUser?.getIdToken();
      if (!idToken) { setConnHealth('not_connected'); return; }
      const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID ?? 'mfo-crm';
      const res        = await fetch(
        `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/tenants/${tenant.id}/members/${user.uid}/integrations/google`,
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
  }, [user?.uid, tenant?.id]);

  // Health check runs on mount; auto-sync triggered by connHealth effect
  useEffect(() => { checkHealth(); }, [checkHealth]);

  // ── Fetch Gmail labels ────────────────────────────────────────────────────
  const fetchLabels = useCallback(async () => {
    if (!user?.uid) return;
    setLabelsLoading(true);
    try {
      const idToken = await getAuth().currentUser?.getIdToken() ?? '';
      const params  = new URLSearchParams({ uid: user.uid, idToken, tenantId: tenant?.id || '' });
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
        body:    JSON.stringify({ uid: user.uid, idToken, tenantId: tenant?.id, messageIds, action }),
      });
      // onSnapshot listener auto-updates the email list
    } catch (e) { console.error(e); }
  }

  // ── CRM link handler ───────────────────────────────────────────────────────
  function handleLinksChange(emailLogId: string, newLinks: any[]) {
    setEmails(prev => prev.map(e => e.id === emailLogId ? { ...e, crmLinks: newLinks } : e));
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const byFolder  = filterThreads(emails, folder);
  const filtered  = searchQuery.trim()
    ? emails.filter(e => {
        const q = searchQuery.toLowerCase();
        return (e.subject || '').toLowerCase().includes(q)
          || (e.fromName || '').toLowerCase().includes(q)
          || (e.fromEmail || '').toLowerCase().includes(q)
          || (e.snippet || '').toLowerCase().includes(q);
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
    <div className="absolute inset-0 flex overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)]">

      {/* ── Pane 1: Folder nav ────────────────────────────────────────────── */}
      <FolderNav
        width={navCollapsed ? 0 : navWidth}
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
        onToggleCollapse={() => setNavCollapsed(true)}
      />

      {/* ── RESIZER 1 ── */}
      {!navCollapsed && (
        <div className="w-[12px] group relative flex items-center justify-center cursor-col-resize shrink-0 z-50 hover:bg-[var(--bg-muted)]" onMouseDown={startResizeNav}>
          <div className={`absolute inset-y-0 w-[2px] transition-all ${isResizingNav ? 'bg-[var(--brand-primary)]' : 'bg-[var(--border-strong)] group-hover:bg-[var(--brand-primary)]'}`}></div>
        </div>
      )}
      {navCollapsed && (
        <div className="w-[12px] group relative flex items-center justify-center cursor-pointer shrink-0 z-50 hover:bg-[var(--bg-muted)]" onClick={() => setNavCollapsed(false)} title="Expand Folders">
          <div className="absolute inset-y-0 w-[2px] bg-[var(--border-strong)] flex items-center justify-center">
             <div className="w-4 h-8 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full flex items-center justify-center text-[var(--text-secondary)] font-bold opacity-0 group-hover:opacity-100 transition-opacity">»</div>
          </div>
        </div>
      )}

      {/* ── Center + Right wrapper ────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Banner area */}
        {connHealth === 'not_connected' && user?.uid && tenant?.id && (
          <AlertBanner type="not_connected" uid={user.uid} returnTo="/inbox" />
        )}
        {connHealth === 'no_token' && user?.uid && tenant?.id && (
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
          <div style={{ width: listCollapsed ? 0 : listWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            {/* Search bar + folder header */}
            <div style={{ padding: '12px 14px 10px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{activeLabelName}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)' }}>
                    {searchQuery ? `${filtered.length} of ${byFolder.length}` : filtered.length}
                  </div>
                </div>
                {/* Pill Control to collapse list */}
                <button onClick={() => setListCollapsed(true)} className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)] shadow-sm border border-[var(--border-subtle)]" title="Collapse List">
                  <span style={{ fontSize: 14 }}>«</span>
                </button>
              </div>
              {/* Search input */}
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none', display: 'flex' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </span>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Terminal Search…"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '8px 28px 8px 32px',
                    borderRadius: 6, border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                    fontSize: 12, fontWeight: 500, outline: 'none',
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
            
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <ThreadList
                threads={threads}
                loading={loading}
                selected={selected?.id}
                globalTags={globalTags}
                onSelect={t => setSelected(t)}
                onAction={handleAction}
                emptyMessage={searchQuery ? `No emails matching “${searchQuery}”` : emptyMessage}
              />
            </div>
          </div>

          {/* ── RESIZER 2 ── */}
          {!listCollapsed && (
            <div className="w-[12px] group relative flex items-center justify-center cursor-col-resize shrink-0 z-50 hover:bg-[var(--bg-muted)]" onMouseDown={startResizeList}>
              <div className={`absolute inset-y-0 w-[2px] transition-all ${isResizingList ? 'bg-[var(--brand-primary)]' : 'bg-[var(--border-strong)] group-hover:bg-[var(--brand-primary)]'}`}></div>
            </div>
          )}
          {listCollapsed && (
            <div className="w-[12px] group relative flex items-center justify-center cursor-pointer shrink-0 z-50 hover:bg-[var(--bg-muted)]" onClick={() => setListCollapsed(false)} title="Expand List">
              <div className="absolute inset-y-0 w-[2px] bg-[var(--border-strong)] flex items-center justify-center">
                 <div className="w-4 h-8 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full flex items-center justify-center text-[var(--text-secondary)] font-bold opacity-0 group-hover:opacity-100 transition-opacity">»</div>
              </div>
            </div>
          )}

          {/* Reading pane */}
          <ReadingPane
            thread={threads.find(t => t.id === selected?.id) ?? selected}
            uid={user?.uid ?? ''}
            tenantId={tenant?.id}
            emailLogId={selected?.id}
            initialLinks={selected?.crmLinks ?? []}
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
