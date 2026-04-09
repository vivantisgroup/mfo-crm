'use client';

import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Users, User, Building2, Ticket, CheckSquare, Briefcase, Landmark, FileText, BadgeDollarSign, Scale, Lock, ShieldCheck, Map, Search as SearchIcon, Umbrella, Ruler, Handshake, Heart, Sprout, Pin, Building, LayoutDashboard, Share2, MessageSquare, ClipboardList, Send, Folder } from 'lucide-react';
import { ContactRelationshipGraph } from '@/components/ContactRelationshipGraph';
import { SecondaryDock } from '@/components/SecondaryDock';
import { DocumentVault } from '@/components/DocumentVault';
import { useTaskQueue } from '@/lib/TaskQueueContext';
import { usePageTitle } from '@/lib/PageTitleContext';
import { addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { uploadAttachment } from '@/lib/attachmentService';
import { ProfileBanner } from '@/components/ProfileBanner';

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
  avatarUrl?:        string;
  bannerUrl?:        string;
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

import { CommunicationPanel } from '@/components/CommunicationPanel';

export default function OrgClientPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [org,        setOrg]        = useState<Organization | null>(null);
  const [activeTab,  setActiveTab]  = useState('overview');
  const [tenantId,   setTenantId]   = useState('');
  const [hiddenTabs, setHiddenTabs] = useState<string[]>([]);
  const [showTaskModal, setShowTaskModal] = useState<'task'|'support'|null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [showLinkModal, setShowLinkModal] = useState<'contact'|'organization'|null>(null);
  const [availableContacts, setAvailableContacts] = useState<any[]>([]);
  const [availableOrgs, setAvailableOrgs] = useState<any[]>([]);
  const [linkSelectedId, setLinkSelectedId] = useState('');
  
  const { user } = useAuth();

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
    const unsub1 = onSnapshot(ref, snap => {
      if (snap.exists()) setOrg({ id: snap.id, ...snap.data() } as Organization);
    });
    
    // Fetch settings to hide specific tabs dynamically
    const settingsRef = doc(db, 'tenants', tenantId, 'settings', 'org_profile');
    const unsub2 = onSnapshot(settingsRef, snap => {
       if (snap.exists() && snap.data().hiddenTabs) {
          setHiddenTabs(snap.data().hiddenTabs);
       } else {
          setHiddenTabs([]);
       }
    });

    return () => { unsub1(); unsub2(); };
  }, [tenantId, id]);

  useEffect(() => {
    if (org && setCrumbOverrides) {
      setTitle('Organization Profile');
      setCrumbOverrides({ [id]: org.name });
    }
  }, [org, id, setTitle, setCrumbOverrides]);

  useEffect(() => {
    if (!tenantId || !showLinkModal) return;
    if (showLinkModal === 'contact' && availableContacts.length === 0) {
      getDocs(collection(db, 'tenants', tenantId, 'contacts')).then(snap => {
         setAvailableContacts(snap.docs.map(d => ({ id: d.id, ...d.data() as any })).sort((a,b)=>((a.firstName || a.name || '').localeCompare(b.firstName || b.name || ''))));
      });
    }
    if (showLinkModal === 'organization' && availableOrgs.length === 0) {
      getDocs(collection(db, 'tenants', tenantId, 'organizations')).then(snap => {
         setAvailableOrgs(snap.docs.map(d => ({ id: d.id, ...d.data() as any })).sort((a,b)=>((a.name || '').localeCompare(b.name || ''))));
      });
    }
  }, [showLinkModal, tenantId, availableContacts.length, availableOrgs.length]);

  const commitLink = async () => {
    if (!linkSelectedId || !tenantId || !id || !org) return;
    try {
      const orgRef = doc(db, 'tenants', tenantId, 'organizations', id);
      
      if (showLinkModal === 'contact') {
         const c = availableContacts.find(x => x.id === linkSelectedId);
         if (!c) return;
         if ((org.linkedContactIds || []).includes(c.id)) { alert('Contact already linked'); return; }
         const cRef = doc(db, 'tenants', tenantId, 'contacts', c.id);
         const cName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.name || 'Unknown Contact';
         
         await updateDoc(orgRef, {
            linkedContactIds: [...(org.linkedContactIds || []), c.id],
            linkedContactNames: [...(org.linkedContactNames || []), cName]
         });
         await updateDoc(cRef, {
            linkedOrgIds: [...(c.linkedOrgIds || []), org.id],
            linkedOrgNames: [...(c.linkedOrgNames || []), org.name]
         });
      } else {
         const o = availableOrgs.find(x => x.id === linkSelectedId);
         if (!o) return;
         if ((org.linkedOrgIds || []).includes(o.id)) { alert('Organization already connected'); return; }
         const oRef = doc(db, 'tenants', tenantId, 'organizations', o.id);
         
         await updateDoc(orgRef, {
            linkedOrgIds:  [...(org.linkedOrgIds || []), o.id],
            linkedOrgNames: [...(org.linkedOrgNames || []), o.name]
         });
         await updateDoc(oRef, {
            linkedOrgIds: [...(o.linkedOrgIds || []), org.id],
            linkedOrgNames: [...(o.linkedOrgNames || []), org.name]
         });
      }
      setShowLinkModal(null);
      setLinkSelectedId('');
    } catch (e) {
      console.error(e);
      alert('Failed to establish connection.');
    }
  };



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

  const handleAvatarUpload = async (file: File) => {
    if (!tenantId || !id) return;
    const { url } = await uploadAttachment(tenantId, file);
    await updateDoc(doc(db, 'tenants', tenantId, 'organizations', id), { avatarUrl: url });
  };

  const handleBannerUpload = async (file: File) => {
    if (!tenantId || !id) return;
    const { url } = await uploadAttachment(tenantId, file);
    await updateDoc(doc(db, 'tenants', tenantId, 'organizations', id), { bannerUrl: url });
  };

  return (
    <div className="page animate-fade-in" style={{ width: '100%', padding: '0 24px', paddingBottom: 60 }}>
      {/* LinkedIn-Style Entity Header */}
      <ProfileBanner 
        title={org.name}
        subtitle={TYPE_LABELS[org.type] || org.type}
        avatarUrl={org.avatarUrl || (org as any).logoUrl}
        bannerUrl={org.bannerUrl}
        onAvatarUpload={handleAvatarUpload}
        onBannerUpload={handleBannerUpload}
      />
      
      {/* Secondary Ribbon Action Details */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-3 mb-6 shadow-sm">
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type:</span>
            <span className="text-xs font-semibold text-slate-700">{TYPE_LABELS[org.type] || org.type}</span>
          </div>
          <div className="h-4 w-px bg-slate-200 shrink-0" />
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status:</span>
            <span className={`text-xs font-semibold ${org.status === 'active' ? 'text-emerald-600' : 'text-slate-600'} capitalize`}>{org.status || 'active'}</span>
          </div>
          <div className="h-4 w-px bg-slate-200 shrink-0" />
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Members:</span>
            <span className="text-xs font-semibold text-slate-700">{org.linkedContactIds?.length ?? 0}</span>
          </div>
        </div>
        
        <button 
          onClick={() => isClockRunningHere ? null : startClock({ id: org.id, type: 'org', name: org.name, title: `Collaborating with ${org.name}` })}
          disabled={isClockRunningHere}
          className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ml-4 ${isClockRunningHere ? 'bg-indigo-100 text-indigo-500 cursor-not-allowed border border-indigo-200' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 hover:bg-white shadow-sm'}`}
        >
          <div className={isClockRunningHere ? 'animate-pulse' : ''}>⏱️</div>
          {isClockRunningHere ? 'Recording Time...' : 'Start Timer'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 24, paddingBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
        <SecondaryDock 
          tabs={[
            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            { id: 'members', label: 'Members', icon: Users },
            { id: 'connected_entities', label: 'Connected Entities', icon: Building2 },
            { id: 'relationships', label: 'Network Graph', icon: Share2 },
            { id: 'files', label: 'Files', icon: Folder },
            { id: 'communications', label: 'Comms', icon: MessageSquare },
            { id: 'tasks', label: 'Tasks', icon: ClipboardList },
            { id: 'tickets', label: 'Tickets', icon: Ticket },
            { id: 'leads', label: 'Leads (Pipeline)', icon: Briefcase }
          ].filter(t => !hiddenTabs.includes(t.id))}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {activeTab === 'overview' && (
        <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 24 }}>
          {org.notes ? (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Notes</div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{org.notes}</p>
            </div>
          ) : (
             <div className="text-center text-sm text-slate-400 py-10">No specific notes available for this organization.</div>
          )}
        </div>
      )}

      {activeTab === 'members' && (
        <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Contacts in this Organization</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowLinkModal('contact')} style={{ padding: '4px 10px', fontSize: 12 }}>+ Link Contact</button>
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
            <button className="btn btn-secondary btn-sm" onClick={() => setShowLinkModal('organization')} style={{ padding: '4px 10px', fontSize: 12 }}>+ Add Connection</button>
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
        <div style={{ height: '600px' }}>
           <CommunicationPanel orgId={id} />
        </div>
      )}

      {activeTab === 'files' && (
        <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card overflow-hidden h-[600px] flex flex-col" style={{ padding: 0 }}>
           <DocumentVault />
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Actionable Tasks</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowTaskModal('task')} style={{ padding: '4px 10px', fontSize: 12 }}>+ Add Task</button>
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
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Support Tickets & Requests</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowTaskModal('support')} style={{ padding: '4px 10px', fontSize: 12 }}>+ Open Ticket</button>
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
            Pipeline & Opportunities (Legacy View)
          </div>
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
             <Briefcase size={32} strokeWidth={1} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
             <div>This tab is preserved for specific verticals tracking explicit pipeline states within the Org. Use the global Deals module for kanban pipelines.</div>
          </div>
        </div>
      )}

      {/* Task Creation Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden">
             <div className="p-4 border-b border-slate-100 font-bold text-slate-800">
                {showTaskModal === 'task' ? 'Create New Task' : 'Open Support Ticket'}
             </div>
             <div className="p-6 space-y-4">
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Title</label>
                   <input autoFocus className="input w-full" value={newTaskTitle} onChange={e=>setNewTaskTitle(e.target.value)} placeholder="e.g., Review compliance documents..." />
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description / Notes</label>
                   <textarea rows={3} className="input w-full" value={newTaskDesc} onChange={e=>setNewTaskDesc(e.target.value)} placeholder="..." />
                </div>
             </div>
             <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                <button className="btn btn-ghost" onClick={() => setShowTaskModal(null)}>Cancel</button>
                <button className="btn btn-primary" disabled={!newTaskTitle.trim()} onClick={async () => {
                   if (!newTaskTitle.trim() || !tenantId) return;
                   try {
                     await addDoc(collection(db, 'tenants', tenantId, 'tasks'), {
                        familyId: '', familyName: '',
                        linkedOrgId: id,
                        title: newTaskTitle,
                        description: newTaskDesc,
                        status: 'open',
                        priority: 'normal',
                        source: 'manual',
                        tags: [],
                        taskTypeId: showTaskModal === 'support' ? 'support' : 'other',
                        queueId: showTaskModal === 'support' ? 'support_tier_1' : '',
                        createdAt: new Date().toISOString()
                     });
                     setShowTaskModal(null);
                     setNewTaskTitle('');
                     setNewTaskDesc('');
                   } catch (err) {
                     console.error('Failed to create task/ticket', err);
                     alert('Action failed.');
                   }
                }}>
                   {showTaskModal === 'task' ? 'Create Task' : 'Submit Ticket'}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Link Entity Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
             <div className="p-4 border-b border-slate-100 font-bold text-slate-800 flex items-center gap-2">
                {showLinkModal === 'contact' ? <User size={18} className="text-emerald-500" /> : <Building2 size={18} className="text-indigo-500" />}
                {showLinkModal === 'contact' ? 'Link Existing Contact' : 'Connect Organization'}
             </div>
             <div className="p-6 space-y-4">
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                     Select {showLinkModal === 'contact' ? 'Contact' : 'Organization'}
                   </label>
                   <select 
                     className="input w-full" 
                     value={linkSelectedId} 
                     onChange={e => setLinkSelectedId(e.target.value)}
                   >
                     <option value="">-- Choose from database --</option>
                     {showLinkModal === 'contact' ? (
                       availableContacts.map(c => (
                         <option key={c.id} value={c.id} disabled={(org.linkedContactIds || []).includes(c.id)}>
                           {`${c.firstName || ''} ${c.lastName || ''}`.trim() || c.name || 'Unknown'} {(org.linkedContactIds || []).includes(c.id) ? '(Already Linked)' : ''}
                         </option>
                       ))
                     ) : (
                       availableOrgs.map(o => (
                         <option key={o.id} value={o.id} disabled={o.id === org.id || (org.linkedOrgIds || []).includes(o.id)}>
                           {o.name || 'Unknown'} {o.id === org.id ? '(This Org)' : (org.linkedOrgIds || []).includes(o.id) ? '(Already Linked)' : ''}
                         </option>
                       ))
                     )}
                   </select>
                </div>
             </div>
             <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                <button className="btn btn-ghost" onClick={() => setShowLinkModal(null)}>Cancel</button>
                <button className="btn btn-primary" disabled={!linkSelectedId} onClick={commitLink}>
                   Establish Link
                </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}
