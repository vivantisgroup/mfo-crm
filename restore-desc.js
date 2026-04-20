const fs = require('fs');

let code = fs.readFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', 'utf8');

const oldGridStr = `display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32`;
const newGridStr = `display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 340px', gap: 32`;

code = code.replace(oldGridStr, newGridStr);

const middleColStr = `
          {/* Middle Column: Scrollable Description */}
          <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 32, display: 'flex', flexDirection: 'column', height: 140 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Original Description</div>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {ticket.description}
            </div>
          </div>
`;

// Insert it right before {/* Right Column: Ticket Attributes */}
code = code.replace(
  `{/* Right Column: Ticket Attributes */}`,
  middleColStr + `\n          {/* Right Column: Ticket Attributes */}`
);

fs.writeFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', code);
console.log('Restored scrollable description in the middle column');
