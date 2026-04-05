'use client';

import { Search } from 'lucide-react';
import React, { useState, useMemo, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CommunicationPanel } from '@/components/CommunicationPanel';
import { usePageTitle } from '@/lib/PageTitleContext';

// ─── Types ────────────────────────────────────────────────────────────────────

import { TicketStatus, TicketPriority, TicketCategory, TicketTeam, Ticket, createTicket, updateTicket, addActivity } from '@/lib/supportService';
import { getEmployees, Employee } from '@/lib/hrService';
import { getAllContacts, type PlatformContact } from '@/lib/crmService';
import { uploadMultipleAttachments } from '@/lib/attachmentService';
import { Paperclip, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { getAllSubscriptions, TenantSubscription } from '@/lib/subscriptionService';

type TicketQueue = 'unassigned' | 'my_tickets' | 'pending_client' | 'escalated' | 'all';

// ─── Mock Data ────────────────────────────────────────────────────────────────

// Tickets will be fetched from Firestore

const STATUS_COLORS: Record<TicketStatus, string> = {
  open: '#6366f1', in_progress: '#f59e0b', waiting_client: '#22d3ee',
  resolved: '#22c55e', closed: '#64748b'
};

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: '#64748b', normal: '#6366f1', high: '#f59e0b', critical: '#ef4444'
};
const PRIORITY_ICONS: Record<TicketPriority, string> = { low: '○', normal: '●', high: '▲', critical: '⚡' };

const TEAM_COLORS: Record<TicketTeam, string> = {
  support: '#22d3ee', engineering: '#6366f1', operations: '#f59e0b', compliance: '#22c55e'
};

function StatusBadge({ status }: { status: TicketStatus }) {
  const color = STATUS_COLORS[status];
  const label = status.replace('_', ' ');
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: `${color}22`, color, border: `1px solid ${color}44`, textTransform: 'capitalize' }}>{label}</span>;
}

// ─── Ticket Detail View (Main Area) ──────────────────────────────────────────

