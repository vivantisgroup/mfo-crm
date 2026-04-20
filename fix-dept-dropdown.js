const fs = require('fs');
let code = fs.readFileSync('apps/web/app/(dashboard)/platform/hr/page.tsx', 'utf8');

// Update EmployeeDetailComponent signature
code = code.replace(
  `function EmployeeDetailComponent({ emp, onBack, onSave }: { emp: any, onBack: () => void, onSave: (f: any) => Promise<void> }) {`,
  `function EmployeeDetailComponent({ emp, departments, onBack, onSave }: { emp: any, departments: any[], onBack: () => void, onSave: (f: any) => Promise<void> }) {`
);

// Update Department Select
const oldSelect = `<Select value={form.department} onValueChange={v => setForm({...form, department: v})} disabled={isSaving}>
                  <SelectItem value="Executive">Executive</SelectItem>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="Engineering">Engineering</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                </Select>`;

const newSelect = `<Select value={form.department} onValueChange={v => setForm({...form, department: v})} disabled={isSaving}>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                  ))}
                </Select>`;

code = code.replace(oldSelect, newSelect);

// Update calls to EmployeeDetailComponent
code = code.replace(
  `return <EmployeeDetailComponent emp={empData} onBack={() => setDetailEmpId(null)} onSave={handleSaveEmp} />;`,
  `return <EmployeeDetailComponent emp={empData} departments={departments} onBack={() => setDetailEmpId(null)} onSave={handleSaveEmp} />;\n`
);

fs.writeFileSync('apps/web/app/(dashboard)/platform/hr/page.tsx', code);
console.log('Fixed department selection dropdown');
