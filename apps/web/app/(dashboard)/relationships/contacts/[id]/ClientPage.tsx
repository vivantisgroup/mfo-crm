'use client';

import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Users, Building2, Ticket, CheckSquare, Briefcase } from 'lucide-react';
import { ContactRelationshipGraph } from '@/components/ContactRelationshipGraph';
import { SecondaryDock } from '@/components/SecondaryDock';
import { useTaskQueue } from '@/lib/TaskQueueContext';
import { usePageTitle } from '@/lib/PageTitleContext';

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
  id:               string;
  type:             string;
  subject:          string;
  snippet?:         string;
  createdAt?:       string;
  fromName?:        string;
  fromEmail?:       string;
  linkedRecordType?:string;
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

// Map linkedRecordType to pill display
const RECORD_TYPE_TAGS: Record<string, { label: string, color: string }> = {
  'ticket': { label: '🎟 Ticket', color: '#f59e0b' },
  'task': { label: '✓ Task', color: '#10b981' },
  'lead': { label: '💼 Lead', color: '#3b82f6' },
  'opportunity': { label: '💼 Opp', color: '#6366f1' },
  'service_request': { label: '🛎 Request', color: '#ec4899' },
};

export default function ContactClientPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [contact,    setContact]    = useState<Contact | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeTab,  setActiveTab]  = useState('overview');
  const [tenantId,   setTenantId]   = useState('');
  
  const { setTitle, setCrumbOverrides } = usePageTitle();
  
  // Tasks from in-memory (mock queue)
  const { tasks, startClock, activeClockItem } = useTaskQueue();

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
    if (!tenantId || !id || activeTab !== 'communications') return;
    const q = query(collection(db, 'tenants', tenantId, 'activities'), where('linkedContactId', '==', id));
    getDocs(q).then(snap => setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity))));
  }, [tenantId, id, activeTab]);

  useEffect(() => {
    if (contact && setCrumbOverrides) {
      setTitle('Contact Profile');
      setCrumbOverrides({ [id]: `${contact.firstName} ${contact.lastName}` });
    }
  }, [contact, id, setTitle, setCrumbOverrides]);

  if (!contact) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>👤</div>
      <div>Loading contact…</div>
    </div>
  );

  const isClockRunningHere = activeClockItem?.id === contact.id;

  const myTasks = tasks.filter(t => t.linkedContactId === id);
  const supportTickets = myTasks.filter(t => t.taskTypeId === 'support' || t.queueId?.includes('support'));
  const regularTasks = myTasks.filter(t => t.taskTypeId !== 'support' && !t.queueId?.includes('support'));

  return (
    <div className="page animate-fade-in" style={{ width: '100%', padding: '0 24px', paddingBottom: 60 }}>
      {/* Tabs */}
      <div style={{ marginBottom: 24, paddingBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
        <SecondaryDock 
          tabs={[
            { id: 'overview', label: 'Overview', icon: '📋' },
            { id: 'relationships', label: 'Relationships', icon: '🔗' },
            { id: 'communications', label: 'Comms', icon: '💬' },
            { id: 'tasks', label: 'Tasks', icon: '✓' },
            { id: 'tickets', label: 'Tickets', icon: '🎟' },
            { id: 'leads', label: 'Leads', icon: '💼' }
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        
        <button 
          onClick={() => isClockRunningHere ? null : startClock({ id: contact.id, type: 'contact', name: `${contact.firstName} ${contact.lastName}`, title: `Reviewing ${contact.firstName}` })}
          disabled={isClockRunningHere}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ml-4 ${isClockRunningHere ? 'bg-indigo-100 text-indigo-500 cursor-not-allowed border border-indigo-200' : 'bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-indigo-600 hover:border-indigo-300 shadow-sm'}`}
        >
          <div className={isClockRunningHere ? 'animate-pulse' : ''}>⏱️</div>
          {isClockRunningHere ? 'Recording Time...' : 'Start Timer'}
        </button>
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

      {activeTab === 'communications' && (
        <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
            Communications Feed <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 400 }}>{activities.length} items</span>
          </div>
          {activities.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
              <div>No communications linked to this contact yet.</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Link emails in the inbox to start building a history.</div>
            </div>
          ) : activities.map(a => {
            const rt = a.linkedRecordType ? RECORD_TYPE_TAGS[a.linkedRecordType] : null;

            return (
              <div key={a.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 18 }}>{a.type === 'email' ? '✉️' : a.type === 'call' ? '📞' : a.type === 'meeting' ? '🤝' : '📝'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.subject}</div>
                    {rt && (
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: `${rt.color}15`, color: rt.color, fontWeight: 700 }}>
                        {rt.label}
                      </span>
                    )}
                  </div>
                  {a.snippet && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{a.snippet}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    {a.fromName || a.fromEmail} · {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
            Actionable Tasks
          </div>
          {regularTasks.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <CheckSquare size={32} strokeWidth={1} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
              <div>No generic tasks assigned for this contact.</div>
            </div>
          ) : regularTasks.map(t => (
            <div key={t.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
               <div style={{ fontSize: 13, fontWeight: 600 }}>{t.title}</div>
               <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Status: <span style={{ textTransform: 'capitalize' }}>{t.status}</span> · Priority: {t.priority}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'tickets' && (
        <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
            Support Tickets & Requests
          </div>
          {supportTickets.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <Ticket size={32} strokeWidth={1} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
              <div>No open support tickets for this contact.</div>
            </div>
          ) : supportTickets.map(t => (
             <div key={t.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
               <div style={{ fontSize: 13, fontWeight: 600 }}>{t.title}</div>
               <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{t.description || 'No description'}</div>
             </div>
          ))}
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
            Pipeline & Opportunities
          </div>
          {/* Mock empty state for leads since proposals rely on families mostly */}
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
             <Briefcase size={32} strokeWidth={1} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
             <div>No active leads or proposals found matching this contact.</div>
          </div>
        </div>
      )}

    </div>
  );
}
