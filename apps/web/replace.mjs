import fs from 'fs';
const file = 'c:/MFO-CRM/apps/web/app/(dashboard)/platform/crm/components/EntitiesTab.tsx';
const code = fs.readFileSync(file, 'utf8');
const replacement = fs.readFileSync('c:/MFO-CRM/apps/web/tmp_ContactDetailView.tsx', 'utf8');

const regex = /function ContactDetailView\(\{ contact, orgs, onRefresh, performer \}: any\) \{[\s\S]*?\}\s*(?=\/\/\s*─────────────────────────────────────────────────────────────────────────────\r?\n\/\/\s*ACCOUNT PLAN DOCK)/;

if(!regex.test(code)) { 
  console.error('Regex failed!'); 
  process.exit(1); 
} 
const newCode = code.replace(regex, replacement + '\n\n'); 
fs.writeFileSync(file, newCode); 
console.log('Replacement successful!');
