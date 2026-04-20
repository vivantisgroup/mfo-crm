const fs = require('fs');

let code = fs.readFileSync('apps/web/app/(dashboard)/platform/hr/page.tsx', 'utf8');

const oldHandleAdd = `       await updateDepartment(deptForm.id, {
         name: deptForm.name,
         headCfo: deptForm.headCfo || '',
         annualBudget: Number(deptForm.annualBudget || 0)
       });
       setDepartments(departments.map(d => d.id === deptForm.id ? { ...deptForm } as Department : d));
    } else {`;

const newHandleAdd = `       const oldDept = departments.find(d => d.id === deptForm.id);
       await updateDepartment(deptForm.id, {
         name: deptForm.name,
         headCfo: deptForm.headCfo || '',
         annualBudget: Number(deptForm.annualBudget || 0)
       });
       setDepartments(departments.map(d => d.id === deptForm.id ? { ...deptForm } as Department : d));
       
       if (oldDept && oldDept.name !== deptForm.name) {
          const employeesToUpdate = employees.filter(e => e.department === oldDept.name);
          await Promise.all(employeesToUpdate.map(e => 
             updateEmployee(e.id, { department: deptForm.name as any })
          ));
          setEmployees(employees.map(e => e.department === oldDept.name ? { ...e, department: deptForm.name } as any : e));
       }
    } else {`;

code = code.replace(oldHandleAdd, newHandleAdd);

fs.writeFileSync('apps/web/app/(dashboard)/platform/hr/page.tsx', code);
console.log('Fixed department rename cascade');
