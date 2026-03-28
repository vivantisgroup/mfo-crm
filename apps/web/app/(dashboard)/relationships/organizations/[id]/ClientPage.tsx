'use client';

import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Users, User, Building2 } from 'lucide-react';
import { ContactRelationshipGraph } from '@/components/ContactRelationshipGraph';

interface Organization {
  id:                string;
  name:              string;
  type:              string;
  jurisdiction?:     string;
  linkedFamilyNames: string[];
  linkedContactIds:  string[];
  linkedContactNames:string[];
  status?:           string;
  notes?:            string;
}

interface Activity {
  id:         string;
  type:       string;
  subject:    string;
  snippet?:   string;
  createdAt?: string;
}

const TYPE_ICONS: Record<string, string> = {
  trust: '🔒', llc: '🏢', corporation: '🌐', foundation: '🌱',
  holding: '🏦', fund: '📊', bank: '🏦', law_firm: '⚖️', accounting_firm: '🧾', other: '🏢',
};
const TYPE_COLORS: Record<string, string> = {
  trust: '#8b5cf6', llc: '#06b6d4', corporation: '#6366f1', foundation: '#10b981',
  holding: '#f59e0b', fund: '#ec4899', bank: '#3b82f6', law_firm: '#f59e0b', other: 'var(--text-tertiary)',
};

export default function OrgClientPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [org,        setOrg]        = useState<Organization | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeTab,  setActiveTab]  = useState('overview');
  const [tenantId,   setTenantId]   = useState('');

  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}');
      if (t?.id) setTenantId(t.id);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!tenantId || !id) return;
    const ref = doc(db, 'tenants', tenantId, 'organizations', id);
    return onSnapshot(ref, snap => {
      if (snap.exists()) setOrg({ id: snap.id, ...snap.data() } as Organization);
    });
  }, [tenantId, id]);

  useEffect(() => {
    if (!tenantId || !id || activeTab !== 'activities') return;
    const q = query(collection(db, 'tenants', tenantId, 'activities'), where('linkedOrgId', '==', id));
    getDocs(q).then(snap => setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity))));
  }, [tenantId, id, activeTab]);

  if (!org) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>Loading organization…
    </div>
  );

  const color = TYPE_COLORS[org.type] ?? 'var(--text-tertiary)';
  const icon  = TYPE_ICONS[org.type] ?? '🏢';

  return (
    <div className="page animate-fade-in" style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-tertiary)' }}>
        <button onClick={() => router.push('/relationships/organizations')} className="btn btn-ghost btn-sm" style={{ gap: 4, display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={13} /> Organizations
        </button>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{org.name}</span>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 24, borderBottom: '1px solid var(--border)', display: 'flex', gap: 0, overflowX: 'auto' }}>
        {['overview', 'members', 'relationships', 'activities'].map(t => (
          <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`}
            onClick={() => setActiveTab(t)}
            style={{ padding:'10px 18px', fontSize:13, background:'none', border:'none', borderBottom:`2px solid ${activeTab===t?'var(--brand-500)':'transparent'}`, cursor:'pointer', whiteSpace:'nowrap', color:activeTab===t?'var(--brand-500)':'var(--text-secondary)', textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Type</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{org.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Jurisdiction</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{org.jurisdiction || '—'}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Status</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{org.status || 'active'}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Members</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{org.linkedContactIds?.length ?? 0}</div>
            </div>
          </div>
          {org.notes && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Notes</div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{org.notes}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'members' && (
        <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
            Contacts in this Organization
          </div>
          {!org.linkedContactNames?.length ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <User size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
              <div>No contacts linked to this organization yet.</div>
            </div>
          ) : org.linkedContactNames.map((n, i) => (
            <div key={i} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
                {n[0]?.toUpperCase()}
              </div>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{n}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'relationships' && tenantId && (
        <ContactRelationshipGraph tenantId={tenantId} focusOrgId={id} />
      )}

      {activeTab === 'activities' && (
        <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
            Activity History
          </div>
          {activities.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
              <div>No activities linked to this organization yet.</div>
            </div>
          ) : activities.map(a => (
            <div key={a.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{a.subject}</div>
              {a.snippet && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{a.snippet}</div>}
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
