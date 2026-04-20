const fs = require('fs');

let code = fs.readFileSync('apps/web/app/(dashboard)/platform/finance/page.tsx', 'utf8');

// 1. Update the EmployeesTab signature and onSave body
const oldSignature = `function EmployeesTab({ employees, onAddClick, updateEmp, contacts, members }: { employees: any[], onAddClick: () => void, updateEmp: any, contacts: any[], members: any[] }) {`;
const newSignature = `function EmployeesTab({ employees, onAddClick, updateEmp, contacts, members }: { employees: any[], onAddClick: (data?: any) => Promise<void> | void, updateEmp: any, contacts: any[], members: any[] }) {`;
code = code.replace(oldSignature, newSignature);

const oldOnSave = `        if (data.id === "new") {
          // This calls an API directly here for simplicity, or re-uses parent
          const { addEmployee } = await import("@/lib/peopleService");
          await addEmployee(data);
          onAddClick(); // notify parent to refresh
          setDetailId(null);
        }`;
const newOnSave = `        if (data.id === "new") {
          const { id, ...rest } = data;
          await onAddClick(rest);
          setDetailId(null);
        }`;
code = code.replace(oldOnSave, newOnSave);

const oldNoEmpAddClick = `<Button onClick={() => setDetailId("new")} icon={() => <span className="mr-2">➕</span>}>Add First Employee</Button>`;
// verify it's just this
if (!code.includes(oldOnSave)) {
  console.log('Replacing onSave manually if fuzzy matching missed due to whitespace');
  // Just a string fallback
  code = code.replace(/if \(data\.id === "new"\) \{[\s\S]*?setDetailId\(null\);\s*\}/, newOnSave);
}

// 2. Update the calling element in FinanceHubPage
const oldRender = `<EmployeesTab employees={employees} onAddClick={() => { /* We could re-trigger full fetch, but simplistic app is ok */ }} updateEmp={async (id, data) => { const { updateEmployee } = await import("@/lib/peopleService"); await updateEmployee(id, data); setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...data } : e)); }} contacts={contacts} members={members} />`;
const newRender = `<EmployeesTab employees={employees} onAddClick={async (data) => { if (!data) return; const { addEmployee } = await import("@/lib/peopleService"); const newEmp = await addEmployee(data); setEmployees(prev => [...prev, newEmp]); }} updateEmp={async (id, data) => { const { updateEmployee } = await import("@/lib/peopleService"); await updateEmployee(id, data); setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...data } : e)); }} contacts={contacts} members={members} />`;

code = code.replace(oldRender, newRender);

// fallback if the whitespace is off
if (!code.includes(newRender)) {
   code = code.replace(/<EmployeesTab employees=\{employees\} onAddClick=\{[\s\S]*?members=\{members\} \/>/, newRender);
}

fs.writeFileSync('apps/web/app/(dashboard)/platform/finance/page.tsx', code);
console.log('Fixed onAddClick to update state!');
