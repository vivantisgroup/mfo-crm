'use client';

/**
 * CommunicationPanel
 *
 * Displays real email threads linked to a family/contact/org,
 * using activities from tenants/{tenantId}/activities + email_logs from users/{uid}/email_logs.
 *
 * Replaces the stub CommunicationPanel that previously had no real data.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { Mail, ExternalLink, Phone, MessageSquare, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ActivityThread {
  id:         string;
  type:       string;
  subject:    string;
  snippet?:   string;
  fromName?:  string;
  fromEmail?: string;
  createdAt?: string;
  direction?: string;
}

interface CommunicationPanelProps {
  familyId?:        string;
  familyName?:      string;
  contactId?:       string;
  orgId?:           string;
  linkedRecordType?: string;
  linkedRecordId?:  string;
}

const TYPE_META: Record<string, { icon: string; color: string; label: string }> = {
  email:    { icon: '✉️',  color: '#6366f1', label: 'Email' },
  call:     { icon: '📞',  color: '#10b981', label: 'Call' },
  meeting:  { icon: '🤝',  color: '#f59e0b', label: 'Meeting' },
  note:     { icon: '📝',  color: '#8b5cf6', label: 'Note' },
  whatsapp: { icon: '💬',  color: '#22c55e', label: 'WhatsApp' },
};

export function CommunicationPanel({ familyId, familyName, contactId, orgId }: CommunicationPanelProps) {
  const { user, tenant }    = useAuth();
  const router              = useRouter();
  const [threads,  setThreads]  = useState<ActivityThread[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<ActivityThread | null>(null);
  // tenant is provided by useAuth

  const loadThreads = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const constraints: any[] = [];
      if (familyId) constraints.push(where('linkedFamilyId', '==', familyId));
      else if (contactId) constraints.push(where('linkedContactId', '==', contactId));
      else if (orgId) constraints.push(where('linkedOrgId', '==', orgId));

      let snap;
      try {
        const qIndexed = query(collection(db, 'tenants', tenant.id, 'activities'), ...constraints, orderBy('createdAt', 'desc'), limit(50));
        snap = await getDocs(qIndexed);
      } catch (err: any) {
        if (err.message && err.message.includes('requires an index')) {
          console.warn('Missing composite index for activities. Falling back to in-memory sort.');
          const qFallback = query(collection(db, 'tenants', tenant.id, 'activities'), ...constraints);
          snap = await getDocs(qFallback);
        } else {
          throw err;
        }
      }

      let results = snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityThread));
      
      // Enforce sort and limit manually if we hit the fallback (or just unconditionally to be safe)
      results = results.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 50);

      setThreads(results);
    } catch (e) {
      console.error('[CommunicationPanel]', e);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, familyId, contactId, orgId]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  const formatDate = (s?: string) =>
    s ? new Date(s).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 400, border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>

      {/* Thread list */}
      <div style={{ width: 300, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>
            {familyName ? `${familyName}` : 'Communications'}
            {!loading && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>{threads.length}</span>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={loadThreads} title="Refresh" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}>
              <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            <button onClick={() => router.push('/inbox')} title="Open full inbox" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--brand-400)' }}>
              <ExternalLink size={13} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: 68, margin: 8, borderRadius: 8, background: 'var(--bg-elevated)', animation: 'pulse 1.5s infinite' }} />
            ))
          ) : threads.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔇</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>No communications yet</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Link emails in the inbox to start.</div>
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 12, fontSize: 11 }} onClick={() => router.push('/inbox')}>
                Open Inbox ↗
              </button>
            </div>
          ) : threads.map(t => {
            const meta = TYPE_META[t.type] ?? TYPE_META.note;
            const active = selected?.id === t.id;
            return (
              <div key={t.id} onClick={() => setSelected(t)}
                style={{
                  padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                  background: active ? `${meta.color}11` : 'transparent',
                  borderLeft: active ? `3px solid ${meta.color}` : '3px solid transparent',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 13 }}>{meta.icon}</span>
                  <span style={{ fontWeight: active ? 700 : 600, fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                    {t.subject}
                  </span>
                </div>
                {t.snippet && (
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                    {t.snippet}
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t.fromName || t.fromEmail}</span>
                  <span>{formatDate(t.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail pane */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: 'var(--text-tertiary)' }}>
            <Mail size={36} style={{ opacity: 0.3 }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>Select a communication</div>
          </div>
        ) : (
          <>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{selected.subject}</div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                {selected.fromName && <span>From: {selected.fromName}</span>}
                {selected.fromEmail && <span>{selected.fromEmail}</span>}
                <span>{formatDate(selected.createdAt)}</span>
              </div>
              {selected.type === 'email' && (
                <button onClick={() => router.push('/inbox')} className="btn btn-secondary btn-sm"
                  style={{ marginTop: 10, fontSize: 11, gap: 5, display: 'flex', alignItems: 'center' }}>
                  <ExternalLink size={11} /> Open thread in Inbox
                </button>
              )}
            </div>
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>
                {selected.snippet || 'No content preview available.'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
