const fs = require('fs');

let code = fs.readFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', 'utf8');

// 1. Remove DESCRIPTION from the grid
const descriptionTarget = `          {/* Middle Column: Scrollable Description */}
          <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 32, display: 'flex', flexDirection: 'column', height: 140 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, flexShrink: 0 }}>DESCRIPTION</div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {ticket.description}
              
              {ticket.attachments && ticket.attachments.length > 0 && (
                 <div style={{ marginTop: 16, borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Attached Files</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                       {ticket.attachments.map((a, i) => (
                          <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--brand-500)', background: 'var(--brand-50)', padding: '6px 10px', borderRadius: 6, textDecoration: 'none' }}>
                             <Paperclip size={12} />
                             {a.name}
                          </a>
                       ))}
                    </div>
                 </div>
              )}
            </div>
          </div>`;

if (code.includes('Middle Column: Scrollable Description')) {
  code = code.replace(descriptionTarget, '');
}

// 2. Change Grid from 3 cols back to 2 cols
const gridTarget = `padding: '24px 28px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 340px', gap: 32`;
const gridReplacement = `padding: '24px 28px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32`;
code = code.replace(gridTarget, gridReplacement);

// 3. Insert the DESCRIPTION below the header
// It goes right between Header and CommunicationPanel
const insertTarget = `        {/* Communication Panel (Timeline & Reply) - Full Width */}`;
const insertReplacement = `        {/* Scrollable Description Header Block */}
        <div style={{ padding: '16px 28px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column', flexShrink: 0, maxHeight: 180 }}>
           <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, flexShrink: 0 }}>Description</div>
           <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 8, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
             {ticket.description}
              
             {ticket.attachments && ticket.attachments.length > 0 && (
                <div style={{ marginTop: 16, borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
                   <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Attached Files</div>
                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {ticket.attachments.map((a, i) => (
                         <a key={'desc-att-'+i} href={a.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--brand-500)', background: 'var(--brand-50)', padding: '6px 12px', borderRadius: 8, textDecoration: 'none' }}>
                            <Paperclip size={14} />
                            {a.name}
                         </a>
                      ))}
                   </div>
                </div>
             )}
           </div>
        </div>

        {/* Communication Panel (Timeline & Reply) - Full Width */}`;

if (!code.includes('Scrollable Description Header Block')) {
  code = code.replace(insertTarget, insertReplacement);
}

fs.writeFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', code);
console.log('Moved Description block below the header natively.');
