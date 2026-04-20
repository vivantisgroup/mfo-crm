const fs = require('fs');

let code = fs.readFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', 'utf8');

code = code.replace(
  `{tenantsList.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}`,
  `{tenantsList.map(t => <option key={t.tenantId} value={t.tenantName}>{t.tenantName}</option>)}`
);

fs.writeFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', code);
console.log('Fixed tenantList mapping keys');
