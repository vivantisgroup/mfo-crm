const fs = require('fs');

let code = fs.readFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', 'utf8');

// 1. Expand max width from 800 to 1400
code = code.replace(
  `style={{ maxWidth: 800, margin: '0 auto', paddingBottom: 100 }}`,
  `style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 100 }}`
);

// 2. Import getAllContacts from crmService
const hrImport = `import { getEmployees, Employee } from '@/lib/hrService';`;
if (code.includes(hrImport)) {
  code = code.replace(
    hrImport,
    `import { getEmployees, Employee } from '@/lib/hrService';\nimport { getAllContacts, type PlatformContact } from '@/lib/crmService';`
  );
}

// 3. Add contacts state
const statePattern = `const [tenantsList, setTenantsList] = useState<TenantSubscription[]>([]);`;
if (code.includes(statePattern)) {
  code = code.replace(
    statePattern,
    `const [tenantsList, setTenantsList] = useState<TenantSubscription[]>([]);\n  const [contacts, setContacts] = useState<PlatformContact[]>([]);`
  );
}

// 4. Fetch contacts in useEffect
const effectPattern = `getAllSubscriptions().then(setTenantsList);`;
if (code.includes(effectPattern)) {
  code = code.replace(
    effectPattern,
    `getAllSubscriptions().then(setTenantsList);\n    getAllContacts().then(setContacts);`
  );
}

// 5. Upgrade Requester input to Dropdown
const oldRequesterStr = `<div style={{ flex: 1 }}>
                 <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>Requester Name</label>
                 <input type="text" className="input" style={{ width: '100%', padding: '10px 12px' }} value={form.submittedBy || ''} onChange={e => setForm({...form, submittedBy: e.target.value})} placeholder="Jane Doe" disabled={formMode === 'edit'} />
               </div>`;

const newRequesterStr = `<div style={{ flex: 1 }}>
                 <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>Requester Name</label>
                 <select className="input" style={{ width: '100%', padding: '10px 12px' }} value={form.submittedBy || ''} onChange={e => setForm({...form, submittedBy: e.target.value})} disabled={formMode === 'edit'}>
                   <option value="">Select Requester...</option>
                   <optgroup label="Internal Employees">
                     {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                   </optgroup>
                   <optgroup label="CRM Contacts">
                     {contacts.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                   </optgroup>
                 </select>
               </div>`;

code = code.replace(oldRequesterStr, newRequesterStr);

fs.writeFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', code);
console.log('Fixed requester dropdown and wide form layout.');
