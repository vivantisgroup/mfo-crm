const fs = require('fs');
const txt = fs.readFileSync('c:/MFO-CRM/apps/web/app/(dashboard)/financial-engineer/components/AdvisorSimulator.tsx', 'utf8');
const lines = txt.split('\n');
let b = [];
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('`')) {
        let count = (lines[i].match(/`/g) || []).length;
        b.push((i + 1) + ': (' + count + ') ' + lines[i].trim());
    }
}
fs.writeFileSync('c:/MFO-CRM/apps/web/check2.txt', b.join('\n'), 'utf8');
