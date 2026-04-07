'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { MessageSquare, Mail, Phone, Video, FileText, Plus, Search, X, ExternalLink } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Activity {
  id:           string;
  type:         string;   // email | call | meeting | note | whatsapp
  subject:      string;
  snippet?:     string;
  fromName?:    string;
  fromEmail?:   string;
  linkedFamilyId?:   string;
  linkedFamilyName?: string;
  linkedContactId?:  string;
  linkedOrgId?:      string;
  createdAt?:   string;
  direction?:   string;
}

const TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  email:    { icon: '✉️',  label: 'Email',    color: '#6366f1' },
  call:     { icon: '📞',  label: 'Call',     color: '#10b981' },
  meeting:  { icon: '🤝',  label: 'Meeting',  color: '#f59e0b' },
  note:     { icon: '📝',  label: 'Note',     color: '#8b5cf6' },
  whatsapp: { icon: '💬',  label: 'WhatsApp', color: '#22c55e' },
};

// ─── Create activity drawer ───────────────────────────────────────────────────

function CreateActivityDrawer({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const [form, setForm] = useState({ type: 'call', subject: '', snippet: '', linkedFamilyName: '' });
  const [saving, setSaving] = useState(false);
  const valid = form.subject.trim().length > 0;

  async function handleSave() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'tenants', tenantId, 'activities'), {
        ...form,
        createdAt:  new Date().toISOString(),
        source:     'manual',
      });
      onClose();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
      <div onClick={onClose} style={{ flex: 1, background: '#00000060' }} />
      <div style={{ width: 420, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>Log Activity</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}><X size={18} /></button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Type</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(TYPE_META).map(([k, v]) => (
                <button key={k} onClick={() => setForm(p => ({ ...p, type: k }))}
                  style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: form.type === k ? `${v.color}22` : 'var(--bg-elevated)',
                    border: `1px solid ${form.type === k ? v.color : 'var(--border)'}`,
                    color: form.type === k ? v.color : 'var(--text-secondary)',
                  }}>
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Subject</label>
            <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
              placeholder="e.g. Portfolio review call…"
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-canvas)', color: 'inherit', fontSize: 13 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Notes</label>
            <textarea value={form.snippet} onChange={e => setForm(p => ({ ...p, snippet: e.target.value }))} rows={4}
              placeholder="Key points, decisions, follow-ups…"
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-canvas)', color: 'inherit', fontSize: 13, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Family (optional)</label>
            <input value={form.linkedFamilyName} onChange={e => setForm(p => ({ ...p, linkedFamilyName: e.target.value }))}
              placeholder="Family name…"
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-canvas)', color: 'inherit', fontSize: 13 }} />
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={!valid || saving}>
            {saving ? 'Saving…' : 'Log Activity'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Activity item ────────────────────────────────────────────────────────────

function ActivityCard({ a, onOpenInbox }: { a: Activity; onOpenInbox: (id: string) => void }) {
  const meta = TYPE_META[a.type] ?? TYPE_META.note;
  const date = a.createdAt ? new Date(a.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div style={{
      display: 'flex', gap: 14, padding: '16px 20px',
      background: 'var(--bg-elevated)', borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--border)', alignItems: 'flex-start',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0, fontSize: 18,
        background: `${meta.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {meta.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{a.subject}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', flexShrink: 0 }}>{date}</div>
        </div>
        {a.snippet && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.5 }}>{a.snippet}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 6, background: `${meta.color}18`, color: meta.color, fontWeight: 700 }}>
            {meta.label}
          </span>
          {a.linkedFamilyName && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>👥 {a.linkedFamilyName}</span>
          )}
          {a.fromName && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.fromName}</span>}
          {a.type === 'email' && (
            <button onClick={() => onOpenInbox(a.id)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--brand-400)', display: 'flex', alignItems: 'center', gap: 3, padding: 0 }}>
              <ExternalLink size={10} /> Open in Inbox
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TYPES = ['all', 'email', 'call', 'meeting', 'note', 'whatsapp'];

export default function ActivitiesPage() {
  const router = useRouter();
  const [activities,  setActivities]  = useState<Activity[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [typeFilter,  setTypeFilter]  = useState('all');
  const [showCreate,  setShowCreate]  = useState(false);
  const [tenantId,    setTenantId]    = useState('');

  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}');
      if (t?.id) setTenantId(t.id);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    const q = query(collection(db, 'tenants', tenantId, 'activities'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [tenantId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return activities.filter(a => {
      const matchSearch = !q || a.subject?.toLowerCase().includes(q)
        || a.snippet?.toLowerCase().includes(q)
        || a.fromName?.toLowerCase().includes(q)
        || a.linkedFamilyName?.toLowerCase().includes(q);
      const matchType = typeFilter === 'all' || a.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [activities, search, typeFilter]);

  const counts: Record<string, number> = useMemo(() => {
    const rec: Record<string, number> = { all: activities.length };
    for (const a of activities) { rec[a.type] = (rec[a.type] ?? 0) + 1; }
    return rec;
  }, [activities]);

  return (
    <div className="page animate-fade-in" style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 30, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <MessageSquare size={26} style={{ color: 'var(--brand-400)' }} /> Activities
          </h1>
          <p className="page-subtitle" style={{ marginTop: 6 }}>
            All interactions — emails, calls, meetings, notes
            {!loading && <span style={{ marginLeft: 8, padding: '2px 8px', background: 'var(--brand-500)', color: '#ffffff', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{activities.length} total</span>}
          </p>
        </div>
        <button className="btn btn-primary" style={{ gap: 8, display: 'flex', alignItems: 'center' }} onClick={() => setShowCreate(true)}>
          <Plus size={15} /> Log Activity
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search activities…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 34px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'inherit', fontSize: 13 }} />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={14} /></button>}
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', padding: 4, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          {TYPES.map(t => {
            const meta = TYPE_META[t];
            return (
              <button key={t} onClick={() => setTypeFilter(t)}
                style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                  background: typeFilter === t ? (meta?.color ?? 'var(--brand-500)') + '22' : 'transparent',
                  color: typeFilter === t ? (meta?.color ?? 'var(--brand-400)') : 'var(--text-tertiary)',
                  textTransform: 'capitalize',
                }}>
                {meta?.icon ? `${meta.icon} ` : ''}{t === 'all' ? `All (${counts.all ?? 0})` : `${meta?.label} (${counts[t] ?? 0})`}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: 90, borderRadius: 'var(--radius-xl)', background: 'var(--bg-elevated)', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
            {activities.length === 0 ? 'No activities yet' : 'No matching activities'}
          </div>
          {activities.length === 0 && (
            <div style={{ fontSize: 13, marginBottom: 20 }}>
              Activities appear here when emails are linked in the inbox, or when you log calls and meetings manually.
            </div>
          )}
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Log first activity</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(a => (
            <ActivityCard key={a.id} a={a} onOpenInbox={() => router.push('/inbox')} />
          ))}
        </div>
      )}

      {showCreate && tenantId && <CreateActivityDrawer tenantId={tenantId} onClose={() => setShowCreate(false)} />}
    </div>
  );
}
