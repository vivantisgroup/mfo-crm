const fs = require('fs');

let code = fs.readFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', 'utf8');

// The original TicketDetailView return block:
const oldReturnStr = `  return (
    <div className="animate-fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 24, alignItems: 'flex-start' }}>
        
        {/* Main Content Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Header */}
          <div style={{ padding: '24px 28px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 700 }}>{ticket.id}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                 <button className="btn btn-outline btn-sm" onClick={onEdit}>Edit Ticket</button>
                 {ticket.status !== 'resolved' && <button className="btn btn-emerald btn-sm" style={{ background: '#10b981', color: 'white' }} onClick={handleResolve}>Resolve</button>}
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 16, lineHeight: 1.3 }}>{ticket.title}</div>
            
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <StatusBadge status={ticket.status} />
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: \`\${PRIORITY_COLORS[ticket.priority]}22\`, color: PRIORITY_COLORS[ticket.priority] }}>
                {PRIORITY_ICONS[ticket.priority]} {ticket.priority.toUpperCase()}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: \`\${TEAM_COLORS[ticket.team]}22\`, color: TEAM_COLORS[ticket.team], textTransform: 'capitalize' }}>
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
                
  <select value={ticket.assignedTo || ''} onChange={async (e) => {
    const val = e.target.value || null;
    await updateTicket(ticket.id, { assignedTo: val });
    await addActivity(ticket.id, { type: 'system', title: val ? \`Ticket assigned to \${val}\` : 'Ticket unassigned' });
  }} style={{ marginTop: 4, padding: '2px 4px', fontSize: 11, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-secondary)' }}>
    <option value="">Unassigned</option>
    {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
  </select>

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
  );`;

const newReturnStr = `  return (
    <div className="animate-fade-in" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Header containing Title & Attributes */}
        <div style={{ padding: '24px 28px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32 }}>
          
          {/* Left Column: Title & Controls */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 700 }}>{ticket.id}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                 <button className="btn btn-outline btn-sm" onClick={onEdit}>Edit Ticket</button>
                 {ticket.status !== 'resolved' && <button className="btn btn-emerald btn-sm" style={{ background: '#10b981', color: 'white' }} onClick={handleResolve}>Resolve</button>}
              </div>
            </div>
            
            <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 16, lineHeight: 1.3 }}>{ticket.title}</div>
            
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <StatusBadge status={ticket.status} />
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: \`\${PRIORITY_COLORS[ticket.priority]}22\`, color: PRIORITY_COLORS[ticket.priority] }}>
                {PRIORITY_ICONS[ticket.priority]} {ticket.priority.toUpperCase()}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: \`\${TEAM_COLORS[ticket.team]}22\`, color: TEAM_COLORS[ticket.team], textTransform: 'capitalize' }}>
                {ticket.team} Team
              </span>
              {ticket.slaBreached && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: '#ef444422', color: '#ef4444' }}>
                  ⚠ SLA BREACHED
                </span>
              )}
            </div>
          </div>

          {/* Right Column: Ticket Attributes */}
          <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Tenant</div>
                <div style={{ fontSize: 13, color: 'var(--brand-400)', fontWeight: 600, cursor: 'pointer' }}>{ticket.tenantName}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>SLA Deadline</div>
                <div style={{ fontSize: 13, color: ticket.slaBreached ? '#ef4444' : 'var(--text-primary)', fontWeight: 600 }}>{new Date(ticket.slaDeadline).toLocaleString()}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Requester</div>
                <div style={{ fontSize: 13 }}>{ticket.submittedBy}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Assigned To</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: ticket.assignedTo ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{ticket.assignedTo || 'Unassigned'}</div>
                
                <select value={ticket.assignedTo || ''} onChange={async (e) => {
                  const val = e.target.value || null;
                  await updateTicket(ticket.id, { assignedTo: val });
                  await addActivity(ticket.id, { type: 'system', title: val ? \`Ticket assigned to \${val}\` : 'Ticket unassigned' });
                }} style={{ marginTop: 4, width: '100%', padding: '4px', fontSize: 11, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-secondary)' }}>
                  <option value="">Unassigned</option>
                  {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                </select>
              </div>
            </div>

            {ticket.tags.length > 0 && (
               <div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Tags</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ticket.tags.map(t => (
                      <span key={t} style={{ fontSize: 10, background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 4, color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{t}</span>
                    ))}
                  </div>
               </div>
            )}
          </div>
        </div>

        {/* Communication Panel (Timeline & Reply) - Full Width */}
        <div style={{ height: 'calc(100vh - 280px)', minHeight: 600, border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', background: 'var(--bg-surface)' }}>
          <CommunicationPanel
            familyId={ticket.tenantName}
            familyName={ticket.tenantName}
            linkedRecordType="ticket"
            linkedRecordId={ticket.id}
          />
        </div>
      </div>
    </div>
  );`;

code = code.replace(oldReturnStr, newReturnStr);

fs.writeFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', code);
console.log('Fixed detail view layout according to annotation specs');