function TicketDetailView({ ticket, employees, onBack, onEdit }: { ticket: Ticket; employees: Employee[]; onBack: () => void; onEdit: () => void }) {
  const [isDescCollapsed, setIsDescCollapsed] = useState(false);
  
  const handleResolve = async () => {
    await updateTicket(ticket.id, { status: 'resolved' });
    await addActivity(ticket.id, { type: 'system', title: 'Ticket marked as resolved' });
  };

  const handleReopen = async () => {
    await updateTicket(ticket.id, { status: 'open' });
    await addActivity(ticket.id, { type: 'system', title: 'Ticket reopened' });
  };
  
  const handleUnassign = async () => {
    await updateTicket(ticket.id, { assignedTo: null });
  };
  const { setTitle } = usePageTitle();
  
  useEffect(() => {
    setTitle('Support Center', '', [
      { label: 'Support Center', onClick: onBack },
      { label: 'All Tickets', onClick: onBack },
      { label: ticket.id }
    ]);
    return () => {
      setTitle('Support Center', '', []);
    };
  }, [ticket.id, onBack, setTitle]);

  return (
    <div className="animate-fade-in" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: 'calc(100vh - 150px)', overflow: 'hidden' }}>
        
        {/* Support Header Full Block */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column', padding: '24px 28px', gap: 24 }}>
           
           {/* Row 1: Title and Attributes */}
           <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>
             
             {/* Left Column: Title & Controls */}
             <div style={{ flex: '0 0 340px', display: 'flex', flexDirection: 'column' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                 <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 700 }}>{ticket.id}</div>
                 <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline btn-sm" onClick={onEdit}>Edit Ticket</button>
                    {ticket.status !== 'resolved' ? (
                      <button className="btn btn-emerald btn-sm" style={{ background: '#10b981', color: 'white' }} onClick={handleResolve}>Resolve</button>
                    ) : (
                      <button className="btn btn-outline btn-sm" style={{ color: 'var(--brand-500)', borderColor: 'var(--brand-500)' }} onClick={handleReopen}>Reopen</button>
                    )}
                 </div>
               </div>
               
               <div style={{ fontSize: 26, fontWeight: 900, marginBottom: 16, lineHeight: 1.3 }}>{ticket.title}</div>
               
               <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                 <StatusBadge status={ticket.status} />
                 <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: `${PRIORITY_COLORS[ticket.priority]}22`, color: PRIORITY_COLORS[ticket.priority] }}>
                   {PRIORITY_ICONS[ticket.priority]} {ticket.priority.toUpperCase()}
                 </span>
                 <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: `${TEAM_COLORS[ticket.team]}22`, color: TEAM_COLORS[ticket.team], textTransform: 'capitalize' }}>
                   {ticket.team} Team
                 </span>
                 {ticket.slaBreached && (
                   <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: '#ef444422', color: '#ef4444' }}>
                     ⚠ SLA BREACHED
                   </span>
                 )}
               </div>
             </div>

             {/* Right Column: Attributes array spread wide */}
             <div style={{ flex: 1, display: 'flex', gap: 24, flexWrap: 'wrap', borderLeft: '1px solid var(--border)', paddingLeft: 32, alignItems: 'center', height: '100%', minHeight: 80 }}>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Tenant</div>
                  <div style={{ fontSize: 13, color: 'var(--brand-400)', fontWeight: 700, cursor: 'pointer' }}>{ticket.tenantName}</div>
                </div>
                <div style={{ flex: 1.2, minWidth: 120 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>SLA Deadline</div>
                  <div style={{ fontSize: 13, color: ticket.slaBreached ? '#ef4444' : 'var(--text-primary)', fontWeight: 700 }}>{new Date(ticket.slaDeadline).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Requester</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{ticket.submittedBy}</div>
                </div>
                <div style={{ flex: 1.5, minWidth: 150 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Assigned To</div>
                  <select value={ticket.assignedTo || ''} onChange={async (e) => {
                    const val = e.target.value || null;
                    await updateTicket(ticket.id, { assignedTo: val });
                  }} className="input" style={{ width: '100%', padding: '4px 8px', fontSize: 12, border: 'none', background: 'var(--bg-canvas)', borderRadius: 4, fontWeight: 500 }}>
                    <option value="">Unassigned</option>
                    <option value="Admin">Admin</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                  </select>
                </div>
             </div>
           </div>

           {/* Row 2: Full Width Isolated Description Box */}
           <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: isDescCollapsed ? '12px 24px' : '20px 24px', background: 'var(--bg-canvas)', display: 'flex', flexDirection: 'column', flexShrink: 0, maxHeight: isDescCollapsed ? 'auto' : 160, transition: 'all 0.2s' }}>
             <div onClick={() => setIsDescCollapsed(!isDescCollapsed)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isDescCollapsed ? 0 : 12 }}>
               <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>DESCRIPTION</div>
               <div style={{ color: 'var(--text-tertiary)' }}>
                 {isDescCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
               </div>
             </div>
             
             {!isDescCollapsed && (
               <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                 {ticket.description}
                 
                 {ticket.attachments && ticket.attachments.length > 0 && (
                    <div style={{ marginTop: 24, borderTop: '1px dashed var(--border)', paddingTop: 16 }}>
                       <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-tertiary)', borderLeft: '3px solid var(--brand-500)', paddingLeft: 8, marginBottom: 12 }}>Attached Files</div>
                       <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                          {ticket.attachments.map((a, i) => (
                             <a key={'def-att-'+i} href={a.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--brand-500)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: 8, textDecoration: 'none' }}>
                                <Paperclip size={14} />
                                {a.name}
                             </a>
                          ))}
                       </div>
                    </div>
                 )}
               </div>
             )}
           </div>
        </div>

        {/* Communication Panel (Timeline & Reply) - Full Width */}
        <div style={{ flex: 1, border: '1px solid var(--border)', minHeight: 0, borderRadius: 'var(--radius-xl)', overflow: 'hidden', background: 'var(--bg-surface)' }}>
          <CommunicationPanel
            familyId={ticket.tenantName}
            familyName={ticket.tenantName}
            linkedRecordType="ticket"
            linkedRecordId={ticket.id}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<TicketTeam | 'all'>('all');
  const [queueFilter, setQueueFilter] = useState<TicketQueue>('all');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tenantsList, setTenantsList] = useState<TenantSubscription[]>([]);
  const [contacts, setContacts] = useState<PlatformContact[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'new' | 'edit'>('new');
  const [form, setForm] = useState<Partial<Ticket>>({});
  const [ticketFiles, setTicketFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    getEmployees().then(setEmployees);
    getAllSubscriptions().then(setTenantsList);
    getAllContacts().then(setContacts);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'platform_tickets'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ticket)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  // Derived filtered tickets
  const filtered = useMemo(() => {
    return tickets.filter(t => {
      if (search && !`${t.title} ${t.tenantName} ${t.submittedBy} ${t.id}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (teamFilter !== 'all' && t.team !== teamFilter) return false;
      
      if (queueFilter === 'unassigned' && t.assignedTo !== null) return false;
      if (queueFilter === 'my_tickets' && t.assignedTo !== 'Admin') return false; // Defaulting assigned filter for now
      if (queueFilter === 'pending_client' && t.status !== 'waiting_client') return false;
      if (queueFilter === 'escalated' && t.priority !== 'critical') return false;

      return true;
    });
  }, [search, teamFilter, queueFilter, tickets]);

  const selectedTicket = useMemo(() => tickets.find(t => t.id === selectedTicketId) || null, [selectedTicketId, tickets]);

  // Support health metrics
  const metrics = useMemo(() => {
    const active = tickets.filter(t => t.status !== 'closed' && t.status !== 'resolved');
    const breached = active.filter(t => t.slaBreached).length;
    const unassignedCount = active.filter(t => !t.assignedTo).length;
    
    const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');
    let avgResTime = 0;
    if (resolved.length > 0) {
      const totalHours = resolved.reduce((acc, t) => {
        const created = new Date(t.createdAt).getTime();
        const updated = new Date(t.updatedAt).getTime();
        return acc + ((updated - created) / (1000 * 60 * 60));
      }, 0);
      avgResTime = Math.round((totalHours / resolved.length) * 10) / 10;
    }

    return {
      activeTickets: active.length,
      slaBreachRate: active.length ? Math.round((breached / active.length) * 100) : 0,
      unassigned: unassignedCount,
      avgResTime
    };
  }, [tickets]);

  const queueOptions: { id: TicketQueue; label: string; count: number }[] = [
    { id: 'all', label: 'All Open Tickets', count: tickets.length },
    { id: 'my_tickets', label: 'My Tickets', count: tickets.filter(t => t.assignedTo === 'Admin').length },
    { id: 'unassigned', label: 'Unassigned', count: tickets.filter(t => !t.assignedTo).length },
    { id: 'pending_client', label: 'Pending Client', count: tickets.filter(t => t.status === 'waiting_client').length },
    { id: 'escalated', label: 'Escalated/Critical', count: tickets.filter(t => t.priority === 'critical').length },
  ];

  
  const handleSaveForm = async () => {
     setIsUploading(true);
     let uploadedAttachments = form.attachments || [];
     if (ticketFiles.length > 0) {
        try {
           const newAttachments = await uploadMultipleAttachments(form.tenantName || 'Internal', ticketFiles);
           uploadedAttachments = [...uploadedAttachments, ...newAttachments];
        } catch (e) {
           console.error("Failed to upload attachments", e);
        }
     }

     if (formMode === 'new') {
        await createTicket({
           attachments: uploadedAttachments,
           title: form.title || '',
           description: form.description || '',
           tenantName: form.tenantName || 'Internal',
           submittedBy: form.submittedBy || 'Anonymous',
           email: form.email || '',
           status: 'open',
           priority: form.priority || 'normal',
           category: form.category || 'technical',
           team: form.team || 'support',
           assignedTo: form.assignedTo || null,
           tags: []
        });
     } else {
        if (form.id) {
           await updateTicket(form.id, {
             title: form.title,
             description: form.description,
             tenantName: form.tenantName,
             priority: form.priority,
             category: form.category,
             team: form.team,
             assignedTo: form.assignedTo,
           });
           await addActivity(form.id, { type: 'system', title: 'Ticket particulars updated by Admin' });
        }
     }
     setIsUploading(false);
     setTicketFiles([]);
     setShowForm(false);
  };

  if (showForm) {
     return (
       <div className="animate-fade-in" style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
             <button onClick={() => setShowForm(false)} className="btn btn-ghost btn-sm">← Back</button>
             <h2 style={{ fontSize: 24, fontWeight: 800 }}>{formMode === 'new' ? 'Provision New Ticket' : 'Edit Ticket Details'}</h2>
          </div>
          
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
             <div>
               <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>Subject</label>
               <input type="text" className="input" style={{ width: '100%', padding: '10px 12px' }} value={form.title || ''} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g., Cannot access billing portal" />
             </div>
             
             <div style={{ display: 'flex', gap: 16 }}>
               <div style={{ flex: 1 }}>
                 <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>Tenant</label>
                 <select className="input" style={{ width: '100%', padding: '10px 12px' }} value={form.tenantName || ''} onChange={e => setForm({...form, tenantName: e.target.value})}>
                    <option value="">Select Tenant...</option>
                    <option value="Internal">Internal (MFO HQ)</option>
                    {tenantsList.map(t => <option key={t.tenantId} value={t.tenantName}>{t.tenantName}</option>)}
                 </select>
               </div>
               <div style={{ flex: 1 }}>
                 <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>Requester Name</label>
                 <select className="input" style={{ width: '100%', padding: '10px 12px' }} value={form.submittedBy || ''} onChange={e => setForm({...form, submittedBy: e.target.value})} disabled={formMode === 'edit'}>
                   <option value="">Select Requester...</option>
                   <optgroup label="Internal Employees">
                     {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                   </optgroup>
                   <optgroup label="CRM Contacts">
                     {contacts.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                   </optgroup>
                 </select>
               </div>
             </div>

             <div style={{ display: 'flex', gap: 16 }}>
               <div style={{ flex: 1 }}>
                 <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>Category</label>
                 <select className="input" style={{ width: '100%', padding: '10px 12px' }} value={form.category || 'technical'} onChange={e => setForm({...form, category: e.target.value as any})}>
                    <option value="technical">Technical</option>
                    <option value="billing">Billing</option>
                    <option value="compliance">Compliance</option>
                    <option value="integration">Integration</option>
                 </select>
               </div>
               <div style={{ flex: 1 }}>
                 <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>Priority</label>
                 <select className="input" style={{ width: '100%', padding: '10px 12px' }} value={form.priority || 'normal'} onChange={e => setForm({...form, priority: e.target.value as any})}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                 </select>
               </div>
             </div>

             <div style={{ display: 'flex', gap: 16 }}>
               <div style={{ flex: 1 }}>
                 <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>Assign to Team</label>
                 <select className="input" style={{ width: '100%', padding: '10px 12px' }} value={form.team || 'support'} onChange={e => setForm({...form, team: e.target.value as any})}>
                    <option value="support">Support</option>
                    <option value="engineering">Engineering</option>
                    <option value="operations">Operations</option>
                    <option value="compliance">Compliance</option>
                 </select>
               </div>
               <div style={{ flex: 1 }}>
                 <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>Assignee</label>
                 <select className="input" style={{ width: '100%', padding: '10px 12px' }} value={form.assignedTo || ''} onChange={e => setForm({...form, assignedTo: e.target.value || null})}>
                    <option value="">Unassigned</option>
                    {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                 </select>
               </div>
             </div>

             <div>
               <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>Description</label>
               <textarea className="input" rows={6} style={{ width: '100%', padding: '10px 12px', resize: 'vertical', marginBottom: 12 }} value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} placeholder="Details of the inquiry..." />
               
               <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', display: 'block' }}>Attachments</label>
                  <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', width: 'fit-content', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                     <Paperclip size={14} /> Add Files
                     <input type="file" multiple onChange={(e) => {
                        if (e.target.files) {
                           setTicketFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                        }
                     }} style={{ display: 'none' }} />
                  </label>
                  {ticketFiles.length > 0 && (
                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                        {ticketFiles.map((f, i) => (
                           <div key={i} style={{ background: 'var(--brand-50)', color: 'var(--brand-600)', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {f.name}
                              <button onClick={() => setTicketFiles(ticketFiles.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'currentcolor', opacity: 0.6 }}>×</button>
                           </div>
                        ))}
                     </div>
                  )}
                  {form.attachments && form.attachments.length > 0 && (
                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                        {form.attachments.map((a, i) => (
                           <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                              📎 {a.name}
                           </div>
                        ))}
                     </div>
                  )}
               </div>
             </div>

             <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="btn btn-primary" onClick={handleSaveForm} disabled={!form.title || !form.tenantName}>
                   {formMode === 'new' ? 'Create Ticket' : 'Save Changes'}
                </button>
             </div>
          </div>
       </div>
     );
  }

  if (selectedTicket) {
    return <TicketDetailView ticket={selectedTicket} employees={employees} onBack={() => setSelectedTicketId(null)} onEdit={() => { setFormMode('edit'); setForm(selectedTicket); setShowForm(true); setSelectedTicketId(null); }} />;
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 w-full animate-fade-in relative bg-slate-50/50">
      <div style={{ maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      <header style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>
              Support <span style={{ color: 'var(--brand-500)', fontWeight: 400 }}>Center</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Manage tickets, teams, and service level agreements.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline btn-sm">Team Settings</button>
            <button className="btn btn-primary btn-sm" onClick={() => { setFormMode('new'); setForm({}); setTicketFiles([]); setShowForm(true); }}>+ New Ticket</button>
          </div>
        </div>
      </header>

      {/* Support Center Health Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <div style={{ padding: '16px 20px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.07em' }}>Active Backlog</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)' }}>{metrics.activeTickets}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>tickets in queue</span>
          </div>
        </div>
        <div style={{ padding: '16px 20px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.07em' }}>Unassigned</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: metrics.unassigned > 0 ? '#f59e0b' : '#22c55e' }}>{metrics.unassigned}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>need assignment</span>
          </div>
        </div>
        <div style={{ padding: '16px 20px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.07em' }}>SLA Breach Rate</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: metrics.slaBreachRate > 10 ? '#ef4444' : 'var(--text-primary)' }}>{metrics.slaBreachRate}%</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>of active tickets</span>
          </div>
        </div>
        <div style={{ padding: '16px 20px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.07em' }}>Avg Resolution</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)' }}>{metrics.avgResTime}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>hours (last 7d)</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24, alignItems: 'flex-start' }}>
        
        {/* Left Sidebar: Queues and Teams */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Queues Navigator */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', padding: '16px 16px 8px' }}>Queues</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {queueOptions.map(q => (
                <button
                  key={q.id}
                  onClick={() => setQueueFilter(q.id)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', border: 'none',
                    background: queueFilter === q.id ? 'var(--brand-500)15' : 'transparent',
                    color: queueFilter === q.id ? 'var(--brand-400)' : 'var(--text-primary)',
                    cursor: 'pointer', textAlign: 'left', fontWeight: queueFilter === q.id ? 700 : 500,
                    borderLeft: `3px solid ${queueFilter === q.id ? 'var(--brand-500)' : 'transparent'}`,
                    transition: 'all 0.1s'
                  }}
                >
                  <span>{q.label}</span>
                  <span style={{ background: queueFilter === q.id ? 'var(--brand-500)' : 'var(--bg-elevated)', color: queueFilter === q.id ? '#fff' : 'var(--text-secondary)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{q.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Teams Filter */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Filter by Team</div>
            <select className="input" style={{ width: '100%', padding: '8px 12px' }} value={teamFilter} onChange={e => setTeamFilter(e.target.value as any)}>
              <option value="all">Every Team</option>
              <option value="support">Support Team</option>
              <option value="engineering">Engineering</option>
              <option value="operations">Operations</option>
              <option value="compliance">Compliance</option>
            </select>
          </div>
        </div>

        {/* Right Area: Ticket List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Search bar */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="header-search cursor-text max-w-md w-full" style={{ flex: 1 }}>
              <Search size={16} className="text-tertiary shrink-0" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets by subject, ID, or tenant…" className="flex-1 min-w-0 bg-transparent border-none outline-none text-[13px] text-primary placeholder-tertiary" />
            </div>
          </div>

          {/* Ticket Table */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                  {['Ticket', 'Subject & Requester', 'Status', 'Team / Assignee', 'SLA / Updated'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(ticket => (
                  <tr
                    key={ticket.id} onClick={() => setSelectedTicketId(ticket.id)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: ticket.slaBreached ? '#ef444405' : 'transparent' }}
                    className="hover-lift"
                  >
                    <td style={{ padding: '16px 16px', verticalAlign: 'top' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{ticket.id}</div>
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: PRIORITY_COLORS[ticket.priority] }}>
                        {PRIORITY_ICONS[ticket.priority]} {ticket.priority.toUpperCase()}
                      </div>
                    </td>
                    <td style={{ padding: '16px 16px', verticalAlign: 'top', maxWidth: 300 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3 }}>{ticket.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{ticket.submittedBy} · <span style={{ fontWeight: 600 }}>{ticket.tenantName}</span></div>
                    </td>
                    <td style={{ padding: '16px 16px', verticalAlign: 'top' }}>
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td style={{ padding: '16px 16px', verticalAlign: 'top' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: TEAM_COLORS[ticket.team], textTransform: 'capitalize', marginBottom: 4 }}>{ticket.team}</div>
                      <div style={{ fontSize: 12, color: ticket.assignedTo ? 'var(--text-secondary)' : 'var(--text-tertiary)', fontStyle: ticket.assignedTo ? 'normal' : 'italic' }}>
                        {ticket.assignedTo || 'Unassigned'}
                      </div>
                    </td>
                    <td style={{ padding: '16px 16px', verticalAlign: 'top' }}>
                      <div style={{ fontSize: 12, color: ticket.slaBreached ? '#ef4444' : 'var(--text-secondary)', fontWeight: ticket.slaBreached ? 700 : 500, marginBottom: 4 }}>
                        {ticket.slaBreached ? '⚠ Breached' : `Due ${new Date(ticket.slaDeadline).toLocaleDateString()}`}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {new Date(ticket.updatedAt).toLocaleDateString()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🎫</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>No tickets in this queue</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
