import fs from 'fs';
const file = 'c:/MFO-CRM/apps/web/app/(dashboard)/platform/crm/components/EntitiesTab.tsx';
let code = fs.readFileSync(file, 'utf8');

// Find start and end
const startStr = '// ─── Address Autocomplete Component ──────────────────────────────────────────';
let startIdx = code.indexOf(startStr);
if (startIdx === -1) {
  console.log('Not found');
  process.exit(1);
}

// Find `function AddressAutocomplete({ value, onSave, canEdit = true }: any) {`
const endSearchStr = 'export function EntitiesTab'; // It happens directly after AddressAutocomplete
let endIdx = code.indexOf('interface EntitiesTabProps', startIdx);
if (endIdx === -1) endIdx = code.indexOf(endSearchStr, startIdx);

if (endIdx !== -1) {
  code = code.substring(0, startIdx) + code.substring(endIdx);
}

// ensure import is there
if (!code.includes('import { AddressAutocomplete }')) {
   code = code.replace("import { Button, TextInput,", "import { AddressAutocomplete } from '@/components/AddressAutocomplete';\nimport { Button, TextInput,");
}

fs.writeFileSync(file, code);
console.log('Removed successfully!');
