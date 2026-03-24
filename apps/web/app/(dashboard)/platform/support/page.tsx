'use client';

import React, { useState, useMemo } from 'react';
import { CommunicationPanel } from '@/components/CommunicationPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

type TicketStatus = 'open' | 'in_progress' | 'waiting_client' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'normal' | 'high' | 'critical';
type TicketCategory = 'billing' | 'technical' | 'integration' | 'compliance' | 'feature_request' | 'onboarding' | 'security';
type TicketTeam = 'support' | 'engineering' | 'operations' | 'compliance';
type TicketQueue = 'unassigned' | 'my_tickets' | 'pending_client' | 'escalated' | 'all';

interface Ticket {
  id: string; title: string; description: string;
  tenantName: string; submittedBy: string; email: string;
  status: TicketStatus; priority: TicketPriority;
  category: TicketCategory; team: TicketTeam;
  assignedTo: string | null; createdAt: string; updatedAt: string;
  slaDeadline: string; slaBreached: boolean;
  tags: string[];
  responses: { author: string; message: string; timestamp: string; internal: boolean }[];
  activities: { type: string; title: string; timestamp: string }[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const TICKETS: Ticket[] = [
  {
    id: 'TKT-2026-0089', title: 'Cannot configure Google OAuth — redirect URI mismatch',
    description: 'When I try to authorize Google Workspace in the integrations panel, I get a "redirect_uri_mismatch" error from Google. I have set the correct URI in Google Cloud Console.',
    tenantName: 'Apex Wealth Partners', submittedBy: 'Carlos Mendes', email: 'c.mendes@apexwp.com',
    status: 'in_progress', priority: 'high', category: 'integration', team: 'engineering',
    assignedTo: 'Admin', createdAt: '2026-03-20T09:30:00Z', updatedAt: '2026-03-20T10:45:00Z',
    slaDeadline: '2026-03-20T17:30:00Z', slaBreached: false, tags: ['google', 'integration', 'oauth'],
    responses: [
      { author: 'Support Bot', message: 'Thank you for reporting this. We have assigned this to our engineering team.', timestamp: '2026-03-20T09:31:00Z', internal: false },
      { author: 'Dev Team', message: 'The allowed redirect URIs in our OAuth app need to match exactly. Confirm your configured URI path. Also check tenant subdomain config.', timestamp: '2026-03-20T10:45:00Z', internal: true },
    ],
    activities: [
      { type: 'status_change', title: 'Status changed to In Progress', timestamp: '2026-03-20T09:35:00Z' },
      { type: 'assignment', title: 'Assigned to Dev Team', timestamp: '2026-03-20T09:35:00Z' }
    ]
  },
  {
    id: 'TKT-2026-0088', title: 'Invoice INV-2026-026 overdue — payment was made',
    description: 'We made a bank transfer for invoice INV-2026-026 on Feb 25th. The invoice still shows as overdue in the billing panel. Please confirm receipt.',
    tenantName: 'Pacific Family Office', submittedBy: 'Tom Baxter', email: 't.baxter@pacificfo.au',
    status: 'waiting_client', priority: 'high', category: 'billing', team: 'operations',
    assignedTo: null, createdAt: '2026-03-19T14:20:00Z', updatedAt: '2026-03-19T16:00:00Z',
    slaDeadline: '2026-03-20T14:20:00Z', slaBreached: true, tags: ['billing', 'invoice', 'overdue'],
    responses: [
      { author: 'Finance Ops', message: 'We can see the invoice in our system. Please share the bank transfer receipt so we can match the payment.', timestamp: '2026-03-19T16:00:00Z', internal: false },
    ],
    activities: [
      { type: 'sla_breach', title: 'SLA Breached', timestamp: '2026-03-20T14:20:00Z' }
    ]
  },
  {
    id: 'TKT-2026-0087', title: 'Feature Request: Export audit log to Excel',
    description: 'We require the ability to export our full audit log to Excel format (XLSX) for our ANBIMA regulatory reporting. CSV is available but our compliance team uses Excel macros.',
    tenantName: 'Vivants Multi-Family Office', submittedBy: 'Alexandra Torres', email: 'a.torres@vivants.com',
    status: 'open', priority: 'normal', category: 'feature_request', team: 'engineering',
    assignedTo: null, createdAt: '2026-03-18T11:00:00Z', updatedAt: '2026-03-18T11:00:00Z',
    slaDeadline: '2026-03-25T11:00:00Z', slaBreached: false, tags: ['export', 'excel', 'compliance', 'audit'],
    responses: [],
    activities: []
  },
  {
    id: 'TKT-2026-0086', title: 'CRITICAL: MFA codes rejected for all users after timezone change',
    description: 'After our server timezone was changed to UTC, all MFA codes are being rejected by the platform. All users are locked out. This is a production incident.',
    tenantName: 'Legacy Trust Group', submittedBy: 'Michael Grant', email: 'm.grant@legacytrust.co.uk',
    status: 'resolved', priority: 'critical', category: 'security', team: 'engineering',
    assignedTo: 'Security Team', createdAt: '2026-03-17T08:15:00Z', updatedAt: '2026-03-17T09:30:00Z',
    slaDeadline: '2026-03-17T10:15:00Z', slaBreached: false, tags: ['mfa', 'critical', 'security', 'production'],
    responses: [
      { author: 'Security Team', message: 'Root cause identified: TOTP window was set to "Strict (±0)" — timezone change caused clock drift outside tolerance. Increased TOTP window to ±1 (30s). All users can now log in.', timestamp: '2026-03-17T09:30:00Z', internal: false },
      { author: 'Security Team', message: 'Post-mortem: Recommend setting TOTP window to ±1 for production. Added monitoring for MFA rejection rates.', timestamp: '2026-03-17T10:00:00Z', internal: true },
    ],
    activities: [
      { type: 'escalation', title: 'Ticket Escalated', timestamp: '2026-03-17T08:20:00Z' },
      { type: 'status_change', title: 'Status changed to Resolved', timestamp: '2026-03-17T09:30:00Z' }
    ]
  },
];

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

function TicketDetailView({ ticket, onBack }: { ticket: Ticket; onBack: () => void }) {
  return (
    <div className="animate-fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--brand-400)', cursor: 'pointer', padding: 0, fontWeight: 600 }}>Support Center</button>
        <span>/</span>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--brand-400)', cursor: 'pointer', padding: 0, fontWeight: 600 }}>All Tickets</button>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }}>{ticket.id}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 24, alignItems: 'flex-start' }}>
        
        {/* Main Content Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Header */}
          <div style={{ padding: '24px 28px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 700 }}>{ticket.id}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                 <button className="btn btn-outline btn-sm">Edit Ticket</button>
                 <button className="btn btn-primary btn-sm">Resolve</button>
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 16, lineHeight: 1.3 }}>{ticket.title}</div>
            
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
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

            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Original Description</div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ticket.description}</div>
            </div>
          </div>

          {/* Communication Panel (Timeline & Reply) */}
          <div style={{ height: 800, border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', background: 'var(--bg-surface)' }}>
            <CommunicationPanel
              familyId={ticket.tenantName}
              familyName={ticket.tenantName}
              linkedRecordType="ticket"
              linkedRecordId={ticket.id}
            />
          </div>
        </div>

        {/* Sidebar Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Ticket Attributes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Tenant</div>
                <div style={{ fontSize: 13, color: 'var(--brand-400)', fontWeight: 600, cursor: 'pointer' }}>{ticket.tenantName}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Requester</div>
                <div style={{ fontSize: 13 }}>{ticket.submittedBy}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{ticket.email}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Assigned To</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: ticket.assignedTo ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{ticket.assignedTo || 'Unassigned'}</div>
                <button className="btn btn-ghost btn-sm" style={{ padding: '2px 0', fontSize: 11, color: 'var(--brand-500)', marginTop: 4 }}>Change Assignee</button>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>SLA Deadline</div>
                <div style={{ fontSize: 13, color: ticket.slaBreached ? '#ef4444' : 'var(--text-primary)', fontWeight: 600 }}>{new Date(ticket.slaDeadline).toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Tags</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ticket.tags.map(t => (
                    <span key={t} style={{ fontSize: 10, background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 4, color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
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

  // Derived filtered tickets
  const filtered = useMemo(() => {
    return TICKETS.filter(t => {
      if (search && !`${t.title} ${t.tenantName} ${t.submittedBy} ${t.id}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (teamFilter !== 'all' && t.team !== teamFilter) return false;
      
      if (queueFilter === 'unassigned' && t.assignedTo !== null) return false;
      if (queueFilter === 'my_tickets' && t.assignedTo !== 'Admin') return false; // Mocking 'Admin' as current user
      if (queueFilter === 'pending_client' && t.status !== 'waiting_client') return false;
      if (queueFilter === 'escalated' && t.priority !== 'critical') return false;

      return true;
    });
  }, [search, teamFilter, queueFilter]);

  const selectedTicket = useMemo(() => TICKETS.find(t => t.id === selectedTicketId) || null, [selectedTicketId]);

  // Support health metrics
  const metrics = useMemo(() => {
    const active = TICKETS.filter(t => t.status !== 'closed' && t.status !== 'resolved');
    const breached = active.filter(t => t.slaBreached).length;
    const unassignedCount = active.filter(t => !t.assignedTo).length;
    const avgResolutionHours = 4.2; // Mock metric
    return {
      activeTickets: active.length,
      slaBreachRate: active.length ? Math.round((breached / active.length) * 100) : 0,
      unassigned: unassignedCount,
      avgResTime: avgResolutionHours
    };
  }, []);

  const queueOptions: { id: TicketQueue; label: string; count: number }[] = [
    { id: 'all', label: 'All Open Tickets', count: TICKETS.length },
    { id: 'my_tickets', label: 'My Tickets', count: TICKETS.filter(t => t.assignedTo === 'Admin').length },
    { id: 'unassigned', label: 'Unassigned', count: TICKETS.filter(t => !t.assignedTo).length },
    { id: 'pending_client', label: 'Pending Client', count: TICKETS.filter(t => t.status === 'waiting_client').length },
    { id: 'escalated', label: 'Escalated/Critical', count: TICKETS.filter(t => t.priority === 'critical').length },
  ];

  if (selectedTicket) {
    return <TicketDetailView ticket={selectedTicket} onBack={() => setSelectedTicketId(null)} />;
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1400, margin: '0 auto' }}>
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
            <button className="btn btn-primary btn-sm">+ New Ticket</button>
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
            <input type="text" placeholder="🔍 Search tickets by subject, ID, or tenant…" value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ flex: 1, padding: '10px 14px' }} />
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
  );
}
