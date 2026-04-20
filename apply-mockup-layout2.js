const fs = require('fs');
let code = fs.readFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', 'utf8');

// The entire header block needs to be replaced. 
// From:
// {/* Header containing Title & Attributes */}
// to:
// {/* Middle Column: Bounded Description ... through Right Column */}
// Let's use string operations by replacing chunks.

const gridConfigTarget = `borderRadius: 'var(--radius-xl)', display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(400px, 1.5fr) minmax(300px, 1fr)', gap: 32 }}`;
const gridConfigReplacement = `borderRadius: 'var(--radius-xl)', display: 'flex', gap: 40 }}`;
code = code.replace(gridConfigTarget, gridConfigReplacement);

const leftColStartTarget = `          {/* Left Column: Title & Controls */}
          <div>`;
const leftColStartReplacement = `          {/* Left Column: Title & Controls */}
          <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>`;
code = code.replace(leftColStartTarget, leftColStartReplacement);

// We need to fuse the Middle Column and Right Column together into a single flexible Right Column.
const middleAndRightTarget = `          {/* Middle Column: Bounded Description Box */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', background: 'var(--bg-canvas)', display: 'flex', flexDirection: 'column', height: 160 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, flexShrink: 0 }}>DESCRIPTION</div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {ticket.description}
              
              {ticket.attachments && ticket.attachments.length > 0 && (
                 <div style={{ marginTop: 16, borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Attached Files</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                       {ticket.attachments.map((a, i) => (
                          <a key={'mid-att-'+i} href={a.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--brand-500)', background: 'var(--brand-50)', padding: '4px 8px', borderRadius: 6, textDecoration: 'none' }}>
                             <Paperclip size={12} />
                             {a.name}
                          </a>
                       ))}
                    </div>
                 </div>
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
                }} className="input" style={{ width: '100%', padding: '4px 8px', fontSize: 12, marginTop: 4 }}>
                  <option value="">Unassigned</option>
                  <option value="Admin">Admin</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>
            </div>
          </div>`;

const middleAndRightReplacement = `          {/* Right Column: Combined Attributes & Description */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Top Row: Attributes */}
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', paddingLeft: 20, borderLeft: '1px solid var(--border)', alignItems: 'flex-start' }}>
               <div style={{ flex: 1, minWidth: 120 }}>
                 <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Tenant</div>
                 <div style={{ fontSize: 13, color: 'var(--brand-400)', fontWeight: 700, cursor: 'pointer' }}>{ticket.tenantName}</div>
               </div>
               <div style={{ flex: 1, minWidth: 140 }}>
                 <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>SLA Deadline</div>
                 <div style={{ fontSize: 13, color: ticket.slaBreached ? '#ef4444' : 'var(--text-primary)', fontWeight: 700 }}>{new Date(ticket.slaDeadline).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
               </div>
               <div style={{ flex: 1, minWidth: 120 }}>
                 <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Requester</div>
                 <div style={{ fontSize: 13, fontWeight: 500 }}>{ticket.submittedBy}</div>
               </div>
               <div style={{ flex: 1.5, minWidth: 160 }}>
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

            {/* Bottom Row: Bounded Description Box */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', background: 'var(--bg-canvas)', display: 'flex', flexDirection: 'column', height: 160 }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, flexShrink: 0 }}>DESCRIPTION</div>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {ticket.description}
                
                {ticket.attachments && ticket.attachments.length > 0 && (
                   <div style={{ marginTop: 16, borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
                      <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Attached Files</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                         {ticket.attachments.map((a, i) => (
                            <a key={'mid-att-'+i} href={a.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--brand-500)', background: 'var(--brand-50)', padding: '4px 8px', borderRadius: 6, textDecoration: 'none' }}>
                               <Paperclip size={12} />
                               {a.name}
                            </a>
                         ))}
                      </div>
                   </div>
                )}
              </div>
            </div>

          </div>`;

if (code.includes('Middle Column: Bounded Description Box')) {
  code = code.replace(middleAndRightTarget, middleAndRightReplacement);
}

fs.writeFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', code);
console.log('Restructured 2-column stacked asymmetric layout successfully');
