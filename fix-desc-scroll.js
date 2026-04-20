const fs = require('fs');

let code = fs.readFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', 'utf8');

// 1. Fix outer page slight scrolling by heavily reducing calc bounds to absorb margins safely
code = code.replace(
  \`<div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: 'calc(100vh - 120px)' }}>\`,
  \`<div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: 'calc(100vh - 150px)', overflow: 'hidden' }}>\`
);

// 2. Fix the flexbox description scrolling issue
const oldDesc = \`{/* Middle Column: Scrollable Description */}
          <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 32, display: 'flex', flexDirection: 'column', height: 140 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>DESCRIPTION</div>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {ticket.description}
            </div>
          </div>\`;

const newDesc = \`{/* Middle Column: Scrollable Description */}
          <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 32, display: 'flex', flexDirection: 'column', height: 140 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, flexShrink: 0 }}>DESCRIPTION</div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {ticket.description}
            </div>
          </div>\`;

code = code.replace(oldDesc, newDesc);

// 3. Remove conflicting height on Communication Panel
const commOld = \`{/* Communication Panel (Timeline & Reply) - Full Width */}
        <div style={{ height: 'calc(100vh - 280px)', flex: 1, border: '1px solid var(--border)', minHeight: 0, borderRadius: 'var(--radius-xl)', overflow: 'hidden', background: 'var(--bg-surface)' }}>\`;
        
const commNew = \`{/* Communication Panel (Timeline & Reply) - Full Width */}
        <div style={{ flex: 1, border: '1px solid var(--border)', minHeight: 0, borderRadius: 'var(--radius-xl)', overflow: 'hidden', background: 'var(--bg-surface)' }}>\`;

code = code.replace(commOld, commNew);

fs.writeFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', code);
console.log('Fixed flexbox minHeight constraints!');
