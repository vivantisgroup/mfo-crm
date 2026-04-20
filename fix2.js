const fs = require('fs');
const filepath = 'c:/MFO-CRM/apps/web/components/SharingModal.tsx';
let content = fs.readFileSync(filepath, 'utf8');
content = content.replace(/\\`/g, '`');
content = content.replace(/\\\$\{/g, '${');
fs.writeFileSync(filepath, content);
console.log('Fixed syntax errors in SharingModal.tsx');
