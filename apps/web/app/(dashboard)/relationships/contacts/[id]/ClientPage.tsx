'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Phone, Shield, ExternalLink, Link2, Building2, Users, MessageSquare } from 'lucide-react';
import { ContactRelationshipGraph } from '@/components/ContactRelationshipGraph';

interface Contact {
  id:               string;
  firstName:        string;
  lastName:         string;
  email?:           string;
  phone?:           string;
  role:             string;
  linkedFamilyIds:  string[];
  linkedFamilyNames:string[];
  linkedOrgIds:     string[];
  linkedOrgNames:   string[];
  pepFlag?:         boolean;
  nationality?:     string;
  notes?:           string;
  kycStatus?:       string;
}

interface Activity {
  id:          string;
  type:        string;
  subject:     string;
  snippet?:    string;
  createdAt?:  string;
  fromName?:   string;
  fromEmail?:  string;
}

const ROLE_COLORS: Record<string, string> = {
  beneficiary: 'var(--brand-500)', advisor: '#06b6d4', attorney: '#f59e0b',
  accountant: '#8b5cf6', banker: '#10b981', trustee: '#6366f1', benefactor: '#ec4899', other: 'var(--text-tertiary)',
};

function KV({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>
    </div>
  );
}

export default function ContactClientPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [contact,    setContact]    = useState<Contact | null>(null);
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
    const ref = doc(db, 'tenants', tenantId, 'contacts', id);
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) setContact({ id: snap.id, ...snap.data() } as Contact);
    });
    return () => unsub();
  }, [tenantId, id]);

  useEffect(() => {
    if (!tenantId || !id || activeTab !== 'activities') return;
    const q = query(collection(db, 'tenants', tenantId, 'activities'), where('linkedContactId', '==', id));
    getDocs(q).then(snap => setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity))));
  }, [tenantId, id, activeTab]);

  if (!contact) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>👤</div>
      <div>Loading contact…</div>
    </div>
  );

  const color    = ROLE_COLORS[contact.role] ?? 'var(--text-tertiary)';
  const initials = `${contact.firstName?.[0] ?? ''}${contact.lastName?.[0] ?? ''}`.toUpperCase();

  const TABS = ['overview', 'relationships', 'activities'];

  return (
    <div className="page animate-fade-in" style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-tertiary)' }}>
        <button onClick={() => router.push('/relationships/contacts')} className="btn btn-ghost btn-sm" style={{ gap: 4, display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={13} /> Contacts
        </button>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{contact.firstName} {contact.lastName}</span>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 24, borderBottom: '1px solid var(--border)', display: 'flex', gap: 0, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`}
            onClick={() => setActiveTab(t)}
            style={{ padding:'10px 18px', fontSize:13, background:'none', border:'none', borderBottom:`2px solid ${activeTab===t?'var(--brand-500)':'transparent'}`, cursor:'pointer', whiteSpace:'nowrap', color:activeTab===t?'var(--brand-500)':'var(--text-secondary)', textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
          <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: 'var(--text-primary)' }}>Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <KV label="Role"         value={contact.role?.charAt(0).toUpperCase() + contact.role?.slice(1)} />
              <KV label="KYC Status"   value={contact.kycStatus} />
              <KV label="Nationality"  value={contact.nationality} />
              <KV label="PEP Flag"     value={contact.pepFlag ? 'Yes — Politically Exposed Person' : 'No'} />
            </div>
            {contact.notes && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Notes</div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{contact.notes}</p>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Families */}
            <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={14} style={{ color: 'var(--brand-400)' }} /> Families
              </div>
              {contact.linkedFamilyNames?.length ? contact.linkedFamilyNames.map((f, i) => (
                <div key={i} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>👥 {f}</div>
              )) : <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No linked families</div>}
            </div>
            {/* Organizations */}
            <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Building2 size={14} style={{ color: '#8b5cf6' }} /> Organizations
              </div>
              {contact.linkedOrgNames?.length ? contact.linkedOrgNames.map((o, i) => (
                <div key={i} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>🏢 {o}</div>
              )) : <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No linked organizations</div>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'relationships' && tenantId && (
        <ContactRelationshipGraph tenantId={tenantId} focusContactId={id} />
      )}

      {activeTab === 'activities' && (
        <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
            Activity History <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 400 }}>{activities.length} items</span>
          </div>
          {activities.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
              <div>No activities linked to this contact yet.</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Link emails in the inbox to start building a history.</div>
            </div>
          ) : activities.map(a => (
            <div key={a.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18 }}>{a.type === 'email' ? '✉️' : a.type === 'call' ? '📞' : a.type === 'meeting' ? '🤝' : '📝'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{a.subject}</div>
                {a.snippet && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{a.snippet}</div>}
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  {a.fromName || a.fromEmail} · {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
