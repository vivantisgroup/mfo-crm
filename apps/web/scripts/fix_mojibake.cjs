const fs = require('fs');
const file = 'c:/MFO-CRM/apps/web/app/(dashboard)/financial-engineer/components/AdvisorSimulator.tsx';
let txt = fs.readFileSync(file, 'utf8');

// Fix the Double UTF8 encoding (mojibake)
let fixedTxt = Buffer.from(txt, 'latin1').toString('utf8');

fs.writeFileSync(file, fixedTxt, 'utf8');
console.log('Fixed Mojibake');
