const fs = require('fs');

let code = fs.readFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', 'utf8');

code = code.replace(
  `Original Description</div>`,
  `DESCRIPTION</div>`
);

// We'll also remove the overall page height constraint that might force scrolling, mapping the Communication Hub strictly to flex 1
code = code.replace(
  `<div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>`,
  `<div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: 'calc(100vh - 120px)' }}>`
);

code = code.replace(
  `minHeight: 600, border: '1px solid var(--border)'`,
  `flex: 1, border: '1px solid var(--border)', minHeight: 0`
);

fs.writeFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', code);
console.log('Fixed label and page layout scaling rules.');
