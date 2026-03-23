'use client';

import React, { useState, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type TicketStatus = 'open' | 'in_progress' | 'waiting_client' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'normal' | 'high' | 'critical';
type TicketCategory = 'billing' | 'technical' | 'integration' | 'compliance' | 'feature_request' | 'onboarding' | 'security';
type TicketTeam = 'support' | 'engineering' | 'operations' | 'compliance';

interface Ticket {
  id: string; title: string; description: string;
  tenantName: string; submittedBy: string; email: string;
  status: TicketStatus; priority: TicketPriority;
  category: TicketCategory; team: TicketTeam;
  assignedTo: string; createdAt: string; updatedAt: string;
  slaDeadline: string; slaBreached: boolean;
  tags: string[];
  responses: { author: string; message: string; timestamp: string; internal: boolean }[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const TICKETS: Ticket[] = [
  {
    id: 'TKT-2026-0089', title: 'Cannot configure Google OAuth — redirect URI mismatch',
    description: 'When I try to authorize Google Workspace in the integrations panel, I get a "redirect_uri_mismatch" error from Google. I have set the correct URI in Google Cloud Console.',
    tenantName: 'Apex Wealth Partners', submittedBy: 'Carlos Mendes', email: 'c.mendes@apexwp.com',
    status: 'in_progress', priority: 'high', category: 'integration', team: 'engineering',
    assignedTo: 'Dev Team', createdAt: '2026-03-20T09:30:00Z', updatedAt: '2026-03-20T10:45:00Z',
    slaDeadline: '2026-03-20T17:30:00Z', slaBreached: false, tags: ['google', 'integration', 'oauth'],
    responses: [
      { author: 'Support Bot', message: 'Thank you for reporting this. We have assigned this to our engineering team.', timestamp: '2026-03-20T09:31:00Z', internal: false },
      { author: 'Dev Team', message: 'The allowed redirect URIs in our OAuth app need to match exactly. Confirm your configured URI path. Also check tenant subdomain config.', timestamp: '2026-03-20T10:45:00Z', internal: true },
    ]
  },
  {
    id: 'TKT-2026-0088', title: 'Invoice INV-2026-026 overdue — payment was made',
    description: 'We made a bank transfer for invoice INV-2026-026 on Feb 25th. The invoice still shows as overdue in the billing panel. Please confirm receipt.',
    tenantName: 'Pacific Family Office', submittedBy: 'Tom Baxter', email: 't.baxter@pacificfo.au',
    status: 'waiting_client', priority: 'high', category: 'billing', team: 'operations',
    assignedTo: 'Finance Ops', createdAt: '2026-03-19T14:20:00Z', updatedAt: '2026-03-19T16:00:00Z',
    slaDeadline: '2026-03-20T14:20:00Z', slaBreached: true, tags: ['billing', 'invoice', 'overdue'],
    responses: [
      { author: 'Finance Ops', message: 'We can see the invoice in our system. Please share the bank transfer receipt so we can match the payment.', timestamp: '2026-03-19T16:00:00Z', internal: false },
    ]
  },
  {
    id: 'TKT-2026-0087', title: 'Feature Request: Export audit log to Excel',
    description: 'We require the ability to export our full audit log to Excel format (XLSX) for our ANBIMA regulatory reporting. CSV is available but our compliance team uses Excel macros.',
    tenantName: 'Vivants Multi-Family Office', submittedBy: 'Alexandra Torres', email: 'a.torres@vivants.com',
    status: 'open', priority: 'normal', category: 'feature_request', team: 'engineering',
    assignedTo: 'Product Team', createdAt: '2026-03-18T11:00:00Z', updatedAt: '2026-03-18T11:00:00Z',
    slaDeadline: '2026-03-25T11:00:00Z', slaBreached: false, tags: ['export', 'excel', 'compliance', 'audit'],
    responses: []
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
    ]
  },
  {
    id: 'TKT-2026-0085', title: 'Onboarding: How to add team members and set permissions?',
    description: 'We just started our trial. We want to add 3 more advisors to our account but cannot find where to invite users and assign roles.',
    tenantName: 'AlphaPath Advisory', submittedBy: 'Sarah Chen', email: 's.chen@alphapath.hk',
    status: 'resolved', priority: 'low', category: 'onboarding', team: 'support',
    assignedTo: 'Support', createdAt: '2026-03-16T13:40:00Z', updatedAt: '2026-03-16T14:15:00Z',
    slaDeadline: '2026-03-17T13:40:00Z', slaBreached: false, tags: ['onboarding', 'users', 'permissions'],
    responses: [
      { author: 'Support', message: 'Great question! Go to Admin & Config → Access Control → Invite User. You can assign roles: Firm Admin, Relationship Manager, Compliance Officer, or Report Viewer. Let us know if you need a live walkthrough!', timestamp: '2026-03-16T14:15:00Z', internal: false },
    ]
  },
  {
    id: 'TKT-2026-0084', title: 'Compliance: CVM 175 suitability form not accepting CNPJ format',
    description: 'The suitability questionnaire field for entity identification only accepts CPF format. Our corporate clients have CNPJ numbers which are not accepted.',
    tenantName: 'Vivants Multi-Family Office', submittedBy: 'Compliance Team', email: 'compliance@vivants.com',
    status: 'in_progress', priority: 'high', category: 'compliance', team: 'engineering',
    assignedTo: 'Dev Team', createdAt: '2026-03-15T10:00:00Z', updatedAt: '2026-03-18T09:00:00Z',
    slaDeadline: '2026-03-22T10:00:00Z', slaBreached: false, tags: ['compliance', 'suitability', 'cnpj', 'cvm'],
    responses: []
  },
];

const STATUS_COLORS: Record<TicketStatus, string> = {
  open: '#6366f1', in_progress: '#f59e0b', waiting_client: '#22d3ee',
  resolved: '#22c55e', closed: '#64748b'
};

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: '#64748b', normal: '#6366f1', high: '#f59e0b', critical: '#ef4444'
};

const PRIORITY_ICONS: Record<TicketPriority, string> = {
  low: '○', normal: '●', high: '▲', critical: '⚡'
};

const TEAM_COLORS: Record<TicketTeam, string> = {
  support: '#22d3ee', engineering: '#6366f1', operations: '#f59e0b', compliance: '#22c55e'
};

function StatusBadge({ status }: { status: TicketStatus }) {
  const color = STATUS_COLORS[status];
  const label = status.replace('_', ' ');
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: `${color}22`, color, border: `1px solid ${color}44`, textTransform: 'capitalize' }}>{label}</span>;
}

