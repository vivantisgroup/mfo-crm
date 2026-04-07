'use client';

import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Users, User, Building2, Ticket, CheckSquare, Briefcase, Landmark, FileText, BadgeDollarSign, Scale, Lock, ShieldCheck, Map, Search as SearchIcon, Umbrella, Ruler, Handshake, Heart, Sprout, Pin, Building, LayoutDashboard, Share2, MessageSquare, ClipboardList, Send } from 'lucide-react';
import { ContactRelationshipGraph } from '@/components/ContactRelationshipGraph';
import { SecondaryDock } from '@/components/SecondaryDock';
import { useTaskQueue } from '@/lib/TaskQueueContext';
import { usePageTitle } from '@/lib/PageTitleContext';

interface Organization {
  id:                string;
  name:              string;
  type:              string;
  jurisdiction?:     string;
  linkedFamilyNames: string[];
  linkedContactIds:  string[];
  linkedContactNames:string[];
  linkedOrgIds?:     string[];
  linkedOrgNames?:   string[];
  status?:           string;
  notes?:            string;
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

const TYPE_LABELS: Record<string, string> = {
  family_group: 'Grupo Familiar',
  financial_institution: 'Instituição Financeira',
  accountant: 'Contador',
  tax_consultant: 'Consultor Tributário',
  lawyer: 'Advogado',
  trustee: 'Trustee',
  fiduciary_admin: 'Administrador Fiduciário',
  offshore_admin: 'Administrador Offshore',
  corporate_provider: 'Provedor Corporativo',
  auditor: 'Auditor',
  insurance_company: 'Seguradora',
  insurance_consultant: 'Consultor de Seguros',
  real_estate_admin: 'Administrador Imobiliário',
  appraiser: 'Avaliador',
  governance_consultant: 'Consultor de Governança',
  philanthropic_consultant: 'Consultor Filantrópico',
  foundation: 'Fundação',
  other: 'Outros'
};

const TYPE_COLORS: Record<string, string> = {
  family_group: '#6366f1',
  financial_institution: '#3b82f6',
  accountant: '#10b981',
  tax_consultant: '#14b8a6',
  lawyer: '#f59e0b',
  trustee: '#8b5cf6',
  fiduciary_admin: '#d946ef',
  offshore_admin: '#06b6d4',
  corporate_provider: '#64748b',
  auditor: '#71717a',
  insurance_company: '#e11d48',
  insurance_consultant: '#ec4899',
  real_estate_admin: '#f97316',
  appraiser: '#eab308',
  governance_consultant: '#0ea5e9',
  philanthropic_consultant: '#84cc16',
  foundation: '#10b981',
  other: '#64748b',
};

const TYPE_ICONS: Record<string, any> = {
  family_group: Users, 
  financial_institution: Landmark, 
  accountant: FileText, 
  tax_consultant: BadgeDollarSign, 
  lawyer: Scale,
  trustee: Lock, 
  fiduciary_admin: ShieldCheck, 
  offshore_admin: Map, 
  corporate_provider: Building2, 
  auditor: SearchIcon,
  insurance_company: Umbrella, 
  insurance_consultant: Umbrella, 
  real_estate_admin: Building, 
  appraiser: Ruler,
  governance_consultant: Handshake, 
  philanthropic_consultant: Heart, 
  foundation: Sprout, 
  other: Pin,
};

const RECORD_TYPE_TAGS: Record<string, { label: string, color: string }> = {
  'ticket': { label: '🎟 Ticket', color: '#f59e0b' },
  'task': { label: '✓ Task', color: '#10b981' },
  'lead': { label: '💼 Lead', color: '#3b82f6' },
  'opportunity': { label: '💼 Opp', color: '#6366f1' },
  'service_request': { label: '🛎 Request', color: '#ec4899' },
};

export default function OrgClientPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [org,        setOrg]        = useState<Organization | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeTab,  setActiveTab]  = useState('overview');
  const [tenantId,   setTenantId]   = useState('');

  const { setTitle, setCrumbOverrides } = usePageTitle();
  const { tasks, activeClockItem, startClock } = useTaskQueue();

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
    if (!tenantId || !id || activeTab !== 'communications') return;
    const q = query(collection(db, 'tenants', tenantId, 'activities'), where('linkedOrgId', '==', id));
    getDocs(q).then(snap => setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity))));
  }, [tenantId, id, activeTab]);

  useEffect(() => {
    if (org && setCrumbOverrides) {
      setTitle('Organization Profile');
      setCrumbOverrides({ [id]: org.name });
    }
  }, [org, id, setTitle, setCrumbOverrides]);

  if (!org) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>Loading organization…
    </div>
  );

  const color = TYPE_COLORS[org.type] ?? 'var(--text-tertiary)';

  const isClockRunningHere = activeClockItem?.id === org.id;

  const myTasks = tasks.filter(t => t.linkedOrgId === id);
  const supportTickets = myTasks.filter(t => t.taskTypeId === 'support' || t.queueId?.includes('support'));
  const regularTasks = myTasks.filter(t => t.taskTypeId !== 'support' && !t.queueId?.includes('support'));

  return (
    <div className="page animate-fade-in" style={{ width: '100%', padding: '0 24px', paddingBottom: 60 }}>
      {/* Tabs */}
      <div style={{ marginBottom: 24, paddingBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
        <SecondaryDock 
          tabs={[
            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            { id: 'members', label: 'Members', icon: Users },
            { id: 'connected_entities', label: 'Connected Entities', icon: Building2 },
            { id: 'relationships', label: 'Network Graph', icon: Share2 },
            { id: 'communications', label: 'Comms', icon: MessageSquare },
            { id: 'tasks', label: 'Tasks', icon: ClipboardList },
            { id: 'tickets', label: 'Tickets', icon: Ticket },
            { id: 'leads', label: 'Leads', icon: Briefcase }
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        
        <button 
          onClick={() => isClockRunningHere ? null : startClock({ id: org.id, type: 'org', name: org.name, title: `Collaborating with ${org.name}` })}
          disabled={isClockRunningHere}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ml-4 ${isClockRunningHere ? 'bg-indigo-100 text-indigo-500 cursor-not-allowed border border-indigo-200' : 'bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-indigo-600 hover:border-indigo-300 shadow-sm'}`}
        >
          <div className={isClockRunningHere ? 'animate-pulse' : ''}>⏱️</div>
          {isClockRunningHere ? 'Recording Time...' : 'Start Timer'}
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Type</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{TYPE_LABELS[org.type] || org.type}</div>
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

      {activeTab === 'connected_entities' && (
        <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Connected Organizations & Service Providers</span>
            <button className="btn btn-secondary btn-sm" style={{ padding: '4px 10px', fontSize: 12 }}>+ Add Connection</button>
          </div>
          {!org.linkedOrgNames?.length ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <Building2 size={32} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
              <div>No connected entities or service providers yet.</div>
            </div>
          ) : org.linkedOrgNames.map((n, i) => (
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

      {activeTab === 'communications' && (
        <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
            Communications Feed
          </div>
          {activities.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
              <div>No activities linked to this organization yet.</div>
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
              <div>No generic tasks assigned for this organization.</div>
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
              <div>No open support tickets for this organization.</div>
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
             <div>No active leads or proposals found matching this organization.</div>
          </div>
        </div>
      )}
    </div>
  );
}
