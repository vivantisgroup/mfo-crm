const fs = require('fs');

let code = fs.readFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', 'utf8');

// 1. Add import for getAllTenants and TenantRecord
code = code.replace(`import { getEmployees, Employee } from '@/lib/hrService';`, `import { getEmployees, Employee } from '@/lib/hrService';\nimport { getAllTenants, TenantRecord } from '@/lib/platformService';`);

// 2. Add state
code = code.replace(`const [employees, setEmployees] = useState<Employee[]>([]);`, `const [employees, setEmployees] = useState<Employee[]>([]);\n  const [tenantsList, setTenantsList] = useState<TenantRecord[]>([]);`);

// 3. Add to useEffect
code = code.replace(`getEmployees().then(setEmployees);`, `getEmployees().then(setEmployees);\n    getAllTenants().then(setTenantsList);`);

// 4. Update the input to select
const oldTenantInput = `<div style={{ flex: 1 }}>
                 <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>Tenant</label>
                 <input type="text" className="input" style={{ width: '100%', padding: '10px 12px' }} value={form.tenantName || ''} onChange={e => setForm({...form, tenantName: e.target.value})} placeholder="Acme Corp" />
               </div>`;

const newTenantInput = `<div style={{ flex: 1 }}>
                 <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>Tenant</label>
                 <select className="input" style={{ width: '100%', padding: '10px 12px' }} value={form.tenantName || ''} onChange={e => setForm({...form, tenantName: e.target.value})}>
                    <option value="">Select Tenant...</option>
                    <option value="Internal">Internal (MFO HQ)</option>
                    {tenantsList.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                 </select>
               </div>`;

code = code.replace(oldTenantInput, newTenantInput);

fs.writeFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', code);
console.log('Patched support form with tenant dropdown');
