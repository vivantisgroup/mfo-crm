const fs = require('fs');
let code = fs.readFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', 'utf8');

const targetStr = `        {/* Header containing Title & Attributes */}
        <div style={{ padding: '24px 28px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', display: 'flex', gap: 40 }}>
          
          {/* Left Column: Title & Controls */}
          <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
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

          

          {/* Right Column: Combined Attributes & Description */}
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

          </div>
        </div>`;

const replacementStr = `        {/* Head Block Container */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
           
           {/* Row 1: Title and Attributes */}
           <div style={{ padding: '24px 28px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', display: 'grid', gridTemplateColumns: '320px 1fr', gap: 40, alignItems: 'center' }}>
             
             {/* Left Column: Title & Controls */}
             <div style={{ display: 'flex', flexDirection: 'column' }}>
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
               
               <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 16, lineHeight: 1.3 }}>{ticket.title}</div>
               
               <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
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

             {/* Right Column: Attributes array spread wide */}
             <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', borderLeft: '1px solid var(--border)', paddingLeft: 32, alignItems: 'flex-start' }}>
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
                  }} className="input" style={{ width: '100%', padding: '4px 8px', fontSize: 12, border: '1px solid var(--border)', background: 'var(--bg-canvas)', borderRadius: 4, fontWeight: 500 }}>
                    <option value="">Unassigned</option>
                    <option value="Admin">Admin</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                  </select>
                </div>
             </div>
           </div>

           {/* Row 2: Full Width Isolated Description Box */}
           <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '20px 28px', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', flexShrink: 0, maxHeight: 180 }}>
             <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, flexShrink: 0 }}>DESCRIPTION</div>
             <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 8, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
               {ticket.description}
               
               {ticket.attachments && ticket.attachments.length > 0 && (
                  <div style={{ marginTop: 24, borderTop: '1px dashed var(--border)', paddingTop: 16 }}>
                     <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-tertiary)', borderLeft: '3px solid var(--brand-500)', paddingLeft: 8, marginBottom: 12 }}>Attached Files</div>
                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        {ticket.attachments.map((a, i) => (
                           <a key={'def-att-'+i} href={a.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--brand-500)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: 8, textDecoration: 'none' }}>
                              <Paperclip size={14} />
                              {a.name}
                           </a>
                        ))}
                     </div>
                  </div>
               )}
             </div>
           </div>
        </div>`;

if (code.includes('Combined Attributes & Description')) {
  code = code.replace(targetStr, replacementStr);
  fs.writeFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', code);
  console.log('Restructured perfectly. Description sweeps entire page entirely underneath.');
} else {
  console.log('Could not find chunk');
  process.exit(1);
}
