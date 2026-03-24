'use client';

/**
 * /inbox — Unified Smart Inbox
 *
 * Today's view combining:
 *  • Google Calendar events (real-time)
 *  • Synced Gmail messages (from email_logs)
 *  • CRM-linked vs unlinked email detection
 *  • Inline email composer (sends via /api/mail/send)
 *  • One-click Gmail sync trigger
 *  • Proactive Google connection health check on mount
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';
import { getAuth } from 'firebase/auth';
import { useRouter } from 'next/navigation';

const db = getFirestore(firebaseApp);

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailEntry {
  id:               string;
  subject:          string;
  fromEmail:        string;
  fromName:         string;
  toEmails:         string[];
  snippet:          string;
  direction:        'inbound' | 'outbound';
  receivedAt:       string;
  linkedFamilyId?:  string;
  linkedFamilyName?:string;
  loggedToCrm:      boolean;
  gmailMessageId?:  string;
}

interface CalEvent {
  id:        string;
  title:     string;
  start:     string;
  end:       string;
  allDay:    boolean;
  attendees: { email: string; name: string; status: string }[];
  htmlLink:  string;
  location:  string;
}

type ConnectionHealth = 'unknown' | 'ok' | 'no_token' | 'not_connected';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeLabel(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function isToday(iso: string) {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
}

// ─── Re-connect Banner ────────────────────────────────────────────────────────

function ReconnectBanner({ uid, returnTo }: { uid: string; returnTo: string }) {
  const [loading, setLoading] = useState(false);

  async function handleReconnect() {
    setLoading(true);
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      if (!idToken) throw new Error('Not authenticated');
      const res = await fetch('/api/oauth/google/prepare', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ idToken, uid, returnTo }),
      });
      if (!res.ok) throw new Error(`Prepare failed: ${res.status}`);
      const { authUrl } = await res.json();
      window.location.href = authUrl;
    } catch (e: any) {
      alert(`Could not start Google OAuth: ${e.message}`);
      setLoading(false);
    }
  }

  return (
    <div style={{
      padding: '14px 18px',
      borderRadius: 12,
      marginBottom: 20,
      background: '#f59e0b12',
      border: '1px solid #f59e0b40',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#f59e0b', marginBottom: 2 }}>
          🔑 Google account needs re-authorization
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Your Gmail sync token has expired or is missing. Re-connect your Google account to resume email syncing.
        </div>
      </div>
      <button
        className="btn btn-primary btn-sm"
        style={{ fontSize: 12, whiteSpace: 'nowrap' }}
        onClick={handleReconnect}
        disabled={loading}
      >
        {loading ? '⏳ Redirecting…' : '🔑 Re-connect Google →'}
      </button>
    </div>
  );
}

// ─── Not Connected Banner ─────────────────────────────────────────────────────

function NotConnectedBanner() {
  const router = useRouter();
  return (
    <div style={{
      padding: '20px 24px',
      borderRadius: 14,
      marginBottom: 24,
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      gap: 20,
    }}>
      <div style={{ fontSize: 40, flexShrink: 0 }}>📭</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Gmail not connected</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Connect your Google Workspace account to sync emails and calendar events with the CRM.
        </div>
      </div>
      <button
        className="btn btn-primary btn-sm"
        style={{ fontSize: 13, whiteSpace: 'nowrap' }}
        onClick={() => router.push('/settings?section=mail')}
      >
        Connect Gmail →
      </button>
    </div>
  );
}

// ─── Email Composer ───────────────────────────────────────────────────────────

function Composer({
  initialTo, initialSubject, replyToId, onClose, onSent,
}: {
  initialTo?: string; initialSubject?: string; replyToId?: string;
  onClose: () => void; onSent: () => void;
}) {
  const { user } = useAuth();
  const [to,      setTo]      = useState(initialTo ?? '');
  const [subject, setSubject] = useState(initialSubject ?? '');
  const [body,    setBody]    = useState('');
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState('');

  async function handleSend() {
    if (!to || !subject || !body) { setError('Please fill all fields.'); return; }
    setSending(true);
    setError('');
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      const tenant  = JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}');
      const res = await fetch('/api/mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user?.uid, idToken,
          to, subject, body,
          tenantId: tenant?.id,
          replyToMessageId: replyToId,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      onSent();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, width: 520, zIndex: 200,
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 16, boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>✉️ {replyToId ? 'Reply' : 'New Message'}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-tertiary)' }}>✕</button>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input className="input" placeholder="To: email address" value={to} onChange={e => setTo(e.target.value)} style={{ fontSize: 13 }} />
        <input className="input" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} style={{ fontSize: 13 }} />
        <textarea
          className="input"
          placeholder="Write your message…"
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={8}
          style={{ resize: 'vertical', fontSize: 13, fontFamily: 'inherit', lineHeight: 1.6 }}
        />
        {error && <div style={{ fontSize: 12, color: '#ef4444' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSend} disabled={sending}>
            {sending ? '⏳ Sending…' : '📤 Send via Gmail'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Email Card ───────────────────────────────────────────────────────────────

function EmailCard({ email, onReply }: { email: EmailEntry; onReply: (e: EmailEntry) => void }) {
  const isLinked  = !!email.linkedFamilyId;
  const isOutbound = email.direction === 'outbound';

  return (
    <div style={{
      border: `1px solid ${isLinked ? 'var(--brand-500)33' : 'var(--border)'}`,
      borderRadius: 12,
      padding: '12px 16px',
      background: isLinked ? 'var(--brand-900)08' : 'var(--bg-surface)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>{isOutbound ? '↗' : '↙'}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {email.subject}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
              {isOutbound ? `To: ${email.toEmails[0]}` : `From: ${email.fromName || email.fromEmail}`}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {isLinked && (
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'var(--brand-500)22', color: 'var(--brand-400)', fontWeight: 700 }}>
              {email.linkedFamilyName}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{timeLabel(email.receivedAt)}</span>
        </div>
      </div>
      {email.snippet && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', paddingLeft: 24, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {email.snippet}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, paddingLeft: 24, marginTop: 2 }}>
        <button
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 11, padding: '2px 10px' }}
          onClick={() => onReply(email)}
        >
          ↩ Reply
        </button>
      </div>
    </div>
  );
}

// ─── Calendar Event Card ──────────────────────────────────────────────────────

function CalEventCard({ ev }: { ev: CalEvent }) {
  const startTime = ev.allDay ? 'All day' : timeLabel(ev.start);
  return (
    <div style={{
      border: '1px solid #3b82f633',
      borderLeft: '3px solid #3b82f6',
      borderRadius: 10,
      padding: '10px 14px',
      background: '#3b82f608',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{ev.title}</div>
        <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>{startTime}</div>
      </div>
      {ev.location && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>📍 {ev.location}</div>
      )}
      {ev.attendees.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          👥 {ev.attendees.slice(0, 3).map(a => a.name || a.email).join(', ')}
          {ev.attendees.length > 3 ? ` +${ev.attendees.length - 3}` : ''}
        </div>
      )}
      {ev.htmlLink && (
        <a href={ev.htmlLink} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, color: '#3b82f6', textDecoration: 'none', marginTop: 2 }}>
          Open in Google Calendar →
        </a>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const { user } = useAuth();

  const [emails,     setEmails]     = useState<EmailEntry[]>([]);
  const [calEvents,  setCalEvents]  = useState<CalEvent[]>([]);
  const [syncing,    setSyncing]    = useState(false);
  const [loadingCal, setLoadingCal] = useState(true);
  const [loadingMail,setLoadingMail]= useState(true);
  const [syncMsg,    setSyncMsg]    = useState<string | null>(null);
  const [composer,   setComposer]   = useState<{ to?: string; subject?: string; replyId?: string } | null>(null);
  const [tab,        setTab]        = useState<'today' | 'all' | 'unlinked'>('today');

  // Proactive connection health state
  const [connHealth, setConnHealth] = useState<ConnectionHealth>('unknown');

  // ── Check Google integration health on mount ──────────────────────────────
  const checkConnectionHealth = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      if (!idToken) { setConnHealth('not_connected'); return; }

      // Read the integration doc directly from Firestore REST
      const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID ?? 'mfo-crm';
      const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${user.uid}/integrations/google`,
        { headers: { Authorization: `Bearer ${idToken}` } },
      );

      if (res.status === 404) { setConnHealth('not_connected'); return; }
      if (!res.ok) { setConnHealth('unknown'); return; }

      const doc    = await res.json();
      const fields = doc.fields ?? {};
      const status = fields.status?.stringValue ?? '';

      if (status !== 'connected') { setConnHealth('not_connected'); return; }

      const refreshToken = fields._refreshToken?.stringValue ?? '';
      const accessToken  = fields._accessToken?.stringValue ?? '';
      const expiresAt    = Number(fields._expiresAt?.integerValue ?? 0);
      const tokenOk      = (refreshToken && refreshToken.length > 0) ||
                           (accessToken && expiresAt > Date.now());

      setConnHealth(tokenOk ? 'ok' : 'no_token');
    } catch {
      setConnHealth('unknown');
    }
  }, [user?.uid]);

  const loadEmails = useCallback(async () => {
    if (!user?.uid) return;
    setLoadingMail(true);
    try {
      const q    = query(
        collection(db, 'users', user.uid, 'email_logs'),
        orderBy('receivedAt', 'desc'),
        limit(100),
      );
      const snap = await getDocs(q);
      setEmails(snap.docs.map(d => ({ id: d.id, ...d.data() } as EmailEntry)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMail(false);
    }
  }, [user?.uid]);

  const loadCalendar = useCallback(async () => {
    if (!user?.uid) return;
    setLoadingCal(true);
    try {
      const idToken  = await getAuth().currentUser?.getIdToken();
      if (!idToken) return;
      const timeMin  = new Date(Date.now() - 7 * 86400000).toISOString();
      const timeMax  = new Date(Date.now() + 30 * 86400000).toISOString();
      const params   = new URLSearchParams({ uid: user.uid, idToken, timeMin, timeMax });
      const res      = await fetch(`/api/calendar/events?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCalEvents(data.events ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCal(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    checkConnectionHealth();
    loadEmails();
    loadCalendar();
  }, [checkConnectionHealth, loadEmails, loadCalendar]);

  async function handleSync() {
    if (!user?.uid || syncing) return;

    // If we know Google isn't connected, don't even try
    if (connHealth === 'not_connected') {
      setSyncMsg('❌ Gmail is not connected. Go to Settings → Integrations to connect your account.');
      return;
    }

    setSyncing(true);
    setSyncMsg(null);
    try {
      const idToken  = await getAuth().currentUser?.getIdToken();
      const tenant   = JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}');
      const res = await fetch('/api/mail/sync', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uid: user.uid, idToken, tenantId: tenant?.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMsg(`✅ Synced ${data.newEmails} emails, linked ${data.newActivities} to CRM`);
        await loadEmails();
        // Re-check health — token refresh may have updated the record
        await checkConnectionHealth();
      } else {
        setSyncMsg(`❌ Sync error: ${data.error}`);
        // If it's a token error, update connection health
        if (data.error?.includes('refresh token') || data.error?.includes('re-connect')) {
          setConnHealth('no_token');
        }
      }
    } catch (e: any) {
      setSyncMsg(`❌ ${e.message}`);
      if (e.message?.includes('refresh token') || e.message?.includes('re-connect')) {
        setConnHealth('no_token');
      }
    } finally {
      setSyncing(false);
    }
  }

  // Filter emails by tab
  const todayEmails    = emails.filter(e => isToday(e.receivedAt));
  const unlinkedEmails = emails.filter(e => !e.linkedFamilyId);
  const displayEmails  = tab === 'today' ? todayEmails : tab === 'unlinked' ? unlinkedEmails : emails;
  const todayEvents    = calEvents.filter(e => isToday(e.start));

  // Stats
  const linkedCount   = emails.filter(e => e.linkedFamilyId).length;
  const unlinkedCount = unlinkedEmails.length;

  return (
    <div className="page animate-fade-in" style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4, letterSpacing: '-0.02em' }}>Smart Inbox</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Gmail + Calendar unified with CRM intelligence
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleSync}
            disabled={syncing}
            style={{ fontSize: 13 }}
          >
            {syncing ? '⏳ Syncing…' : '🔄 Sync Gmail'}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setComposer({})}
            style={{ fontSize: 13 }}
          >
            ✉️ Compose
          </button>
        </div>
      </div>

      {/* ── Connection health banners (shown proactively on mount) ── */}
      {connHealth === 'not_connected' && <NotConnectedBanner />}
      {connHealth === 'no_token' && user?.uid && (
        <ReconnectBanner uid={user.uid} returnTo="/inbox" />
      )}

      {/* Sync feedback banner */}
      {syncMsg && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 13, fontWeight: 600,
          background: syncMsg.startsWith('✅') ? '#22c55e15' : '#ef444415',
          color:      syncMsg.startsWith('✅') ? '#22c55e'   : '#ef4444',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span>{syncMsg}</span>
          <button
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit', lineHeight: 1 }}
            onClick={() => setSyncMsg(null)}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Emails today',    value: todayEmails.length,   icon: '📧', color: '#6366f1' },
          { label: 'CRM-linked',      value: linkedCount,          icon: '🔗', color: '#22c55e' },
          { label: 'Needs linking',   value: unlinkedCount,        icon: '⚡', color: '#f59e0b' },
          { label: "Today's meetings",value: todayEvents.length,   icon: '📅', color: '#3b82f6' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '14px 18px',
          }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Layout grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

        {/* Left: Email feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
            {([
              { key: 'today',    label: `Today (${todayEmails.length})` },
              { key: 'all',      label: `All (${emails.length})` },
              { key: 'unlinked', label: `Unlinked (${unlinkedCount})` },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '6px 14px', fontSize: 13,
                fontWeight: tab === t.key ? 700 : 400,
                cursor: 'pointer', border: 'none', background: 'transparent',
                borderBottom: tab === t.key ? '2px solid var(--brand-500)' : '2px solid transparent',
                color: tab === t.key ? 'var(--brand-400)' : 'var(--text-secondary)',
                marginBottom: -1, transition: 'all 0.12s',
              }}>
                {t.label}
              </button>
            ))}
          </div>

          {loadingMail ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              Loading emails…
            </div>
          ) : displayEmails.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
              {tab === 'unlinked'
                ? 'All emails are linked to CRM. Great work!'
                : connHealth === 'not_connected'
                ? 'Connect Gmail in Settings to start syncing emails.'
                : 'No emails yet. Click "Sync Gmail" to fetch your messages.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {displayEmails.map(email => (
                <EmailCard
                  key={email.id}
                  email={email}
                  onReply={e => setComposer({
                    to:      e.direction === 'inbound' ? e.fromEmail : e.toEmails[0],
                    subject: e.subject.startsWith('Re:') ? e.subject : `Re: ${e.subject}`,
                    replyId: e.gmailMessageId,
                  })}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Calendar sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            📅 Today's Schedule
          </div>
          {loadingCal ? (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '12px 0' }}>Loading calendar…</div>
          ) : todayEvents.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '12px 0', textAlign: 'center' }}>
              No meetings today
            </div>
          ) : (
            todayEvents.map(ev => <CalEventCard key={ev.id} ev={ev} />)
          )}

          {/* Upcoming divider */}
          {calEvents.filter(e => !isToday(e.start) && new Date(e.start) > new Date()).slice(0, 5).length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 8 }}>
                Upcoming
              </div>
              {calEvents
                .filter(e => !isToday(e.start) && new Date(e.start) > new Date())
                .slice(0, 5)
                .map(ev => <CalEventCard key={ev.id} ev={ev} />)}
            </>
          )}
        </div>
      </div>

      {/* Email Composer */}
      {composer !== null && (
        <Composer
          initialTo={composer.to}
          initialSubject={composer.subject}
          replyToId={composer.replyId}
          onClose={() => setComposer(null)}
          onSent={loadEmails}
        />
      )}
    </div>
  );
}
