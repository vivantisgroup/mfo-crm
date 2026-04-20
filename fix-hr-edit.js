const fs = require('fs');

// 1. Update hrService.ts to add updateEmployee
let hrSvc = fs.readFileSync('apps/web/lib/hrService.ts', 'utf8');
if (!hrSvc.includes('updateEmployee')) {
  const newFunc = `
export async function updateEmployee(id: string, updates: Partial<Omit<Employee, 'id'>>): Promise<void> {
  const docRef = doc(db, 'platform_people', id);
  await updateDoc(docRef, updates);
}
`;
  hrSvc = hrSvc.replace("export async function addEmployee(entry: Omit<Employee, 'id'>): Promise<Employee> {\n  const docRef = await addDoc(collection(db, 'platform_people'), entry);\n  return { id: docRef.id, ...entry };\n}", 
  "export async function addEmployee(entry: Omit<Employee, 'id'>): Promise<Employee> {\n  const docRef = await addDoc(collection(db, 'platform_people'), entry);\n  return { id: docRef.id, ...entry };\n}" + newFunc);
  fs.writeFileSync('apps/web/lib/hrService.ts', hrSvc);
}

// 2. Update page.tsx
let page = fs.readFileSync('apps/web/app/(dashboard)/platform/hr/page.tsx', 'utf8');

if (!page.includes("updateEmployee")) {
  page = page.replace("addEmployee, addCommission", "addEmployee, updateEmployee, addCommission");
}

const oldHandleSave = `    } else {\n       // if edit exists\n    }`;
const newHandleSave = `    } else {
       await updateEmployee(form.id, {
         name: form.name,
         title: form.title || '',
         department: form.department as any,
         employmentType: (form.employmentType as any) || 'Full-Time',
         baseSalary: Number(form.baseSalary),
         location: form.location || '',
         startDate: form.startDate || new Date().toISOString()
       });
       setEmployees(employees.map(e => e.id === form.id ? { ...form } as any : e));
    }`;

page = page.replace(oldHandleSave, newHandleSave);

// Make the rows clickable
const oldRow = `<TableRow key={emp.id} className="hover:bg-slate-50 transition-colors cursor-pointer group">`;
const newRow = `<TableRow key={emp.id} onClick={() => setDetailEmpId(emp.id)} className="hover:bg-slate-50 transition-colors cursor-pointer group">`;

page = page.replace(oldRow, newRow);

fs.writeFileSync('apps/web/app/(dashboard)/platform/hr/page.tsx', page);
console.log('Fixed HR Employee Update');