// ─── Ticket Panel ─────────────────────────────────────────────────────────────

function TicketPanel({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 480,
      background: 'var(--bg-elevated)', borderLeft: '1px solid var(--border)',
      zIndex: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column',
      boxShadow: '-12px 0 40px rgba(0,0,0,0.3)'
    }}>
      {/* Header */}
      <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 700 }}>{ticket.id}</div>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, lineHeight: 1.3 }}>{ticket.title}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <StatusBadge status={ticket.status} />
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: `${PRIORITY_COLORS[ticket.priority]}22`, color: PRIORITY_COLORS[ticket.priority] }}>
            {PRIORITY_ICONS[ticket.priority]} {ticket.priority}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: `${TEAM_COLORS[ticket.team]}22`, color: TEAM_COLORS[ticket.team] }}>
            {ticket.team}
          </span>
        </div>
      </div>

      {/* Details */}
      <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Tenant', value: ticket.tenantName },
            { label: 'Submitted By', value: ticket.submittedBy },
            { label: 'Assigned To', value: ticket.assignedTo },
            { label: 'Category', value: ticket.category.replace('_', ' ') },
            { label: 'Created', value: new Date(ticket.createdAt).toLocaleDateString() },
            { label: 'SLA Deadline', value: `${new Date(ticket.slaDeadline).toLocaleString()}${ticket.slaBreached ? ' ⚠ BREACHED' : ''}` },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{f.label}</div>
              <div style={{ fontSize: 13, color: f.label === 'SLA Deadline' && ticket.slaBreached ? '#ef4444' : 'var(--text-primary)', fontWeight: 600 }}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Description */}
      <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Description</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{ticket.description}</div>
      </div>

      {/* Timeline */}
      <div style={{ padding: '20px 28px', flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>Response Timeline</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ticket.responses.map((r, i) => (
            <div key={i} style={{ padding: '12px 14px', background: r.internal ? '#f59e0b0a' : 'var(--bg-canvas)', borderRadius: 8, border: `1px solid ${r.internal ? '#f59e0b33' : 'var(--border)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{r.author}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {r.internal && <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>INTERNAL</span>}
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date(r.timestamp).toLocaleString()}</span>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r.message}</div>
            </div>
          ))}
          {ticket.responses.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)', fontSize: 13 }}>No responses yet</div>
          )}
        </div>
      </div>

      {/* Reply box */}
      <div style={{ padding: '20px 28px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Reply</span>
          <button onClick={() => setInternal(!internal)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: internal ? '#f59e0b22' : 'var(--bg-canvas)', color: internal ? '#f59e0b' : 'var(--text-tertiary)', border: `1px solid ${internal ? '#f59e0b44' : 'var(--border)'}`, cursor: 'pointer', fontWeight: 600 }}>
            {internal ? '🔒 Internal Note' : '📧 Public Reply'}
          </button>
        </div>
        <textarea
          value={reply} onChange={e => setReply(e.target.value)}
          placeholder={internal ? 'Internal note (not visible to client)…' : 'Reply to client…'}
          className="input" style={{ width: '100%', minHeight: 80, padding: '10px 12px', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn btn-primary btn-sm" style={{ flex: 1 }}>Send Reply</button>
          <select className="input" style={{ padding: '6px 10px', fontSize: 12 }}>
            <option>Keep Status</option>
            <option>→ In Progress</option>
            <option>→ Waiting Client</option>
            <option>→ Resolved</option>
            <option>→ Closed</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all');
  const [teamFilter, setTeamFilter] = useState<TicketTeam | 'all'>('all');
  const [selected, setSelected] = useState<Ticket | null>(null);

  const filtered = useMemo(() => {
    return TICKETS.filter(t => {
      if (search && !`${t.title} ${t.tenantName} ${t.submittedBy} ${t.id}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (teamFilter !== 'all' && t.team !== teamFilter) return false;
      return true;
    });
  }, [search, statusFilter, priorityFilter, teamFilter]);

  const stats = useMemo(() => ({
    open: TICKETS.filter(t => t.status === 'open').length,
    inProgress: TICKETS.filter(t => t.status === 'in_progress').length,
    critical: TICKETS.filter(t => t.priority === 'critical').length,
    slaBreached: TICKETS.filter(t => t.slaBreached).length,
    resolved: TICKETS.filter(t => t.status === 'resolved').length,
  }), []);

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {selected && <TicketPanel ticket={selected} onClose={() => setSelected(null)} />}

      <header style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>
              Support <span style={{ color: 'var(--brand-500)', fontWeight: 400 }}>Center</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Client support tickets — routing across Support, Engineering, and Operations teams.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline btn-sm">📊 Reports</button>
            <button className="btn btn-primary btn-sm">+ New Ticket</button>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Open', value: stats.open, color: '#6366f1' },
          { label: 'In Progress', value: stats.inProgress, color: '#f59e0b' },
          { label: 'Critical', value: stats.critical, color: '#ef4444' },
          { label: 'SLA Breached', value: stats.slaBreached, color: '#ef4444' },
          { label: 'Resolved Today', value: stats.resolved, color: '#22c55e' },
        ].map(kpi => (
          <div key={kpi.label} style={{ padding: '16px 20px', background: 'var(--bg-elevated)', border: `1px solid ${kpi.color}33`, borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.07em', marginBottom: 6 }}>{kpi.label}</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', padding: '14px 18px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
        <input type="text" placeholder="🔍 Search tickets…" value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ flex: '1 1 220px', padding: '8px 12px' }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="input" style={{ padding: '8px 12px' }}>
          <option value="all">All Statuses</option>
          {(['open', 'in_progress', 'waiting_client', 'resolved', 'closed'] as TicketStatus[]).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as any)} className="input" style={{ padding: '8px 12px' }}>
          <option value="all">All Priorities</option>
          {(['critical', 'high', 'normal', 'low'] as TicketPriority[]).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value as any)} className="input" style={{ padding: '8px 12px' }}>
          <option value="all">All Teams</option>
          {(['support', 'engineering', 'operations', 'compliance'] as TicketTeam[]).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', alignSelf: 'center', whiteSpace: 'nowrap' }}>{filtered.length} tickets</span>
      </div>

      {/* Ticket Table */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
              {['Ticket', 'Title', 'Tenant', 'Priority', 'Category', 'Team', 'Status', 'SLA', 'Updated'].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(ticket => (
              <tr
                key={ticket.id} onClick={() => setSelected(ticket)}
                style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: ticket.slaBreached ? '#ef444408' : 'transparent' }}
                className="hover-lift"
              >
                <td style={{ padding: '14px 14px', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{ticket.id}</td>
                <td style={{ padding: '14px 14px', maxWidth: 280 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{ticket.submittedBy}</div>
                </td>
                <td style={{ padding: '14px 14px', fontSize: 12, fontWeight: 600 }}>{ticket.tenantName}</td>
                <td style={{ padding: '14px 14px' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: PRIORITY_COLORS[ticket.priority] }}>
                    {PRIORITY_ICONS[ticket.priority]} {ticket.priority}
                  </span>
                </td>
                <td style={{ padding: '14px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{ticket.category.replace('_', ' ')}</td>
                <td style={{ padding: '14px 14px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: `${TEAM_COLORS[ticket.team]}22`, color: TEAM_COLORS[ticket.team] }}>
                    {ticket.team}
                  </span>
                </td>
                <td style={{ padding: '14px 14px' }}><StatusBadge status={ticket.status} /></td>
                <td style={{ padding: '14px 14px', fontSize: 11, color: ticket.slaBreached ? '#ef4444' : 'var(--text-tertiary)', fontWeight: ticket.slaBreached ? 700 : 400, whiteSpace: 'nowrap' }}>
                  {ticket.slaBreached ? '⚠ Breached' : `Due ${new Date(ticket.slaDeadline).toLocaleDateString()}`}
                </td>
                <td style={{ padding: '14px 14px', fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                  {new Date(ticket.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🎫</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>No tickets match your filters</div>
          </div>
        )}
      </div>
    </div>
  );
}
