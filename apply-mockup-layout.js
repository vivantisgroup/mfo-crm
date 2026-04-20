const fs = require('fs');

let code = fs.readFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', 'utf8');

// 1. Make Container Full Width
const containerTarget = `<div className="animate-fade-in" style={{ maxWidth: 1400, margin: '0 auto' }}>`;
const containerReplacement = `<div className="animate-fade-in" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>`;
code = code.replace(containerTarget, containerReplacement);

// 2. Adjust Grid Columns
const gridTarget = `padding: '24px 28px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 48`;
const gridReplacement = `padding: '24px 28px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(400px, 1.5fr) minmax(300px, 1fr)', gap: 32`;
code = code.replace(gridTarget, gridReplacement);

// 3. Remove the description from underneath the grid
const descriptionBelowTarget = `        {/* Scrollable Description Header Block */}
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

`;
if (code.includes('Scrollable Description Header Block')) {
  code = code.replace(descriptionBelowTarget, '');
}

// 4. Inject Description BOX into the middle of the Grid Block
const rightColumnTarget = `          {/* Right Column: Ticket Attributes */}`;
const descriptionBoxCode = `          {/* Middle Column: Bounded Description Box */}
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

          {/* Right Column: Ticket Attributes */}`;

if (!code.includes('Middle Column: Bounded Description Box')) {
  code = code.replace(rightColumnTarget, descriptionBoxCode);
}

fs.writeFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', code);
console.log('Restored Description Box inside a responsive full-width 3-column grid header.');
