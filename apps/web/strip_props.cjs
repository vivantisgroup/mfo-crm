const fs = require('fs');
const path = 'C:/MFO-CRM/apps/web/app/(dashboard)/dashboard/page.tsx';
let txt = fs.readFileSync(path, 'utf8');

// Regex to strip Tremor decoration props off the divs
txt = txt.replace(/ decoration="top"/g, '');
txt = txt.replace(/ decorationColor="[a-zA-Z0-9-]+"/g, '');
txt = txt.replace(/ decorationColor=\{[^\}]+\}/g, '');

fs.writeFileSync(path, txt);
console.log('Props stripped successfully!');
